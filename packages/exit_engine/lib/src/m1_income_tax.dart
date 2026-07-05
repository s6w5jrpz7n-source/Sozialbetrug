/// M1 – Einkommensteuer und Lohnsteuer (Steuerjahr 2026).
///
/// * Tarifliche Einkommensteuer nach § 32a Abs. 1 EStG (Grund- und
///   Splittingtarif), Eingabe/Ausgabe in Cent.
/// * Solidaritätszuschlag (§§ 3, 4 SolzG) und Kirchensteuer, jeweils auf
///   einer Bemessungsgrundlage mit Kinderfreibeträgen (§ 51a EStG).
/// * Jahres-Lohnsteuer je Steuerklasse I–VI nach § 39b Abs. 2 EStG mit
///   **vereinfachter** Vorsorgepauschale – gedacht als Netto-Schätzung,
///   nicht als zertifizierte PAP-Implementierung (siehe ASSUMPTIONS.md).
library;

import 'dart:math';

import 'money.dart';
import 'params.dart';
import 'sv_rates.dart';

/// Lohnsteuerklassen I–VI (§ 38b EStG).
enum Steuerklasse { i, ii, iii, iv, v, vi }

/// Tarifliche Einkommensteuer nach § 32a Abs. 1 EStG.
///
/// [zvECents]: zu versteuerndes Einkommen in Cent (negativ wird als 0
/// behandelt). Bei [splitting] wird das Splittingverfahren des
/// § 32a Abs. 5 EStG angewendet (Verdopplung der Steuer auf das halbe zvE).
/// Rückgabe: Jahressteuer in Cent (auf volle Euro abgerundet, § 32a Abs. 1
/// S. 6 EStG).
int einkommensteuer({
  required int zvECents,
  bool splitting = false,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  if (zvECents <= 0) return 0;
  if (splitting) {
    return euroToCents(2 * _tarifEuro(centsToEuroFloor(zvECents ~/ 2), p.tarif));
  }
  return euroToCents(_tarifEuro(centsToEuroFloor(zvECents), p.tarif));
}

/// Grundtarif auf ein zvE in vollen Euro; Ergebnis in vollen Euro
/// (abgerundet).
int _tarifEuro(int x, TaxTariffParams t) {
  if (x <= t.grundfreibetragEuro) return 0;
  final double est;
  if (x <= t.zone2EndeEuro) {
    final y = (x - t.grundfreibetragEuro) / 10000.0;
    est = (t.zone2KoeffQuadratisch * y + t.zone2KoeffLinear) * y;
  } else if (x <= t.zone3EndeEuro) {
    final z = (x - t.zone2EndeEuro) / 10000.0;
    est = (t.zone3KoeffQuadratisch * z + t.zone3KoeffLinear) * z + t.zone3Konstante;
  } else if (x <= t.zone4EndeEuro) {
    est = t.zone4Satz * x - t.zone4AbzugEuro;
  } else {
    est = t.zone5Satz * x - t.zone5AbzugEuro;
  }
  return est.floor();
}

/// Bemessungsgrundlage für Solidaritätszuschlag und Kirchensteuer
/// (§ 51a Abs. 2 EStG): fiktive Einkommensteuer auf das um die
/// Kinderfreibeträge geminderte zvE.
///
/// [kinderfreibetragZaehler] entspricht dem Zähler auf der
/// Lohnsteuerkarte: 1,0 je Kind mit beiden Freibetragshälften
/// (z. B. Steuerklasse III/IV), 0,5 je Kind mit einer Hälfte.
int bemessungsgrundlageZuschlagsteuern({
  required int zvECents,
  double kinderfreibetragZaehler = 0,
  bool splitting = false,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  final freibetrag =
      (kinderfreibetragZaehler * p.kinder.freibetragJeKindBeideElternteileCents).round();
  return einkommensteuer(
    zvECents: max(0, zvECents - freibetrag),
    splitting: splitting,
    params: p,
  );
}

/// Solidaritätszuschlag auf eine (ggf. um Kinderfreibeträge geminderte)
/// Einkommensteuer (§§ 3, 4 SolzG 1995): 5,5 %, aber 0 bis zur Freigrenze
/// und in der Milderungszone höchstens 11,9 % des die Freigrenze
/// übersteigenden Betrags.
///
/// [splitting] wählt die verdoppelte Freigrenze (Zusammenveranlagung bzw.
/// Steuerklasse III im Lohnsteuerabzug).
int solidaritaetszuschlag({
  required int bemessungsgrundlageCents,
  bool splitting = false,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  final freigrenze =
      splitting ? p.soli.freigrenzeSplittingCents : p.soli.freigrenzeGrundtarifCents;
  if (bemessungsgrundlageCents <= freigrenze) return 0;
  final regulaer = anteilFloor(bemessungsgrundlageCents, p.soli.satz);
  final milderung =
      anteilFloor(bemessungsgrundlageCents - freigrenze, p.soli.milderungszoneSatz);
  return min(regulaer, milderung);
}

/// Kirchensteuer auf eine (ggf. um Kinderfreibeträge geminderte)
/// Einkommensteuer: 8 % in Bayern/Baden-Württemberg, sonst 9 %.
int kirchensteuer({
  required int bemessungsgrundlageCents,
  required Bundesland bundesland,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  if (bemessungsgrundlageCents <= 0) return 0;
  return anteilFloor(bemessungsgrundlageCents, p.kirchensteuer.satzFuer(bundesland));
}

/// Vereinfachte Vorsorgepauschale nach § 39b Abs. 2 S. 5 Nr. 3 EStG,
/// bezogen auf den Jahresbruttolohn.
///
/// Teilbeträge (jeweils auf volle Euro aufgerundet, wie im PAP):
/// * Rentenversicherung: AN-Anteil auf den Bruttolohn bis zur BBG RV/AV,
/// * Kranken-/Pflegeversicherung: AN-Anteile bis zur BBG KV/PV, mindestens
///   aber die Mindestvorsorgepauschale (12 % des Lohns, gedeckelt auf
///   1.900 € bzw. 3.000 € in Steuerklasse III).
int vorsorgepauschale({
  required int bruttoJahrCents,
  required Steuerklasse steuerklasse,
  required int alter,
  int anzahlKinder = 0,
  int anzahlKinderUnter25 = 0,
  Bundesland bundesland = Bundesland.nordrheinWestfalen,
  double? kvZusatzbeitragSatz,
  ExitParams? params,
}) {
  final p = params ?? ExitParams.year2026();
  final sv = p.sozialversicherung;
  final basisRv = min(bruttoJahrCents, sv.bbgRvAvJahrCents);
  final basisKvPv = min(bruttoJahrCents, sv.bbgKvPvJahrCents);

  final teilRv = _ceilEuro(basisRv * sv.rvAnAnteil);
  final teilKv =
      _ceilEuro(basisKvPv * krankenversicherungAnSatz(sv: sv, zusatzbeitragSatz: kvZusatzbeitragSatz));
  final teilPv = _ceilEuro(basisKvPv *
      pflegeversicherungAnSatz(
        sv: sv,
        alter: alter,
        anzahlKinder: anzahlKinder,
        anzahlKinderUnter25: anzahlKinderUnter25,
        bundesland: bundesland,
      ));

  final maxMindest = steuerklasse == Steuerklasse.iii
      ? p.lohnsteuer.mindestKvPvMaxStkl3Cents
      : p.lohnsteuer.mindestKvPvMaxCents;
  final mindestKvPv =
      min(_ceilEuro(bruttoJahrCents * p.lohnsteuer.mindestKvPvSatz), maxMindest);

  return teilRv + max(teilKv + teilPv, mindestKvPv);
}

/// Auf volle Euro aufrunden (PAP-Konvention für die Teilbeträge der
/// Vorsorgepauschale), Rückgabe in Cent.
int _ceilEuro(double cents) => (cents / 100).ceil() * 100;

/// Ergebnis der Jahres-Lohnsteuerberechnung (alle Beträge in Cent).
class LohnsteuerErgebnis {
  const LohnsteuerErgebnis({
    required this.bruttoJahrCents,
    required this.zvECents,
    required this.vorsorgepauschaleCents,
    required this.lohnsteuerCents,
    required this.soliCents,
    required this.kirchensteuerCents,
  });

  /// Jahresbruttolohn (Eingabe).
  final int bruttoJahrCents;

  /// Zu versteuernder Jahresbetrag der Lohnsteuerberechnung
  /// (Brutto abzüglich Pauschbeträge und Vorsorgepauschale).
  final int zvECents;

  /// Angesetzte (vereinfachte) Vorsorgepauschale.
  final int vorsorgepauschaleCents;

  /// Jahreslohnsteuer.
  final int lohnsteuerCents;

  /// Solidaritätszuschlag auf die Lohnsteuer (§ 51a: mit Kinderfreibeträgen).
  final int soliCents;

  /// Kirchensteuer auf die Lohnsteuer (§ 51a: mit Kinderfreibeträgen);
  /// 0 ohne Kirchenmitgliedschaft.
  final int kirchensteuerCents;

  /// Summe der steuerlichen Abzüge.
  int get steuerabzugGesamtCents => lohnsteuerCents + soliCents + kirchensteuerCents;
}

/// Jahres-Lohnsteuer nach § 39b Abs. 2 EStG (vereinfacht) als
/// Netto-Schätzung.
///
/// Abzugsreihenfolge: Arbeitnehmer-Pauschbetrag (StKl I–V),
/// Sonderausgaben-Pauschbetrag (StKl I–V), Entlastungsbetrag für
/// Alleinerziehende (StKl II), Vorsorgepauschale. Auf den zu versteuernden
/// Jahresbetrag wird angewandt: Grundtarif (I, II, IV), Splittingtarif
/// (III) bzw. die Formel des § 39b Abs. 2 S. 7 EStG (V, VI).
///
/// [kinderfreibetragZaehler] wirkt nur auf Soli und Kirchensteuer
/// (§ 51a Abs. 2a EStG), nicht auf die Lohnsteuer selbst.
LohnsteuerErgebnis jahresLohnsteuer({
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
  final l = p.lohnsteuer;

  final vp = vorsorgepauschale(
    bruttoJahrCents: bruttoJahrCents,
    steuerklasse: steuerklasse,
    alter: alter,
    anzahlKinder: anzahlKinder,
    anzahlKinderUnter25: anzahlKinderUnter25,
    bundesland: bundesland,
    kvZusatzbeitragSatz: kvZusatzbeitragSatz,
    params: p,
  );

  var abzuege = vp;
  if (steuerklasse != Steuerklasse.vi) {
    abzuege += l.arbeitnehmerPauschbetragCents + l.sonderausgabenPauschbetragCents;
  }
  if (steuerklasse == Steuerklasse.ii) {
    abzuege += l.entlastungsbetragAlleinerziehendeCents;
  }
  final zvE = max(0, bruttoJahrCents - abzuege);

  final lst = _lohnsteuerAufZvE(zvE, steuerklasse, p);

  // Zuschlagsteuern auf Basis der fiktiven Lohnsteuer mit
  // Kinderfreibeträgen (§ 51a Abs. 2a EStG).
  final freibetrag =
      (kinderfreibetragZaehler * p.kinder.freibetragJeKindBeideElternteileCents).round();
  final lstFuerZuschlaege = freibetrag == 0
      ? lst
      : _lohnsteuerAufZvE(max(0, zvE - freibetrag), steuerklasse, p);

  final soli = solidaritaetszuschlag(
    bemessungsgrundlageCents: lstFuerZuschlaege,
    splitting: steuerklasse == Steuerklasse.iii,
    params: p,
  );
  final kist = kirchenmitglied
      ? kirchensteuer(
          bemessungsgrundlageCents: lstFuerZuschlaege,
          bundesland: bundesland,
          params: p,
        )
      : 0;

  return LohnsteuerErgebnis(
    bruttoJahrCents: bruttoJahrCents,
    zvECents: zvE,
    vorsorgepauschaleCents: vp,
    lohnsteuerCents: lst,
    soliCents: soli,
    kirchensteuerCents: kist,
  );
}

int _lohnsteuerAufZvE(int zvECents, Steuerklasse steuerklasse, ExitParams p) {
  switch (steuerklasse) {
    case Steuerklasse.i:
    case Steuerklasse.ii:
    case Steuerklasse.iv:
      return einkommensteuer(zvECents: zvECents, params: p);
    case Steuerklasse.iii:
      return einkommensteuer(zvECents: zvECents, splitting: true, params: p);
    case Steuerklasse.v:
    case Steuerklasse.vi:
      return euroToCents(_lst56Euro(centsToEuroFloor(zvECents), p));
  }
}

/// Lohnsteuer der Steuerklassen V/VI nach § 39b Abs. 2 S. 7 EStG
/// (Eingabe und Ausgabe in vollen Euro).
///
/// Grundformel: das Zweifache des Unterschiedsbetrags zwischen dem
/// Steuerbetrag für das 1,25-fache und das 0,75-fache des zu
/// versteuernden Jahresbetrags; mindestens 14 %. Für den über
/// `grenze1` hinausgehenden Teil höchstens 42 % Grenzbelastung, ab
/// `grenze2` fest 42 %, ab `grenze3` fest 45 % (Umsetzung wie im
/// PAP-Baustein MLST5/6).
int _lst56Euro(int x, ExitParams p) {
  final l = p.lohnsteuer;
  if (x <= 0) return 0;

  if (x > l.stkl56Grenze2Euro) {
    var st = _lst56Basis(l.stkl56Grenze2Euro, p) +
        (x - l.stkl56Grenze2Euro) * p.tarif.zone4Satz;
    if (x > l.stkl56Grenze3Euro) {
      st += (x - l.stkl56Grenze3Euro) * (p.tarif.zone5Satz - p.tarif.zone4Satz);
    }
    return st.floor();
  }
  final basis = _lst56Basis(x, p);
  if (x > l.stkl56Grenze1Euro) {
    final deckel = _lst56Basis(l.stkl56Grenze1Euro, p) +
        (x - l.stkl56Grenze1Euro) * p.tarif.zone4Satz;
    return min(basis, deckel).floor();
  }
  return basis.floor();
}

/// Grundformel des § 39b Abs. 2 S. 7 EStG inkl. Mindestsatz von 14 %.
double _lst56Basis(int x, ExitParams p) {
  final zweifach =
      2.0 * (_tarifEuro((1.25 * x).floor(), p.tarif) - _tarifEuro((0.75 * x).floor(), p.tarif));
  final mindest = x * p.lohnsteuer.stkl56Mindestsatz;
  return max(zweifach, mindest);
}
