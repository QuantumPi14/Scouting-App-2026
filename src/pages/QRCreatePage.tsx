import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import { exportDataQR } from '../qr'
import type { Competition, ScoutSubmission } from '../types'
import styles from './QRCreatePage.module.css'

export function QRCreatePage() {
  const { competitionId } = useApp()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompId, setSelectedCompId] = useState<string>('')
  const [selectedTeamNumbers, setSelectedTeamNumbers] = useState<Set<number>>(new Set())
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathDataMissingCount, setPathDataMissingCount] = useState(0)

  const comp = useMemo(() => competitions.find((c) => c.id === selectedCompId), [competitions, selectedCompId])
  const teamList = useMemo(() => (comp ? comp.teamNumbers.slice().sort((a, b) => a - b) : []), [comp])

  useEffect(() => {
    db.competitions.toArray().then((list) => {
      setCompetitions(list)
      if (competitionId && list.some((c) => c.id === competitionId)) setSelectedCompId(competitionId)
      else if (list.length) setSelectedCompId(list[0].id)
    })
  }, [competitionId])

  useEffect(() => {
    setSelectedTeamNumbers(new Set())
  }, [selectedCompId])

  const toggleTeam = (n: number) => {
    setSelectedTeamNumbers((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }
  const selectAllTeams = () => setSelectedTeamNumbers(new Set(teamList))
  const deselectAllTeams = () => setSelectedTeamNumbers(new Set())

  const handleCreate = async (mode: 'scouting' | 'autopath') => {
    setLoading(true)
    setUrls([])
    setError(null)
    setPathDataMissingCount(0)
    try {
      const teamNumbers = selectedTeamNumbers.size > 0 ? Array.from(selectedTeamNumbers) : undefined
      const list = await exportDataQR(selectedCompId || undefined, {
        teamNumbers,
        mode,
      })
      setUrls(list)
      if (mode === 'scouting') {
        let subs: ScoutSubmission[]
        if (selectedCompId) {
          subs = await db.submissions.where('competitionId').equals(selectedCompId).toArray() as ScoutSubmission[]
        } else {
          subs = await db.submissions.toArray() as ScoutSubmission[]
        }
        const filtered = teamNumbers ? subs.filter((s) => teamNumbers.includes(s.teamNumber)) : subs
        const missing = filtered.filter((s) => s.autoPathImageData && !(s.autoPathData && (s.autoPathData.markers?.length || s.autoPathData.path?.length))).length
        setPathDataMissingCount(missing)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const friendly = /too (big|large|much)/i.test(message)
        ? "Can't generate QR: too much data. Try fewer teams or one competition."
        : message
      setError(friendly)
      setUrls([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1>Create QR</h1>
      <p>Export scout data as QR code(s). Others can scan to merge data. Choose <strong>Scouting data</strong> for form data only (no auto paths), or <strong>Auto path data</strong> for path coordinates only. If no teams are selected, all teams in the competition are included.</p>
      <div className={styles.form}>
        <label>Competition</label>
        <select value={selectedCompId} onChange={(e) => setSelectedCompId(e.target.value)}>
          <option value="">All competitions</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {selectedCompId && teamList.length > 0 && (
          <>
            <div className={styles.teamSelectRow}>
              <label className={styles.teamLabel}>Teams (optional)</label>
              <div className={styles.teamSelectActions}>
                <button type="button" className={styles.teamSelectBtn} onClick={selectAllTeams}>Select all</button>
                <button type="button" className={styles.teamSelectBtn} onClick={deselectAllTeams}>Deselect all</button>
              </div>
            </div>
            <div className={styles.teamList}>
              {teamList.map((n) => (
                <label key={n} className={styles.teamCheck}>
                  <input
                    type="checkbox"
                    checked={selectedTeamNumbers.has(n)}
                    onChange={() => toggleTeam(n)}
                  />
                  <span>{comp?.teamNames[n] ?? n}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className={styles.buttons}>
          <button type="button" onClick={() => handleCreate('scouting')} disabled={loading}>
            {loading ? 'Generating…' : 'Generate scouting data QR'}
          </button>
          <button type="button" onClick={() => handleCreate('autopath')} disabled={loading}>
            {loading ? 'Generating…' : 'Generate auto path data QR'}
          </button>
        </div>
        {error && <p className={styles.error}>Failed to generate QR: {error}</p>}
      </div>
      {pathDataMissingCount > 0 && (
        <p className={styles.warning}>
          {pathDataMissingCount} submission(s) have an auto path image but no path coordinates. Re-save each path in Add data so coordinates are stored if you need to export paths later.
        </p>
      )}
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
