#!/usr/bin/env python3
"""
Build the two local test pages, one per host the app runs on.

  build/local.html     the standalone page, exactly as GitHub Pages serves it.
                       No window.claude, so storage falls back to this browser
                       (or Google Drive once a client ID is set).
  build/local-db.html  the artifact shape: window.claude.use("db") returns a
                       fake store backed by localStorage, so the chunked saving
                       and reload-from-store paths can be exercised offline.

    python3 build/make-index.py && python3 build/make-test-pages.py
    python3 -m http.server 8899   # http, not file:// — Chromium restricts
                                  # localStorage on file origins
"""
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)

index_path = os.path.join(root, 'index.html')
if not os.path.exists(index_path):
    raise SystemExit("index.html missing — run build/make-index.py first")
index = open(index_path).read()
body = open(os.path.join(root, 'ledger-to-return.html')).read()

# standalone: byte-for-byte what Pages serves
open(os.path.join(here, 'local.html'), 'w').write(index)
print('wrote build/local.html')

DB_STUB = """<script>
const _S=k=>{try{return JSON.parse(localStorage.getItem('FAKEDB:'+k))}catch(e){return null}};
const _W=(k,v)=>localStorage.setItem('FAKEDB:'+k,JSON.stringify(v));
window.__dbcalls=0;
const fakeDb={doc:(p)=>({
  get:async()=>{const d=_S(p);return{exists:!!d,data:()=>d}},
  set:async(v)=>{window.__dbcalls++;_W(p,v)},
  delete:async()=>localStorage.removeItem('FAKEDB:'+p)
})};
window.claude={use:async(n)=>n==='db'?fakeDb:null};
</script>"""

open(os.path.join(here, 'local-db.html'), 'w').write(
    '<!doctype html><html><head><meta charset="utf-8">' + DB_STUB + '</head><body>' + body + '</body></html>')
print('wrote build/local-db.html')

# The vendored PDF reader lives beside index.html, so a page served out of
# build/ needs it reachable at the same relative path.
vendor = os.path.join(root, 'vendor')
link = os.path.join(here, 'vendor')
if os.path.isdir(vendor) and not os.path.exists(link):
    os.symlink(os.path.relpath(vendor, here), link)
    print('linked build/vendor -> ../vendor')
