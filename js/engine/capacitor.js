// Ideal three-phase shunt capacitor (power-factor correction / voltage
// support). Modeled as a pure susceptance — no losses. Per-phase L-N
// susceptance from the nameplate kVAR and rated line-to-line voltage:
//
//   B = (Q_kVAR · 1000) / V_LL²
//
// (Dimensionally equal to the textbook B = Q_3φ / (3·V_LN²) since
// V_LN² = V_LL²/3.) Used by the load-flow solver ONLY — capacitors are
// neglected in the short-circuit network per IEEE 141 / C37.010, whose
// only fault contribution is a sub-cycle discharge that decays before
// the momentary and interrupting windows.

export class Capacitor {
  constructor({ ratedKVAR, ratedVoltageLL = 0 }) {
    this.ratedKVAR = ratedKVAR;
    this.ratedVoltageLL = ratedVoltageLL;
  }

  /** Per-phase L-N susceptance (S) at the given rated L-L voltage. 0 for
   *  non-positive input (safe pass-through for a disabled bank). */
  susceptanceAtRatedVoltageLL(v) {
    if (!(this.ratedKVAR > 0) || !(v > 0) || !Number.isFinite(v)) return 0;
    return (this.ratedKVAR * 1000.0) / (v * v);
  }

  /** Rated V to use for susceptance: the bank's own nameplate when set
   *  (>0), otherwise the supplied bus nominal (the "0 = use bus" sentinel). */
  resolvedRatedVoltageLL(busNominalVLL) {
    return this.ratedVoltageLL > 0 ? this.ratedVoltageLL : busNominalVLL;
  }
}
