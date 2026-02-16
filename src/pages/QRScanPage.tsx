import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { parseQRPayload, importConfig, importData } from '../qr'
import styles from './QRScanPage.module.css'

export function QRScanPage() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const startScan = () => {
    if (!containerRef.current) return
    setStatus('scanning')
    setMessage('')
    const html5Qr = new Html5Qrcode(containerRef.current.id)
    scannerRef.current = html5Qr
    html5Qr.start(
      { facingMode: 'environment' },
      { fps: 5 },
      (decodedText) => {
        const payload = parseQRPayload(decodedText)
        if (!payload) {
          setMessage('Invalid QR format')
          setStatus('error')
          stopScan()
          return
        }
        (async () => {
          try {
            if (payload.type === 'config') {
              await importConfig(payload)
              setMessage('Config imported.')
            } else {
              await importData(payload)
              setMessage('Data imported.')
            }
            setStatus('success')
          } catch (e) {
            setMessage(String(e))
            setStatus('error')
          }
          stopScan()
        })()
      },
      () => {}
    ).catch((err) => {
      setMessage(String(err))
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
      <div ref={containerRef} id="qr-reader" className={styles.reader} />
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
