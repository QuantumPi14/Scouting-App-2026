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
    this.version(2).stores({
      competitions: 'id',
      submissions: '++id, competitionId, teamNumber, [competitionId+teamNumber], [competitionId+teamNumber+createdAt]',
    }).upgrade(async (tx) => {
      const table = tx.table<ScoutSubmission, number>('submissions')
      const all = await table.toArray()
      await Promise.all(
        all.map(async (s) => {
          let changed = false
          const next: Partial<ScoutSubmission> = {}
          if (!s.ptsPerActivePeriod && typeof s.avgPtsPerActivePeriod === 'number') {
            next.ptsPerActivePeriod = [s.avgPtsPerActivePeriod]
            changed = true
          }
          if (!s.humanPlayerPtsPerActivePeriod && typeof s.avgHumanPlayerPtsPerActivePeriod === 'number') {
            next.humanPlayerPtsPerActivePeriod = [s.avgHumanPlayerPtsPerActivePeriod]
            changed = true
          }
          if (changed && s.id != null) {
            await table.update(s.id, next)
          }
        })
      )
    })
  }
}

export const db = new ScoutingDB()
