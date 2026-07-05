/// Netto-Schätzung: Kombination aus M1 (Lohnsteuer, Soli, Kirchensteuer)
/// und M2 (Sozialversicherung) für ein Jahresbrutto.
library;

import 'm1_income_tax.dart';
import 'm2_social_insurance.dart';
import 'params.dart';

/// Ergebnis der Netto-Schätzung (Jahresbeträge in Cent).
class NettoErgebnis {
  const NettoErgebnis({required this.steuern, required this.sozialversicherung});

  /// Steuerabzüge (M1).
  final LohnsteuerErgebnis steuern;

  /// Sozialversicherungs-Abzüge (M2).
  final SvAbzuege sozialversicherung;

  int get bruttoJahrCents => steuern.bruttoJahrCents;

  /// Geschätztes Jahresnetto.
  int get nettoJahrCents =>
      bruttoJahrCents - steuern.steuerabzugGesamtCents - sozialversicherung.gesamtCents;

  /// Geschätztes Monatsnetto (Jahreswert / 12, kaufmännisch gerundet).
  int get nettoMonatCents => (nettoJahrCents / 12).round();
}

/// Schätzt das Nettoeinkommen für ein Jahresbrutto.
///
/// Vereinfachungen: Jahresbetrachtung (keine Monats-Lohnabrechnung),
/// vereinfachte Vorsorgepauschale, gesetzliche KV. Details in
/// ASSUMPTIONS.md.
NettoErgebnis nettoJahr({
  required int bruttoJahrCents,
  required Steuerklasse steuerklasse,
  required int alter,
  double kinderfreibetragZaehler = 0,
  int anzahlKinder = 0,
  int anzahlKinderUnter25 = 0,
  bool kirchenmitglied = false,
  Bundesland bundesland = Bundesland.nordrheinWestfalen,
  double? kvZusatzbeitragSatz,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  return NettoErgebnis(
    steuern: jahresLohnsteuer(
      bruttoJahrCents: bruttoJahrCents,
      steuerklasse: steuerklasse,
      alter: alter,
      kinderfreibetragZaehler: kinderfreibetragZaehler,
      anzahlKinder: anzahlKinder,
      anzahlKinderUnter25: anzahlKinderUnter25,
      kirchenmitglied: kirchenmitglied,
      bundesland: bundesland,
      kvZusatzbeitragSatz: kvZusatzbeitragSatz,
      params: p,
    ),
    sozialversicherung: svArbeitnehmerAbzuege(
      bruttoJahrCents: bruttoJahrCents,
      alter: alter,
      anzahlKinder: anzahlKinder,
      anzahlKinderUnter25: anzahlKinderUnter25,
      bundesland: bundesland,
      kvZusatzbeitragSatz: kvZusatzbeitragSatz,
      params: p,
    ),
  );
}
