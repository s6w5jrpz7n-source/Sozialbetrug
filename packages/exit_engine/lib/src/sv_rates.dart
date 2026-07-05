/// Arbeitnehmer-Beitragssätze der Sozialversicherung.
///
/// Wird von M2 (Beitragsberechnung) und von M1 (vereinfachte
/// Vorsorgepauschale nach § 39b Abs. 2 S. 5 Nr. 3 EStG) gemeinsam genutzt.
library;

import 'dart:math';

import 'params.dart';

/// Arbeitnehmer-Anteil zur Pflegeversicherung (§ 55 SGB XI).
///
/// * Grundanteil 1,8 % (Sachsen: 2,3 %, wegen des nicht abgeschafften
///   Buß- und Bettags).
/// * Kinderlosenzuschlag +0,6 %-Pkt. ab Alter 23, wenn nie ein Kind
///   vorhanden war ([anzahlKinder] == 0).
/// * Abschlag 0,25 %-Pkt. je Kind für das 2. bis 5. Kind **unter 25**
///   ([anzahlKinderUnter25]).
double pflegeversicherungAnSatz({
  required SocialInsuranceParams sv,
  required int alter,
  required int anzahlKinder,
  required int anzahlKinderUnter25,
  required Bundesland bundesland,
}) {
  assert(anzahlKinderUnter25 <= anzahlKinder,
      'anzahlKinderUnter25 kann anzahlKinder nicht übersteigen');
  var satz = bundesland == Bundesland.sachsen ? sv.pvAnAnteilSachsen : sv.pvAnAnteilNormal;
  if (anzahlKinder == 0 && alter >= sv.pvKinderlosAbAlter) {
    satz += sv.pvKinderlosenzuschlagAn;
  }
  if (anzahlKinderUnter25 >= 2) {
    final abschlaege = min(anzahlKinderUnter25 - 1, sv.pvAbschlagMaxAnzahlKinder);
    satz -= abschlaege * sv.pvAbschlagJeKindAbZweitem;
  }
  return satz;
}

/// Arbeitnehmer-Anteil zur gesetzlichen Krankenversicherung:
/// halber allgemeiner Beitragssatz + halber (kassenindividueller)
/// Zusatzbeitrag (§§ 241, 242 SGB V; paritätische Finanzierung).
double krankenversicherungAnSatz({
  required SocialInsuranceParams sv,
  double? zusatzbeitragSatz,
}) =>
    sv.kvAllgemeinerSatz / 2 + (zusatzbeitragSatz ?? sv.kvZusatzbeitragDurchschnitt) / 2;
