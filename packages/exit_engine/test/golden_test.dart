/// Golden-Cases: acht Gesamtprofile durch alle Module (M1–M4).
///
/// Die Erwartungswerte stammen aus der eigenen Engine-Berechnung
/// (Regression-Pins) und sind noch NICHT extern verifiziert – daher das
/// Tag `unverified`. Der manuelle Abgleich gegen den
/// BMF-Lohn- und Einkommensteuerrechner sowie den ALG-Rechner der
/// Bundesagentur für Arbeit ist in `VERIFY.md` beschrieben; nach
/// bestätigtem Abgleich wird das Tag entfernt.
@Tags(['unverified'])
library;

import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

int eur(int euro) => euro * 100;

void main() {
  group('Golden G1 – 60.000 €, StKl I, kinderlos, 30 J, keine Kirche (NW)', () {
    final netto = nettoJahr(
      bruttoJahrCents: eur(60000),
      steuerklasse: Steuerklasse.i,
      alter: 30,
    );

    test('Steuern und Sozialversicherung', () {
      expect(netto.steuern.zvECents, 4646400);
      expect(netto.steuern.vorsorgepauschaleCents, 1227000);
      expect(netto.steuern.lohnsteuerCents, 932800);
      expect(netto.steuern.soliCents, 0);
      expect(netto.steuern.kirchensteuerCents, 0);
      expect(netto.sozialversicherung.kvCents, 525000);
      expect(netto.sozialversicherung.pvCents, 144000);
      expect(netto.sozialversicherung.rvCents, 558000);
      expect(netto.sozialversicherung.avCents, 78000);
    });

    test('Netto', () {
      expect(netto.nettoJahrCents, 3762200);
      expect(netto.nettoMonatCents, 313517);
    });

    test('ALG 1 (24 Versicherungsmonate)', () {
      final alg = alg1Bemessung(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.i,
        alter: 30,
      );
      expect(alg.bemessungsentgeltTagCents, 16438);
      expect(alg.leistungsentgeltTagCents, 10595);
      expect(alg.algTagCents, 6357);
      expect(alg.algMonatCents, 190710);
      expect(alg1AnspruchsdauerTage(versicherungsmonate: 24, alter: 30), 360);
    });
  });

  group('Golden G2 – 90.000 €, StKl III, 1 Kind, Kirche 9 % (NW), 40 J', () {
    final netto = nettoJahr(
      bruttoJahrCents: eur(90000),
      steuerklasse: Steuerklasse.iii,
      alter: 40,
      kinderfreibetragZaehler: 1,
      anzahlKinder: 1,
      anzahlKinderUnter25: 1,
      kirchenmitglied: true,
    );

    test('Steuern und Sozialversicherung', () {
      expect(netto.steuern.zvECents, 7300400);
      expect(netto.steuern.vorsorgepauschaleCents, 1573000);
      expect(netto.steuern.lohnsteuerCents, 1224600);
      expect(netto.steuern.soliCents, 0,
          reason: 'Bemessungsgrundlage unter der verdoppelten Freigrenze');
      expect(netto.steuern.kirchensteuerCents, 84222);
      expect(netto.sozialversicherung.kvCents, 610313, reason: 'KV an der BBG gedeckelt');
      expect(netto.sozialversicherung.pvCents, 125550, reason: 'PV 1,8 %, 1 Kind');
      expect(netto.sozialversicherung.rvCents, 837000);
      expect(netto.sozialversicherung.avCents, 117000);
    });

    test('Netto', () {
      expect(netto.nettoJahrCents, 6001315);
      expect(netto.nettoMonatCents, 500110);
    });

    test('ALG 1 mit erhöhtem Leistungssatz 67 %', () {
      final alg = alg1Bemessung(
        bruttoJahrCents: eur(90000),
        steuerklasse: Steuerklasse.iii,
        alter: 40,
        mindestensEinKind: true,
        kinderfreibetragZaehler: 1,
        anzahlKinder: 1,
        anzahlKinderUnter25: 1,
      );
      expect(alg.leistungsentgeltTagCents, 16370);
      expect(alg.algTagCents, 10967);
      expect(alg.algMonatCents, 329010);
    });
  });

  group('Golden G3 – 130.000 €, StKl I, kinderlos, 45 J (über beiden BBGs)', () {
    final netto = nettoJahr(
      bruttoJahrCents: eur(130000),
      steuerklasse: Steuerklasse.i,
      alter: 45,
    );

    test('Steuern und Sozialversicherung', () {
      expect(netto.steuern.zvECents, 11152500);
      expect(netto.steuern.vorsorgepauschaleCents, 1720900);
      expect(netto.steuern.lohnsteuerCents, 3570400);
      expect(netto.steuern.soliCents, 182712, reason: 'Milderungszone greift noch');
      expect(netto.sozialversicherung.kvCents, 610313);
      expect(netto.sozialversicherung.pvCents, 167400);
      expect(netto.sozialversicherung.rvCents, 943020, reason: 'RV an der BBG gedeckelt');
      expect(netto.sozialversicherung.avCents, 131820);
    });

    test('Netto', () {
      expect(netto.nettoJahrCents, 7394335);
      expect(netto.nettoMonatCents, 616195);
    });

    test('ALG 1: Bemessungsentgelt an der BBG gedeckelt → Höchst-ALG', () {
      final alg = alg1Bemessung(
        bruttoJahrCents: eur(130000),
        steuerklasse: Steuerklasse.i,
        alter: 45,
      );
      expect(alg.bemessungsentgeltJahrCents, eur(101400));
      expect(alg.lohnsteuerJahrCents, 2369200);
      expect(alg.soliJahrCents, 39769);
      expect(alg.leistungsentgeltTagCents, 15624);
      expect(alg.algTagCents, 9374);
      expect(alg.algMonatCents, 281220);
    });
  });

  group('Golden G4 – 75.000 €, StKl IV, 2 Kinder, keine Kirche, 38 J', () {
    final netto = nettoJahr(
      bruttoJahrCents: eur(75000),
      steuerklasse: Steuerklasse.iv,
      alter: 38,
      kinderfreibetragZaehler: 2,
      anzahlKinder: 2,
      anzahlKinderUnter25: 2,
    );

    test('Steuern und Sozialversicherung', () {
      expect(netto.steuern.zvECents, 5957300);
      expect(netto.steuern.vorsorgepauschaleCents, 1416100);
      expect(netto.steuern.lohnsteuerCents, 1406800);
      expect(netto.steuern.soliCents, 0, reason: 'mit 2 Kinderfreibeträgen unter der Freigrenze');
      expect(netto.sozialversicherung.pvCents, 108113,
          reason: 'PV 1,55 % (Abschlag für das 2. Kind), an der BBG gedeckelt');
      expect(netto.sozialversicherung.gesamtCents, 1513426);
    });

    test('Netto', () {
      expect(netto.nettoJahrCents, 4579774);
      expect(netto.nettoMonatCents, 381648);
    });
  });

  group('Golden G5 – 45.000 €, StKl V, 2 Kinder, Kirche 8 % (BY), 35 J', () {
    final netto = nettoJahr(
      bruttoJahrCents: eur(45000),
      steuerklasse: Steuerklasse.v,
      alter: 35,
      kinderfreibetragZaehler: 2,
      anzahlKinder: 2,
      anzahlKinderUnter25: 2,
      kirchenmitglied: true,
      bundesland: Bundesland.bayern,
    );

    test('Steuern und Sozialversicherung', () {
      expect(netto.steuern.zvECents, 3491300);
      expect(netto.steuern.vorsorgepauschaleCents, 882100);
      expect(netto.steuern.lohnsteuerCents, 1043800, reason: '§ 39b Abs. 2 S. 7 (StKl V)');
      expect(netto.steuern.soliCents, 0);
      expect(netto.steuern.kirchensteuerCents, 20224,
          reason: '8 % auf die fiktive LSt mit 2 Kinderfreibeträgen');
      expect(netto.sozialversicherung.gesamtCents, 940500);
    });

    test('Netto', () {
      expect(netto.nettoJahrCents, 2495476);
      expect(netto.nettoMonatCents, 207956);
    });
  });

  group('Golden G6 – Abfindung: 55.000 € Rest-zvE + 60.000 € Abfindung, ledig', () {
    final r = abfindungVergleich(
      zvEOhneAbfindungCents: eur(55000),
      abfindungCents: eur(60000),
    );

    test('beide Steuervarianten und Ersparnis', () {
      expect(r.steuerOhneAbfindungCents, 1234700);
      expect(r.steuerRegelCents, 3716400);
      expect(r.steuerFuenftelCents, 3570200);
      expect(r.ersparnisCents, 146200);
      expect(r.nurUeberVeranlagung, isTrue,
          reason: 'Erstattung nur über die Veranlagung (seit VZ 2025)');
    });
  });

  group('Golden G7 – ALG: 95.000 €, StKl III, 1 Kind (25 J alt), 58 J, 48 Monate', () {
    final alg = alg1Bemessung(
      bruttoJahrCents: eur(95000),
      steuerklasse: Steuerklasse.iii,
      alter: 58,
      mindestensEinKind: true,
      kinderfreibetragZaehler: 1,
      anzahlKinder: 1,
      anzahlKinderUnter25: 0,
    );

    test('Bemessung und Höchstdauer', () {
      expect(alg.bemessungsentgeltTagCents, 26027);
      expect(alg.lohnsteuerJahrCents, 1364400);
      expect(alg.leistungsentgeltTagCents, 17083);
      expect(alg.algTagCents, 11445);
      expect(alg.algMonatCents, 343350);
      expect(alg1AnspruchsdauerTage(versicherungsmonate: 48, alter: 58), 720);
    });

    test('Sperrzeit nach Aufhebungsvertrag: ein halbes Jahr ALG verloren', () {
      final s = sperrzeitSimulation(anspruchTage: 720, algTagCents: 11445);
      expect(s.sperrzeitTage, 84);
      expect(s.minderungTage, 180, reason: 'ein Viertel von 720 Tagen');
      expect(s.verbleibendeAnspruchTage, 540);
      expect(s.verlorenesAlgCents, 2060100, reason: '180 × 114,45 € = 20.601 €');
    });
  });

  group('Golden G8 – ALG + § 158: 80.000 €, StKl I, 50 J, Abfindung 60.000 €', () {
    final alg = alg1Bemessung(
      bruttoJahrCents: eur(80000),
      steuerklasse: Steuerklasse.i,
      alter: 50,
    );

    test('Bemessung und Anspruchsdauer (30 Monate, 50 J → 450 Tage)', () {
      expect(alg.leistungsentgeltTagCents, 13257);
      expect(alg.algTagCents, 7954);
      expect(alg.algMonatCents, 238620);
      expect(alg1AnspruchsdauerTage(versicherungsmonate: 30, alter: 50), 450);
    });

    test('Ruhen nach § 158: 25 %-Untergrenze, Verbrauch vor Fristende', () {
      final r = ruhen158(
        abfindungCents: eur(60000),
        alter: 50,
        betriebszugehoerigkeitJahre: 25,
        kalendertagEntgeltCents: eur(80000) ~/ 365,
        fehlendeKuendigungsfristTage: 120,
      );
      // 60 % − 5×5 % (25 Jahre Betrieb) − 3×5 % (50 J) = 20 % → Minimum 25 %
      expect(r.massgeblicherAnteil, 0.25);
      expect(r.anteilAbfindungCents, eur(15000));
      expect(r.ruhenTageUngedeckelt, 68);
      expect(r.ruhenTage, 68, reason: 'Abfindungsanteil vor Ablauf der 120 Tage verbraucht');
    });
  });
}
