// Engine unit tests — runnable with `node tests/engine.test.js` (or `npm test`).
// Pins the engine to known reference values (handbook + IEEE 141 / C37.010
// worked examples) so the calculations can't silently drift.

import { Impedance } from '../js/engine/impedance.js';
import { Phasor } from '../js/engine/phasor.js';
import { SQRT3 } from '../js/engine/constants.js';
import { Source } from '../js/engine/source.js';
import { CableSegment } from '../js/engine/cable.js';
import { Transformer } from '../js/engine/transformer.js';
import { Motor } from '../js/engine/motor.js';
import { Load } from '../js/engine/load.js';
import { ConductorMaterial } from '../js/engine/conductorMaterial.js';
import { firstCycleAsymmetryMultiplier, firstHalfCyclePeakFactor } from '../js/engine/asymmetry.js';
import { arcingFaultFactor } from '../js/engine/arcingFaultFactor.js';

// ── Tiny assert framework ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}
function approx(actual, expected, tol, msg = '') {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg} expected ${expected} ± ${tol}, got ${actual}`);
  }
}
function eq(actual, expected, msg = '') {
  if (actual !== expected) throw new Error(`${msg} expected ${expected}, got ${actual}`);
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }

/** Symmetric three-phase bolted current from an impedance magnitude. */
function threePhase(vLL, zMag) {
  return vLL / (SQRT3 * zMag);
}

// ── Impedance / Phasor ─────────────────────────────────────────────────
test('Impedance.magnitude', () => approx(new Impedance(3, 4).magnitude, 5, 1e-12));
test('Impedance.xOverR reactive-only → Infinity', () => eq(new Impedance(0, 1).xOverR, Infinity));
test('Impedance.xOverR zero → 0', () => eq(new Impedance(0, 0).xOverR, 0));
test('Impedance.from(mag,xr) round-trips magnitude', () => {
  const z = Impedance.from(0.05, 8);
  approx(z.magnitude, 0.05, 1e-12);
  approx(z.xOverR, 8, 1e-9);
});
test('Impedance.parallel of equal Z halves it', () => {
  const z = Impedance.parallel(new Impedance(0, 2), new Impedance(0, 2));
  approx(z.magnitude, 1, 1e-12);
});
test('Phasor V = I·Z (Ohm law)', () => {
  const v = new Phasor(10, 0).timesImpedance(new Impedance(0, 2)); // 10A ∠0 × j2Ω
  approx(v.real, 0, 1e-12);
  approx(v.imaginary, 20, 1e-12);
});

// ── Load (constant power + locked rotor) ───────────────────────────────
test('Load.motor 100HP 480V → 114.7A', () =>
  approx(Load.motor(100, 0.92, 0.85).currentMagnitude(480), 114.7, 0.5));
test('Load.motor 200HP 4160V → 25.3A', () =>
  approx(Load.motor(200, 0.93, 0.88).currentMagnitude(4160), 25.3, 0.3));
test('Load constant-power scaling: I(0.9V)/I(V) = 1/0.9', () => {
  const l = Load.motor(100, 0.92, 0.85);
  approx(l.currentMagnitude(480 * 0.9) / l.currentMagnitude(480), 1 / 0.9, 1e-9);
});
test('Load.realPower 100kW 480V PF0.9 → 133.6A', () =>
  approx(Load.realPower(100, 0.9).currentMagnitude(480), 133.6, 0.3));
test('Load.apparentPower 100kVA 480V → 120.28A (PF-independent)', () => {
  approx(Load.apparentPower(100, 0.6).currentMagnitude(480), 120.28, 0.05);
  approx(Load.apparentPower(100, 1.0).currentMagnitude(480), 120.28, 0.05);
});
test('Load.lockedRotor constant-impedance: 1000A at rated, 900A at 0.9V', () => {
  const l = Load.lockedRotor(1000, 480, 0.2);
  approx(l.currentMagnitude(480), 1000, 1e-9);
  approx(l.currentMagnitude(480 * 0.9), 900, 1e-9);
});
test('Load non-positive voltage → 0', () =>
  eq(Load.motor(100, 0.92, 0.85).currentMagnitude(0), 0));

// ── Asymmetry multipliers (IEEE 141 §3.5 spot values) ──────────────────
test('asymmetry RMS X/R spot values', () => {
  approx(firstCycleAsymmetryMultiplier(5), 1.253, 0.001);
  approx(firstCycleAsymmetryMultiplier(10), 1.438, 0.001);
  approx(firstCycleAsymmetryMultiplier(17), 1.543, 0.001);
  approx(firstCycleAsymmetryMultiplier(25), 1.599, 0.001);
  approx(firstCycleAsymmetryMultiplier(50), 1.663, 0.001);
});
test('asymmetry RMS limits', () => {
  approx(firstCycleAsymmetryMultiplier(0), 1.0, 1e-12);
  approx(firstCycleAsymmetryMultiplier(Infinity), SQRT3, 1e-12);
});
test('peak factor X/R spot values', () => {
  approx(firstHalfCyclePeakFactor(5), 2.169, 0.001);
  approx(firstHalfCyclePeakFactor(10), 2.447, 0.001);
  approx(firstHalfCyclePeakFactor(17), 2.590, 0.001);
  approx(firstHalfCyclePeakFactor(25), 2.661, 0.001);
});

// ── Arcing fault factor (MSHA buckets) ─────────────────────────────────
test('arcing factor voltage buckets', () => {
  eq(arcingFaultFactor(480), 0.85);
  eq(arcingFaultFactor(600), 0.90);
  eq(arcingFaultFactor(1040), 0.95);
  eq(arcingFaultFactor(4160), 1.0);
});
test('arcing factor NaN/0 → most conservative 0.85', () => {
  eq(arcingFaultFactor(NaN), 0.85);
  eq(arcingFaultFactor(0), 0.85);
});

// ── Source impedance + resulting fault current ─────────────────────────
test('Source.fromAvailableKA 480V 18kA X/R8 → |Z| and 18kA bus fault', () => {
  const s = Source.fromAvailableKA(480, 18, 8);
  approx(s.impedance.magnitude, 480 / (SQRT3 * 18000), 1e-12);
  approx(threePhase(480, s.impedance.magnitude), 18000, 1e-6);
});
test('Source.fromAvailableMVA 480V 100MVA X/R10 → |Z|', () => {
  const s = Source.fromAvailableMVA(480, 100, 10);
  approx(s.impedance.magnitude, (480 * 480) / 100e6, 1e-12);
});
test('Source.infiniteBus → zero impedance', () =>
  eq(Source.infiniteBus(480).impedance.magnitude, 0));
test('Source bad input → infinite impedance (conservative)', () =>
  eq(Source.fromAvailableKA(0, 18, 8).impedance.magnitude, Infinity));

// ── Cable temperature correction ───────────────────────────────────────
test('Cable impedance at 25°C and 90°C (copper)', () => {
  const c = new CableSegment({
    lengthFeet: 100, resistancePerKFTAtReference: 0.0810, reactancePerKFT: 0.041,
    conductorMaterial: ConductorMaterial.copper,
  });
  approx(c.impedanceAt(25).resistance, 0.00810, 1e-9);
  approx(c.impedanceAt(90).resistance, 0.00810 * (234.5 + 90) / (234.5 + 25), 1e-9);
  approx(c.impedanceAt(90).reactance, 0.0041, 1e-12); // X is temperature-independent
});
test('Cable parallelCount divides R and X', () => {
  const c = new CableSegment({
    lengthFeet: 1000, resistancePerKFTAtReference: 0.1, reactancePerKFT: 0.04, parallelCount: 2,
  });
  approx(c.impedanceAt(25).resistance, 0.05, 1e-12);
  approx(c.impedanceAt(25).reactance, 0.02, 1e-12);
});
test('Cable zero length → infinite (not zero) impedance', () => {
  const c = new CableSegment({ lengthFeet: 0, resistancePerKFTAtReference: 0.1, reactancePerKFT: 0.04 });
  eq(c.impedanceAt(25).resistance, Infinity);
});

// ── Transformer secondary impedance + bolted fault (infinite source) ────
test('Transformer 1000kVA 480 5.75% → |Z| and secondary bolted fault', () => {
  const t = new Transformer({
    ratedKVA: 1000, primaryVoltageLL: 4160, secondaryVoltageLL: 480,
    percentImpedance: 5.75, xOverR: 5,
  });
  const zMag = (480 * 480 * 0.0575) / 1e6;
  approx(t.impedanceReferredToSecondary.magnitude, zMag, 1e-12);
  approx(threePhase(480, zMag), 20918, 2); // ≈ 20.9 kA
});
test('Transformer voltageRatioSquared', () => {
  const t = new Transformer({
    ratedKVA: 1000, primaryVoltageLL: 4160, secondaryVoltageLL: 480,
    percentImpedance: 5.75, xOverR: 5,
  });
  approx(t.voltageRatioSquared, (480 / 4160) ** 2, 1e-15);
});

// ── Motor subtransient impedance ───────────────────────────────────────
test('Motor subtransient Z″ = X″·V²/(kVA·1000)', () => {
  const m = new Motor({ ratedKVA: 500, ratedVoltageLL: 480, subtransientReactancePU: 0.167 });
  approx(m.subtransientImpedance.reactance, (0.167 * 480 * 480) / (500 * 1000), 1e-12);
  eq(m.subtransientImpedance.resistance, 0);
});
test('Motor disabled (kVA 0) → zero impedance', () =>
  eq(new Motor({ ratedKVA: 0, ratedVoltageLL: 480, subtransientReactancePU: 0.167 })
    .subtransientImpedance.magnitude, 0));

// ── Circuit reduction (radial + transformer referral) ──────────────────
import { Circuit, CircuitBus, cableElement, transformerElement, threeWindingElement } from '../js/engine/circuit.js';
import { evaluateBreaker, minimumShortCircuitAmps, BreakerVerdict } from '../js/engine/breakerAnalysis.js';
import { FaultType as FT } from '../js/engine/faultType.js';
import { Capacitor } from '../js/engine/capacitor.js';
import { ThreeWindingTransformer } from '../js/engine/threeWindingTransformer.js';

test('Circuit: source-only bus fault equals the available kA', () => {
  const c = new Circuit(Source.fromAvailableKA(480, 18, 8), new CircuitBus('Source'));
  const r = c.computeNominal();
  eq(r.nodes.length, 1);
  approx(r.nodes[0].threePhaseFaultCurrentAmps, 18000, 1e-6);
});

test('Circuit: L-L fault is √3/2 of three-phase', () => {
  const c = new Circuit(Source.fromAvailableKA(480, 18, 8), new CircuitBus('Source'));
  const n = c.computeNominal().nodes[0];
  approx(n.lineToLineFaultCurrentAmps / n.threePhaseFaultCurrentAmps, SQRT3 / 2, 1e-9);
});

test('Circuit: infinite bus → transformer secondary bolted fault ≈ 20.9 kA', () => {
  const t = new Transformer({
    ratedKVA: 1000, primaryVoltageLL: 4160, secondaryVoltageLL: 480,
    percentImpedance: 5.75, xOverR: 5,
  });
  const root = new CircuitBus('Source', [{ element: transformerElement(t), bus: new CircuitBus('Secondary') }]);
  const r = new Circuit(Source.infiniteBus(4160), root).computeNominal();
  eq(r.nodes.length, 2);
  eq(r.nodes[1].label, 'Secondary');
  eq(r.nodes[1].voltageLL, 480);
  approx(r.nodes[1].threePhaseFaultCurrentAmps, 20919, 3);
});

test('Circuit: series cable after transformer lowers fault current', () => {
  const t = new Transformer({
    ratedKVA: 1000, primaryVoltageLL: 4160, secondaryVoltageLL: 480,
    percentImpedance: 5.75, xOverR: 5,
  });
  const cable = new CableSegment({
    lengthFeet: 100, resistancePerKFTAtReference: 0.0810, reactancePerKFT: 0.041,
  });
  const end = new CircuitBus('End');
  const secondary = new CircuitBus('Secondary', [{ element: cableElement(cable), bus: end }]);
  const root = new CircuitBus('Source', [{ element: transformerElement(t), bus: secondary }]);
  const r = new Circuit(Source.infiniteBus(4160), root).computeNominal();
  const [, sec, endN] = r.nodes;
  if (!(endN.threePhaseFaultCurrentAmps < sec.threePhaseFaultCurrentAmps)) {
    throw new Error('cable must reduce downstream fault current');
  }
  approx(endN.threePhaseFaultCurrentAmps, 13744, 60); // hand-computed
});

test('Circuit: asymmetric current exceeds symmetric', () => {
  const c = new Circuit(Source.fromAvailableKA(480, 18, 8), new CircuitBus('Source'));
  const n = c.computeNominal().nodes[0];
  if (!(n.asymmetricalThreePhaseFaultCurrentAmps > n.threePhaseFaultCurrentAmps)) {
    throw new Error('asymmetric must exceed symmetric for X/R > 0');
  }
});

test('Circuit: min-SC (hot) is below max-SC (cold) with a cable present', () => {
  const cable = new CableSegment({
    lengthFeet: 500, resistancePerKFTAtReference: 0.0810, reactancePerKFT: 0.041,
  });
  const root = new CircuitBus('Source', [{ element: cableElement(cable), bus: new CircuitBus('End') }]);
  const c = new Circuit(Source.fromAvailableKA(480, 25, 6), root);
  const cold = c.computeNominal().nodes[1].threePhaseFaultCurrentAmps;
  const hotNode = c.computeMaxTemperature().nodes[1];
  const minSC = minimumShortCircuitAmps(hotNode);
  if (!(hotNode.threePhaseFaultCurrentAmps < cold)) throw new Error('hot cable → lower fault current');
  if (!(minSC < hotNode.threePhaseFaultCurrentAmps)) throw new Error('derates must lower min-SC further');
});

// ── Breaker verdict ────────────────────────────────────────────────────
test('Breaker: huge margin → PASS, unreachable trip → willNotTrip', () => {
  const c = new Circuit(Source.fromAvailableKA(480, 25, 6), new CircuitBus('Source'));
  const node = c.computeMaxTemperature().nodes[0];
  eq(evaluateBreaker({ instantaneousTripAmps: 800, tolerancePercent: 25 }, node).verdict, BreakerVerdict.pass);
  eq(evaluateBreaker({ instantaneousTripAmps: 5e6, tolerancePercent: 25 }, node).verdict, BreakerVerdict.willNotTrip);
});
test('Breaker: non-positive trip → willNotTrip (conservative)', () => {
  const c = new Circuit(Source.fromAvailableKA(480, 25, 6), new CircuitBus('Source'));
  const node = c.computeMaxTemperature().nodes[0];
  eq(evaluateBreaker({ instantaneousTripAmps: 0, tolerancePercent: 25 }, node).verdict, BreakerVerdict.willNotTrip);
});

// ── Motor fault contributions (Thévenin reduction) ─────────────────────
function inductionMotor(hp = 1000, v = 480) {
  return new Motor({ ratedKVA: hp, ratedVoltageLL: v, subtransientReactancePU: 0.167, interruptingReactanceMultiplier: 3.0, contributesToInterrupting: true });
}
const kaSource = () => Source.fromAvailableKA(480, 25, 8);

test('Motor on the fault bus raises the nominal (max-SC) fault current', () => {
  const withM = new Circuit(kaSource(), new CircuitBus('Src', [], [inductionMotor()])).computeNominal().nodes[0];
  const without = new Circuit(kaSource(), new CircuitBus('Src')).computeNominal().nodes[0];
  if (!(withM.threePhaseFaultCurrentAmps > without.threePhaseFaultCurrentAmps + 1000)) {
    throw new Error(`motor must raise fault current: ${withM.threePhaseFaultCurrentAmps} vs ${without.threePhaseFaultCurrentAmps}`);
  }
});
test('Motors are excluded from minimum SC (maxOperating)', () => {
  const withM = new Circuit(kaSource(), new CircuitBus('Src', [], [inductionMotor()])).computeMaxTemperature().nodes[0];
  const without = new Circuit(kaSource(), new CircuitBus('Src')).computeMaxTemperature().nodes[0];
  approx(withM.threePhaseFaultCurrentAmps, without.threePhaseFaultCurrentAmps, 1e-6, 'min-SC ignores motors');
});
test('Interrupting motor contribution is between source-only and first-cycle', () => {
  const c = new Circuit(kaSource(), new CircuitBus('Src', [], [inductionMotor()]));
  const nom = c.computeNominal().nodes[0].threePhaseFaultCurrentAmps;
  const int = c.computeInterrupting().nodes[0].threePhaseFaultCurrentAmps;
  const src = new Circuit(kaSource(), new CircuitBus('Src')).computeInterrupting().nodes[0].threePhaseFaultCurrentAmps;
  if (!(int < nom && int > src)) throw new Error(`expected src(${src}) < int(${int}) < nom(${nom})`);
});
test('Small-motor group (contributesToInterrupting=false) is skipped in interrupting', () => {
  const grp = new Motor({ ratedKVA: 1000, ratedVoltageLL: 480, subtransientReactancePU: 0.28, interruptingReactanceMultiplier: 1.5, contributesToInterrupting: false });
  const int = new Circuit(kaSource(), new CircuitBus('Src', [], [grp])).computeInterrupting().nodes[0].threePhaseFaultCurrentAmps;
  const src = new Circuit(kaSource(), new CircuitBus('Src')).computeInterrupting().nodes[0].threePhaseFaultCurrentAmps;
  approx(int, src, 1e-6, 'excluded group must not change interrupting');
});
test('Downstream motor contributes to an upstream fault (through the cable path)', () => {
  const cable = () => new CableSegment({ lengthFeet: 200, resistancePerKFTAtReference: 0.081, reactancePerKFT: 0.041 });
  const withM = new Circuit(kaSource(), new CircuitBus('Src', [{ element: cableElement(cable()), bus: new CircuitBus('Load', [], [inductionMotor()]) }]))
    .computeNominal().nodes[0].threePhaseFaultCurrentAmps;
  const without = new Circuit(kaSource(), new CircuitBus('Src', [{ element: cableElement(cable()), bus: new CircuitBus('Load') }]))
    .computeNominal().nodes[0].threePhaseFaultCurrentAmps;
  if (!(withM > without)) throw new Error(`downstream motor should raise upstream fault: ${withM} vs ${without}`);
});
test('No-motor circuit: thevenin equals cumulative (results unchanged)', () => {
  const n = new Circuit(kaSource(), new CircuitBus('Src')).computeNominal().nodes[0];
  approx(n.threePhaseFaultCurrentAmps, 25000, 1e-6);
});

// ── Load flow (iterative backward-forward sweep) ───────────────────────
function lfCable(lengthFeet = 500, r = 0.081, x = 0.041) {
  return new CableSegment({ lengthFeet, resistancePerKFTAtReference: r, reactancePerKFT: x, referenceTemperatureC: 25, maxOperatingTemperatureC: 25 });
}
test('LoadFlow: no loads/caps → every bus sits at nominal, converged', () => {
  const root = new CircuitBus('Src', [{ element: cableElement(lfCable()), bus: new CircuitBus('End') }]);
  const f = new Circuit(Source.infiniteBus(480), root).loadFlow({ temperatureC: 25 });
  if (!f.converged) throw new Error('no-injection solve should converge');
  approx(f.nodes[0].voltageLL, 480, 1e-6, 'source at nominal');
  approx(f.nodes[1].voltageLL, 480, 1e-6, 'end at nominal (no load)');
  approx(f.nodes[1].percentDropFromNominal, 0, 1e-9);
});
test('LoadFlow: resistive divider matches the closed-form drop', () => {
  // Infinite bus, 0.1 Ω pure-R cable, 100 kW @ unity PF on the end bus.
  // Closed form: V² − 480V + 10000 = 0 → V_LL ≈ 458.18 V.
  const root = new CircuitBus('Src', [{ element: cableElement(lfCable(1000, 0.1, 0)), bus: new CircuitBus('End') }]);
  const f = new Circuit(Source.infiniteBus(480), root).loadFlow({
    loads: [{ busIndex: 1, load: Load.realPower(100, 1.0) }], temperatureC: 25,
  });
  if (!f.converged) throw new Error('resistive divider should converge');
  approx(f.nodes[0].voltageLL, 480, 1e-6, 'source bus holds (zero source Z)');
  approx(f.nodes[1].voltageLL, 458.18, 0.1, 'end-bus voltage');
  approx(f.nodes[1].percentDropFromNominal, 4.546, 0.02, 'percent drop');
});
test('LoadFlow: a lagging load sags the downstream bus below nominal', () => {
  const root = new CircuitBus('Src', [{ element: cableElement(lfCable(600)), bus: new CircuitBus('MCC') }]);
  const f = new Circuit(Source.fromAvailableMVA(480, 250, 8), root).loadFlow({
    loads: [{ busIndex: 1, load: Load.motor(600, 0.92, 0.85) }], temperatureC: 25,
  });
  if (!f.converged) throw new Error('loaded solve should converge');
  if (!(f.nodes[1].percentDropFromNominal > 0.5)) throw new Error(`expected a sag, got ${f.nodes[1].percentDropFromNominal}%`);
});
test('LoadFlow: a PFC capacitor reduces the voltage drop', () => {
  const mk = (caps) => {
    const root = new CircuitBus('Src', [{ element: cableElement(lfCable(600)), bus: new CircuitBus('MCC') }]);
    return new Circuit(Source.fromAvailableMVA(480, 250, 8), root).loadFlow({
      loads: [{ busIndex: 1, load: Load.motor(600, 0.92, 0.85) }], capacitors: caps, temperatureC: 25,
    });
  };
  const noCap = mk([]).nodes[1].percentDropFromNominal;
  const withCap = mk([{ busIndex: 1, capacitor: new Capacitor({ ratedKVAR: 200, ratedVoltageLL: 0 }) }]).nodes[1].percentDropFromNominal;
  if (!(withCap < noCap)) throw new Error(`cap should improve the drop: ${withCap}% vs ${noCap}%`);
});
test('LoadFlow: no-load PFC cap raises the bus above nominal (voltage rise)', () => {
  const root = new CircuitBus('Src', [{ element: cableElement(lfCable(600)), bus: new CircuitBus('MCC') }]);
  const f = new Circuit(Source.fromAvailableMVA(480, 250, 8), root).loadFlow({
    capacitors: [{ busIndex: 1, capacitor: new Capacitor({ ratedKVAR: 300, ratedVoltageLL: 0 }) }], temperatureC: 25,
  });
  if (!(f.nodes[1].percentDropFromNominal < 0)) throw new Error(`cap-only should raise voltage, got ${f.nodes[1].percentDropFromNominal}%`);
});

// ── Three-winding transformer (star-node expansion) ───────────────────
// The star network is exact: a secondary fault sees Z_HX, a tertiary fault
// sees Z_HY, and a tertiary motor feeds a secondary fault via Z_XY.
const T3_PRI = 13800, T3_SEC = 4160, T3_TER = 480;
const t3SourceZ = () => new Impedance(0.05, 0.5);
function makeT3() {
  return new ThreeWindingTransformer({
    ratedKVA: 10000, tertiaryKVA: 10000,
    primaryVoltageLL: T3_PRI, secondaryVoltageLL: T3_SEC, tertiaryVoltageLL: T3_TER,
    percentImpedanceHX: 7.0, xOverRHX: 10.0, percentImpedanceHY: 6.0, xOverRHY: 8.0, percentImpedanceXY: 5.0, xOverRXY: 6.0,
  });
}
function t3Circuit(tertiaryMotors = []) {
  const t3 = makeT3();
  const secondaryBus = new CircuitBus('Secondary');
  const tertiaryBus = new CircuitBus('Tertiary', [], tertiaryMotors);
  const root = new CircuitBus('Source', [{ element: threeWindingElement(t3), bus: secondaryBus, tertiaryBus }]);
  return { circuit: new Circuit(Source.withImpedance(T3_PRI, t3SourceZ()), root), t3 };
}
const refer3 = (z, fromV, toV) => { const n2 = (toV / fromV) * (toV / fromV); return new Impedance(z.resistance * n2, z.reactance * n2); };

test('T3 star legs reconstruct the pairwise impedances Z_HX/Z_HY/Z_XY', () => {
  const t = makeT3();
  const hx = t.primaryStarLegPU.add(t.secondaryStarLegPU);
  const hy = t.primaryStarLegPU.add(t.tertiaryStarLegPU);
  const xy = t.secondaryStarLegPU.add(t.tertiaryStarLegPU);
  approx(hx.magnitude, 0.07, 1e-12, 'Z_HX'); approx(hy.magnitude, 0.06, 1e-12, 'Z_HY'); approx(xy.magnitude, 0.05, 1e-12, 'Z_XY');
});
test('T3 expands into source + star + secondary + tertiary (one synthetic)', () => {
  const r = t3Circuit().circuit.computeNominal();
  eq(r.nodes.length, 4);
  eq(r.nodes.filter((n) => n.isSynthetic).length, 1);
  assert(r.nodes.some((n) => n.label === 'Secondary' && !n.isSynthetic), 'secondary bus');
  assert(r.nodes.some((n) => n.label === 'Tertiary' && !n.isSynthetic), 'tertiary bus');
});
test('T3 secondary-bus fault path equals source + Z_HX', () => {
  const { circuit, t3 } = t3Circuit();
  const sec = circuit.computeNominal().nodes.find((n) => n.label === 'Secondary');
  const zHX = t3.primaryStarLegReferredToSecondary.add(t3.secondaryStarLegReferredToSecondary);
  const expected = refer3(t3SourceZ(), T3_PRI, T3_SEC).add(zHX);
  approx(sec.cumulativeImpedance.resistance, expected.resistance, 1e-9, 'R');
  approx(sec.cumulativeImpedance.reactance, expected.reactance, 1e-9, 'X');
});
test('T3 tertiary-bus fault path equals source + Z_HY', () => {
  const { circuit, t3 } = t3Circuit();
  const ter = circuit.computeNominal().nodes.find((n) => n.label === 'Tertiary');
  const zHY = t3.primaryStarLegPU.add(t3.tertiaryStarLegPU).scale(t3.baseImpedanceOhms(T3_TER));
  const expected = refer3(t3SourceZ(), T3_PRI, T3_TER).add(zHY);
  approx(ter.cumulativeImpedance.resistance, expected.resistance, 1e-9, 'R');
  approx(ter.cumulativeImpedance.reactance, expected.reactance, 1e-9, 'X');
});
test('T3 tertiary motor feeds a secondary fault through Z_XY (exact parallel)', () => {
  const motor = new Motor({ ratedKVA: 2000, ratedVoltageLL: T3_TER, subtransientReactancePU: 0.167 });
  const { circuit, t3 } = t3Circuit([motor]);
  const sec = circuit.computeNominal().nodes.find((n) => n.label === 'Secondary');
  if (!(sec.theveninImpedance.magnitude < sec.cumulativeImpedance.magnitude)) throw new Error('tertiary motor must raise the secondary fault');
  const zXYrefSec = t3.secondaryStarLegPU.add(t3.tertiaryStarLegPU).scale(t3.baseImpedanceOhms(T3_SEC));
  const zMotorEq = refer3(motor.subtransientImpedance, T3_TER, T3_SEC).add(zXYrefSec);
  const expected = Impedance.parallel(sec.cumulativeImpedance, zMotorEq);
  approx(sec.theveninImpedance.resistance, expected.resistance, 1e-6, 'R');
  approx(sec.theveninImpedance.reactance, expected.reactance, 1e-6, 'X');
});
test('T3 min-SC secondary ignores the tertiary motor', () => {
  const withM = t3Circuit([new Motor({ ratedKVA: 2000, ratedVoltageLL: T3_TER, subtransientReactancePU: 0.167 })])
    .circuit.computeMaxTemperature().nodes.find((n) => n.label === 'Secondary');
  const without = t3Circuit().circuit.computeMaxTemperature().nodes.find((n) => n.label === 'Secondary');
  approx(withM.threePhaseFaultCurrentAmps, without.threePhaseFaultCurrentAmps, 1e-6);
});

// ── Report (runtime-agnostic: node uses console, jsc uses print) ────────
const log = (typeof print === 'function') ? print : console.log;
log(`\nSCMEWeb engine tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) log('  FAIL ' + f);
}
if (failed > 0 && typeof process !== 'undefined' && process.exit) process.exit(1);
