# Ersten Android-Build erstellen (Capacitor)

Voraussetzungen erledigt: ✅ Play-Developer-Konto, ✅ Android Studio.
Fehlt nur noch **Node.js** (LTS, von https://nodejs.org) auf deinem Rechner.

Die Projektdateien sind schon vorbereitet:
`package.json`, `capacitor.config.json`, `tools/build-www.mjs`.

---

## Schritt für Schritt (im Projektordner, Terminal)

```bash
# 1) Capacitor + Abhängigkeiten installieren
npm install

# 2) Web-Ordner "www/" bauen (kopiert nur die Spiel-Dateien)
npm run build:www

# 3) Android-Plattform einmalig hinzufügen (erzeugt den Ordner android/)
npx cap add android

# 4) Web-Dateien + Plugins in das Android-Projekt synchronisieren
npx cap sync

# 4b) App-Icon + Splash aus resources/ generieren (alle Größen/Adaptive-Icons)
npx @capacitor/assets generate --assetPath resources --android

# 5) In Android Studio öffnen
npx cap open android
```

**Hochformat erzwingen:** In `android/app/src/main/AndroidManifest.xml` in der
`<activity ...>` `android:screenOrientation="portrait"` ergänzen (Querformat aus).

In **Android Studio** dann:
- Oben ein Gerät wählen (ein angeschlossenes Handy mit USB-Debugging **oder** einen Emulator über den *Device Manager* anlegen).
- Auf den grünen **▶ Run**-Knopf drücken → die App wird gebaut und gestartet.

🎉 Damit läuft das Spiel als echte Android-App.

---

## Nach jeder Spiel-Änderung (Update)

```bash
npm run sync      # = build:www + cap sync
```
…dann in Android Studio erneut ▶ Run.

---

## Wichtige Hinweise

- **App-ID** in `capacitor.config.json` ist aktuell `com.sozialbetrug.game`.
  Sie ist **dauerhaft** (später nicht änderbar). Wenn du eine andere willst
  (z. B. mit deiner Domain), **jetzt** ändern – vor dem ersten Upload.
- **Internet beim ersten Test:** Die App lädt Phaser noch vom CDN. Auf dem
  Emulator/Handy mit WLAN funktioniert das. **Für die finale, offline-fähige
  Version** bündeln wir Phaser lokal (mache ich, wenn du so weit bist):
  `phaser.min.js` herunterladen, in `vendor/` legen, in `index.html` statt der
  CDN-URL `vendor/phaser.min.js` eintragen.
- **Bedienung:** Aktuell noch Desktop-/Querformat-Layout. Touch-Buttons
  (Interagieren / Woche) und Hochformat-HUD kommen als nächster Schritt –
  dann ist die App richtig fingertauglich.

---

## Reihenfolge bis zur Veröffentlichung (Erinnerung, Details in PLAYSTORE.md)

1. ✅ Konto + Android Studio
2. **▶ Erster Build aufs Gerät** (diese Anleitung) – Pipeline testen
3. Touch-Bedienung + Hochformat (Code)
4. Phaser offline bündeln + App-Icon/Splash
5. Signiertes `.aab` bauen
6. Play Console: Listing, Datenschutz, Content-Rating
7. Internes Testing → Production
