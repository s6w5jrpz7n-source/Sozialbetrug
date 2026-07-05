import 'dart:convert';

import 'params_2026_data.dart';

/// Deutsche Bundesländer.
///
/// Relevanz für die Engine: Kirchensteuersatz (8 % in BW/BY, sonst 9 %)
/// und der abweichende Arbeitnehmer-Anteil zur Pflegeversicherung in
/// Sachsen.
enum Bundesland {
  badenWuerttemberg('BW'),
  bayern('BY'),
  berlin('BE'),
  brandenburg('BB'),
  bremen('HB'),
  hamburg('HH'),
  hessen('HE'),
  mecklenburgVorpommern('MV'),
  niedersachsen('NI'),
  nordrheinWestfalen('NW'),
  rheinlandPfalz('RP'),
  saarland('SL'),
  sachsen('SN'),
  sachsenAnhalt('ST'),
  schleswigHolstein('SH'),
  thueringen('TH');

  const Bundesland(this.code);

  /// Zweibuchstabiger Ländercode wie in `params_2026.json`.
  final String code;

  static Bundesland fromCode(String code) => values.firstWhere(
        (b) => b.code == code.toUpperCase(),
        orElse: () => throw ArgumentError.value(code, 'code', 'Unbekannter Bundesland-Code'),
      );
}

Map<String, dynamic> _map(Object? v) => (v as Map).cast<String, dynamic>();

double _rate(Object? v) => (v as num).toDouble();

int _int(Object? v) => (v as num).toInt();

/// Euro-Wert aus dem JSON in Cent umrechnen.
int _euroToCents(Object? v) => ((v as num) * 100).round();

/// Tarifparameter des § 32a Abs. 1 EStG (Grenzen in Euro wie im Gesetz,
/// da die Tarifformel auf volle Euro abgerundete zvE-Beträge verlangt).
class TaxTariffParams {
  const TaxTariffParams({
    required this.grundfreibetragEuro,
    required this.zone2EndeEuro,
    required this.zone3EndeEuro,
    required this.zone4EndeEuro,
    required this.zone2KoeffQuadratisch,
    required this.zone2KoeffLinear,
    required this.zone3KoeffQuadratisch,
    required this.zone3KoeffLinear,
    required this.zone3Konstante,
    required this.zone4Satz,
    required this.zone4AbzugEuro,
    required this.zone5Satz,
    required this.zone5AbzugEuro,
  });

  factory TaxTariffParams.fromJson(Map<String, dynamic> json) => TaxTariffParams(
        grundfreibetragEuro: _int(json['grundfreibetrag_euro']),
        zone2EndeEuro: _int(json['zone2_ende_euro']),
        zone3EndeEuro: _int(json['zone3_ende_euro']),
        zone4EndeEuro: _int(json['zone4_ende_euro']),
        zone2KoeffQuadratisch: _rate(json['zone2_koeff_quadratisch']),
        zone2KoeffLinear: _rate(json['zone2_koeff_linear']),
        zone3KoeffQuadratisch: _rate(json['zone3_koeff_quadratisch']),
        zone3KoeffLinear: _rate(json['zone3_koeff_linear']),
        zone3Konstante: _rate(json['zone3_konstante']),
        zone4Satz: _rate(json['zone4_satz']),
        zone4AbzugEuro: _rate(json['zone4_abzug_euro']),
        zone5Satz: _rate(json['zone5_satz']),
        zone5AbzugEuro: _rate(json['zone5_abzug_euro']),
      );

  final int grundfreibetragEuro;
  final int zone2EndeEuro;
  final int zone3EndeEuro;
  final int zone4EndeEuro;
  final double zone2KoeffQuadratisch;
  final double zone2KoeffLinear;
  final double zone3KoeffQuadratisch;
  final double zone3KoeffLinear;
  final double zone3Konstante;
  final double zone4Satz;
  final double zone4AbzugEuro;
  final double zone5Satz;
  final double zone5AbzugEuro;
}

/// Parameter des Lohnsteuerabzugs (§ 39b EStG, PAP 2026).
class PayrollTaxParams {
  const PayrollTaxParams({
    required this.arbeitnehmerPauschbetragCents,
    required this.sonderausgabenPauschbetragCents,
    required this.entlastungsbetragAlleinerziehendeCents,
    required this.stkl56Mindestsatz,
    required this.stkl56Grenze1Euro,
    required this.stkl56Grenze2Euro,
    required this.stkl56Grenze3Euro,
    required this.mindestKvPvSatz,
    required this.mindestKvPvMaxCents,
    required this.mindestKvPvMaxStkl3Cents,
  });

  factory PayrollTaxParams.fromJson(Map<String, dynamic> json) {
    final vp = _map(json['vorsorgepauschale']);
    return PayrollTaxParams(
      arbeitnehmerPauschbetragCents: _euroToCents(json['arbeitnehmer_pauschbetrag_euro']),
      sonderausgabenPauschbetragCents: _euroToCents(json['sonderausgaben_pauschbetrag_euro']),
      entlastungsbetragAlleinerziehendeCents:
          _euroToCents(json['entlastungsbetrag_alleinerziehende_euro']),
      stkl56Mindestsatz: _rate(json['stkl5_6_mindestsatz']),
      stkl56Grenze1Euro: _int(json['stkl5_6_grenze1_euro']),
      stkl56Grenze2Euro: _int(json['stkl5_6_grenze2_euro']),
      stkl56Grenze3Euro: _int(json['stkl5_6_grenze3_euro']),
      mindestKvPvSatz: _rate(vp['mindest_kvpv_satz']),
      mindestKvPvMaxCents: _euroToCents(vp['mindest_kvpv_max_euro']),
      mindestKvPvMaxStkl3Cents: _euroToCents(vp['mindest_kvpv_max_stkl3_euro']),
    );
  }

  final int arbeitnehmerPauschbetragCents;
  final int sonderausgabenPauschbetragCents;
  final int entlastungsbetragAlleinerziehendeCents;
  final double stkl56Mindestsatz;
  final int stkl56Grenze1Euro;
  final int stkl56Grenze2Euro;
  final int stkl56Grenze3Euro;
  final double mindestKvPvSatz;
  final int mindestKvPvMaxCents;
  final int mindestKvPvMaxStkl3Cents;
}

/// Kinderfreibeträge und Kindergeld (§ 32 Abs. 6, § 66 EStG).
class KinderParams {
  const KinderParams({
    required this.kinderfreibetragJeElternteilCents,
    required this.beaFreibetragJeElternteilCents,
    required this.freibetragJeKindBeideElternteileCents,
    required this.kindergeldMonatCents,
  });

  factory KinderParams.fromJson(Map<String, dynamic> json) => KinderParams(
        kinderfreibetragJeElternteilCents:
            _euroToCents(json['kinderfreibetrag_je_elternteil_euro']),
        beaFreibetragJeElternteilCents: _euroToCents(json['bea_freibetrag_je_elternteil_euro']),
        freibetragJeKindBeideElternteileCents:
            _euroToCents(json['freibetrag_je_kind_beide_elternteile_euro']),
        kindergeldMonatCents: _euroToCents(json['kindergeld_monat_euro']),
      );

  final int kinderfreibetragJeElternteilCents;
  final int beaFreibetragJeElternteilCents;
  final int freibetragJeKindBeideElternteileCents;
  final int kindergeldMonatCents;
}

/// Solidaritätszuschlag (§§ 3, 4 SolzG 1995).
class SoliParams {
  const SoliParams({
    required this.satz,
    required this.freigrenzeGrundtarifCents,
    required this.freigrenzeSplittingCents,
    required this.milderungszoneSatz,
  });

  factory SoliParams.fromJson(Map<String, dynamic> json) => SoliParams(
        satz: _rate(json['satz']),
        freigrenzeGrundtarifCents: _euroToCents(json['freigrenze_grundtarif_euro']),
        freigrenzeSplittingCents: _euroToCents(json['freigrenze_splitting_euro']),
        milderungszoneSatz: _rate(json['milderungszone_satz']),
      );

  final double satz;
  final int freigrenzeGrundtarifCents;
  final int freigrenzeSplittingCents;
  final double milderungszoneSatz;
}

/// Kirchensteuersätze je Bundesland.
class ChurchTaxParams {
  const ChurchTaxParams({required this.saetzeJeBundesland});

  factory ChurchTaxParams.fromJson(Map<String, dynamic> json) {
    final raw = _map(json['saetze_je_bundesland']);
    return ChurchTaxParams(
      saetzeJeBundesland: {
        for (final entry in raw.entries) Bundesland.fromCode(entry.key): _rate(entry.value),
      },
    );
  }

  final Map<Bundesland, double> saetzeJeBundesland;

  double satzFuer(Bundesland land) => saetzeJeBundesland[land]!;
}

/// Beitragssätze und Bemessungsgrenzen der Sozialversicherung 2026.
class SocialInsuranceParams {
  const SocialInsuranceParams({
    required this.bbgKvPvJahrCents,
    required this.bbgRvAvJahrCents,
    required this.versicherungspflichtgrenzeJahrCents,
    required this.kvAllgemeinerSatz,
    required this.kvErmaessigterSatz,
    required this.kvZusatzbeitragDurchschnitt,
    required this.pvSatzGesamt,
    required this.pvAnAnteilNormal,
    required this.pvAnAnteilSachsen,
    required this.pvKinderlosenzuschlagAn,
    required this.pvKinderlosAbAlter,
    required this.pvAbschlagJeKindAbZweitem,
    required this.pvAbschlagMaxAnzahlKinder,
    required this.rvSatz,
    required this.rvAnAnteil,
    required this.avSatz,
    required this.avAnAnteil,
  });

  factory SocialInsuranceParams.fromJson(Map<String, dynamic> json) => SocialInsuranceParams(
        bbgKvPvJahrCents: _euroToCents(json['bbg_kv_pv_jahr_euro']),
        bbgRvAvJahrCents: _euroToCents(json['bbg_rv_av_jahr_euro']),
        versicherungspflichtgrenzeJahrCents:
            _euroToCents(json['versicherungspflichtgrenze_jahr_euro']),
        kvAllgemeinerSatz: _rate(json['kv_allgemeiner_satz']),
        kvErmaessigterSatz: _rate(json['kv_ermaessigter_satz']),
        kvZusatzbeitragDurchschnitt: _rate(json['kv_zusatzbeitrag_durchschnitt']),
        pvSatzGesamt: _rate(json['pv_satz_gesamt']),
        pvAnAnteilNormal: _rate(json['pv_an_anteil_normal']),
        pvAnAnteilSachsen: _rate(json['pv_an_anteil_sachsen']),
        pvKinderlosenzuschlagAn: _rate(json['pv_kinderlosenzuschlag_an']),
        pvKinderlosAbAlter: _int(json['pv_kinderlos_ab_alter']),
        pvAbschlagJeKindAbZweitem: _rate(json['pv_abschlag_je_kind_ab_zweitem']),
        pvAbschlagMaxAnzahlKinder: _int(json['pv_abschlag_max_anzahl_kinder']),
        rvSatz: _rate(json['rv_satz']),
        rvAnAnteil: _rate(json['rv_an_anteil']),
        avSatz: _rate(json['av_satz']),
        avAnAnteil: _rate(json['av_an_anteil']),
      );

  final int bbgKvPvJahrCents;
  final int bbgRvAvJahrCents;
  final int versicherungspflichtgrenzeJahrCents;
  final double kvAllgemeinerSatz;
  final double kvErmaessigterSatz;
  final double kvZusatzbeitragDurchschnitt;
  final double pvSatzGesamt;
  final double pvAnAnteilNormal;
  final double pvAnAnteilSachsen;
  final double pvKinderlosenzuschlagAn;
  final int pvKinderlosAbAlter;
  final double pvAbschlagJeKindAbZweitem;
  final int pvAbschlagMaxAnzahlKinder;
  final double rvSatz;
  final double rvAnAnteil;
  final double avSatz;
  final double avAnAnteil;
}

/// Eine Zeile der Anspruchsdauer-Tabelle des § 147 Abs. 2 SGB III.
class AlgAnspruchsdauerZeile {
  const AlgAnspruchsdauerZeile({
    required this.versicherungsmonateMin,
    required this.mindestalter,
    required this.anspruchTage,
  });

  factory AlgAnspruchsdauerZeile.fromJson(Map<String, dynamic> json) => AlgAnspruchsdauerZeile(
        versicherungsmonateMin: _int(json['versicherungsmonate_min']),
        mindestalter: _int(json['mindestalter']),
        anspruchTage: _int(json['anspruch_tage']),
      );

  final int versicherungsmonateMin;
  final int mindestalter;
  final int anspruchTage;
}

/// Parameter des Ruhens bei Entlassungsentschädigung (§ 158 SGB III).
class Ruhen158Params {
  const Ruhen158Params({
    required this.anteilBasis,
    required this.minderungJe5JahreBetriebszugehoerigkeit,
    required this.minderungJe5LebensjahreUeber,
    required this.minderungJe5LebensjahreSatz,
    required this.anteilMinimum,
    required this.maxRuhenTage,
  });

  factory Ruhen158Params.fromJson(Map<String, dynamic> json) => Ruhen158Params(
        anteilBasis: _rate(json['anteil_basis']),
        minderungJe5JahreBetriebszugehoerigkeit:
            _rate(json['minderung_je_5_jahre_betriebszugehoerigkeit']),
        minderungJe5LebensjahreUeber: _int(json['minderung_je_5_lebensjahre_ueber']),
        minderungJe5LebensjahreSatz: _rate(json['minderung_je_5_lebensjahre_satz']),
        anteilMinimum: _rate(json['anteil_minimum']),
        maxRuhenTage: _int(json['max_ruhen_tage']),
      );

  final double anteilBasis;
  final double minderungJe5JahreBetriebszugehoerigkeit;
  final int minderungJe5LebensjahreUeber;
  final double minderungJe5LebensjahreSatz;
  final double anteilMinimum;
  final int maxRuhenTage;
}

/// Parameter des ALG 1 (SGB III).
class Alg1Params {
  const Alg1Params({
    required this.leistungssatzAllgemein,
    required this.leistungssatzErhoeht,
    required this.svPauschale,
    required this.tageJeMonat,
    required this.tageJeJahr,
    required this.anspruchsdauerTabelle,
    required this.sperrzeitArbeitsaufgabeWochen,
    required this.sperrzeitMinderungAnteilMindestens,
    required this.ruhen158,
  });

  factory Alg1Params.fromJson(Map<String, dynamic> json) => Alg1Params(
        leistungssatzAllgemein: _rate(json['leistungssatz_allgemein']),
        leistungssatzErhoeht: _rate(json['leistungssatz_erhoeht']),
        svPauschale: _rate(json['sv_pauschale']),
        tageJeMonat: _int(json['tage_je_monat']),
        tageJeJahr: _int(json['tage_je_jahr']),
        anspruchsdauerTabelle: [
          for (final row in json['anspruchsdauer_tabelle'] as List)
            AlgAnspruchsdauerZeile.fromJson(_map(row)),
        ],
        sperrzeitArbeitsaufgabeWochen: _int(json['sperrzeit_arbeitsaufgabe_wochen']),
        sperrzeitMinderungAnteilMindestens: _rate(json['sperrzeit_minderung_anteil_mindestens']),
        ruhen158: Ruhen158Params.fromJson(_map(json['ruhen_158'])),
      );

  final double leistungssatzAllgemein;
  final double leistungssatzErhoeht;
  final double svPauschale;
  final int tageJeMonat;
  final int tageJeJahr;
  final List<AlgAnspruchsdauerZeile> anspruchsdauerTabelle;
  final int sperrzeitArbeitsaufgabeWochen;
  final double sperrzeitMinderungAnteilMindestens;
  final Ruhen158Params ruhen158;
}

/// Gesamter Parametersatz der Engine für ein Steuer-/Beitragsjahr.
class ExitParams {
  const ExitParams({
    required this.jahr,
    required this.tarif,
    required this.lohnsteuer,
    required this.kinder,
    required this.soli,
    required this.kirchensteuer,
    required this.sozialversicherung,
    required this.alg1,
  });

  factory ExitParams.fromJson(Map<String, dynamic> json) => ExitParams(
        jahr: _int(_map(json['_meta'])['jahr']),
        tarif: TaxTariffParams.fromJson(_map(json['einkommensteuer_32a'])),
        lohnsteuer: PayrollTaxParams.fromJson(_map(json['lohnsteuer_39b'])),
        kinder: KinderParams.fromJson(_map(json['kinder'])),
        soli: SoliParams.fromJson(_map(json['solidaritaetszuschlag'])),
        kirchensteuer: ChurchTaxParams.fromJson(_map(json['kirchensteuer'])),
        sozialversicherung: SocialInsuranceParams.fromJson(_map(json['sozialversicherung'])),
        alg1: Alg1Params.fromJson(_map(json['alg1'])),
      );

  factory ExitParams.fromJsonString(String jsonString) =>
      ExitParams.fromJson((jsonDecode(jsonString) as Map).cast<String, dynamic>());

  /// Parametersatz 2026 aus der eingebetteten Kopie von
  /// `assets/params_2026.json`.
  factory ExitParams.year2026() => _params2026 ??= ExitParams.fromJsonString(params2026Json);

  static ExitParams? _params2026;

  final int jahr;
  final TaxTariffParams tarif;
  final PayrollTaxParams lohnsteuer;
  final KinderParams kinder;
  final SoliParams soli;
  final ChurchTaxParams kirchensteuer;
  final SocialInsuranceParams sozialversicherung;
  final Alg1Params alg1;
}
