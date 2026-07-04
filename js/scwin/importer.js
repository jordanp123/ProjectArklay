// Maps a decoded SC-WIN `.sc4` file into a web circuit document using the
// connectivity graph (each object's parent-index link), so radial, series, and
// branched circuits reconstruct correctly. The connected source is used
// (utility → available-MVA, generator → generator mode); disconnected sources
// are dropped. Dense files whose object stream interleaves are refused. Faithful
// port of `SCWINImporter`.

import { decode, looksLikeSCWIN } from './decoder.js';
import { CABLE_LIBRARY } from '../engine/cableLibrary.js';

export { looksLikeSCWIN };

// Generator type code → display string + typical X″/X′ (matches GENERATOR_TYPES).
const GEN_TYPE = [
  { name: '2-Pole Turbine', xdpp: 0.09, xdp: 0.15 },
  { name: '4-Pole Turbine', xdpp: 0.14, xdp: 0.23 },
  { name: 'Salient Pole with Dampers', xdpp: 0.20, xdp: 0.30 },
  { name: 'Salient Pole without Dampers', xdpp: 0.30, xdp: 0.30 },
];

let _seq = 1;
const uid = () => 'sw' + (_seq++);
const key = (cls, depth) => `${cls}|${depth}`;
const fmt = (v) => (v === Math.round(v) ? String(Math.round(v)) : String(v));
const CLASS_OF = { cable: 'CCable', transformer: 'CTrans', threeWinding: 'CTriWinding', motor: 'CMotor', generator: 'CGenerator', device: 'CElement', capacitor: 'CCapacitor', supply: 'CSupply' };
const elementClassName = (e) => CLASS_OF[e.kind] || '?';
const elementDepth = (e) => (e.kind === 'supply' ? 0 : (e.depthLevel ?? -1));

export function parseVoltageVolts(kvString) {
  const v = Number(String(kvString).trim());
  return Number.isFinite(v) ? v * 1000 : null;
}
function parseConductorSize(raw) {
  const s = raw.toUpperCase().trim();
  let m = s.match(/[0-9]{3,4}/);
  if (m && (s.includes('KCMIL') || s.includes('MCM'))) return `${m[0]} kcmil`;
  m = s.match(/([1-4])\s*\/\s*0/);
  if (m) return `${m[1]}/0 AWG`;
  m = s.replace('NO.', '').match(/[0-9]{1,2}/);
  if (m) return `${m[0]} AWG`;
  return null;
}
const cableVoltageClassFromCode = (code) => ({ 6: '5 kV', 7: '8 kV', 8: '15 kV', 9: '25 kV' }[code] || null);
function cableVoltageClass(busV) {
  if (busV < 2400.0001) return '2 kV';
  if (busV < 5000.0001) return '5 kV';
  if (busV < 8000.0001) return '8 kV';
  if (busV < 15000.0001) return '15 kV';
  return '25 kV';
}
function defaultTransformerXOverR(kva) {
  if (kva < 500.0001) return 3;
  if (kva < 2000.0001) return 5;
  if (kva < 5000.0001) return 6;
  if (kva < 10000.0001) return 7;
  return 8;
}
const deviceName = (code) => ({ 0x0a: 'Circuit breaker', 0x0b: 'Fuse', 0x0c: 'Disconnect', 0x0d: 'Contactor' }[code] || 'Protective device');

function groupBy(arr, keyFn) {
  const out = {};
  for (const x of arr) (out[keyFn(x)] || (out[keyFn(x)] = [])).push(x);
  return out;
}
function objectDepths(objects) {
  const byIndex = {}; for (const o of objects) byIndex[o.index] = o;
  const memo = {};
  const depth = (idx, budget) => {
    if (idx in memo) return memo[idx];
    const o = byIndex[idx];
    const d = (o && o.parentIndex !== 0 && budget > 0) ? 1 + depth(o.parentIndex, budget - 1) : 0;
    memo[idx] = d; return d;
  };
  const result = {};
  for (const o of objects) result[o.index] = depth(o.index, objects.length);
  return result;
}

const STRUCT_MISMATCH = 'This SC-WIN file’s structure didn’t line up as expected and wasn’t imported.';

function assignDeviceParams(ir, depthOf, paramFor) {
  const byIndex = {}; for (const o of ir.objects) byIndex[o.index] = o;
  const markers = ir.objects.filter((o) => o.className !== 'CElement')
    .filter((o) => paramFor[o.index]).map((o) => [paramFor[o.index].recordOffset, o.index])
    .sort((a, b) => a[0] - b[0]);
  const ancestorAtDepth = (start, d) => {
    let cur = start;
    while (cur != null) {
      if (depthOf[cur] === d) return cur;
      const o = byIndex[cur];
      cur = (o && o.parentIndex !== 0) ? o.parentIndex : null;
    }
    return null;
  };
  const assigned = new Set();
  const leftovers = [];
  for (const p of ir.devices.slice().sort((a, b) => a.recordOffset - b.recordOffset)) {
    let anchor = null;
    for (const m of markers) { if (m[0] < p.recordOffset) anchor = m[1]; else break; }
    let target = anchor != null ? ancestorAtDepth(anchor, p.depthLevel) : null;
    if (target != null && !(byIndex[target].className === 'CElement' && !assigned.has(target))) target = null;
    if (target != null) { paramFor[target] = elementFor(p); assigned.add(target); } else leftovers.push(p);
  }
  const unassigned = ir.objects.filter((o) => o.className === 'CElement' && !assigned.has(o.index));
  for (const p of leftovers) {
    const i = unassigned.findIndex((o) => depthOf[o.index] === p.depthLevel);
    if (i < 0) throw new Error(STRUCT_MISMATCH);
    paramFor[unassigned.splice(i, 1)[0].index] = elementFor(p);
  }
}
// IR device records are already SCWINElement-shaped (kind:'device'); identity.
const elementFor = (p) => p;

/** Decode + map a `.sc4` byte array into `{ doc, report }`. Throws a
 *  user-readable Error for anything unsupported. */
export function importSCWIN(bytes) {
  const ir = decode(bytes);
  const warnings = [];
  const defaulted = [];
  if (ir.objectStreamInterleaved || ir.objects.length !== ir.elements.length) {
    throw new Error('This SC-WIN file is too complex to import yet — its structure couldn’t be read with confidence.');
  }

  const depthOf = objectDepths(ir.objects);
  const paramFor = {};
  const objectsByKey = groupBy(ir.objects.filter((o) => o.className !== 'CElement'), (o) => key(o.className, depthOf[o.index] ?? -1));
  const paramsByKey = groupBy(ir.elements.filter((e) => e.kind !== 'device'), (e) => key(elementClassName(e), elementDepth(e)));
  for (const [k, objs] of Object.entries(objectsByKey)) {
    const params = (paramsByKey[k] || []).slice().sort((a, b) => a.recordOffset - b.recordOffset);
    if (params.length !== objs.length) throw new Error(STRUCT_MISMATCH);
    objs.slice().sort((a, b) => a.index - b.index).forEach((obj, i) => { paramFor[obj.index] = params[i]; });
  }
  assignDeviceParams(ir, depthOf, paramFor);
  if (Object.keys(paramFor).length !== ir.objects.length) throw new Error(STRUCT_MISMATCH);

  if (ir.supplies.length !== 1) throw new Error('This SC-WIN file has no utility source SCME can use.');
  const supplyElem = ir.supplies[0];
  const connectedGens = ir.generators.filter((g) => g.connected);
  const connectedCount = (supplyElem.connected ? 1 : 0) + connectedGens.length;
  if (connectedCount === 0) throw new Error('No source is connected in this SC-WIN file. Connect the utility or a generator, then re-export.');
  if (connectedCount > 1) throw new Error('More than one source is connected. SC-WIN allows only one connected source; fix it and re-export.');
  const rootVoltage = parseVoltageVolts(supplyElem.kvString);
  if (rootVoltage == null) throw new Error(`Could not read the source bus voltage ("${supplyElem.kvString}").`);
  const gen = connectedGens[0] || null;

  const supplyObj = ir.objects.find((o) => o.className === 'CSupply');
  if (!supplyObj) throw new Error('This SC-WIN file has no utility source SCME can use.');

  // Builders: plain trees, converted to web buses at the end.
  const mkBus = (label, voltage) => ({ label, voltage, branches: [], motors: [], capacitors: [], breakers: [] });
  const root = mkBus(gen ? `Generator bus ${supplyElem.kvString} kV` : `Utility ${supplyElem.kvString} kV`, rootVoltage);
  const busFor = { [supplyObj.index]: root };

  // Pair the two coupled CTriWinding objects (type 6 = secondary, 5 = tertiary).
  const triIsSecondary = new Set();
  const triIsTertiary = new Set();
  const triSecForTer = {};
  const triBranchForSec = {};
  const triObjects = ir.objects.filter((o) => o.className === 'CTriWinding');
  for (const group of Object.values(groupBy(triObjects, (o) => o.parentIndex))) {
    const recs = group.map((o) => (paramFor[o.index] && paramFor[o.index].kind === 'threeWinding') ? { obj: o, code: paramFor[o.index].typeCode } : null).filter(Boolean);
    const sec = recs.find((x) => x.code === 6); const ter = recs.find((x) => x.code === 5);
    if (recs.length !== 2 || !sec || !ter) continue;
    triIsSecondary.add(sec.obj.index); triIsTertiary.add(ter.obj.index); triSecForTer[ter.obj.index] = sec.obj.index;
  }
  if (triObjects.length !== triIsSecondary.size + triIsTertiary.size) {
    throw new Error('This SC-WIN file has a three-winding transformer topology SCME can’t import yet.');
  }

  const cableElement = (c, busVoltage) => {
    const sz = parseConductorSize(c.sizeString);
    const voltage = cableVoltageClassFromCode(c.kvClassCode) || cableVoltageClass(busVoltage);
    let entry = null;
    if (sz) {
      entry = CABLE_LIBRARY.find((e) => e.type === 'SHD-GC' && e.material === 'copper' && e.size === sz && e.kv === voltage)
        || CABLE_LIBRARY.find((e) => e.type === 'SHD-GC' && e.material === 'copper' && e.size === sz);
    }
    let rPerKft; let xPerKft; let maxTempC;
    if (entry) { rPerKft = entry.rPerKft; xPerKft = entry.xPerKft; maxTempC = entry.maxTempC; defaulted.push(`Cable ${c.sizeString}: R/X from library entry “${entry.name}”.`); }
    else { warnings.push(`Cable ${c.sizeString}: no library match for the conductor size; used default impedance — verify R/X.`); rPerKft = 0.10; xPerKft = 0.04; maxTempC = c.operatingTempC > 0 ? c.operatingTempC : 90; }
    return { id: uid(), kind: 'cable', label: `Cable ${c.sizeString}`.trim(), lengthFeet: c.lengthFeet, rPerKft, xPerKft, material: 'copper', maxTempC, parallel: 1 };
  };
  const transformerElement = (t, primaryVolts) => {
    const secondary = parseVoltageVolts(t.secondaryKvString) ?? 480;
    const xr = defaultTransformerXOverR(t.ratedKVA);
    defaulted.push(`Transformer ${fmt(t.ratedKVA)} kVA: X/R set to ${fmt(xr)} (SC-WIN does not store it).`);
    return { id: uid(), kind: 'transformer', label: `XFMR ${fmt(t.ratedKVA)} kVA`, kva: t.ratedKVA, primaryV: primaryVolts, secondaryV: secondary, percentZ: t.percentImpedance, xOverR: xr };
  };
  const threeWindingElement = (t, primaryVolts) => {
    const secV = parseVoltageVolts(t.secondaryKvString) ?? 480;
    const terV = parseVoltageVolts(t.tertiaryKvString) ?? 240;
    const conv = (rOhm, xOhm, baseKVA) => {
      const zOhm = Math.sqrt(rOhm * rOhm + xOhm * xOhm);
      const zBase = baseKVA > 0 ? (primaryVolts * primaryVolts) / (baseKVA * 1000) : 0;
      return { z: zBase > 0 ? (zOhm / zBase) * 100 : 0, xr: rOhm > 0 ? xOhm / rOhm : 0 };
    };
    const hx = conv(t.resistanceHXPrimaryOhms, t.reactanceHXPrimaryOhms, t.secondaryKVA);
    const hy = conv(t.resistanceHYPrimaryOhms, t.reactanceHYPrimaryOhms, t.tertiaryKVA);
    const xy = conv(t.resistanceXYPrimaryOhms, t.reactanceXYPrimaryOhms, Math.min(t.secondaryKVA, t.tertiaryKVA));
    defaulted.push(`Three-winding transformer ${fmt(t.secondaryKVA)}/${fmt(t.tertiaryKVA)} kVA: pairwise impedances converted from SC-WIN’s primary-referred ohms.`);
    return { id: uid(), kind: 'transformer3', label: `XFMR ${fmt(t.secondaryKVA)}/${fmt(t.tertiaryKVA)} kVA 3W`, ratedKVA: t.secondaryKVA, tertiaryKVA: t.tertiaryKVA, primaryV: primaryVolts, secondaryV: secV, tertiaryV: terV, zHX: hx.z, xrHX: hx.xr, zHY: hy.z, xrHY: hy.xr, zXY: xy.z, xrXY: xy.xr };
  };
  const busLabel = (n) => (n > 0 ? `Bus ${n}` : 'Bus');

  for (const obj of ir.objects) {
    const parent = busFor[obj.parentIndex] || root;
    const el = paramFor[obj.index];
    switch (obj.className) {
      case 'CSupply': case 'CGenerator': break;
      case 'CCable': {
        if (!el || el.kind !== 'cable') break;
        const child = mkBus(busLabel(el.busNumber), parent.voltage);
        parent.branches.push({ element: cableElement(el, parent.voltage), child, tertiary: null });
        busFor[obj.index] = child; break;
      }
      case 'CTrans': {
        if (!el || el.kind !== 'transformer') break;
        const secondary = parseVoltageVolts(el.secondaryKvString) ?? 480;
        const child = mkBus(busLabel(el.busNumber), secondary);
        parent.branches.push({ element: transformerElement(el, parent.voltage), child, tertiary: null });
        busFor[obj.index] = child; break;
      }
      case 'CTriWinding': {
        if (!el || el.kind !== 'threeWinding') break;
        const secIdx = triIsSecondary.has(obj.index) ? obj.index : (triSecForTer[obj.index] ?? obj.index);
        if (!triBranchForSec[secIdx] && paramFor[secIdx] && paramFor[secIdx].kind === 'threeWinding') {
          const secT = paramFor[secIdx];
          const secChild = mkBus('Secondary', parseVoltageVolts(secT.secondaryKvString) ?? 480);
          const branch = { element: threeWindingElement(secT, parent.voltage), child: secChild, tertiary: null };
          parent.branches.push(branch);
          triBranchForSec[secIdx] = branch;
          busFor[secIdx] = secChild;
        }
        const branch = triBranchForSec[secIdx];
        if (!branch) break;
        if (obj.index === secIdx) { busFor[obj.index] = branch.child; }
        else { const terChild = mkBus('Tertiary', parseVoltageVolts(el.tertiaryKvString) ?? 240); branch.tertiary = terChild; busFor[obj.index] = terChild; }
        break;
      }
      case 'CMotor': {
        if (!el || el.kind !== 'motor') break;
        parent.motors.push({ id: uid(), label: `Motor ${fmt(el.ratedHP)} HP`, ratedHP: el.ratedHP, ratedRPM: 1800, ratedKVA: 0, motorType: 'induction', subtransientReactancePU: 0.167, powerFactor: 0.85, efficiency: 0.92, lockedRotorAmps: null });
        busFor[obj.index] = parent; break;
      }
      case 'CCapacitor': {
        if (!el || el.kind !== 'capacitor') break;
        parent.capacitors.push({ id: uid(), label: `PFC bank ${fmt(el.ratedKVAR)} kVAR`, ratedKVAR: el.ratedKVAR });
        busFor[obj.index] = parent; break;
      }
      case 'CElement': busFor[obj.index] = parent; break;
      default: break;
    }
  }

  // Devices → breakers (second pass): place on the bus the branch leads to.
  const childrenOf = groupBy(ir.objects, (o) => o.parentIndex);
  const breakerBus = (device) => {
    let cur = device.index;
    while (true) {
      const kids = childrenOf[cur] || [];
      if (kids.length !== 1) break;
      const child = kids[0];
      if (child.className === 'CCable' || child.className === 'CTrans') return busFor[child.index];
      if (child.className === 'CElement') { cur = child.index; } else break;
    }
    return busFor[device.parentIndex];
  };
  for (const obj of ir.objects) {
    if (obj.className !== 'CElement') continue;
    const d = paramFor[obj.index]; if (!d || d.kind !== 'device') continue;
    const bb = breakerBus(obj) || root;
    const name = deviceName(d.deviceCode);
    defaulted.push(`${name} imported as a breaker with a placeholder 1000 A trip — set it before relying on the breaker check.`);
    bb.breakers.push({ id: uid(), label: name, trip: 1000, tolPct: 25, isOpen: false });
  }

  // Builder tree → web bus tree.
  const toBus = (bb) => ({
    id: uid(), label: bb.label,
    children: bb.branches.map((br) => {
      const out = { id: uid(), element: br.element, bus: toBus(br.child) };
      if (br.tertiary) out.tertiaryBus = toBus(br.tertiary);
      return out;
    }),
    motors: bb.motors, capacitors: bb.capacitors, breakers: bb.breakers,
  });

  let source;
  if (gen) {
    const gt = GEN_TYPE[gen.typeCode] || GEN_TYPE[3];
    defaulted.push('Generator source: subtransient/transient reactances set to SCME defaults (SC-WIN does not store them).');
    source = { mode: 'generator', voltage: rootVoltage, xOverR: 8, kA: 25, mva: 100, genType: gt.name, genKVA: gen.ratedKVA, genXdpp: gt.xdpp, genXdp: gt.xdp, genXds: 0 };
  } else {
    source = { mode: 'availableMVA', voltage: rootVoltage, xOverR: supplyElem.xOverR, kA: 25, mva: supplyElem.availableMVA, genType: '2-Pole Turbine', genKVA: 1000, genXdpp: 0.09, genXdp: 0.15, genXds: 0 };
  }

  const imported = [];
  if (gen) imported.push(`Generator source (${fmt(gen.ratedKVA)} kVA)`);
  else imported.push(`Utility source (${supplyElem.kvString} kV, ${fmt(supplyElem.availableMVA)} MVA, X/R ${fmt(supplyElem.xOverR)})`);
  if (ir.transformers.length) imported.push(`${ir.transformers.length} transformer(s)`);
  if (ir.threeWindings.length) imported.push(`${ir.threeWindings.length / 2} three-winding transformer(s)`);
  if (ir.cables.length) imported.push(`${ir.cables.length} cable(s)`);
  if (ir.motors.length) imported.push(`${ir.motors.length} motor(s)`);
  if (ir.capacitors.length) imported.push(`${ir.capacitors.length} capacitor bank(s)`);
  if (ir.devices.length) imported.push(`${ir.devices.length} protective device(s) as breaker(s)`);
  const skipped = [];
  const droppedSources = (ir.supplies.length + ir.generators.length) - 1;
  if (droppedSources > 0) skipped.push(`${droppedSources} disconnected source(s) dropped`);

  return { doc: { source, sourceBus: toBus(root) }, report: { imported, defaulted, skipped, warnings } };
}
