/// M4 – Arbeitslosengeld 1 (SGB III).
///
/// * Bemessungsentgelt aus dem beitragspflichtigen Jahresbrutto,
///   gedeckelt an der BBG RV/AV (§§ 151, 152 SGB III),
/// * pauschaliertes Leistungsentgelt: Abzug von 20 % SV-Pauschale,
///   fiktiver Lohnsteuer und Soli (§ 153 SGB III),
/// * Leistungssatz 60 % / 67 % mit Kind (§ 149 SGB III),
/// * Monatsbetrag = 30 Tagessätze (§ 154 SGB III),
/// * Anspruchsdauer nach Alter und Vorversicherungszeit (§ 147 SGB III),
/// * Sperrzeit bei Arbeitsaufgabe: 12 Wochen + Minderung der
///   Anspruchsdauer um mindestens ein Viertel (§ 159, § 148 Abs. 1 Nr. 4),
/// * Ruhen bei Entlassungsentschädigung und verkürzter Kündigungsfrist
///   (§ 158 SGB III).
library;

import 'dart:math';

import 'm1_income_tax.dart';
import 'money.dart';
import 'params.dart';

/// Bemessung des monatlichen ALG 1 (alle Beträge in Cent).
class Alg1Bemessung {
  const Alg1Bemessung({
    required this.bemessungsentgeltJahrCents,
    required this.bemessungsentgeltTagCents,
    required this.svPauschaleJahrCents,
    required this.lohnsteuerJahrCents,
    required this.soliJahrCents,
    required this.leistungsentgeltTagCents,
    required this.leistungssatz,
    required this.algTagCents,
  });

  /// Gedeckeltes beitragspflichtiges Jahresentgelt (Bemessungsgrundlage).
  final int bemessungsentgeltJahrCents;

  /// Tägliches Bemessungsentgelt (Jahresentgelt / 365).
  final int bemessungsentgeltTagCents;

  /// Sozialversicherungspauschale: 20 % des Bemessungsentgelts (Jahr).
  final int svPauschaleJahrCents;

  /// Fiktive Jahres-Lohnsteuer auf das Bemessungsentgelt.
  final int lohnsteuerJahrCents;

  /// Fiktiver Soli auf die Lohnsteuer.
  final int soliJahrCents;

  /// Pauschaliertes Nettoentgelt je Tag (Leistungsentgelt, § 153 SGB III).
  final int leistungsentgeltTagCents;

  /// 0,60 (allgemein) oder 0,67 (mit Kind).
  final double leistungssatz;

  /// Täglicher Leistungssatz des ALG 1.
  final int algTagCents;

  /// Monatsbetrag: 30 Tagessätze (§ 154 SGB III).
  int get algMonatCents => 30 * algTagCents;
}

/// Berechnet den ALG-1-Tages- und Monatsbetrag.
///
/// [bruttoJahrCents]: beitragspflichtiges Arbeitsentgelt der letzten
/// 12 Monate (Bemessungszeitraum). Die Steuerklassen-/Kinder-Parameter
/// steuern die fiktive Lohnsteuer nach § 153 SGB III;
/// [mindestensEinKind] schaltet den erhöhten Leistungssatz von 67 %.
Alg1Bemessung alg1Bemessung({
  required int bruttoJahrCents,
  required Steuerklasse steuerklasse,
  required int alter,
  bool mindestensEinKind = false,
  double kinderfreibetragZaehler = 0,
  int anzahlKinder = 0,
  int anzahlKinderUnter25 = 0,
  Bundesland bundesland = Bundesland.nordrheinWestfalen,
  double? kvZusatzbeitragSatz,
  ExitParams? params,
}) {
  assert(bruttoJahrCents >= 0);
  final p = params ?? ExitParams.year2026();
  final a = p.alg1;

  // §§ 151/152: Bemessungsentgelt, gedeckelt an der BBG RV/AV.
  final beJahr = min(bruttoJahrCents, p.sozialversicherung.bbgRvAvJahrCents);
  final beTag = beJahr ~/ a.tageJeJahr;

  // § 153 Abs. 1: Abzüge vom Bemessungsentgelt.
  final svPauschale = anteilFloor(beJahr, a.svPauschale);
  final steuern = jahresLohnsteuer(
    bruttoJahrCents: beJahr,
    steuerklasse: steuerklasse,
    alter: alter,
    kinderfreibetragZaehler: kinderfreibetragZaehler,
    anzahlKinder: anzahlKinder,
    anzahlKinderUnter25: anzahlKinderUnter25,
    // Kirchensteuer wird seit 2005 nicht mehr abgezogen (§ 153 SGB III).
    kirchenmitglied: false,
    bundesland: bundesland,
    kvZusatzbeitragSatz: kvZusatzbeitragSatz,
    params: p,
  );

  final leistungsentgeltJahr =
      max(0, beJahr - svPauschale - steuern.lohnsteuerCents - steuern.soliCents);
  final leTag = leistungsentgeltJahr ~/ a.tageJeJahr;

  final satz = mindestensEinKind ? a.leistungssatzErhoeht : a.leistungssatzAllgemein;
  final algTag = anteilFloor(leTag, satz);

  return Alg1Bemessung(
    bemessungsentgeltJahrCents: beJahr,
    bemessungsentgeltTagCents: beTag,
    svPauschaleJahrCents: svPauschale,
    lohnsteuerJahrCents: steuern.lohnsteuerCents,
    soliJahrCents: steuern.soliCents,
    leistungsentgeltTagCents: leTag,
    leistungssatz: satz,
    algTagCents: algTag,
  );
}

/// Anspruchsdauer in Leistungstagen nach § 147 Abs. 2 SGB III
/// (30 Tage = 1 Monat).
///
/// [versicherungsmonate]: Monate mit Versicherungspflicht innerhalb der
/// auf 5 Jahre erweiterten Rahmenfrist. Rückgabe 0, wenn die
/// Anwartschaftszeit von 12 Monaten nicht erfüllt ist.
int alg1AnspruchsdauerTage({
  required int versicherungsmonate,
  required int alter,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  var tage = 0;
  for (final zeile in p.alg1.anspruchsdauerTabelle) {
    if (versicherungsmonate >= zeile.versicherungsmonateMin &&
        alter >= zeile.mindestalter) {
      tage = max(tage, zeile.anspruchTage);
    }
  }
  return tage;
}

/// Auswirkungen einer Sperrzeit wegen Arbeitsaufgabe (§ 159 Abs. 1 S. 2
/// Nr. 1 SGB III), z. B. bei Eigenkündigung oder Aufhebungsvertrag ohne
/// wichtigen Grund.
class SperrzeitErgebnis {
  const SperrzeitErgebnis({
    required this.sperrzeitTage,
    required this.minderungTage,
    required this.anspruchVorherTage,
    required this.algTagCents,
  });

  /// Dauer der Sperrzeit (Regelfall 12 Wochen = 84 Tage); in dieser Zeit
  /// wird kein ALG gezahlt, der Leistungsbeginn verschiebt sich.
  final int sperrzeitTage;

  /// Minderung der Anspruchsdauer: Tage der Sperrzeit, bei einer
  /// 12-Wochen-Sperrzeit mindestens ein Viertel der Anspruchsdauer
  /// (§ 148 Abs. 1 Nr. 4 SGB III).
  final int minderungTage;

  /// Ursprüngliche Anspruchsdauer.
  final int anspruchVorherTage;

  /// Täglicher Leistungssatz (zur Bewertung des Verlusts).
  final int algTagCents;

  /// Verbleibende Anspruchsdauer nach Minderung.
  int get verbleibendeAnspruchTage => max(0, anspruchVorherTage - minderungTage);

  /// Endgültig verlorenes ALG durch die Minderung der Anspruchsdauer.
  int get verlorenesAlgCents => min(minderungTage, anspruchVorherTage) * algTagCents;
}

/// Simuliert eine 12-Wochen-Sperrzeit wegen Arbeitsaufgabe.
SperrzeitErgebnis sperrzeitSimulation({
  required int anspruchTage,
  required int algTagCents,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  final a = p.alg1;
  final sperrzeitTage = a.sperrzeitArbeitsaufgabeWochen * 7;
  final viertel = anteilFloor(anspruchTage, a.sperrzeitMinderungAnteilMindestens);
  return SperrzeitErgebnis(
    sperrzeitTage: sperrzeitTage,
    minderungTage: max(sperrzeitTage, viertel),
    anspruchVorherTage: anspruchTage,
    algTagCents: algTagCents,
  );
}

/// Ruhen des Anspruchs bei Entlassungsentschädigung (§ 158 SGB III).
class Ruhen158Ergebnis {
  const Ruhen158Ergebnis({
    required this.massgeblicherAnteil,
    required this.anteilAbfindungCents,
    required this.ruhenTageUngedeckelt,
    required this.ruhenTage,
  });

  /// Zu berücksichtigender Anteil der Abfindung (0,25–0,60).
  final double massgeblicherAnteil;

  /// Anteiliger Abfindungsbetrag, der als Arbeitsentgelt gilt.
  final int anteilAbfindungCents;

  /// Ruhenstage allein aus dem Abfindungsanteil (vor Deckelung).
  final int ruhenTageUngedeckelt;

  /// Effektive Ruhenstage nach allen Deckelungen (Kündigungsfrist,
  /// 1 Jahr, Abfindungsverbrauch). Während des Ruhens wird kein ALG
  /// gezahlt; die Anspruchsdauer bleibt aber erhalten (kein § 148).
  final int ruhenTage;
}

/// Prüft das Ruhen nach § 158 SGB III: Das Arbeitsverhältnis wurde ohne
/// Einhaltung der ordentlichen Kündigungsfrist beendet und der
/// Arbeitnehmer erhält eine Abfindung.
///
/// [fehlendeKuendigungsfristTage]: Tage zwischen tatsächlichem
/// Beschäftigungsende und dem Tag, an dem die ordentliche
/// Kündigungsfrist geendet hätte (0 = Frist eingehalten, kein Ruhen).
/// [kalendertagEntgeltCents]: zuletzt verdientes Arbeitsentgelt je
/// Kalendertag (ungedeckeltes Jahresbrutto / 365).
Ruhen158Ergebnis ruhen158({
  required int abfindungCents,
  required int alter,
  required int betriebszugehoerigkeitJahre,
  required int kalendertagEntgeltCents,
  required int fehlendeKuendigungsfristTage,
  ExitParams? params,
}) {
  assert(abfindungCents >= 0);
  assert(kalendertagEntgeltCents > 0);
  final p = params ?? ExitParams.year2026();
  final r = p.alg1.ruhen158;

  // Ganzzahlige Prozentpunkte, damit z. B. 60 % − 2×5 % − 1×5 % exakt
  // 45 % ergibt (keine Gleitkomma-Drift).
  var anteilPct = (r.anteilBasis * 100).round() -
      (betriebszugehoerigkeitJahre ~/ 5) *
          (r.minderungJe5JahreBetriebszugehoerigkeit * 100).round() -
      (max(0, alter - r.minderungJe5LebensjahreUeber) ~/ 5) *
          (r.minderungJe5LebensjahreSatz * 100).round();
  anteilPct = max(anteilPct, (r.anteilMinimum * 100).round());

  final anteilAbfindung = (abfindungCents * anteilPct) ~/ 100;
  final tageAusAbfindung = anteilAbfindung ~/ kalendertagEntgeltCents;

  final ruhenTage = [
    tageAusAbfindung,
    max(0, fehlendeKuendigungsfristTage),
    r.maxRuhenTage,
  ].reduce(min);

  return Ruhen158Ergebnis(
    massgeblicherAnteil: anteilPct / 100,
    anteilAbfindungCents: anteilAbfindung,
    ruhenTageUngedeckelt: tageAusAbfindung,
    ruhenTage: fehlendeKuendigungsfristTage <= 0 ? 0 : ruhenTage,
  );
}
