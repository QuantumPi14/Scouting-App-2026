import { db } from './db'
import type { Competition } from './types'

/** Default competitions seeded into DB on app load if not already present. Empty so new installs get no competitions until admin adds one or loads demo. */
export const DEFAULT_COMPETITIONS: Competition[] = []

export async function ensureDefaultCompetitions(): Promise<void> {
  for (const comp of DEFAULT_COMPETITIONS) {
    const existing = await db.competitions.get(comp.id)
    if (!existing) await db.competitions.put(comp)
  }
}
