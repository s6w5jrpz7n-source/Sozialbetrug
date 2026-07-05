/// M2 – Sozialversicherung: Arbeitnehmer-Abzüge 2026.
///
/// Berechnet die AN-Anteile zu Kranken-, Pflege-, Renten- und
/// Arbeitslosenversicherung auf Jahresbasis, mit korrekter Deckelung an
/// beiden Beitragsbemessungsgrenzen (KV/PV: 69.750 €, RV/AV: 101.400 €).
/// Annahme: gesetzlich versicherter Arbeitnehmer (keine PKV, kein
/// Midijob-Übergangsbereich).
library;

import 'dart:math';

import 'money.dart';
import 'params.dart';
import 'sv_rates.dart';

/// Arbeitnehmer-Beiträge zur Sozialversicherung (Jahresbeträge in Cent).
class SvAbzuege {
  const SvAbzuege({
    required this.bruttoJahrCents,
    required this.kvCents,
    required this.pvCents,
    required this.rvCents,
    required this.avCents,
    required this.kvSatzAn,
    required this.pvSatzAn,
  });

  /// Jahresbrutto (Eingabe).
  final int bruttoJahrCents;

  /// Krankenversicherung (inkl. hälftigem Zusatzbeitrag).
  final int kvCents;

  /// Pflegeversicherung (inkl. Kinderlosenzuschlag bzw. Kinderabschlägen).
  final int pvCents;

  /// Rentenversicherung.
  final int rvCents;

  /// Arbeitslosenversicherung.
  final int avCents;

  /// Angewandter AN-Beitragssatz KV (informativ).
  final double kvSatzAn;

  /// Angewandter AN-Beitragssatz PV (informativ).
  final double pvSatzAn;

  /// Summe aller AN-Beiträge.
  int get gesamtCents => kvCents + pvCents + rvCents + avCents;
}

/// Arbeitnehmer-Abzüge zur Sozialversicherung auf ein Jahresbrutto.
///
/// * [alter], [anzahlKinder], [anzahlKinderUnter25]: steuern den
///   PV-Kinderlosenzuschlag (+0,6 %-Pkt. ab 23 ohne Kinder) und die
///   PV-Abschläge (−0,25 %-Pkt. je Kind für Kind 2–5 unter 25).
/// * [bundesland]: Sachsen hat einen um 0,5 %-Pkt. höheren AN-Anteil
///   zur Pflegeversicherung.
/// * [kvZusatzbeitragSatz]: kassenindividueller Zusatzbeitrag
///   (Default: Durchschnittssatz 2,9 % für 2026).
///
/// Beiträge werden kaufmännisch auf volle Cent gerundet.
SvAbzuege svArbeitnehmerAbzuege({
  required int bruttoJahrCents,
  required int alter,
  int anzahlKinder = 0,
  int anzahlKinderUnter25 = 0,
  Bundesland bundesland = Bundesland.nordrheinWestfalen,
  double? kvZusatzbeitragSatz,
  ExitParams? params,
}) {
  assert(bruttoJahrCents >= 0);
  final p = params ?? ExitParams.year2026();
  final sv = p.sozialversicherung;

  final basisKvPv = min(bruttoJahrCents, sv.bbgKvPvJahrCents);
  final basisRvAv = min(bruttoJahrCents, sv.bbgRvAvJahrCents);

  final kvSatz = krankenversicherungAnSatz(sv: sv, zusatzbeitragSatz: kvZusatzbeitragSatz);
  final pvSatz = pflegeversicherungAnSatz(
    sv: sv,
    alter: alter,
    anzahlKinder: anzahlKinder,
    anzahlKinderUnter25: anzahlKinderUnter25,
    bundesland: bundesland,
  );

  return SvAbzuege(
    bruttoJahrCents: bruttoJahrCents,
    kvCents: anteilRound(basisKvPv, kvSatz),
    pvCents: anteilRound(basisKvPv, pvSatz),
    rvCents: anteilRound(basisRvAv, sv.rvAnAnteil),
    avCents: anteilRound(basisRvAv, sv.avAnAnteil),
    kvSatzAn: kvSatz,
    pvSatzAn: pvSatz,
  );
}
