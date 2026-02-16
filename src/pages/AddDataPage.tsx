import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db } from '../db'
import type { Competition, ScoutSubmission } from '../types'
import { AutoPathEditor } from '../components/AutoPathEditor'
import styles from './AddDataPage.module.css'

const DRIVETRAIN_OPTIONS = ['swerve drive', 'tank drive', 'other'] as const
const CLIMB_OPTIONS = ['L1', 'L2', 'L3', "can't climb"] as const
const CLIMB_SIDES = ['right', 'left', 'center'] as const
const INTAKE_OPTIONS = ['one at a time', 'multiple'] as const
const RELIABILITY_OPTIONS = ['unreliable', 'semi-reliable', 'reliable'] as const

export function AddDataPage() {
  const { competitionId, teamNumber } = useParams<{ competitionId: string; teamNumber: string }>()
  const navigate = useNavigate()
  const teamNum = parseInt(teamNumber ?? '', 10)
  const [comp, setComp] = useState<Competition | null>(null)

  const [scoutName, setScoutName] = useState('')
  const [drivetrain, setDrivetrain] = useState<ScoutSubmission['drivetrain']>('tank drive')
  const [drivetrainOther, setDrivetrainOther] = useState('')
  const [trench, setTrench] = useState<boolean | undefined>(undefined)
  const [climb, setClimb] = useState<ScoutSubmission['climb']>(undefined)
  const [climbSides, setClimbSides] = useState<('right' | 'left' | 'center')[]>([])
  const [climbTime, setClimbTime] = useState<number | ''>('')
  const [intakeType, setIntakeType] = useState<ScoutSubmission['intakeType']>(undefined)
  const [matchNumber, setMatchNumber] = useState<number | ''>('')
  const [avgPtsPerActivePeriod, setAvgPtsPerActivePeriod] = useState<number | ''>('')
  const [avgHumanPlayerPts, setAvgHumanPlayerPts] = useState<number | ''>('')
  const [hubPtsAuto, setHubPtsAuto] = useState<number | ''>('')
  const [climbAuto, setClimbAuto] = useState<boolean | undefined>(undefined)
  const [climbReliability, setClimbReliability] = useState<ScoutSubmission['climbReliability']>(undefined)
  const [intakeReliability, setIntakeReliability] = useState<ScoutSubmission['intakeReliability']>(undefined)
  const [notes, setNotes] = useState('')
  const [autoPathImageData, setAutoPathImageData] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!competitionId) return
    db.competitions.get(competitionId).then((c) => setComp(c ?? null))
  }, [competitionId])

  const hasAnyGameStat =
    matchNumber !== '' ||
    avgPtsPerActivePeriod !== '' ||
    avgHumanPlayerPts !== '' ||
    hubPtsAuto !== '' ||
    climbAuto !== undefined ||
    climbReliability != null ||
    intakeReliability != null

  const canSubmit = scoutName.trim() && (!hasAnyGameStat || (matchNumber !== '' && Number.isFinite(Number(matchNumber))))

  const handleSubmit = async () => {
    if (!competitionId || !Number.isFinite(teamNum) || !canSubmit) return
    const sub: ScoutSubmission = {
      competitionId,
      teamNumber: teamNum,
      scoutName: scoutName.trim(),
      createdAt: Date.now(),
      drivetrain: drivetrain === 'other' ? 'other' : drivetrain,
      drivetrainOther: drivetrain === 'other' ? drivetrainOther.trim() || undefined : undefined,
      trench: trench,
      climb,
      climbSides: climbSides.length ? climbSides : undefined,
      climbTime: climbTime === '' ? undefined : Number(climbTime),
      intakeType,
      matchNumber: matchNumber === '' ? undefined : Number(matchNumber),
      avgPtsPerActivePeriod: avgPtsPerActivePeriod === '' ? undefined : Number(avgPtsPerActivePeriod),
      avgHumanPlayerPtsPerActivePeriod: avgHumanPlayerPts === '' ? undefined : Number(avgHumanPlayerPts),
      hubPtsAuto: hubPtsAuto === '' ? undefined : Number(hubPtsAuto),
      climbAuto,
      climbReliability,
      intakeReliability,
      notes: notes.trim() || undefined,
      autoPathImageData,
    }
    await db.submissions.add(sub as ScoutSubmission & { id?: number })
    navigate('/')
  }

  const teamName = comp?.teamNames[teamNum] ?? `Team ${teamNum}`

  if (!competitionId || !Number.isFinite(teamNum)) {
    return <p>Invalid team or competition.</p>
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{teamName}</h1>
      <p className={styles.subtitle}>Team {teamNum}</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Add auto path</h2>
        <AutoPathEditor onSave={setAutoPathImageData} savedImage={autoPathImageData} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pit stats</h2>
        <div className={styles.fields}>
          <label>Drivetrain</label>
          <select value={drivetrain ?? ''} onChange={(e) => setDrivetrain((e.target.value as ScoutSubmission['drivetrain']) || undefined)}>
            {DRIVETRAIN_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {drivetrain === 'other' && (
            <input placeholder="Specify" value={drivetrainOther} onChange={(e) => setDrivetrainOther(e.target.value)} />
          )}
          <label>Trench?</label>
          <div className={styles.boolRow}>
            <button type="button" className={trench === true ? styles.active : ''} onClick={() => setTrench(true)}>Yes</button>
            <button type="button" className={trench === false ? styles.active : ''} onClick={() => setTrench(false)}>No</button>
          </div>
          <label>Climb</label>
          <select value={climb ?? ''} onChange={(e) => setClimb((e.target.value as ScoutSubmission['climb']) || undefined)}>
            <option value="">—</option>
            {CLIMB_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {climb && climb !== "can't climb" && (
            <>
              <label>Climb sides (multi)</label>
              <div className={styles.checkRow}>
                {CLIMB_SIDES.map((s) => (
                  <label key={s} className={styles.checkLabel}>
                    <input type="checkbox" checked={climbSides.includes(s)} onChange={(e) => setClimbSides((prev) => e.target.checked ? [...prev, s] : prev.filter((x) => x !== s))} />
                    {s}
                  </label>
                ))}
              </div>
              <label>Climb time</label>
              <input type="number" value={climbTime} onChange={(e) => setClimbTime(e.target.value === '' ? '' : Number(e.target.value))} />
            </>
          )}
          <label>Intake type</label>
          <select value={intakeType ?? ''} onChange={(e) => setIntakeType((e.target.value as ScoutSubmission['intakeType']) || undefined)}>
            <option value="">—</option>
            {INTAKE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Game stats</h2>
        <div className={styles.fields}>
          <label>Match number *</label>
          <input type="number" value={matchNumber} onChange={(e) => setMatchNumber(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Required if game stats filled" />
          <label>Avg pts/active period</label>
          <input type="number" value={avgPtsPerActivePeriod} onChange={(e) => setAvgPtsPerActivePeriod(e.target.value === '' ? '' : Number(e.target.value))} />
          <label>Avg Human Player pts/active period</label>
          <input type="number" value={avgHumanPlayerPts} onChange={(e) => setAvgHumanPlayerPts(e.target.value === '' ? '' : Number(e.target.value))} />
          <label>Hub pts/auto</label>
          <input type="number" value={hubPtsAuto} onChange={(e) => setHubPtsAuto(e.target.value === '' ? '' : Number(e.target.value))} />
          <label>Climb auto?</label>
          <div className={styles.boolRow}>
            <button type="button" className={climbAuto === true ? styles.active : ''} onClick={() => setClimbAuto(true)}>Yes</button>
            <button type="button" className={climbAuto === false ? styles.active : ''} onClick={() => setClimbAuto(false)}>No</button>
          </div>
          <label>Climb reliability</label>
          <select value={climbReliability ?? ''} onChange={(e) => setClimbReliability((e.target.value as ScoutSubmission['climbReliability']) || undefined)}>
            <option value="">—</option>
            {RELIABILITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <label>Intake reliability</label>
          <select value={intakeReliability ?? ''} onChange={(e) => setIntakeReliability((e.target.value as ScoutSubmission['intakeReliability']) || undefined)}>
            <option value="">—</option>
            {RELIABILITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </section>

      <section className={styles.section}>
        <label>Notes</label>
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.notes} placeholder="Any notes about this team" />
      </section>

      <section className={styles.section}>
        <label>Scout name *</label>
        <input value={scoutName} onChange={(e) => setScoutName(e.target.value)} placeholder="Your name" required />
      </section>

      <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={!canSubmit}>
        Submit
      </button>
    </div>
  )
}
