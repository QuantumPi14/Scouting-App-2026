import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context'
import { db } from '../db'
import { aggregateSubmissions } from '../aggregate'
import type { Competition } from '../types'
import type { ScoutSubmission } from '../types'
import styles from './HomePage.module.css'

type SortKey = 'pts' | 'hubPts' | 'shotPct' | null
type SortDir = 'asc' | 'desc' | null

const CLIMB_OPTIONS = ["can't climb", 'L1', 'L2', 'L3'] as const
const CLIMB_REL_OPTIONS = ['unreliable', 'semi-reliable', 'reliable'] as const
const CLIMB_SPOT_OPTIONS = ['left', 'right', 'center'] as const
const MOVE_SHOOT_OPTIONS = ['yes', 'kinda', 'no'] as const
const SHOT_ACCURACY_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const

export function HomePage() {
  const { competitionId, setCompetitionId, searchType, setSearchType, searchQuery, setSearchQuery, matchFilter, setMatchFilter } = useApp()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [submissions, setSubmissions] = useState<ScoutSubmission[]>([])
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [climbFilter, setClimbFilter] = useState<string>('')
  const [climbRelFilter, setClimbRelFilter] = useState<string>('')
  const [climbSpotFilter, setClimbSpotFilter] = useState<string>('')
  const [turretFilter, setTurretFilter] = useState<string>('')
  const [moveShootFilter, setMoveShootFilter] = useState<string>('')
  const [pickUpShootFilter, setPickUpShootFilter] = useState<string>('')
  const [shotPercentFilter, setShotPercentFilter] = useState<string>('')

  useEffect(() => {
    db.competitions.toArray().then(setCompetitions)
  }, [])

  useEffect(() => {
    if (!competitionId) {
      setSubmissions([])
      return
    }
    db.submissions.where('competitionId').equals(competitionId).toArray().then((rows) => setSubmissions(rows as ScoutSubmission[]))
  }, [competitionId])

  const teamList = useMemo(() => {
    if (!competitionId) return []
    const comp = competitions.find((c) => c.id === competitionId)
    if (!comp) return []
    return comp.teamNumbers.slice().sort((a, b) => a - b)
  }, [competitionId, competitions])

  const filteredTeamsAndAggregates = useMemo(() => {
    if (!competitionId) return []
    let teamNumbers: number[] = []
    if (searchType === 'team') {
      if (!searchQuery.trim()) {
        teamNumbers = teamList
      } else {
        const q = searchQuery.trim()
        teamNumbers = teamList.filter((n) => String(n).includes(q))
      }
    } else {
      const matchNum = matchFilter ?? (searchQuery.trim() ? parseInt(searchQuery.trim(), 10) : NaN)
      if (!Number.isFinite(matchNum)) return []
      const teamsWithMatch = [...new Set(submissions.filter((s: ScoutSubmission) => s.matchNumber === matchNum).map((s: ScoutSubmission) => s.teamNumber))]
      teamNumbers = teamsWithMatch.sort((a: number, b: number) => a - b)
    }
    const comp = competitions.find((c) => c.id === competitionId)!
    const matchNum = searchType === 'match' ? (matchFilter ?? (searchQuery.trim() ? parseInt(searchQuery.trim(), 10) : NaN)) : null
    return teamNumbers.map((teamNumber) => {
      let subs = submissions.filter((s: ScoutSubmission) => s.teamNumber === teamNumber)
      if (searchType === 'match' && Number.isFinite(matchNum)) {
        subs = subs.filter((s: ScoutSubmission) => s.matchNumber === matchNum)
      }
      const agg = aggregateSubmissions(subs)
      return { teamNumber, comp, agg, submissionCount: subs.length }
    })
  }, [competitionId, competitions, teamList, searchType, searchQuery, matchFilter, submissions])

  const filterByClimbAndRel = useMemo(() => {
    let list = filteredTeamsAndAggregates
    if (climbFilter) {
      list = list.filter(({ agg }) => (agg?.pit.climb ?? '—') === climbFilter)
    }
    if (climbRelFilter) {
      list = list.filter(({ agg }) => (agg?.game.climbReliability ?? '—') === climbRelFilter)
    }
    if (climbSpotFilter) {
      list = list.filter(({ agg }) => {
        const sides = agg?.pit.climbSides
        return Array.isArray(sides) && sides.includes(climbSpotFilter)
      })
    }
    if (turretFilter) {
      const want = turretFilter === 'yes'
      list = list.filter(({ agg }) => agg?.pit.turret !== undefined && agg?.pit.turret !== null && agg.pit.turret === want)
    }
    if (moveShootFilter) {
      list = list.filter(({ agg }) => (agg?.game.moveWhileShooting ?? '—') === moveShootFilter)
    }
    if (pickUpShootFilter) {
      const want = pickUpShootFilter === 'yes'
      list = list.filter(({ agg }) => agg?.game.pickUpWhileShooting !== undefined && agg?.game.pickUpWhileShooting !== null && agg.game.pickUpWhileShooting === want)
    }
    if (shotPercentFilter) {
      const want = parseInt(shotPercentFilter, 10)
      list = list.filter(({ agg }) => agg?.game.shotAccuracyPercent != null && agg.game.shotAccuracyPercent === want)
    }
    return list
  }, [filteredTeamsAndAggregates, climbFilter, climbRelFilter, climbSpotFilter, turretFilter, moveShootFilter, pickUpShootFilter, shotPercentFilter])

  const sortedTeams = useMemo(() => {
    const list = [...filterByClimbAndRel]
    if (sortKey == null || sortDir == null) return list
    list.sort((a, b) => {
      const aggA = a.agg
      const aggB = b.agg
      let valA: number | null = null
      let valB: number | null = null
      if (sortKey === 'pts') {
        valA = aggA?.game.avgPtsPerActivePeriod ?? null
        valB = aggB?.game.avgPtsPerActivePeriod ?? null
      } else if (sortKey === 'hubPts') {
        valA = aggA?.game.hubPtsAuto ?? null
        valB = aggB?.game.hubPtsAuto ?? null
      } else if (sortKey === 'shotPct') {
        valA = aggA?.game.shotAccuracyPercent ?? null
        valB = aggB?.game.shotAccuracyPercent ?? null
      }
      if (valA == null && valB == null) return a.teamNumber - b.teamNumber
      if (valA == null) return sortDir === 'asc' ? 1 : -1
      if (valB == null) return sortDir === 'asc' ? -1 : 1
      if (sortDir === 'asc') return valA - valB
      return valB - valA
    })
    return list
  }, [filterByClimbAndRel, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('desc')
      return
    }
    if (sortDir === 'desc') setSortDir('asc')
    else if (sortDir === 'asc') {
      setSortKey(null)
      setSortDir(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <label className={styles.label}>
          Competition
          <select
            value={competitionId ?? ''}
            onChange={(e) => {
              setCompetitionId(e.target.value || null)
              setSearchQuery('')
              setMatchFilter(null)
            }}
          >
            <option value="">Select competition</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className={styles.qrButtons}>
          <Link to="/qr/create" className={styles.qrBtn}>Create QR</Link>
          <Link to="/qr/scan" className={styles.qrBtn}>Scan QR</Link>
        </div>
      </div>

      {competitionId && (
        <>
          <div className={styles.searchRow}>
            <div className={styles.searchTabs}>
              <button type="button" className={searchType === 'team' ? styles.tabActive : styles.tab} onClick={() => setSearchType('team')}>Team</button>
              <button type="button" className={searchType === 'match' ? styles.tabActive : styles.tab} onClick={() => setSearchType('match')}>Match</button>
            </div>
            <input
              type="text"
              placeholder={searchType === 'team' ? 'Search by team number' : 'Match number'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (searchType === 'match') setMatchFilter(e.target.value.trim() ? parseInt(e.target.value.trim(), 10) || null : null)
              }}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.statTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th className={styles.sortable} onClick={() => handleSort('pts')} title="Click: high→low, again low→high, again clear">
                    Pts/active {sortKey === 'pts' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Climb</label>
                    <select value={climbFilter} onChange={(e) => setClimbFilter(e.target.value)} className={styles.filterSelect} title="Filter by climb">
                      <option value="">All</option>
                      {CLIMB_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Climb rel</label>
                    <select value={climbRelFilter} onChange={(e) => setClimbRelFilter(e.target.value)} className={styles.filterSelect} title="Filter by climb reliability">
                      <option value="">All</option>
                      {CLIMB_REL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Climb Spot</label>
                    <select value={climbSpotFilter} onChange={(e) => setClimbSpotFilter(e.target.value)} className={styles.filterSelect} title="Filter by climb spot">
                      <option value="">All</option>
                      {CLIMB_SPOT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('hubPts')} title="Click: high→low, again low→high, again clear">
                    Hub pts/auto {sortKey === 'hubPts' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Turret</label>
                    <select value={turretFilter} onChange={(e) => setTurretFilter(e.target.value)} className={styles.filterSelect} title="Filter by turret">
                      <option value="">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Move shoot</label>
                    <select value={moveShootFilter} onChange={(e) => setMoveShootFilter(e.target.value)} className={styles.filterSelect} title="Filter by move while shooting">
                      <option value="">All</option>
                      {MOVE_SHOOT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className={styles.filterTh}>
                    <label className={styles.filterLabel}>Pick up shoot</label>
                    <select value={pickUpShootFilter} onChange={(e) => setPickUpShootFilter(e.target.value)} className={styles.filterSelect} title="Filter by pick up while shooting">
                      <option value="">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th
                    className={`${styles.filterTh} ${styles.sortable}`}
                    onClick={() => handleSort('shotPct')}
                    title="Click: high→low, again low→high, again clear"
                  >
                    <label className={styles.filterLabel}>Shot % {sortKey === 'shotPct' && (sortDir === 'desc' ? '↓' : '↑')}</label>
                    <select
                      value={shotPercentFilter}
                      onChange={(e) => setShotPercentFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.filterSelect}
                      title="Filter by shot accuracy %"
                    >
                      <option value="">All</option>
                      {SHOT_ACCURACY_OPTIONS.map((o) => <option key={o} value={String(o)}>{o}%</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map(({ teamNumber, comp, agg }) => (
                  <tr key={teamNumber}>
                    <td className={styles.colNum}>{teamNumber}</td>
                    <td className={styles.colTeam}>
                      <Link to={`/team/${comp.id}/${teamNumber}`} className={styles.teamLink}>
                        {comp.teamNames[teamNumber] ?? `Team ${teamNumber}`}
                      </Link>
                    </td>
                    <td>{agg?.game.avgPtsPerActivePeriod ?? '—'}</td>
                    <td>{agg?.pit.climb ?? '—'}</td>
                    <td>{agg?.game.climbReliability ?? '—'}</td>
                    <td>{agg?.pit.climbSides?.join(', ') ?? '—'}</td>
                    <td>{agg?.game.hubPtsAuto ?? '—'}</td>
                    <td>{agg?.pit.turret == null ? '—' : agg.pit.turret ? 'Yes' : 'No'}</td>
                    <td>{agg?.game.moveWhileShooting ?? '—'}</td>
                    <td>{agg?.game.pickUpWhileShooting == null ? '—' : agg?.game.pickUpWhileShooting ? 'Yes' : 'No'}</td>
                    <td>{agg?.game.shotAccuracyPercent != null ? `${agg.game.shotAccuracyPercent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedTeams.length === 0 && (
            <p className={styles.empty}>{searchType === 'team' ? 'No teams match. Add teams in Admin.' : 'No teams for this match.'}</p>
          )}
        </>
      )}

      <p className={styles.adminLink}>
        <Link to="/admin">Admin</Link>
      </p>
    </div>
  )
}
