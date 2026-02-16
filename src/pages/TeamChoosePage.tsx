import { useParams, Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import { useEffect, useState } from 'react'
import type { Competition } from '../types'
import styles from './TeamChoosePage.module.css'

export function TeamChoosePage() {
  const { competitionId: cId, matchFilter } = useApp()
  const { competitionId, teamNumber } = useParams<{ competitionId: string; teamNumber: string }>()
  const compId = competitionId ?? cId ?? ''
  const teamNum = parseInt(teamNumber ?? '', 10)
  const [comp, setComp] = useState<Competition | null>(null)

  useEffect(() => {
    if (!compId) return
    db.competitions.get(compId).then((c) => setComp(c ?? null))
  }, [compId])

  const teamName = comp?.teamNames[teamNum] ?? `Team ${teamNum}`

  const addPath = `/team/${compId}/${teamNum}/add`
  const currentPath = matchFilter != null
    ? `/team/${compId}/${teamNum}/current?match=${matchFilter}`
    : `/team/${compId}/${teamNum}/current`

  if (!compId || !Number.isFinite(teamNum)) {
    return <p>Invalid team or competition.</p>
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{teamName}</h1>
      <p className={styles.subtitle}>Team {teamNum}</p>
      <div className={styles.buttons}>
        <Link to={currentPath} className={styles.btnSecondary}>Current data</Link>
        <Link to={addPath} className={styles.btnPrimary}>Add data</Link>
      </div>
    </div>
  )
}
