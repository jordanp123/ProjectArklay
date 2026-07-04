// Breaker pickup analysis + minimum short-circuit current.
//
// The effective fault current a breaker sees is the bolted current derated
// by the utility voltage sag, the voltage-dependent arcing factor, and the
// breaker's manufacturer pickup tolerance. The verdict is binary and biased
// to "will not trip" on any non-finite / non-positive input.

import { FaultType } from './faultType.js';
import { arcingFaultFactor } from './arcingFaultFactor.js';

/** Conservative 5% utility voltage sag applied to the minimum-SC scenario. */
export const UTILITY_VOLTAGE_SAG_FACTOR = 0.95;

export const BreakerVerdict = Object.freeze({ pass: 'pass', willNotTrip: 'willNotTrip' });

/**
 * Minimum short-circuit current at a node after the field's conservative
 * derates (caller passes the hot NodeResult):
 *   I_min = I_bolted · sag · k_arc
 */
export function minimumShortCircuitAmps(node, faultType = FaultType.threePhase) {
  const bolted = node.faultCurrentAmps(faultType);
  const arcing = arcingFaultFactor(node.voltageLL);
  return bolted * UTILITY_VOLTAGE_SAG_FACTOR * arcing;
}

/**
 * Evaluate a breaker against a node (typically from the hot / max-temp
 * result — the conservative case):
 *   I_eff = I_bolted · sag · k_arc · (1 − tol)
 * PASS only if I_eff strictly exceeds the trip setting.
 *
 * @param {{instantaneousTripAmps:number, tolerancePercent:number, label?:string}} breaker
 * @param {import('./circuit.js').NodeResult} node
 */
export function evaluateBreaker(breaker, node, faultType = FaultType.threePhase) {
  const bolted = node.faultCurrentAmps(faultType);
  const arcing = arcingFaultFactor(node.voltageLL);
  const tol = Math.max(0, Math.min(50, breaker.tolerancePercent)) / 100.0;
  const sag = UTILITY_VOLTAGE_SAG_FACTOR;

  const effective = bolted * sag * arcing * (1.0 - tol);
  const trip = breaker.instantaneousTripAmps;

  let verdict;
  if (!Number.isFinite(effective) || !Number.isFinite(trip) || trip <= 0) {
    verdict = BreakerVerdict.willNotTrip;
  } else {
    verdict = effective > trip ? BreakerVerdict.pass : BreakerVerdict.willNotTrip;
  }

  return {
    breaker,
    faultType,
    nodeLabel: node.label,
    boltedFaultCurrentAmps: bolted,
    utilityVoltageSagFactor: sag,
    arcingFactor: arcing,
    toleranceFraction: tol,
    effectiveFaultCurrentAmps: effective,
    verdict,
  };
}
