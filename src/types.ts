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
  shotAccuracyPercent?: number // 0, 10, 20, ..., 100

  notes?: string
  autoPathImageData?: string // base64 PNG
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
  }
  autoPathImages: string[]
  notesByScout: { scoutDisplayName: string; notes: string }[]
}

export type SearchType = 'team' | 'match'
