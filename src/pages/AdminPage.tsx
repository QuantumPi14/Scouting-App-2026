import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import type { Competition } from '../types'
import { exportConfigQR } from '../qr'
import styles from './AdminPage.module.css'

export function AdminPage() {
  const { isAdminLoggedIn, adminLogin, adminLogout } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [compName, setCompName] = useState('')
  const [teamInput, setTeamInput] = useState('')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [saved, setSaved] = useState(false)

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
        <p className={styles.hint}>You have {competitions.length} competition(s). One line per team: team number, then optional name (e.g. <code>7712, Umuja</code> or <code>7712</code>)</p>
        <form onSubmit={handleAddCompetition}>
          <label>Competition name</label>
          <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="e.g. Durham" required />
          <label>Teams (number or number, name per line)</label>
          <textarea value={teamInput} onChange={(e) => setTeamInput(e.target.value)} rows={8} placeholder="7712, Umuja&#10;7701&#10;..." />
          <button type="submit" className={styles.primaryBtn}>Save</button>
          {saved && <span className={styles.saved}>Saved.</span>}
        </form>
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
  const [url, setUrl] = useState<string | null>(null)
  const handleExport = async () => {
    const dataUrl = await exportConfigQR()
    setUrl(dataUrl)
  }
  return (
    <div>
      <button type="button" onClick={handleExport}>Generate config QR</button>
      {url && (
        <div className={styles.qrPreview}>
          <img src={url} alt="Config QR code" />
        </div>
      )}
    </div>
  )
}
