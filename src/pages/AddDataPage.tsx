import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db } from '../db'
import type { AutoPathData, Competition, ScoutSubmission } from '../types'
import { AutoPathEditor } from '../components/AutoPathEditor'
import styles from './AddDataPage.module.css'

const DRIVETRAIN_OPTIONS = ['swerve drive', 'tank drive', 'other'] as const
const CLIMB_OPTIONS = ['L1', 'L2', 'L3', "can't climb"] as const
const CLIMB_SIDES = ['right', 'left', 'center'] as const
const INTAKE_OPTIONS = ['one at a time', 'multiple'] as const
const RELIABILITY_OPTIONS = ['unreliable', 'semi-reliable', 'reliable'] as const
const MOVE_WHILE_SHOOTING_OPTIONS = ['yes', 'kinda', 'no'] as const
const SHOT_ACCURACY_OPTIONS = [0, 20, 40, 60, 80, 90, 95] as const

export function AddDataPage() {
  const { competitionId, teamNumber } = useParams<{ competitionId: string; teamNumber: string }>()
  const navigate = useNavigate()
  const teamNum = parseInt(teamNumber ?? '', 10)
  const [comp, setComp] = useState<Competition | null>(null)

  const [scoutName, setScoutName] = useState('')
  const [drivetrain, setDrivetrain] = useState<ScoutSubmission['drivetrain']>('tank drive')
  const [drivetrainOther, setDrivetrainOther] = useState('')
  const [trench, setTrench] = useState<boolean | undefined>(undefined)
  const [turret, setTurret] = useState<boolean | undefined>(undefined)
  const [climb, setClimb] = useState<ScoutSubmission['climb']>(undefined)
  const [climbSides, setClimbSides] = useState<('right' | 'left' | 'center')[]>([])
  const [climbTime, setClimbTime] = useState<number | ''>('')
  const [intakeType, setIntakeType] = useState<ScoutSubmission['intakeType']>(undefined)
  const [matchNumber, setMatchNumber] = useState<number | ''>('')
  const [ptsPerActivePeriod, setPtsPerActivePeriod] = useState<(number | '')[]>(['', ''])
  const [humanPtsPerActivePeriod, setHumanPtsPerActivePeriod] = useState<(number | '')[]>(['', ''])
  const [hubPtsAuto, setHubPtsAuto] = useState<number | ''>('')
  const [climbAuto, setClimbAuto] = useState<boolean | undefined>(undefined)
  const [climbReliability, setClimbReliability] = useState<ScoutSubmission['climbReliability']>(undefined)
  const [intakeReliability, setIntakeReliability] = useState<ScoutSubmission['intakeReliability']>(undefined)
  const [moveWhileShooting, setMoveWhileShooting] = useState<ScoutSubmission['moveWhileShooting']>(undefined)
  const [pickUpWhileShooting, setPickUpWhileShooting] = useState<boolean | undefined>(undefined)
  const [shotAccuracyPercent, setShotAccuracyPercent] = useState<number | ''>('')
  const [malfunction, setMalfunction] = useState<boolean | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [autoPathImageData, setAutoPathImageData] = useState<string | undefined>(undefined)
  const [autoPathData, setAutoPathData] = useState<AutoPathData | undefined>(undefined)

  useEffect(() => {
    if (!competitionId) return
    db.competitions.get(competitionId).then((c) => setComp(c ?? null))
  }, [competitionId])

  const hasAnyGameStat =
    matchNumber !== '' ||
    ptsPerActivePeriod.some((v) => v !== '') ||
    humanPtsPerActivePeriod.some((v) => v !== '') ||
    hubPtsAuto !== '' ||
    climbAuto !== undefined ||
    climbReliability != null ||
    intakeReliability != null ||
    moveWhileShooting != null ||
    pickUpWhileShooting !== undefined ||
    shotAccuracyPercent !== '' ||
    malfunction !== undefined

  const canSubmit = scoutName.trim() && (!hasAnyGameStat || (matchNumber !== '' && Number.isFinite(Number(matchNumber))))

  const handleSubmit = async () => {
    if (!competitionId || !Number.isFinite(teamNum) || !canSubmit) return
    const toPeriodArray = (vals: (number | '')[]): (number | null)[] => vals.map((v) => (v === '' ? null : Number(v)))
    const ptsArray = toPeriodArray(ptsPerActivePeriod)
    const humanArray = toPeriodArray(humanPtsPerActivePeriod)
    const avgFromArray = (arr: (number | null)[]): number | undefined => {
      const nums = arr.filter((v): v is number => typeof v === 'number')
      if (nums.length === 0) return undefined
      return nums.reduce((a, b) => a + b, 0) / nums.length
    }
    const avgPts = avgFromArray(ptsArray)
    const avgHuman = avgFromArray(humanArray)
    const sub: ScoutSubmission = {
      competitionId,
      teamNumber: teamNum,
      scoutName: scoutName.trim(),
      createdAt: Date.now(),
      drivetrain: drivetrain === 'other' ? 'other' : drivetrain,
      drivetrainOther: drivetrain === 'other' ? drivetrainOther.trim() || undefined : undefined,
      trench: trench,
      turret,
      climb,
      climbSides: climbSides.length ? climbSides : undefined,
      climbTime: climbTime === '' ? undefined : Number(climbTime),
      intakeType,
      matchNumber: matchNumber === '' ? undefined : Number(matchNumber),
      avgPtsPerActivePeriod: avgPts,
      avgHumanPlayerPtsPerActivePeriod: avgHuman,
      ptsPerActivePeriod: ptsArray.some((v) => v != null) ? ptsArray : undefined,
      humanPlayerPtsPerActivePeriod: humanArray.some((v) => v != null) ? humanArray : undefined,
      hubPtsAuto: hubPtsAuto === '' ? undefined : Number(hubPtsAuto),
      climbAuto,
      climbReliability,
      intakeReliability,
      moveWhileShooting,
      pickUpWhileShooting,
      shotAccuracyPercent: shotAccuracyPercent === '' ? undefined : Number(shotAccuracyPercent),
      malfunction,
      notes: notes.trim() || undefined,
      autoPathImageData,
      autoPathData,
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
        <AutoPathEditor
          onSave={(img, pathData) => {
            setAutoPathImageData(img)
            setAutoPathData(pathData)
          }}
          savedImage={autoPathImageData}
          savedPathData={autoPathData}
        />
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
          <label>Turret?</label>
          <div className={styles.boolRow}>
            <button type="button" className={turret === true ? styles.active : ''} onClick={() => setTurret(true)}>Yes</button>
            <button type="button" className={turret === false ? styles.active : ''} onClick={() => setTurret(false)}>No</button>
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
          <label>Pts/active period (P1, P2)</label>
          <div className={styles.periodRow}>
            {ptsPerActivePeriod.map((val, idx) => (
              <div key={idx} className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() =>
                    setPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      const current = next[idx] === '' ? 0 : Number(next[idx])
                      next[idx] = current - 1
                      return next
                    })
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  value={val}
                  onChange={(e) =>
                    setPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      next[idx] = e.target.value === '' ? '' : Number(e.target.value)
                      return next
                    })
                  }
                />
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() =>
                    setPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      const current = next[idx] === '' ? 0 : Number(next[idx])
                      next[idx] = current + 1
                      return next
                    })
                  }
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <label>Human player pts/active period (P1, P2)</label>
          <div className={styles.periodRow}>
            {humanPtsPerActivePeriod.map((val, idx) => (
              <div key={idx} className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() =>
                    setHumanPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      const current = next[idx] === '' ? 0 : Number(next[idx])
                      next[idx] = current - 1
                      return next
                    })
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  value={val}
                  onChange={(e) =>
                    setHumanPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      next[idx] = e.target.value === '' ? '' : Number(e.target.value)
                      return next
                    })
                  }
                />
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() =>
                    setHumanPtsPerActivePeriod((prev) => {
                      const next = [...prev]
                      const current = next[idx] === '' ? 0 : Number(next[idx])
                      next[idx] = current + 1
                      return next
                    })
                  }
                >
                  +
                </button>
              </div>
            ))}
          </div>
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
          <label>Move while shooting?</label>
          <select value={moveWhileShooting ?? ''} onChange={(e) => setMoveWhileShooting((e.target.value as ScoutSubmission['moveWhileShooting']) || undefined)}>
            <option value="">—</option>
            {MOVE_WHILE_SHOOTING_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <label>Pick up while shooting?</label>
          <div className={styles.boolRow}>
            <button type="button" className={pickUpWhileShooting === true ? styles.active : ''} onClick={() => setPickUpWhileShooting(true)}>Yes</button>
            <button type="button" className={pickUpWhileShooting === false ? styles.active : ''} onClick={() => setPickUpWhileShooting(false)}>No</button>
          </div>
          <label>% Accuracy of shots</label>
          <select value={shotAccuracyPercent === '' ? '' : shotAccuracyPercent} onChange={(e) => setShotAccuracyPercent(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">—</option>
            {SHOT_ACCURACY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === 95 ? '95–100%' : `${o}%`}</option>
            ))}
          </select>
          <label>Malfunction?</label>
          <div className={styles.boolRow}>
            <button
              type="button"
              className={malfunction === true ? styles.active : ''}
              onClick={() => setMalfunction(malfunction === true ? false : true)}
              title={malfunction === true ? 'Robot malfunctioned this match (tap to clear)' : 'Tap if robot malfunctioned this match'}
            >
              {malfunction === true ? 'Malfunction (yes)' : 'Malfunction (no)'}
            </button>
          </div>
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
