// Competition and team list (admin-managed)
export interface Competition {
  id: string
  name: string
  teamNumbers: number[]
  teamNames: Record<number, string> // teamNumber -> display name
}

// Single scout submission (one "Add data" form submit)
export interface ScoutSubmission {
  id?: number
  competitionId: string
  teamNumber: number
  scoutName: string
  createdAt: number // timestamp ms

  // Pit stats
  drivetrain?: 'swerve drive' | 'tank drive' | 'other'
  drivetrainOther?: string
  trench?: boolean
  turret?: boolean
  climb?: 'L1' | 'L2' | 'L3' | "can't climb"
  climbSides?: ('right' | 'left' | 'center')[]
  climbTime?: number
  intakeType?: 'one at a time' | 'multiple'

  // Game stats (match number required when any game stat present)
  matchNumber?: number
  avgPtsPerActivePeriod?: number
  avgHumanPlayerPtsPerActivePeriod?: number
  /** Points per active period P1, P2, P3 (used going forward). */
  ptsPerActivePeriod?: (number | null)[]
  humanPlayerPtsPerActivePeriod?: (number | null)[]
  hubPtsAuto?: number
  climbAuto?: boolean
  climbReliability?: 'unreliable' | 'semi-reliable' | 'reliable'
  intakeReliability?: 'unreliable' | 'semi-reliable' | 'reliable'
  moveWhileShooting?: 'yes' | 'kinda' | 'no'
  pickUpWhileShooting?: boolean
  shotAccuracyPercent?: number // buckets: 0, 20, 40, 60, 80, 90, 95 (≈95–100)
  malfunction?: boolean

  notes?: string
  autoPathImageData?: string // base64 PNG (not sent in QR; use autoPathData to sync)
  /** Normalized 0–1 marker coordinates on the field template (included in QR). */
  autoPathData?: AutoPathData
}

/** Stored marker: type, id, and normalized (0–1) position. Only markers on the field are stored. */
export interface AutoPathMarkerStored {
  type: 'start' | 'end' | 'climb' | 'shot' | 'waypoint'
  id: string
  x: number
  y: number
}

/** Lightweight auto path data for sync/QR: markers on field (all coordinates 0–1). */
export interface AutoPathData {
  markers: AutoPathMarkerStored[]
}

// Aggregated "average" view for a team (computed from submissions)
export interface TeamAggregate {
  competitionId: string
  teamNumber: number
  submissionCount: number
  pit: {
    drivetrain: string
    trench: boolean | null
    turret: boolean | null
    climb: string
    climbSides: string[] | null
    climbTime: number | null
    intakeType: string | null
  }
  game: {
    matchNumber: number | null
    avgPtsPerActivePeriod: number | null
    avgHumanPlayerPtsPerActivePeriod: number | null
    hubPtsAuto: number | null
    climbAuto: boolean | null
    climbReliability: string | null
    intakeReliability: string | null
    moveWhileShooting: string | null
    pickUpWhileShooting: boolean | null
    shotAccuracyPercent: number | null
    /** Number of matches (distinct matchNumbers) where at least one submission had malfunction. */
    malfunctionMatchCount: number
  }
  autoPathImages: string[]
  /** One per submission that has an auto path (image and/or pathData). Enables replay from coordinates when no image. */
  autoPathItems: { image?: string; pathData?: AutoPathData }[]
  notesByScout: { scoutDisplayName: string; notes: string }[]
}

/**
 * Compact v2 QR schema for scouting data.
 * These types are used only for encoding/decoding QR payloads; the app continues
 * to use ScoutSubmission internally.
 */
export interface QrV2Header {
  competitionId?: string
  competitionName?: string
  /** Dictionary of scout names; records reference by 0-based index. */
  scoutNames: string[]
}

export interface QrV2SubmissionRecord {
  /** Team number. */
  t: number
  /** Scout index into QrV2Header.scoutNames. */
  s: number
  /** createdAt timestamp (ms). */
  c: number
  /** Match number (optional). */
  mn?: number

  // Pit stats (compact enums / values)
  dt?: number // drivetrain enum index
  tr?: boolean
  tu?: boolean
  cl?: number // climb enum index
  cs?: ('left' | 'center' | 'right')[]
  ct?: number
  it?: number // intakeType enum index

  // Game stats
  ap?: number
  ah?: number
  ha?: number
  ca?: boolean
  cr?: number // climbReliability enum index
  ir?: number // intakeReliability enum index
  mvs?: number // moveWhileShooting enum index
  pus?: boolean // pickUpWhileShooting
  sap?: number // shotAccuracyPercent
  mf?: boolean // malfunction

  nt?: string // notes
  apd?: AutoPathData // autoPathData (markers only; image never included)
}

export interface QrV2DataEnvelope {
  v: number
  type: 'data-v2'
  competitionId?: string
  exportedAt: number
  part?: number
  totalParts?: number
  /** Present on the first chunk; omitted on subsequent chunks to save bytes. */
  header?: QrV2Header
  records: QrV2SubmissionRecord[]
}

export type SearchType = 'team' | 'match'
