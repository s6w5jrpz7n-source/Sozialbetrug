#!/bin/bash
# ============================================================
#  Sozialbetrug / Staat-Stratege - Lokaler Start (Mac)
#  Startet einen kleinen lokalen Webserver und oeffnet das
#  Spiel im Browser. Alles laeuft offline auf diesem Mac.
#  Zum Beenden: Strg + C druecken oder Fenster schliessen.
# ============================================================

# In den Ordner wechseln, in dem dieses Skript liegt
cd "$(dirname "$0")"

echo "Starte lokalen Server auf http://localhost:8000 ..."
echo "(Zum Beenden: Strg + C druecken)"

# Browser nach kurzer Wartezeit oeffnen
( sleep 2 && open "http://localhost:8000" ) &

# Python-Webserver starten (ohne Cache, damit Updates sofort sichtbar sind)
python3 tools/serve.py
