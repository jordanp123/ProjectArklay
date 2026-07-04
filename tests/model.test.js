// Model / tree tests — tree ops, engine bridge (branching), derived maps.
// Runnable with node or jsc.

import * as M from '../js/model.js';

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); }

test('addToBus cable creates a branch + downstream bus, selects it', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'cable');
  eq(sel.kind, 'element');
  eq(d.sourceBus.children.length, 1);
  assert(M.findBus(d, sel.childBusId) !== null, 'child bus reachable');
});

test('addToBus breaker attaches to the bus (no new bus)', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'breaker');
  eq(sel.kind, 'breaker');
  eq(d.sourceBus.breakers.length, 1);
  eq(d.sourceBus.children.length, 0);
});

test('buildCircuit handles a branched tree (two feeders)', () => {
  const d = M.newDocument();
  M.addToBus(d, d.sourceBus.id, 'cable');
  M.addToBus(d, d.sourceBus.id, 'cable');
  const r = M.buildCircuit(d).computeNominal();
  eq(r.nodes.length, 3, 'source + 2 leaf buses');
  assert(r.nodes[1].threePhaseFaultCurrentAmps < r.nodes[0].threePhaseFaultCurrentAmps, 'cable lowers fault');
  assert(r.nodes[2].threePhaseFaultCurrentAmps < r.nodes[0].threePhaseFaultCurrentAmps);
});

test('nominalVoltages: transformer secondary propagates downstream', () => {
  const d = M.newDocument(); d.source.voltage = 4160;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer');
  const el = M.findBranchByChild(d, sel.childBusId).branch.element;
  el.primaryV = 4160; el.secondaryV = 480;
  M.addToBus(d, sel.childBusId, 'cable');
  const nom = M.nominalVoltages(d);
  eq(nom.get(d.sourceBus.id), 4160);
  eq(nom.get(sel.childBusId), 480);
});

test('busNodeIndices pre-order; collectBreakers tags the bus node index', () => {
  const d = M.newDocument();
  const c1 = M.addToBus(d, d.sourceBus.id, 'cable');
  M.addToBus(d, c1.childBusId, 'breaker');
  const idx = M.busNodeIndices(d);
  eq(idx.get(d.sourceBus.id), 0);
  eq(idx.get(c1.childBusId), 1);
  const brs = M.collectBreakers(d);
  eq(brs.length, 1);
  eq(brs[0].nodeIndex, 1);
});

test('deleteSelection removes an element (and its subtree)', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'cable');
  M.addToBus(d, sel.childBusId, 'cable'); // nested cable under the first
  assert(M.deleteSelection(d, sel));
  eq(d.sourceBus.children.length, 0);
});

test('targetBusId: element selection targets its downstream bus', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'cable');
  eq(M.targetBusId(d, sel), sel.childBusId);
  eq(M.targetBusId(d, { kind: 'source' }), d.sourceBus.id);
});

test('addToBus motor attaches to the bus (no new bus); targetBusId/delete work', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'motor');
  eq(sel.kind, 'motor');
  eq(d.sourceBus.motors.length, 1);
  eq(d.sourceBus.children.length, 0);
  eq(M.targetBusId(d, sel), d.sourceBus.id);
  assert(M.deleteSelection(d, sel));
  eq(d.sourceBus.motors.length, 0);
});

test('buildCircuit: a motor in the tree raises the nominal fault but not min-SC', () => {
  // Two identical trees (source → cable → bus); one bus carries a motor.
  const withM = M.newDocument();
  const cW = M.addToBus(withM, withM.sourceBus.id, 'cable');
  M.addToBus(withM, cW.childBusId, 'motor');
  const iW = M.busNodeIndices(withM).get(cW.childBusId);

  const noM = M.newDocument();
  const cN = M.addToBus(noM, noM.sourceBus.id, 'cable');
  const iN = M.busNodeIndices(noM).get(cN.childBusId);

  const nomWith = M.buildCircuit(withM).computeNominal().nodes[iW].threePhaseFaultCurrentAmps;
  const nomNo = M.buildCircuit(noM).computeNominal().nodes[iN].threePhaseFaultCurrentAmps;
  assert(nomWith > nomNo, `motor should raise nominal fault (${nomWith} vs ${nomNo})`);

  const minWith = M.buildCircuit(withM).computeMaxTemperature().nodes[iW].threePhaseFaultCurrentAmps;
  const minNo = M.buildCircuit(noM).computeMaxTemperature().nodes[iN].threePhaseFaultCurrentAmps;
  assert(Math.abs(minWith - minNo) < 1e-6, 'motor excluded from minimum SC');
});

test('motorInterruptingMultiplier + effectiveMotorKVA presets', () => {
  eq(M.motorInterruptingMultiplier({ motorType: 'synchronous' }), 1.5);
  eq(M.motorInterruptingMultiplier({ motorType: 'induction', ratedRPM: 1800, ratedHP: 100 }), 3.0);
  eq(M.motorInterruptingMultiplier({ motorType: 'induction', ratedRPM: 1800, ratedHP: 2000 }), 1.5);
  eq(M.effectiveMotorKVA({ ratedKVA: 0, ratedHP: 250 }), 250);
  eq(M.effectiveMotorKVA({ ratedKVA: 400, ratedHP: 250 }), 400);
});

test('addToBus capacitor attaches to the bus; targetBusId/delete work', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'capacitor');
  eq(sel.kind, 'capacitor');
  eq(d.sourceBus.capacitors.length, 1);
  eq(d.sourceBus.children.length, 0);
  eq(M.targetBusId(d, sel), d.sourceBus.id);
  assert(M.deleteSelection(d, sel));
  eq(d.sourceBus.capacitors.length, 0);
});

test('collectBusLoads aggregates a bus’s motors into one HP-weighted load', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  const bus = M.findBus(d, c.childBusId);
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 100, powerFactor: 0.8, efficiency: 0.9 }));
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 300, powerFactor: 0.9, efficiency: 0.94 }));
  const loads = M.collectBusLoads(d);
  eq(loads.length, 1);
  eq(loads[0].busIndex, M.busNodeIndices(d).get(c.childBusId));
  eq(loads[0].load.hp, 400);
  // HP-weighted PF = (100·0.8 + 300·0.9)/400 = 0.875
  assert(Math.abs(loads[0].load.powerFactor - 0.875) < 1e-9, `pf ${loads[0].load.powerFactor}`);
});

test('runLoadFlow: motor load sags its bus; a cap on that bus reduces the sag', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  const bus = M.findBus(d, c.childBusId);
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 800, powerFactor: 0.85, efficiency: 0.92 }));
  const idx = M.busNodeIndices(d).get(c.childBusId);
  const noCap = M.runLoadFlow(d).result;
  assert(noCap.converged, 'load solve converges');
  const sag = noCap.nodes[idx].percentDropFromNominal;
  assert(sag > 0, `expected a sag, got ${sag}%`);
  bus.capacitors.push(Object.assign(M.newCapacitor(), { ratedKVAR: 250 }));
  const withCap = M.runLoadFlow(d).result;
  assert(withCap.nodes[idx].percentDropFromNominal < sag, 'cap reduces the sag');
  assert(M.hasLoadFlowInputs(d), 'load-flow inputs detected');
});

test('runLoadFlow through a transformer: downstream nominal is the secondary', () => {
  const d = M.newDocument(); d.source.voltage = 4160;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer');
  const el = M.findBranchByChild(d, sel.childBusId).branch.element;
  el.primaryV = 4160; el.secondaryV = 480;
  const bus = M.findBus(d, sel.childBusId);
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 400, powerFactor: 0.85, efficiency: 0.92 }));
  const idx = M.busNodeIndices(d).get(sel.childBusId);
  const f = M.runLoadFlow(d).result;
  assert(f.converged, 'transformer solve converges');
  eq(Math.round(f.nodes[idx].nominalVLL), 480);
  assert(f.nodes[idx].voltageLL < 480, 'secondary bus sags under load');
});

test('startingCurrent: nameplate LRA used as-is; otherwise estimated FLA/X″', () => {
  const supplied = M.startingCurrent({ lockedRotorAmps: 900 }, 480);
  eq(supplied.amps, 900); eq(supplied.estimated, false);
  const est = M.startingCurrent({ ratedHP: 100, subtransientReactancePU: 0.167 }, 480);
  assert(est.estimated, 'estimated flag set');
  const expected = (100 * 1000 / (Math.sqrt(3) * 480)) / 0.167;
  assert(Math.abs(est.amps - expected) < 1e-6, `amps ${est.amps} vs ${expected}`);
});

test('motorStartAnalysis: singular dip present, worst ≥ base, combined converges', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  const bus = M.findBus(d, c.childBusId);
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 500, lockedRotorAmps: 3000 }));
  const res = M.motorStartAnalysis(d);
  eq(res.length, 1);
  const r = res[0];
  eq(r.lraEstimated, false);
  eq(r.lockedRotorAmps, 3000);
  assert(r.singularBasePct > 0 && r.singularBasePct < 100, `base ${r.singularBasePct}`);
  assert(r.singularWorstPct >= r.singularBasePct - 1e-9, 'worst ≥ base (hotter cable, deeper dip)');
  assert(r.combinedBasePct != null && r.combinedWorstPct != null, 'combined solve converged');
});

test('motorStartAnalysis: divider matches I_LRA/(I_LRA+I_SC) on the source bus', () => {
  // Motor on the source bus: Zsys = source Z, so the closed-form divider is exact.
  const d = M.newDocument(); // 25 kA available, 480 V
  d.sourceBus.motors.push(Object.assign(M.newMotor(), { ratedHP: 500, lockedRotorAmps: 3000 }));
  const r = M.motorStartAnalysis(d)[0];
  // I_SC = 25000 A (source-only), I_LRA = 3000 A → dip = 3000/28000 = 10.714%
  assert(Math.abs(r.singularBasePct - (3000 / 28000) * 100) < 1e-6, `dip ${r.singularBasePct}`);
});

test('addToBus transformer3 creates secondary+tertiary; fault/load-flow indices line up', () => {
  const d = M.newDocument(); d.source.voltage = 13800;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer3');
  eq(sel.kind, 'element');
  const branch = M.findBranchByChild(d, sel.childBusId).branch;
  assert(branch.tertiaryBus, 'tertiary bus created');
  const secId = branch.bus.id;
  const terId = branch.tertiaryBus.id;

  const nom = M.nominalVoltages(d);
  eq(nom.get(secId), 4160);
  eq(nom.get(terId), 480);

  // Fault space: source 0, hidden star consumes 1, secondary 2, tertiary 3.
  const fi = M.faultBusIndices(d);
  eq(fi.get(d.sourceBus.id), 0); eq(fi.get(secId), 2); eq(fi.get(terId), 3);
  const nodes = M.buildCircuit(d).computeNominal().nodes;
  eq(nodes.length, 4);
  eq(nodes[fi.get(secId)].label, 'Secondary');
  eq(nodes[fi.get(terId)].label, 'Tertiary');

  // Load-flow space: no star — source 0, secondary 1, tertiary 2.
  const li = M.loadFlowBusIndices(d);
  eq(li.get(secId), 1); eq(li.get(terId), 2);

  // A tertiary motor sags the tertiary bus (load flow) and shows in motor-start.
  M.findBus(d, terId).motors.push(Object.assign(M.newMotor(), { ratedHP: 300 }));
  const lf = M.runLoadFlow(d).result;
  assert(lf.converged, 'load flow converges');
  assert(lf.nodes[li.get(terId)].voltageLL < 480, 'tertiary sags under load');
  const ms = M.motorStartAnalysis(d);
  eq(ms.length, 1);
  eq(ms[0].busLabel, 'Tertiary');
  assert(ms[0].singularBasePct > 0, 'tertiary motor start dip computed');
});

test('open breaker prunes its bus subtree from the engine math', () => {
  const d = M.newDocument();
  const c1 = M.addToBus(d, d.sourceBus.id, 'cable'); // source → bus A
  M.addToBus(d, c1.childBusId, 'cable');             // bus A → bus B
  eq(M.buildCircuit(d).computeNominal().nodes.length, 3);
  M.findBus(d, c1.childBusId).breakers.push(Object.assign(M.newBreaker(), { isOpen: true }));
  const pd = M.prunedDocument(d);
  eq(M.buildCircuit(pd).computeNominal().nodes.length, 1); // only the source bus remains
  assert(Math.abs(M.buildCircuit(pd).computeNominal().nodes[0].threePhaseFaultCurrentAmps - 25000) < 1e-6, 'source fault intact');
});

test('open breaker equals physically deleting the branch (results identical)', () => {
  const withOpen = M.newDocument();
  M.addToBus(withOpen, withOpen.sourceBus.id, 'cable');
  const f2 = M.addToBus(withOpen, withOpen.sourceBus.id, 'cable');
  M.findBus(withOpen, f2.childBusId).breakers.push(Object.assign(M.newBreaker(), { isOpen: true }));
  const oneFeeder = M.newDocument();
  M.addToBus(oneFeeder, oneFeeder.sourceBus.id, 'cable');
  const a = M.buildCircuit(M.prunedDocument(withOpen)).computeNominal().nodes.map((n) => n.threePhaseFaultCurrentAmps);
  const b = M.buildCircuit(oneFeeder).computeNominal().nodes.map((n) => n.threePhaseFaultCurrentAmps);
  eq(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert(Math.abs(a[i] - b[i]) < 1e-6, `node ${i}`);
});

test('open breaker drops its motor from load-flow, motor-start, and verdicts', () => {
  const d = M.newDocument();
  const c = M.addToBus(d, d.sourceBus.id, 'cable');
  const bus = M.findBus(d, c.childBusId);
  bus.motors.push(Object.assign(M.newMotor(), { ratedHP: 500 }));
  bus.breakers.push(Object.assign(M.newBreaker(), { isOpen: true }));
  const pd = M.prunedDocument(d);
  eq(M.hasLoadFlowInputs(pd), false);
  eq(M.motorStartAnalysis(pd).length, 0);
  eq(M.collectBreakers(pd).length, 0);
});

test('open breaker on a 3-winding secondary keeps the star + tertiary', () => {
  const d = M.newDocument(); d.source.voltage = 13800;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer3');
  const branch = M.findBranchByChild(d, sel.childBusId).branch;
  M.findBus(d, branch.bus.id).breakers.push(Object.assign(M.newBreaker(), { isOpen: true }));
  const nodes = M.buildCircuit(M.prunedDocument(d)).computeNominal().nodes;
  assert(!nodes.some((n) => n.label === 'Secondary'), 'secondary winding dropped');
  assert(nodes.some((n) => n.label === 'Tertiary'), 'tertiary winding still energized');
});

test('chainContext flags a transformer whose primary ≠ upstream bus', () => {
  const clean = M.newDocument(); clean.source.voltage = 480;
  const t = M.addToBus(clean, clean.sourceBus.id, 'transformer');
  const el = M.findBranchByChild(clean, t.childBusId).branch.element;
  el.primaryV = 480; el.secondaryV = 120; // primary matches 480 V source → clean
  eq(M.chainContext(M.prunedDocument(clean)).hasIssues, false);

  const bad = M.newDocument(); bad.source.voltage = 480;
  const t2 = M.addToBus(bad, bad.sourceBus.id, 'transformer');
  const el2 = M.findBranchByChild(bad, t2.childBusId).branch.element;
  el2.primaryV = 4160; el2.secondaryV = 480; // primary 4160 ≠ 480 V source → mismatch
  const ctx = M.chainContext(M.prunedDocument(bad));
  eq(ctx.hasIssues, true);
  // The transformer's downstream bus (fault index 1) is suspect.
  assert(ctx.suspectFaultIndices.has(1), 'downstream bus flagged suspect');
  assert(/primary nameplate is 4.16 kV/.test(ctx.messages[0]), `msg: ${ctx.messages[0]}`);
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb model tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
