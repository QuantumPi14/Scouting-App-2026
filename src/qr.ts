import QRCode from 'qrcode'
import { encode as cborEncode, decode as cborDecode } from 'cbor-x'
import { db } from './db'
import type {
  AutoPathData,
  Competition,
  ScoutSubmission,
  QrV2DataEnvelope,
  QrV2Header,
  QrV2SubmissionRecord,
} from './types'

const QR_VERSION = 2
/** Max bytes per config QR. Single comp with many teams is split across multiple QRs. */
const CONFIG_MAX_QR_BYTES = 900
/** Reserve for payload wrapper (v, type, exportedAt, part, totalParts) so we know how much room is left for competitions[]. */
const CONFIG_WRAPPER_BYTES = 100
/**
 * Target max bytes per data QR.
 * Lower value = faster scan / decode but potentially more parts.
 * v2 compact payload should significantly reduce per-submission size.
 */
const DATA_MAX_QR_BYTES = 1000
const DATA_QR_OPTIONS = { margin: 2, width: 360, errorCorrectionLevel: 'L' as const }

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  // Node fallback (mainly for build-time)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const buf: Buffer = Buffer.from(bytes)
  return buf.toString('base64')
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  // Node fallback (mainly for build-time)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const buf: Buffer = Buffer.from(b64, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

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

export interface DataPayload {
  v: number
  type: 'data'
  competitionId?: string
  submissions: ScoutSubmission[]
  exportedAt: number
  /** When chunked: 1-based part index (e.g. 1 of 4) */
  part?: number
  totalParts?: number
}

export type AnyQRPayload = ConfigPayload | DataPayload | QrV2DataEnvelope

const DRIVETRAIN_ENUM: (ScoutSubmission['drivetrain'])[] = ['swerve drive', 'tank drive', 'other']
const CLIMB_ENUM: (ScoutSubmission['climb'])[] = ['L1', 'L2', 'L3', "can't climb"]
const INTAKE_TYPE_ENUM: (ScoutSubmission['intakeType'])[] = ['one at a time', 'multiple']
const RELIABILITY_ENUM: (ScoutSubmission['climbReliability'])[] = ['unreliable', 'semi-reliable', 'reliable']
const MOVE_WHILE_ENUM: (ScoutSubmission['moveWhileShooting'])[] = ['yes', 'kinda', 'no']

function enumIndex<T extends string | undefined>(value: T, values: (T | undefined)[]): number | undefined {
  if (value == null) return undefined
  const idx = values.indexOf(value)
  return idx >= 0 ? idx : undefined
}

function fromEnumIndex<T extends string | undefined>(idx: number | undefined, values: (T | undefined)[]): T | undefined {
  if (idx == null || idx < 0 || idx >= values.length) return undefined
  return values[idx]
}

function buildV2Header(submissions: ScoutSubmission[], competitionId?: string): QrV2Header {
  const scoutSet = new Set<string>()
  for (const s of submissions) {
    const name = (s.scoutName ?? '').trim()
    if (name) scoutSet.add(name)
  }
  const scoutNames = Array.from(scoutSet)
  return {
    competitionId,
    competitionName: undefined,
    scoutNames,
  }
}

function toV2Records(header: QrV2Header, submissions: ScoutSubmission[]): QrV2SubmissionRecord[] {
  const scoutIndex = new Map<string, number>()
  header.scoutNames.forEach((name, idx) => scoutIndex.set(name, idx))
  return submissions.map((s): QrV2SubmissionRecord => {
    const name = (s.scoutName ?? '').trim()
    const sIdx = scoutIndex.has(name) ? scoutIndex.get(name)! : -1
    const rec: QrV2SubmissionRecord = {
      t: s.teamNumber,
      s: sIdx >= 0 ? sIdx : 0,
      c: s.createdAt!,
    }
    if (s.matchNumber != null) rec.mn = s.matchNumber

    // Pit
    rec.dt = enumIndex(s.drivetrain, DRIVETRAIN_ENUM)
    if (s.trench != null) rec.tr = s.trench
    if (s.turret != null) rec.tu = s.turret
    rec.cl = enumIndex(s.climb, CLIMB_ENUM)
    if (s.climbSides && s.climbSides.length > 0) rec.cs = s.climbSides
    if (s.climbTime != null) rec.ct = s.climbTime
    rec.it = enumIndex(s.intakeType, INTAKE_TYPE_ENUM)

    // Game
    const avgFromPeriodArray = (arr?: (number | null)[], fallback?: number | null): number | undefined => {
      if (Array.isArray(arr) && arr.length > 0) {
        const nums = arr.filter((v): v is number => typeof v === 'number')
        if (nums.length > 0) return nums.reduce((a, b) => a + b, 0) / nums.length
      }
      if (typeof fallback === 'number') return fallback
      return undefined
    }
    const apAvg = avgFromPeriodArray(s.ptsPerActivePeriod, s.avgPtsPerActivePeriod ?? null)
    const ahAvg = avgFromPeriodArray(s.humanPlayerPtsPerActivePeriod, s.avgHumanPlayerPtsPerActivePeriod ?? null)
    if (apAvg != null) rec.ap = apAvg
    if (ahAvg != null) rec.ah = ahAvg
    if (s.hubPtsAuto != null) rec.ha = s.hubPtsAuto
    if (s.climbAuto != null) rec.ca = s.climbAuto
    rec.cr = enumIndex(s.climbReliability, RELIABILITY_ENUM)
    rec.ir = enumIndex(s.intakeReliability, RELIABILITY_ENUM)
    rec.mvs = enumIndex(s.moveWhileShooting, MOVE_WHILE_ENUM)
    if (s.pickUpWhileShooting != null) rec.pus = s.pickUpWhileShooting
    if (s.shotAccuracyPercent != null) rec.sap = s.shotAccuracyPercent
    if (s.malfunction != null) rec.mf = s.malfunction

    if (s.notes && s.notes.trim().length > 0) rec.nt = s.notes.trim()
    if (s.autoPathData && Array.isArray(s.autoPathData.markers) && s.autoPathData.markers.length > 0) {
      rec.apd = roundMarkerCoords(s.autoPathData)
    }
    return rec
  })
}

function fromV2Records(
  envelopes: QrV2DataEnvelope[],
  sharedHeader?: QrV2Header
): ScoutSubmission[] {
  const out: ScoutSubmission[] = []
  for (const env of envelopes) {
    const header = env.header ?? sharedHeader
    if (!header) continue
    const compId = env.competitionId || header.competitionId || ''
    const scouts = header.scoutNames || []
    for (const r of env.records || []) {
      const scoutName = scouts[r.s] ?? ''
      const sub: ScoutSubmission = {
        competitionId: compId,
        teamNumber: r.t,
        scoutName,
        createdAt: r.c,
      }
      if (r.mn != null) sub.matchNumber = r.mn

      // Pit
      sub.drivetrain = fromEnumIndex(r.dt, DRIVETRAIN_ENUM)
      if (r.tr != null) sub.trench = r.tr
      if (r.tu != null) sub.turret = r.tu
      sub.climb = fromEnumIndex(r.cl, CLIMB_ENUM)
      if (r.cs && r.cs.length > 0) sub.climbSides = r.cs
      if (r.ct != null) sub.climbTime = r.ct
      sub.intakeType = fromEnumIndex(r.it, INTAKE_TYPE_ENUM)

      // Game
      if (r.ap != null) sub.avgPtsPerActivePeriod = r.ap
      if (r.ah != null) sub.avgHumanPlayerPtsPerActivePeriod = r.ah
      if (r.ha != null) sub.hubPtsAuto = r.ha
      if (r.ca != null) sub.climbAuto = r.ca
      sub.climbReliability = fromEnumIndex(r.cr, RELIABILITY_ENUM)
      sub.intakeReliability = fromEnumIndex(r.ir, RELIABILITY_ENUM)
      sub.moveWhileShooting = fromEnumIndex(r.mvs, MOVE_WHILE_ENUM)
      if (r.pus != null) sub.pickUpWhileShooting = r.pus
      if (r.sap != null) sub.shotAccuracyPercent = r.sap
      if (r.mf != null) sub.malfunction = r.mf

      if (r.nt && r.nt.trim().length > 0) sub.notes = r.nt.trim()
      if (r.apd && Array.isArray(r.apd.markers) && r.apd.markers.length > 0) {
        sub.autoPathData = r.apd
      }
      out.push(sub)
    }
  }
  return out
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

export type ExportDataMode = 'full' | 'scouting' | 'autopath'

/** Round marker coords to 3 decimals for smaller payloads. */
function roundMarkerCoords(data: AutoPathData): AutoPathData {
  const markers = (data.markers ?? []).map((m) => ({
    ...m,
    x: Math.round(m.x * 1000) / 1000,
    y: Math.round(m.y * 1000) / 1000,
  }))
  return { markers }
}

/** Strip large fields for QR. full: drop image keep path; scouting: drop image and path; autopath: minimal item with only path. */
function submissionsForQR(submissions: ScoutSubmission[], mode: ExportDataMode): ScoutSubmission[] {
  if (mode === 'scouting') {
    return submissions.map(({ autoPathImageData: _1, autoPathData: _2, ...rest }) => ({ ...rest }))
  }
  if (mode === 'autopath') {
    return submissions
      .filter((s) => s.autoPathData && Array.isArray(s.autoPathData.markers) && s.autoPathData.markers.length > 0)
      .map((s) => ({
        competitionId: s.competitionId,
        teamNumber: s.teamNumber,
        scoutName: s.scoutName,
        createdAt: s.createdAt!,
        autoPathData: roundMarkerCoords(s.autoPathData!),
      })) as ScoutSubmission[]
  }
  return submissions.map((s) => {
    const { autoPathImageData: _, ...rest } = s
    if (s.autoPathData) {
      return { ...rest, autoPathData: roundMarkerCoords(s.autoPathData) }
    }
    return rest as ScoutSubmission
  })
}

export interface ExportDataOptions {
  /** If provided, only export submissions for these team numbers (within the competition). */
  teamNumbers?: number[]
  /** Optional filter: only submissions from these scout names. */
  scoutNames?: string[]
  /**
   * Optional filter: only specific submissions identified by (competitionId, teamNumber, createdAt).
   * Used for \"single submission\" export from QRCreatePage.
   */
  submissionKeys?: { competitionId: string; teamNumber: number; createdAt: number }[]
  /** full = scouting + path coords (default); scouting = form data only; autopath = path data only. */
  mode?: ExportDataMode
}

export async function exportDataFile(
  competitionId?: string,
  options?: ExportDataOptions
): Promise<Blob> {
  let submissions: ScoutSubmission[]
  if (competitionId) {
    submissions = await db.submissions.where('competitionId').equals(competitionId).toArray() as ScoutSubmission[]
  } else {
    submissions = await db.submissions.toArray() as ScoutSubmission[]
  }
  const teamNumbers = options?.teamNumbers
  if (teamNumbers != null && teamNumbers.length > 0) {
    const set = new Set(teamNumbers)
    submissions = submissions.filter((s) => set.has(s.teamNumber))
  }
  const scoutNames = options?.scoutNames
  if (scoutNames != null && scoutNames.length > 0) {
    const set = new Set(scoutNames.map((n) => n.trim().toLowerCase()).filter(Boolean))
    submissions = submissions.filter((s) => set.has((s.scoutName ?? '').trim().toLowerCase()))
  }
  const submissionKeys = options?.submissionKeys
  if (submissionKeys != null && submissionKeys.length > 0) {
    const keySet = new Set(
      submissionKeys.map((k) => `${k.competitionId}|${k.teamNumber}|${k.createdAt}`)
    )
    submissions = submissions.filter((s) => keySet.has(`${s.competitionId}|${s.teamNumber}|${s.createdAt}`))
  }
  const mode = options?.mode ?? 'full'
  const forFile = submissionsForQR(submissions, mode)
  const exportedAt = Date.now()
  const payload: DataPayload = {
    v: QR_VERSION,
    type: 'data',
    competitionId,
    submissions: forFile,
    exportedAt,
  }
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
}

export async function exportDataQR(competitionId?: string, options?: ExportDataOptions): Promise<string[]> {
  let submissions: ScoutSubmission[]
  if (competitionId) {
    submissions = await db.submissions.where('competitionId').equals(competitionId).toArray() as ScoutSubmission[]
  } else {
    submissions = await db.submissions.toArray() as ScoutSubmission[]
  }
  const teamNumbers = options?.teamNumbers
  if (teamNumbers != null && teamNumbers.length > 0) {
    const set = new Set(teamNumbers)
    submissions = submissions.filter((s) => set.has(s.teamNumber))
  }
  const scoutNames = options?.scoutNames
  if (scoutNames != null && scoutNames.length > 0) {
    const set = new Set(scoutNames.map((n) => n.trim().toLowerCase()).filter(Boolean))
    submissions = submissions.filter((s) => set.has((s.scoutName ?? '').trim().toLowerCase()))
  }
  const submissionKeys = options?.submissionKeys
  if (submissionKeys != null && submissionKeys.length > 0) {
    const keySet = new Set(
      submissionKeys.map((k) => `${k.competitionId}|${k.teamNumber}|${k.createdAt}`)
    )
    submissions = submissions.filter((s) => keySet.has(`${s.competitionId}|${s.teamNumber}|${s.createdAt}`))
  }
  const mode = options?.mode ?? 'full'
  const forQR = submissionsForQR(submissions, mode)
  const exportedAt = Date.now()
  const header = buildV2Header(forQR, competitionId)
  const records = toV2Records(header, forQR)
  const baseEnv: Omit<QrV2DataEnvelope, 'records' | 'part' | 'totalParts'> = {
    v: QR_VERSION,
    type: 'data-v2',
    competitionId,
    exportedAt,
    header,
  }

  // Chunk by size using compact v2 records encoded as CBOR + base64 inside a small JSON wrapper.
  const chunks: QrV2SubmissionRecord[][] = []
  let start = 0
  while (start < records.length) {
    let end = start
    while (end < records.length) {
      const next = records.slice(start, end + 1)
      const env: QrV2DataEnvelope = {
        ...baseEnv,
        records: next,
      }
      const bytes = cborEncode(env) as Uint8Array
      const payload = bytesToBase64(bytes)
      const wrapper = {
        v: QR_VERSION,
        type: 'data-v2',
        competitionId,
        exportedAt,
        payload,
        // provisional values to approximate final size
        part: 1,
        totalParts: 1,
      }
      const size = new Blob([JSON.stringify(wrapper)]).size
      if (size > DATA_MAX_QR_BYTES && end > start) break
      end += 1
    }
    const chunk = records.slice(start, end)
    chunks.push(chunk)
    start = end
  }

  if (chunks.length === 0) {
    const env: QrV2DataEnvelope = { ...baseEnv, records: [] }
    const bytes = cborEncode(env) as Uint8Array
    const payload = bytesToBase64(bytes)
    const wrapper = {
      v: QR_VERSION,
      type: 'data-v2',
      competitionId,
      exportedAt,
      payload,
      part: 1,
      totalParts: 1,
    }
    const str = JSON.stringify(wrapper)
    const url = await QRCode.toDataURL(str, DATA_QR_OPTIONS)
    return [url]
  }

  const totalParts = chunks.length
  const urls: string[] = []
  for (let i = 0; i < chunks.length; i += 1) {
    const isFirst = i === 0
    const env: QrV2DataEnvelope = isFirst
      ? {
          ...baseEnv,
          records: chunks[i],
          part: i + 1,
          totalParts,
        }
      : {
          v: QR_VERSION,
          type: 'data-v2',
          competitionId,
          exportedAt,
          // header intentionally omitted on subsequent chunks; scanner will reuse header from first chunk.
          records: chunks[i],
          part: i + 1,
          totalParts,
        }
    const bytes = cborEncode(env) as Uint8Array
    const payload = bytesToBase64(bytes)
    const wrapper = {
      v: QR_VERSION,
      type: 'data-v2',
      competitionId,
      exportedAt,
      payload,
      part: i + 1,
      totalParts,
    }
    const str = JSON.stringify(wrapper)
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
    const numVersion = typeof data?.v === 'number' ? data.v : Number(data?.v)
    const versionOk = numVersion === 1 || numVersion === 2
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

function hasPathData(sub: { autoPathData?: unknown }): boolean {
  const d = sub.autoPathData
  if (!d || typeof d !== 'object') return false
  const m = (d as { markers?: unknown[] }).markers
  return Array.isArray(m) && m.length > 0
}

export async function importData(payload: DataPayload): Promise<void> {
  for (const sub of payload.submissions || []) {
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

export async function importDataV2(envelopes: QrV2DataEnvelope[]): Promise<void> {
  const sharedHeader = envelopes.find((e) => e.header)?.header
  const submissions = fromV2Records(envelopes, sharedHeader)
  if (submissions.length === 0) return
  const payload: DataPayload = {
    v: QR_VERSION,
    type: 'data',
    competitionId: submissions[0]?.competitionId,
    submissions,
    exportedAt: envelopes[0]?.exportedAt ?? Date.now(),
  }
  await importData(payload)
}

export function parseAnyQRPayload(json: string): AnyQRPayload | null {
  try {
    const raw = typeof json === 'string' ? json.trim() : ''
    if (!raw) return null
    const data = JSON.parse(raw)
    const typeStr = data?.type != null ? String(data.type).toLowerCase() : ''
    if (typeStr === 'data-v2') {
      const numVersion = typeof data?.v === 'number' ? data.v : Number(data?.v)
      if (numVersion !== 2) return null
      // New format: CBOR-encoded envelope stored in base64 `payload`.
      if (typeof data.payload === 'string') {
        const bytes = base64ToBytes(data.payload)
        const decoded = cborDecode(bytes) as QrV2DataEnvelope
        const part = typeof data.part === 'number' ? data.part : decoded.part
        const totalParts = typeof data.totalParts === 'number' ? data.totalParts : decoded.totalParts
        return {
          ...decoded,
          ...(part != null && { part }),
          ...(totalParts != null && { totalParts }),
        }
      }
      // Legacy JSON v2 fallback (header + records present directly in JSON).
      const header: QrV2Header = {
        competitionId: typeof data.header?.competitionId === 'string' ? data.header.competitionId : undefined,
        competitionName: typeof data.header?.competitionName === 'string' ? data.header.competitionName : undefined,
        scoutNames: Array.isArray(data.header?.scoutNames) ? data.header.scoutNames : [],
      }
      const records: QrV2SubmissionRecord[] = Array.isArray(data.records) ? data.records : []
      const part = typeof data.part === 'number' ? data.part : undefined
      const totalParts = typeof data.totalParts === 'number' ? data.totalParts : undefined
      return {
        v: 2,
        type: 'data-v2',
        competitionId: typeof data.competitionId === 'string' ? data.competitionId : undefined,
        exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
        header,
        records,
        ...(part != null && { part }),
        ...(totalParts != null && { totalParts }),
      }
    }
    return parseQRPayload(raw)
  } catch {
    return null
  }
}
