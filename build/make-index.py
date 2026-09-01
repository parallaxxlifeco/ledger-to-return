#!/usr/bin/env python3
"""
Build index.html — the standalone page GitHub Pages serves — from the shared
body in ledger-to-return.html.

One source, two hosts. Published as a Claude artifact, the host wraps the body in
its own document skeleton, so the source deliberately carries no doctype, <html>,
<head> or <body>. Served anywhere else that wrapper has to exist, and Google
Identity Services has to be loaded for Drive saving. This adds both.

    python3 build/make-index.py

The app decides which storage to use at runtime: the db capability when it finds
itself inside a Claude artifact, Google Drive when connected, this browser
otherwise. Nothing here is host-specific beyond the wrapper.
"""
import os, re

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
body = open(os.path.join(root, 'ledger-to-return.html')).read()

title = (re.search(r'<title>(.*?)</title>', body) or [None, 'Ledger to Return'])[1]

HEAD = f"""<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Mixed-currency bank statements into AUD, coded once for the tracking sheets and the tax return.">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
  html{{color-scheme:light dark}}
  body{{margin:0;font:14px/1.45 system-ui,sans-serif;background:#F4F6F7}}
  img{{max-width:100%}}
  [hidden]{{display:none!important}}
</style>
</head>
<body>
"""

out = HEAD + body + "\n</body>\n</html>\n"
path = os.path.join(root, 'index.html')
with open(path, 'w') as f:
    f.write(out)
print(f"wrote index.html ({len(out):,} bytes) — title: {title}")
