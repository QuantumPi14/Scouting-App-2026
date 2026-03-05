import { useRef, useState, useEffect, useCallback } from 'react'
import type { AutoPathData } from '../types'
import styles from './AutoPathEditor.module.css'

const FIELD_IMAGE_SRC = `${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '')}/2026-field.png`

type MarkerType = 'start' | 'end' | 'climb' | 'shot' | 'waypoint'

interface Marker {
  type: MarkerType
  x: number
  y: number
  onField: boolean
  id: string
}

const PALETTE_MARKERS: MarkerType[] = ['start', 'end', 'climb', 'shot', 'waypoint']

export function AutoPathEditor({
  onSave,
  savedImage,
  savedPathData: _savedPathData,
}: {
  onSave: (imageData: string | undefined, pathData: AutoPathData | undefined) => void
  savedImage?: string
  savedPathData?: AutoPathData
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const idCounterRef = useRef(0)
  const [fieldLoaded, setFieldLoaded] = useState(false)
  const [fieldSize, setFieldSize] = useState({ w: 600, h: 300 })
  const [markers, setMarkers] = useState<Marker[]>([])
  const [dragging, setDragging] = useState<{ id: string } | null>(null)
  const [fieldLoadErrorUrl, setFieldLoadErrorUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const resetEditor = useCallback(() => {
    setMarkers([])
    idCounterRef.current = 0
    onSave(undefined, undefined)
  }, [onSave])

  const computeFieldSize = useCallback((img: HTMLImageElement, containerWidth: number) => {
    const maxW = containerWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)
    const maxH = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.55) : 450
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
    return { w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) }
  }, [])

  const loadField = useCallback(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setFieldLoadErrorUrl(null)
      const containerWidth = containerRef.current?.offsetWidth ?? 0
      setFieldSize(computeFieldSize(img, containerWidth))
      setFieldLoaded(true)
    }
    img.onerror = () => {
      setFieldSize({ w: 600, h: 300 })
      setFieldLoaded(true)
      setFieldLoadErrorUrl(FIELD_IMAGE_SRC)
    }
    img.src = FIELD_IMAGE_SRC
  }, [computeFieldSize])

  useEffect(() => {
    loadField()
  }, [loadField])

  useEffect(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img?.complete || !container) return
    const ro = new ResizeObserver(() => {
      setFieldSize(computeFieldSize(img, container.offsetWidth))
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [fieldLoaded, computeFieldSize])

  const createMarker = (type: MarkerType): string => {
    const id = `${type}-${idCounterRef.current++}`
    setMarkers((m) => [...m, { type, x: 0.5, y: 0.9, onField: false, id }])
    return id
  }

  const getMarkerColor = (type: MarkerType) => {
    switch (type) {
      case 'start': return '#22c55e'
      case 'end': return '#ef4444'
      case 'climb': return '#3b82f6'
      case 'shot': return '#eab308'
      case 'waypoint': return '#a855f7'
      default: return '#888'
    }
  }

  const getMarkerLabel = (type: MarkerType) => {
    switch (type) {
      case 'start': return 'Start'
      case 'end': return 'End'
      case 'climb': return 'Climb'
      case 'shot': return 'Shot'
      case 'waypoint': return 'Waypoint'
      default: return type
    }
  }

  const canvasToField = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
  }

  const handlePointerDown = (clientX: number, clientY: number) => {
    const pt = canvasToField(clientX, clientY)
    if (!pt) return
    const hitRadius = 0.045
    const hit = markers.find((m) => m.onField && Math.hypot(m.x - pt.x, m.y - pt.y) < hitRadius)
    if (hit) {
      setDragging({ id: hit.id })
      return
    }
  }

  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    if (dragging) {
      setMarkers((m) => m.map((mark) => (mark.id === dragging.id ? { ...mark, x, y, onField: true } : mark)))
      return
    }
  }

  const handlePointerUp = (clientX: number, clientY: number) => {
    const id = dragging?.id
    setDragging(null)
    if (id && trashRef.current) {
      const rect = trashRef.current.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        setMarkers((m) => m.filter((x) => x.id !== id))
      }
    }
  }

  const handleStripMarkerMouseDown = (e: React.MouseEvent, type: MarkerType) => {
    e.preventDefault()
    const id = createMarker(type)
    setDragging({ id })
  }

  const handleStripMarkerTouchStart = (e: React.TouchEvent, type: MarkerType) => {
    e.preventDefault()
    const id = createMarker(type)
    setDragging({ id })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragging) return
    if (e.button !== 0) return
    handlePointerDown(e.clientX, e.clientY)
  }

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    handlePointerUp(e.clientX, e.clientY)
  }

  const handleCanvasMouseLeave = () => {
    if (!dragging) setDragging(null)
  }

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return
    e.preventDefault()
    if (dragging) return
    const t = e.touches[0]
    handlePointerDown(t.clientX, t.clientY)
  }

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return
    e.preventDefault()
    const t = e.touches[0]
    handlePointerMove(t.clientX, t.clientY)
  }

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 0) return
    e.preventDefault()
    const t = e.changedTouches[0]
    handlePointerUp(t.clientX, t.clientY)
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
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const t = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (t.clientY - rect.top) / rect.height))
      setMarkers((m) => m.map((mark) => (mark.id === dragging.id ? { ...mark, x, y, onField: true } : mark)))
    }
    const onUp = (e: MouseEvent) => {
      const id = dragging.id
      setDragging(null)
      if (trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          setMarkers((m) => m.filter((x) => x.id !== id))
        }
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return
      const id = dragging.id
      const t = e.changedTouches[0]
      setDragging(null)
      if (trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect()
      if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
        setMarkers((m) => m.filter((x) => x.id !== id))
      }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
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
    const r = Math.max(6, Math.floor(drawW / 80))
    markers.forEach((mark) => {
      if (!mark.onField) return
      const mx = offsetX + mark.x * drawW
      const my = offsetY + mark.y * drawH
      ctx.fillStyle = getMarkerColor(mark.type)
      ctx.beginPath()
      ctx.arc(mx, my, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [fieldLoaded, fieldSize, markers, fieldLoadErrorUrl])

  const savePath = () => {
    if (!imgRef.current) return
    const pathData: AutoPathData = {
      markers: markers.filter((m) => m.onField).map((m) => ({ type: m.type, id: m.id, x: m.x, y: m.y })),
    }
    const img = imgRef.current
    const off = document.createElement('canvas')
    off.width = img.naturalWidth
    off.height = img.naturalHeight
    const ctx = off.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const W = off.width
    const H = off.height
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
    onSave(off.toDataURL('image/png'), pathData)
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
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          style={{ width: fieldSize.w, height: fieldSize.h, maxWidth: '100%', touchAction: 'none' }}
        />
      </div>
      <div className={styles.strip}>
        {PALETTE_MARKERS.map((type) => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendLabel}>{getMarkerLabel(type)}</span>
            <div
              className={styles.stripMarker}
              style={{ background: getMarkerColor(type), touchAction: 'none' }}
              onMouseDown={(e) => handleStripMarkerMouseDown(e, type)}
              onTouchStart={(e) => handleStripMarkerTouchStart(e, type)}
              role="button"
              tabIndex={0}
            />
          </div>
        ))}
        <div ref={trashRef} className={styles.trashBin} title="Drag a marker here to remove it from the field">
          <span className={styles.trashIcon} aria-hidden>🗑</span>
          <span className={styles.trashLabel}>Remove marker</span>
        </div>
      </div>
      <p className={styles.dragHint}>Drag markers from the strip onto the field, or drag markers on the field to move them.</p>
      <div className={styles.saveRow}>
        <button type="button" className={styles.savePathBtn} onClick={savePath}>Save path</button>
      </div>
    </div>
  )
}
