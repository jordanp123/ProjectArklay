#!/usr/bin/env python3
"""Regenerate the Content-Security-Policy, Subresource-Integrity hashes, and
the service worker's offline precache manifest.

SCMEWeb is served with a strict CSP (set as a header by nginx.conf, behind a
Cloudflare Tunnel) so a tampered file is refused by the browser instead of run.
The policy pins:

  * every INLINE <script> in index.html, by SHA-256, in the `script-src`
    directive of nginx.conf (an edited inline script no longer matches and is
    blocked); and
  * the linked subresources it can verify cross-browser — css/styles.css and
    the js/app.js module entry — with SHA-384 `integrity` (SRI) attributes.

It also regenerates the `CACHE_VERSION` + `PRECACHE` block in sw.js from the
actual asset bytes, so any changed file bumps the offline cache version and
every user's service worker offers the update. Because the version is derived
from the same bytes the SRI pins cover, the precached set is always internally
consistent (a stale index.html can't be paired with a fresh app.js).

Run this after editing any asset, then rebuild the image and redeploy. It
rewrites nginx.conf, index.html, and sw.js in place. Stdlib only.

    python3 tools/gen-csp.py          # patch files
    python3 tools/gen-csp.py --check  # verify they are up to date (pre-deploy)

NOTE: the browser hashes the bytes it receives. gzip is fine (SRI hashes the
decompressed bytes), but any host feature that REWRITES assets — Cloudflare
Rocket Loader, Auto-Minify, Email Obfuscation — must be OFF, or the hashes
won't match and the app is blocked. See README "Security headers".
"""
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
NGINX = ROOT / "nginx.conf"
SW = ROOT / "sw.js"

# Subresources protected with SRI (the entry points the browser verifies
# cross-browser; app.js's imported modules are same-origin and covered by
# `script-src 'self'`).
SRI_TARGETS = ["css/styles.css", "js/app.js"]

# Everything the service worker precaches for offline use. Globs (relative to
# the repo root) are expanded against the real files, so adding e.g. a new
# engine module auto-includes it — no hand-maintained list to drift. Keep this
# in step with what index.html actually loads.
PRECACHE_GLOBS = [
    "index.html",
    "manifest.json",
    "favicon.svg",
    "css/*.css",
    "js/**/*.js",
    "icons/*.png",
]


def b64(digest: bytes) -> str:
    return base64.b64encode(digest).decode("ascii")


def sha256_src(data: bytes) -> str:
    return "sha256-" + b64(hashlib.sha256(data).digest())


def sha384_sri(data: bytes) -> str:
    return "sha384-" + b64(hashlib.sha384(data).digest())


def inline_script_hashes(html: str) -> list[str]:
    """SHA-256 of each inline <script> (those without a src= attribute)."""
    hashes = []
    for tag in re.finditer(r"<script\b([^>]*)>(.*?)</script>", html, re.S):
        if re.search(r"\bsrc\s*=", tag.group(1)):
            continue  # external module script — covered by script-src 'self'
        hashes.append(sha256_src(tag.group(2).encode("utf-8")))
    return hashes


def set_integrity(html: str, target: str, value: str) -> str:
    """Add/replace integrity="…" on the tag that loads `target` in index.html."""
    pat = re.compile(r"<(?:link|script)\b[^>]*\b(?:href|src)\s*=\s*[\"']"
                     + re.escape(target) + r"[\"'][^>]*>")
    m = pat.search(html)
    if not m:
        raise SystemExit(f"gen-csp: could not find a tag loading {target!r} in index.html")
    inner = re.sub(r"\s+integrity\s*=\s*[\"'][^\"']*[\"']", "", m.group(0))
    inner = inner[:-1].rstrip()               # drop the closing '>'
    self_closing = inner.endswith("/")
    if self_closing:
        inner = inner[:-1].rstrip()           # drop the '/' of a '/>' tag
    patched = f'{inner} integrity="{value}"' + (" />" if self_closing else ">")
    return html[:m.start()] + patched + html[m.end():]


def set_script_src_hashes(conf: str, hashes: list[str]) -> str:
    """Rewrite the `script-src 'self' …` hash list inside nginx.conf's CSP,
    leaving every other directive untouched."""
    sources = "".join(f" '{h}'" for h in hashes)
    pat = re.compile(r"script-src\s+'self'"
                     r"(?:\s+'(?:nonce-[^']*|sha(?:256|384|512)-[^']*)')*")
    if not pat.search(conf):
        raise SystemExit("gen-csp: no \"script-src 'self'\" directive found in nginx.conf")
    return pat.sub(f"script-src 'self'{sources}", conf, count=1)


def precache_assets() -> list[str]:
    """Sorted, de-duplicated POSIX paths of every file the SW precaches."""
    seen = set()
    for pattern in PRECACHE_GLOBS:
        for path in ROOT.glob(pattern):
            if path.is_file():
                seen.add(path.relative_to(ROOT).as_posix())
    return sorted(seen)


def cache_version(assets: list[str], overrides: dict[str, bytes]) -> str:
    """A short digest over every precached file's path + bytes. `overrides`
    supplies in-memory bytes for files this run just rewrote (index.html), so
    the version reflects the patched content rather than the stale copy on disk."""
    h = hashlib.sha256()
    for rel in assets:                       # assets is already sorted → stable
        data = overrides.get(rel)
        if data is None:
            data = (ROOT / rel).read_bytes()
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        h.update(data)
        h.update(b"\0")
    return "scme-" + h.hexdigest()[:12]


SW_BLOCK_RE = re.compile(
    r"/\* @generated by tools/gen-csp\.py.*?\*/.*?/\* @end generated \*/", re.S)


def render_sw_block(version: str, assets: list[str]) -> str:
    # "./" (the start_url / navigation) plus every asset, as a JS array.
    entries = ["./"] + assets
    lines = ",\n".join(f'  {js_str(e)}' for e in entries)
    return ("/* @generated by tools/gen-csp.py — CACHE_VERSION + PRECACHE. Do not edit. */\n"
            f"const CACHE_VERSION = {js_str(version)};\n"
            f"const PRECACHE = [\n{lines},\n];\n"
            "/* @end generated */")


def js_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def set_sw_block(sw: str, block: str) -> str:
    if not SW_BLOCK_RE.search(sw):
        raise SystemExit("gen-csp: no '@generated' precache block found in sw.js")
    return SW_BLOCK_RE.sub(lambda _m: block, sw, count=1)


def main() -> int:
    check = "--check" in sys.argv[1:]

    html = INDEX.read_text()
    conf = NGINX.read_text()
    sw = SW.read_text()

    script_hashes = inline_script_hashes(html)

    new_html = html
    sri = {}
    for target in SRI_TARGETS:
        value = sha384_sri((ROOT / target).read_bytes())
        sri[target] = value
        new_html = set_integrity(new_html, target, value)

    new_conf = set_script_src_hashes(conf, script_hashes)

    # Service-worker precache: version over the PATCHED index.html + the other
    # assets, so a changed byte anywhere bumps CACHE_VERSION.
    assets = precache_assets()
    version = cache_version(assets, {"index.html": new_html.encode("utf-8")})
    new_sw = set_sw_block(sw, render_sw_block(version, assets))

    changed = (new_html != html) or (new_conf != conf) or (new_sw != sw)

    if check:
        if changed:
            print("gen-csp: OUT OF DATE — run `python3 tools/gen-csp.py`, rebuild, redeploy.")
            return 1
        print("gen-csp: index.html, nginx.conf and sw.js are up to date.")
        return 0

    INDEX.write_text(new_html)
    NGINX.write_text(new_conf)
    SW.write_text(new_sw)

    print("Inline <script> hashes (nginx.conf script-src):")
    for h in script_hashes:
        print(f"  {h}")
    print("Subresource integrity (index.html):")
    for target, value in sri.items():
        print(f"  {target}: {value}")
    print(f"Service worker (sw.js): {version}  ({len(assets)} files precached)")
    print(f"\nPatched {INDEX.relative_to(ROOT)}, {NGINX.relative_to(ROOT)} and "
          f"{SW.relative_to(ROOT)} ({'updated' if changed else 'no change'}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
