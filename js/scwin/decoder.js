// Decodes an SC-WIN `.sc4` file (MFC `CArchive` container) into a
// platform-neutral IR: per-element PARAMETERS (type-signature records) +
// CONNECTIVITY (the MFC object stream, where each object writes its parent's
// store-map index). IR elements are plain objects tagged with `kind`.

import { CArchiveReader, SCWINParseError } from './carchive.js';

const NEW_CLASS_TAG = 0xffff;
const KNOWN_CLASSES = new Set(['CSupply', 'CCable', 'CTrans', 'CTriWinding', 'CMotor', 'CGenerator', 'CElement', 'CCapacitor']);
const ansi = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));
const isNumeric = (s) => s.length > 0 && /^[0-9]*\.?[0-9]+$/.test(s);
const trim = (s) => s.trim();

export function looksLikeSCWIN(bytes) {
  if (bytes.length < 16) return false;
  const head = ansi(bytes, 0, Math.min(256, bytes.length));
  return head.includes('CSupply') || head.includes('CCable') || head.includes('CTrans');
}

export function decode(bytes) {
  const r = new CArchiveReader(bytes);
  const headerWords = [r.readU16(), r.readU16(), r.readU16()];

  // Class names (scan FFFF defs up to the first record).
  const classNames = [];
  let p = r.offset;
  let recordsStart = r.offset;
  while (p < bytes.length) {
    if (CArchiveReader.peekU16(bytes, p) === NEW_CLASS_TAG) {
      const nameLen = CArchiveReader.peekU16(bytes, p + 4);
      if (nameLen !== null && nameLen >= 1 && nameLen <= 64 && p + 6 + nameLen <= bytes.length) {
        classNames.push(ansi(bytes, p + 6, p + 6 + nameLen));
        p += 6 + nameLen; recordsStart = p; continue;
      }
    }
    if (isRecordSignature(bytes, p)) break;
    p += 1;
  }
  if (!classNames.some((c) => KNOWN_CLASSES.has(c))) throw new SCWINParseError(`no recognized class names: ${classNames}`);

  const walk = walkObjectStream(bytes, 6);
  const objects = walk.objects;

  const hasDevices = classNames.includes('CElement');
  const hasCapacitor = classNames.includes('CCapacitor');
  const hasTriWinding = classNames.includes('CTriWinding');
  const elements = [];
  let o = recordsStart;
  let lastConsumed = recordsStart;
  while (o < bytes.length) {
    if (walk.objectBytes[o]) { o += 1; continue; }
    const decoded = tryDecodeRecord(r, bytes, o)
      || (hasTriWinding ? decodeTriWinding(r, bytes, o) : null)
      || (hasCapacitor ? decodeCapacitor(r, bytes, o) : null)
      || (hasDevices ? tryDecodeDevice(bytes, o) : null);
    if (decoded) { elements.push(decoded.element); lastConsumed = decoded.endOffset; o = decoded.endOffset; } else o += 1;
  }
  const supply = tryDecodeSupply(bytes, lastConsumed);
  if (supply) elements.push(supply);
  if (elements.length === 0) throw new SCWINParseError('no element records decoded');
  elements.sort((a, b) => a.recordOffset - b.recordOffset);

  const interleaved = objects.length !== elements.length || objects.some((ob) => !KNOWN_CLASSES.has(ob.className));

  const byKind = (k) => elements.filter((e) => e.kind === k);
  return {
    headerWords, classNames, elements, objects, objectStreamInterleaved: interleaved,
    supplies: byKind('supply'), cables: byKind('cable'), transformers: byKind('transformer'),
    threeWindings: byKind('threeWinding'), motors: byKind('motor'), generators: byKind('generator'),
    devices: byKind('device'), capacitors: byKind('capacitor'),
  };
}

// ── Object stream (connectivity) ──────────────────────────────────────
function walkObjectStream(bytes, startOffset) {
  const objs = [];
  const objectBytes = new Array(bytes.length).fill(false);
  const classByIndex = {};
  const objectIndices = new Set();
  let nextIdx = 1;
  let i = startOffset;
  const parentResolves = (parent) => parent === 0 || objectIndices.has(parent);
  const mark = (from, len) => { for (let k = from; k < Math.min(from + len, bytes.length); k++) objectBytes[k] = true; };
  while (i < bytes.length) {
    const t = CArchiveReader.peekU16(bytes, i);
    if (t === NEW_CLASS_TAG) {
      const nameLen = CArchiveReader.peekU16(bytes, i + 4);
      let name = null;
      if (nameLen !== null && nameLen >= 1 && nameLen <= 64 && i + 6 + nameLen + 2 <= bytes.length) name = ansi(bytes, i + 6, i + 6 + nameLen);
      const parent = nameLen !== null ? (CArchiveReader.peekU16(bytes, i + 6 + nameLen) ?? 0) : 0;
      if (name === null || !KNOWN_CLASSES.has(name) || !parentResolves(parent) || nameLen === null) { i += 1; continue; }
      classByIndex[nextIdx] = name; nextIdx += 1;
      const objIdx = nextIdx; nextIdx += 1;
      objectIndices.add(objIdx);
      objs.push({ index: objIdx, className: name, parentIndex: parent });
      mark(i, 6 + nameLen + 2);
      i += 6 + nameLen + 2;
    } else if (t !== null && (t & 0x8000) !== 0 && classByIndex[t & 0x7fff]) {
      const cls = classByIndex[t & 0x7fff];
      const parent = CArchiveReader.peekU16(bytes, i + 2) ?? 0;
      if (!parentResolves(parent)) { i += 1; continue; }
      const objIdx = nextIdx; nextIdx += 1;
      objectIndices.add(objIdx);
      objs.push({ index: objIdx, className: cls, parentIndex: parent });
      mark(i, 4);
      i += 4;
    } else {
      i += 1;
    }
  }
  return { objects: objs, objectBytes };
}

// ── Parameter records ─────────────────────────────────────────────────
const ok = (v) => Number.isFinite(v);

function isRecordSignature(bytes, o) {
  if (o + 3 >= bytes.length) return false;
  const bus = bytes[o]; if (!(bus >= 1 && bus <= 254)) return false;
  if (bytes[o + 1] !== 0x01) return false;
  const flag = bytes[o + 3]; if (!(flag === 0 || flag === 2)) return false;
  const type = bytes[o + 2]; return type >= 1 && type <= 4;
}

function tryDecodeRecord(r, bytes, o) {
  if (!isRecordSignature(bytes, o)) return null;
  const bus = bytes[o]; const flag = bytes[o + 3];
  switch (bytes[o + 2]) {
    case 1: return decodeCable(r, o, bus);
    case 2: return decodeMotor(r, o, bus);
    case 3: return decodeTransformer(r, o, bus);
    case 4: return decodeGenerator(r, o, bus, flag === 0);
    default: return null;
  }
}

function decodeCable(r, o, bus) {
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const size = r.readCString();
    const len = r.readF32(); const temp = r.readF32();
    const t2 = r.readF32(); const six = r.readF32(); const zero = r.readF32();
    if (!(ok(len) && len > 0 && len <= 1_000_000 && ok(temp) && size.length > 0)) return null;
    const afterFloats = r.offset;
    let kvClassCode = 0;
    let b1; let b2;
    try { b1 = r.readU8(); b2 = r.readU8(); } catch { b1 = b2 = -1; }
    if (b1 === 0x01 && b2 === 0x1e) { try { kvClassCode = r.readU8(); } catch { kvClassCode = 0; } } else { r.seek(afterFloats); }
    return { element: { kind: 'cable', busNumber: bus, recordOffset: o, lengthFeet: len, operatingTempC: temp, sizeString: trim(size), depthLevel, kvClassCode, rawFloats: [len, temp, t2, six, zero] }, endOffset: r.offset };
  } catch { return null; }
}

function decodeTransformer(r, o, bus) {
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const pctZ = r.readF32(); const f2 = r.readF32(); const kva = r.readF32();
    const f4 = r.readF32(); const f5 = r.readF32();
    const secKv = r.readCString();
    if (!(ok(kva) && kva > 0 && kva <= 1e9 && ok(pctZ) && pctZ > 0 && pctZ <= 100 && secKv.length > 0)) return null;
    return { element: { kind: 'transformer', busNumber: bus, recordOffset: o, ratedKVA: kva, percentImpedance: pctZ, secondaryKvString: trim(secKv), depthLevel, rawFloats: [pctZ, f2, kva, f4, f5] }, endOffset: r.offset };
  } catch { return null; }
}

function decodeTriWinding(r, bytes, o) {
  if (o + 3 >= bytes.length) return null;
  const bus = bytes[o]; if (!(bus >= 1 && bus <= 254)) return null;
  if (bytes[o + 1] !== 0x01) return null;
  const type = bytes[o + 2]; if (!(type === 5 || type === 6)) return null;
  if (bytes[o + 3] !== 0x00) return null;
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const xHX = r.readF32(); const xHY = r.readF32(); const xXY = r.readF32();
    const rHX = r.readF32(); const rHY = r.readF32(); const rXY = r.readF32();
    const secKv = trim(r.readCString());
    const terKv = trim(r.readCString());
    const secKVA = r.readF32(); const terKVA = r.readF32();
    if (!(ok(secKVA) && secKVA > 0 && secKVA <= 1e9 && ok(terKVA) && terKVA > 0 && terKVA <= 1e9 &&
      isNumeric(secKv) && isNumeric(terKv) && [xHX, xHY, xXY, rHX, rHY, rXY].every((v) => ok(v) && v >= 0))) return null;
    return { element: { kind: 'threeWinding', busNumber: bus, recordOffset: o, secondaryKVA: secKVA, tertiaryKVA: terKVA, secondaryKvString: secKv, tertiaryKvString: terKv, reactanceHXPrimaryOhms: xHX, reactanceHYPrimaryOhms: xHY, reactanceXYPrimaryOhms: xXY, resistanceHXPrimaryOhms: rHX, resistanceHYPrimaryOhms: rHY, resistanceXYPrimaryOhms: rXY, typeCode: type, depthLevel, rawFloats: [xHX, xHY, xXY, rHX, rHY, rXY] }, endOffset: r.offset };
  } catch { return null; }
}

function decodeMotor(r, o, bus) {
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const hp = r.readF32(); const f2 = r.readF32();
    if (!(ok(hp) && hp > 0 && hp <= 1e7)) return null;
    return { element: { kind: 'motor', busNumber: bus, recordOffset: o, ratedHP: hp, depthLevel, rawFloats: [hp, f2] }, endOffset: r.offset };
  } catch { return null; }
}

function tryDecodeDevice(bytes, o) {
  if (o + 3 >= bytes.length) return null;
  const bus = bytes[o]; if (!(bus >= 1 && bus <= 254)) return null;
  const code = bytes[o + 1]; if (!(code >= 0x0a && code <= 0x0d)) return null;
  if (bytes[o + 2] !== 0x00) return null;
  const depthLevel = bytes[o + 3];
  return { element: { kind: 'device', busNumber: bus, recordOffset: o, deviceCode: code, depthLevel }, endOffset: o + 4 };
}

function decodeCapacitor(r, bytes, o) {
  if (o + 3 >= bytes.length) return null;
  const bus = bytes[o]; if (!(bus >= 1 && bus <= 254)) return null;
  if (bytes[o + 1] !== 0x01 || bytes[o + 2] !== 0x08) return null;
  const flag = bytes[o + 3]; if (!(flag === 0 || flag === 2)) return null;
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const kvar = r.readF32();
    if (!(ok(kvar) && kvar > 0 && kvar <= 1e7)) return null;
    return { element: { kind: 'capacitor', busNumber: bus, recordOffset: o, ratedKVAR: kvar, depthLevel }, endOffset: r.offset };
  } catch { return null; }
}

function decodeGenerator(r, o, bus, connected) {
  try {
    r.seek(o); r.skip(4);
    const depthLevel = r.readU8(); r.skip(5);
    const kva = r.readF32();
    const typeCode = r.readU8();
    if (!(ok(kva) && kva > 0 && kva <= 1e9)) return null;
    return { element: { kind: 'generator', busNumber: bus, recordOffset: o, ratedKVA: kva, typeCode, connected, depthLevel, rawFloats: [kva] }, endOffset: r.offset };
  } catch { return null; }
}

function tryDecodeSupply(bytes, fromOffset) {
  let lenPos = fromOffset;
  while (lenPos < bytes.length) {
    const len = bytes[lenPos];
    if (len >= 1 && len <= 10 && lenPos + 1 + len <= bytes.length && lenPos - 8 >= 0) {
      let candidate = null;
      try { const probe = new CArchiveReader(bytes); probe.seek(lenPos); candidate = probe.readCString(); } catch { candidate = null; }
      if (candidate !== null && isNumeric(trim(candidate))) {
        let mva = null; let xr = null;
        try { const fp = new CArchiveReader(bytes); fp.seek(lenPos - 8); mva = fp.readF32(); } catch { mva = null; }
        try { const fp2 = new CArchiveReader(bytes); fp2.seek(lenPos - 4); xr = fp2.readF32(); } catch { xr = null; }
        if (mva !== null && xr !== null && ok(mva) && mva > 0 && ok(xr) && xr > 0) {
          const flagByte = (lenPos - 15 >= 0) ? bytes[lenPos - 15] : 0;
          return { kind: 'supply', busNumber: 0, recordOffset: Math.max(fromOffset, lenPos - 17), availableMVA: mva, xOverR: xr, kvString: trim(candidate), connected: flagByte === 0, rawFloats: [mva, xr] };
        }
      }
    }
    lenPos += 1;
  }
  return null;
}
