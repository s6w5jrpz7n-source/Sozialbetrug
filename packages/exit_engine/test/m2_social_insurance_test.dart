import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

int eur(int euro) => euro * 100;

void main() {
  group('M2 – Sozialversicherung: Regelfälle', () {
    test('60.000 € (unter beiden BBGs), kinderlos, 30 Jahre', () {
      final sv = svArbeitnehmerAbzuege(bruttoJahrCents: eur(60000), alter: 30);
      expect(sv.kvCents, eur(5250), reason: 'KV: (14,6/2 + 2,9/2) % = 8,75 %');
      expect(sv.pvCents, eur(1440), reason: 'PV: 1,8 % + 0,6 % Kinderlosenzuschlag');
      expect(sv.rvCents, eur(5580), reason: 'RV: 9,3 %');
      expect(sv.avCents, eur(780), reason: 'AV: 1,3 %');
      expect(sv.gesamtCents, eur(13050));
    });

    test('kaufmännische Rundung auf volle Cent', () {
      // 33.333 € * 8,75 % = 2.916,6375 € -> 2.916,64 €
      final sv = svArbeitnehmerAbzuege(bruttoJahrCents: eur(33333), alter: 30);
      expect(sv.kvCents, 291664);
    });
  });

  group('M2 – Deckelung an den Beitragsbemessungsgrenzen', () {
    test('80.000 €: über der KV/PV-BBG (69.750), unter der RV/AV-BBG', () {
      final sv = svArbeitnehmerAbzuege(bruttoJahrCents: eur(80000), alter: 40);
      expect(sv.kvCents, 610313, reason: 'KV gedeckelt: 69.750 * 8,75 % = 6.103,125');
      expect(sv.pvCents, eur(1674), reason: 'PV gedeckelt: 69.750 * 2,4 %');
      expect(sv.rvCents, eur(7440), reason: 'RV ungedeckelt: 80.000 * 9,3 %');
      expect(sv.avCents, eur(1040), reason: 'AV ungedeckelt: 80.000 * 1,3 %');
    });

    test('130.000 €: über beiden BBGs', () {
      final sv = svArbeitnehmerAbzuege(bruttoJahrCents: eur(130000), alter: 40);
      expect(sv.kvCents, 610313);
      expect(sv.pvCents, eur(1674));
      expect(sv.rvCents, 943020, reason: 'RV gedeckelt: 101.400 * 9,3 % = 9.430,20');
      expect(sv.avCents, 131820, reason: 'AV gedeckelt: 101.400 * 1,3 % = 1.318,20');
    });

    test('oberhalb beider BBGs bleiben die Beiträge konstant', () {
      final a = svArbeitnehmerAbzuege(bruttoJahrCents: eur(130000), alter: 40);
      final b = svArbeitnehmerAbzuege(bruttoJahrCents: eur(500000), alter: 40);
      expect(a.gesamtCents, b.gesamtCents);
    });

    test('exakt auf einer BBG: identisch mit jedem höheren Brutto (KV/PV)', () {
      final aufBbg = svArbeitnehmerAbzuege(bruttoJahrCents: eur(69750), alter: 40);
      final drueber = svArbeitnehmerAbzuege(bruttoJahrCents: eur(69751), alter: 40);
      expect(aufBbg.kvCents, drueber.kvCents);
      expect(aufBbg.pvCents, drueber.pvCents);
      expect(aufBbg.rvCents, lessThan(drueber.rvCents));
    });
  });

  group('M2 – Pflegeversicherung: Kinder-Logik (§ 55 SGB XI)', () {
    double pvSatz({required int alter, int kinder = 0, int kinderU25 = 0, Bundesland land = Bundesland.nordrheinWestfalen}) =>
        svArbeitnehmerAbzuege(
          bruttoJahrCents: eur(50000),
          alter: alter,
          anzahlKinder: kinder,
          anzahlKinderUnter25: kinderU25,
          bundesland: land,
        ).pvSatzAn;

    test('Kinderlosenzuschlag erst ab Alter 23', () {
      expect(pvSatz(alter: 22), closeTo(0.018, 1e-12));
      expect(pvSatz(alter: 23), closeTo(0.024, 1e-12));
    });

    test('1 Kind: kein Zuschlag, kein Abschlag', () {
      expect(pvSatz(alter: 40, kinder: 1, kinderU25: 1), closeTo(0.018, 1e-12));
    });

    test('2 Kinder unter 25: ein Abschlag von 0,25 %-Pkt.', () {
      expect(pvSatz(alter: 40, kinder: 2, kinderU25: 2), closeTo(0.0155, 1e-12));
    });

    test('Abschläge sind auf 4 begrenzt (Kind 2–5)', () {
      expect(pvSatz(alter: 45, kinder: 6, kinderU25: 6), closeTo(0.018 - 4 * 0.0025, 1e-12));
    });

    test('erwachsene Kinder zählen nicht für den Abschlag, verhindern aber den Zuschlag', () {
      expect(pvSatz(alter: 55, kinder: 2, kinderU25: 0), closeTo(0.018, 1e-12));
    });

    test('Sachsen: AN-Anteil um 0,5 %-Pkt. höher', () {
      expect(pvSatz(alter: 40, kinder: 1, kinderU25: 1, land: Bundesland.sachsen),
          closeTo(0.023, 1e-12));
    });
  });

  group('M2 – Zusatzbeitrag', () {
    test('kassenindividueller Zusatzbeitrag überschreibt den Durchschnitt', () {
      final guenstig = svArbeitnehmerAbzuege(
          bruttoJahrCents: eur(60000), alter: 30, kvZusatzbeitragSatz: 0.019);
      // (14,6/2 + 1,9/2) % = 8,25 %
      expect(guenstig.kvCents, eur(4950));
    });
  });

  group('Netto-Schätzung (M1 + M2)', () {
    test('60.000 €, StKl I, kinderlos: Netto = Brutto − Steuern − SV', () {
      final netto = nettoJahr(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.i,
        alter: 30,
      );
      // LSt 9.328 (M1-Test) + SV 13.050 (M2-Test)
      expect(netto.nettoJahrCents, eur(60000 - 9328 - 13050));
      expect(netto.nettoMonatCents, (netto.nettoJahrCents / 12).round());
    });

    test('Kirchenmitglied hat weniger Netto', () {
      NettoErgebnis mitKirche(bool k) => nettoJahr(
            bruttoJahrCents: eur(60000),
            steuerklasse: Steuerklasse.i,
            alter: 30,
            kirchenmitglied: k,
            bundesland: Bundesland.bayern,
          );
      expect(mitKirche(true).nettoJahrCents, lessThan(mitKirche(false).nettoJahrCents));
    });
  });
}
