// A rotating machine treated as a fault-current source for max-SC
// (first-cycle) calculations. Modeled as an EMF behind its subtransient
// reactance X″_d (purely reactive; R neglected per IEEE 141 §3). Excluded
// from min-SC (its contribution decays before instantaneous pickup).

import { Impedance } from './impedance.js';

export class Motor {
  constructor({
    ratedKVA,
    ratedVoltageLL,
    subtransientReactancePU,
    interruptingReactanceMultiplier = 1.5,
    contributesToInterrupting = true,
  }) {
    this.ratedKVA = ratedKVA;
    this.ratedVoltageLL = ratedVoltageLL;
    this.subtransientReactancePU = subtransientReactancePU;
    this.interruptingReactanceMultiplier = interruptingReactanceMultiplier;
    this.contributesToInterrupting = contributesToInterrupting;
  }

  /**
   * Subtransient impedance in ohms on the motor's own voltage base:
   *   Z″ = X″_pu · V_LL² / (S_kVA · 1000)
   * Pure reactance. Returns zero for any non-positive input (disabled motor).
   */
  get subtransientImpedance() {
    if (!(this.ratedKVA > 0 && Number.isFinite(this.ratedKVA)) ||
        !(this.ratedVoltageLL > 0 && Number.isFinite(this.ratedVoltageLL)) ||
        !(this.subtransientReactancePU > 0 && Number.isFinite(this.subtransientReactancePU))) {
      return Impedance.zero();
    }
    const xOhms = (this.subtransientReactancePU * this.ratedVoltageLL * this.ratedVoltageLL) /
      (this.ratedKVA * 1000.0);
    return new Impedance(0, xOhms);
  }
}
