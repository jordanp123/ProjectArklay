// `.scme` document format (v4) — read/write. A portable circuit snapshot with
// a SHA-512 integrity header, so a saved file re-opens with its contents
// verified.
//
// Schema (v4): { formatVersion:4, sourceVoltage, sourceMode, sourceMVA,
//   sourceXOverR, sourceKA, generatorType, generatorKVA,
//   generatorSubtransientReactancePU, generatorTransientReactancePU,
//   generatorSynchronousReactancePU, sourceBus }.
// Bus: { id, label, children:[Branch], motors:[Motor], capacitors:[Cap], breakers:[Breaker] }.
// Branch: { id, element, bus, tertiaryBus? }.  Element: { id, label, kindTag:"cable"|"transformer", cable?|transformer? }.
// A three-winding transformer is a "transformer" element whose spec has isThreeWinding:true.

import { newDocument, uid } from './model.js';
import { sha512Hex } from './engine/sha512.js';

export const CURRENT_FORMAT_VERSION = 4;
/** Integrity header prefix for the `.scme` envelope. */
export const INTEGRITY_PREFIX = 'SCME-SHA512:';

const SOURCE_MODE_TO_FILE = { availableKA: 'Available kA', availableMVA: 'Available MVA', infiniteBus: 'Infinite bus', generator: 'AC Generator' };
const FILE_TO_SOURCE_MODE = { 'Available kA': 'availableKA', 'Available MVA': 'availableMVA', 'Infinite bus': 'infiniteBus', 'AC Generator': 'generator' };
const MOTOR_TYPE_TO_FILE = { induction: 'Induction', synchronous: 'Synchronous', smallGroup: 'Small motor group', custom: 'Custom' };
const FILE_TO_MOTOR_TYPE = { Induction: 'induction', Synchronous: 'synchronous', 'Small motor group': 'smallGroup', Custom: 'custom' };

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // RFC-4122-style fallback for environments without crypto.randomUUID().
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Export (web doc → .scme snapshot object) ────────────────────────────
function exportElement(el) {
  const base = { id: uuid(), label: el.label || '' };
  if (el.kind === 'transformer3') {
    return {
      ...base, kindTag: 'transformer',
      transformer: {
        ratedKVA: n(el.ratedKVA), primaryVoltageLL: n(el.primaryV), secondaryVoltageLL: n(el.secondaryV),
        percentImpedance: n(el.zHX), xOverR: n(el.xrHX),
        isThreeWinding: true, tertiaryVoltageLL: n(el.tertiaryV), tertiaryKVA: n(el.tertiaryKVA),
        percentImpedanceHY: n(el.zHY), xOverRHY: n(el.xrHY), percentImpedanceXY: n(el.zXY), xOverRXY: n(el.xrXY),
      },
    };
  }
  if (el.kind === 'transformer') {
    return {
      ...base, kindTag: 'transformer',
      transformer: {
        ratedKVA: n(el.kva), primaryVoltageLL: n(el.primaryV), secondaryVoltageLL: n(el.secondaryV),
        percentImpedance: n(el.percentZ), xOverR: n(el.xOverR),
        isThreeWinding: false, tertiaryVoltageLL: 240, tertiaryKVA: n(el.kva),
        percentImpedanceHY: 5.75, xOverRHY: 5, percentImpedanceXY: 5.0, xOverRXY: 5,
      },
    };
  }
  return {
    ...base, kindTag: 'cable',
    cable: {
      lengthFeet: n(el.lengthFeet), resistancePerKFTAt25C: n(el.rPerKft), reactancePerKFT: n(el.xPerKft),
      maxOperatingTemperatureC: n(el.maxTempC, 90), conductorMaterial: el.material === 'aluminum' ? 'Aluminum' : 'Copper',
      parallelCount: Math.max(1, Math.round(n(el.parallel, 1))),
    },
  };
}

function exportMotor(m) {
  const out = {
    id: uuid(), label: m.label || 'Motor', ratedHP: n(m.ratedHP), ratedRPM: n(m.ratedRPM, 1800), ratedKVA: n(m.ratedKVA),
    motorType: MOTOR_TYPE_TO_FILE[m.motorType] || 'Induction',
    subtransientReactancePU: n(m.subtransientReactancePU, 0.167), powerFactor: n(m.powerFactor, 0.85), efficiency: n(m.efficiency, 0.92),
  };
  if (Number(m.lockedRotorAmps) > 0) out.lockedRotorAmps = Number(m.lockedRotorAmps); // omit when unset
  return out;
}
const exportCap = (c) => ({ id: uuid(), label: c.label || 'PFC bank', ratedKVAR: n(c.ratedKVAR) });
const exportBreaker = (b) => ({ id: uuid(), label: b.label || 'Breaker', instantaneousTripAmps: n(b.trip), tolerancePercent: n(b.tolPct, 25), isOpen: !!b.isOpen, ratingConfigured: true });

function exportBus(bus) {
  return {
    id: uuid(), label: bus.label || 'Bus',
    children: (bus.children || []).map((br) => {
      const out = { id: uuid(), element: exportElement(br.element), bus: exportBus(br.bus) };
      if (br.element.kind === 'transformer3' && br.tertiaryBus) out.tertiaryBus = exportBus(br.tertiaryBus);
      return out;
    }),
    motors: (bus.motors || []).map(exportMotor),
    capacitors: (bus.capacitors || []).map(exportCap),
    breakers: (bus.breakers || []).map(exportBreaker),
  };
}

/** Serialize a web document to a `.scme` snapshot object (JSON-ready). */
export function exportSCME(doc) {
  const s = doc.source;
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    sourceVoltage: n(s.voltage), sourceMode: SOURCE_MODE_TO_FILE[s.mode] || 'Available kA',
    sourceMVA: n(s.mva, 100), sourceXOverR: n(s.xOverR, 8), sourceKA: n(s.kA, 25),
    generatorType: s.genType || '2-Pole Turbine', generatorKVA: n(s.genKVA, 1000),
    generatorSubtransientReactancePU: n(s.genXdpp, 0.09), generatorTransientReactancePU: n(s.genXdp, 0.15),
    generatorSynchronousReactancePU: n(s.genXds, 0),
    sourceBus: exportBus(doc.sourceBus),
  };
}

// ── Import (.scme snapshot object → web doc) ─────────────────────────────
//
// SECURITY: ids are NEVER taken from the file — they're regenerated with
// session-local `uid()`. File ids are attacker-controlled strings that flow
// into DOM `data-*` attributes; a crafted id could break out of the attribute
// and inject markup. (The SHA-512 header doesn't help — a malicious file
// carries a valid hash of its own payload.) Nothing needs file ids: identity
// is session-only, and export mints fresh UUIDs anyway.
function importElement(el) {
  const id = uid();
  const label = String(el.label ?? '');
  if (el.kindTag === 'transformer') {
    const t = el.transformer || {};
    if (t.isThreeWinding) {
      return {
        id, kind: 'transformer3', label,
        ratedKVA: n(t.ratedKVA, 10000), tertiaryKVA: n(t.tertiaryKVA, n(t.ratedKVA, 10000)),
        primaryV: n(t.primaryVoltageLL), secondaryV: n(t.secondaryVoltageLL), tertiaryV: n(t.tertiaryVoltageLL, 240),
        zHX: n(t.percentImpedance, 5.75), xrHX: n(t.xOverR, 5),
        zHY: n(t.percentImpedanceHY, 5.75), xrHY: n(t.xOverRHY, 5),
        zXY: n(t.percentImpedanceXY, 5.0), xrXY: n(t.xOverRXY, 5),
      };
    }
    return {
      id, kind: 'transformer', label,
      kva: n(t.ratedKVA, 1000), primaryV: n(t.primaryVoltageLL), secondaryV: n(t.secondaryVoltageLL),
      percentZ: n(t.percentImpedance, 5.75), xOverR: n(t.xOverR, 5),
    };
  }
  const c = el.cable || {};
  return {
    id, kind: 'cable', label,
    lengthFeet: n(c.lengthFeet, 100), rPerKft: n(c.resistancePerKFTAt25C, 0.081), xPerKft: n(c.reactancePerKFT, 0.041),
    material: c.conductorMaterial === 'Aluminum' ? 'aluminum' : 'copper',
    maxTempC: n(c.maxOperatingTemperatureC, 90), parallel: Math.max(1, Math.round(n(c.parallelCount, 1))),
  };
}

function importMotor(m) {
  const out = {
    id: uid(), label: String(m.label ?? 'Motor'), ratedHP: n(m.ratedHP, 100), ratedRPM: n(m.ratedRPM, 1800),
    ratedKVA: n(m.ratedKVA, 0), motorType: FILE_TO_MOTOR_TYPE[m.motorType] || 'induction',
    subtransientReactancePU: n(m.subtransientReactancePU, 0.167), powerFactor: n(m.powerFactor, 0.85), efficiency: n(m.efficiency, 0.92),
    lockedRotorAmps: Number(m.lockedRotorAmps) > 0 ? Number(m.lockedRotorAmps) : null,
  };
  return out;
}
const importCap = (c) => ({ id: uid(), label: String(c.label ?? 'PFC bank'), ratedKVAR: n(c.ratedKVAR, 100) });
const importBreaker = (b) => ({ id: uid(), label: String(b.label ?? 'Breaker'), trip: n(b.instantaneousTripAmps, 800), tolPct: n(b.tolerancePercent, 25), isOpen: !!b.isOpen });

function importBus(bus) {
  return {
    id: uid(), label: String(bus.label ?? 'Bus'),
    children: (bus.children || []).map((br) => {
      const element = importElement(br.element || {});
      const out = { id: uid(), element, bus: importBus(br.bus || { label: 'Bus' }) };
      if (element.kind === 'transformer3') out.tertiaryBus = br.tertiaryBus ? importBus(br.tertiaryBus) : importBus({ label: 'Tertiary' });
      return out;
    }),
    motors: (bus.motors || []).map(importMotor),
    capacitors: (bus.capacitors || []).map(importCap),
    breakers: (bus.breakers || []).map(importBreaker),
  };
}

/** Parse + validate a `.scme` snapshot object into a web document. Throws a
 *  descriptive Error for anything that isn't a decodable v4 file — the caller
 *  surfaces the message rather than loading a half-formed circuit. */
export function importSCME(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Not a valid .scme file (empty or unreadable).');
  const v = snapshot.formatVersion;
  if (v === undefined || v === null) throw new Error('Not a valid .scme file (missing formatVersion).');
  if (Number(v) > CURRENT_FORMAT_VERSION) throw new Error(`This file is version ${v}, newer than this app supports (v${CURRENT_FORMAT_VERSION}). Update the app to open it.`);
  if (Number(v) < CURRENT_FORMAT_VERSION) throw new Error(`This file is an older format (v${v}) that this app can’t open.`);
  if (!snapshot.sourceBus || typeof snapshot.sourceBus !== 'object') throw new Error('The file is missing its circuit (sourceBus).');

  const doc = newDocument();
  doc.source = {
    mode: FILE_TO_SOURCE_MODE[snapshot.sourceMode] || 'availableKA',
    voltage: n(snapshot.sourceVoltage, 480), xOverR: n(snapshot.sourceXOverR, 8),
    kA: n(snapshot.sourceKA, 25), mva: n(snapshot.sourceMVA, 100),
    genKVA: n(snapshot.generatorKVA, 1000), genXdpp: n(snapshot.generatorSubtransientReactancePU, 0.09),
    genXdp: n(snapshot.generatorTransientReactancePU, 0.15), genXds: n(snapshot.generatorSynchronousReactancePU, 0),
    genType: snapshot.generatorType || '2-Pole Turbine',
  };
  doc.sourceBus = importBus(snapshot.sourceBus);
  return doc;
}

// ── Integrity envelope (SHA-512 header) ─────────────────────────────────
// A `.scme` file is `SCME-SHA512:<128 hex>\n<json payload>`, the hash taken
// over the exact payload bytes. Guards against silent corruption: the checksum
// is written on save and re-verified on open.

/** Wrap a JSON payload with the SHA-512 integrity header. */
export function wrapWithIntegrity(payloadText) {
  return `${INTEGRITY_PREFIX}${sha512Hex(payloadText)}\n${payloadText}`;
}

/** Split the integrity header off `text`: `{ payload, status }` where status
 *  is 'none' (no header — legacy, still loads), 'ok', or 'mismatch'. */
export function stripIntegrity(text) {
  if (!text.startsWith(INTEGRITY_PREFIX)) return { payload: text, status: 'none' };
  const nl = text.indexOf('\n');
  if (nl < 0) return { payload: text, status: 'mismatch' };
  const storedHash = text.slice(INTEGRITY_PREFIX.length, nl);
  const payload = text.slice(nl + 1);
  const status = sha512Hex(payload).toLowerCase() === storedHash.trim().toLowerCase() ? 'ok' : 'mismatch';
  return { payload, status };
}

/** Serialize a web document to the full `.scme` file text (integrity-wrapped). */
export function serializeSCME(doc) {
  return wrapWithIntegrity(JSON.stringify(exportSCME(doc), null, 2));
}

/** A deterministic SHA-512 fingerprint of the circuit's *content*: the exported
 *  snapshot with every (session-only, randomly-regenerated) `id` stripped out,
 *  so the same circuit always yields the same hash no matter when it was built,
 *  saved, or re-opened. Printed on reports so a bug report can be tied to its
 *  exact inputs — re-open the user's `.scme` and recompute; the hashes match. */
export function circuitFingerprint(doc) {
  const stripIds = (o) => Array.isArray(o)
    ? o.map(stripIds)
    : (o && typeof o === 'object')
      ? Object.fromEntries(Object.keys(o).filter((k) => k !== 'id').map((k) => [k, stripIds(o[k])]))
      : o;
  return sha512Hex(JSON.stringify(stripIds(exportSCME(doc))));
}

/** Parse raw `.scme` file text into a web document, verifying the integrity
 *  header (a checksum mismatch is rejected as corruption). */
export function parseSCME(text) {
  const { payload, status } = stripIntegrity(String(text));
  if (status === 'mismatch') {
    throw new Error('This file appears to be corrupted: its contents don’t match the integrity checksum saved with it. Opening it could show incorrect values.');
  }
  let json;
  try { json = JSON.parse(payload); } catch { throw new Error('The file isn’t valid JSON — it may be corrupted or not a .scme file.'); }
  return importSCME(json);
}
