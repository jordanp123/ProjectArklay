// Full-pipeline math back-test. Two guarantees:
//   1. GOLDEN — a rich all-element circuit's fault (Asym/Int/Min), load-flow,
//      and motor-start outputs match locked reference values, end to end.
//   2. INVARIANCE — the session's new structural mutations (moveBranch,
//      moveAttachment, reorder) can't change the physics: results are identical
//      whether a circuit is built directly or via moves/reorders, and are
//      independent of sibling / motor / capacitor ordering (parallel and series
//      reduction are order-free). This is what proves the UI work didn't touch
//      the numbers.

import * as M from '../js/model.js';
import { minimumShortCircuitAmps } from '../js/engine/breakerAnalysis.js';

let passed = 0; let failed = 0; const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(c, m = 'assertion failed') { if (!c) throw new Error(m); }
function eq(a, b, m = '') { if (a !== b) throw new Error(`${m}\n  expected ${b}\n  got      ${a}`); }
const round = (x, dp = 1) => (Number.isFinite(x) ? Number(x.toFixed(dp)) : 'inf');

/** A canonical, ORDER-FREE numeric fingerprint of a circuit's whole result set:
 *  sorted per-bus [Asym3φ, Int3φ, Min3φ], sorted load-flow bus voltages, and
 *  sorted per-motor [singular, combined-worst] start dips. Two circuits with
 *  identical physics produce identical fingerprints regardless of element order. */
function fingerprint(doc) {
  const c = M.buildCircuit(doc);
  const nom = c.computeNominal().nodes;
  const hot = c.computeMaxTemperature().nodes;
  const int = c.computeInterrupting().nodes;
  const fault = nom.map((n, i) => (n.isSynthetic ? null
    : [round(n.asymmetricalThreePhaseFaultCurrentAmps), round(int[i].threePhaseFaultCurrentAmps), round(minimumShortCircuitAmps(hot[i]))].join(',')))
    .filter(Boolean).sort().join('|');
  const lf = M.runLoadFlow(doc).result;
  const volts = (lf && lf.converged ? lf.nodes.map((n) => round(n.voltageLL)) : []).sort((a, b) => a - b).join(',');
  const ms = M.motorStartAnalysis(doc).map((m) => `${round(m.singularBasePct, 2)}/${round(m.combinedWorstPct, 2)}`).sort().join('|');
  return `${fault} || ${volts} || ${ms}`;
}

// ── Circuit builders (via the public model API) ────────────────────────
const setEl = (doc, childBusId, fields) => Object.assign(M.findBranchByChild(doc, childBusId).branch.element, fields);
const setBus = (doc, busId, label) => { M.findBus(doc, busId).label = label; };

/** A rich circuit touching every element type: generator source, series cable,
 *  a 2-winding transformer to a 480 V MCC with 2 motors + a PFC cap + a breaker,
 *  a parallel cable feeder to a second bus with a motor, and a 3-winding xfmr. */
function richCircuit() {
  const d = M.newDocument();
  Object.assign(d.source, { mode: 'generator', voltage: 4160, genType: '2-Pole Turbine', genKVA: 5000, genXdpp: 0.09, genXdp: 0.15, genXds: 0 });
  // feeder cable → main bus
  const c1 = M.addToBus(d, d.sourceBus.id, 'cable');
  setEl(d, c1.childBusId, { lengthFeet: 300, rPerKft: 0.05, xPerKft: 0.04, material: 'copper', maxTempC: 90, parallel: 1 });
  setBus(d, c1.childBusId, 'MV bus');
  // transformer → 480 V MCC
  const t = M.addToBus(d, c1.childBusId, 'transformer');
  setEl(d, t.childBusId, { kva: 1500, primaryV: 4160, secondaryV: 480, percentZ: 5.75, xOverR: 6 });
  setBus(d, t.childBusId, 'MCC-1');
  const m1 = M.addToBus(d, t.childBusId, 'motor'); Object.assign(M.findBus(d, t.childBusId).motors.find((x) => x.id === m1.motorId), { ratedHP: 300, motorType: 'induction' });
  const m2 = M.addToBus(d, t.childBusId, 'motor'); Object.assign(M.findBus(d, t.childBusId).motors.find((x) => x.id === m2.motorId), { ratedHP: 150, motorType: 'synchronous' });
  M.addToBus(d, t.childBusId, 'capacitor');
  M.addToBus(d, t.childBusId, 'breaker');
  // second parallel feeder on the MV bus → motor
  const c2 = M.addToBus(d, c1.childBusId, 'cable');
  setEl(d, c2.childBusId, { lengthFeet: 150, rPerKft: 0.08, xPerKft: 0.05, material: 'copper', maxTempC: 90, parallel: 1 });
  setBus(d, c2.childBusId, 'Bus-2');
  const m3 = M.addToBus(d, c2.childBusId, 'motor'); Object.assign(M.findBus(d, c2.childBusId).motors.find((x) => x.id === m3.motorId), { ratedHP: 500, motorType: 'induction' });
  // three-winding transformer off the MV bus
  const t3 = M.addToBus(d, c1.childBusId, 'transformer3');
  Object.assign(M.findBranchByChild(d, t3.childBusId).branch.element, { primaryV: 4160, secondaryV: 2400, tertiaryV: 480 });
  return d;
}

// ── 1. GOLDEN: locked full-pipeline values ─────────────────────────────
const GOLDEN = '12012.9,7532.2,4227.5|13022.1,7717.1,4292.9|14664.6,8011.2,4394.9|16604.7,9876.2,6061.8|39671.3,23696.7,14096.4|69427.8,41768.9,22758 || 470.2,473.8,2368.8,4104.2,4105.9,4109.8 || 4.87/7.28|5.43/9|9.28/11.85';
test('GOLDEN: rich all-element circuit — full pipeline matches reference', () => {
  eq(fingerprint(richCircuit()), GOLDEN, 'full-pipeline fingerprint drifted from the locked reference');
});

// ── 2. INVARIANCE: order can't change the physics ──────────────────────
test('INVARIANCE: motor order on a bus does not change any result', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  const a = M.addToBus(d, c.childBusId, 'motor'); Object.assign(M.findBus(d, c.childBusId).motors.find((x) => x.id === a.motorId), { ratedHP: 100 });
  const b = M.addToBus(d, c.childBusId, 'motor'); Object.assign(M.findBus(d, c.childBusId).motors.find((x) => x.id === b.motorId), { ratedHP: 250 });
  const e = M.addToBus(d, c.childBusId, 'motor'); Object.assign(M.findBus(d, c.childBusId).motors.find((x) => x.id === e.motorId), { ratedHP: 400 });
  const before = fingerprint(d);
  M.moveAttachment(d, 'motor', c.childBusId, e.motorId, c.childBusId, a.motorId); // reorder
  M.moveAttachment(d, 'motor', c.childBusId, a.motorId, c.childBusId, null);
  eq(fingerprint(d), before, 'reordering motors changed a result');
});

test('INVARIANCE: sibling branch order does not change any result', () => {
  const d = M.newDocument();
  const f1 = M.addToBus(d, d.sourceBus.id, 'cable'); M.addToBus(d, f1.childBusId, 'motor');
  const f2 = M.addToBus(d, d.sourceBus.id, 'transformer'); setEl(d, f2.childBusId, { primaryV: 480, secondaryV: 240 }); M.addToBus(d, f2.childBusId, 'motor');
  const f3 = M.addToBus(d, d.sourceBus.id, 'cable'); M.addToBus(d, f3.childBusId, 'capacitor');
  const before = fingerprint(d);
  M.moveBranch(d, f3.childBusId, d.sourceBus.id, f1.childBusId); // put f3 first
  M.moveBranch(d, f1.childBusId, d.sourceBus.id, null);          // f1 to the end
  eq(fingerprint(d), before, 'reordering sibling branches changed a result');
});

test('EQUIVALENCE: a circuit built via moveBranch equals one built directly', () => {
  // Direct: source → cableA → BusA → cableB → BusB(motor)
  const direct = M.newDocument();
  const dA = M.addToBus(direct, direct.sourceBus.id, 'cable'); setBus(direct, dA.childBusId, 'A');
  const dB = M.addToBus(direct, dA.childBusId, 'cable'); setBus(direct, dB.childBusId, 'B');
  const dm = M.addToBus(direct, dB.childBusId, 'motor'); Object.assign(M.findBus(direct, dB.childBusId).motors.find((x) => x.id === dm.motorId), { ratedHP: 200 });

  // Via moves: build BusB under the source, then move it under BusA.
  const moved = M.newDocument();
  const mA = M.addToBus(moved, moved.sourceBus.id, 'cable'); setBus(moved, mA.childBusId, 'A');
  const mB = M.addToBus(moved, moved.sourceBus.id, 'cable'); setBus(moved, mB.childBusId, 'B');
  const mm = M.addToBus(moved, mB.childBusId, 'motor'); Object.assign(M.findBus(moved, mB.childBusId).motors.find((x) => x.id === mm.motorId), { ratedHP: 200 });
  assert(M.moveBranch(moved, mB.childBusId, mA.childBusId), 'move applied');

  eq(fingerprint(moved), fingerprint(direct), 'moved circuit physics differs from the directly-built one');
});

test('EQUIVALENCE: a motor placed via moveAttachment equals one added in place', () => {
  const direct = M.newDocument();
  const c = M.addToBus(direct, direct.sourceBus.id, 'cable');
  const dm = M.addToBus(direct, c.childBusId, 'motor'); Object.assign(M.findBus(direct, c.childBusId).motors.find((x) => x.id === dm.motorId), { ratedHP: 350 });

  const moved = M.newDocument();
  const c2 = M.addToBus(moved, moved.sourceBus.id, 'cable');
  const mm = M.addToBus(moved, moved.sourceBus.id, 'motor'); Object.assign(moved.sourceBus.motors.find((x) => x.id === mm.motorId), { ratedHP: 350 });
  assert(M.moveAttachment(moved, 'motor', moved.sourceBus.id, mm.motorId, c2.childBusId), 'motor moved');

  eq(fingerprint(moved), fingerprint(direct), 'moved-motor circuit physics differs from the in-place one');
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb math back-test: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
