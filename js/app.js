// SCME web app — a three-pane desktop shell (sidebar outline · content ·
// inspector) over the fault-current engine, with a single-pane mobile layout.
// Zero dependencies.

import * as M from './model.js';
import { validate } from './validation.js';
import { schematicSVG } from './schematic.js';
import { serializeSCME, parseSCME } from './scmeFile.js';
import { looksLikeSCWIN, importSCWIN } from './scwin/importer.js';
import { CABLE_LIBRARY } from './engine/cableLibrary.js';
import { evaluateBreaker, minimumShortCircuitAmps, BreakerVerdict } from './engine/breakerAnalysis.js';
import { FaultType } from './engine/faultType.js';

const state = {
  doc: M.newDocument(),
  selection: { kind: 'source' },
  pane: 'results',
  inspectorShown: true,
  docName: 'Untitled circuit',
  mobilePane: 'content', // which pane is visible on a phone: circuit | content | inspector
};
const doc = () => state.doc;

// ── Small helpers ──────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(v) {
  return String(v ?? '').replace(/[&<"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;' }[c]));
}
function formatCurrent(a) {
  if (!Number.isFinite(a)) return '—';
  if (a >= 1000) return (a / 1000).toFixed(a >= 100000 ? 0 : 1) + ' kA';
  return Math.floor(a) + ' A';
}
function voltageLabel(v) {
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1000) { const kv = v / 1000; return (kv === Math.round(kv) ? String(kv) : kv.toFixed(2)) + ' kV'; }
  return Math.round(v) + ' V';
}
function elementSubtitle(el) {
  if (el.kind === 'transformer') return `${Math.round(Number(el.kva) || 0)} kVA`;
  if (el.kind === 'transformer3') return `${Math.round(Number(el.ratedKVA) || 0)} kVA · 3W`;
  const n = Math.round(Number(el.parallel) || 1);
  const ft = Math.round(Number(el.lengthFeet) || 0);
  return n > 1 ? `${ft} ft ×${n}` : `${ft} ft`;
}
function breakerSubtitle(b) { return `${Math.round(Number(b.trip) || 0)} A${b.isOpen ? ' · open' : ''}`; }

// ── Selection identity ─────────────────────────────────────────────────
function selKey(s) { return s ? [s.kind, s.busId || '', s.childBusId || '', s.motorId || '', s.capId || '', s.brkId || ''].join('|') : ''; }
function sameSel(a, b) { return selKey(a) === selKey(b); }
function selFromEl(el) {
  const kind = el.dataset.selkind;
  if (kind === 'source') return { kind: 'source' };
  if (kind === 'bus') return { kind: 'bus', busId: el.dataset.busid };
  if (kind === 'element') return { kind: 'element', childBusId: el.dataset.childbusid };
  if (kind === 'motor') return { kind: 'motor', busId: el.dataset.busid, motorId: el.dataset.motorid };
  if (kind === 'capacitor') return { kind: 'capacitor', busId: el.dataset.busid, capId: el.dataset.capid };
  if (kind === 'breaker') return { kind: 'breaker', busId: el.dataset.busid, brkId: el.dataset.brkid };
  return null;
}

// ── Sidebar ────────────────────────────────────────────────────────────
/** Movable things can be dragged onto another bus (branches move with their
 *  whole subtree; the source bus itself stays put). */
function isDraggableSel(sel) {
  if (sel.kind === 'element' || sel.kind === 'motor' || sel.kind === 'capacitor' || sel.kind === 'breaker') return true;
  return sel.kind === 'bus' && sel.busId !== doc().sourceBus.id;
}

function rowHTML(sel, dotClass, title, sub) {
  const selected = sameSel(sel, state.selection) ? ' is-selected' : '';
  const drag = isDraggableSel(sel) ? ' draggable="true"' : '';
  // Ids are session-generated (uid), but escape anyway — attribute context.
  const data = `data-selkind="${escapeAttr(sel.kind)}"` +
    (sel.busId ? ` data-busid="${escapeAttr(sel.busId)}"` : '') +
    (sel.childBusId ? ` data-childbusid="${escapeAttr(sel.childBusId)}"` : '') +
    (sel.motorId ? ` data-motorid="${escapeAttr(sel.motorId)}"` : '') +
    (sel.capId ? ` data-capid="${escapeAttr(sel.capId)}"` : '') +
    (sel.brkId ? ` data-brkid="${escapeAttr(sel.brkId)}"` : '');
  return `<div class="row${selected}" role="treeitem" tabindex="0"${drag} ${data}>
    <span class="dot ${dotClass}"></span>
    <span class="row-title">${escapeHTML(title)}</span>
    ${sub ? `<span class="row-sub">${escapeHTML(sub)}</span>` : ''}
    ${drag ? '<span class="grip" aria-hidden="true" title="Drag to move, reorder, or delete">⠿</span>' : ''}
  </div>`;
}

function renderSidebar() {
  const nominals = M.nominalVoltages(doc());
  const s = doc().source;
  const sourceTitle = s.mode === 'generator' ? 'Generator' : 'Utility source';

  const renderBus = (bus, vll, isRoot) => {
    const kids = [];
    for (const br of bus.children) {
      const el = br.element;
      const elemRow = rowHTML({ kind: 'element', childBusId: br.bus.id }, 'dot-element',
        el.label || 'Element', elementSubtitle(el));
      if (el.kind === 'transformer3') {
        // Both winding buses hang off the one element row.
        const secTree = renderBus(br.bus, Number(el.secondaryV), false);
        const terTree = br.tertiaryBus ? renderBus(br.tertiaryBus, Number(el.tertiaryV), false) : '';
        kids.push(`<li>${elemRow}<ul>${secTree}${terTree}</ul></li>`);
      } else {
        const childVLL = el.kind === 'transformer' ? Number(el.secondaryV) : vll;
        kids.push(`<li>${elemRow}<ul>${renderBus(br.bus, childVLL, false)}</ul></li>`);
      }
    }
    for (const m of bus.motors || []) {
      kids.push(`<li>${rowHTML({ kind: 'motor', busId: bus.id, motorId: m.id }, 'dot-motor',
        m.label || 'Motor', `${Math.round(Number(m.ratedHP) || 0)} HP`)}</li>`);
    }
    for (const c of bus.capacitors || []) {
      kids.push(`<li>${rowHTML({ kind: 'capacitor', busId: bus.id, capId: c.id }, 'dot-capacitor',
        c.label || 'Capacitor', `${Math.round(Number(c.ratedKVAR) || 0)} kVAR`)}</li>`);
    }
    for (const b of bus.breakers) {
      kids.push(`<li>${rowHTML({ kind: 'breaker', busId: bus.id, brkId: b.id }, 'dot-breaker',
        b.label || 'Breaker', breakerSubtitle(b))}</li>`);
    }
    const busRow = rowHTML({ kind: 'bus', busId: bus.id }, 'dot-bus',
      isRoot ? `${bus.label} (source)` : bus.label, voltageLabel(vll));
    return `<li>${busRow}${kids.length ? `<ul>${kids.join('')}</ul>` : ''}</li>`;
  };

  $('sidebar').innerHTML =
    `<div class="side-section-title">Source</div>
     <ul class="tree">${rowHTML({ kind: 'source' }, 'dot-source', sourceTitle, voltageLabel(Number(s.voltage)))}</ul>
     <div class="side-section-title">Circuit</div>
     <ul class="tree">${renderBus(doc().sourceBus, Number(s.voltage), true)}</ul>
     <p class="side-hint">Drag <span class="grip-demo">⠿</span> rows onto a bus to move them, between
       rows of the same kind to reorder, or onto the trash that appears to remove.</p>`;
}

// ── Content: results ───────────────────────────────────────────────────
function renderIssues(kind, title, items) {
  const icon = kind === 'blocked' ? '⛔' : '⚠';
  return `<div class="issues issues-${kind}"><div class="issues-title">${icon} ${escapeHTML(title)}</div>
    <ul>${items.map((m) => `<li>${escapeHTML(m)}</li>`).join('')}</ul></div>`;
}

function dropText(pct) {
  if (!Number.isFinite(pct)) return '—';
  if (pct < -0.05) return `▲ ${Math.abs(pct).toFixed(1)}% rise`;
  return `${pct.toFixed(1)}%`;
}
function dropClass(pct) {
  if (pct >= 5) return 'verdict-fail';
  if (pct >= 3) return 'lf-warn';
  if (pct < -0.05) return 'lf-rise';
  return '';
}
/** Motor-start dip severity: red ≥15%, amber 10–15%. */
function dipColor(pct) {
  if (pct == null || !Number.isFinite(pct)) return '';
  if (pct >= 15) return 'verdict-fail';
  if (pct >= 10) return 'lf-warn';
  return '';
}

function renderContent() {
  const content = $('content');
  if (state.pane === 'schematic') {
    const svg = schematicSVG(doc(), state.selection, M.nominalVoltages(doc()));
    content.innerHTML = `<h2>One-line diagram</h2>
      <p class="hint">Click any symbol to select and edit it in the inspector. Source at top; buses are rails; transformers and cables sit on the drops; motors, capacitors, and breakers hang below their bus. Drag a row from the sidebar onto a bus rail here (or onto a bus row in the sidebar) to move it.</p>
      <div class="schematic-wrap">${svg}</div>`;
    return;
  }

  const { errors, warnings } = validate(doc());
  if (errors.length > 0) {
    content.innerHTML = `<h2>Available fault current — by bus</h2>` +
      renderIssues('blocked', 'Calculation blocked — resolve these inputs', errors);
    return;
  }

  const chainIssues = M.chainContext(M.prunedDocument(doc())).hasIssues;
  content.innerHTML =
    faultGridHTML(doc(), warnings) +
    interruptingNotesHTML(doc()) +
    breakerSectionHTML(doc()) +
    (chainIssues ? chainSuppressedNotice() : motorStartSectionHTML(doc()) + loadFlowSectionHTML(doc()) + noLoadRiseSectionHTML(doc()));
}

// ── Results section builders (shared by the live view and the print report) ──
function faultGridHTML(d, warnings = []) {
  d = M.prunedDocument(d); // open-breaker subtrees drop out of the results
  const chain = M.chainContext(d);
  const circuit = M.buildCircuit(d);
  const nominal = circuit.computeNominal();
  const hot = circuit.computeMaxTemperature();
  const interrupting = circuit.computeInterrupting();
  const rows = nominal.nodes.map((n, i) => ({ n, i })).filter(({ n }) => !n.isSynthetic).map(({ n, i }) => {
    const suspect = chain.suspectFaultIndices.has(i);
    const intNode = interrupting.nodes[i];
    const minSC3 = minimumShortCircuitAmps(hot.nodes[i], FaultType.threePhase);
    const minSCLL = minimumShortCircuitAmps(hot.nodes[i], FaultType.lineToLine);
    const indent = '&nbsp;'.repeat(n.depth * 3);
    return `<tr class="${suspect ? 'suspect-row' : ''}">
      <td class="bus-name">${indent}${suspect ? '⚠ ' : ''}${escapeHTML(n.label)}</td>
      <td class="mono">${voltageLabel(n.voltageLL)}</td>
      <td class="mono">${formatCurrent(n.asymmetricalThreePhaseFaultCurrentAmps)}</td>
      <td class="mono">${formatCurrent(n.asymmetricalLineToLineFaultCurrentAmps)}</td>
      <td class="mono">${formatCurrent(intNode.threePhaseFaultCurrentAmps)}</td>
      <td class="mono">${formatCurrent(intNode.lineToLineFaultCurrentAmps)}</td>
      <td class="mono">${formatCurrent(minSC3)}</td>
      <td class="mono">${formatCurrent(minSCLL)}</td>
    </tr>`;
  }).join('');
  const chainWarn = chain.hasIssues
    ? renderIssues('blocked', 'Circuit chain issue — ⚠ rows are suspect', chain.messages)
    : '';
  return `<h2>Available fault current — by bus</h2>
     <p class="hint">Asym = first-cycle asymmetric RMS (max SC, cold cable). Int = 5-cycle interrupting.
       Min = minimum SC at max cable temperature with utility sag + arcing derate.</p>
     ${warnings.length ? renderIssues('warn', 'Warnings', warnings) : ''}
     ${chainWarn}
     <div class="section"><table class="results">
       <thead><tr><th>Bus</th><th>Voltage</th><th>Asym 3φ</th><th>Asym L-L</th><th>Int 3φ</th><th>Int L-L</th><th>Min 3φ</th><th>Min L-L</th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div>`;
}

/** A single notice replacing the load-flow-derived sections when a transformer's
 *  primary voltage doesn't match its upstream bus (the mismatch taints the whole
 *  load-flow solution). */
function chainSuppressedNotice() {
  return `<div class="section"><h2>Voltage profile &amp; motor-starting</h2>${renderIssues('warn', 'Hidden — circuit chain issue',
    ['A transformer’s primary voltage doesn’t match its upstream bus. That inconsistency taints the entire load-flow solution, so the voltage-profile and motor-starting results are hidden until the chain is fixed.'])}</div>`;
}

/** Interrupting-reactance caveats (Int column): synchronous-motor X′≈1.5×X″
 *  assumption and generator-source X″-at-5-cycles. */
function interruptingNotesHTML(d) {
  d = M.prunedDocument(d);
  let anySync = false;
  const walk = (bus) => {
    if ((bus.motors || []).some((m) => m.motorType === 'synchronous')) anySync = true;
    for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); }
  };
  walk(d.sourceBus);
  const notes = [];
  if (anySync) notes.push(['Synchronous motor — interrupting reactance',
    'This circuit has a synchronous motor. The 5-cycle interrupting value (Int) models synchronous motors with X′_d ≈ 1.5 × X″_d (the typical industrial ratio) rather than asking for X′_d explicitly, so for motors whose nameplate ratio differs from ~1.5× the Int contribution from those motors may be off by a few percent. Asym and Min rows are unaffected.']);
  if (d.source.mode === 'generator') notes.push(['Generator source — interrupting reactance',
    'The 5-cycle interrupting value (Int) uses the generator’s subtransient reactance X″ as the source impedance — a conservative deviation from methods that prescribe transient X′ at 5 cycles. Because X″ < X′, this yields a higher (more conservative) interrupting current. Asym and Min rows are unaffected.']);
  return notes.map(([t, body]) => `<div class="issues issues-warn"><div class="issues-title">${escapeHTML(t)}</div><p class="note-body">${escapeHTML(body)}</p></div>`).join('');
}

function breakerSectionHTML(d) {
  d = M.prunedDocument(d);
  const breakers = M.collectBreakers(d);
  if (breakers.length === 0) return '';
  const hot = M.buildCircuit(d).computeMaxTemperature();
  const brows = breakers.map(({ brk, nodeIndex }) => {
    const node = hot.nodes[nodeIndex];
    if (!node) return '';
    const check = evaluateBreaker({ instantaneousTripAmps: Number(brk.trip), tolerancePercent: Number(brk.tolPct) }, node);
    const pass = check.verdict === BreakerVerdict.pass;
    return `<div class="breaker-row">
      <span class="breaker-name">${escapeHTML(brk.label || 'Breaker')}</span>
      <span class="${pass ? 'verdict-pass' : 'verdict-fail'}">${pass ? 'TRIPS' : 'WILL NOT TRIP'}</span>
      <span class="breaker-meta">on ${escapeHTML(node.label)} · trip ${Math.round(Number(brk.trip))} A vs effective ${formatCurrent(check.effectiveFaultCurrentAmps)}</span>
    </div>`;
  }).join('');
  return `<div class="section"><h2>Breaker instantaneous pickup</h2>${brows}
    <p class="hint mt-2">Effective = bolted × 5% utility sag × arcing factor × (1 − tolerance), against the minimum (hot-cable) fault current. Not a substitute for a coordination study.</p></div>`;
}

function loadFlowSectionHTML(d) {
  d = M.prunedDocument(d);
  if (!M.hasLoadFlowInputs(d)) return '';
  const { result: lf } = M.runLoadFlow(d);
  const lrows = lf.nodes.map((n) => {
    const indent = '&nbsp;'.repeat(n.depth * 3);
    return `<tr>
      <td class="bus-name">${indent}${escapeHTML(n.label)}</td>
      <td class="mono">${voltageLabel(n.voltageLL)}</td>
      <td class="mono ${dropClass(n.percentDropFromNominal)}">${dropText(n.percentDropFromNominal)}</td>
      <td class="mono">${formatCurrent(n.currentMagnitude)}</td>
    </tr>`;
  }).join('');
  const conv = lf.converged ? '' :
    renderIssues('warn', 'Load flow did not converge',
      [`The solver hit its iteration limit (${lf.iterations}). The values below are the last iteration and may be unreliable.`]);
  return `<div class="section"><h2>Steady-state voltage profile</h2>${conv}
    <table class="results">
      <thead><tr><th>Bus</th><th>Voltage</th><th>Drop from nominal</th><th>Line current</th></tr></thead>
      <tbody>${lrows}</tbody>
    </table>
    <p class="hint mt-2">Iterative load flow at 25&nbsp;°C reference. Motors modeled as constant-power running load (HP-weighted per bus); PFC capacitors in service. Positive = below nominal; ▲ = voltage rise. Rule-of-thumb limits ≈ 3% feeder / 5% total — verify against a real study.</p></div>`;
}

/** No-load voltage rise — capacitors energized with the load shed (overvoltage
 *  risk on load disconnect). Shown only when a capacitor is present. */
function noLoadRiseSectionHTML(d) {
  d = M.prunedDocument(d);
  const nlr = M.runNoLoadRise(d);
  if (!nlr) return '';
  const lf = nlr.result;
  if (!lf.converged) {
    return `<div class="section"><h2>No-load voltage rise</h2>${renderIssues('warn', 'Did not converge',
      [`The no-load solve hit its iteration limit (${lf.iterations}); values withheld.`])}</div>`;
  }
  let maxRise = -Infinity; let maxNode = null;
  const rows = lf.nodes.map((n) => {
    const rise = -n.percentDropFromNominal;
    if (rise > maxRise) { maxRise = rise; maxNode = n; }
    const cls = rise >= 5 ? 'verdict-fail' : (rise >= 2 ? 'lf-warn' : '');
    const indent = '&nbsp;'.repeat(n.depth * 3);
    return `<tr>
      <td class="bus-name">${indent}${escapeHTML(n.label)}</td>
      <td class="mono">${voltageLabel(n.voltageLL)}</td>
      <td class="mono ${cls}">${rise >= 0.05 ? `+${rise.toFixed(1)}%` : '0.0%'}</td>
    </tr>`;
  }).join('');
  const footer = maxNode && maxRise >= 0.05
    ? `If the load disconnects with the capacitor bank still energized, voltage peaks at ${voltageLabel(maxNode.voltageLL)} on ${escapeHTML(maxNode.label)} (+${maxRise.toFixed(1)}% above nominal). Inductive upstream impedance amplifies cap-driven rise; oversized banks on lightly-loaded systems are most at risk.`
    : 'With the load shed, the capacitor bank produces negligible voltage rise here.';
  return `<div class="section"><h2>No-load voltage rise</h2>
    <table class="results">
      <thead><tr><th>Bus</th><th>Voltage</th><th>Rise above nominal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint mt-2">${escapeHTML(footer)} At hot cable temperature.</p></div>`;
}

function motorStartSectionHTML(d) {
  d = M.prunedDocument(d);
  const starts = M.motorStartAnalysis(d);
  if (starts.length === 0) return '';
  const dipCell = (pct) => (pct == null || !Number.isFinite(pct))
    ? '<span class="ms-na">did not converge</span>'
    : `<span class="mono ${dipColor(pct)}">${pct.toFixed(1)}%</span>`;
  const method = (title, base, worst, iters) => {
    if (base == null && worst == null) {
      return `<div class="ms-method"><span class="ms-label">${title}</span><span class="ms-na">did not converge</span></div>`;
    }
    const it = (iters != null) ? ` <span class="ms-iter">· ${iters} iter${iters === 1 ? '' : 's'}</span>` : '';
    return `<div class="ms-method"><span class="ms-label">${title}</span>Base ${dipCell(base)} · Worst ${dipCell(worst)}${it}</div>`;
  };
  const msRows = starts.map((r) => {
    const overall = Math.max(r.singularWorstPct, r.combinedWorstPct ?? 0);
    return `<div class="ms-row">
      <div class="ms-head"><span class="ms-name ${dipColor(overall)}">⚙ ${escapeHTML(r.label)}</span>
        <span class="ms-lra">${Math.round(r.lockedRotorAmps)} A LRA${r.lraEstimated ? ' · est.' : ''}</span></div>
      ${method('Singular', r.singularBasePct, r.singularWorstPct, null)}
      ${method('Combined', r.combinedBasePct, r.combinedWorstPct, r.combinedIterations)}
      <div class="ms-bus">${escapeHTML(r.busLabel)}</div>
    </div>`;
  }).join('');
  const estNote = starts.some((r) => r.lraEstimated)
    ? '<p class="hint mt-1">Rows marked “est.” use a locked-rotor current estimated from motor size and X″ — enter a nameplate LRA on the motor for accuracy.</p>' : '';
  return `<div class="section"><h2>Motor-starting voltage dip</h2>${msRows}${estNote}
    <p class="hint mt-2">Dip at each motor’s bus during its locked-rotor start. Singular = this motor alone (closed-form divider). Combined = this motor starting while the rest of the system keeps running (iterative load flow; “—” if it didn’t converge). Base = cables at nominal temperature; Worst = maximum operating temperature. Highlight: red ≥ 15%, amber 10–15%.</p></div>`;
}
/** Re-render the content pane when it's showing derived output (results or
 *  the live schematic) so edits/selection are reflected immediately. */
function renderContentIfResults() { if (state.pane === 'results' || state.pane === 'schematic') renderContent(); }

// ── Inspector ──────────────────────────────────────────────────────────
function field(f, label, value, note = '') {
  return `<div class="field"><label>${label}</label>
    <input data-field="${f}" type="number" step="any" value="${escapeAttr(value)}" /></div>` +
    (note ? `<p class="field-note">${escapeHTML(note)}</p>` : '');
}
function textField(f, label, value) {
  return `<div class="field"><label>${label}</label>
    <input data-field="${f}" type="text" value="${escapeAttr(value)}" /></div>`;
}
function boolField(f, label, checked, note = '') {
  return `<div class="field"><label class="chk"><input type="checkbox" data-field="${f}" data-bool="1"${checked ? ' checked' : ''} /> ${escapeHTML(label)}</label></div>` +
    (note ? `<p class="field-note">${escapeHTML(note)}</p>` : '');
}
/** Cable-library picker: cascading Type → kV → Size filters (much faster than
 *  one 200-entry list). Picking a size fills the cable's R/X/material/max-temp.
 *  `cableLibSel` holds the transient filter selection (defaults to SHD-GC). */
let cableLibSel = { type: 'SHD-GC', kv: '' };
function cableLibrarySelect() {
  const opt = (v, label, sel) => `<option value="${escapeAttr(v)}"${sel ? ' selected' : ''}>${escapeHTML(label)}</option>`;
  const t = cableLibSel.type;
  const kv = cableLibSel.kv;
  const types = [...new Set(CABLE_LIBRARY.map((e) => e.type))];
  const kvs = t ? [...new Set(CABLE_LIBRARY.filter((e) => e.type === t).map((e) => e.kv))] : [];
  const sizes = (t && kv) ? CABLE_LIBRARY.filter((e) => e.type === t && e.kv === kv) : [];
  const typeSel = `<select data-field="cableLibType" title="Cable type">${opt('', 'Type…', !t)}${types.map((x) => opt(x, x, x === t)).join('')}</select>`;
  const kvSel = `<select data-field="cableLibKv" title="Voltage class"${t ? '' : ' disabled'}>${opt('', 'kV…', !kv)}${kvs.map((x) => opt(x, x, x === kv)).join('')}</select>`;
  const sizeSel = `<select class="lib-size" data-field="cableLibSize" title="Conductor size"${(t && kv) ? '' : ' disabled'}><option value="">${(t && kv) ? 'Choose a size…' : 'Size…'}</option>${sizes.map((e) => opt(e.id, e.size, false)).join('')}</select>`;
  return `<div class="field"><label>Pick from library</label>
    <div class="lib-picker">${typeSel}${kvSel}${sizeSel}</div>
    <p class="field-note">Filter by cable type and voltage class, then pick a conductor size to fill R / X.</p></div>`;
}
function addButton(busId, kind, dot, label) {
  return `<button class="insp-add-btn" data-add="${escapeAttr(kind)}" data-busid="${escapeAttr(busId)}">
    <span class="dot ${dot}"></span>${escapeHTML(label)}</button>`;
}
function deleteBar() { return `<div class="delete-bar"><button class="btn-delete">Delete</button></div>`; }

function inspectorHeader(dot, title, sub) {
  return `<div class="insp-header"><span class="dot ${dot}"></span>
    <div><div class="insp-title">${escapeHTML(title)}</div>
    <div class="insp-sub">${escapeHTML(sub)}</div></div></div>`;
}

function renderInspector() {
  const insp = $('inspector');
  const s = state.selection;
  const d = doc();
  const nominals = M.nominalVoltages(d);

  if (!s || s.kind === 'source') {
    const src = d.source;
    const modeSel = `<div class="field"><label>Mode</label>
      <select data-field="mode">
        <option value="availableKA"${src.mode === 'availableKA' ? ' selected' : ''}>Available current (kA)</option>
        <option value="availableMVA"${src.mode === 'availableMVA' ? ' selected' : ''}>Available capacity (MVA)</option>
        <option value="infiniteBus"${src.mode === 'infiniteBus' ? ' selected' : ''}>Infinite bus</option>
        <option value="generator"${src.mode === 'generator' ? ' selected' : ''}>On-site generator</option>
      </select></div>`;
    let modeFields = '';
    if (src.mode === 'availableKA') modeFields = field('kA', 'Available current (kA)', src.kA) + field('xOverR', 'Source X/R', src.xOverR);
    else if (src.mode === 'availableMVA') modeFields = field('mva', 'Available capacity (MVA)', src.mva) + field('xOverR', 'Source X/R', src.xOverR);
    else if (src.mode === 'generator') {
      const genTypeSel = `<div class="field"><label>Generator type</label><select data-field="genType">
        ${Object.keys(M.GENERATOR_TYPES).map((k) => `<option value="${escapeAttr(k)}"${(src.genType || '2-Pole Turbine') === k ? ' selected' : ''}>${escapeHTML(k)}</option>`).join('')}
      </select></div>`;
      modeFields = genTypeSel +
        field('genKVA', 'Rating (kVA)', src.genKVA) +
        field('genXdpp', 'X″ subtransient (pu)', src.genXdpp) +
        field('genXdp', 'X′ transient (pu)', src.genXdp) +
        field('genXds', 'Xs synchronous (pu, optional)', src.genXds ?? 0, 'Blank / 0 = use X′ for the steady-state load flow.');
    }
    insp.innerHTML = inspectorHeader('dot-source', src.mode === 'generator' ? 'Generator' : 'Utility source', voltageLabel(Number(src.voltage))) +
      `<div class="insp-body"><div class="insp-section-title">Source</div>
        ${modeSel}${field('voltage', 'System voltage (V, line-to-line)', src.voltage)}${modeFields}</div>`;
    return;
  }

  if (s.kind === 'bus') {
    const bus = M.findBus(d, s.busId);
    if (!bus) return insp.innerHTML = emptyInspector();
    const isRoot = bus.id === d.sourceBus.id;
    insp.innerHTML = inspectorHeader('dot-bus', isRoot ? `${bus.label} (source)` : bus.label, voltageLabel(nominals.get(bus.id))) +
      `<div class="insp-body">
        <div class="insp-section-title">Bus</div>${textField('label', 'Bus label', bus.label)}
        <div class="insp-section-title">Add to this bus</div>
        ${addButton(bus.id, 'transformer', 'dot-element', 'Transformer')}
        ${addButton(bus.id, 'transformer3', 'dot-element', '3-winding transformer')}
        ${addButton(bus.id, 'cable', 'dot-element', 'Cable')}
        ${addButton(bus.id, 'motor', 'dot-motor', 'Motor')}
        ${addButton(bus.id, 'capacitor', 'dot-capacitor', 'Capacitor')}
        ${addButton(bus.id, 'breaker', 'dot-breaker', 'Breaker')}
        <p class="field-note mt-2">Transformers and cables feed a new downstream bus; motors, capacitors, and breakers attach to this bus. The new item opens for editing.</p>
      </div>`;
    return;
  }

  if (s.kind === 'element') {
    const found = M.findBranchByChild(d, s.childBusId);
    if (!found) return insp.innerHTML = emptyInspector();
    const el = found.branch.element;
    const feedsLabel = found.branch.bus.label;
    if (el.kind === 'transformer3') {
      const terLabel = found.branch.tertiaryBus ? found.branch.tertiaryBus.label : 'Tertiary';
      const fields3 = textField('label', 'Label', el.label) +
        field('ratedKVA', 'Secondary / common rating (kVA)', el.ratedKVA) +
        field('tertiaryKVA', 'Tertiary rating (kVA)', el.tertiaryKVA) +
        field('primaryV', 'Primary voltage (V)', el.primaryV) +
        field('secondaryV', 'Secondary voltage (V)', el.secondaryV) +
        field('tertiaryV', 'Tertiary voltage (V)', el.tertiaryV) +
        field('zHX', '%Z H–X (primary–secondary)', el.zHX) + field('xrHX', 'X/R H–X', el.xrHX) +
        field('zHY', '%Z H–Y (primary–tertiary)', el.zHY) + field('xrHY', 'X/R H–Y', el.xrHY) +
        field('zXY', '%Z X–Y (secondary–tertiary)', el.zXY) + field('xrXY', 'X/R X–Y', el.xrXY);
      insp.innerHTML = inspectorHeader('dot-element', el.label || '3-winding transformer', elementSubtitle(el)) +
        `<div class="insp-body"><div class="insp-section-title">3-winding transformer</div>
          ${fields3}<p class="field-note">Feeds a secondary bus (${escapeHTML(feedsLabel)}) and a tertiary bus (${escapeHTML(terLabel)}) off a hidden star node. Each %Z is on its own winding-pair base; the tertiary and secondary–tertiary values normalize to the common rating.</p>${deleteBar()}</div>`;
      return;
    }
    let fields;
    if (el.kind === 'transformer') {
      fields = textField('label', 'Label', el.label) +
        field('kva', 'Rating (kVA)', el.kva) +
        field('primaryV', 'Primary voltage (V)', el.primaryV) +
        field('secondaryV', 'Secondary voltage (V)', el.secondaryV) +
        field('percentZ', '%Z (nameplate impedance)', el.percentZ) +
        field('xOverR', 'X/R ratio', el.xOverR);
    } else {
      fields = cableLibrarySelect() +
        textField('label', 'Label', el.label) +
        field('lengthFeet', 'Length (ft)', el.lengthFeet) +
        field('rPerKft', 'Resistance @25°C (Ω/kft)', el.rPerKft) +
        field('xPerKft', 'Reactance (Ω/kft)', el.xPerKft) +
        field('maxTempC', 'Max operating temp (°C)', el.maxTempC) +
        field('parallel', 'Conductors in parallel', el.parallel) +
        `<div class="field"><label>Conductor material</label>
          <select data-field="material">
            <option value="copper"${el.material === 'copper' ? ' selected' : ''}>Copper</option>
            <option value="aluminum"${el.material === 'aluminum' ? ' selected' : ''}>Aluminum</option>
          </select></div>`;
    }
    insp.innerHTML = inspectorHeader('dot-element', el.label || 'Element', elementSubtitle(el)) +
      `<div class="insp-body"><div class="insp-section-title">${el.kind === 'transformer' ? 'Transformer' : 'Cable'}</div>
        ${fields}<p class="field-note">Feeds downstream bus: ${escapeHTML(feedsLabel)}</p>${deleteBar()}</div>`;
    return;
  }

  if (s.kind === 'breaker') {
    const bus = M.findBus(d, s.busId);
    const b = bus && bus.breakers.find((x) => x.id === s.brkId);
    if (!b) return insp.innerHTML = emptyInspector();
    insp.innerHTML = inspectorHeader('dot-breaker', b.label || 'Breaker', breakerSubtitle(b)) +
      `<div class="insp-body"><div class="insp-section-title">Breaker</div>
        ${textField('label', 'Label', b.label)}
        ${field('trip', 'Instantaneous trip (A)', b.trip)}
        ${field('tolPct', 'Pickup tolerance (%)', b.tolPct)}
        ${boolField('isOpen', 'Breaker open (disconnects downstream)', !!b.isOpen, 'An open breaker de-energizes this bus and everything below it — those buses drop out of the fault and load-flow results.')}
        <p class="field-note">On bus: ${escapeHTML(bus.label)}. Checked against the minimum (hot) fault current.</p>${deleteBar()}</div>`;
    return;
  }

  if (s.kind === 'motor') {
    const bus = M.findBus(d, s.busId);
    const m = bus && bus.motors.find((x) => x.id === s.motorId);
    if (!m) return (insp.innerHTML = emptyInspector());
    const typeSel = `<div class="field"><label>Motor type</label><select data-field="motorType">
      ${Object.entries(M.MOTOR_TYPES).map(([k, v]) => `<option value="${k}"${m.motorType === k ? ' selected' : ''}>${v.label}</option>`).join('')}
    </select></div>`;
    insp.innerHTML = inspectorHeader('dot-motor', m.label || 'Motor', `${Math.round(Number(m.ratedHP) || 0)} HP`) +
      `<div class="insp-body"><div class="insp-section-title">Motor</div>
        ${textField('label', 'Label', m.label)}
        ${field('ratedHP', 'Horsepower (HP)', m.ratedHP)}
        ${field('ratedRPM', 'Synchronous speed (RPM)', m.ratedRPM)}
        ${field('ratedKVA', 'kVA base (0 = derive from HP)', m.ratedKVA ?? 0)}
        ${typeSel}
        ${field('subtransientReactancePU', 'Subtransient X″ (pu)', m.subtransientReactancePU)}
        ${field('powerFactor', 'Power factor', m.powerFactor)}
        ${field('efficiency', 'Efficiency', m.efficiency)}
        ${field('lockedRotorAmps', 'Locked-rotor amps (optional)', m.lockedRotorAmps ?? '', 'Blank = estimated from motor size and X″ for the starting-dip analysis.')}
        <p class="field-note">On bus: ${escapeHTML(bus.label)}. Contributes to max-SC and 5-cycle interrupting; excluded from minimum SC per IEEE 141.</p>${deleteBar()}</div>`;
    return;
  }

  if (s.kind === 'capacitor') {
    const bus = M.findBus(d, s.busId);
    const c = bus && (bus.capacitors || []).find((x) => x.id === s.capId);
    if (!c) return (insp.innerHTML = emptyInspector());
    insp.innerHTML = inspectorHeader('dot-capacitor', c.label || 'Capacitor', `${Math.round(Number(c.ratedKVAR) || 0)} kVAR`) +
      `<div class="insp-body"><div class="insp-section-title">Capacitor (PFC)</div>
        ${textField('label', 'Label', c.label)}
        ${field('ratedKVAR', 'Rating (kVAR, three-phase)', c.ratedKVAR)}
        <p class="field-note">On bus: ${escapeHTML(bus.label)}. Power-factor correction / voltage support in the load flow only. Neglected in the short-circuit calc per IEEE 141 / C37.010.</p>${deleteBar()}</div>`;
    return;
  }

  insp.innerHTML = emptyInspector();
}
function emptyInspector() {
  return `<div class="insp-empty">Select an item in the sidebar to edit it, or a bus to add elements.</div>`;
}

function currentTarget() {
  const s = state.selection;
  if (!s) return null;
  if (s.kind === 'source') return doc().source;
  if (s.kind === 'bus') return M.findBus(doc(), s.busId);
  if (s.kind === 'element') { const f = M.findBranchByChild(doc(), s.childBusId); return f ? f.branch.element : null; }
  if (s.kind === 'motor') { const bus = M.findBus(doc(), s.busId); return bus ? bus.motors.find((m) => m.id === s.motorId) : null; }
  if (s.kind === 'capacitor') { const bus = M.findBus(doc(), s.busId); return bus ? (bus.capacitors || []).find((c) => c.id === s.capId) : null; }
  if (s.kind === 'breaker') { const bus = M.findBus(doc(), s.busId); return bus ? bus.breakers.find((b) => b.id === s.brkId) : null; }
  return null;
}

// ── Toolbar ────────────────────────────────────────────────────────────
function updateToolbar() {
  $('view-schematic').classList.toggle('is-active', state.pane === 'schematic');
  $('view-results').classList.toggle('is-active', state.pane === 'results');
  $('view-schematic').setAttribute('aria-selected', String(state.pane === 'schematic'));
  $('view-results').setAttribute('aria-selected', String(state.pane === 'results'));
  $('panes').classList.toggle('no-inspector', !state.inspectorShown);
  $('btn-inspector').classList.toggle('is-on', state.inspectorShown);
  updateMobilePane();
}

// ── Mobile pane switching (single-pane layout on phones) ────────────────
function updateMobilePane() {
  $('panes').dataset.mpane = state.mobilePane;
  document.querySelectorAll('#mobile-tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.mpane === state.mobilePane));
  $('mtab-content').textContent = state.pane === 'schematic' ? 'Schematic' : 'Results';
}
function setMobilePane(p) { state.mobilePane = p; updateMobilePane(); }

// ── Floating menu (Add + context) ──────────────────────────────────────
let menuItems = [];
function showMenu(x, y, items) {
  menuItems = items;
  const menu = $('floating-menu');
  menu.innerHTML = items.map((it, i) =>
    it.sep ? '<div class="menu-sep"></div>'
      : `<div class="menu-item ${it.danger ? 'danger' : ''}" data-idx="${i}">
           ${it.dot ? `<span class="dot ${it.dot}"></span>` : ''}${escapeHTML(it.label)}</div>`).join('');
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
}
function hideMenu() { $('floating-menu').hidden = true; menuItems = []; }

function addMenuItems(busId) {
  return [
    { label: 'Transformer', dot: 'dot-element', onClick: () => doAdd(busId, 'transformer') },
    { label: '3-winding xfmr', dot: 'dot-element', onClick: () => doAdd(busId, 'transformer3') },
    { label: 'Cable', dot: 'dot-element', onClick: () => doAdd(busId, 'cable') },
    { label: 'Motor', dot: 'dot-motor', onClick: () => doAdd(busId, 'motor') },
    { label: 'Capacitor', dot: 'dot-capacitor', onClick: () => doAdd(busId, 'capacitor') },
    { label: 'Breaker', dot: 'dot-breaker', onClick: () => doAdd(busId, 'breaker') },
  ];
}
function contextItems(sel) {
  if (sel.kind === 'bus') return addMenuItems(sel.busId);
  if (sel.kind === 'element') {
    return [...addMenuItems(sel.childBusId), { sep: true },
      { label: 'Delete', danger: true, onClick: () => deleteSel(sel) }];
  }
  if (sel.kind === 'motor' || sel.kind === 'capacitor' || sel.kind === 'breaker') return [{ label: 'Delete', danger: true, onClick: () => deleteSel(sel) }];
  return null;
}

// ── Actions ────────────────────────────────────────────────────────────
function selectNode(sel) {
  state.selection = sel; renderSidebar(); renderInspector();
  if (state.pane === 'schematic') renderContent(); // refresh the schematic highlight
  setMobilePane('inspector'); // on a phone, jump to the editor for the tapped node
}
function doAdd(busId, kind) {
  const sel = M.addToBus(doc(), busId, kind);
  if (sel) state.selection = sel;
  renderSidebar(); renderInspector(); renderContentIfResults();
  setMobilePane('inspector');
}
function deleteSel(sel) {
  if (M.deleteSelection(doc(), sel)) {
    if (sameSel(sel, state.selection)) state.selection = { kind: 'source' };
    renderSidebar(); renderInspector(); renderContentIfResults();
  }
}

// ── Print report + .scme load/save ─────────────────────────────────────
function setDocName(name) { state.docName = name || 'Untitled circuit'; $('doc-name').textContent = state.docName; }
function renderAll() { updateToolbar(); renderSidebar(); renderInspector(); renderContent(); }

/** Full printable report — reuses the live results section builders. */
function buildReportHTML(d) {
  const { errors, warnings } = validate(d);
  const s = d.source;
  const modeLabel = { availableKA: 'Available current', availableMVA: 'Available capacity', infiniteBus: 'Infinite bus', generator: 'On-site generator' }[s.mode] || s.mode;
  const detail = s.mode === 'availableKA' ? `${Number(s.kA)} kA · X/R ${Number(s.xOverR)}`
    : s.mode === 'availableMVA' ? `${Number(s.mva)} MVA · X/R ${Number(s.xOverR)}`
    : s.mode === 'generator' ? `${Number(s.genKVA)} kVA · X″ ${Number(s.genXdpp)} · X′ ${Number(s.genXdp)}` : '—';
  const chainIssues = M.chainContext(M.prunedDocument(d)).hasIssues;
  const body = errors.length
    ? renderIssues('blocked', 'Calculation blocked — resolve these inputs', errors)
    : faultGridHTML(d, warnings) + interruptingNotesHTML(d) + breakerSectionHTML(d) +
      (chainIssues ? chainSuppressedNotice() : motorStartSectionHTML(d) + loadFlowSectionHTML(d) + noLoadRiseSectionHTML(d));
  return `<div class="report-head">
      <div class="report-title">SCME — Short-Circuit Report</div>
      <div class="report-meta">${escapeHTML(state.docName)} · ${escapeHTML(new Date().toLocaleString())}</div>
      <div class="report-warn">⚠ Training and educational tool. Accuracy not guaranteed. NOT for engineering, safety, operational, or compliance decisions. Verify every value against another source.</div>
      <div class="report-src"><strong>Source:</strong> ${escapeHTML(modeLabel)} · ${voltageLabel(Number(s.voltage))} · ${escapeHTML(detail)}</div>
    </div>
    ${body}
    <div class="report-foot">Calculations follow IEEE 141 / IEEE C37.010 conventions, simplified, provided with no warranty. Motors are excluded from minimum SC; capacitors are excluded from the fault network per IEEE 141 / C37.010.</div>`;
}

function doPrint() {
  $('report').innerHTML = buildReportHTML(doc());
  window.print();
}

function doSave() {
  try {
    const text = serializeSCME(doc());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    const base = (state.docName && state.docName !== 'Untitled circuit') ? state.docName : 'circuit';
    a.href = url; a.download = base.replace(/\.scme$/i, '') + '.scme';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { alert('Could not save the file: ' + e.message); }
}

function showImportReport(report) {
  const parts = [];
  if (report.imported.length) parts.push('Imported:\n• ' + report.imported.join('\n• '));
  if (report.defaulted.length) parts.push('Defaults applied (SC-WIN doesn’t store these — verify):\n• ' + report.defaulted.join('\n• '));
  if (report.warnings.length) parts.push('Warnings:\n• ' + report.warnings.join('\n• '));
  if (report.skipped.length) parts.push('Skipped:\n• ' + report.skipped.join('\n• '));
  if (parts.length) alert('SC-WIN import\n\n' + parts.join('\n\n'));
}

function doOpenFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const bytes = new Uint8Array(reader.result);
      if (looksLikeSCWIN(bytes)) {
        // SC-WIN files are recognized by CONTENT (a transfer may rename .sc4 → .bin).
        const { doc: newDoc, report } = importSCWIN(bytes);
        state.doc = newDoc;
        state.selection = { kind: 'source' };
        setDocName(file.name.replace(/\.(sc4|bin)$/i, ''));
        renderAll();
        showImportReport(report);
      } else {
        state.doc = parseSCME(new TextDecoder().decode(bytes));
        state.selection = { kind: 'source' };
        setDocName(file.name.replace(/\.scme$/i, ''));
        renderAll();
      }
    } catch (e) { alert('Could not open the file:\n' + e.message); }
  };
  reader.onerror = () => alert('Could not read the file.');
  reader.readAsArrayBuffer(file);
}

// ── Wiring ─────────────────────────────────────────────────────────────
// ── Drag-and-drop moves (desktop enhancement; the Add menu stays the touch path) ──
// `dataTransfer` payloads aren't readable during dragover, so the active drag
// lives here: what's being moved plus the set of bus ids it must NOT drop onto
// (itself/its subtree/its current location), precomputed at dragstart.
let activeDrag = null;
let dropTargetEl = null;

const DROP_CLASSES = ['drop-ok', 'drop-before', 'drop-after'];
function clearDropTarget() {
  if (dropTargetEl) { dropTargetEl.classList.remove(...DROP_CLASSES); dropTargetEl = null; }
}

function dragFromRow(row) {
  const sel = selFromEl(row);
  if (!sel || !isDraggableSel(sel)) return null;
  const d = doc();
  if (sel.kind === 'element' || sel.kind === 'bus') {
    const childBusId = sel.kind === 'element' ? sel.childBusId : sel.busId;
    const found = M.findBranchByChild(d, childBusId);
    if (!found) return null;
    // Forbidden: every bus inside the moved subtree (a cycle). The current
    // parent stays valid — dropping there means "move to the end" (a reorder);
    // the model's no-op detection refuses it when nothing would change.
    const forbidden = new Set();
    const walk = (bus) => { forbidden.add(bus.id); for (const br of bus.children) { walk(br.bus); if (br.tertiaryBus) walk(br.tertiaryBus); } };
    walk(found.branch.bus);
    if (found.branch.tertiaryBus) walk(found.branch.tertiaryBus);
    return { move: 'branch', childBusId, forbidden, selection: { kind: 'element', childBusId } };
  }
  const itemId = sel.motorId || sel.capId || sel.brkId;
  return { move: sel.kind, fromBusId: sel.busId, itemId, forbidden: new Set(), sel };
}

/** True when the pointer sits in the top half of `el` (insert BEFORE it). */
function inTopHalf(e, el) {
  const r = el.getBoundingClientRect();
  return (e.clientY - r.top) < r.height / 2;
}

const ATTACH_LIST_KEY = { motor: 'motors', capacitor: 'capacitors', breaker: 'breakers' };
const ATTACH_ID_KEY = { motor: 'motorid', capacitor: 'capid', breaker: 'brkid' };

/** Resolve what a drag event is over: `{ busId, beforeId, el, cls }` or null.
 *  Bus rows and schematic rails append (`drop-ok`); a row of the same kind is
 *  a positional target — insert before/after it (`drop-before`/`drop-after`). */
function resolveDropTarget(e) {
  if (!e.target.closest) return null;
  const d = doc();

  // Positional targets: a sibling-kind row (top half = before, bottom = after).
  const rowEl = e.target.closest('.row[data-selkind]');
  if (rowEl) {
    const kind = rowEl.dataset.selkind;
    if (activeDrag.move === 'branch' && kind === 'element') {
      const overChildId = rowEl.dataset.childbusid;
      if (overChildId !== activeDrag.childBusId && !activeDrag.forbidden.has(overChildId)) {
        const f = M.findBranchByChild(d, overChildId);
        if (f && !activeDrag.forbidden.has(f.parentBus.id)) {
          const before = inTopHalf(e, rowEl);
          const siblings = f.parentBus.children;
          const i = siblings.indexOf(f.branch);
          const beforeId = before ? overChildId : (siblings[i + 1] ? siblings[i + 1].bus.id : null);
          return { busId: f.parentBus.id, beforeId, el: rowEl, cls: before ? 'drop-before' : 'drop-after' };
        }
      }
    }
    if (activeDrag.move !== 'branch' && kind === activeDrag.move) {
      const overId = rowEl.dataset[ATTACH_ID_KEY[kind]];
      if (overId && overId !== activeDrag.itemId) {
        const bus = M.findBus(d, rowEl.dataset.busid);
        const list = bus ? (bus[ATTACH_LIST_KEY[kind]] || []) : [];
        const i = list.findIndex((x) => x.id === overId);
        if (i >= 0) {
          const before = inTopHalf(e, rowEl);
          const beforeId = before ? overId : (list[i + 1] ? list[i + 1].id : null);
          return { busId: rowEl.dataset.busid, beforeId, el: rowEl, cls: before ? 'drop-before' : 'drop-after' };
        }
      }
    }
  }

  // Append targets: a bus row or a schematic bus rail.
  const busEl = (rowEl && rowEl.dataset.selkind === 'bus') ? rowEl : e.target.closest('.sch-hit[data-selkind="bus"]');
  if (!busEl) return null;
  const busId = busEl.dataset ? busEl.dataset.busid : null;
  if (!busId || activeDrag.forbidden.has(busId)) return null;
  return { busId, beforeId: null, el: busEl, cls: 'drop-ok' };
}

function applyMove(target) {
  if (activeDrag.move === 'branch') {
    const moved = M.moveBranch(doc(), activeDrag.childBusId, target.busId, target.beforeId);
    if (moved) state.selection = activeDrag.selection;
    return moved;
  }
  const moved = M.moveAttachment(doc(), activeDrag.move, activeDrag.fromBusId, activeDrag.itemId, target.busId, target.beforeId);
  if (moved) state.selection = { ...activeDrag.sel, busId: target.busId };
  return moved;
}

function onDragOver(e) {
  if (!activeDrag) return;
  const target = resolveDropTarget(e);
  clearDropTarget();
  if (!target) return;
  e.preventDefault(); // accept the drop
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  dropTargetEl = target.el;
  dropTargetEl.classList.add(target.cls);
}

function onDrop(e) {
  if (!activeDrag) return;
  const target = resolveDropTarget(e);
  clearDropTarget();
  if (!target) return;
  e.preventDefault();
  const moved = applyMove(target);
  endDrag();
  if (moved) renderAll();
}

/** The selection shape `deleteSelection` expects for whatever is being dragged. */
function dragSelection() {
  if (activeDrag.move === 'branch') return { kind: 'element', childBusId: activeDrag.childBusId };
  return { ...activeDrag.sel, busId: activeDrag.fromBusId };
}

function endDrag() {
  activeDrag = null;
  clearDropTarget();
  const trash = $('drop-trash');
  trash.hidden = true;
  trash.classList.remove('drop-del');
}

function wire() {
  // Drag sources: sidebar rows. Drop targets: sidebar bus rows + schematic rails.
  $('sidebar').addEventListener('dragstart', (e) => {
    const row = e.target.closest('.row[draggable="true"]');
    activeDrag = row ? dragFromRow(row) : null;
    if (!activeDrag) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'scme-move'); // required by some browsers to start the drag
    $('drop-trash').hidden = false;
  });
  $('sidebar').addEventListener('dragend', endDrag);
  $('sidebar').addEventListener('dragover', onDragOver);
  $('sidebar').addEventListener('drop', onDrop);
  $('content').addEventListener('dragover', onDragOver);
  $('content').addEventListener('drop', onDrop);

  // Trash zone: appears while dragging; dropping deletes the dragged thing
  // (a branch takes its whole subtree, same as the Delete key).
  $('drop-trash').addEventListener('dragover', (e) => {
    if (!activeDrag) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    $('drop-trash').classList.add('drop-del');
  });
  $('drop-trash').addEventListener('dragleave', () => $('drop-trash').classList.remove('drop-del'));
  $('drop-trash').addEventListener('drop', (e) => {
    if (!activeDrag) return;
    e.preventDefault();
    const sel = dragSelection();
    endDrag();
    deleteSel(sel);
  });

  $('sidebar').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) selectNode(selFromEl(row));
  });
  $('sidebar').addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    e.preventDefault();
    const sel = selFromEl(row);
    selectNode(sel);
    const items = contextItems(sel);
    if (items) showMenu(e.clientX, e.clientY, items);
  });

  // Schematic: click a symbol to select it (same data-* attrs as sidebar rows).
  $('content').addEventListener('click', (e) => {
    const g = e.target.closest('.sch-hit');
    if (g) selectNode(selFromEl(g));
  });
  $('content').addEventListener('contextmenu', (e) => {
    const g = e.target.closest('.sch-hit');
    if (!g) return;
    e.preventDefault();
    const sel = selFromEl(g);
    selectNode(sel);
    const items = contextItems(sel);
    if (items) showMenu(e.clientX, e.clientY, items);
  });

  $('inspector').addEventListener('input', (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    const target = currentTarget();
    if (!target) return;
    if (f === 'cableLibType') { cableLibSel.type = e.target.value; cableLibSel.kv = ''; renderInspector(); return; }
    if (f === 'cableLibKv') { cableLibSel.kv = e.target.value; renderInspector(); return; }
    if (f === 'cableLibSize') {
      const entry = CABLE_LIBRARY.find((x) => x.id === e.target.value);
      if (entry) {
        target.rPerKft = entry.rPerKft; target.xPerKft = entry.xPerKft;
        target.material = entry.material; target.maxTempC = entry.maxTempC; target.label = entry.name;
      }
      renderInspector(); renderSidebar(); renderContentIfResults();
      return;
    }
    if (e.target.dataset.bool) target[f] = e.target.checked;
    else target[f] = e.target.value;
    if (f === 'mode') renderInspector();
    if (f === 'motorType') {
      const t = M.MOTOR_TYPES[e.target.value];
      if (t && e.target.value !== 'custom') { target.subtransientReactancePU = t.xdpp; target.powerFactor = t.pf; target.efficiency = t.eff; }
      renderInspector();
    }
    if (f === 'genType') {
      const t = M.GENERATOR_TYPES[e.target.value];
      if (t) { target.genXdpp = t.xdpp; target.genXdp = t.xdp; }
      renderInspector();
    }
    renderSidebar(); renderContentIfResults();
  });
  $('inspector').addEventListener('click', (e) => {
    const add = e.target.closest('.insp-add-btn');
    if (add) { doAdd(add.dataset.busid, add.dataset.add); return; }
    if (e.target.closest('.btn-delete')) deleteSel(state.selection);
  });

  $('view-schematic').addEventListener('click', () => { state.pane = 'schematic'; setMobilePane('content'); updateToolbar(); renderContent(); });
  $('view-results').addEventListener('click', () => { state.pane = 'results'; setMobilePane('content'); updateToolbar(); renderContent(); });
  $('mobile-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMobilePane(b.dataset.mpane); });
  $('btn-inspector').addEventListener('click', () => { state.inspectorShown = !state.inspectorShown; updateToolbar(); });
  $('btn-open').addEventListener('click', () => $('file-open').click());
  $('file-open').addEventListener('change', (e) => { doOpenFile(e.target.files[0]); e.target.value = ''; });
  $('btn-save').addEventListener('click', doSave);
  $('btn-print').addEventListener('click', doPrint);
  $('btn-about').addEventListener('click', () => { $('about-modal').hidden = false; });
  $('about-close').addEventListener('click', () => { $('about-modal').hidden = true; });
  $('about-modal').addEventListener('click', (e) => { if (e.target === $('about-modal')) $('about-modal').hidden = true; });
  $('btn-add').addEventListener('click', (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 4, addMenuItems(M.targetBusId(doc(), state.selection)));
  });

  $('floating-menu').addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    const it = menuItems[Number(item.dataset.idx)];
    hideMenu();
    if (it && it.onClick) it.onClick();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#floating-menu') && !e.target.closest('#btn-add')) hideMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideMenu(); return; }
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
      const s = state.selection;
      if (s && (s.kind === 'element' || s.kind === 'motor' || s.kind === 'capacitor' || s.kind === 'breaker')) { e.preventDefault(); deleteSel(s); }
    }
  });
}

// ── First-visit disclaimer ─────────────────────────────────────────────
const DISCLAIMER_KEY = 'scme.disclaimerAck.v1';
function initDisclaimer() {
  const modal = $('disclaimer-modal');
  let acked = false;
  try { acked = localStorage.getItem(DISCLAIMER_KEY) === '1'; } catch { acked = false; }
  if (!acked) modal.hidden = false;
  $('disclaimer-ack').addEventListener('click', () => {
    try { localStorage.setItem(DISCLAIMER_KEY, '1'); } catch { /* ignore */ }
    modal.hidden = true;
  });
}

// ── Init ───────────────────────────────────────────────────────────────
// Seed with a cable so the results aren't empty on first load.
doAdd(doc().sourceBus.id, 'cable');
state.selection = { kind: 'source' };
state.mobilePane = 'content'; // start on the results/schematic pane on phones
initDisclaimer();
wire();
renderSidebar();
renderInspector();
renderContent();
updateToolbar();
