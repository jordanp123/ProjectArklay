// SC-WIN .sc4 decoder tests — reference sample files (base64-inlined) with the
// values from SC-WIN's own schematics, so the decoder can't silently drift.

import { decode, looksLikeSCWIN } from '../js/scwin/decoder.js';
import { importSCWIN } from '../js/scwin/importer.js';
import * as M from '../js/model.js';

let passed = 0; let failed = 0; const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(c, m = 'assertion failed') { if (!c) throw new Error(m); }
function eq(a, b, m = '') { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function approx(a, b, tol, m = '') { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m} expected ${b}±${tol}, got ${a}`); }
function setEq(a, b, m = '') { const A = [...new Set(a)].sort(); const B = [...new Set(b)].sort(); eq(JSON.stringify(A), JSON.stringify(B), m); }

function b64(s) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const L = {}; for (let i = 0; i < T.length; i++) L[T[i]] = i;
  const out = []; let bits = 0; let val = 0;
  for (const ch of s.replace(/=+$/, '')) { if (!(ch in L)) continue; val = (val << 6) | L[ch]; bits += 6; if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); } }
  return out;
}

const SAMPLE = 'BgAFAAAA//8AAgcAQ1N1cHBseQAA//8AAgYAQ0NhYmxlAgD//wACBgBDVHJhbnMEAAOABgAFgAcAAAAAAAAAAAAAAAAABgEDAAQAAAAAAAAAoEAAAKBAAAD6RAAA+kTNzJxABDAuNDgAAAAAAAAAAAAABQEBAAMAAAAAAAZOby4gMSAAAHpDAAC0QgAAtEIAAMBAAAAAAAEeBgAAAAAAAAAAAAAABQEDAAIAAAAAAAAAoEAAAKBAAMBaRQDAWkUAAKBABDQuMTYAAAAAAAAAAAAABAEBAAEAAAAAAAZOby4gNCAAAPpDAAC0QgAAtEIAAMBAAAAAAAEeBwAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAyEIAACBBBSA3LjIwAAAAAA==';
const UTILITY_ONLY = 'AAEBAAEA//8AAgcAQ1N1cHBseQAA//8AAgoAQ0dlbmVyYXRvcgIAAAD//wACBgBDQ2FibGUCAP//AAIGAENNb3RvcgYAAAAAAAAAAAAAAAAAAQECAAIAAAAAAAAAyEIBAAAAAAAAAIA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQABAAAAAAAHTm8uIDQvMAAAyEEAALRCAAC0QgAAwEAAAAAAAR4GAAAAAAAAAAAAAQEEAgEAAAAAAAAA+kMDAAAAAAAAAAAAAAAAAQAAAAAAAAAAZmbKQY/CjUAFIDQuMTaPwgAA';
const GEN_CONNECTED = 'AAEBAAEA//8AAgcAQ1N1cHBseQAA//8AAgoAQ0dlbmVyYXRvcgIAAAD//wACBgBDQ2FibGUCAP//AAIGAENNb3RvcgYAAAAAAAAAAAAAAAAAAQECAAIAAAAAAAAAyEIBAAAAAAAAAIA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQABAAAAAAAHTm8uIDQvMAAAyEEAALRCAAC0QgAAwEAAAAAAAR4GAAAAAAAAAAAAAQEEAAEAAAAAAAAA+kMDAAAAAAAAAAAAAAAAAQACAAAAAAAAZmbKQY/CjUAFIDQuMTaPwgAA';
const ALL_DISC = 'AAEBAAEA//8AAgcAQ1N1cHBseQAA//8AAgoAQ0dlbmVyYXRvcgIAAAD//wACBgBDQ2FibGUCAP//AAIGAENNb3RvcgYAAAAAAAAAAAAAAAAAAQECAAIAAAAAAAAAyEIBAAAAAAAAAIA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQABAAAAAAAHTm8uIDQvMAAAyEEAALRCAAC0QgAAwEAAAAAAAR4GAAAAAAAAAAAAAQEEAgEAAAAAAAAA+kMDAAAAAAAAAAAAAAAAAQACAAAAAAAAZmbKQY/CjUAFIDQuMTaPwgAA';
const MULTI_BRANCH = 'AAAFAAYA//8AAgcAQ1N1cHBseQAA//8AAgYAQ0NhYmxlAgD//wACCABDRWxlbWVudAQABYAGAAOABwD//wACBgBDTW90b3IIAAAAAAAAAAAAAAAAAAMBAgAFAAAAAAAAAMhCAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAQEABAAAAAAABzUwMCBNQ00AAMhBAAC0QgAAtEIAAMBAAAAAAAEeCQAAAAAAAAAAAAAAAAEMAAMAAAAAAAWABAAFgAsAA4AMAAmADQAAAAAAAAAAAAAAAAAGAQIABQAAAAAAAABIQwAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAABQEBAAQAAAAAAAZOby4gMSAAAMhCAAC0QgAAtEIAAMBAAAAAAAEeCAAAAAAAAAAAAAAAAAEMAAMAAAAAAAWABAADgA8ACYAQAAAAAAAAAAAAAAAAAAUBAgAEAAAAAAAAAPpDAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQEAAwAAAAAAB05vLiAyLzAAAHpDAAC0QgAAtEIAAMBAAAAAAAEeBwAAAAAAAAAAAAAAAAELAAIAAAAAAAAAAAAAAAAAAAEKAAIAAAAAAAAAAAAAAAAAAAEKAAIAAAAAAAAAAAAAAAAAAAABAQEAAQAAAAAAB05vLiA0LzAAAMhBAAC0QgAAtEIAAMBAAAAAAAEeBgAAAAAAAAAAAAAAAAEAAAAAAAAAAGZmykGPwo1ABSA0LjE2j8IAAA==';
const ODDBALL = 'AAADAAEA//8AAgcAQ1N1cHBseQAA//8AAgoAQ0NhcGFjaXRvcgIAAAD//wACBgBDQ2FibGUCAAWABgAFgAcA//8AAgYAQ01vdG9yCAAAAAAAAAAAAAAAAAABAQIABAAAAAAAAACgQAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwEBAAMAAAAAAAZOby4gMTgAACBBAAC0QgAAtEIAAMBAAAAAAAEeDAAAAAAAAAAAAAAAAgEBAAIAAAAAAAVOby4gOAAAcEEAALRCAAC0QgAAwEAAAAAAAR4KAAAAAAAAAAAAAAABAQEAAQAAAAAABk5vLiAyIAAAekMAALRCAAC0QgAAwEAAAAAAAR4GAAAAAAAAAAAAAQEIAAEAAAAAAAAAyEIAAAAAAAAAAAAAAAEAAAAAAAAAAGZmykGPwo1ABSAuNDgwj8ICAA==';
const CB_SERIES = 'AAABAAEA//8AAgcAQ1N1cHBseQAA//8AAgYAQ0NhYmxlAgD//wACCABDRWxlbWVudAQA//8AAgYAQ01vdG9yBgAAAAAAAAAAAAAAAAABAQIAAwAAAAAAAADIQgAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEKAAIAAAAAAAAAAAAAAAAAAAABAQEAAQAAAAAAB05vLiA0LzAAAMhBAAC0QgAAtEIAAMBAAAAAAAEeBgAAAAAAAAAAAAAAAAEAAAAAAAAAAGZmykGPwo1ABSA0LjE2j8IAAA=';
const FOUR_DEV = 'AAABAAUA//8AAgcAQ1N1cHBseQAA//8AAgYAQ0NhYmxlAgD//wACCABDRWxlbWVudAQABYAGAAWABwAFgAgA//8AAgYAQ01vdG9yCQAAAAAAAAAAAAAAAAAFAQIABgAAAAAAAADIQgAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAENAAUAAAAAAAAAAAAAAAAAAAAAAQwABAAAAAAAAAAAAAAAAAAAAAABCwADAAAAAAAAAAAAAAAAAAAAAAEKAAIAAAAAAAAAAAAAAAAAAAABAQEAAQAAAAAAB05vLiA0LzAAAMhBAAC0QgAAtEIAAMBAAAAAAAEeBgAAAAAAAAAAAAAAAAEAAAAAAAAAAGZmykGPwo1ABSA0LjE2j8IAAA=';

test('looksLikeSCWIN gates on content', () => {
  assert(looksLikeSCWIN(b64(SAMPLE)), 'sample recognized');
  assert(!looksLikeSCWIN([...'{"formatVersion":4}'].map((c) => c.charCodeAt(0))), 'json rejected');
  assert(!looksLikeSCWIN(new Array(512).fill(0xab)), 'noise rejected');
  assert(!looksLikeSCWIN([0, 1, 2]), 'too short rejected');
});

test('class table + header (sample)', () => {
  const d = decode(b64(SAMPLE));
  eq(JSON.stringify(d.classNames), JSON.stringify(['CSupply', 'CCable', 'CTrans']));
  eq(JSON.stringify(d.headerWords), JSON.stringify([6, 5, 0]));
  eq(d.supplies.length, 1); eq(d.cables.length, 2); eq(d.transformers.length, 2);
});

test('supply + transformers match schematic (sample)', () => {
  const d = decode(b64(SAMPLE));
  approx(d.supplies[0].availableMVA, 100, 0.01); approx(d.supplies[0].xOverR, 10, 0.01); eq(d.supplies[0].kvString, '7.20');
  const xs = d.transformers.slice().sort((a, b) => a.ratedKVA - b.ratedKVA);
  approx(xs[0].ratedKVA, 2000, 0.1); approx(parseFloat(xs[0].secondaryKvString), 0.48, 0.001); approx(xs[0].percentImpedance, 5, 0.01);
  approx(xs[1].ratedKVA, 3500, 0.1); approx(parseFloat(xs[1].secondaryKvString), 4.16, 0.001);
});

test('cables + depth + kv-class (sample)', () => {
  const cs = decode(b64(SAMPLE)).cables.slice().sort((a, b) => a.lengthFeet - b.lengthFeet);
  approx(cs[0].lengthFeet, 250, 0.1); eq(cs[0].sizeString, 'No. 1'); eq(cs[0].depthLevel, 3); eq(cs[0].kvClassCode, 6); approx(cs[0].operatingTempC, 90, 0.1);
  approx(cs[1].lengthFeet, 500, 0.1); eq(cs[1].sizeString, 'No. 4'); eq(cs[1].depthLevel, 1); eq(cs[1].kvClassCode, 7);
});

test('object-stream parent links (sample)', () => {
  const d = decode(b64(SAMPLE));
  eq(d.objects.length, 5);
  eq(d.objects[0].className, 'CSupply'); eq(d.objects[0].parentIndex, 0);
  const idx = new Set(d.objects.map((o) => o.index));
  for (const o of d.objects.slice(1)) assert(idx.has(o.parentIndex), 'parent resolves');
  eq(d.objectStreamInterleaved, false);
});

test('device chains (cbSeries + fourDev)', () => {
  const cb = decode(b64(CB_SERIES));
  eq(JSON.stringify(cb.classNames), JSON.stringify(['CSupply', 'CCable', 'CElement', 'CMotor']));
  eq(cb.devices.length, 1); eq(cb.devices[0].deviceCode, 0x0a);
  eq(cb.objects.length, cb.elements.length);
  eq(JSON.stringify(cb.objects.map((o) => o.className)), JSON.stringify(['CSupply', 'CCable', 'CElement', 'CMotor']));

  const fd = decode(b64(FOUR_DEV));
  eq(fd.devices.length, 4); eq(fd.objects.length, fd.elements.length); eq(fd.objectStreamInterleaved, false);
  eq(JSON.stringify(fd.objects.map((o) => o.className)), JSON.stringify(['CSupply', 'CCable', 'CElement', 'CElement', 'CElement', 'CElement', 'CMotor']));
  setEq(fd.devices.map((x) => x.deviceCode), [0x0a, 0x0b, 0x0c, 0x0d]);
});

test('connected flag picks the live source', () => {
  const u = decode(b64(UTILITY_ONLY)); assert(u.supplies[0].connected); assert(!u.generators[0].connected);
  const g = decode(b64(GEN_CONNECTED)); assert(!g.supplies[0].connected); assert(g.generators[0].connected);
  const n = decode(b64(ALL_DISC)); assert(!n.supplies[0].connected); assert(!n.generators[0].connected);
});

test('multi-branch: counts, topology, values', () => {
  const d = decode(b64(MULTI_BRANCH));
  eq(d.supplies.length, 1); eq(d.cables.length, 4); eq(d.devices.length, 5); eq(d.motors.length, 3);
  eq(d.objects.length, 13); eq(d.objectStreamInterleaved, false);
  const supply = d.objects.find((o) => o.className === 'CSupply'); eq(supply.parentIndex, 0);
  const feeder = d.objects.find((o) => o.className === 'CCable' && o.parentIndex === supply.index);
  eq(d.objects.filter((o) => o.className === 'CElement' && o.parentIndex === feeder.index).length, 3);
  setEq(d.cables.map((c) => c.sizeString), ['500 MCM', 'No. 1', 'No. 2/0', 'No. 4/0']);
  setEq(d.motors.map((m) => m.ratedHP), [100, 200, 500]);
  eq(d.supplies[0].kvString, '4.16'); approx(d.supplies[0].availableMVA, 25.3, 0.1); approx(d.supplies[0].xOverR, 4.43, 0.01); assert(d.supplies[0].connected);
});

test('oddball: capacitor + series cables (sub-kV supply)', () => {
  const d = decode(b64(ODDBALL));
  eq(d.supplies.length, 1); eq(d.capacitors.length, 1); eq(d.cables.length, 3); eq(d.motors.length, 1); eq(d.objects.length, 6); eq(d.objectStreamInterleaved, false);
  approx(d.capacitors[0].ratedKVAR, 100, 0.1); eq(d.capacitors[0].depthLevel, 1);
  eq(d.supplies[0].kvString, '.480'); approx(d.supplies[0].availableMVA, 25.3, 0.1); approx(d.motors[0].ratedHP, 5, 0.1);
  const supply = d.objects.find((o) => o.className === 'CSupply');
  eq(d.objects.filter((o) => o.parentIndex === supply.index).length, 2);
});

// ── Importer (IR → web circuit) ────────────────────────────────────────
function walkBuses(bus, fn) { fn(bus); for (const br of bus.children) { walkBuses(br.bus, fn); if (br.tertiaryBus) walkBuses(br.tertiaryBus, fn); } }
function countElement(doc, kind) { let n = 0; walkBuses(doc.sourceBus, (b) => { for (const br of b.children) if (br.element.kind === kind) n++; }); return n; }
function sumOver(doc, field) { let n = 0; walkBuses(doc.sourceBus, (b) => { n += (b[field] || []).length; }); return n; }
const faultsFinite = (doc) => M.buildCircuit(doc).computeNominal().nodes.every((n) => Number.isFinite(n.threePhaseFaultCurrentAmps));

test('import SAMPLE → utility source, 2 cables + 2 transformers, finite faults', () => {
  const { doc } = importSCWIN(b64(SAMPLE));
  eq(doc.source.mode, 'availableMVA'); eq(Math.round(doc.source.voltage), 7200);
  approx(doc.source.mva, 100, 0.1); approx(doc.source.xOverR, 10, 0.1);
  eq(countElement(doc, 'cable'), 2); eq(countElement(doc, 'transformer'), 2);
  assert(M.buildCircuit(doc).computeNominal().nodes.length >= 3, 'buses built');
  assert(faultsFinite(doc), 'finite fault currents');
});

test('import ODDBALL → 480 V utility, cap on source bus, 3 series cables + motor', () => {
  const { doc } = importSCWIN(b64(ODDBALL));
  eq(doc.source.mode, 'availableMVA'); eq(Math.round(doc.source.voltage), 480);
  eq(doc.sourceBus.capacitors.length, 1); approx(doc.sourceBus.capacitors[0].ratedKVAR, 100, 0.1);
  eq(countElement(doc, 'cable'), 3); eq(sumOver(doc, 'motors'), 1);
  assert(faultsFinite(doc));
});

test('import CB_SERIES → a breaker is placed, faults finite', () => {
  const { doc } = importSCWIN(b64(CB_SERIES));
  eq(sumOver(doc, 'breakers'), 1); eq(sumOver(doc, 'motors'), 1);
  assert(faultsFinite(doc));
});

test('import GEN_CONNECTED → generator source', () => {
  const { doc } = importSCWIN(b64(GEN_CONNECTED));
  eq(doc.source.mode, 'generator'); assert(doc.source.genKVA > 0, 'gen kVA set');
  assert(faultsFinite(doc));
});

test('import MULTI_BRANCH → 4 cables, 3 motors, 5 breakers, branched', () => {
  const { doc } = importSCWIN(b64(MULTI_BRANCH));
  eq(countElement(doc, 'cable'), 4); eq(sumOver(doc, 'motors'), 3); eq(sumOver(doc, 'breakers'), 5);
  let maxChildren = 0; walkBuses(doc.sourceBus, (b) => { maxChildren = Math.max(maxChildren, b.children.length); });
  assert(maxChildren >= 3, 'a bus splits into ≥3 branches');
  assert(faultsFinite(doc));
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb SC-WIN decoder tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
