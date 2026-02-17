import { useRef, useState, useEffect } from 'react'
import type { AutoPathData } from '../types'
import styles from './AutoPathViewer.module.css'

const FIELD_IMAGE_SRC = `${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '')}/2026-field.png`

const MARKER_COLORS: Record<AutoPathData['markers'][0]['type'], string> = {
  start: '#22c55e',
  end: '#ef4444',
  climb: '#3b82f6',
  shot: '#eab308',
}

export function AutoPathViewer({
  pathData,
  className,
  maxWidth = 400,
}: {
  pathData: AutoPathData
  className?: string
  maxWidth?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [size, setSize] = useState({ w: 600, h: 300 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      setSize({
        w: Math.round(img.naturalWidth * scale),
        h: Math.round(img.naturalHeight * scale),
      })
      setLoaded(true)
    }
    img.onerror = () => {
      setSize({ w: Math.min(600, maxWidth), h: 300 })
      setLoaded(true)
    }
    img.src = FIELD_IMAGE_SRC
  }, [maxWidth])

  useEffect(() => {
    if (!loaded || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = imgRef.current
    canvas.width = size.w
    canvas.height = size.h
    if (!img || !img.complete) {
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, size.w, size.h)
      return
    }
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, size.w, size.h)
    const W = size.w
    const H = size.h
    const path = Array.isArray(pathData.path) ? pathData.path : []
    const markers = Array.isArray(pathData.markers) ? pathData.markers : []
    if (path.length >= 2) {
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = Math.max(2, Math.floor(W / 200))
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(path[0].x * W, path[0].y * H)
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * W, path[i].y * H)
      }
      ctx.stroke()
    }
    const r = Math.max(4, Math.floor(W / 80))
    markers.forEach((mark) => {
      const mx = mark.x * W
      const my = mark.y * H
      ctx.fillStyle = MARKER_COLORS[mark.type]
      ctx.beginPath()
      ctx.arc(mx, my, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [loaded, size, pathData])

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className ?? ''}`}
      width={size.w}
      height={size.h}
      style={{ maxWidth: '100%' }}
      aria-label="Auto path"
    />
  )
}
