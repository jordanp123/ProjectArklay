// Validation unit tests over the tree document. Runnable with node or jsc.

import { validate } from '../js/validation.js';
import * as M from '../js/model.js';

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failed++; failures.push(`${name}: ${e.message}`); } }
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }
const hasErr = (r, re) => r.errors.some((e) => re.test(e));
const hasWarn = (r, re) => r.warnings.some((w) => re.test(w));

const elementOf = (d, sel) => M.findBranchByChild(d, sel.childBusId).branch.element;

test('valid default document → no errors or warnings', () => {
  const r = validate(M.newDocument());
  assert(r.errors.length === 0, 'errors: ' + r.errors.join(' | '));
  assert(r.warnings.length === 0, 'warnings: ' + r.warnings.join(' | '));
});
test('zero source voltage → error', () => {
  const d = M.newDocument(); d.source.voltage = 0;
  assert(hasErr(validate(d), /voltage/i));
});
test('availableKA with kA 0 → error', () => {
  const d = M.newDocument(); d.source.kA = 0;
  assert(hasErr(validate(d), /kA/));
});
test('X/R = 0 → warning, not error', () => {
  const d = M.newDocument(); d.source.xOverR = 0;
  const r = validate(d);
  assert(r.errors.length === 0);
  assert(hasWarn(r, /X\/R = 0/));
});
test('cable blank length → error', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'cable');
  elementOf(d, sel).lengthFeet = '';
  assert(hasErr(validate(d), /length/i));
});
test('cable parallel 0 → error', () => {
  const d = M.newDocument();
  const sel = M.addToBus(d, d.sourceBus.id, 'cable');
  elementOf(d, sel).parallel = 0;
  assert(hasErr(validate(d), /parallel/i));
});
test('transformer primary mismatch → warning, not error', () => {
  const d = M.newDocument(); d.source.voltage = 480;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer');
  Object.assign(elementOf(d, sel), { primaryV: 4160, secondaryV: 480 });
  const r = validate(d);
  assert(r.errors.length === 0, 'errors: ' + r.errors.join(' | '));
  assert(hasWarn(r, /doesn.t match/i));
});
test('transformer secondary feeds the next element (no false mismatch)', () => {
  const d = M.newDocument(); d.source.voltage = 4160;
  const sel = M.addToBus(d, d.sourceBus.id, 'transformer');
  Object.assign(elementOf(d, sel), { primaryV: 4160, secondaryV: 480 });
  M.addToBus(d, sel.childBusId, 'cable');
  const r = validate(d);
  assert(r.errors.length === 0, 'errors: ' + r.errors.join(' | '));
  assert(r.warnings.length === 0, 'warnings: ' + r.warnings.join(' | '));
});
test('breaker bad trip → error', () => {
  const d = M.newDocument();
  M.addToBus(d, d.sourceBus.id, 'breaker');
  M.findBus(d, d.sourceBus.id).breakers[0].trip = 0;
  assert(hasErr(validate(d), /trip/i));
});
test('generator missing X″ → error', () => {
  const d = M.newDocument(); d.source.mode = 'generator'; d.source.genXdpp = 0;
  assert(hasErr(validate(d), /subtransient/i));
});

const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb validation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) log('  FAIL ' + f); }
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
