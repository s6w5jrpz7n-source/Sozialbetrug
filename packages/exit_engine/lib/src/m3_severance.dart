/// M3 – Abfindung: Regelbesteuerung vs. Fünftelregelung (§ 34 Abs. 1 EStG).
///
/// Vergleicht die Einkommensteuer auf ein zvE zuzüglich Abfindung nach
/// Regelbesteuerung mit der ermäßigten Besteuerung nach der
/// Fünftelregelung:
///
/// ```text
/// ESt_ermäßigt = ESt(zvE_rest) + 5 × ( ESt(zvE_rest + Abfindung/5) − ESt(zvE_rest) )
/// ```
///
/// Seit dem Veranlagungszeitraum 2025 wendet der Arbeitgeber die
/// Fünftelregelung im Lohnsteuerabzug **nicht mehr** an
/// (Wachstumschancengesetz, Streichung von § 39b Abs. 3 S. 9–10 EStG);
/// die Ermäßigung gibt es nur noch über die Einkommensteuer-Veranlagung.
/// Das Ergebnis-Flag [SeveranceTaxResult.nurUeberVeranlagung] macht das
/// explizit.
library;

import 'dart:math';

import 'm1_income_tax.dart';
import 'params.dart';

/// Ergebnis des Abfindungs-Vergleichs (alle Beträge in Cent).
class SeveranceTaxResult {
  const SeveranceTaxResult({
    required this.zvEOhneAbfindungCents,
    required this.abfindungCents,
    required this.steuerOhneAbfindungCents,
    required this.steuerRegelCents,
    required this.steuerFuenftelCents,
  });

  /// Verbleibendes zvE ohne die Abfindung (Eingabe).
  final int zvEOhneAbfindungCents;

  /// Abfindung (Eingabe).
  final int abfindungCents;

  /// ESt auf das zvE ohne Abfindung (Vergleichsbasis).
  final int steuerOhneAbfindungCents;

  /// Gesamte ESt bei Regelbesteuerung: ESt(zvE + Abfindung).
  final int steuerRegelCents;

  /// Gesamte ESt bei Fünftelregelung (§ 34 Abs. 1 EStG).
  final int steuerFuenftelCents;

  /// Ersparnis durch die Fünftelregelung (>= 0; die Veranlagung wendet
  /// § 34 nur an, wenn er günstiger ist).
  int get ersparnisCents => max(0, steuerRegelCents - steuerFuenftelCents);

  /// Steuerlast, die auf die Abfindung entfällt (Regelbesteuerung).
  int get steuerAufAbfindungRegelCents => steuerRegelCents - steuerOhneAbfindungCents;

  /// Steuerlast, die auf die Abfindung entfällt (Fünftelregelung).
  int get steuerAufAbfindungFuenftelCents => steuerFuenftelCents - steuerOhneAbfindungCents;

  /// Seit 2025 wird die Fünftelregelung nicht mehr im Lohnsteuerabzug
  /// berücksichtigt: Der Arbeitgeber behält die Lohnsteuer nach
  /// Regelbesteuerung ein, die Ersparnis wird erst mit der
  /// Einkommensteuer-Veranlagung erstattet.
  bool get nurUeberVeranlagung => ersparnisCents > 0;
}

/// Vergleicht Regelbesteuerung und Fünftelregelung für eine Abfindung.
///
/// [zvEOhneAbfindungCents]: zu versteuerndes Einkommen des
/// Abfindungsjahres **ohne** die Abfindung (bereits um Werbungskosten,
/// Vorsorgeaufwendungen etc. gemindert). [splitting] für
/// Zusammenveranlagung.
///
/// Hinweis: Die Fünftelregelung setzt eine "Zusammenballung von
/// Einkünften" voraus; diese Prüfung übernimmt die Engine nicht
/// (siehe ASSUMPTIONS.md).
SeveranceTaxResult abfindungVergleich({
  required int zvEOhneAbfindungCents,
  required int abfindungCents,
  bool splitting = false,
  ExitParams? params,
}) {
  assert(abfindungCents >= 0);
  final p = params ?? ExitParams.year2026();
  final zvERest = max(0, zvEOhneAbfindungCents);

  int est(int zvECents) => einkommensteuer(zvECents: zvECents, splitting: splitting, params: p);

  final steuerBasis = est(zvERest);
  final steuerRegel = est(zvERest + abfindungCents);
  final steuerFuenftel =
      steuerBasis + 5 * (est(zvERest + abfindungCents ~/ 5) - steuerBasis);

  return SeveranceTaxResult(
    zvEOhneAbfindungCents: zvERest,
    abfindungCents: abfindungCents,
    steuerOhneAbfindungCents: steuerBasis,
    steuerRegelCents: steuerRegel,
    steuerFuenftelCents: steuerFuenftel,
  );
}
