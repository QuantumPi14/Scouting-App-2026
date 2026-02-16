import QRCode from 'qrcode'
import { db } from './db'
import type { Competition, ScoutSubmission } from './types'

const QR_VERSION = 1
const MAX_QR_BYTES = 2000

export interface ConfigPayload {
  v: number
  type: 'config'
  competitions: Competition[]
  exportedAt: number
}

export interface DataPayload {
  v: number
  type: 'data'
  competitionId?: string
  submissions: ScoutSubmission[]
  exportedAt: number
}

export async function exportConfigQR(): Promise<string> {
  const competitions = await db.competitions.toArray()
  const payload: ConfigPayload = {
    v: QR_VERSION,
    type: 'config',
    competitions,
    exportedAt: Date.now(),
  }
  const json = JSON.stringify(payload)
  return QRCode.toDataURL(json, { margin: 1, width: 280 })
}

/** Strip large fields so payload fits in QR codes (max ~3KB). Auto path images are excluded. */
function submissionsForQR(submissions: ScoutSubmission[]): ScoutSubmission[] {
  return submissions.map(({ autoPathImageData: _, ...rest }) => ({ ...rest }))
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
  if (totalBytes <= MAX_QR_BYTES) {
    const url = await QRCode.toDataURL(json, { margin: 1, width: 320 })
    return [url]
  }
  // Chunk by size so each QR payload stays under the limit
  const urls: string[] = []
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
        exportedAt: Date.now(),
      }
      const nextStr = JSON.stringify(nextPayload)
      if (new Blob([nextStr]).size > MAX_QR_BYTES && end > start) break
      chunkJson = nextStr
      end += 1
    }
    if (!chunkJson && end === start) {
      end = start + 1
      const single: DataPayload = {
        v: QR_VERSION,
        type: 'data',
        competitionId,
        submissions: forQR.slice(start, end),
        exportedAt: Date.now(),
      }
      chunkJson = JSON.stringify(single)
    }
    const url = await QRCode.toDataURL(chunkJson, { margin: 1, width: 320 })
    urls.push(url)
    start = end
  }
  return urls
}

/** Parse and validate QR payload. Lenient: trims input, accepts v as number or string, normalizes shape. */
export function parseQRPayload(json: string): ConfigPayload | DataPayload | null {
  try {
    const raw = typeof json === 'string' ? json.trim() : ''
    if (!raw) return null
    const data = JSON.parse(raw)
    const v = data?.v
    const versionOk = v === QR_VERSION || v === '1'
    if (!versionOk || (data?.type !== 'config' && data?.type !== 'data')) return null
    if (data.type === 'config') {
      return {
        v: QR_VERSION,
        type: 'config',
        competitions: Array.isArray(data.competitions) ? data.competitions : [],
        exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
      }
    }
    return {
      v: QR_VERSION,
      type: 'data',
      competitionId: data.competitionId,
      submissions: Array.isArray(data.submissions) ? data.submissions : [],
      exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
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

export async function importData(payload: DataPayload): Promise<void> {
  for (const sub of payload.submissions || []) {
    if (!sub.competitionId || !Number.isFinite(sub.teamNumber) || !sub.scoutName || !sub.createdAt) continue
    const existing = await db.submissions
      .where('[competitionId+teamNumber+createdAt]')
      .equals([sub.competitionId, sub.teamNumber, sub.createdAt])
      .first()
    if (existing) continue
    const { id, ...rest } = sub as ScoutSubmission & { id?: number }
    await db.submissions.add(rest as ScoutSubmission)
  }
}
