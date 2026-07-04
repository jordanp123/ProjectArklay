# SCME

**SCME** is a short-circuit (fault-current) training tool for mining and
industrial electrical systems, following IEEE 141 / IEEE C37.010 conventions.
It lets you build a circuit — a source feeding a tree of buses, cables,
transformers, motors, capacitors, and breakers — and watch how the available
fault current, breaker behaviour, and voltages respond as you change it.

> ⚠️ **Training and educational tool. Accuracy is not guaranteed. NOT for
> engineering, safety, operational, or compliance decisions.** Always verify
> every value against another source. Provided as-is, with no warranty.

## Highlights

- **Sources:** available kA, available MVA, infinite bus, or an on-site
  generator (with standard 2-/4-pole turbine and salient-pole types).
- **Circuit tree:** radial or branched, built in a sidebar outline or edited by
  clicking symbols in the one-line diagram.
- **Elements:** cables (with a searchable library of standard mining cables),
  two- and three-winding transformers, motors, PFC capacitors, and breakers
  (open/closed, with downstream de-energization).
- **Results, per bus:**
  - available fault current — first-cycle asymmetric (3φ and L-L), 5-cycle
    interrupting, and minimum SC (hot cable + utility sag + arcing derate);
  - breaker instantaneous-pickup checks;
  - a steady-state load-flow voltage profile and no-load voltage rise;
  - motor-starting voltage dip (singular and combined-running).
- **Consistency guard:** a transformer whose primary voltage doesn't match its
  upstream bus flags the suspect rows and withholds the load-flow results
  rather than showing numbers off an inconsistent model.
- **One-line schematic**, a **printable report** (print → save as PDF), and
  **`.scme`** document save/open with a SHA-512 integrity check.
- **SC-WIN `.sc4` import** (the MFC-archive format), reconstructing the circuit
  from the file's connectivity graph.
- Works on desktop (three-pane layout) and phones (single-pane with a tab bar).

## Design

Zero dependencies, no build step. Plain HTML + CSS + ES-module JavaScript, so it
runs as static files on any web host, or locally with any static server.

```
├── index.html                App shell
├── css/styles.css
├── js/
│   ├── app.js                UI: sidebar, inspector, results, schematic, file I/O
│   ├── model.js              Editable circuit model + engine/load-flow bridge
│   ├── validation.js         Input validation + results gating
│   ├── schematic.js          One-line SVG diagram
│   ├── scmeFile.js           .scme read/write + SHA-512 integrity envelope
│   ├── scwin/                SC-WIN .sc4 binary decoder + importer
│   └── engine/               Fault-current + load-flow engine
│       ├── impedance.js, phasor.js, constants.js
│       ├── source.js, cable.js, transformer.js, threeWindingTransformer.js
│       ├── motor.js, capacitor.js, load.js
│       ├── temperatureCorrection.js, conductorMaterial.js, cableLibrary.js
│       ├── asymmetry.js, arcingFaultFactor.js, faultType.js
│       ├── circuit.js        Tree reduction → per-bus fault current + load flow
│       ├── breakerAnalysis.js
│       └── sha512.js
└── tests/                    Unit tests (plain assertions, no framework)
```

## Run it

Because it uses ES modules, serve it over HTTP (not `file://`):

```sh
python3 -m http.server 8000      # or any static server
# then visit http://localhost:8000/
```

Or deploy the folder to any static host (GitHub Pages, etc.).

## Tests

The engine is pinned to known reference values (handbook and IEEE 141 / C37.010
worked examples — e.g. a 100 HP motor → 114.7 A, the three-winding star network,
the load-flow closed-form, and FIPS SHA-512 vectors), so the calculations can't
silently drift.

```sh
npm test
# or run one file directly with any JS runtime:
node tests/engine.test.js
```

## License

SCME is free/open-source software under the **GNU General Public License**. It
comes with **no warranty** and no guarantee of accuracy. See the `LICENSE` file
for the full terms.
