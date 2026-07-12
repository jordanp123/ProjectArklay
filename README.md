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
├── tools/gen-csp.py         Regenerates the Content-Security-Policy + SRI hashes
├── nginx.conf               Static server + security headers (the deployed CSP)
├── Dockerfile               nginx-unprivileged image; COPYs the static assets in
├── docker-compose.yaml      nginx + a Cloudflare Tunnel sidecar
└── tests/                    Unit tests (plain assertions, no framework)
```

## Run it

Because it uses ES modules, serve it over HTTP (not `file://`):

```sh
python3 -m http.server 8000      # or any static server
# then visit http://localhost:8000/
```

Or deploy the folder to any static host (GitHub Pages, etc.).

## Security headers

The site is served by nginx (`nginx.conf`) behind a Cloudflare Tunnel, under a
strict **Content-Security-Policy** so a tampered file is refused by the browser
instead of run. The policy:

- allows scripts and styles only from the site's own origin (`script-src 'self'`,
  `style-src 'self'`), with **no** `'unsafe-inline'`, and `default-src 'none'`
  for everything else (`object-src`, `frame-ancestors`, `base-uri`,
  `form-action`, … all locked down);
- pins the one inline `<script>` (the pre-paint theme setter) by its **SHA-256**
  hash, so an edited inline script no longer matches and is blocked;
- verifies `css/styles.css` and the `js/app.js` module entry with
  **Subresource-Integrity** (`integrity="sha384-…"`); a changed file fails the
  hash and won't load. app.js's imported modules are same-origin, covered by
  `script-src 'self'`.

`nginx.conf` also sends `X-Content-Type-Options`, `Referrer-Policy`,
`Cross-Origin-Opener-Policy`, and HSTS, and restricts methods to GET/HEAD; the
Cloudflare Tunnel forwards these origin headers straight to the browser.

Regenerate the hashes after changing the inline script, `css/styles.css`, or
`js/app.js`, then rebuild the image and redeploy:

```sh
python3 tools/gen-csp.py            # patches the script-src hash in nginx.conf
                                    #   and the integrity="" attributes in index.html
python3 tools/gen-csp.py --check    # pre-deploy check: non-zero exit if out of date
```

The browser hashes the exact bytes it receives. nginx **gzip is fine** (SRI
hashes the decompressed payload), but any edge feature that **rewrites** assets —
Cloudflare Rocket Loader, Auto-Minify, Email Obfuscation — must be **off**, or
the hashes won't match and the page is blocked.

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
