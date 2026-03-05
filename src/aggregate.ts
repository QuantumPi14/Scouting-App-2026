import type { AutoPathData, ScoutSubmission, TeamAggregate } from './types'

function nonEmpty(s: string | undefined | null): boolean {
  return typeof s === 'string' && s.trim().length > 0
}

function numericValues(arr: (number | undefined | null)[]): number[] {
  return arr.filter((v): v is number => typeof v === 'number')
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

const SHOT_PCT_BUCKETS = [0, 20, 40, 60, 80, 90, 95]

function bucketShotPercent(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null
  let best = SHOT_PCT_BUCKETS[0]
  let bestDiff = Math.abs(value - best)
  for (let i = 1; i < SHOT_PCT_BUCKETS.length; i++) {
    const b = SHOT_PCT_BUCKETS[i]
    const d = Math.abs(value - b)
    if (d < bestDiff) {
      best = b
      bestDiff = d
    }
  }
  return best
}

/** Most recent non-empty value; if latest is empty/whitespace, walk back. */
function mostRecentNonEmpty<T>(submissions: ScoutSubmission[], get: (s: ScoutSubmission) => T | undefined | null, format: (t: T) => string): string | null {
  const sorted = [...submissions].sort((a, b) => b.createdAt - a.createdAt)
  for (const s of sorted) {
    const v = get(s)
    if (v === undefined || v === null) continue
    const str = format(v)
    if (nonEmpty(str)) return str
  }
  return null
}

export function aggregateSubmissions(submissions: ScoutSubmission[]): TeamAggregate | null {
  if (submissions.length === 0) return null
  const first = submissions[0]
  const compId = first.competitionId
  const teamNum = first.teamNumber

  const pit = {
    drivetrain: (() => {
      const withDrivetrain = submissions.filter((s) => s.drivetrain != null)
      const sorted = [...withDrivetrain].sort((a, b) => b.createdAt - a.createdAt)
      for (const s of sorted) {
        if (s.drivetrain === 'other' && nonEmpty(s.drivetrainOther)) return s.drivetrainOther!.trim()
        if (s.drivetrain && s.drivetrain !== 'other') return s.drivetrain
      }
      return '—'
    })(),
    trench: (() => {
      const withVal = submissions.filter((s) => s.trench !== undefined && s.trench !== null)
      if (withVal.length === 0) return null
      const sorted = [...withVal].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0].trench ?? null
    })(),
    turret: (() => {
      const withVal = submissions.filter((s) => s.turret !== undefined && s.turret !== null)
      if (withVal.length === 0) return null
      const sorted = [...withVal].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0].turret ?? null
    })(),
    climb: mostRecentNonEmpty(submissions, (s) => s.climb, (v) => String(v)) ?? '—',
    climbSides: (() => {
      const withVal = submissions.filter((s) => s.climbSides && s.climbSides.length > 0)
      if (withVal.length === 0) return null
      const sorted = [...withVal].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0].climbSides ?? null
    })(),
    climbTime: avg(numericValues(submissions.map((s) => s.climbTime))) ?? null,
    intakeType: mostRecentNonEmpty(submissions, (s) => s.intakeType, (v) => String(v)),
  }

  const game = {
    matchNumber: (() => {
      const nums = numericValues(submissions.map((s) => s.matchNumber))
      if (nums.length === 0) return null
      return avg(nums)
    })(),
    avgPtsPerActivePeriod: (() => {
      const values: number[] = []
      for (const s of submissions) {
        if (Array.isArray(s.ptsPerActivePeriod) && s.ptsPerActivePeriod.length > 0) {
          values.push(...numericValues(s.ptsPerActivePeriod))
        } else if (typeof s.avgPtsPerActivePeriod === 'number') {
          values.push(s.avgPtsPerActivePeriod)
        }
      }
      return avg(values)
    })() ?? null,
    avgHumanPlayerPtsPerActivePeriod: (() => {
      const values: number[] = []
      for (const s of submissions) {
        if (Array.isArray(s.humanPlayerPtsPerActivePeriod) && s.humanPlayerPtsPerActivePeriod.length > 0) {
          values.push(...numericValues(s.humanPlayerPtsPerActivePeriod))
        } else if (typeof s.avgHumanPlayerPtsPerActivePeriod === 'number') {
          values.push(s.avgHumanPlayerPtsPerActivePeriod)
        }
      }
      return avg(values)
    })() ?? null,
    hubPtsAuto: avg(numericValues(submissions.map((s) => s.hubPtsAuto))) ?? null,
    climbAuto: (() => {
      const withVal = submissions.filter((s) => s.climbAuto !== undefined && s.climbAuto !== null)
      if (withVal.length === 0) return null
      const sorted = [...withVal].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0].climbAuto ?? null
    })(),
    climbReliability: mostRecentNonEmpty(submissions, (s) => s.climbReliability, (v) => String(v)),
    intakeReliability: mostRecentNonEmpty(submissions, (s) => s.intakeReliability, (v) => String(v)),
    moveWhileShooting: mostRecentNonEmpty(submissions, (s) => s.moveWhileShooting, (v) => String(v)),
    pickUpWhileShooting: (() => {
      const withVal = submissions.filter((s) => s.pickUpWhileShooting !== undefined && s.pickUpWhileShooting !== null)
      if (withVal.length === 0) return null
      const sorted = [...withVal].sort((a, b) => b.createdAt - a.createdAt)
      return sorted[0].pickUpWhileShooting ?? null
    })(),
    shotAccuracyPercent: bucketShotPercent(avg(numericValues(submissions.map((s) => s.shotAccuracyPercent)))),
    malfunctionMatchCount: (() => {
      const withMalfunction = submissions.filter((s) => s.matchNumber != null && s.malfunction === true)
      const matchNumbers = new Set(withMalfunction.map((s) => s.matchNumber!))
      return matchNumbers.size
    })(),
  }

  const autoPathImages = submissions.map((s) => s.autoPathImageData).filter((d): d is string => nonEmpty(d ?? ''))
  const hasPathDataContent = (item: { pathData?: AutoPathData | null }) => {
    const d = item.pathData
    if (!d || typeof d !== 'object') return false
    const markers = Array.isArray(d.markers) ? d.markers : []
    return markers.length > 0
  }
  const autoPathItems: { image?: string; pathData?: AutoPathData }[] = submissions
    .map((s) => ({ image: s.autoPathImageData, pathData: s.autoPathData }))
    .filter((item) => nonEmpty(item.image ?? '') || hasPathDataContent(item))

  const notesByScout = submissions
    .filter((s) => nonEmpty(s.notes))
    .map((s) => ({
      scoutDisplayName: s.scoutName,
      notes: (s.notes ?? '').trim(),
    }))

  return {
    competitionId: compId,
    teamNumber: teamNum,
    submissionCount: submissions.length,
    pit,
    game,
    autoPathImages,
    autoPathItems,
    notesByScout,
  }
}
