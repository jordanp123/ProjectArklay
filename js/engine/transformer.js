// A two-winding transformer modeled by its nameplate impedance (%Z).
// R is not temperature-corrected (thermal mass is large). %Z refers to
// rated voltage and rated apparent power; converted to ohms on the
// secondary side, which is the side the calculation flows toward.

import { Impedance } from './impedance.js';

export class Transformer {
  constructor({ ratedKVA, primaryVoltageLL, secondaryVoltageLL, percentImpedance, xOverR }) {
    this.ratedKVA = ratedKVA;
    this.primaryVoltageLL = primaryVoltageLL;
    this.secondaryVoltageLL = secondaryVoltageLL;
    this.percentImpedance = percentImpedance;
    this.xOverR = xOverR;
  }

  /**
   * Impedance referred to the secondary side, ohms:
   *   Z_T = V_LL_sec² · (%Z/100) / S_rated
   * Bad input → infinite impedance (→ zero downstream fault current).
   */
  get impedanceReferredToSecondary() {
    if (!(this.ratedKVA > 0 && Number.isFinite(this.ratedKVA)) ||
        !(this.secondaryVoltageLL > 0 && Number.isFinite(this.secondaryVoltageLL)) ||
        !(this.percentImpedance > 0 && Number.isFinite(this.percentImpedance)) ||
        !(this.xOverR >= 0 && Number.isFinite(this.xOverR))) {
      return new Impedance(Infinity, 0);
    }
    const s = this.ratedKVA * 1000.0;
    const zMag = (this.secondaryVoltageLL * this.secondaryVoltageLL * (this.percentImpedance / 100.0)) / s;
    return Impedance.from(zMag, this.xOverR);
  }

  /**
   * Squared turns ratio for referring source-side ohms to the secondary:
   * multiply primary-side ohms by (V_sec/V_pri)². Returns 0 on bad input
   * (paired with the infinity fallback above so V_sec = 0 can't make 0·∞ = NaN).
   */
  get voltageRatioSquared() {
    if (!(this.primaryVoltageLL > 0 && Number.isFinite(this.primaryVoltageLL)) ||
        !(this.secondaryVoltageLL > 0 && Number.isFinite(this.secondaryVoltageLL))) {
      return 0;
    }
    const n = this.secondaryVoltageLL / this.primaryVoltageLL;
    return n * n;
  }
}
