// Editable circuit model — a source plus a recursive bus tree. Each bus holds
// child branches (an element feeding a downstream bus), motors, capacitors,
// and breakers. This module also bridges the editable model to the fault
// engine (`buildCircuit`) and exposes the derived maps the UI needs.
//
// This module also bridges the editable model to the fault engine
// (`buildCircuit`) and exposes the derived maps the UI needs (nominal bus
// voltages, pre-order node indices).

import { Source } from './engine/source.js';
import { CableSegment } from './engine/cable.js';
import { Transformer } from './engine/transformer.js';
import { ConductorMaterial } from './engine/conductorMaterial.js';
import { Circuit, CircuitBus, cableElement, transformerElement, threeWindingElement } from './engine/circuit.js';
import { ThreeWindingTransformer } from './engine/threeWindingTransformer.js';
import { Motor } from './engine/motor.js';
import { Load } from './engine/load.js';
import { Capacitor } from './engine/capacitor.js';
import { SQRT3 } from './engine/constants.js';

let _seq = 1;
export const uid = () => 'n' + (_seq++);

const num = (v, fallback = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ── Constructors ───────────────────────────────────────────────────────
export function newDocument() {
  return {
    source: { mode: 'availableKA', voltage: 480, xOverR: 8, kA: 25, mva: 100, genType: '2-Pole Turbine', genKVA: 1000, genXdpp: 0.09, genXdp: 0.15, genXds: 0 },
    sourceBus: { id: uid(), label: 'Source bus', children: [], motors: [], capacitors: [], breakers: [] },
  };
}
export function newBus(label = 'Bus') {
  return { id: uid(), label, children: [], motors: [], capacitors: [], breakers: [] };
}
export function newCableElement() {
  return { id: uid(), kind: 'cable', label: 'Cable', lengthFeet: 100, rPerKft: 0.081, xPerKft: 0.041, material: 'copper', maxTempC: 90, parallel: 1 };
}
export function newTransformerElement(primaryV = 480) {
  return { id: uid(), kind: 'transformer', label: 'Transformer', kva: 1000, primaryV, secondaryV: 480, percentZ: 5.75, xOverR: 5 };
}
/** Three-winding transformer: primary (H) feeds a secondary (X) + tertiary (Y)
 *  bus off a hidden star node. Three pairwise nameplate %Z each on its own base. */
export function newTransformer3Element(primaryV = 13800) {
  return {
    id: uid(), kind: 'transformer3', label: '3-winding transformer',
    ratedKVA: 10000, tertiaryKVA: 5000, primaryV, secondaryV: 4160, tertiaryV: 480,
    zHX: 7, xrHX: 10, zHY: 6, xrHY: 8, zXY: 5, xrXY: 6,
  };
}
export function newBreaker() {
  return { id: uid(), label: 'Breaker', trip: 800, tolPct: 25, isOpen: false };
}

/** On-site AC generator types — typical per-unit subtransient X″ / transient X′.
 *  Keyed by the display string the `.scme` file stores. Picking a type prefills
 *  X″ / X′; the user can still override either. */
export const GENERATOR_TYPES = {
  '2-Pole Turbine': { xdpp: 0.09, xdp: 0.15 },
  '4-Pole Turbine': { xdpp: 0.14, xdp: 0.23 },
  'Salient Pole with Dampers': { xdpp: 0.20, xdp: 0.30 },
  'Salient Pole without Dampers': { xdpp: 0.30, xdp: 0.30 },
};

/** Motor-type presets (X″ subtransient pu, PF, efficiency, interrupting flag). */
export const MOTOR_TYPES = {
  induction: { label: 'Induction', xdpp: 0.167, pf: 0.85, eff: 0.92, contributes: true },
  synchronous: { label: 'Synchronous', xdpp: 0.25, pf: 0.90, eff: 0.95, contributes: true },
  smallGroup: { label: 'Small motor group', xdpp: 0.28, pf: 0.85, eff: 0.90, contributes: false },
  custom: { label: 'Custom', xdpp: 0.167, pf: 0.85, eff: 0.92, contributes: true },
};
export function newMotor() {
  return { id: uid(), label: 'Motor', ratedHP: 100, ratedRPM: 1800, ratedKVA: 0, motorType: 'induction', subtransientReactancePU: 0.167, powerFactor: 0.85, efficiency: 0.92, lockedRotorAmps: null };
}
/** Power-factor-correction shunt capacitor bank (load-flow only). */
export function newCapacitor() {
  return { id: uid(), label: 'PFC bank', ratedKVAR: 100 };
}

// ── Tree lookups ───────────────────────────────────────────────────────
export function findBus(doc, busId) {
  const stack = [doc.sourceBus];
  while (stack.length) {
    const b = stack.pop();
    if (b.id === busId) return b;
    for (const br of b.children) { stack.push(br.bus); if (br.tertiaryBus) stack.push(br.tertiaryBus); }
  }
  return null;
}

/** The branch whose downstream (secondary) bus has id `childBusId`, plus its
 *  parent bus. Recurses into three-winding tertiary subtrees too. */
export function findBranchByChild(doc, childBusId) {
  const walk = (bus) => {
    for (const br of bus.children) {
      if (br.bus.id === childBusId) return { parentBus: bus, branch: br };
      let hit = walk(br.bus);
      if (hit) return hit;
      if (br.tertiaryBus) { hit = walk(br.tertiaryBus); if (hit) return hit; }
    }
    return null;
  };
  return walk(doc.sourceBus);
}

/** busId → nominal line-to-line voltage (transformer secondary/tertiary down, cable through). */
export function nominalVoltages(doc) {
  const map = new Map();
  const walk = (bus, vll) => {
    map.set(bus.id, vll);
    for (const br of bus.children) {
      if (br.element.kind === 'transformer3') {
        walk(br.bus, num(br.element.secondaryV));
        if (br.tertiaryBus) walk(br.tertiaryBus, num(br.element.tertiaryV));
      } else {
        walk(br.bus, br.element.kind === 'transformer' ? num(br.element.secondaryV) : vll);
      }
    }
  };
  walk(doc.sourceBus, num(doc.source.voltage));
  return map;
}

/** busId → FAULT pre-order index. A three-winding transformer consumes one
 *  extra index for its hidden star node (secondary subtree then tertiary),
 *  matching `Circuit.computeNominal()` node order (used for breaker / motor-
 *  start alignment). */
export function faultBusIndices(doc) {
  const map = new Map();
  let i = 0;
  const walk = (bus) => {
    map.set(bus.id, i++);
    for (const br of bus.children) {
      if (br.element.kind === 'transformer3') {
        i++; // hidden star node
        if (br.secondaryLive !== false) walk(br.bus);
        if (br.tertiaryBus) walk(br.tertiaryBus);
      } else {
        walk(br.bus);
      }
    }
  };
  walk(doc.sourceBus);
  return map;
}

/** busId → LOAD-FLOW pre-order index (no star node; each winding is an
 *  independent branch), matching the load-flow solver's node order. */
export function loadFlowBusIndices(doc) {
  const map = new Map();
  let i = 0;
  const walk = (bus) => {
    map.set(bus.id, i++);
    for (const br of bus.children) {
      if (br.element.kind === 'transformer3') {
        if (br.secondaryLive !== false) walk(br.bus);
        if (br.tertiaryBus) walk(br.tertiaryBus);
      } else {
        walk(br.bus);
      }
    }
  };
  walk(doc.sourceBus);
  return map;
}

/** Back-compat alias — the load-flow index space (no synthetic star nodes). */
export function busNodeIndices(doc) { return loadFlowBusIndices(doc); }

// ── Mutations ──────────────────────────────────────────────────────────
/** Bus an "Add" action targets for the current selection. */
export function targetBusId(doc, selection) {
  if (!selection) return doc.sourceBus.id;
  switch (selection.kind) {
    case 'bus': return selection.busId;
    case 'element': return selection.childBusId;
    case 'motor': return selection.busId;
    case 'capacitor': return selection.busId;
    case 'breaker': return selection.busId;
    default: return doc.sourceBus.id;
  }
}

/** Add an element to a bus; returns the selection that focuses the new item. */
export function addToBus(doc, busId, kind) {
  const bus = findBus(doc, busId);
  if (!bus) return null;
  if (kind === 'cable' || kind === 'transformer') {
    const element = kind === 'transformer'
      ? newTransformerElement(nominalVoltages(doc).get(busId) ?? num(doc.source.voltage))
      : newCableElement();
    const child = newBus('Bus');
    bus.children.push({ id: uid(), element, bus: child });
    return { kind: 'element', childBusId: child.id };
  }
  if (kind === 'transformer3') {
    const element = newTransformer3Element(nominalVoltages(doc).get(busId) ?? num(doc.source.voltage));
    const secondary = newBus('Secondary');
    const tertiary = newBus('Tertiary');
    bus.children.push({ id: uid(), element, bus: secondary, tertiaryBus: tertiary });
    return { kind: 'element', childBusId: secondary.id };
  }
  if (kind === 'motor') {
    const m = newMotor();
    bus.motors.push(m);
    return { kind: 'motor', busId, motorId: m.id };
  }
  if (kind === 'capacitor') {
    const c = newCapacitor();
    (bus.capacitors || (bus.capacitors = [])).push(c);
    return { kind: 'capacitor', busId, capId: c.id };
  }
  if (kind === 'breaker') {
    const b = newBreaker();
    bus.breakers.push(b);
    return { kind: 'breaker', busId, brkId: b.id };
  }
  return null;
}

export function deleteSelection(doc, selection) {
  if (!selection) return false;
  if (selection.kind === 'element') {
    const f = findBranchByChild(doc, selection.childBusId);
    if (f) { f.parentBus.children = f.parentBus.children.filter((br) => br.bus.id !== selection.childBusId); return true; }
  }
  if (selection.kind === 'motor') {
    const bus = findBus(doc, selection.busId);
    if (bus) { bus.motors = bus.motors.filter((m) => m.id !== selection.motorId); return true; }
  }
  if (selection.kind === 'capacitor') {
    const bus = findBus(doc, selection.busId);
    if (bus) { bus.capacitors = (bus.capacitors || []).filter((c) => c.id !== selection.capId); return true; }
  }
  if (selection.kind === 'breaker') {
    const bus = findBus(doc, selection.busId);
    if (bus) { bus.breakers = bus.breakers.filter((b) => b.id !== selection.brkId); return true; }
  }
  return false;
}

// ── Open-breaker pruning ───────────────────────────────────────────────
/** True when a bus carries at least one OPEN breaker (its feeder is opened). */
export const hasOpenBreaker = (bus) => (bus.breakers || []).some((b) => b.isOpen);

/** Copy of a bus with subtrees behind OPEN breakers removed. An open breaker
 *  disconnects its bus's incoming feeder, so the bus and everything downstream
 *  drop out of the engine math (a de-energized subtree carries no fault or
 *  load). The source bus is always kept — an open breaker there just prunes its
 *  children. For a three-winding transformer each winding prunes independently
 *  (`secondaryLive` flags a secondary dropped while its tertiary stays live). */
function pruneBus(bus) {
  const copy = { id: bus.id, label: bus.label, motors: bus.motors || [], capacitors: bus.capacitors || [], breakers: bus.breakers || [], children: [] };
  if (hasOpenBreaker(bus)) return copy; // open here → no children (only the source bus reaches this)
  for (const br of bus.children) {
    if (br.element.kind === 'transformer3') {
      const secOpen = hasOpenBreaker(br.bus);
      const terLive = br.tertiaryBus ? !hasOpenBreaker(br.tertiaryBus) : false;
      if (secOpen && !terLive) continue; // both windings dead → drop the whole branch
      copy.children.push({
        id: br.id, element: br.element, secondaryLive: !secOpen,
        bus: pruneBus(br.bus), tertiaryBus: terLive ? pruneBus(br.tertiaryBus) : null,
      });
    } else if (!hasOpenBreaker(br.bus)) {
      copy.children.push({ id: br.id, element: br.element, bus: pruneBus(br.bus) });
    }
  }
  return copy;
}

/** The document reduced to its energized part (open-breaker subtrees removed).
 *  All engine math runs on this so results match a physically de-energized
 *  circuit; the editable tree + schematic keep the full topology. */
export function prunedDocument(doc) {
  return { source: doc.source, sourceBus: pruneBus(doc.sourceBus) };
}

// ── Chain-level validation (cross-element voltage consistency) ──────────
const voltagesMatch = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1.0;
function voltageLabelShort(v) {
  if (!(v > 0)) return '—';
  if (v < 1000) return `${Math.round(v)} V`;
  const kv = v / 1000;
  return (kv === Math.round(kv) ? `${kv}` : kv.toFixed(2)) + ' kV';
}

/** Cross-element check: a transformer whose PRIMARY nameplate doesn't match the
 *  bus feeding it means an inconsistent model — the fault/load-flow numbers
 *  downstream are computed off the transformer's own ratio, not the real feed,
 *  so they're suspect. Returns the FAULT-space indices (aligned with
 *  `faultBusIndices` / the engine node array, incl. hidden star nodes) of every
 *  suspect bus, plus human messages. Expects an already-pruned doc so indices
 *  line up with `buildCircuit(pruned)`. */
export function chainContext(doc) {
  const messages = [];
  const suspect = new Set();
  let i = 0;
  const walk = (bus, upstreamV, parentSuspect) => {
    const myIndex = i++;
    if (parentSuspect) suspect.add(myIndex);
    for (const br of bus.children) {
      const el = br.element;
      if (el.kind === 'transformer3') {
        const starIndex = i++; // hidden star node
        const mismatch = !voltagesMatch(num(el.primaryV), upstreamV);
        if (mismatch) { messages.push(mismatchMessage(el, upstreamV)); suspect.add(starIndex); }
        const windingSuspect = parentSuspect || mismatch;
        if (br.secondaryLive !== false) walk(br.bus, num(el.secondaryV), windingSuspect);
        if (br.tertiaryBus) walk(br.tertiaryBus, num(el.tertiaryV), windingSuspect);
      } else {
        let childV = upstreamV;
        let childSuspect = parentSuspect;
        if (el.kind === 'transformer' && !voltagesMatch(num(el.primaryV), upstreamV)) {
          messages.push(mismatchMessage(el, upstreamV));
          childSuspect = true;
        }
        if (el.kind === 'transformer') childV = num(el.secondaryV);
        walk(br.bus, childV, childSuspect);
      }
    }
  };
  walk(doc.sourceBus, num(doc.source.voltage), false);
  return { hasIssues: messages.length > 0, suspectFaultIndices: suspect, messages };
}

function mismatchMessage(el, upstreamV) {
  const name = (el.label && el.label.trim()) || 'transformer';
  return `Transformer “${name}”: primary nameplate is ${voltageLabelShort(num(el.primaryV))}, but the upstream bus is ${voltageLabelShort(upstreamV)}. Fix the primary voltage or check the upstream element.`;
}

// ── Engine bridge ──────────────────────────────────────────────────────
export function buildSource(doc) {
  const s = doc.source;
  switch (s.mode) {
    case 'availableMVA': return Source.fromAvailableMVA(num(s.voltage), num(s.mva), num(s.xOverR));
    case 'infiniteBus': return Source.infiniteBus(num(s.voltage));
    case 'generator': return Source.generator(num(s.voltage), num(s.genKVA), num(s.genXdpp), num(s.genXdp), num(s.genXds) > 0 ? num(s.genXds) : null);
    case 'availableKA':
    default: return Source.fromAvailableKA(num(s.voltage), num(s.kA), num(s.xOverR));
  }
}

export function effectiveMotorKVA(m) {
  const k = num(m.ratedKVA, 0);
  return k > 0 ? k : num(m.ratedHP, 0);
}
/** IEEE C37.010 §5 interrupting X″ multiplier from motor type + size + speed. */
export function motorInterruptingMultiplier(m) {
  if (m.motorType === 'synchronous') return 1.5;
  if (m.motorType === 'induction') {
    const large = num(m.ratedRPM, 1800) > 1800 ? num(m.ratedHP) > 250 : num(m.ratedHP) > 1000;
    return large ? 1.5 : 3.0;
  }
  return 1.5;
}
function makeEngineMotor(m, busVLL) {
  const t = MOTOR_TYPES[m.motorType] || MOTOR_TYPES.custom;
  return new Motor({
    ratedKVA: effectiveMotorKVA(m),
    ratedVoltageLL: busVLL,
    subtransientReactancePU: num(m.subtransientReactancePU, 0.167),
    interruptingReactanceMultiplier: motorInterruptingMultiplier(m),
    contributesToInterrupting: t.contributes,
  });
}

export function buildCircuit(doc) {
  const toBus = (bus, vll) => {
    const motors = (bus.motors || []).map((m) => makeEngineMotor(m, vll));
    const cbus = new CircuitBus(bus.label && bus.label.trim() ? bus.label.trim() : 'Bus', [], motors);
    for (const br of bus.children) {
      const el = br.element;
      if (el.kind === 'transformer3') {
        const t3 = new ThreeWindingTransformer({
          ratedKVA: num(el.ratedKVA), tertiaryKVA: num(el.tertiaryKVA),
          primaryVoltageLL: num(el.primaryV), secondaryVoltageLL: num(el.secondaryV), tertiaryVoltageLL: num(el.tertiaryV),
          percentImpedanceHX: num(el.zHX), xOverRHX: num(el.xrHX),
          percentImpedanceHY: num(el.zHY), xOverRHY: num(el.xrHY),
          percentImpedanceXY: num(el.zXY), xOverRXY: num(el.xrXY),
        });
        cbus.children.push({
          element: threeWindingElement(t3),
          bus: toBus(br.bus, num(el.secondaryV)),
          tertiaryBus: br.tertiaryBus ? toBus(br.tertiaryBus, num(el.tertiaryV)) : null,
          secondaryLive: br.secondaryLive !== false,
        });
        continue;
      }
      const childVLL = el.kind === 'transformer' ? num(el.secondaryV) : vll;
      const element = el.kind === 'transformer'
        ? transformerElement(new Transformer({
            ratedKVA: num(el.kva), primaryVoltageLL: num(el.primaryV), secondaryVoltageLL: num(el.secondaryV),
            percentImpedance: num(el.percentZ), xOverR: num(el.xOverR),
          }))
        : cableElement(new CableSegment({
            label: el.label, lengthFeet: num(el.lengthFeet),
            resistancePerKFTAtReference: num(el.rPerKft), reactancePerKFT: num(el.xPerKft),
            maxOperatingTemperatureC: num(el.maxTempC, 90),
            conductorMaterial: el.material === 'aluminum' ? ConductorMaterial.aluminum : ConductorMaterial.copper,
            parallelCount: Math.max(1, Math.round(num(el.parallel, 1))),
          }));
      cbus.children.push({ element, bus: toBus(br.bus, childVLL) });
    }
    return cbus;
  };
  return new Circuit(buildSource(doc), toBus(doc.sourceBus, num(doc.source.voltage)));
}

// ── Load-flow bridge ───────────────────────────────────────────────────
/** Aggregate a bus's motors into one running `Load.motor` (HP-summed,
 *  HP-weighted PF + efficiency), or null if none is usable. */
function aggregateMotorsAsLoad(motors) {
  const valid = (motors || []).filter((m) => num(m.ratedHP) > 0 && num(m.powerFactor) > 0 && num(m.efficiency) > 0);
  const totalHP = valid.reduce((s, m) => s + num(m.ratedHP), 0);
  if (!(totalHP > 0)) return null;
  const wPF = valid.reduce((s, m) => s + num(m.ratedHP) * num(m.powerFactor), 0) / totalHP;
  const wEta = valid.reduce((s, m) => s + num(m.ratedHP) * num(m.efficiency), 0) / totalHP;
  return Load.motor(totalHP, wEta, wPF);
}

/** One `{ busIndex, load }` per bus carrying usable motors (load-flow index). */
export function collectBusLoads(doc) {
  const idx = loadFlowBusIndices(doc);
  const out = [];
  const walk = (bus) => {
    const load = aggregateMotorsAsLoad(bus.motors);
    if (load) out.push({ busIndex: idx.get(bus.id), load });
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  return out;
}

/** One `{ busIndex, capacitor }` per bus with in-service caps (kVAR-summed). */
export function collectBusCapacitors(doc) {
  const idx = loadFlowBusIndices(doc);
  const out = [];
  const walk = (bus) => {
    const totalKVAR = (bus.capacitors || []).reduce((s, c) => s + num(c.ratedKVAR, 0), 0);
    if (totalKVAR > 0) out.push({ busIndex: idx.get(bus.id), capacitor: new Capacitor({ ratedKVAR: totalKVAR, ratedVoltageLL: 0 }) });
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  return out;
}

/** Hottest cable max-operating temperature in the tree (fallback 90 °C). */
export function hotCableTemperatureC(doc) {
  let maxT = 0;
  const walk = (bus) => {
    for (const br of bus.children) if (br.element.kind === 'cable') maxT = Math.max(maxT, num(br.element.maxTempC, 90));
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  return maxT > 0 ? maxT : 90;
}

export const LOAD_FLOW_REFERENCE_TEMP_C = 25;

/** Run the steady-state load flow at the reference (`hot:false`, 25 °C) or
 *  hot-cable temperature. Returns the engine result plus the injections used. */
export function runLoadFlow(doc, { hot = false } = {}) {
  const loads = collectBusLoads(doc);
  const capacitors = collectBusCapacitors(doc);
  const temperatureC = hot ? hotCableTemperatureC(doc) : LOAD_FLOW_REFERENCE_TEMP_C;
  return { result: buildCircuit(doc).loadFlow({ loads, capacitors, temperatureC }), loads, capacitors, temperatureC };
}

/** True when the load flow would be non-trivial (a load or cap is present). */
export function hasLoadFlowInputs(doc) {
  return collectBusLoads(doc).length > 0 || collectBusCapacitors(doc).length > 0;
}

/** No-load voltage-rise solve: capacitors in service but every load shed, at
 *  hot cable temperature. Returns null when no capacitor is present — shows the
 *  overvoltage a PFC bank drives when its load disconnects while the bank stays
 *  energized. */
export function runNoLoadRise(doc) {
  const capacitors = collectBusCapacitors(doc);
  if (capacitors.length === 0) return null;
  const result = buildCircuit(doc).loadFlow({ loads: [], capacitors, temperatureC: hotCableTemperatureC(doc) });
  return { result, capacitors };
}

// ── Motor-start voltage dip ────────────────────────────────────────────
/** Starting PF for the locked-rotor inrush (affects only the Combined solve). */
export const LOCKED_ROTOR_START_PF = 0.2;

/** Locked-rotor (starting) current in amps + whether it was estimated. Uses the
 *  user's nameplate LRA when set (>0); otherwise FLA ÷ X″pu (≈ 6× FLA at the
 *  induction default). */
export function startingCurrent(m, busNominalVLL) {
  const lra = num(m.lockedRotorAmps, 0);
  if (lra > 0) return { amps: lra, estimated: false };
  const kva = effectiveMotorKVA(m);
  if (!(busNominalVLL > 0) || !(kva > 0)) return { amps: 0, estimated: true };
  const fla = (kva * 1000.0) / (SQRT3 * busNominalVLL);
  const x = num(m.subtransientReactancePU, 0.167) > 0 ? num(m.subtransientReactancePU) : 0.167;
  return { amps: fla / x, estimated: true };
}

/** "Combined Running" dip: THIS motor at locked rotor while every other motor
 *  keeps running (constant-power) and caps stay in service — solved with the
 *  iterative load flow at base (25 °C) and worst (hot) cable temperature.
 *  Returns dips at the starting motor's bus, or null for a non-converged solve. */
function motorStartCombinedDips(doc, startingMotorId, busVLL) {
  const idx = loadFlowBusIndices(doc);
  const loads = [];
  let startBusIndex = null;
  const walk = (bus) => {
    const i = idx.get(bus.id);
    const isStartBus = (bus.motors || []).some((m) => m.id === startingMotorId);
    if (isStartBus) startBusIndex = i;
    const running = isStartBus ? (bus.motors || []).filter((m) => m.id !== startingMotorId) : (bus.motors || []);
    const agg = aggregateMotorsAsLoad(running);
    if (agg) loads.push({ busIndex: i, load: agg });
    if (isStartBus) {
      const m = (bus.motors || []).find((x) => x.id === startingMotorId);
      const lra = startingCurrent(m, busVLL).amps;
      if (lra > 0) loads.push({ busIndex: i, load: Load.lockedRotor(lra, busVLL, LOCKED_ROTOR_START_PF) });
    }
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  if (startBusIndex == null) return { base: null, worst: null, iterations: null };

  const caps = collectBusCapacitors(doc);
  const circuit = buildCircuit(doc);
  const solve = (t) => {
    const flow = circuit.loadFlow({ loads, capacitors: caps, temperatureC: t });
    if (!flow.converged || startBusIndex >= flow.nodes.length) return null;
    return { dip: flow.nodes[startBusIndex].percentDropFromNominal, iterations: flow.iterations };
  };
  const base = solve(LOAD_FLOW_REFERENCE_TEMP_C);
  const worst = solve(hotCableTemperatureC(doc));
  return {
    base: base ? base.dip : null,
    worst: worst ? worst.dip : null,
    iterations: worst ? worst.iterations : (base ? base.iterations : null),
  };
}

/** Motor-starting voltage-dip analysis for every motor (HP > 0) in the tree.
 *  Singular = this motor alone (closed-form divider `%drop = Zsys/(Zsys+Zmotor)`);
 *  Combined = this motor starting while the rest of the system runs (load flow).
 *  Base uses the nominal-temp path Z; Worst uses the hot-temp path Z. */
export function motorStartAnalysis(doc) {
  const circuit = buildCircuit(doc);
  const nominal = circuit.computeNominal().nodes;
  const hot = circuit.computeMaxTemperature().nodes;
  const idx = faultBusIndices(doc);
  const out = [];
  const walk = (bus) => {
    const i = idx.get(bus.id);
    const node = nominal[i];
    const hotNode = hot[i];
    if (node && hotNode && node.voltageLL > 0) {
      const v = node.voltageLL;
      const zBase = node.cumulativeImpedance.magnitude;
      const zWorst = hotNode.cumulativeImpedance.magnitude;
      for (const m of bus.motors || []) {
        if (!(num(m.ratedHP) > 0)) continue;
        const start = startingCurrent(m, v);
        if (!(start.amps > 0)) continue;
        const zMotor = v / (SQRT3 * start.amps);
        if (!(zMotor > 0)) continue;
        const combined = motorStartCombinedDips(doc, m.id, v);
        out.push({
          motorId: m.id, label: m.label || 'Motor', busLabel: bus.label,
          lockedRotorAmps: start.amps, lraEstimated: start.estimated,
          singularBasePct: (zBase / (zBase + zMotor)) * 100,
          singularWorstPct: (zWorst / (zWorst + zMotor)) * 100,
          combinedBasePct: combined.base, combinedWorstPct: combined.worst,
          combinedIterations: combined.iterations,
        });
      }
    }
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  return out;
}

/** All breakers in the tree, each tagged with the pre-order node index of its bus. */
export function collectBreakers(doc) {
  const indices = faultBusIndices(doc);
  const out = [];
  const walk = (bus) => {
    // Open breakers are dropped from the verdict list — an open breaker has no
    // fault to check against (its downstream is de-energized).
    for (const b of bus.breakers) if (!b.isOpen) out.push({ busId: bus.id, brk: b, nodeIndex: indices.get(bus.id) });
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(doc.sourceBus);
  return out;
}
