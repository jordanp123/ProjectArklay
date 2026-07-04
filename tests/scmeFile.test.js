// `.scme` v4 read/write tests — the exact v4 field names, round-trip fidelity
// (through the fault engine), integrity envelope, and defensive
// rejects. Pure; runs under jsc.

import * as M from '../js/model.js';
import { exportSCME, importSCME, parseSCME, serializeSCME, stripIntegrity, INTEGRITY_PREFIX, CURRENT_FORMAT_VERSION } from '../js/scmeFile.js';

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); }
function approx(a, b, tol, msg = '') { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ${b}±${tol}, got ${a}`); }

function richDoc() {
  const d = M.newDocument();
  d.source.voltage = 13800; d.source.mode = 'availableMVA'; d.source.mva = 250;
  const t3 = M.addToBus(d, d.sourceBus.id, 'transformer3');
  const secId = M.findBranchByChild(d, t3.childBusId).branch.bus.id;
  const cab = M.addToBus(d, secId, 'cable');
  const mccId = M.findBus(d, cab.childBusId).id;
  const mcc = M.findBus(d, mccId);
  mcc.motors.push(Object.assign(M.newMotor(), { label: 'Drive', ratedHP: 600, lockedRotorAmps: 3800 }));
  mcc.capacitors.push(Object.assign(M.newCapacitor(), { ratedKVAR: 300 }));
  mcc.breakers.push(Object.assign(M.newBreaker(), { trip: 1200 }));
  // Tertiary motor (no LRA → estimated).
  const terId = M.findBranchByChild(d, t3.childBusId).branch.tertiaryBus.id;
  M.findBus(d, terId).motors.push(Object.assign(M.newMotor(), { label: 'Fan', ratedHP: 150 }));
  return d;
}

test('exportSCME uses the v4 field names + enum strings', () => {
  const snap = exportSCME(richDoc());
  eq(snap.formatVersion, CURRENT_FORMAT_VERSION);
  eq(snap.sourceMode, 'Available MVA');
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(snap.sourceBus.id), 'bus id is a UUID');
  const br = snap.sourceBus.children[0];
  eq(br.element.kindTag, 'transformer');
  eq(br.element.transformer.isThreeWinding, true);
  assert(br.tertiaryBus, 'tertiary subtree written for a 3-winding branch');
  // The secondary feeds a cable (v4 cable field name).
  const cableEl = br.bus.children[0].element;
  eq(cableEl.kindTag, 'cable');
  assert('resistancePerKFTAt25C' in cableEl.cable, 'cable uses resistancePerKFTAt25C');
  assert(cableEl.cable.conductorMaterial === 'Copper', 'material is the capitalized enum string');
  // Motor + breaker v4 field names.
  const mcc = br.bus.children[0].bus;
  eq(mcc.motors[0].motorType, 'Induction');
  eq(mcc.motors[0].lockedRotorAmps, 3800);
  eq(mcc.breakers[0].instantaneousTripAmps, 1200);
  eq(mcc.breakers[0].ratingConfigured, true);
});

test('a motor without an LRA omits the key (not written as null)', () => {
  const snap = exportSCME(richDoc());
  const fan = snap.sourceBus.children[0].tertiaryBus.motors[0];
  eq(fan.label, 'Fan');
  assert(!('lockedRotorAmps' in fan), 'unset LRA is omitted, not null');
});

test('round-trip export→import preserves the fault results exactly', () => {
  const d = richDoc();
  const before = M.buildCircuit(d).computeNominal().nodes.map((x) => x.threePhaseFaultCurrentAmps);
  const d2 = importSCME(exportSCME(d));
  const after = M.buildCircuit(d2).computeNominal().nodes.map((x) => x.threePhaseFaultCurrentAmps);
  eq(after.length, before.length);
  for (let i = 0; i < before.length; i++) approx(after[i], before[i], 1e-6, `node ${i}`);
});

test('round-trip preserves the load-flow + motor-start too', () => {
  const d = richDoc();
  const d2 = importSCME(exportSCME(d));
  const lf1 = M.runLoadFlow(d).result.nodes.map((x) => x.voltageLL);
  const lf2 = M.runLoadFlow(d2).result.nodes.map((x) => x.voltageLL);
  eq(lf2.length, lf1.length);
  for (let i = 0; i < lf1.length; i++) approx(lf2[i], lf1[i], 1e-6, `lf node ${i}`);
  eq(M.motorStartAnalysis(d2).length, M.motorStartAnalysis(d).length);
});

test('importSCME reads a hand-written v4 file', () => {
  const json = {
    formatVersion: 4, sourceVoltage: 480, sourceMode: 'Available kA', sourceMVA: 100, sourceXOverR: 8, sourceKA: 30,
    generatorType: '2-Pole Turbine', generatorKVA: 1000, generatorSubtransientReactancePU: 0.14, generatorTransientReactancePU: 0.23, generatorSynchronousReactancePU: 1.8,
    sourceBus: {
      id: '11111111-1111-4111-8111-111111111111', label: 'Main', children: [{
        id: '22222222-2222-4222-8222-222222222222',
        element: { id: '33333333-3333-4333-8333-333333333333', label: 'Feeder', kindTag: 'cable',
          cable: { lengthFeet: 250, resistancePerKFTAt25C: 0.05, reactancePerKFT: 0.04, maxOperatingTemperatureC: 90, conductorMaterial: 'Aluminum', parallelCount: 2 } },
        bus: { id: '44444444-4444-4444-8444-444444444444', label: 'Load', children: [],
          motors: [{ id: '55555555-5555-4555-8555-555555555555', label: 'M1', ratedHP: 200, ratedRPM: 3600, ratedKVA: 0, motorType: 'Synchronous', subtransientReactancePU: 0.25, powerFactor: 0.9, efficiency: 0.95 }],
          capacitors: [], breakers: [] },
      }],
      motors: [], capacitors: [], breakers: [],
    },
  };
  const d = importSCME(json);
  eq(d.source.mode, 'availableKA'); eq(d.source.kA, 30); eq(d.source.voltage, 480);
  const cab = d.sourceBus.children[0].element;
  eq(cab.kind, 'cable'); eq(cab.rPerKft, 0.05); eq(cab.material, 'aluminum'); eq(cab.parallel, 2);
  const m = d.sourceBus.children[0].bus.motors[0];
  eq(m.motorType, 'synchronous'); eq(m.ratedHP, 200); eq(m.lockedRotorAmps, null);
});

test('importSCME rejects bad or unsupported files', () => {
  let threw = 0;
  for (const bad of [null, {}, { formatVersion: 5, sourceBus: {} }, { formatVersion: 3, sourceBus: {} }, { formatVersion: 4 }]) {
    try { importSCME(bad); } catch { threw++; }
  }
  eq(threw, 5);
  let parseThrew = false;
  try { parseSCME('{not json'); } catch { parseThrew = true; }
  assert(parseThrew, 'parseSCME rejects invalid JSON');
});

test('serializeSCME wraps the payload in a verifying SHA-512 integrity header', () => {
  const text = serializeSCME(richDoc());
  assert(text.startsWith(INTEGRITY_PREFIX), 'has the SCME-SHA512 prefix');
  const nl = text.indexOf('\n');
  assert(/^[0-9a-f]{128}$/.test(text.slice(INTEGRITY_PREFIX.length, nl)), '128-hex SHA-512');
  eq(stripIntegrity(text).status, 'ok');
  const d2 = parseSCME(text); // verifies the checksum on the way in
  assert(d2.sourceBus.children.length > 0, 'round-trips a circuit through the envelope');
});

test('parseSCME rejects a corrupted (tampered) file', () => {
  const text = serializeSCME(richDoc());
  const nl = text.indexOf('\n');
  const tampered = text.slice(0, nl + 1) + text.slice(nl + 1).replace('Drive', 'Drxve'); // mutate payload, keep old hash
  eq(stripIntegrity(tampered).status, 'mismatch');
  let threw = false;
  try { parseSCME(tampered); } catch { threw = true; }
  assert(threw, 'checksum mismatch is rejected');
});

test('breaker isOpen round-trips through the .scme file', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  M.findBus(d, c.childBusId).breakers.push(Object.assign(M.newBreaker(), { isOpen: true, trip: 600 }));
  const snap = exportSCME(d);
  eq(snap.sourceBus.children[0].bus.breakers[0].isOpen, true);
  const d2 = importSCME(snap);
  eq(d2.sourceBus.children[0].bus.breakers[0].isOpen, true);
  eq(d2.sourceBus.children[0].bus.breakers[0].trip, 600);
});

test('generator source round-trips type + synchronous reactance', () => {
  const d = M.newDocument();
  Object.assign(d.source, { mode: 'generator', genType: 'Salient Pole with Dampers', genKVA: 2500, genXdpp: 0.20, genXdp: 0.30, genXds: 1.9 });
  const snap = exportSCME(d);
  eq(snap.sourceMode, 'AC Generator');
  eq(snap.generatorType, 'Salient Pole with Dampers');
  eq(snap.generatorSynchronousReactancePU, 1.9);
  const d2 = importSCME(snap);
  eq(d2.source.genType, 'Salient Pole with Dampers');
  eq(d2.source.genXds, 1.9);
});

test('parseSCME still opens a legacy header-less file (status none)', () => {
  const json = JSON.stringify(exportSCME(richDoc()), null, 2);
  eq(stripIntegrity(json).status, 'none');
  assert(parseSCME(json).sourceBus.children.length > 0, 'header-less file loads (back-compat)');
});

test('SECURITY: file-supplied ids are regenerated on import (attribute-injection guard)', () => {
  const EVIL = 'x" onmouseover="alert(1)';
  const json = {
    formatVersion: 4, sourceVoltage: 480, sourceMode: 'Available kA', sourceMVA: 100, sourceXOverR: 8, sourceKA: 25,
    generatorType: '2-Pole Turbine', generatorKVA: 1000, generatorSubtransientReactancePU: 0.09, generatorTransientReactancePU: 0.15, generatorSynchronousReactancePU: 0,
    sourceBus: {
      id: EVIL, label: 'Main', children: [{
        id: EVIL,
        element: { id: EVIL, label: 'Feeder', kindTag: 'cable', cable: { lengthFeet: 100, resistancePerKFTAt25C: 0.08, reactancePerKFT: 0.04, maxOperatingTemperatureC: 90, conductorMaterial: 'Copper', parallelCount: 1 } },
        bus: { id: EVIL, label: 'Load', children: [], motors: [{ id: EVIL, label: 'M', ratedHP: 100, ratedRPM: 1800, ratedKVA: 0, motorType: 'Induction', subtransientReactancePU: 0.167, powerFactor: 0.85, efficiency: 0.92 }], capacitors: [{ id: EVIL, label: 'C', ratedKVAR: 50 }], breakers: [{ id: EVIL, label: 'B', instantaneousTripAmps: 800, tolerancePercent: 25, isOpen: false }] },
      }],
      motors: [], capacitors: [], breakers: [],
    },
  };
  const d = importSCME(json);
  const ids = [];
  const walk = (bus) => {
    ids.push(bus.id);
    for (const m of bus.motors) ids.push(m.id);
    for (const c of bus.capacitors) ids.push(c.id);
    for (const b of bus.breakers) ids.push(b.id);
    for (const br of bus.children) { ids.push(br.id, br.element.id); walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(d.sourceBus);
  assert(ids.length >= 7, `collected ${ids.length} ids`);
  for (const id of ids) {
    assert(id !== EVIL, 'file id must not be trusted');
    assert(!/["<>&]/.test(id), `regenerated id is attribute-safe: ${id}`);
  }
  // The circuit still computes (ids are identity only, not data):
  // source bus + the cable's downstream bus = 2 fault nodes.
  assert(M.buildCircuit(d).computeNominal().nodes.length === 2, 'imported circuit intact');
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb .scme file tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
