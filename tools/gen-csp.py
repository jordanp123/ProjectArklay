#!/usr/bin/env python3
"""Regenerate the Content-Security-Policy and Subresource-Integrity hashes.

SCMEWeb is served with a strict CSP (set as a header by nginx.conf, behind a
Cloudflare Tunnel) so a tampered file is refused by the browser instead of run.
The policy pins:

  * every INLINE <script> in index.html, by SHA-256, in the `script-src`
    directive of nginx.conf (an edited inline script no longer matches and is
    blocked); and
  * the linked subresources it can verify cross-browser — css/styles.css and
    the js/app.js module entry — with SHA-384 `integrity` (SRI) attributes.

Run this after editing the inline script, css/styles.css, or js/app.js, then
rebuild the image and redeploy. It rewrites the `script-src` hash in nginx.conf
and the integrity="" attributes in index.html, in place. Stdlib only.

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

# Subresources protected with SRI (the entry points the browser verifies
# cross-browser; app.js's imported modules are same-origin and covered by
# `script-src 'self'`).
SRI_TARGETS = ["css/styles.css", "js/app.js"]


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


def main() -> int:
    check = "--check" in sys.argv[1:]

    html = INDEX.read_text()
    conf = NGINX.read_text()

    script_hashes = inline_script_hashes(html)

    new_html = html
    sri = {}
    for target in SRI_TARGETS:
        value = sha384_sri((ROOT / target).read_bytes())
        sri[target] = value
        new_html = set_integrity(new_html, target, value)

    new_conf = set_script_src_hashes(conf, script_hashes)

    changed = (new_html != html) or (new_conf != conf)

    if check:
        if changed:
            print("gen-csp: OUT OF DATE — run `python3 tools/gen-csp.py`, rebuild, redeploy.")
            return 1
        print("gen-csp: index.html and nginx.conf are up to date.")
        return 0

    INDEX.write_text(new_html)
    NGINX.write_text(new_conf)

    print("Inline <script> hashes (nginx.conf script-src):")
    for h in script_hashes:
        print(f"  {h}")
    print("Subresource integrity (index.html):")
    for target, value in sri.items():
        print(f"  {target}: {value}")
    print(f"\nPatched {INDEX.relative_to(ROOT)} and {NGINX.relative_to(ROOT)}"
          f" ({'updated' if changed else 'no change'}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
