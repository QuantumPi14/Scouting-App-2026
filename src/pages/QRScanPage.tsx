import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import {
  parseAnyQRPayload,
  importConfig,
  importData,
  importDataV2,
  type ConfigPayload,
  type DataPayload,
} from '../qr'
import type { QrV2DataEnvelope } from '../types'
import styles from './QRScanPage.module.css'

const SCAN_FPS = 10
const MIN_HEIGHT_PX = 280

function mergeConfigParts(parts: ConfigPayload[]): ConfigPayload {
  const byId = new Map<string, (typeof parts)[0]['competitions'][0][]>()
  for (const p of parts) {
    for (const comp of p.competitions || []) {
      const list = byId.get(comp.id) ?? []
      list.push(comp)
      byId.set(comp.id, list)
    }
  }
  const competitions = Array.from(byId.entries()).map(([id, list]) => {
    const first = list[0]
    if (list.length === 1) return first
    const teamNumbers = list.flatMap((c) => c.teamNumbers)
    const teamNames: Record<number, string> = {}
    for (const c of list) Object.assign(teamNames, c.teamNames)
    return { id, name: first.name, teamNumbers, teamNames }
  })
  return {
    v: 1,
    type: 'config',
    competitions,
    exportedAt: parts[0]?.exportedAt ?? Date.now(),
  }
}

export function QRScanPage() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScannedRef = useRef<string | null>(null)
  const pendingConfigRef = useRef<Record<number, ConfigPayload>>({})
  const totalConfigPartsRef = useRef<number | null>(null)
  const pendingDataPartsRef = useRef<Record<number, DataPayload>>({})
  const totalDataPartsRef = useRef<number | null>(null)
  const pendingDataV2PartsRef = useRef<Record<number, QrV2DataEnvelope>>({})
  const totalDataV2PartsRef = useRef<number | null>(null)

  const startScan = () => {
    if (!containerRef.current) return
    setStatus('scanning')
    setMessage('')
    lastScannedRef.current = null
    pendingConfigRef.current = {}
    totalConfigPartsRef.current = null
    pendingDataPartsRef.current = {}
    totalDataPartsRef.current = null
    pendingDataV2PartsRef.current = {}
    totalDataV2PartsRef.current = null
    const html5Qr = new Html5Qrcode(containerRef.current.id)
    scannerRef.current = html5Qr
    html5Qr.start(
      { facingMode: 'environment' },
      { fps: SCAN_FPS },
      (decodedText) => {
        const text = (decodedText || '').trim()
        if (!text) return
        if (lastScannedRef.current === text) return
        lastScannedRef.current = text
        const payload = parseAnyQRPayload(text)
        if (!payload) {
          setMessage('QR not recognized. Use a config or data QR from this app. If scanning from a screen, get closer so the QR fills the frame.')
          setStatus('error')
          stopScan()
          return
        }
        (async () => {
          try {
            if (payload.type === 'config') {
              const totalParts = payload.totalParts ?? 1
              const part = payload.part ?? 1
              if (totalParts <= 1) {
                await importConfig(payload)
                setMessage('Config imported.')
                setStatus('success')
                stopScan()
                return
              }
              pendingConfigRef.current = { ...pendingConfigRef.current, [part]: payload }
              totalConfigPartsRef.current = totalParts
              const collected = pendingConfigRef.current
              const count = Object.keys(collected).length
              if (count >= totalParts) {
                const parts = Array.from({ length: totalParts }, (_, i) => collected[i + 1]).filter(Boolean)
                if (parts.length === totalParts) {
                  const merged = mergeConfigParts(parts)
                  await importConfig(merged)
                  setMessage('Config imported.')
                  setStatus('success')
                  pendingConfigRef.current = {}
                  totalConfigPartsRef.current = null
                  stopScan()
                  return
                }
              }
              setMessage(`Config part ${part} of ${totalParts} scanned. Scan the next QR.`)
              lastScannedRef.current = null
            } else if (payload.type === 'data') {
              const totalParts = payload.totalParts ?? 1
              const part = payload.part ?? 1
              if (totalParts <= 1) {
                await importData(payload)
                setMessage('Data imported.')
                setStatus('success')
                stopScan()
                return
              }
              pendingDataPartsRef.current = { ...pendingDataPartsRef.current, [part]: payload }
              totalDataPartsRef.current = totalParts
              const collected = pendingDataPartsRef.current
              const count = Object.keys(collected).length
              if (count >= totalParts) {
                const parts = Array.from({ length: totalParts }, (_, i) => collected[i + 1]).filter(Boolean)
                if (parts.length === totalParts) {
                  const merged: DataPayload = {
                    v: payload.v,
                    type: 'data',
                    competitionId: payload.competitionId,
                    submissions: parts.flatMap((p) => p.submissions ?? []),
                    exportedAt: parts[0]?.exportedAt ?? Date.now(),
                  }
                  await importData(merged)
                  setMessage('Data imported.')
                  setStatus('success')
                  pendingDataPartsRef.current = {}
                  totalDataPartsRef.current = null
                  stopScan()
                  return
                }
              }
              setMessage(`Data part ${part} of ${totalParts} scanned. Scan the next QR.`)
              lastScannedRef.current = null
            } else if (payload.type === 'data-v2') {
              const totalParts = payload.totalParts ?? 1
              const part = payload.part ?? 1
              if (totalParts <= 1) {
                await importDataV2([payload])
                setMessage('Data imported.')
                setStatus('success')
                stopScan()
                return
              }
              pendingDataV2PartsRef.current = { ...pendingDataV2PartsRef.current, [part]: payload }
              totalDataV2PartsRef.current = totalParts
              const collected = pendingDataV2PartsRef.current
              const count = Object.keys(collected).length
              if (count >= totalParts) {
                const parts = Array.from({ length: totalParts }, (_, i) => collected[i + 1]).filter(
                  (p): p is QrV2DataEnvelope => Boolean(p)
                )
                if (parts.length === totalParts) {
                  await importDataV2(parts)
                  setMessage('Data imported.')
                  setStatus('success')
                  pendingDataV2PartsRef.current = {}
                  totalDataV2PartsRef.current = null
                  stopScan()
                  return
                }
              }
              setMessage(`Data part ${part} of ${totalParts} scanned. Scan the next QR.`)
              lastScannedRef.current = null
            }
          } catch (e) {
            setMessage(String(e))
            setStatus('error')
            stopScan()
          }
        })()
      },
      () => {}
    ).catch((err) => {
      setMessage(String(err?.message || err) || 'Camera error. Use HTTPS and allow camera access.')
      setStatus('error')
    })
  }

  const stopScan = () => {
    const scanner = scannerRef.current
    if (scanner) {
      scanner.stop().then(() => {
        scannerRef.current = null
      }).catch(() => {})
    }
  }

  useEffect(() => {
    return () => {
      stopScan()
    }
  }, [])

  return (
    <div className={styles.page}>
      <h1>Scan QR</h1>
      <p>Scan a config QR (from Admin) or data QR to import.</p>
      <p className={styles.hint}>Tip: If scanning a QR from another screen (e.g. laptop), make the QR as large as possible and fill your phone&apos;s frame. Avoid glare and hold steady.</p>
      <div ref={containerRef} id="qr-reader" className={styles.reader} style={{ minHeight: status === 'scanning' ? MIN_HEIGHT_PX : 0 }} />
      <div className={styles.actions}>
        {status !== 'scanning' && (
          <button type="button" onClick={startScan}>Start camera</button>
        )}
        {status === 'scanning' && (
          <button type="button" onClick={stopScan}>Stop</button>
        )}
      </div>
      {message && <p className={status === 'error' ? styles.error : styles.success}>{message}</p>}
      <p><Link to="/">Back to Home</Link></p>
    </div>
  )
}
