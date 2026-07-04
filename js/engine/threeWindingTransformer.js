// Three-winding transformer, modeled by its three pairwise nameplate
// impedances decomposed into the standard star (T) equivalent.
//
// Windings: primary (H), secondary (X), tertiary (Y). Pairwise measured
// short-circuit impedances (each on its own winding-pair base):
//   Z_HX  primary↔secondary (tertiary open)
//   Z_HY  primary↔tertiary  (secondary open)
//   Z_XY  secondary↔tertiary (primary open)
// Star legs (per-unit on the common ratedKVA base):
//   Z_H = ½(Z_HX + Z_HY − Z_XY)
//   Z_X = ½(Z_HX + Z_XY − Z_HY)
//   Z_Y = ½(Z_HY + Z_XY − Z_HX)
// Any single leg may be negative — that is normal for the T-equivalent
// (a bookkeeping value, not a real negative resistor). The star node is
// kept in the SECONDARY voltage frame.

import { Impedance } from './impedance.js';

const INFINITE = new Impedance(Infinity, 0);

export class ThreeWindingTransformer {
  constructor({
    ratedKVA, tertiaryKVA, primaryVoltageLL, secondaryVoltageLL, tertiaryVoltageLL,
    percentImpedanceHX, xOverRHX, percentImpedanceHY, xOverRHY, percentImpedanceXY, xOverRXY,
  }) {
    this.ratedKVA = ratedKVA;
    this.tertiaryKVA = tertiaryKVA;
    this.primaryVoltageLL = primaryVoltageLL;
    this.secondaryVoltageLL = secondaryVoltageLL;
    this.tertiaryVoltageLL = tertiaryVoltageLL;
    this.percentImpedanceHX = percentImpedanceHX;
    this.xOverRHX = xOverRHX;
    this.percentImpedanceHY = percentImpedanceHY;
    this.xOverRHY = xOverRHY;
    this.percentImpedanceXY = percentImpedanceXY;
    this.xOverRXY = xOverRXY;
  }

  // Pairwise per-unit impedances, each normalized to the common ratedKVA base
  // (Z_HX is already on ratedKVA; a base change leaves X/R unchanged).
  get _secondaryTertiaryBaseKVA() { return Math.min(this.ratedKVA, this.tertiaryKVA); }
  get _zHXpu() { return Impedance.from(this.percentImpedanceHX / 100.0, this.xOverRHX); }
  get _zHYpu() { return Impedance.from((this.percentImpedanceHY / 100.0) * (this.ratedKVA / this.tertiaryKVA), this.xOverRHY); }
  get _zXYpu() { return Impedance.from((this.percentImpedanceXY / 100.0) * (this.ratedKVA / this._secondaryTertiaryBaseKVA), this.xOverRXY); }

  get primaryStarLegPU() { return this._zHXpu.add(this._zHYpu).sub(this._zXYpu).scale(0.5); }
  get secondaryStarLegPU() { return this._zHXpu.add(this._zXYpu).sub(this._zHYpu).scale(0.5); }
  get tertiaryStarLegPU() { return this._zHYpu.add(this._zXYpu).sub(this._zHXpu).scale(0.5); }

  /** Base impedance (Ω) at a line-to-line voltage on ratedKVA: V_LL² / S_rated. */
  baseImpedanceOhms(vLL) { return (vLL * vLL) / (this.ratedKVA * 1000.0); }

  get _valid() {
    const pos = (v) => Number.isFinite(v) && v > 0;
    const nonNeg = (v) => Number.isFinite(v) && v >= 0;
    return pos(this.ratedKVA) && pos(this.tertiaryKVA) &&
      pos(this.primaryVoltageLL) && pos(this.secondaryVoltageLL) && pos(this.tertiaryVoltageLL) &&
      pos(this.percentImpedanceHX) && pos(this.percentImpedanceHY) && pos(this.percentImpedanceXY) &&
      nonNeg(this.xOverRHX) && nonNeg(this.xOverRHY) && nonNeg(this.xOverRXY);
  }

  /** Primary star leg Z_H (Ω), referred to the secondary frame (the star node's frame). */
  get primaryStarLegReferredToSecondary() {
    return this._valid ? this.primaryStarLegPU.scale(this.baseImpedanceOhms(this.secondaryVoltageLL)) : INFINITE;
  }
  /** Secondary star leg Z_X (Ω), referred to the secondary frame. */
  get secondaryStarLegReferredToSecondary() {
    return this._valid ? this.secondaryStarLegPU.scale(this.baseImpedanceOhms(this.secondaryVoltageLL)) : INFINITE;
  }
  /** Tertiary star leg Z_Y (Ω), referred to the tertiary frame. */
  get tertiaryStarLegReferredToTertiary() {
    return this._valid ? this.tertiaryStarLegPU.scale(this.baseImpedanceOhms(this.tertiaryVoltageLL)) : INFINITE;
  }
}
