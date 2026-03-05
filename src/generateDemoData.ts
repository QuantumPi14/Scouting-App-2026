import type { AutoPathData, Competition, ScoutSubmission } from './types'

const DEMO_COMPETITION_ID = 'test'
const TEAM_NUMBERS = Array.from({ length: 27 }, (_, i) => 100 + i)

const DEMO_TEAM_NAMES: Record<number, string> = Object.fromEntries(
  [
    'Ravens', 'Eagles', 'Hawks', 'Falcons', 'Condors', 'Vultures', 'Phoenix',
    'Thunder', 'Storm', 'Blaze', 'Flame', 'Spark', 'Bolt', 'Surge',
    'Titans', 'Spartans', 'Trojans', 'Vikings', 'Knights', 'Raiders',
    'Wolves', 'Bears', 'Lions', 'Tigers', 'Panthers', 'Cobras', 'Scorpions',
  ].map((name, i) => [100 + i, name])
)

const DRIVETRAINS: ScoutSubmission['drivetrain'][] = ['swerve drive', 'tank drive', 'other']
const CLIMBS: ScoutSubmission['climb'][] = ['L1', 'L2', 'L3', "can't climb"]
const INTAKE_TYPES: ScoutSubmission['intakeType'][] = ['one at a time', 'multiple']
const RELIABILITY: ScoutSubmission['climbReliability'][] = ['unreliable', 'semi-reliable', 'reliable']
const MOVE_WHILE: ScoutSubmission['moveWhileShooting'][] = ['yes', 'kinda', 'no']

// Performance tiers for demo realism: a few great teams, a few bad ones, rest in the middle.
type PerformanceTier = 'elite' | 'good' | 'average' | 'weak'

// Explicitly chosen so strength is NOT correlated with team number ordering.
const ELITE_TEAMS = new Set<number>([100, 112, 119])
const GOOD_TEAMS = new Set<number>([101, 105, 111, 123, 126])
const WEAK_TEAMS = new Set<number>([104, 110, 115, 120, 125])

function tierForTeamNumber(teamNumber: number): PerformanceTier {
  if (ELITE_TEAMS.has(teamNumber)) return 'elite'
  if (GOOD_TEAMS.has(teamNumber)) return 'good'
  if (WEAK_TEAMS.has(teamNumber)) return 'weak'
  return 'average'
}

function shotPctForTier(tier: PerformanceTier, seed: number): number {
  const r = seed % 100 // 0–99
  if (tier === 'elite') {
    // Heavy weight on 80–95+
    if (r < 10) return 70
    if (r < 40) return 80
    if (r < 80) return 90
    return 95 // 95–100 bucket
  }
  if (tier === 'good') {
    if (r < 10) return 50
    if (r < 40) return 60
    if (r < 75) return 70
    return 80
  }
  if (tier === 'average') {
    if (r < 20) return 30
    if (r < 55) return 40
    if (r < 80) return 50
    return 60
  }
  // weak
  if (r < 30) return 10
  if (r < 60) return 20
  if (r < 85) return 30
  return 40
}

/** Which team indices (0–26) play in match m (1–54). Each match has exactly 6 teams; each team plays in exactly 12 matches. */
function teamsForMatch(matchOneBased: number): number[] {
  const m = matchOneBased - 1
  return Array.from({ length: 6 }, (_, i) => (m * 6 + i) % 27)
}

/** Match numbers (1–54) that team at teamIndex (0–26) plays in. */
function matchesForTeam(teamIndex: number): number[] {
  const out: number[] = []
  for (let m = 1; m <= 54; m++) {
    if (teamsForMatch(m).includes(teamIndex)) out.push(m)
  }
  return out
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

/** Plausible random pit-only submission (no matchNumber). */
function makePitOnly(competitionId: string, teamNumber: number, scoutName: string, createdAt: number, seed: number): ScoutSubmission {
  const climb = pick(CLIMBS, seed + 1)
  const sidesOrder: ('left' | 'center' | 'right')[] = ['left', 'center', 'right']
  const climbSides = climb === "can't climb" ? undefined : [sidesOrder[seed % sidesOrder.length]]
  return {
    competitionId,
    teamNumber,
    scoutName,
    createdAt,
    drivetrain: pick(DRIVETRAINS, seed),
    trench: seed % 3 !== 0,
    turret: seed % 2 === 0,
    climb,
    climbSides,
    climbTime: 10 + (seed % 25),
    intakeType: pick(INTAKE_TYPES, seed + 2),
  }
}

/** Plausible random game-only submission (matchNumber, game stats, no pit). */
function makeGameOnly(competitionId: string, teamNumber: number, scoutName: string, createdAt: number, matchNumber: number, seed: number): ScoutSubmission {
  const tier = tierForTeamNumber(teamNumber)

  // Base robot scoring per active period by tier (2 periods per match).
  let avgBase: number
  switch (tier) {
    case 'elite':
      avgBase = 40 // ≈80 pts/match
      break
    case 'good':
      avgBase = 28
      break
    case 'average':
      avgBase = 18
      break
    case 'weak':
    default:
      avgBase = 8
      break
  }
  const avgNoise = (seed % 7) - 3 // -3..+3
  const avgPts = Math.max(0, avgBase + avgNoise)

  // Human player contribution per active period: smaller and capped at 25, loosely tiered.
  let hpBase: number
  switch (tier) {
    case 'elite':
      hpBase = 18
      break
    case 'good':
      hpBase = 14
      break
    case 'average':
      hpBase = 9
      break
    case 'weak':
    default:
      hpBase = 4
      break
  }
  const hpNoise = (seed % 7) - 3
  const hpPts = Math.min(25, Math.max(0, hpBase + hpNoise))

  // Auto hub points correlate with strength but stay lower than robot period scoring.
  const autoFactor =
    tier === 'elite' ? 0.6
      : tier === 'good' ? 0.55
        : tier === 'average' ? 0.5
          : 0.45
  const hubBase = avgPts * autoFactor
  const hubNoise = seed % 5
  const hubPts = Math.max(0, Math.round(hubBase + hubNoise))

  return {
    competitionId,
    teamNumber,
    scoutName,
    createdAt,
    matchNumber,
    avgPtsPerActivePeriod: avgPts,
    avgHumanPlayerPtsPerActivePeriod: hpPts,
    hubPtsAuto: hubPts,
    climbAuto: seed % (tier === 'elite' ? 2 : tier === 'good' ? 3 : tier === 'average' ? 4 : 5) === 0,
    climbReliability: pick(RELIABILITY, seed + (tier === 'elite' ? 100 : 0)),
    intakeReliability: pick(RELIABILITY, seed + 5),
    moveWhileShooting: pick(MOVE_WHILE, seed + 10),
    pickUpWhileShooting: seed % 2 === 0,
    shotAccuracyPercent: shotPctForTier(tier, seed + 13),
    malfunction: seed % (tier === 'weak' ? 5 : 12) === 0,
  }
}

/** Plausible pit+game submission (one match, pit and game fields). */
function makePitAndGame(competitionId: string, teamNumber: number, scoutName: string, createdAt: number, matchNumber: number, seed: number): ScoutSubmission {
  const tier = tierForTeamNumber(teamNumber)

  // Same tiered robot scoring as makeGameOnly.
  let avgBase: number
  switch (tier) {
    case 'elite':
      avgBase = 40
      break
    case 'good':
      avgBase = 28
      break
    case 'average':
      avgBase = 18
      break
    case 'weak':
    default:
      avgBase = 8
      break
  }
  const avgNoise = (seed % 7) - 3
  const avgPts = Math.max(0, avgBase + avgNoise)

  // Human player per-period contribution, capped at 25.
  let hpBase: number
  switch (tier) {
    case 'elite':
      hpBase = 18
      break
    case 'good':
      hpBase = 14
      break
    case 'average':
      hpBase = 9
      break
    case 'weak':
    default:
      hpBase = 4
      break
  }
  const hpNoise = (seed % 7) - 3
  const hpPts = Math.min(25, Math.max(0, hpBase + hpNoise))

  const autoFactor =
    tier === 'elite' ? 0.6
      : tier === 'good' ? 0.55
        : tier === 'average' ? 0.5
          : 0.45
  const hubBase = avgPts * autoFactor
  const hubNoise = seed % 5
  const hubPts = Math.max(0, Math.round(hubBase + hubNoise))

  return {
    ...makePitOnly(competitionId, teamNumber, scoutName, createdAt, seed),
    matchNumber,
    avgPtsPerActivePeriod: avgPts,
    avgHumanPlayerPtsPerActivePeriod: hpPts,
    hubPtsAuto: hubPts,
    climbAuto: seed % (tier === 'elite' ? 2 : tier === 'good' ? 3 : 4) === 0,
    climbReliability: pick(RELIABILITY, seed + 3),
    intakeReliability: pick(RELIABILITY, seed + 7),
    moveWhileShooting: pick(MOVE_WHILE, seed + 11),
    pickUpWhileShooting: seed % 2 === 1,
    shotAccuracyPercent: shotPctForTier(tier, seed + 17),
    malfunction: tier === 'weak' ? seed % 7 === 0 : false,
  }
}

/** Simple deterministic marker set for a subset of submissions. */
function sampleAutoPathMarkers(seed: number): AutoPathData {
  const id = `wp-${seed}`
  return {
    markers: [
      { type: 'start', id: 'start', x: 0.15 + (seed % 10) * 0.01, y: 0.85, },
      { type: 'end', id: 'end', x: 0.75 + (seed % 10) * 0.01, y: 0.2, },
      { type: 'waypoint', id, x: 0.4 + (seed % 20) * 0.01, y: 0.5, },
    ],
  }
}

/**
 * Build one Competition "Test" with 27 teams (100–126) and submissions:
 * 54 matches; each match has exactly 6 teams; each team has 13 submissions
 * (1 pit-only, 1 pit+game, 11 game-only) across 12 distinct matches.
 */
export function generateDemoCompetition(): { competition: Competition; submissions: ScoutSubmission[] } {
  const competition: Competition = {
    id: DEMO_COMPETITION_ID,
    name: 'Test',
    teamNumbers: [...TEAM_NUMBERS],
    teamNames: { ...DEMO_TEAM_NAMES },
  }

  const baseTime = Date.UTC(2026, 0, 15, 8, 0, 0)
  const submissions: ScoutSubmission[] = []
  const scouts = ['Scout A', 'Scout B', 'Scout C']

  for (let teamIdx = 0; teamIdx < 27; teamIdx++) {
    const teamNumber = TEAM_NUMBERS[teamIdx]
    const matchNumbers = matchesForTeam(teamIdx)
    if (matchNumbers.length !== 12) throw new Error(`Demo schedule: team ${teamNumber} should have 12 matches`)

    let subIdx = 0
    const createdAt = (t: number, s: number) => baseTime + teamIdx * 10000 + t * 1000 + s

    submissions.push(makePitOnly(DEMO_COMPETITION_ID, teamNumber, pick(scouts, teamIdx), createdAt(0, subIdx++), teamIdx * 7))
    submissions.push(makePitAndGame(DEMO_COMPETITION_ID, teamNumber, pick(scouts, teamIdx + 1), createdAt(0, subIdx++), matchNumbers[0], teamIdx * 11 + 3))
    for (let i = 1; i < 12; i++) {
      const sub = makeGameOnly(DEMO_COMPETITION_ID, teamNumber, pick(scouts, teamIdx + i), createdAt(i, subIdx++), matchNumbers[i], teamIdx * 13 + i)
      if (teamIdx % 4 === 0 && i === 2) sub.autoPathData = sampleAutoPathMarkers(teamIdx + i)
      submissions.push(sub)
    }
  }

  return { competition, submissions }
}
