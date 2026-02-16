import Dexie, { type EntityTable } from 'dexie'
import type { Competition, ScoutSubmission } from './types'

export class ScoutingDB extends Dexie {
  competitions!: EntityTable<Competition, 'id'>
  submissions!: EntityTable<ScoutSubmission, 'id'>

  constructor() {
    super('ScoutingApp2026')
    this.version(1).stores({
      competitions: 'id',
      submissions: '++id, competitionId, teamNumber, [competitionId+teamNumber], [competitionId+teamNumber+createdAt]',
    })
  }
}

export const db = new ScoutingDB()
