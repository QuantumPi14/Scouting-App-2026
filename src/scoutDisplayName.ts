import type { ScoutSubmission } from './types'

/**
 * For submissions with the same scout name (trimmed), we display
 * "John", "John (1)", "John (2)" where higher number = more recent.
 * First occurrence (oldest) gets no number.
 */
export function getScoutDisplayNames(submissions: ScoutSubmission[]): Map<number, string> {
  const sorted = [...submissions].sort((a, b) => a.createdAt - b.createdAt)
  const nameCount = new Map<string, number>()
  const result = new Map<number, string>()
  for (const s of sorted) {
    const name = (s.scoutName ?? '').trim() || 'Scout'
    const count = nameCount.get(name) ?? 0
    nameCount.set(name, count + 1)
    const display = count === 0 ? name : `${name} (${count})`
    result.set(s.id!, display)
  }
  return result
}
