#!/usr/bin/env python3
"""Erzeugt lib/src/params_2026_data.dart aus assets/params_2026.json.

Aufruf aus dem Package-Wurzelverzeichnis:  python3 tool/embed_params.py
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "params_2026.json")
DST = os.path.join(ROOT, "lib", "src", "params_2026_data.dart")

content = open(SRC, encoding="utf-8").read()
assert "'''" not in content, "JSON darf keine ''' enthalten (raw string)"

with open(DST, "w", encoding="utf-8") as f:
    f.write("/// Eingebettete Kopie von `assets/params_2026.json`.\n")
    f.write("///\n")
    f.write("/// GENERIERT aus der Asset-Datei - nicht von Hand editieren, sondern\n")
    f.write("/// `assets/params_2026.json` aendern und diese Datei neu erzeugen\n")
    f.write("/// (`tool/embed_params.py`). Der Test `params_sync_test.dart` stellt\n")
    f.write("/// sicher, dass beide Fassungen identisch sind.\n")
    f.write("library;\n\n")
    f.write("const String params2026Json = r'''\n")
    f.write(content)
    f.write("''';\n")

print(f"geschrieben: {DST} ({len(content)} Bytes JSON)")
