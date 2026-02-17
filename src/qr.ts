import QRCode from 'qrcode'
import { db } from './db'
import type { AutoPathData, Competition, ScoutSubmission } from './types'

const QR_VERSION = 1
/** Max bytes per config QR. Single comp with many teams is split across multiple QRs. */
const CONFIG_MAX_QR_BYTES = 900
/** Reserve for payload wrapper (v, type, exportedAt, part, totalParts) so we know how much room is left for competitions[]. */
const CONFIG_WRAPPER_BYTES = 100
/** Keep data QRs small so the QR library can encode them (avoid code length overflow). */
const DATA_MAX_QR_BYTES = 700
const DATA_QR_OPTIONS = { margin: 2, width: 360, errorCorrectionLevel: 'L' as const }

/** Split one competition into smaller Competition parts (same id/name, chunked team list) so each fits in maxBytes. */
function splitCompetition(comp: Competition, maxBytes: number): Competition[] {
  const parts: Competition[] = []
  const ids = comp.teamNumbers
  if (ids.length === 0) return [{ id: comp.id, name: comp.name, teamNumbers: [], teamNames: {} }]
  let start = 0
  while (start < ids.length) {
    let end = start
    while (end < ids.length) {
      const teamNumbers = ids.slice(start, end + 1)
      const teamNames: Record<number, string> = {}
      for (const n of teamNumbers) if (comp.teamNames[n] != null) teamNames[n] = comp.teamNames[n]
      const c: Competition = { id: comp.id, name: comp.name, teamNumbers, teamNames }
      if (new Blob([JSON.stringify(c)]).size > maxBytes && end > start) break
      end += 1
    }
    const teamNumbers = ids.slice(start, end)
    const teamNames: Record<number, string> = {}
    for (const n of teamNumbers) if (comp.teamNames[n] != null) teamNames[n] = comp.teamNames[n]
    parts.push({ id: comp.id, name: comp.name, teamNumbers, teamNames })
    start = end
  }
  return parts
}

export interface ConfigPayload {
  v: number
  type: 'config'
  competitions: Competition[]
  exportedAt: number
  /** When chunking: 1-based part index (e.g. 1 of 3) */
  part?: number
  totalParts?: number
}

/** One submission split across QRs: this chunk only carries more path points to append. */
export interface PathContinuationItem {
  competitionId: string
  teamNumber: number
  createdAt: number
  pathDataAppend: { x: number; y: number }[]
}

export interface DataPayload {
  v: number
  type: 'data'
  competitionId?: string
  submissions: (ScoutSubmission | PathContinuationItem)[]
  exportedAt: number
  /** When chunked: 1-based part index (e.g. 1 of 4) */
  part?: number
  totalParts?: number
}

export async function exportConfigQR(): Promise<string[]> {
  const competitions = await db.competitions.toArray()
  const payload: ConfigPayload = {
    v: QR_VERSION,
    type: 'config',
    competitions,
    exportedAt: Date.now(),
  }
  const json = JSON.stringify(payload)
  const totalBytes = new Blob([json]).size
  if (totalBytes <= CONFIG_MAX_QR_BYTES) {
    const url = await QRCode.toDataURL(json, { margin: 2, width: 320 })
    return [url]
  }
  // Chunk by size; a single competition can be split across multiple QRs (same id/name, chunked team list)
  const maxCompBytes = CONFIG_MAX_QR_BYTES - CONFIG_WRAPPER_BYTES
  const chunks: Competition[][] = []
  let current: Competition[] = []
  const now = Date.now()
  for (const comp of competitions) {
    const compSize = new Blob([JSON.stringify(comp)]).size
    if (compSize > maxCompBytes) {
      if (current.length > 0) {
        chunks.push(current)
        current = []
      }
      const parts = splitCompetition(comp, maxCompBytes)
      for (const part of parts) chunks.push([part])
      continue
    }
    const trial = [...current, comp]
    const trialPayload: ConfigPayload = {
      v: QR_VERSION,
      type: 'config',
      competitions: trial,
      exportedAt: now,
      part: 1,
      totalParts: 99,
    }
    if (new Blob([JSON.stringify(trialPayload)]).size <= CONFIG_MAX_QR_BYTES) {
      current = trial
    } else {
      if (current.length > 0) {
        chunks.push(current)
        current = []
      }
      current = [comp]
    }
  }
  if (current.length > 0) chunks.push(current)
  const totalParts = chunks.length
  const urls: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const partPayload: ConfigPayload = {
      v: QR_VERSION,
      type: 'config',
      competitions: chunks[i],
      exportedAt: now,
      part: i + 1,
      totalParts,
    }
    const str = JSON.stringify(partPayload)
    const url = await QRCode.toDataURL(str, { margin: 2, width: 320 })
    urls.push(url)
  }
  return urls
}

/** Strip large fields so payload fits in QR codes. We keep autoPathData (coordinates) and drop autoPathImageData (base64 image). */
function submissionsForQR(submissions: ScoutSubmission[]): ScoutSubmission[] {
  return submissions.map(({ autoPathImageData: _, ...rest }) => ({ ...rest }))
}

/** Size of a payload with the given submissions array. */
function dataPayloadSize(
  submissions: (ScoutSubmission | PathContinuationItem)[],
  competitionId: string | undefined,
  exportedAt: number
): number {
  const p: DataPayload = {
    v: QR_VERSION,
    type: 'data',
    competitionId,
    submissions,
    exportedAt,
  }
  return new Blob([JSON.stringify(p)]).size
}

/**
 * When one submission doesn't fit in one QR, split it into multiple items: first payload has
 * the submission with an initial slice of path; following payloads are path continuations.
 * No data is lost; receiver merges pathDataAppend into the submission.
 */
function splitSubmissionIntoChunks(
  sub: ScoutSubmission,
  maxPayloadBytes: number,
  competitionId: string | undefined,
  exportedAt: number
): (ScoutSubmission | PathContinuationItem)[] {
  const path = sub.autoPathData && Array.isArray(sub.autoPathData.path) ? sub.autoPathData.path : []
  const markers = sub.autoPathData && Array.isArray(sub.autoPathData.markers) ? sub.autoPathData.markers : []
  if (path.length === 0) {
    const trimmed = { ...sub, notes: (sub.notes ?? '').slice(0, 200) }
    if (dataPayloadSize([trimmed], competitionId, exportedAt) <= maxPayloadBytes) return [trimmed]
    return [trimmed]
  }
  let n = 0
  for (; n <= path.length; n++) {
    const slice = path.slice(0, n)
    const withSlice: ScoutSubmission = {
      ...sub,
      autoPathData: { markers, path: slice },
    }
    if (dataPayloadSize([withSlice], competitionId, exportedAt) > maxPayloadBytes) break
  }
  n = Math.max(0, n - 1)
  const firstPath = path.slice(0, n)
  const restPath = path.slice(n)
  const result: (ScoutSubmission | PathContinuationItem)[] = []
  result.push({
    ...sub,
    autoPathData: { markers, path: firstPath },
  })
  let first = result[0] as ScoutSubmission
  while (dataPayloadSize([first], competitionId, exportedAt) > maxPayloadBytes && (first.notes?.length ?? 0) > 0) {
    first = { ...first, notes: (first.notes ?? '').slice(0, Math.max(0, (first.notes?.length ?? 0) - 100)) }
    result[0] = first
  }
  const key = { competitionId: sub.competitionId!, teamNumber: sub.teamNumber, createdAt: sub.createdAt! }
  let restStart = 0
  while (restStart < restPath.length) {
    let restEnd = restStart
    while (restEnd < restPath.length) {
      const append = restPath.slice(restStart, restEnd + 1)
      const cont: PathContinuationItem = {
        competitionId: key.competitionId,
        teamNumber: key.teamNumber,
        createdAt: key.createdAt,
        pathDataAppend: append,
      }
      if (dataPayloadSize([cont], competitionId, exportedAt) > maxPayloadBytes && restEnd > restStart) break
      restEnd += 1
    }
    const append = restPath.slice(restStart, restEnd)
    result.push({
      competitionId: key.competitionId,
      teamNumber: key.teamNumber,
      createdAt: key.createdAt,
      pathDataAppend: append,
    })
    restStart = restEnd
  }
  return result
}

export async function exportDataQR(competitionId?: string): Promise<string[]> {
  let submissions: ScoutSubmission[]
  if (competitionId) {
    submissions = await db.submissions.where('competitionId').equals(competitionId).toArray() as ScoutSubmission[]
  } else {
    submissions = await db.submissions.toArray() as ScoutSubmission[]
  }
  const forQR = submissionsForQR(submissions)
  const payload: DataPayload = {
    v: QR_VERSION,
    type: 'data',
    competitionId,
    submissions: forQR,
    exportedAt: Date.now(),
  }
  const json = JSON.stringify(payload)
  const totalBytes = new Blob([json]).size
  if (totalBytes <= DATA_MAX_QR_BYTES) {
    const url = await QRCode.toDataURL(json, DATA_QR_OPTIONS)
    return [url]
  }
  const now = Date.now()
  const chunks: (ScoutSubmission | PathContinuationItem)[][] = []
  let start = 0
  while (start < forQR.length) {
    let end = start
    let chunkJson = ''
    while (end < forQR.length) {
      const next = forQR.slice(start, end + 1)
      const nextPayload: DataPayload = {
        v: QR_VERSION,
        type: 'data',
        competitionId,
        submissions: next,
        exportedAt: now,
      }
      const nextStr = JSON.stringify(nextPayload)
      if (new Blob([nextStr]).size > DATA_MAX_QR_BYTES && end > start) break
      chunkJson = nextStr
      end += 1
    }
    const chunk = forQR.slice(start, end)
    if (chunk.length === 1 && new Blob([chunkJson]).size > DATA_MAX_QR_BYTES) {
      const parts = splitSubmissionIntoChunks(chunk[0], DATA_MAX_QR_BYTES, competitionId, now)
      for (const part of parts) {
        chunks.push([part])
      }
    } else {
      chunks.push(chunk)
    }
    start = end
  }
  const totalParts = chunks.length
  const urls: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const partPayload: DataPayload = {
      v: QR_VERSION,
      type: 'data',
      competitionId,
      submissions: chunks[i],
      exportedAt: now,
      ...(totalParts > 1 && { part: i + 1, totalParts }),
    }
    const str = JSON.stringify(partPayload)
    const url = await QRCode.toDataURL(str, DATA_QR_OPTIONS)
    urls.push(url)
  }
  return urls
}

/** Parse and validate QR payload. Lenient: trims input, accepts v as number or string, normalizes shape. */
export function parseQRPayload(json: string): ConfigPayload | DataPayload | null {
  try {
    let raw = typeof json === 'string' ? json.trim() : ''
    if (!raw) return null
    const data = JSON.parse(raw)
    const v = data?.v
    const versionOk = v === QR_VERSION || v === '1' || String(v) === '1'
    const typeStr = data?.type != null ? String(data.type).toLowerCase() : ''
    if (!versionOk || (typeStr !== 'config' && typeStr !== 'data')) return null
    if (typeStr === 'config') {
      const part = typeof data.part === 'number' ? data.part : undefined
      const totalParts = typeof data.totalParts === 'number' ? data.totalParts : undefined
      return {
        v: QR_VERSION,
        type: 'config',
        competitions: Array.isArray(data.competitions) ? data.competitions : [],
        exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
        ...(part != null && { part }),
        ...(totalParts != null && { totalParts }),
      }
    }
    const part = typeof data.part === 'number' ? data.part : undefined
    const totalParts = typeof data.totalParts === 'number' ? data.totalParts : undefined
    return {
      v: QR_VERSION,
      type: 'data',
      competitionId: data.competitionId,
      submissions: Array.isArray(data.submissions) ? data.submissions : [],
      exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
      ...(part != null && { part }),
      ...(totalParts != null && { totalParts }),
    }
  } catch {
    return null
  }
}

export async function importConfig(payload: ConfigPayload): Promise<void> {
  for (const comp of payload.competitions || []) {
    await db.competitions.put(comp)
  }
}

function isPathContinuation(item: unknown): item is PathContinuationItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'pathDataAppend' in item &&
    Array.isArray((item as PathContinuationItem).pathDataAppend)
  )
}

function hasPathData(sub: { autoPathData?: unknown }): boolean {
  const d = sub.autoPathData
  if (!d || typeof d !== 'object') return false
  const m = (d as { markers?: unknown[] }).markers
  const p = (d as { path?: unknown[] }).path
  return (Array.isArray(m) && m.length > 0) || (Array.isArray(p) && p.length > 0)
}

export async function importData(payload: DataPayload): Promise<void> {
  for (const item of payload.submissions || []) {
    if (isPathContinuation(item)) {
      const existing = await db.submissions
        .where('[competitionId+teamNumber+createdAt]')
        .equals([item.competitionId, item.teamNumber, item.createdAt])
        .first()
      if (existing) {
        const current = (existing as ScoutSubmission).autoPathData
        const path = Array.isArray(current?.path) ? current.path : []
        const merged: AutoPathData = {
          markers: Array.isArray(current?.markers) ? current.markers : [],
          path: [...path, ...item.pathDataAppend],
        }
        await db.submissions.update(existing.id, { autoPathData: merged })
      }
      continue
    }
    const sub = item as ScoutSubmission
    if (!sub.competitionId || !Number.isFinite(sub.teamNumber) || !sub.scoutName || !sub.createdAt) continue
    const existing = await db.submissions
      .where('[competitionId+teamNumber+createdAt]')
      .equals([sub.competitionId, sub.teamNumber, sub.createdAt])
      .first()
    if (existing) {
      if (hasPathData(sub) && (existing as ScoutSubmission).autoPathData !== sub.autoPathData) {
        await db.submissions.update(existing.id, { autoPathData: sub.autoPathData })
      }
      continue
    }
    const { id, ...rest } = sub as ScoutSubmission & { id?: number }
    await db.submissions.add(rest as ScoutSubmission)
  }
}
