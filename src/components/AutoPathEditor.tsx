import { useRef, useState, useEffect, useCallback } from 'react'
import styles from './AutoPathEditor.module.css'

const FIELD_IMAGE_SRC = `${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '')}/2026-field.png`

type MarkerType = 'start' | 'end' | 'climb' | 'shot'

interface Marker {
  type: MarkerType
  x: number
  y: number
  onField: boolean
  id: string
}

interface PathPoint {
  x: number
  y: number
}

const INITIAL_MARKERS: Marker[] = [
  { type: 'start', x: 0.1, y: 0.9, onField: false, id: 'start' },
  { type: 'end', x: 0.2, y: 0.9, onField: false, id: 'end' },
  { type: 'climb', x: 0.3, y: 0.9, onField: false, id: 'climb' },
  { type: 'shot', x: 0.4, y: 0.9, onField: false, id: 'shot0' },
]

export function AutoPathEditor({ onSave, savedImage }: { onSave: (base64: string | undefined) => void; savedImage?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const [fieldLoaded, setFieldLoaded] = useState(false)
  const [fieldSize, setFieldSize] = useState({ w: 600, h: 300 })
  const [markers, setMarkers] = useState<Marker[]>(() => [...INITIAL_MARKERS])
  const [shotCount, setShotCount] = useState(1)
  const [path, setPath] = useState<PathPoint[]>([])
  const [drawing, setDrawing] = useState(false)
  const [dragging, setDragging] = useState<{ id: string } | null>(null)
  const [fieldLoadErrorUrl, setFieldLoadErrorUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const resetEditor = useCallback(() => {
    setPath([])
    setMarkers([...INITIAL_MARKERS])
    setShotCount(1)
    onSave(undefined)
  }, [onSave])

  const loadField = useCallback(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setFieldLoadErrorUrl(null)
      const maxW = containerRef.current ? Math.min(containerRef.current.offsetWidth, 700) : 600
      const scale = maxW / img.naturalWidth
      setFieldSize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) })
      setFieldLoaded(true)
    }
    img.onerror = () => {
      setFieldSize({ w: 600, h: 300 })
      setFieldLoaded(true)
      setFieldLoadErrorUrl(FIELD_IMAGE_SRC)
    }
    img.src = FIELD_IMAGE_SRC
  }, [])

  useEffect(() => {
    loadField()
  }, [loadField])

  const addShotMarker = () => {
    const id = `shot${shotCount}`
    setShotCount((c) => c + 1)
    setMarkers((m) => [...m, { type: 'shot', x: 0.4 + (shotCount + 1) * 0.05, y: 0.9, onField: false, id }])
  }

  const getMarkerColor = (type: MarkerType) => {
    switch (type) {
      case 'start': return '#22c55e'
      case 'end': return '#ef4444'
      case 'climb': return '#3b82f6'
      case 'shot': return '#eab308'
      default: return '#888'
    }
  }

  const getMarkerLabel = (type: MarkerType) => {
    switch (type) {
      case 'start': return 'Start'
      case 'end': return 'End'
      case 'climb': return 'Climb'
      case 'shot': return 'Shot'
      default: return type
    }
  }

  const canvasToField = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
  }

  const handleStripMarkerMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setDragging({ id })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (dragging) {
      setMarkers((m) => m.map((mark) => (mark.id === dragging.id ? { ...mark, x, y, onField: true } : mark)))
      return
    }
    if (drawing) setPath((p) => [...p, { x, y }])
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragging) return
    const pt = canvasToField(e.clientX, e.clientY)
    if (!pt || e.button !== 0) return
    const hitRadius = 0.02
    const hit = markers.find((m) => m.onField && Math.hypot(m.x - pt.x, m.y - pt.y) < hitRadius)
    if (hit) {
      setDragging({ id: hit.id })
      return
    }
    setDrawing(true)
    setPath((p) => [...p, pt])
  }

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDrawing(false)
    const id = dragging?.id
    setDragging(null)
    if (id && trashRef.current) {
      const rect = trashRef.current.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setMarkers((m) => {
          const mark = m.find((x) => x.id === id)
          if (!mark) return m
          if (mark.type === 'shot') return m.filter((x) => x.id !== id)
          const idx = m.findIndex((x) => x.id === id)
          const stripX = 0.1 + idx * 0.1
          return m.map((x) => (x.id === id ? { ...x, x: stripX, y: 0.9, onField: false } : x))
        })
      }
    }
  }

  const handleCanvasMouseLeave = () => {
    setDrawing(false)
    if (!dragging) setDragging(null)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      setMarkers((m) => m.map((mark) => (mark.id === dragging.id ? { ...mark, x, y, onField: true } : mark)))
    }
    const onUp = (e: MouseEvent) => {
      const id = dragging.id
      setDragging(null)
      if (trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          setMarkers((m) => {
            const mark = m.find((x) => x.id === id)
            if (!mark) return m
            if (mark.type === 'shot') return m.filter((x) => x.id !== id)
            const idx = m.findIndex((x) => x.id === id)
            return m.map((x) => (x.id === id ? { ...x, x: 0.1 + idx * 0.1, y: 0.9, onField: false } : x))
          })
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fieldLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = imgRef.current
    if (!img) {
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, fieldSize.w, fieldSize.h)
      ctx.fillStyle = '#555'
      ctx.font = '14px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Add 2026-field.png to public/ folder', fieldSize.w / 2, fieldSize.h / 2)
      if (fieldLoadErrorUrl) ctx.fillText(`Tried: ${fieldLoadErrorUrl}`, fieldSize.w / 2, fieldSize.h / 2 + 20)
      return
    }
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const scale = Math.min(rect.width / fieldSize.w, rect.height / fieldSize.h)
    const drawW = fieldSize.w * scale
    const drawH = fieldSize.h * scale
    const offsetX = (rect.width - drawW) / 2
    const offsetY = (rect.height - drawH) / 2
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, offsetX, offsetY, drawW, drawH)
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (path.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(offsetX + path[0].x * drawW, offsetY + path[0].y * drawH)
      for (let i = 1; i < path.length; i++) ctx.lineTo(offsetX + path[i].x * drawW, offsetY + path[i].y * drawH)
      ctx.stroke()
    }
    markers.forEach((mark) => {
      if (!mark.onField) return
      const mx = offsetX + mark.x * drawW
      const my = offsetY + mark.y * drawH
      ctx.fillStyle = getMarkerColor(mark.type)
      ctx.beginPath()
      ctx.arc(mx, my, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [fieldLoaded, fieldSize, path, markers, fieldLoadErrorUrl])

  const savePath = () => {
    if (!imgRef.current) return
    const img = imgRef.current
    const off = document.createElement('canvas')
    off.width = img.naturalWidth
    off.height = img.naturalHeight
    const ctx = off.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const W = off.width
    const H = off.height
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = Math.max(2, Math.floor(W / 200))
    ctx.lineCap = 'round'
    if (path.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(path[0].x * W, path[0].y * H)
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * W, path[i].y * H)
      ctx.stroke()
    }
    const r = Math.max(4, Math.floor(W / 80))
    markers.forEach((mark) => {
      if (!mark.onField) return
      ctx.fillStyle = getMarkerColor(mark.type)
      ctx.beginPath()
      ctx.arc(mark.x * W, mark.y * H, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    onSave(off.toDataURL('image/png'))
  }

  if (savedImage) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.savedLabel}>Saved path:</p>
        <img src={savedImage} alt="Saved auto path" className={styles.savedImg} />
        <button type="button" onClick={resetEditor}>Clear and edit again</button>
      </div>
    )
  }

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.canvasWrap} style={{ width: fieldSize.w, maxWidth: '100%', height: fieldSize.h }}>
        <canvas
          ref={canvasRef}
          width={fieldSize.w}
          height={fieldSize.h}
          className={styles.canvas}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          style={{ width: fieldSize.w, height: fieldSize.h, maxWidth: '100%', cursor: drawing ? 'crosshair' : 'default' }}
        />
      </div>
      <div className={styles.strip}>
        {markers.map((mark) => (
          <div key={mark.id} className={styles.legendItem}>
            <span className={styles.legendLabel}>{getMarkerLabel(mark.type)}{mark.type === 'shot' && mark.id !== 'shot0' ? ` (${mark.id.replace('shot', '')})` : ''}</span>
            <div
              className={styles.stripMarker}
              data-marker-id={mark.id}
              style={{ background: getMarkerColor(mark.type) }}
              onMouseDown={(e) => handleStripMarkerMouseDown(e, mark.id)}
              role="button"
              tabIndex={0}
            />
          </div>
        ))}
        <button type="button" className={styles.addShotBtn} onClick={addShotMarker}>+ Shot</button>
        <div ref={trashRef} className={styles.trashBin} title="Drag a marker here to remove it from the field">
          <span className={styles.trashIcon} aria-hidden>🗑</span>
          <span className={styles.trashLabel}>Remove marker</span>
        </div>
      </div>
      <p className={styles.dragHint}>Drag markers from the strip onto the field, or drag markers on the field to move them. Draw the path by clicking/dragging on the field.</p>
      <div className={styles.saveRow}>
        <button type="button" className={styles.savePathBtn} onClick={savePath}>Save path</button>
      </div>
    </div>
  )
}
