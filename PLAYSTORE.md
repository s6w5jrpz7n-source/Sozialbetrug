# Sozialbetrug → Google Play Store: Komplett-Anleitung

Dein Spiel ist eine Web-App (Phaser/HTML/JS). Für den Play Store verpacken wir
sie mit **Capacitor** in eine native Android-Hülle (WebView), die alle Dateien
**offline** mitbringt, und erzeugen ein signiertes **`.aab`** (Android App Bundle).

Reihenfolge: **A) Spiel mobiltauglich → B) Capacitor → C) Build/Signierung →
D) Play Console → E) Testen → Release.** Abschnitt A ist die eigentliche Arbeit.

---

## 0. Voraussetzungen (einmalig)

- [ ] **Node.js** (LTS) installiert — https://nodejs.org
- [ ] **Android Studio** + **JDK 17** installiert — https://developer.android.com/studio
- [ ] **Google Play Developer-Konto** anlegen (einmalig **25 $**) —
      https://play.google.com/console/signup
- [ ] **Datenschutzerklärung** als öffentliche URL (z. B. kostenlos über
      GitHub Pages). Pflicht, auch wenn das Spiel keine Daten sammelt.

---

## A. Spiel mobiltauglich machen  (machen wir gemeinsam im Code)

Ohne diese Anpassungen lässt sich das Spiel am Handy kaum bedienen.

- [ ] **Touch-Bedienung**: Bewegung/Interaktion läuft schon per Tippen
      (Point-and-Click). Es fehlen **On-Screen-Buttons** für die Tastatur-Aktionen:
  - 🤝 **Interagieren** (ersetzt `E`)
  - ⏩ **Woche überspringen** (ersetzt `SPACE`)
  - ☰ **HUD / Menü ein-/ausblenden**
- [ ] **Querformat erzwingen** (Landscape) — am einfachsten für das breite Iso-Layout.
- [ ] **HUD responsiv**: rechtes 230px-Panel als ein-/ausklappbares Overlay.
- [ ] **Tap-Ziele vergrößern** (Modal-Buttons mind. ~44px hoch).
- [ ] **Mobile-Gesten unterdrücken**: kein Doppeltipp-Zoom, kein Text-Markieren,
      kein Lange-Drücken-Menü (CSS `touch-action`, `user-select:none`).
- [ ] **Phaser Scale-Mode** auf `RESIZE`/`FIT` für verschiedene Displaygrößen.
- [ ] **App-Icon** (512×512 PNG) und **Splashscreen** vorbereiten.

> 👉 Sag Bescheid, dann setze ich Abschnitt A im Code um (das ist der nächste
> sinnvolle Schritt vor dem Verpacken).

---

## B. Capacitor-Projekt anlegen  (auf deinem Rechner, im Projektordner)

```bash
# 1) Node-Projekt + Capacitor
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/app

# 2) Initialisieren (App-ID = umgekehrte Domain, eindeutig & dauerhaft!)
npx cap init "Sozialbetrug" "com.DEINNAME.sozialbetrug" --web-dir=www

# 3) Spieldateien in den Web-Ordner kopieren
#    (index.html, script.js, *.png, *.mp3, assets/ … → nach www/)
#    Tipp: Ordner "www" anlegen und alle Web-Dateien hineinkopieren.

# 4) Android-Plattform hinzufügen + Dateien synchronisieren
npx cap add android
npx cap sync

# 5) In Android Studio öffnen
npx cap open android
```

**Wichtig:**
- Die **App-ID** (`com.deinname.sozialbetrug`) ist dauerhaft — später nicht mehr
  änderbar ohne neue App. Gut wählen.
- Nach **jeder** Änderung am Web-Code: Dateien neu nach `www/` kopieren →
  `npx cap sync`.

### Querformat & Vollbild (in `android/app/src/main/AndroidManifest.xml`)
In der `<activity ...>` ergänzen:
```xml
android:screenOrientation="landscape"
```

---

## C. Build & Signierung  (in Android Studio)

1. **targetSdk prüfen:** Google verlangt für neue Apps eine aktuelle
   `targetSdkVersion` (Stand 2025: 34+). In `android/variables.gradle` ggf. anheben.
2. **Upload-Key (Keystore) erzeugen** — EINMALIG, gut aufbewahren (Verlust =
   keine Updates mehr möglich!):
   ```bash
   keytool -genkey -v -keystore upload-keystore.jks \
     -keyalg RSA -keysize 2048 -validity 9125 -alias upload
   ```
3. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**
   → mit dem Keystore signieren → erzeugt `app-release.aab`.
4. **Play App Signing** im Play Console aktiviert lassen (empfohlen): Du lädst mit
   deinem *Upload-Key* hoch, Google verwaltet den finalen *App-Signing-Key*.

> 🔐 Keystore-Datei + Passwörter sicher sichern (Passwortmanager). Niemals ins
> Git-Repo committen!

---

## D. Play Console: App einrichten

1. **App erstellen** (Name, Sprache, „Spiel", kostenlos/kostenpflichtig).
2. **`.aab` hochladen** → zunächst in einen **Test-Track** (s. E).
3. **Store-Eintrag** ausfüllen:
   - [ ] Kurz- & vollständige Beschreibung
   - [ ] **App-Icon** 512×512
   - [ ] **Feature-Grafik** 1024×500
   - [ ] **Screenshots** (mind. 2, Querformat-Handy)
   - [ ] Kategorie: *Spiele → Simulation*
4. **Datenschutzerklärung-URL** eintragen.
5. **Data Safety / Datensicherheit**-Formular: ausfüllen — wenn nichts gesammelt
   wird, „keine Daten erhoben" angeben (muss aber ausgefüllt sein).
6. **Content-Rating-Fragebogen (IARC)** ausfüllen — ehrlich:
   - **Simuliertes Glücksspiel** (Casino, Rubbellose) → ja, **kein Echtgeld**.
   - **Drogen/Alkohol-Bezug** (Dealer, Kiosk) → ja.
   - **Anspielungen auf Straftaten/Satire** (Sozialbetrug) → angeben.
   - → Ergebnis ist eine **hohe Altersfreigabe** (z. B. PEGI 16/18, „Mature").
     Das ist erlaubt; Glücksspiel-*Simulation* ohne Echtgeld ist policy-konform.
7. **Zielgruppe & Inhalte**: ab 18 / „nicht für Kinder" wählen.
8. **Länder & Preise** festlegen.

---

## E. Testen → Release

1. **Internal Testing** Track: `.aab` hochladen, eigene Test-Accounts (E-Mails)
   hinzufügen, Test-Link öffnen → auf echtem Handy installieren und durchspielen.
2. Bugs/Touch-Bedienung fixen → neue Version (s. u.) → erneut testen.
3. Optional **Closed/Open Testing** für mehr Tester.
4. **Production**: zur Veröffentlichung einreichen. Erst-Review dauert i. d. R.
   einige Tage (bei „Mature"-Inhalten ggf. länger).

---

## F. Updates veröffentlichen

Bei jeder neuen Version:
1. Web-Code aktualisieren → Dateien nach `www/` → `npx cap sync`.
2. In `android/app/build.gradle` **`versionCode` um 1 erhöhen** und `versionName`
   anpassen (z. B. „1.1").
3. Neues signiertes `.aab` bauen → im Play Console hochladen → ausrollen.

---

## Checkliste (Kurzfassung)

- [ ] Konto (25 $), Node, Android Studio, JDK, Datenschutz-URL
- [ ] **A) Spiel mobiltauglich** (Touch-Buttons, Querformat, responsives HUD, Icon)
- [ ] B) Capacitor init + `www/` + `cap add android` + `cap sync`
- [ ] C) Keystore erzeugen (sichern!) + signiertes `.aab` bauen
- [ ] D) Store-Eintrag, Datenschutz, Data-Safety, Content-Rating (Mature)
- [ ] E) Internal Testing auf echtem Gerät → Production
- [ ] Veröffentlichen 🎉

---

## Hinweise speziell für DIESES Spiel

- **Offline**: Capacitor bündelt alle Assets → kein Server, läuft ohne Internet.
- **Rating**: Wegen Glücksspiel-Simulation + Drogen/Satire wird's „ab 16/18".
  Korrekt angeben — dann ist es zulässig. (Würde man es verschweigen und es fliegt
  auf, droht Entfernung.)
- **Point-and-Click** ist schon touch-freundlich — fehlen nur die Buttons für die
  paar Tastatur-Aktionen.
- **iOS** (Apple App Store) ginge mit demselben Capacitor-Projekt zusätzlich
  (`npx cap add ios`), braucht aber einen Mac + Apple-Developer-Konto (99 $/Jahr).
