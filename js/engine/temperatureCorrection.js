// Corrects conductor resistance from one temperature to another.
// Reactance is treated as temperature-independent (not handled here).

import { inferredZeroTemperatureC } from './conductorMaterial.js';

/**
 * Inferred-absolute-zero method:
 *   R(T₂) = R(T₁) · (T_inf + T₂) / (T_inf + T₁)
 *
 * Any non-finite input, or the inferred-zero singularity (T₁ = −T_inf),
 * returns the input resistance unchanged (safe no-op).
 */
export function correctResistance(resistance, fromC, toC, material) {
  const tInf = inferredZeroTemperatureC(material);
  const denom = tInf + fromC;
  if (!Number.isFinite(resistance) || !Number.isFinite(fromC) || !Number.isFinite(toC) || denom === 0) {
    return resistance;
  }
  return (resistance * (tInf + toC)) / denom;
}
