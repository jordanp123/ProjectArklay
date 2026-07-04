// Little-endian byte cursor for MFC `CArchive`-serialized data — the container
// format SC-WIN's `.sc4` files use. Only the primitives SC-WIN needs (u8/u16/
// u32, IEEE-754 float32, the MFC CString length-prefixed encoding). Every read
// is bounds-checked and throws rather than trapping.

export class SCWINParseError extends Error {}

const _f32 = new DataView(new ArrayBuffer(4));
function float32FromBits(bits) { _f32.setUint32(0, bits >>> 0); return _f32.getFloat32(0); }
function decodeAnsi(bytes) { return String.fromCharCode(...bytes); } // Latin-1 / CP1252 (ASCII for our fields)
function decodeUnicode(bytes) {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  return s;
}

export class CArchiveReader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; }
  get remaining() { return this.bytes.length - this.offset; }
  _require(n) { if (this.remaining < n) throw new SCWINParseError(`EOF at ${this.offset}, need ${n}, had ${this.remaining}`); }

  readU8() { this._require(1); return this.bytes[this.offset++]; }
  readU16() { this._require(2); const lo = this.bytes[this.offset]; const hi = this.bytes[this.offset + 1]; this.offset += 2; return lo | (hi << 8); }
  readU32() { this._require(4); let v = 0; for (let i = 0; i < 4; i++) v |= this.bytes[this.offset + i] << (8 * i); this.offset += 4; return v >>> 0; }
  readF32() { return float32FromBits(this.readU32()); }
  readBytes(n) { this._require(n); const s = this.bytes.slice(this.offset, this.offset + n); this.offset += n; return s; }
  skip(n) { this._require(n); this.offset += n; }
  seek(a) { if (a < 0 || a > this.bytes.length) throw new SCWINParseError(`seek out of bounds: ${a}`); this.offset = a; }

  /** MFC CString: length prefix (escape ladder) then chars. ANSI → CP1252,
   *  the 0xFFFE marker → UTF-16LE. */
  readCString() {
    const first = this.readU8();
    if (first < 0xFF) return decodeAnsi(this.readBytes(first));
    const word = this.readU16();
    if (word === 0xFFFE) { const cc = this._readUnicodeLen(); return decodeUnicode(this.readBytes(cc * 2)); }
    if (word < 0xFFFF) return decodeAnsi(this.readBytes(word));
    return decodeAnsi(this.readBytes(this.readU32()));
  }
  _readUnicodeLen() { const first = this.readU8(); if (first < 0xFF) return first; const word = this.readU16(); if (word < 0xFFFF) return word; return this.readU32(); }

  static peekU16(bytes, off) { return (off + 1 < bytes.length) ? (bytes[off] | (bytes[off + 1] << 8)) : null; }
}
