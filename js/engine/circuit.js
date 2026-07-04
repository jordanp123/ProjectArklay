// Fault-current reduction over a radial / branched circuit tree.
//
// The tree flattens (pre-order DFS) into one entry per bus, each carrying the
// source-to-bus series impedance in that bus's own voltage frame. At each
// candidate fault bus the Thévenin equivalent is the parallel combination of
// the source path with every motor's equivalent impedance (motor Z referred
// to the fault bus + the path impedance from the motor's bus to the fault
// bus, via their lowest common ancestor).
//
// Modes:
//   • nominal      (max SC): source subtransient Z, cables cold, + motors ×1
//   • maxOperating (min SC): source transient Z, cables hot, motors EXCLUDED
//   • interrupting (5-cycle): source subtransient Z, cables cold, + motors
//                             × interruptingReactanceMultiplier (some skipped)
//
// Shunt capacitors are neglected in the fault network per IEEE 141 / C37.010.
// Three-winding transformers are not yet modeled here (added later).

import { Impedance } from './impedance.js';
import { SQRT3 } from './constants.js';
import { FaultType } from './faultType.js';
import { firstCycleAsymmetryMultiplier } from './asymmetry.js';
import { Phasor } from './phasor.js';

/** A bus in the circuit tree. `children` are `{ element, bus }` branches;
 *  `motors` are engine `Motor` instances that feed max-SC / interrupting. */
export class CircuitBus {
  constructor(label, children = [], motors = []) {
    this.label = label;
    this.children = children;
    this.motors = motors;
  }
}

export function cableElement(cable) { return { kind: 'cable', spec: cable }; }
export function transformerElement(transformer) { return { kind: 'transformer', spec: transformer }; }
export function threeWindingElement(t3) { return { kind: 'transformer3', spec: t3 }; }

/**
 * Per-bus fault result. `cumulativeImpedance` is the source-path series Z
 * (no motor contribution — the |Z| diagnostic + min-SC basis);
 * `theveninImpedance` is the composite (source ∥ motors) that the displayed
 * fault currents and the asymmetry X/R come from.
 */
export class NodeResult {
  constructor({ label, voltageLL, cumulativeImpedance, theveninImpedance, depth = 0, isSynthetic = false }) {
    this.label = label;
    this.voltageLL = voltageLL;
    this.cumulativeImpedance = cumulativeImpedance;
    this.theveninImpedance = theveninImpedance ?? cumulativeImpedance;
    this.depth = depth;
    this.isSynthetic = isSynthetic;
  }

  get threePhaseFaultCurrentAmps() {
    const z = this.theveninImpedance.magnitude;
    return z > 0 ? this.voltageLL / (SQRT3 * z) : Infinity;
  }
  get lineToLineFaultCurrentAmps() {
    const z = this.theveninImpedance.magnitude;
    return z > 0 ? this.voltageLL / (2.0 * z) : Infinity;
  }
  get asymmetricalThreePhaseFaultCurrentAmps() {
    return this.threePhaseFaultCurrentAmps * firstCycleAsymmetryMultiplier(this.theveninImpedance.xOverR);
  }
  get asymmetricalLineToLineFaultCurrentAmps() {
    return this.lineToLineFaultCurrentAmps * firstCycleAsymmetryMultiplier(this.theveninImpedance.xOverR);
  }
  faultCurrentAmps(faultType) {
    return faultType === FaultType.lineToLine ? this.lineToLineFaultCurrentAmps : this.threePhaseFaultCurrentAmps;
  }
}

export class CircuitResults {
  constructor(nodes) { this.nodes = nodes; }
}

const Mode = Object.freeze({ nominal: 'nominal', maxOperating: 'maxOperating', interrupting: 'interrupting' });

export class Circuit {
  constructor(source, rootBus) {
    this.source = source;
    this.rootBus = rootBus;
  }

  computeNominal() { return this._compute(Mode.nominal); }
  computeMaxTemperature() { return this._compute(Mode.maxOperating); }
  computeInterrupting() { return this._compute(Mode.interrupting); }

  _compute(mode) {
    const entries = this._buildEntries(mode);
    const nodes = entries.map((e, i) => {
      const { current, thevenin } = this._totalFaultCurrent(i, entries, mode);
      return new NodeResult({
        label: e.label, voltageLL: e.voltageLL, cumulativeImpedance: e.cumulativeZ,
        theveninImpedance: thevenin, depth: e.depth, faultCurrentAmps: current, isSynthetic: e.isSynthetic,
      });
    });
    return new CircuitResults(nodes);
  }

  _buildEntries(mode) {
    const sourceZ = mode === Mode.maxOperating ? this.source.transientImpedance : this.source.subtransientImpedance;
    const entries = [];
    entries.push({ label: this.rootBus.label, parentIndex: -1, depth: 0, voltageLL: this.source.lineToLineVoltage, cumulativeZ: sourceZ, motors: this.rootBus.motors, isSynthetic: false });
    this._appendChildren(this.rootBus, 0, 0, sourceZ, this.source.lineToLineVoltage, mode, entries);
    return entries;
  }

  _appendChildren(bus, parentIndex, parentDepth, parentZ, parentV, mode, entries) {
    for (const branch of bus.children) {
      const { element, bus: childBus, tertiaryBus, secondaryLive } = branch;
      // A three-winding transformer expands into a hidden star node with the
      // secondary and tertiary winding subtrees as its children.
      if (element.kind === 'transformer3') {
        this._appendThreeWinding(element.spec, childBus, tertiaryBus, secondaryLive !== false, parentIndex, parentDepth, parentZ, parentV, mode, entries);
        continue;
      }
      let childZ;
      let childV;
      if (element.kind === 'transformer') {
        const t = element.spec;
        childZ = parentZ.scale(t.voltageRatioSquared).add(t.impedanceReferredToSecondary);
        childV = t.secondaryVoltageLL;
      } else {
        const c = element.spec;
        childZ = parentZ.add(mode === Mode.maxOperating ? c.impedanceAtMaxTemperature : c.impedanceAtReference);
        childV = parentV;
      }
      const myIndex = entries.length;
      entries.push({ label: childBus.label, parentIndex, depth: parentDepth + 1, voltageLL: childV, cumulativeZ: childZ, motors: childBus.motors, isSynthetic: false });
      this._appendChildren(childBus, myIndex, parentDepth + 1, childZ, childV, mode, entries);
    }
  }

  /**
   * Expand a three-winding transformer into a hidden star node (in the
   * secondary frame, carrying the primary leg Z_H) plus its secondary (via
   * Z_X) and tertiary (via Z_Y) winding subtrees. A secondary-bus fault then
   * sees Z_H+Z_X = Z_HX, a tertiary-bus fault sees Z_H+Z_Y = Z_HY, and a
   * cross-winding contribution (e.g. a tertiary motor feeding a secondary
   * fault) travels Z_X+Z_Y = Z_XY via the general LCA reduction.
   */
  _appendThreeWinding(t3, secondaryBus, tertiaryBus, secondaryLive, parentIndex, parentDepth, parentZ, parentV, mode, entries) {
    const secV = t3.secondaryVoltageLL;
    const terV = t3.tertiaryVoltageLL;
    const childDepth = parentDepth + 1;

    // 1) Hidden star node, in the secondary voltage frame. Always emitted (the
    //    tertiary hangs off it) even when the secondary winding is de-energized.
    const starZ = referImpedance(parentZ, parentV, secV).add(t3.primaryStarLegReferredToSecondary);
    const starIndex = entries.length;
    entries.push({ label: `${secondaryBus.label} · transformer star`, parentIndex, depth: childDepth, voltageLL: secV, cumulativeZ: starZ, motors: [], isSynthetic: true });

    // 2) Secondary winding bus (child of the star) — omitted if its feeder is open.
    if (secondaryLive) {
      const secZ = starZ.add(t3.secondaryStarLegReferredToSecondary);
      const secIndex = entries.length;
      entries.push({ label: secondaryBus.label, parentIndex: starIndex, depth: childDepth, voltageLL: secV, cumulativeZ: secZ, motors: secondaryBus.motors, isSynthetic: false });
      this._appendChildren(secondaryBus, secIndex, childDepth, secZ, secV, mode, entries);
    }

    // 3) Tertiary winding bus (child of the star), referred to the tertiary frame.
    if (!tertiaryBus) return;
    const terZ = referImpedance(starZ, secV, terV).add(t3.tertiaryStarLegReferredToTertiary);
    const terIndex = entries.length;
    entries.push({ label: tertiaryBus.label, parentIndex: starIndex, depth: childDepth, voltageLL: terV, cumulativeZ: terZ, motors: tertiaryBus.motors, isSynthetic: false });
    this._appendChildren(tertiaryBus, terIndex, childDepth, terZ, terV, mode, entries);
  }

  _totalFaultCurrent(busIndex, entries, mode) {
    const bus = entries[busIndex];
    const vFault = bus.voltageLL;
    const zSource = bus.cumulativeZ;

    if (mode === Mode.maxOperating) {
      const mag = zSource.magnitude;
      return { current: mag === 0 ? Infinity : vFault / (SQRT3 * mag), thevenin: zSource };
    }

    const contributors = [zSource];
    for (const e of entries) {
      for (const motor of e.motors) {
        if (mode === Mode.interrupting && !motor.contributesToInterrupting) continue;
        const xMult = mode === Mode.interrupting ? motor.interruptingReactanceMultiplier : 1.0;
        const base = motor.subtransientImpedance;
        if (base.magnitude <= 0) continue;
        const zMotorReferred = referImpedance(base.scale(xMult), motor.ratedVoltageLL, vFault);
        const zPath = pathImpedance(entries.indexOf(e), busIndex, entries, vFault);
        const zEq = zMotorReferred.add(zPath);
        if (zEq.magnitude <= 0) continue;
        contributors.push(zEq);
      }
    }
    const zThev = Impedance.parallelAll(contributors);
    const mag = zThev.magnitude;
    return { current: mag === 0 ? Infinity : vFault / (SQRT3 * mag), thevenin: zThev };
  }

  /**
   * Iterative backward-forward-sweep power-flow solve. `loads` / `capacitors`
   * are `{ busIndex, load }` /
   * `{ busIndex, capacitor }` in pre-order-DFS bus space (index 0 = source).
   * Each iteration: (1) backward pass sums load + capacitor currents up the
   * tree, referring each branch current to its parent's frame; (2) forward
   * pass drops the source EMF through the series impedances to get each bus
   * voltage; (3) stop when the max per-bus voltage residual < `tolerance`.
   * Returns a per-node voltage / current / %-drop profile + convergence info.
   * Constant-power loads (motors) make current rise as voltage sags — the
   * conservative direction for voltage-drop work.
   */
  loadFlow({ loads = [], capacitors = [], temperatureC, tolerance = 1e-6, maxIterations = 30 } = {}) {
    const entries = [];
    buildLoadFlow(
      this.rootBus,
      { label: this.rootBus.label, parentIndex: -1, depth: 0, branchZ: Impedance.zero(), turnsRatio: 1.0, nominalVLL: this.source.lineToLineVoltage },
      temperatureC, entries,
    );
    const count = entries.length;

    // Bucket per-bus loads + caps (out-of-range indices silently dropped).
    const loadsAtBus = Array.from({ length: count }, () => []);
    for (const e of loads) if (e.busIndex >= 0 && e.busIndex < count) loadsAtBus[e.busIndex].push(e.load);
    const capsAtBus = Array.from({ length: count }, () => []);
    for (const e of capacitors) if (e.busIndex >= 0 && e.busIndex < count) capsAtBus[e.busIndex].push(e.capacitor);

    // Per-bus total susceptance (each cap at its own nameplate rated V).
    const bSumAtBus = new Array(count).fill(0);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (const cap of capsAtBus[i]) sum += cap.susceptanceAtRatedVoltageLL(cap.resolvedRatedVoltageLL(entries[i].nominalVLL));
      bSumAtBus[i] = sum;
    }

    const V_source_LN = Phasor.from(this.source.lineToLineVoltage / SQRT3, 0);
    const voltages = entries.map((e) => Phasor.from(e.nominalVLL / SQRT3, 0));
    const prevVMagnitude = entries.map((e) => e.nominalVLL / SQRT3);
    const currentInto = new Array(count).fill(null).map(() => Phasor.zero());

    let iterCount = 0;
    let converged = false;
    const deltaHistory = [];
    const divergenceStreakNeeded = 3;

    for (let iter = 0; iter < maxIterations; iter++) {
      iterCount = iter + 1;
      for (let i = 0; i < count; i++) currentInto[i] = Phasor.zero();

      // Backward pass (post-order via descending pre-order index).
      for (let i = count - 1; i >= 0; i--) {
        let I_outflow = currentInto[i];
        for (const load of loadsAtBus[i]) {
          const V_LN = voltages[i];
          const V_LL_mag = V_LN.magnitude * SQRT3;
          if (!(V_LL_mag > 0)) continue;
          const I_mag = load.currentMagnitude(V_LL_mag);
          const pf = Math.max(0, Math.min(1, load.powerFactor));
          const phase = -Math.acos(pf);
          I_outflow = I_outflow.add(Phasor.from(I_mag, V_LN.angle + phase));
        }
        if (bSumAtBus[i] > 0) I_outflow = I_outflow.add(voltages[i].rotatedBy90.scale(bSumAtBus[i]));
        const parent = entries[i].parentIndex;
        if (parent >= 0) {
          currentInto[parent] = currentInto[parent].add(I_outflow.scale(entries[i].turnsRatio));
          currentInto[i] = I_outflow;
        } else {
          currentInto[0] = I_outflow;
        }
      }

      // Forward pass (pre-order).
      voltages[0] = V_source_LN.sub(currentInto[0].timesImpedance(this.source.loadFlowImpedance));
      for (let i = 1; i < count; i++) {
        const parent = entries[i].parentIndex;
        const V_step = voltages[parent].scale(entries[i].turnsRatio);
        voltages[i] = V_step.sub(currentInto[i].timesImpedance(entries[i].branchZ));
      }

      // Convergence: max per-bus magnitude residual.
      let maxDelta = 0;
      for (let i = 0; i < count; i++) {
        const newMag = voltages[i].magnitude;
        const d = Math.abs(newMag - prevVMagnitude[i]) / Math.max(newMag, 1.0);
        if (d > maxDelta) maxDelta = d;
        prevVMagnitude[i] = newMag;
      }
      deltaHistory.push(maxDelta);
      if (maxDelta < tolerance) { converged = true; break; }

      // Divergence detection: a strictly increasing residual streak.
      if (deltaHistory.length >= divergenceStreakNeeded + 1) {
        const recent = deltaHistory.slice(-(divergenceStreakNeeded + 1));
        let increasing = true;
        for (let k = 1; k < recent.length; k++) if (!(recent[k - 1] < recent[k])) { increasing = false; break; }
        if (increasing) break;
      }
    }

    const nodes = entries.map((e, i) => {
      const vLL = voltages[i].magnitude * SQRT3;
      const pctDrop = e.nominalVLL > 0 ? ((e.nominalVLL - vLL) / e.nominalVLL) * 100.0 : 0.0;
      return {
        label: e.label, voltagePhasor: voltages[i], voltageLL: vLL, nominalVLL: e.nominalVLL,
        currentPhasor: currentInto[i], currentMagnitude: currentInto[i].magnitude,
        percentDropFromNominal: pctDrop, depth: e.depth,
      };
    });

    return { nodes, busLoads: loads, busCapacitors: capacitors, temperatureC, iterations: iterCount, converged };
  }
}

/** Pre-order DFS that flattens the tree into the load-flow working set:
 *  one entry per bus with its feeding branch's impedance, turns ratio, and
 *  nominal voltage. A three-winding transformer is modeled here as two
 *  INDEPENDENT winding branches off the parent (secondary via Z_HX, tertiary
 *  via Z_HY) — the star cross-coupling has only a second-order effect on
 *  steady-state voltage; the exact star node lives in the fault calc. */
function buildLoadFlow(bus, entry, tempC, entries) {
  const myIndex = entries.length;
  entries.push(entry);
  for (const branch of bus.children) {
    const { element, bus: childBus, tertiaryBus, secondaryLive } = branch;
    if (element.kind === 'transformer3') {
      const t3 = element.spec;
      if (secondaryLive !== false) {
        const zHX = t3.primaryStarLegPU.add(t3.secondaryStarLegPU).scale(t3.baseImpedanceOhms(t3.secondaryVoltageLL));
        buildLoadFlow(childBus, { label: childBus.label, parentIndex: myIndex, depth: entry.depth + 1, branchZ: zHX, turnsRatio: t3.secondaryVoltageLL / t3.primaryVoltageLL, nominalVLL: t3.secondaryVoltageLL }, tempC, entries);
      }
      if (tertiaryBus) {
        const zHY = t3.primaryStarLegPU.add(t3.tertiaryStarLegPU).scale(t3.baseImpedanceOhms(t3.tertiaryVoltageLL));
        buildLoadFlow(tertiaryBus, { label: tertiaryBus.label, parentIndex: myIndex, depth: entry.depth + 1, branchZ: zHY, turnsRatio: t3.tertiaryVoltageLL / t3.primaryVoltageLL, nominalVLL: t3.tertiaryVoltageLL }, tempC, entries);
      }
      continue;
    }
    let childZ; let childRatio; let childVLL;
    if (element.kind === 'transformer') {
      const t = element.spec;
      childZ = t.impedanceReferredToSecondary;
      childRatio = t.secondaryVoltageLL / t.primaryVoltageLL;
      childVLL = t.secondaryVoltageLL;
    } else {
      childZ = element.spec.impedanceAt(tempC);
      childRatio = 1.0;
      childVLL = entry.nominalVLL;
    }
    buildLoadFlow(childBus, { label: childBus.label, parentIndex: myIndex, depth: entry.depth + 1, branchZ: childZ, turnsRatio: childRatio, nominalVLL: childVLL }, tempC, entries);
  }
}

/** Impedance of the tree path between two buses, referred to `vTarget`'s frame. */
function pathImpedance(a, b, entries, vTarget) {
  if (a === b) return Impedance.zero();
  const chain = (idx) => {
    const out = [idx];
    let i = idx;
    while (entries[i].parentIndex >= 0) { i = entries[i].parentIndex; out.push(i); }
    return out;
  };
  const ancestorsA = chain(a);
  const setB = new Set(chain(b));
  const lca = ancestorsA.find((x) => setB.has(x)) ?? 0;
  const zA = referImpedance(entries[a].cumulativeZ, entries[a].voltageLL, vTarget);
  const zB = referImpedance(entries[b].cumulativeZ, entries[b].voltageLL, vTarget);
  const zL = referImpedance(entries[lca].cumulativeZ, entries[lca].voltageLL, vTarget);
  return new Impedance(
    zA.resistance + zB.resistance - 2 * zL.resistance,
    zA.reactance + zB.reactance - 2 * zL.reactance,
  );
}

/** Z referred from one voltage frame to another: Z · (V_to / V_from)². */
function referImpedance(z, vFrom, vTo) {
  if (!(vFrom > 0) || !(vTo > 0) || vFrom === vTo) return z;
  const n = vTo / vFrom;
  return z.scale(n * n);
}
