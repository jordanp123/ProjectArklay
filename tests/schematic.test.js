// Schematic SVG smoke tests — the module is pure (no DOM), so it runs under
// jsc. Verifies it lays out every element type without throwing and emits the
// clickable data-selkind hooks the app relies on.

import * as M from '../js/model.js';
import { schematicSVG } from '../js/schematic.js';

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }

function richDoc() {
  const d = M.newDocument();
  d.source.voltage = 13800;
  // 3-winding transformer off the source bus (secondary + tertiary).
  const t3 = M.addToBus(d, d.sourceBus.id, 'transformer3');
  const secId = M.findBranchByChild(d, t3.childBusId).branch.bus.id;
  // A cable off the secondary → downstream bus with a motor, cap, breaker.
  const cab = M.addToBus(d, secId, 'cable');
  M.addToBus(d, cab.childBusId, 'motor');
  M.addToBus(d, cab.childBusId, 'capacitor');
  M.addToBus(d, cab.childBusId, 'breaker');
  return d;
}

test('schematicSVG renders every element type without throwing', () => {
  const d = richDoc();
  const svg = schematicSVG(d, { kind: 'source' }, M.nominalVoltages(d));
  assert(typeof svg === 'string' && svg.startsWith('<svg'), 'returns an <svg> string');
  for (const k of ['source', 'bus', 'element', 'motor', 'capacitor', 'breaker']) {
    assert(svg.includes(`data-selkind="${k}"`), `has a ${k} hit target`);
  }
});

test('schematicSVG marks the current selection (thicker/selected stroke)', () => {
  const d = richDoc();
  const busId = d.sourceBus.id;
  const svg = schematicSVG(d, { kind: 'bus', busId }, M.nominalVoltages(d));
  // The selected source-bus rail gets the accent color + width 6.
  assert(svg.includes(`data-busid="${busId}"`), 'selected bus present');
  assert(svg.includes('stroke-width="6"'), 'selected rail rendered thicker');
});

test('schematicSVG viewBox has positive dimensions', () => {
  const d = richDoc();
  const svg = schematicSVG(d, { kind: 'source' }, M.nominalVoltages(d));
  const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert(m, 'has a viewBox');
  assert(Number(m[1]) > 0 && Number(m[2]) > 0, 'positive width/height');
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb schematic tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
