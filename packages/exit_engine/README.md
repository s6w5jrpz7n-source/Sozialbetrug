# exit_engine

Rechen-Engine des **ExitKompass** für das Steuer-/Beitragsjahr **2026**:
Einkommensteuer (M1), Sozialversicherung (M2), Abfindung (M3) und
ALG 1 (M4). Reine Dart-Bibliothek ohne Flutter-Abhängigkeit.

**Konventionen**

- Alle Geldbeträge sind `int` in **Cent** (Eingabe und Ausgabe).
- Alle Parameter (Tarifformel § 32a EStG, Beitragssätze, BBGs,
  ALG-Tabellen) kommen aus [`assets/params_2026.json`](assets/params_2026.json)
  mit Quellenkommentar je Block; `ExitParams.year2026()` lädt die
  eingebettete Kopie. Andere Jahre: eigene JSON über
  `ExitParams.fromJsonString(...)` laden und als `params:` übergeben.
- Vereinfachungen und offene Punkte: siehe [`ASSUMPTIONS.md`](../../ASSUMPTIONS.md);
  manuelle Verifikation der Golden-Cases: [`VERIFY.md`](../../VERIFY.md).

```bash
dart pub get
dart analyze            # ohne Findings
dart test               # 86 Tests
dart test --exclude-tags unverified   # ohne die noch nicht extern
                                      # verifizierten Golden-Cases
```

## M1 – Einkommensteuer / Lohnsteuer

zvE → tarifliche Einkommensteuer (§ 32a EStG, Grund-/Splittingtarif),
darauf Soli und Kirchensteuer; Jahres-Lohnsteuer je Steuerklasse I–VI mit
vereinfachter Vorsorgepauschale als Netto-Schätzung.

```dart
import 'package:exit_engine/exit_engine.dart';

// 50.000 € zvE → 10.548,00 € ESt (Grundtarif 2026)
final est = einkommensteuer(zvECents: 5000000);          // 1054800

// Soli auf eine ESt von 40.000 € (oberhalb der Milderungszone)
final soli = solidaritaetszuschlag(bemessungsgrundlageCents: 4000000); // 220000

// Kirchensteuer 8 % (Bayern) auf 10.000 € ESt
final kist = kirchensteuer(
  bemessungsgrundlageCents: 1000000,
  bundesland: Bundesland.bayern,
);                                                        // 80000

// Jahres-Lohnsteuer: 60.000 € Brutto, StKl I, kinderlos, 30 Jahre
final lst = jahresLohnsteuer(
  bruttoJahrCents: 6000000,
  steuerklasse: Steuerklasse.i,
  alter: 30,
);
print(lst.lohnsteuerCents); // 932800  (9.328,00 €)
print(lst.soliCents);       // 0       (unter der Freigrenze)
```

## M2 – Sozialversicherung

Arbeitnehmer-Abzüge KV/PV/RV/AV mit Deckelung an beiden
Beitragsbemessungsgrenzen; PV mit Kinderlosenzuschlag, Kinderabschlägen
und Sachsen-Sonderfall.

```dart
// 130.000 € Brutto liegt über beiden BBGs
final sv = svArbeitnehmerAbzuege(
  bruttoJahrCents: 13000000,
  alter: 40,
  anzahlKinder: 2,
  anzahlKinderUnter25: 2,
);
print(sv.kvCents);     // 610313  (KV auf 69.750 € gedeckelt)
print(sv.rvCents);     // 943020  (RV auf 101.400 € gedeckelt)
print(sv.pvSatzAn);    // 0.0155  (1,8 % − 0,25 %-Pkt. für das 2. Kind)
print(sv.gesamtCents); // Summe aller AN-Beiträge

// Netto-Schätzung (M1 + M2) in einem Aufruf:
final netto = nettoJahr(
  bruttoJahrCents: 6000000,
  steuerklasse: Steuerklasse.i,
  alter: 30,
);
print(netto.nettoMonatCents); // 313517  (3.135,17 €/Monat)
```

## M3 – Abfindung (Fünftelregelung)

Regelbesteuerung vs. Fünftelregelung (§ 34 Abs. 1 EStG) auf das zvE des
Abfindungsjahres; seit 2025 gibt es die Ermäßigung nur noch über die
Veranlagung – das Flag macht das explizit.

```dart
final abf = abfindungVergleich(
  zvEOhneAbfindungCents: 5500000,  // 55.000 € Rest-zvE
  abfindungCents: 6000000,         // 60.000 € Abfindung
);
print(abf.steuerRegelCents);      // 3716400  (37.164,00 €)
print(abf.steuerFuenftelCents);   // 3570200  (35.702,00 €)
print(abf.ersparnisCents);        // 146200   ( 1.462,00 €)
print(abf.nurUeberVeranlagung);   // true → Erstattung erst mit der Veranlagung
```

## M4 – ALG 1

Bemessungsentgelt (BBG-gedeckelt) → pauschaliertes Leistungsentgelt
(20 % SV-Pauschale, fiktive Lohnsteuer, Soli) → Leistungssatz 60/67 % →
Tagessatz und Monatsbetrag; dazu Anspruchsdauer (§ 147), Sperrzeit-
Simulation (§ 159/§ 148) und Ruhen bei Abfindung (§ 158).

```dart
final alg = alg1Bemessung(
  bruttoJahrCents: 6000000,       // 60.000 € letztes Jahresbrutto
  steuerklasse: Steuerklasse.i,
  alter: 30,
);
print(alg.algTagCents);   // 6357    (63,57 €/Tag)
print(alg.algMonatCents); // 190710  (1.907,10 €/Monat)

final dauer = alg1AnspruchsdauerTage(versicherungsmonate: 24, alter: 30); // 360

// Eigenkündigung ohne wichtigen Grund: 12 Wochen Sperrzeit,
// Anspruchsdauer −25 %
final sperre = sperrzeitSimulation(anspruchTage: dauer, algTagCents: alg.algTagCents);
print(sperre.minderungTage);       // 90
print(sperre.verlorenesAlgCents);  // 572130  (5.721,30 € endgültig verloren)

// Abfindung + verkürzte Kündigungsfrist: Ruhen nach § 158
final ruhen = ruhen158(
  abfindungCents: 5000000,
  alter: 40,
  betriebszugehoerigkeitJahre: 10,
  kalendertagEntgeltCents: 6000000 ~/ 365,
  fehlendeKuendigungsfristTage: 60,
);
print(ruhen.massgeblicherAnteil);  // 0.45
print(ruhen.ruhenTage);            // 60 (gedeckelt auf die fehlende Frist)
```

## Parameter aktualisieren

`assets/params_2026.json` ist die Quelle der Wahrheit. Nach Änderungen
die eingebettete Kopie neu erzeugen:

```bash
python3 tool/embed_params.py
```

Der Test `params_sync_test.dart` schlägt fehl, wenn beide Fassungen
auseinanderlaufen.
