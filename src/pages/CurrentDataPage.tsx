import { useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { db } from '../db'
import { useApp } from '../context'
import { aggregateSubmissions } from '../aggregate'
import { getScoutDisplayNames } from '../scoutDisplayName'
import type { Competition, ScoutSubmission, TeamAggregate } from '../types'
import styles from './CurrentDataPage.module.css'

export function CurrentDataPage() {
  const { competitionId: cId, matchFilter, isAdminLoggedIn } = useApp()
  const { competitionId, teamNumber } = useParams<{ competitionId: string; teamNumber: string }>()
  const [searchParams] = useSearchParams()
  const matchParam = searchParams.get('match')
  const matchNum = matchFilter ?? (matchParam ? parseInt(matchParam, 10) : null)
  const compId = competitionId ?? cId ?? ''
  const teamNum = parseInt(teamNumber ?? '', 10)

  const [comp, setComp] = useState<Competition | null>(null)
  const [submissions, setSubmissions] = useState<ScoutSubmission[]>([])
  const [viewMode, setViewMode] = useState<'avg' | 'scout'>('avg')
  const [selectedScoutId, setSelectedScoutId] = useState<number | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!compId) return
    db.competitions.get(compId).then((c) => setComp(c ?? null))
  }, [compId])

  useEffect(() => {
    if (!compId || !Number.isFinite(teamNum)) return
    db.submissions.where('[competitionId+teamNumber]').equals([compId, teamNum]).toArray().then((rows) => {
      let list = rows as ScoutSubmission[]
      if (Number.isFinite(matchNum)) list = list.filter((s) => s.matchNumber === matchNum)
      setSubmissions(list)
    })
  }, [compId, teamNum, matchNum])

  const displayNames = getScoutDisplayNames(submissions)
  const aggregate = aggregateSubmissions(submissions)
  const selectedSubmission = selectedScoutId != null ? submissions.find((s) => s.id === selectedScoutId) : null
  const showAggregate = viewMode === 'avg' || !selectedSubmission
  const dataAgg = showAggregate ? aggregate : null
  const dataSingle = showAggregate ? null : selectedSubmission
  const galleryImages = dataAgg?.autoPathImages?.length ? dataAgg.autoPathImages : dataSingle?.autoPathImageData ? [dataSingle.autoPathImageData] : []

  const handleDelete = async () => {
    if (!selectedScoutId || !isAdminLoggedIn) return
    if (!confirm('Delete this scout submission? This cannot be undone.')) return
    setDeleting(true)
    await db.submissions.delete(selectedScoutId)
    setSubmissions((prev) => prev.filter((s) => s.id !== selectedScoutId))
    setSelectedScoutId(null)
    setViewMode('avg')
    setDeleting(false)
  }

  const teamName = comp?.teamNames[teamNum] ?? `Team ${teamNum}`

  if (!compId || !Number.isFinite(teamNum)) {
    return <p>Invalid team or competition.</p>
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{teamName}</h1>
      <p className={styles.subtitle}>Team {teamNum}</p>

      <div className={styles.scoutRow}>
        <div className={styles.scoutControls}>
          <button type="button" className={viewMode === 'avg' ? styles.tabActive : styles.tab} onClick={() => { setViewMode('avg'); setSelectedScoutId(null) }}>Avg</button>
          <select value={selectedScoutId ?? ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setSelectedScoutId(id); setViewMode(id != null ? 'scout' : 'avg') }} className={styles.scoutSelect}>
            <option value="">Scout</option>
            {submissions.map((s) => <option key={s.id} value={s.id}>{displayNames.get(s.id!) ?? s.scoutName}</option>)}
          </select>
        </div>
        {isAdminLoggedIn && viewMode === 'scout' && selectedScoutId != null && (
          <button type="button" className={`${styles.deleteBtn} ${styles.danger}`} onClick={handleDelete} disabled={deleting}>Delete submission</button>
        )}
      </div>

      {dataAgg && (
        <>
          <DataDisplay agg={dataAgg} single={null} />
          <div className={styles.notesSection}><button type="button" onClick={() => setNotesOpen(true)}>Notes</button></div>
          {galleryImages.length > 0 && (
            <div className={styles.gallery}>
              <h3>Auto paths</h3>
              <div className={styles.galleryGrid}>
                {galleryImages.map((src, i) => (
                  <button key={i} type="button" className={styles.galleryImgBtn} onClick={() => setGalleryLightboxIndex(i)}>
                    <img src={src} alt={`Path ${i + 1}`} className={styles.galleryImg} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {dataSingle && (
        <>
          <DataDisplay agg={null} single={dataSingle} />
          <div className={styles.notesSection}><button type="button" onClick={() => setNotesOpen(true)}>Notes</button></div>
          {galleryImages.length > 0 && (
            <div className={styles.gallery}>
              <h3>Auto path</h3>
              <button type="button" className={styles.galleryImgBtn} onClick={() => setGalleryLightboxIndex(0)}>
                <img src={galleryImages[0]} alt="Auto path" className={styles.galleryImg} />
              </button>
            </div>
          )}
        </>
      )}

      {submissions.length === 0 && <p className={styles.empty}>No data for this team yet.</p>}

      {notesOpen && (
        <div className={styles.modalBackdrop} onClick={() => setNotesOpen(false)} role="dialog" aria-modal="true">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Notes</h3>
            {showAggregate && aggregate?.notesByScout && aggregate.notesByScout.length > 0 ? (
              <ul className={styles.notesList}>
                {aggregate.notesByScout.map((n, i) => <li key={i}><strong>{n.scoutDisplayName}</strong>: {n.notes}</li>)}
              </ul>
            ) : dataSingle?.notes ? (
              <p><strong>{selectedScoutId != null ? displayNames.get(selectedScoutId) : dataSingle.scoutName}</strong>: {dataSingle.notes}</p>
            ) : (
              <p>No notes.</p>
            )}
            <button type="button" onClick={() => setNotesOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {galleryLightboxIndex != null && galleryImages.length > 0 && (
        <div className={styles.lightboxBackdrop} onClick={() => setGalleryLightboxIndex(null)} role="dialog" aria-modal="true" aria-label="Auto path gallery">
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.lightboxClose} onClick={() => setGalleryLightboxIndex(null)} aria-label="Close">×</button>
            {galleryLightboxIndex > 0 && (
              <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxArrowLeft}`} onClick={() => setGalleryLightboxIndex((i) => (i ?? 0) - 1)} aria-label="Previous">‹</button>
            )}
            <img src={galleryImages[galleryLightboxIndex]} alt={`Auto path ${galleryLightboxIndex + 1}`} className={styles.lightboxImg} />
            {galleryLightboxIndex < galleryImages.length - 1 && (
              <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxArrowRight}`} onClick={() => setGalleryLightboxIndex((i) => (i ?? 0) + 1)} aria-label="Next">›</button>
            )}
            <span className={styles.lightboxCounter}>{galleryLightboxIndex + 1} / {galleryImages.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DataDisplay({ agg, single }: { agg: TeamAggregate | null; single: ScoutSubmission | null }) {
  if (agg) {
    return (
      <div className={styles.dataSection}>
        <h2>Pit stats</h2>
        <p>Drivetrain: {agg.pit.drivetrain}</p>
        <p>Trench: {agg.pit.trench == null ? '—' : agg.pit.trench ? 'Yes' : 'No'}</p>
        <p>Turret: {agg.pit.turret == null ? '—' : agg.pit.turret ? 'Yes' : 'No'}</p>
        <p>Climb: {agg.pit.climb}</p>
        {agg.pit.climbSides && <p>Climb sides: {agg.pit.climbSides.join(', ')}</p>}
        {agg.pit.climbTime != null && <p>Climb time: {agg.pit.climbTime}</p>}
        <p>Intake type: {agg.pit.intakeType ?? '—'}</p>
        <h2>Game stats</h2>
        <p>Avg pts/active: {agg.game.avgPtsPerActivePeriod ?? '—'}</p>
        <p>Avg HP pts/active: {agg.game.avgHumanPlayerPtsPerActivePeriod ?? '—'}</p>
        <p>Hub pts/auto: {agg.game.hubPtsAuto ?? '—'}</p>
        <p>Climb auto: {agg.game.climbAuto == null ? '—' : agg.game.climbAuto ? 'Yes' : 'No'}</p>
        <p>Climb reliability: {agg.game.climbReliability ?? '—'}</p>
        <p>Intake reliability: {agg.game.intakeReliability ?? '—'}</p>
        <p>Move while shooting: {agg.game.moveWhileShooting ?? '—'}</p>
        <p>Pick up while shooting: {agg.game.pickUpWhileShooting == null ? '—' : agg.game.pickUpWhileShooting ? 'Yes' : 'No'}</p>
        <p>Shot accuracy: {agg.game.shotAccuracyPercent != null ? `${agg.game.shotAccuracyPercent}%` : '—'}</p>
      </div>
    )
  }
  if (single) {
    return (
      <div className={styles.dataSection}>
        <h2>Pit stats</h2>
        <p>Drivetrain: {single.drivetrain === 'other' ? (single.drivetrainOther ?? '—') : (single.drivetrain ?? '—')}</p>
        <p>Trench: {single.trench == null ? '—' : single.trench ? 'Yes' : 'No'}</p>
        <p>Turret: {single.turret == null ? '—' : single.turret ? 'Yes' : 'No'}</p>
        <p>Climb: {single.climb ?? '—'}</p>
        {single.climbSides?.length ? <p>Climb sides: {single.climbSides.join(', ')}</p> : null}
        {single.climbTime != null && <p>Climb time: {single.climbTime}</p>}
        <p>Intake type: {single.intakeType ?? '—'}</p>
        <h2>Game stats</h2>
        <p>Match: {single.matchNumber ?? '—'}</p>
        <p>Avg pts/active: {single.avgPtsPerActivePeriod ?? '—'}</p>
        <p>Avg HP pts/active: {single.avgHumanPlayerPtsPerActivePeriod ?? '—'}</p>
        <p>Hub pts/auto: {single.hubPtsAuto ?? '—'}</p>
        <p>Climb auto: {single.climbAuto == null ? '—' : single.climbAuto ? 'Yes' : 'No'}</p>
        <p>Climb reliability: {single.climbReliability ?? '—'}</p>
        <p>Intake reliability: {single.intakeReliability ?? '—'}</p>
        <p>Move while shooting: {single.moveWhileShooting ?? '—'}</p>
        <p>Pick up while shooting: {single.pickUpWhileShooting == null ? '—' : single.pickUpWhileShooting ? 'Yes' : 'No'}</p>
        <p>Shot accuracy: {single.shotAccuracyPercent != null ? `${single.shotAccuracyPercent}%` : '—'}</p>
      </div>
    )
  }
  return null
}
