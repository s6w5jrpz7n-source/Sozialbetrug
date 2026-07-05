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

_(wird fortlaufend gepflegt)_
