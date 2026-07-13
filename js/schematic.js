// One-line schematic — a clickable SVG diagram of the circuit tree, rendered
// in the Schematic pane: the source at top, buses as horizontal rails,
// elements as symbols on the drops between them, and motors / capacitors /
// breakers hanging off each bus. Every symbol carries the same
// data-selkind/-id attributes the sidebar rows use, so a click selects it and
// the inspector follows.
//
// Pure over (doc, selection, nominalVoltages); no DOM access. Returns an SVG
// string that app.js drops into the pane and wires a single click handler on.

const ROW = 120;          // vertical gap between bus depths
const DEV_SLOT = 60;      // horizontal slot for a motor / cap / breaker drop
const MIN_BUS = 156;      // minimum bus subtree width (room for the label)
const RAIL_HALF = 48;     // minimum bus-rail half-width
const MARGIN_X = 54;
const MARGIN_TOP = 78;    // room for the source symbol above the source bus
const MARGIN_BOTTOM = 64;
const DROP = 30;          // device drop length below a rail

// Colors are read from the live CSS custom properties so the diagram tracks the
// active light/dark theme. `panelFill` is the pane background, used to "cut out"
// symbol interiors where a drop line passes behind them.
function themeColors() {
  const cs = (typeof getComputedStyle === 'function' && typeof document !== 'undefined')
    ? getComputedStyle(document.documentElement) : null;
  const v = (name, fallback) => {
    const raw = cs && cs.getPropertyValue(name).trim();
    return raw || fallback;
  };
  return {
    source: v('--tint-source', '#d97706'),
    bus: v('--tint-bus', '#2563eb'),
    element: v('--tint-element', '#ea580c'),
    motor: v('--tint-motor', '#7c3aed'),
    capacitor: v('--tint-capacitor', '#0d9488'),
    breaker: v('--tint-breaker', '#16a34a'),
    line: v('--schem-line', '#94a3b8'),
    ink: v('--ink', '#1f2937'),
    muted: v('--muted', '#6b7280'),
    sel: v('--accent', '#2563eb'),
    selBg: v('--accent-soft', '#dbeafe'),
    open: v('--red', '#dc2626'),
    panelFill: v('--panel', '#ffffff'),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const key = (k, o = {}) => [k, o.busId || '', o.childBusId || '', o.motorId || '', o.capId || '', o.brkId || ''].join('|');
const r0 = (v) => Math.round(Number(v) || 0);
function voltageLabel(v) {
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v >= 1000) { const kv = v / 1000; return (kv === Math.round(kv) ? String(kv) : kv.toFixed(2)) + ' kV'; }
  return Math.round(v) + ' V';
}

// ── Layout ─────────────────────────────────────────────────────────────
function measureWidth(bus) {
  let w = 0;
  for (const br of bus.children) {
    if (br.element.kind === 'transformer3') {
      w += measureWidth(br.bus) + (br.tertiaryBus ? measureWidth(br.tertiaryBus) : 0);
    } else {
      w += measureWidth(br.bus);
    }
  }
  w += (bus.motors || []).length * DEV_SLOT;
  w += (bus.capacitors || []).length * DEV_SLOT;
  w += (bus.breakers || []).length * DEV_SLOT;
  return Math.max(w, MIN_BUS);
}

/** Fill `pos` (busId → {x,y,depth,bus,drops}). Returns the bus's center x. */
function assign(bus, left, depth, pos, maxDepthRef) {
  if (depth > maxDepthRef.v) maxDepthRef.v = depth;
  const drops = [];
  let cursor = left;
  for (const br of bus.children) {
    if (br.element.kind === 'transformer3') {
      const wSec = measureWidth(br.bus);
      const secX = assign(br.bus, cursor, depth + 1, pos, maxDepthRef);
      let terX = null;
      if (br.tertiaryBus) terX = assign(br.tertiaryBus, cursor + wSec, depth + 1, pos, maxDepthRef);
      const elemX = terX != null ? (secX + terX) / 2 : secX;
      drops.push({ kind: 'elem3', element: br.element, elemX, secX, terX, childBusId: br.bus.id });
      cursor += wSec + (br.tertiaryBus ? measureWidth(br.tertiaryBus) : 0);
    } else {
      const w = measureWidth(br.bus);
      const cx = assign(br.bus, cursor, depth + 1, pos, maxDepthRef);
      drops.push({ kind: 'elem', element: br.element, x: cx, childBusId: br.bus.id, childBus: br.bus });
      cursor += w;
    }
  }
  for (const m of bus.motors || []) { drops.push({ kind: 'motor', x: cursor + DEV_SLOT / 2, motor: m, busId: bus.id }); cursor += DEV_SLOT; }
  for (const c of bus.capacitors || []) { drops.push({ kind: 'cap', x: cursor + DEV_SLOT / 2, cap: c, busId: bus.id }); cursor += DEV_SLOT; }
  for (const b of bus.breakers || []) { drops.push({ kind: 'breaker', x: cursor + DEV_SLOT / 2, brk: b, busId: bus.id }); cursor += DEV_SLOT; }

  const xs = [];
  for (const d of drops) {
    if (d.kind === 'elem3') { xs.push(d.elemX); }
    else xs.push(d.x);
  }
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : left + Math.max(measureWidth(bus), MIN_BUS) / 2;
  pos.set(bus.id, { x: cx, y: MARGIN_TOP + depth * ROW, depth, bus, drops });
  return cx;
}

// ── Symbols ────────────────────────────────────────────────────────────
// Ids are session-generated (uid), but escape anyway — attribute context.
const hit = (k, o, inner) => `<g class="sch-hit" data-selkind="${esc(k)}"${o.busId ? ` data-busid="${esc(o.busId)}"` : ''}${o.childBusId ? ` data-childbusid="${esc(o.childBusId)}"` : ''}${o.motorId ? ` data-motorid="${esc(o.motorId)}"` : ''}${o.capId ? ` data-capid="${esc(o.capId)}"` : ''}${o.brkId ? ` data-brkid="${esc(o.brkId)}"` : ''}>${inner}</g>`;
const chip = (x, y, text, color) => text ? `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" fill="${color}">${esc(text)}</text>` : '';

// An element caption placed to the right of its symbol: the label (bold) on top
// and the spec (muted) below, or just the spec when unnamed. Left-anchored so a
// long name grows rightward, away from the symbol.
const caption = (x, midY, name, spec, ink, muted) => {
  const nm = (name || '').trim();
  return nm
    ? `<text x="${x}" y="${midY - 2}" font-size="10" font-weight="600" fill="${ink}">${esc(nm)}</text>`
      + `<text x="${x}" y="${midY + 10}" font-size="10" fill="${muted}">${esc(spec)}</text>`
    : `<text x="${x}" y="${midY + 3}" font-size="10" fill="${muted}">${esc(spec)}</text>`;
};

function transformerSymbol(x, y, color) { // two interlocking coils
  return `<circle cx="${x}" cy="${y - 7}" r="9" fill="none" stroke="${color}" stroke-width="2"/>` +
    `<circle cx="${x}" cy="${y + 7}" r="9" fill="none" stroke="${color}" stroke-width="2"/>`;
}
function threeWindingSymbol(x, y, color) { // three interlocking coils (H top, X/Y bottom)
  return `<circle cx="${x}" cy="${y - 8}" r="8.5" fill="none" stroke="${color}" stroke-width="2"/>` +
    `<circle cx="${x - 7}" cy="${y + 6}" r="8.5" fill="none" stroke="${color}" stroke-width="2"/>` +
    `<circle cx="${x + 7}" cy="${y + 6}" r="8.5" fill="none" stroke="${color}" stroke-width="2"/>`;
}

// ── Render ─────────────────────────────────────────────────────────────
export function schematicSVG(doc, selection, nominals) {
  const C = themeColors();
  const pos = new Map();
  const maxDepthRef = { v: 0 };
  assign(doc.sourceBus, MARGIN_X, 0, pos, maxDepthRef);

  const width = MARGIN_X * 2 + measureWidth(doc.sourceBus);
  const height = MARGIN_TOP + maxDepthRef.v * ROW + DROP + MARGIN_BOTTOM;
  const selKey = selection ? key(selection.kind, selection) : '';
  const isSel = (k, o) => key(k, o) === selKey;

  const rails = [];
  const symbols = [];
  const labels = [];

  // Source symbol above the source bus.
  const src = pos.get(doc.sourceBus.id);
  const srcY = MARGIN_TOP - 46;
  const srcSel = isSel('source', {});
  symbols.push(`<line x1="${src.x}" y1="${srcY + 16}" x2="${src.x}" y2="${src.y}" stroke="${C.line}" stroke-width="2"/>`);
  symbols.push(hit('source', {}, `<circle cx="${src.x}" cy="${srcY}" r="16" fill="${srcSel ? C.selBg : C.panelFill}" stroke="${C.source}" stroke-width="${srcSel ? 3 : 2}"/>` +
    `<text x="${src.x}" y="${srcY + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.source}">${doc.source.mode === 'generator' ? 'G' : '∿'}</text>`));
  labels.push(chip(src.x, srcY - 22, doc.source.mode === 'generator' ? 'Generator' : 'Utility', C.muted));

  for (const { x, y, bus, drops } of pos.values()) {
    // Rail extent spans the bus center and every drop.
    const xs = [x - RAIL_HALF, x + RAIL_HALF];
    for (const d of drops) xs.push(d.kind === 'elem3' ? d.elemX : d.x);
    const railLeft = Math.min(...xs);
    const railRight = Math.max(...xs);
    const busSel = isSel('bus', { busId: bus.id });
    rails.push(hit('bus', { busId: bus.id },
      `<line x1="${railLeft}" y1="${y}" x2="${railRight}" y2="${y}" stroke="${busSel ? C.sel : C.bus}" stroke-width="${busSel ? 6 : 4}" stroke-linecap="round"/>`));
    const isRoot = bus.id === doc.sourceBus.id;
    const vlabel = voltageLabel(nominals.get(bus.id));
    // Name + voltage as one left-anchored label above the rail (no collision on short rails).
    labels.push(`<text x="${railLeft}" y="${y - 9}" font-size="11" font-weight="600" fill="${C.ink}">${esc(bus.label)}${isRoot ? ' (source)' : ''}${vlabel ? ` <tspan font-weight="400" fill="${C.muted}">· ${esc(vlabel)}</tspan>` : ''}</text>`);

    for (const d of drops) {
      if (d.kind === 'elem' || d.kind === 'elem3') {
        const el = d.element;
        const elemColor = C.element;
        const sel = isSel('element', { childBusId: d.childBusId });
        const sw = sel ? 3 : 2;
        if (d.kind === 'elem3') {
          const midY = y + ROW / 2;
          const childY = y + ROW;
          const splitY = midY + 14;
          // Parent bus rail → transformer symbol.
          rails.push(`<line x1="${d.elemX}" y1="${y}" x2="${d.elemX}" y2="${midY - 14}" stroke="${C.line}" stroke-width="2"/>`);
          // Horizontal split bar under the symbol, tying both winding drops to it.
          const splitXs = [d.secX, d.elemX];
          if (d.terX != null) splitXs.push(d.terX);
          rails.push(`<line x1="${Math.min(...splitXs)}" y1="${splitY}" x2="${Math.max(...splitXs)}" y2="${splitY}" stroke="${C.line}" stroke-width="2"/>`);
          // Vertical drops to the secondary and tertiary winding buses.
          rails.push(`<line x1="${d.secX}" y1="${splitY}" x2="${d.secX}" y2="${childY}" stroke="${C.line}" stroke-width="2"/>`);
          if (d.terX != null) rails.push(`<line x1="${d.terX}" y1="${splitY}" x2="${d.terX}" y2="${childY}" stroke="${C.line}" stroke-width="2"/>`);
          symbols.push(hit('element', { childBusId: d.childBusId },
            threeWindingSymbol(d.elemX, midY, sel ? C.sel : elemColor).replace(/stroke-width="2"/g, `stroke-width="${sw}"`)));
          labels.push(caption(d.elemX + 20, midY, el.label, `${r0(el.ratedKVA)} kVA · 3W`, C.ink, C.muted));
        } else {
          const midY = y + ROW / 2;
          const childY = y + ROW;
          rails.push(`<line x1="${d.x}" y1="${y}" x2="${d.x}" y2="${childY}" stroke="${C.line}" stroke-width="2"/>`);
          if (el.kind === 'transformer') {
            symbols.push(hit('element', { childBusId: d.childBusId },
              `<rect x="${d.x - 13}" y="${midY - 17}" width="26" height="34" fill="#fff" opacity="0.01"/>` +
              transformerSymbol(d.x, midY, sel ? C.sel : elemColor).replace(/stroke-width="2"/g, `stroke-width="${sw}"`)));
            labels.push(caption(d.x + 18, midY, el.label, `${r0(el.kva)} kVA`, C.ink, C.muted));
          } else {
            // Cable: a small orange node on the drop, with its label + length to
            // the right (left-anchored so a long name grows away from the symbol).
            symbols.push(hit('element', { childBusId: d.childBusId },
              `<rect x="${d.x - 10}" y="${midY - 10}" width="20" height="20" rx="4" fill="${sel ? C.selBg : C.panelFill}" stroke="${sel ? C.sel : elemColor}" stroke-width="${sw}"/>`));
            labels.push(caption(d.x + 16, midY, el.label, `${r0(el.lengthFeet)} ft`, C.ink, C.muted));
          }
        }
      } else if (d.kind === 'motor') {
        const sel = isSel('motor', { busId: d.busId, motorId: d.motor.id });
        const cy = y + DROP + 12;
        symbols.push(`<line x1="${d.x}" y1="${y}" x2="${d.x}" y2="${cy - 12}" stroke="${C.line}" stroke-width="2"/>`);
        symbols.push(hit('motor', { busId: d.busId, motorId: d.motor.id },
          `<circle cx="${d.x}" cy="${cy}" r="12" fill="${sel ? C.selBg : C.panelFill}" stroke="${sel ? C.sel : C.motor}" stroke-width="${sel ? 3 : 2}"/>` +
          `<text x="${d.x}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.motor}">M</text>`));
        // Motor label (bold) over its HP, centered below the circle. Capacitors
        // and breakers stay spec-only.
        const mname = (d.motor.label || '').trim();
        if (mname) {
          labels.push(`<text x="${d.x}" y="${cy + 26}" text-anchor="middle" font-size="10" font-weight="600" fill="${C.ink}">${esc(mname)}</text>`);
          labels.push(`<text x="${d.x}" y="${cy + 38}" text-anchor="middle" font-size="10" fill="${C.muted}">${r0(d.motor.ratedHP)} HP</text>`);
        } else {
          labels.push(chip(d.x, cy + 26, `${r0(d.motor.ratedHP)} HP`, C.muted));
        }
      } else if (d.kind === 'cap') {
        const sel = isSel('capacitor', { busId: d.busId, capId: d.cap.id });
        const cy = y + DROP + 6;
        symbols.push(`<line x1="${d.x}" y1="${y}" x2="${d.x}" y2="${cy - 6}" stroke="${C.line}" stroke-width="2"/>`);
        symbols.push(hit('capacitor', { busId: d.busId, capId: d.cap.id },
          `<rect x="${d.x - 12}" y="${cy - 10}" width="24" height="20" fill="${sel ? C.selBg : C.panelFill}" opacity="${sel ? 1 : 0.01}"/>` +
          `<line x1="${d.x - 11}" y1="${cy - 3}" x2="${d.x + 11}" y2="${cy - 3}" stroke="${sel ? C.sel : C.capacitor}" stroke-width="${sel ? 3 : 2.5}"/>` +
          `<line x1="${d.x - 11}" y1="${cy + 3}" x2="${d.x + 11}" y2="${cy + 3}" stroke="${sel ? C.sel : C.capacitor}" stroke-width="${sel ? 3 : 2.5}"/>`));
        labels.push(chip(d.x, cy + 24, `${r0(d.cap.ratedKVAR)} kVAR`, C.muted));
      } else if (d.kind === 'breaker') {
        const sel = isSel('breaker', { busId: d.busId, brkId: d.brk.id });
        const open = !!d.brk.isOpen;
        const col = sel ? C.sel : (open ? C.open : C.breaker);
        const cy = y + DROP + 4;
        symbols.push(`<line x1="${d.x}" y1="${y}" x2="${d.x}" y2="${cy - 9}" stroke="${C.line}" stroke-width="2"/>`);
        symbols.push(hit('breaker', { busId: d.busId, brkId: d.brk.id },
          `<rect x="${d.x - 9}" y="${cy - 9}" width="18" height="18" rx="3" fill="${sel ? C.selBg : C.panelFill}" stroke="${col}" stroke-width="${sel || open ? 3 : 2}"/>` +
          (open ? `<line x1="${d.x - 6}" y1="${cy + 6}" x2="${d.x + 6}" y2="${cy - 6}" stroke="${C.open}" stroke-width="2"/>` : '')));
        labels.push(chip(d.x, cy + 24, `${r0(d.brk.trip)} A${open ? ' · open' : ''}`, open ? C.open : C.muted));
      }
    }
  }

  return `<svg viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}" xmlns="http://www.w3.org/2000/svg" class="schematic-svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    ${rails.join('')}
    ${symbols.join('')}
    ${labels.join('')}
  </svg>`;
}
