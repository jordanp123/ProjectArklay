// Complex impedance Z = R + jX, in ohms.
//
// Fault calculations are dominated by series impedance addition, so this
// type is deliberately minimal: it carries R and X, supports vector
// arithmetic, and can be built from a magnitude and X/R ratio (the form
// most often quoted for utility sources and transformer nameplates).

export class Impedance {
  /**
   * @param {number} resistance ohms
   * @param {number} reactance ohms (positive = inductive)
   */
  constructor(resistance, reactance) {
    this.resistance = resistance;
    this.reactance = reactance;
  }

  static zero() {
    return new Impedance(0, 0);
  }

  /** |Z| = √(R² + X²). */
  get magnitude() {
    return Math.sqrt(this.resistance * this.resistance + this.reactance * this.reactance);
  }

  /** X/R. Returns 0 when both components are zero, Infinity for purely reactive. */
  get xOverR() {
    if (this.resistance === 0) {
      return this.reactance === 0 ? 0 : Infinity;
    }
    return this.reactance / this.resistance;
  }

  add(o) {
    return new Impedance(this.resistance + o.resistance, this.reactance + o.reactance);
  }

  sub(o) {
    return new Impedance(this.resistance - o.resistance, this.reactance - o.reactance);
  }

  /** Scale by a real scalar: k·(R + jX). */
  scale(k) {
    return new Impedance(this.resistance * k, this.reactance * k);
  }

  /** (a + jb)·(c + jd) = (ac − bd) + j(ad + bc). */
  mul(o) {
    return new Impedance(
      this.resistance * o.resistance - this.reactance * o.reactance,
      this.resistance * o.reactance + this.reactance * o.resistance,
    );
  }

  /** (a + jb)/(c + jd). */
  div(o) {
    const denom = o.resistance * o.resistance + o.reactance * o.reactance;
    return new Impedance(
      (this.resistance * o.resistance + this.reactance * o.reactance) / denom,
      (this.reactance * o.resistance - this.resistance * o.reactance) / denom,
    );
  }

  /**
   * Build an impedance from magnitude and X/R ratio.
   *   R = |Z| / √(1 + k²),  X = k·R
   */
  static from(magnitude, xOverR) {
    const r = magnitude / Math.sqrt(1 + xOverR * xOverR);
    const x = xOverR * r;
    return new Impedance(r, x);
  }

  /** Parallel combination: Z_p = Z_a·Z_b / (Z_a + Z_b). Two zeros → zero (not NaN). */
  static parallel(a, b) {
    const sum = a.add(b);
    if (sum.resistance === 0 && sum.reactance === 0) return Impedance.zero();
    return a.mul(b).div(sum);
  }

  /** Parallel combination of an arbitrary number of impedances (pairwise, stable). */
  static parallelAll(impedances) {
    if (impedances.length === 0) return Impedance.zero();
    return impedances.slice(1).reduce((acc, z) => Impedance.parallel(acc, z), impedances[0]);
  }
}
