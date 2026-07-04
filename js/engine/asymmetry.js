// First-cycle asymmetry multipliers per IEEE Std 141 §3.5 / IEEE C37.010.
// A bolted fault on an inductive circuit develops a DC offset whose decay
// is set by the fault-point X/R. Both multipliers are relative to the
// symmetric RMS current.

import { SQRT2, SQRT3 } from './constants.js';

/**
 * First-cycle RMS asymmetry multiplier:  M = √(1 + 2·exp(−2π·R/X)).
 * X/R = 0 → 1.0 (no offset); X/R → ∞ → √3. Returns 1.0 for bad input.
 */
export function firstCycleAsymmetryMultiplier(xOverR) {
  if (!(xOverR > 0 && Number.isFinite(xOverR))) {
    if (xOverR === Infinity) return SQRT3;
    return 1.0;
  }
  const rOverX = 1.0 / xOverR;
  return Math.sqrt(1.0 + 2.0 * Math.exp(-2.0 * Math.PI * rOverX));
}

/**
 * First-half-cycle peak factor (relative to symmetric RMS):
 *   M_peak = √2·(1 + exp(−π·R/X)).
 * X/R = 0 → √2; X/R → ∞ → 2√2. Returns √2 for bad input.
 */
export function firstHalfCyclePeakFactor(xOverR) {
  if (!(xOverR > 0 && Number.isFinite(xOverR))) {
    if (xOverR === Infinity) return 2.0 * SQRT2;
    return SQRT2;
  }
  const rOverX = 1.0 / xOverR;
  return SQRT2 * (1.0 + Math.exp(-Math.PI * rOverX));
}
