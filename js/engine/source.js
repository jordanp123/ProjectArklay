// Utility/source feeding the circuit — a Thévenin equivalent (ideal
// voltage source behind an impedance). Carries up to three impedances so
// an on-site generator can model the correct reactance per timescale:
//   • subtransient (X″): max-SC and 5-cycle interrupting
//   • transient   (X′): min-SC, and load-flow fallback when synchronous is absent
//   • synchronous (Xs): steady-state load flow (optional)
// Utility sources set subtransient == transient and synchronous = null.

import { Impedance } from './impedance.js';
import { SQRT3 } from './constants.js';

export class Source {
  /**
   * @param {number} lineToLineVoltage volts
   * @param {Impedance} subtransientImpedance
   * @param {Impedance} transientImpedance
   * @param {?Impedance} synchronousImpedance
   */
  constructor(lineToLineVoltage, subtransientImpedance, transientImpedance, synchronousImpedance = null) {
    this.lineToLineVoltage = lineToLineVoltage;
    this.subtransientImpedance = subtransientImpedance;
    this.transientImpedance = transientImpedance;
    this.synchronousImpedance = synchronousImpedance;
  }

  /** First-cycle view of the source impedance (alias for subtransient). */
  get impedance() {
    return this.subtransientImpedance;
  }

  /** Impedance the load-flow solver uses: synchronous if set, else transient. */
  get loadFlowImpedance() {
    return this.synchronousImpedance ?? this.transientImpedance;
  }

  /** True when load flow is substituting transient X′ for an unsupplied Xs. */
  get loadFlowUsesTransientAsSubstitute() {
    return (
      this.synchronousImpedance === null &&
      !impedanceEquals(this.subtransientImpedance, this.transientImpedance)
    );
  }

  /** Single-impedance (utility) source. */
  static withImpedance(lineToLineVoltage, impedance) {
    return new Source(lineToLineVoltage, impedance, impedance, null);
  }

  /**
   * From the utility's available short-circuit MVA:
   *   Z_source = V_LL² / S_sc   (S_sc in VA), split by X/R.
   * Non-finite / non-positive inputs → infinite impedance (→ zero fault
   * current → conservative breaker verdict).
   */
  static fromAvailableMVA(lineToLineVoltage, availableSCMVA, xOverR) {
    const v = lineToLineVoltage;
    if (!(v > 0 && Number.isFinite(v)) || !(availableSCMVA > 0 && Number.isFinite(availableSCMVA)) ||
        !(xOverR >= 0 && Number.isFinite(xOverR))) {
      return Source.withImpedance(Math.max(v, 0), new Impedance(Infinity, 0));
    }
    const zMag = (v * v) / (availableSCMVA * 1_000_000.0);
    return Source.withImpedance(v, Impedance.from(zMag, xOverR));
  }

  /**
   * From the utility's available short-circuit current (kA):
   *   |Z| = V_LL / (√3 · I_sc)
   */
  static fromAvailableKA(lineToLineVoltage, availableSCkA, xOverR) {
    const v = lineToLineVoltage;
    if (!(v > 0 && Number.isFinite(v)) || !(availableSCkA > 0 && Number.isFinite(availableSCkA)) ||
        !(xOverR >= 0 && Number.isFinite(xOverR))) {
      return Source.withImpedance(Math.max(v, 0), new Impedance(Infinity, 0));
    }
    const zMag = v / (SQRT3 * availableSCkA * 1000.0);
    return Source.withImpedance(v, Impedance.from(zMag, xOverR));
  }

  /** Infinite bus — zero source impedance. */
  static infiniteBus(lineToLineVoltage) {
    const v = lineToLineVoltage;
    return Source.withImpedance(v > 0 && Number.isFinite(v) ? v : 0, Impedance.zero());
  }

  /**
   * On-site AC generator. Stator R neglected (purely reactive). Reactances
   * from per-unit on the generator's kVA base: X(ohms) = X(pu)·V_LL²/S_rated.
   * A non-finite / non-positive synchronous pu is treated as "not supplied".
   */
  static generator(lineToLineVoltage, ratedKVA, subtransientPU, transientPU, synchronousPU = null) {
    const v = lineToLineVoltage;
    if (!(v > 0 && Number.isFinite(v)) || !(ratedKVA > 0 && Number.isFinite(ratedKVA)) ||
        !(subtransientPU > 0 && Number.isFinite(subtransientPU)) ||
        !(transientPU > 0 && Number.isFinite(transientPU))) {
      const inf = new Impedance(Infinity, 0);
      return new Source(Math.max(v, 0), inf, inf, null);
    }
    const s = ratedKVA * 1000.0;
    const v2 = v * v;
    const sub = new Impedance(0, (subtransientPU * v2) / s);
    const tr = new Impedance(0, (transientPU * v2) / s);
    let sync = null;
    if (synchronousPU !== null && Number.isFinite(synchronousPU) && synchronousPU > 0) {
      sync = new Impedance(0, (synchronousPU * v2) / s);
    }
    return new Source(v, sub, tr, sync);
  }
}

function impedanceEquals(a, b) {
  return a.resistance === b.resistance && a.reactance === b.reactance;
}
