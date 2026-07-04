// Input validation over the circuit document (source + bus tree).
//
// An error BLOCKS the results: the engine turns bad inputs into safe-but-wrong
// numbers, so we refuse to show them. Warnings are advisory. Pure over the
// document — unit-testable.

import { nominalVoltages } from './model.js';

const num = (v) => Number(v);
const isPos = (v) => Number.isFinite(num(v)) && num(v) > 0;
const isNonNeg = (v) => Number.isFinite(num(v)) && num(v) >= 0;

/**
 * @param {object} doc  { source, sourceBus }
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validate(doc) {
  const errors = [];
  const warnings = [];
  const s = doc.source;

  // ── Source ──
  if (!isPos(s.voltage)) {
    errors.push('Source: system voltage must be greater than 0.');
  } else if (num(s.voltage) < 100 || num(s.voltage) > 40000) {
    warnings.push(`Source: ${num(s.voltage)} V is outside the typical 100–35000 V range.`);
  }
  if (s.mode === 'availableKA' && !isPos(s.kA)) errors.push('Source: available short-circuit current (kA) must be greater than 0.');
  if (s.mode === 'availableMVA' && !isPos(s.mva)) errors.push('Source: available short-circuit capacity (MVA) must be greater than 0.');
  if (s.mode === 'availableKA' || s.mode === 'availableMVA') {
    if (!isNonNeg(s.xOverR)) errors.push('Source: X/R must be 0 or greater.');
    else if (num(s.xOverR) === 0) warnings.push('Source: X/R = 0 makes the source purely resistive.');
  }
  if (s.mode === 'generator') {
    if (!isPos(s.genKVA)) errors.push('Generator: rating (kVA) must be greater than 0.');
    if (!isPos(s.genXdpp)) errors.push('Generator: subtransient reactance X″ (pu) must be greater than 0.');
    if (!isPos(s.genXdp)) errors.push('Generator: transient reactance X′ (pu) must be greater than 0.');
  }

  // ── Circuit tree ──
  const nominals = nominalVoltages(doc);
  const walk = (bus) => {
    const busVLL = nominals.get(bus.id);
    for (const br of bus.children) {
      const el = br.element;
      const name = (el.label && el.label.trim()) || 'element';
      if (el.kind === 'cable') {
        if (!isPos(el.lengthFeet)) errors.push(`Cable "${name}": length must be greater than 0.`);
        if (!isNonNeg(el.rPerKft)) errors.push(`Cable "${name}": resistance must be 0 or greater.`);
        if (!isNonNeg(el.xPerKft)) errors.push(`Cable "${name}": reactance must be 0 or greater.`);
        if (!(Math.round(num(el.parallel)) >= 1)) errors.push(`Cable "${name}": parallel count must be at least 1.`);
      } else if (el.kind === 'transformer3') {
        if (!isPos(el.ratedKVA)) errors.push(`3-winding transformer "${name}": secondary/common rating (kVA) must be greater than 0.`);
        if (!isPos(el.tertiaryKVA)) errors.push(`3-winding transformer "${name}": tertiary rating (kVA) must be greater than 0.`);
        if (!isPos(el.primaryV)) errors.push(`3-winding transformer "${name}": primary voltage must be greater than 0.`);
        if (!isPos(el.secondaryV)) errors.push(`3-winding transformer "${name}": secondary voltage must be greater than 0.`);
        if (!isPos(el.tertiaryV)) errors.push(`3-winding transformer "${name}": tertiary voltage must be greater than 0.`);
        for (const [k, lbl] of [['zHX', 'H–X'], ['zHY', 'H–Y'], ['zXY', 'X–Y']]) {
          if (!isPos(el[k])) errors.push(`3-winding transformer "${name}": %Z ${lbl} must be greater than 0.`);
        }
        for (const [k, lbl] of [['xrHX', 'H–X'], ['xrHY', 'H–Y'], ['xrXY', 'X–Y']]) {
          if (!isNonNeg(el[k])) errors.push(`3-winding transformer "${name}": X/R ${lbl} must be 0 or greater.`);
        }
        if (isPos(el.primaryV) && busVLL > 0 && Math.abs(num(el.primaryV) - busVLL) > 1) {
          warnings.push(`3-winding transformer "${name}": primary rating ${num(el.primaryV)} V doesn't match the ${Math.round(busVLL)} V bus feeding it — check the nameplate.`);
        }
      } else {
        if (!isPos(el.kva)) errors.push(`Transformer "${name}": rating (kVA) must be greater than 0.`);
        if (!isPos(el.primaryV)) errors.push(`Transformer "${name}": primary voltage must be greater than 0.`);
        if (!isPos(el.secondaryV)) errors.push(`Transformer "${name}": secondary voltage must be greater than 0.`);
        if (!isPos(el.percentZ)) errors.push(`Transformer "${name}": %Z must be greater than 0.`);
        if (!isNonNeg(el.xOverR)) errors.push(`Transformer "${name}": X/R must be 0 or greater.`);
        if (isPos(el.primaryV) && busVLL > 0 && Math.abs(num(el.primaryV) - busVLL) > 1) {
          warnings.push(
            `Transformer "${name}": primary rating ${num(el.primaryV)} V doesn't match the ` +
            `${Math.round(busVLL)} V bus feeding it — check the nameplate.`,
          );
        }
      }
      walk(br.bus);
      if (br.tertiaryBus) walk(br.tertiaryBus);
    }
    for (const b of bus.breakers) {
      const name = (b.label && b.label.trim()) || 'breaker';
      if (!isPos(b.trip)) errors.push(`Breaker "${name}": trip current must be greater than 0.`);
    }
  };
  walk(doc.sourceBus);

  return { errors, warnings };
}
