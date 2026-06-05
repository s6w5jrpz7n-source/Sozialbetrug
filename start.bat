@echo off
REM ============================================================
REM  Sozialbetrug / Staat-Stratege - Lokaler Start (Windows)
REM  Startet einen kleinen lokalen Webserver und oeffnet das
REM  Spiel im Browser. Alles laeuft offline auf diesem PC.
REM  Zum Beenden: dieses Fenster schliessen.
REM ============================================================
cd /d "%~dp0"

echo Starte lokalen Server auf http://localhost:8000 ...
echo (Zum Beenden dieses Fenster schliessen)

REM Browser nach kurzer Wartezeit oeffnen
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"

REM Python-Webserver starten (py oder python)
py -m http.server 8000 2>nul
if errorlevel 1 python -m http.server 8000
