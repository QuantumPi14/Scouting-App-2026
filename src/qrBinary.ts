/**
 * Minimal binary writer for QR v2 payloads.
 *
 * Internally grows a Uint8Array buffer and exposes the written slice via toUint8Array().
 * Supports fixed-width unsigned ints, simple varuint, and bit-packing helpers.
 */
export class BinaryWriter {
  private buffer: Uint8Array
  private view: DataView
  private offset = 0
  private bitBuffer = 0
  private bitCount = 0

  constructor(initialSize = 256) {
    this.buffer = new Uint8Array(initialSize)
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength)
  }

  private ensureCapacity(extra: number) {
    const needed = this.offset + extra
    if (needed <= this.buffer.length) return
    let nextLength = this.buffer.length * 2
    while (nextLength < needed) nextLength *= 2
    const next = new Uint8Array(nextLength)
    next.set(this.buffer)
    this.buffer = next
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength)
  }

  private flushBits() {
    if (this.bitCount === 0) return
    this.writeUint8(this.bitBuffer & 0xff)
    this.bitBuffer = 0
    this.bitCount = 0
  }

  writeUint8(value: number) {
    this.ensureCapacity(1)
    this.view.setUint8(this.offset, value & 0xff)
    this.offset += 1
  }

  writeUint16(value: number) {
    this.ensureCapacity(2)
    this.view.setUint16(this.offset, value & 0xffff, true)
    this.offset += 2
  }

  writeUint32(value: number) {
    this.ensureCapacity(4)
    this.view.setUint32(this.offset, value >>> 0, true)
    this.offset += 4
  }

  /**
   * Unsigned varint (base-128) encoding for non-negative integers.
   * Suitable for counts/indices that are usually small.
   */
  writeVarUint(value: number) {
    let v = value >>> 0
    while (v >= 0x80) {
      this.writeUint8((v & 0x7f) | 0x80)
      v >>>= 7
    }
    this.writeUint8(v)
  }

  /**
   * Queue bits to be packed into the next byte(s). Call flushBits()
   * before writing any non-bit-packed fields.
   */
  writeBits(value: number, bitCount: number) {
    let v = value
    let bits = bitCount
    while (bits > 0) {
      const free = 8 - this.bitCount
      const take = Math.min(free, bits)
      const mask = (1 << take) - 1
      this.bitBuffer |= (v & mask) << this.bitCount
      this.bitCount += take
      v >>>= take
      bits -= take
      if (this.bitCount === 8) this.flushBits()
    }
  }

  /** Finish any pending bit-packing and return the written bytes. */
  toUint8Array(): Uint8Array {
    this.flushBits()
    return this.buffer.subarray(0, this.offset)
  }
}

/**
 * Minimal binary reader matching BinaryWriter.
 *
 * Tracks a current offset and supports fixed-width ints, varuint, and bit-unpacking.
 */
export class BinaryReader {
  private view: DataView
  private offset = 0
  private bitBuffer = 0
  private bitCount = 0

  constructor(private readonly buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }

  eof(): boolean {
    return this.offset >= this.buffer.length && this.bitCount === 0
  }

  readUint8(): number {
    if (this.offset >= this.buffer.length) throw new Error('BinaryReader: out of bounds')
    const v = this.view.getUint8(this.offset)
    this.offset += 1
    return v
  }

  readUint16(): number {
    if (this.offset + 2 > this.buffer.length) throw new Error('BinaryReader: out of bounds')
    const v = this.view.getUint16(this.offset, true)
    this.offset += 2
    return v
  }

  readUint32(): number {
    if (this.offset + 4 > this.buffer.length) throw new Error('BinaryReader: out of bounds')
    const v = this.view.getUint32(this.offset, true)
    this.offset += 4
    return v
  }

  readVarUint(): number {
    let shift = 0
    let result = 0
    // Limit to 5 bytes for 32-bit values.
    for (let i = 0; i < 5; i++) {
      const byte = this.readUint8()
      result |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) return result >>> 0
      shift += 7
    }
    throw new Error('BinaryReader: varuint too long')
  }

  private refillBits() {
    if (this.bitCount >= 8 || this.offset >= this.buffer.length) return
    const byte = this.readUint8()
    this.bitBuffer |= byte << this.bitCount
    this.bitCount += 8
  }

  readBits(bitCount: number): number {
    let bitsNeeded = bitCount
    let result = 0
    let resultShift = 0
    while (bitsNeeded > 0) {
      if (this.bitCount === 0) this.refillBits()
      if (this.bitCount === 0) throw new Error('BinaryReader: no more bits')
      const take = Math.min(this.bitCount, bitsNeeded)
      const mask = (1 << take) - 1
      const value = this.bitBuffer & mask
      result |= value << resultShift
      this.bitBuffer >>>= take
      this.bitCount -= take
      bitsNeeded -= take
      resultShift += take
    }
    return result
  }
}

