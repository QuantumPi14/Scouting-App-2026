import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import type { Competition } from '../types'
import { exportConfigQR } from '../qr'
import { generateDemoCompetition } from '../generateDemoData'
import styles from './AdminPage.module.css'

const DEMO_COMPETITION_ID = 'test'

export function AdminPage() {
  const { isAdminLoggedIn, adminLogin, adminLogout } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [compName, setCompName] = useState('')
  const [teamInput, setTeamInput] = useState('')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [saved, setSaved] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoClearing, setDemoClearing] = useState(false)

  useEffect(() => {
    db.competitions.toArray().then(setCompetitions)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (adminLogin(password)) {
      setPassword('')
    } else {
      setError('Wrong password')
    }
  }

  const handleAddCompetition = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = compName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!id) return
    const lines = teamInput.trim().split(/\n/).filter(Boolean)
    const teamNumbers: number[] = []
    const teamNames: Record<number, string> = {}
    for (const line of lines) {
      const parts = line.split(/[,:\t]/).map((p) => p.trim())
      const num = parseInt(parts[0], 10)
      if (!Number.isFinite(num)) continue
      teamNumbers.push(num)
      if (parts[1]) teamNames[num] = parts[1]
    }
    await db.competitions.put({ id, name, teamNumbers, teamNames })
    setCompetitions(await db.competitions.toArray())
    setCompName('')
    setTeamInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteCompetition = async (comp: Competition) => {
    if (!confirm(`Delete competition "${comp.name}"? This will also delete all scout data for this competition. This cannot be undone.`)) return
    await db.submissions.where('competitionId').equals(comp.id).delete()
    await db.competitions.delete(comp.id)
    setCompetitions(await db.competitions.toArray())
  }

  const handleLoadDemo = async () => {
    setDemoLoading(true)
    try {
      const { competition, submissions } = generateDemoCompetition()
      await db.competitions.put(competition)
      await db.submissions.bulkAdd(submissions)
      setCompetitions(await db.competitions.toArray())
    } finally {
      setDemoLoading(false)
    }
  }

  const handleClearDemo = async () => {
    if (!confirm('Remove the Test competition and all its scout data? This cannot be undone.')) return
    setDemoClearing(true)
    try {
      await db.submissions.where('competitionId').equals(DEMO_COMPETITION_ID).delete()
      await db.competitions.delete(DEMO_COMPETITION_ID)
      setCompetitions(await db.competitions.toArray())
    } finally {
      setDemoClearing(false)
    }
  }

  const handleRemoveTeam = async (comp: Competition, teamNumber: number) => {
    if (!confirm(`Remove team ${teamNumber} from "${comp.name}"? Scout data for this team will remain but the team won't appear in the list.`)) return
    const newTeamNumbers = comp.teamNumbers.filter((n) => n !== teamNumber)
    const newTeamNames = { ...comp.teamNames }
    delete newTeamNames[teamNumber]
    await db.competitions.put({ ...comp, teamNumbers: newTeamNumbers, teamNames: newTeamNames })
    setCompetitions(await db.competitions.toArray())
  }

  if (!isAdminLoggedIn) {
    return (
      <div className={styles.page}>
        <h1>Admin</h1>
        <form onSubmit={handleLogin} className={styles.form}>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit">Log in</button>
        </form>
        <p><Link to="/">Back to app</Link></p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Admin</h1>
        <div className={styles.headerActions}>
          <Link to="/">Back to app</Link>
          <button type="button" onClick={adminLogout}>Logout</button>
        </div>
      </div>

      <section className={styles.section}>
        <h2>Add competition & teams</h2>
        <p className={styles.hint}>You have {competitions.length} competition(s). One line per team: team number, then optional name (e.g. <code>7712, Umoja</code> or <code>7712</code>)</p>
        <form onSubmit={handleAddCompetition}>
          <label>Competition name</label>
          <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="e.g. Durham" required />
          <label>Teams (number or number, name per line)</label>
          <textarea value={teamInput} onChange={(e) => setTeamInput(e.target.value)} rows={8} placeholder="7712, Umoja&#10;7701&#10;..." />
          <button type="submit" className={styles.primaryBtn}>Save</button>
          {saved && <span className={styles.saved}>Saved.</span>}
        </form>
      </section>

      <section className={styles.section}>
        <h2>Competitions & teams</h2>
        <p className={styles.hint}>Delete a competition (and its scout data) or remove a team from a competition&apos;s list.</p>
        {competitions.length === 0 ? (
          <p>No competitions yet.</p>
        ) : (
          <ul className={styles.compList}>
            {competitions.map((comp) => (
              <li key={comp.id} className={styles.compItem}>
                <div className={styles.compHeader}>
                  <strong>{comp.name}</strong>
                  <span className={styles.compId}>({comp.id})</span>
                  <button type="button" className={styles.dangerBtn} onClick={() => handleDeleteCompetition(comp)}>Delete competition</button>
                </div>
                {comp.teamNumbers.length === 0 ? (
                  <p className={styles.noTeams}>No teams</p>
                ) : (
                  <ul className={styles.teamList}>
                    {comp.teamNumbers.slice().sort((a, b) => a - b).map((num) => (
                      <li key={num} className={styles.teamItem}>
                        {num} {comp.teamNames[num] ? `— ${comp.teamNames[num]}` : ''}
                        <button type="button" className={styles.removeTeamBtn} onClick={() => handleRemoveTeam(comp, num)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Demo data</h2>
        <p className={styles.hint}>Load a &quot;Test&quot; competition with 27 teams and 13 submissions per team for testing export/import and UI at scale. Clear removes it and all its data.</p>
        <div className={styles.demoActions}>
          <button type="button" onClick={handleLoadDemo} disabled={demoLoading}>
            {demoLoading ? 'Loading…' : 'Load demo data'}
          </button>
          <button type="button" onClick={handleClearDemo} disabled={demoClearing} className={styles.dangerBtn}>
            {demoClearing ? 'Clearing…' : 'Clear demo data'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Export config QR</h2>
        <p>Export only competitions and team lists (no scout data). Others can scan this to get the same list.</p>
        <ConfigQRButton />
      </section>
    </div>
  )
}

function ConfigQRButton() {
  const [urls, setUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const handleExport = async () => {
    setError(null)
    setUrls([])
    try {
      const list = await exportConfigQR()
      setUrls(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('too large') ? "Can't generate QR: too much data. Try removing some teams or competitions." : msg)
    }
  }
  return (
    <div>
      <button type="button" onClick={handleExport}>Generate config QR</button>
      {error && <p className={styles.error}>{error}</p>}
      {urls.length > 0 && (
        <div className={styles.qrPreview}>
          {urls.length > 1 && (
            <p className={styles.qrOrderHint}>Scan in order: first QR, then second, etc. The scanner will show &quot;Part X of Y&quot; as you go.</p>
          )}
          {urls.map((url, i) => (
            <div key={i} className={styles.qrBox}>
              {urls.length > 1 && <span className={styles.qrLabel}>Part {i + 1} of {urls.length}</span>}
              <img src={url} alt={urls.length > 1 ? `Config QR ${i + 1}` : 'Config QR code'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
