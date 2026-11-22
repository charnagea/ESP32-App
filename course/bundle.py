#!/usr/bin/env python3
"""Bundle the course into one self-contained index.html (no network needed).

Inlines style.css, the content files (in name order), the three firmware files
from ../firmware as window.FIRMWARE, and app.js. Writes dist/index.html and
copies it into the Android app's assets.
"""
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
SRC = ROOT / "src"
FW = REPO / "firmware"

css = (SRC / "style.css").read_text(encoding="utf-8")
content = "\n".join(p.read_text(encoding="utf-8") for p in sorted(SRC.glob("content_*.js")))
app = (SRC / "app.js").read_text(encoding="utf-8")

node_proto = (FW / "SmartPost_Node" / "SmartPostProtocol.h").read_text(encoding="utf-8")
hub_proto = (FW / "SmartPost_Hub" / "SmartPostProtocol.h").read_text(encoding="utf-8")
if node_proto != hub_proto:
    sys.exit("SmartPostProtocol.h differs between the two sketch folders")
firmware = {
    "node": (FW / "SmartPost_Node" / "SmartPost_Node.ino").read_text(encoding="utf-8"),
    "hub": (FW / "SmartPost_Hub" / "SmartPost_Hub.ino").read_text(encoding="utf-8"),
    "protocol": node_proto,
}
fw_js = "window.FIRMWARE = " + json.dumps(firmware).replace("</", "<\\/") + ";"

for name, text in (("content", content), ("app", app)):
    if "</script" in text.lower():
        sys.exit(f"{name} contains </script>")

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f1512">
<title>Smart Post Academy</title>
<style>
{css}
</style>
</head>
<body>
<div id="app"></div>
<script>
{content}
</script>
<script>
{fw_js}
</script>
<script>
{app}
</script>
</body>
</html>
"""

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
out = dist / "index.html"
out.write_text(html, encoding="utf-8")
assets = REPO / "android" / "app" / "src" / "main" / "assets"
assets.mkdir(parents=True, exist_ok=True)
shutil.copyfile(out, assets / "index.html")
print(f"wrote {out} ({len(html) // 1024} KB) and copied it to the Android assets")
