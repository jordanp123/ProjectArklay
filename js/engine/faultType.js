// Symmetric fault types supported by the engine. Single line-to-ground is
// out of scope (mining neutral-grounding resistors need a separate model).

export const FaultType = Object.freeze({
  /** Balanced three-phase bolted fault. Highest current; sets interrupting duty. */
  threePhase: 'Three-phase',
  /** Phase-to-phase bolted fault (≈ 0.866× three-phase on Z₁ = Z₂ systems). */
  lineToLine: 'Line-to-line',
});

export function faultTypeShortLabel(faultType) {
  return faultType === FaultType.lineToLine ? 'L-L' : '3φ';
}
