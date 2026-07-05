# ASSUMPTIONS

Annahmen und Entscheidungen, die während der Entwicklung getroffen wurden,
weil die Spezifikation sie nicht (oder nicht eindeutig) vorgibt.

## A0 – Fehlende Spezifikation (wichtigster Punkt)

`docs/ExitKompass_Spezifikation_v1.md` und `CLAUDE.md` waren zum Start der
Engine-Entwicklung **auf keinem Branch des Repositories vorhanden**. Das
Repo enthielt ausschließlich das Browser-Spiel „Sozialbetrug /
Staat-Stratege“. Konsequenzen:

- Die Werte in `packages/exit_engine/assets/params_2026.json` konnten
  **nicht** gegen die M2-Tabelle aus Spec §5 abgeglichen werden. Stattdessen
  wurden alle Werte direkt aus den offiziellen Rechtsquellen 2026 übernommen
  (Quellen je JSON-Block als `_quelle` dokumentiert) und per Web-Recherche
  verifiziert (Sozialversicherungsrechengrößen-VO 2026, § 32a EStG i. d. F.
  Steuerfortentwicklungsgesetz, SolzG, SGB III).
- Die in `CLAUDE.md` referenzierte Fünftelregelungs-Formel lag nicht vor;
  M3 verwendet die gesetzliche Formel des § 34 Abs. 1 EStG:
  `ESt_ermäßigt = ESt(zvE_verbleibend) + 5 × (ESt(zvE_verbleibend + Abfindung/5) − ESt(zvE_verbleibend))`.
- **TODO:** Sobald die Spec nachgereicht ist, `params_2026.json` gegen
  Spec §5 abgleichen und diese Annahme schließen.

## A1 – Parameterdatei 2026

- **A1.1 GKV-Zusatzbeitrag:** Es wird der **durchschnittliche**
  Zusatzbeitragssatz 2026 (2,9 %, BMG-Bekanntmachung) als Default verwendet.
  Der tatsächliche Satz ist kassenindividuell; die API erlaubt einen
  abweichenden Satz als Parameter.
- **A1.2 § 39b Abs. 2 S. 7 EStG (StKl V/VI):** Die Grenzwerte 2026
  (14.071 € / 34.939 € / 222.260 €) stammen aus Sekundärquellen zum
  PAP 2026 (rechnercheck.de; BMF-PAP v. 12.11.2025 war über den
  Session-Proxy nicht direkt abrufbar). Plausibilität: 34.939 = 69.878/2,
  222.260 = 0,8 × 277.825. **TODO:** gegen den offiziellen PAP 2026 prüfen.
- **A1.3 Entlastungsbetrag für Alleinerziehende (§ 24b EStG):** 4.260 €
  (Stand seit 2023) – für 2026 keine Änderung bekannt. Wird nur für
  Steuerklasse II verwendet. **TODO:** bestätigen.
- **A1.4 Kindergeld:** 259 €/Monat ab 01.01.2026 (§ 66 EStG i. d. F.
  Steuerfortentwicklungsgesetz). Wird von der Engine informativ mitgeführt,
  geht aber in keine M1–M4-Berechnung ein.
- **A1.5 Kirchensteuer:** Vereinfachung auf „8 % in BY/BW, 9 % sonst“.
  Kappungsregelungen der Länder und besonderes Kirchgeld sind nicht
  abgebildet.
- **A1.6 Keine `null`-Platzhalter nötig:** Alle Parameterwerte konnten aus
  offiziellen bzw. verlässlichen Sekundärquellen belegt werden; ein Test
  (`params_sync_test.dart`) schlägt fehl, falls künftig `null`-TODOs in der
  Datei stehen, ohne dass sie hier gelistet sind.

## A2 – M1 Einkommensteuer/Lohnsteuer

- **A2.1 Vereinfachte Vorsorgepauschale:** M1 implementiert § 39b Abs. 2
  S. 5 Nr. 3 EStG vereinfacht (Teilbeträge RV + KV + PV, jeweils auf volle
  Euro aufgerundet; Mindestvorsorgepauschale 12 %, max. 1.900/3.000 €).
  Nicht abgebildet: PKV-Basistarif-Bescheinigungen, Faktorverfahren,
  Frei-/Hinzurechnungsbeträge, sonstige Bezüge/Einmalzahlungen im
  Lohnsteuerabzug. Die Jahres-Lohnsteuer ist eine **Netto-Schätzung**,
  keine zertifizierte PAP-Implementierung; Abweichungen zum
  BMF-Rechner im niedrigen Euro-Bereich sind möglich.
- **A2.2 Rundung:** zvE und Steuerbetrag werden auf volle Euro abgerundet
  (§ 32a Abs. 1 EStG); Soli/KiSt auf volle Cent abgerundet (Bruchteile
  eines Cents bleiben außer Ansatz). SV-Beiträge kaufmännisch auf Cent.
- **A2.3 Splitting:** Steuerklasse III wird über den Splittingtarif auf das
  eigene Brutto abgebildet (Alleinverdiener-Annahme); Einkommen des
  Ehepartners ist kein Eingabeparameter von M1.
- **A2.4 Kirchensteuer im LSt-Abzug:** Bemessungsgrundlage ist die fiktive
  LSt mit Kinderfreibeträgen (§ 51a Abs. 2a EStG); Kappung und besonderes
  Kirchgeld sind nicht abgebildet.

## A3 – M2 Sozialversicherung

- **A3.1 Personenkreis:** gesetzlich pflichtversicherter Arbeitnehmer.
  Keine PKV, kein Midijob-Übergangsbereich (§ 20 Abs. 2a SGB IV), keine
  Gleitzone, keine berufsständischen Versorgungswerke.
- **A3.2 Jahresbetrachtung:** Beiträge werden auf das Jahresbrutto mit
  Jahres-BBGs gerechnet (keine Monatsabrechnung mit anteiligen BBGs bei
  unterjährigen Verläufen).
- **A3.3 PV-Kinderabschlag:** Eingaben sind `anzahlKinder` (jemals,
  für den Kinderlosenzuschlag) und `anzahlKinderUnter25` (für die
  Abschläge Kind 2–5). Die Altersprüfung der Kinder übernimmt der Aufrufer.

## A4 – M3 Abfindung

- **A4.1 Formel:** § 34 Abs. 1 EStG:
  `ESt_ermäßigt = ESt(zvE_rest) + 5 × (ESt(zvE_rest + A/5) − ESt(zvE_rest))`.
  Die in CLAUDE.md referenzierte Formel lag nicht vor (siehe A0).
- **A4.2 Zusammenballung:** Die Voraussetzung der „Zusammenballung von
  Einkünften" (Abfindung > entgehende Einnahmen) prüft die Engine nicht;
  der Aufrufer/die UI muss darauf hinweisen.
- **A4.3 Flag `nurUeberVeranlagung`:** Seit VZ 2025 keine Fünftelregelung
  mehr im Lohnsteuerabzug (Wachstumschancengesetz); das Flag ist `true`,
  sobald eine Ersparnis > 0 existiert.
- **A4.4 Sozialversicherung:** Echte Abfindungen sind beitragsfrei in der
  SV; M3 rechnet daher nur die Steuer.

## A5 – M4 ALG 1

- **A5.1 Fiktive Lohnsteuer:** § 153 SGB III verlangt die Lohnsteuer nach
  dem BMF-Programmablaufplan „im Jahresdurchschnitt". M4 verwendet die
  vereinfachte M1-Jahreslohnsteuer auf das (gedeckelte) Bemessungsentgelt;
  kleine Abweichungen zum BA-Rechner sind möglich. Kirchensteuer wird –
  wie im geltenden Recht – **nicht** abgezogen, Soli mit
  Kinderfreibeträgen (§ 51a) schon.
- **A5.2 Rundung:** Tageswerte werden durch Ganzzahldivision (÷365)
  abgerundet, der Tagessatz ebenfalls; Monatsbetrag = 30 Tagessätze
  (§ 154 SGB III). Die BA rundet teils anders (2 Nachkommastellen je
  Rechenschritt); Abweichungen im Cent-Bereich sind möglich.
- **A5.3 Sperrzeit-Minderung:** § 148 Abs. 1 Nr. 4 SGB III – Minderung um
  die Sperrzeittage, bei 12 Wochen mindestens ein Viertel der
  Anspruchsdauer. Bei nicht durch 4 teilbaren Anspruchsdauern (450 Tage)
  wird abgerundet (450/4 → 112 Tage). Verkürzte Sperrzeiten (3/6 Wochen,
  § 159 Abs. 3 S. 2) sind nicht abgebildet, ebenso keine Härtefallprüfung
  („wichtiger Grund").
- **A5.4 § 158-Ruhen:** Eingabe ist `fehlendeKuendigungsfristTage`
  (Differenz tatsächliches Ende ↔ fiktives Ende der ordentlichen
  Kündigungsfrist); die Bestimmung der maßgeblichen Kündigungsfrist
  (inkl. Sonderfälle unkündbarer Arbeitsverhältnisse, § 158 Abs. 1
  S. 3–4) übernimmt der Aufrufer. Während des Ruhens bleibt die
  Anspruchsdauer erhalten (kein § 148-Verbrauch); Ruhen und Sperrzeit
  laufen parallel, die Engine addiert sie nicht automatisch.
- **A5.5 Anspruchsdauer:** Die Tabelle setzt Versicherungsmonate in der
  auf 5 Jahre erweiterten Rahmenfrist voraus (Eingabe des Aufrufers);
  Vordienstzeiten-Anrechnung nach § 147 Abs. 3/4 ist nicht abgebildet.

_(wird fortlaufend gepflegt)_
