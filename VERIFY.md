# VERIFY.md – Manuelle Verifikation der Golden-Cases

Die Golden-Tests in `packages/exit_engine/test/golden_test.dart` tragen das
Tag `unverified`: Ihre Erwartungswerte stammen aus der Engine selbst und
dienen bis zum Abgleich nur als Regressions-Pins. Diese Checkliste enthält
die exakten Eingaben, um **5 Kernfälle** (G1, G2, G3, G5, G6) plus
optional die ALG-Fälle (G7, G8) gegen die offiziellen Rechner zu prüfen.
**Erst nach bestätigtem Abgleich werden die `unverified`-Tags entfernt.**

## Rechner

- **BMF-Lohn- und Einkommensteuerrechner:** <https://www.bmf-steuerrechner.de>
  – „Berechnung der Lohnsteuer" (Jahr 2026) bzw. „Berechnung der
  Einkommensteuer" (Tarif 2026).
- **ALG-Rechner der Bundesagentur für Arbeit (Selbstinformation):**
  <https://www.arbeitsagentur.de/arbeitslosengeld-rechner>
  (bzw. <https://www.pub.arbeitsagentur.de>) – Leistung ab 2026.

## Gemeinsame BMF-Eingaben (Lohnsteuer, alle Fälle)

| Feld | Wert |
|---|---|
| Abrechnungszeitraum | Jahr 2026 |
| Lohnzahlungszeitraum | jährlich, voller Jahresbruttolohn |
| Geburtsjahr | so wählen, dass das Alter dem Fall entspricht (kein Alter ≥ 64 → keine Altersentlastung) |
| Krankenversicherung | gesetzlich, **Zusatzbeitragssatz 2,9 %** |
| Rentenversicherung | gesetzlich (West/Ost egal, BBG 2026 bundeseinheitlich) |
| Freibetrag/Hinzurechnungsbetrag | 0 |
| Bundesland | wie im Fall angegeben (Sachsen: nein) |

Erwartete Toleranzen: **Lohnsteuer ± 10 €/Jahr** (vereinfachte
Vorsorgepauschale, s. ASSUMPTIONS.md A2.1), Soli/KiSt entsprechend
anteilig; **Einkommensteuer (G6) exakt**; **ALG ± 5 €/Monat**
(Rundungskonventionen der BA, s. A5.2).

---

## ☐ G1 – 60.000 €, StKl I, kinderlos, 30 Jahre, keine Kirche (NW)

**BMF-Lohnsteuer:** Jahresbrutto 60.000 €, StKl I, keine Kinderfreibeträge,
kirchensteuerpflichtig: nein, PV: kinderlos (Zuschlag ja), Bundesland NW.

| Engine-Wert | Erwartung |
|---|---|
| Lohnsteuer | **9.328,00 €** |
| Soli | 0,00 € |
| Kirchensteuer | 0,00 € |

**BA-ALG-Rechner:** Brutto 5.000 €/Monat (12 Monate), StKl I, kein Kind,
keine Kirchensteuer.

| Engine-Wert | Erwartung |
|---|---|
| Leistungsentgelt/Tag | 105,95 € |
| ALG-Tagessatz (60 %) | 63,57 € |
| **ALG/Monat** | **1.907,10 €** |
| Anspruchsdauer (24 Monate versichert, 30 J) | 360 Tage / 12 Monate |

## ☐ G2 – 90.000 €, StKl III, 1 Kind, Kirche 9 %, 40 Jahre (NW)

**BMF-Lohnsteuer:** Jahresbrutto 90.000 €, StKl III, Kinderfreibetragszähler
1,0, kirchensteuerpflichtig: ja (NW, 9 %), PV: 1 Kind (kein Zuschlag, kein
Abschlag), Bundesland NW.

| Engine-Wert | Erwartung |
|---|---|
| Lohnsteuer | **12.246,00 €** |
| Soli | 0,00 € |
| Kirchensteuer | **842,22 €** |

**BA-ALG-Rechner:** Brutto 7.500 €/Monat, StKl III, mit Kind (67 %).

| Engine-Wert | Erwartung |
|---|---|
| ALG-Tagessatz (67 %) | 109,67 € |
| **ALG/Monat** | **3.290,10 €** |

## ☐ G3 – 130.000 €, StKl I, kinderlos, 45 Jahre (über beiden BBGs)

**BMF-Lohnsteuer:** Jahresbrutto 130.000 €, StKl I, keine Kinderfreibeträge,
keine Kirche, PV: kinderlos.

| Engine-Wert | Erwartung |
|---|---|
| Lohnsteuer | **35.704,00 €** |
| Soli | **1.827,12 €** (Milderungszone) |

**BA-ALG-Rechner:** Brutto 10.833 €/Monat (wird an der BBG 8.450 €/Monat
gedeckelt), StKl I, kein Kind.

| Engine-Wert | Erwartung |
|---|---|
| Bemessungsentgelt/Tag (gedeckelt) | 277,80 € |
| ALG-Tagessatz (60 %) | 93,74 € |
| **ALG/Monat (Höchstbetrag kinderlos)** | **2.812,20 €** |

## ☐ G5 – 45.000 €, StKl V, 2 Kinder, Kirche 8 %, 35 Jahre (Bayern)

**BMF-Lohnsteuer:** Jahresbrutto 45.000 €, StKl V, Kinderfreibetragszähler
2,0, kirchensteuerpflichtig: ja (BY, 8 %), PV: 2 Kinder unter 25
(Abschlag für das 2. Kind), Bundesland BY.

| Engine-Wert | Erwartung |
|---|---|
| Lohnsteuer | **10.438,00 €** |
| Soli | 0,00 € |
| Kirchensteuer | **202,24 €** |

## ☐ G6 – Abfindung: Rest-zvE 55.000 € + 60.000 € Abfindung (Grundtarif)

**BMF-Einkommensteuerrechner** (Tarif 2026, Einzelveranlagung) – drei
Abfragen des zvE; die Fünftelregelung ergibt sich per Handrechnung:

| Abfrage | zvE | erwartete ESt |
|---|---|---|
| Basis | 55.000 € | **12.347 €** |
| Regelbesteuerung | 115.000 € | **37.164 €** |
| Basis + 1/5 Abfindung | 67.000 € | **17.018 €** |

Fünftelregelung: 12.347 + 5 × (17.018 − 12.347) = **35.702 €**
→ Ersparnis **1.462 €** (nur über Veranlagung erstattet).

## ☐ G7 (optional) – ALG: 95.000 €, StKl III, 1 Kind, 58 J, 48 Monate versichert

**BA-ALG-Rechner:** Brutto 7.916,67 €/Monat, StKl III, mit Kind, 58 Jahre.

| Engine-Wert | Erwartung |
|---|---|
| ALG-Tagessatz (67 %) | 114,45 € |
| **ALG/Monat** | **3.433,50 €** |
| Anspruchsdauer (48 Monate, 58 J) | 720 Tage / 24 Monate |
| Sperrzeit-Simulation: Minderung | 180 Tage (¼ von 720) → 20.601 € verloren |

## ☐ G8 (optional) – ALG + § 158: 80.000 €, StKl I, 50 J, Abfindung 60.000 €

**BA-ALG-Rechner:** Brutto 6.666,67 €/Monat, StKl I, kein Kind, 50 Jahre.

| Engine-Wert | Erwartung |
|---|---|
| ALG-Tagessatz (60 %) | 79,54 € |
| **ALG/Monat** | **2.386,20 €** |
| Anspruchsdauer (30 Monate, 50 J) | 450 Tage / 15 Monate |
| § 158-Ruhen (25 J Betrieb, Kündigungsfrist 120 Tage unterschritten) | Anteil 25 % → 15.000 € → **68 Tage Ruhen** |

*Hinweis: Das § 158-Ruhen bildet der BA-Online-Rechner nicht ab; hier nur
Plausibilitätsprüfung des Anteils nach § 158 Abs. 2 SGB III (60 % − 5 %-Punkte
je 5 Jahre Betriebszugehörigkeit − 5 %-Punkte je 5 Lebensjahre über 35,
Minimum 25 %).*

---

## Nach dem Abgleich

1. Abweichungen > Toleranz: bitte notieren (Fall, Feld, BMF/BA-Wert) –
   dann wird die Engine korrigiert und neu gepinnt.
2. Bestätigten Abgleich melden → die `unverified`-Tags in
   `golden_test.dart` und der Hinweis in `dart_test.yaml` werden entfernt.
