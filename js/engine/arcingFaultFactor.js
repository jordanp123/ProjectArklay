// Voltage-dependent arcing fault factor used to derate a bolted-fault
// current to the lower current an arcing fault actually draws (MSHA Coal
// Mine Electrical Inspection Procedures Handbook convention). Arc voltage
// is roughly fixed, so the proportional reduction is largest at low voltage.

/**
 * Arcing factor for a line-to-line voltage:
 *   ≤ 480 → 0.85 · ≤ 600 → 0.90 · ≤ 1040 → 0.95 · > 1040 → 1.00.
 * Non-finite / non-positive voltage returns the most conservative 0.85
 * (NaN comparisons would otherwise fall through to the least-conservative 1.00).
 */
export function arcingFaultFactor(voltageLL) {
  if (!(voltageLL > 0 && Number.isFinite(voltageLL))) return 0.85;
  if (voltageLL <= 480) return 0.85;
  if (voltageLL <= 600) return 0.90;
  if (voltageLL <= 1040) return 0.95;
  return 1.0;
}
