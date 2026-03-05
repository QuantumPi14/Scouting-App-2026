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

export type SearchType = 'team' | 'match'
