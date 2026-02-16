import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import { exportDataQR } from '../qr'
import type { Competition } from '../types'
import styles from './QRCreatePage.module.css'

export function QRCreatePage() {
  const { competitionId } = useApp()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompId, setSelectedCompId] = useState<string>('')
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.competitions.toArray().then((list) => {
      setCompetitions(list)
      if (competitionId && list.some((c) => c.id === competitionId)) setSelectedCompId(competitionId)
      else if (list.length) setSelectedCompId(list[0].id)
    })
  }, [competitionId])

  const handleCreate = async () => {
    setLoading(true)
    setUrls([])
    setError(null)
    try {
      const list = await exportDataQR(selectedCompId || undefined)
      setUrls(list)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      setUrls([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1>Create QR</h1>
      <p>Export scout data as QR code(s). Others can scan to merge data. Auto path images are not included (they’re too large for QR); only form data is shared.</p>
      <div className={styles.form}>
        <label>Competition</label>
        <select value={selectedCompId} onChange={(e) => setSelectedCompId(e.target.value)}>
          <option value="">All competitions</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="button" onClick={handleCreate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate QR'}
        </button>
        {error && <p className={styles.error}>Failed to generate QR: {error}</p>}
      </div>
      {urls.length > 0 && (
        <div className={styles.qrList}>
          {urls.length > 1 && <p>Scan in order (1 of {urls.length})</p>}
          {urls.map((url, i) => (
            <div key={i} className={styles.qrBox}>
              {urls.length > 1 && <span className={styles.qrLabel}>{i + 1} of {urls.length}</span>}
              <img src={url} alt={`QR ${i + 1}`} className={styles.qrImg} />
            </div>
          ))}
        </div>
      )}
      <p><Link to="/">Back to Home</Link></p>
    </div>
  )
}
