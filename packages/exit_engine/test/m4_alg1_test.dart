import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

int eur(int euro) => euro * 100;

void main() {
  group('M4 – Bemessung des ALG 1', () {
    test('60.000 € Brutto, StKl I, kinderlos, 30 Jahre (handgerechnet)', () {
      final alg = alg1Bemessung(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.i,
        alter: 30,
      );
      expect(alg.bemessungsentgeltJahrCents, eur(60000));
      expect(alg.bemessungsentgeltTagCents, 16438, reason: '60.000 € / 365 = 164,38 €');
      expect(alg.svPauschaleJahrCents, eur(12000), reason: '20 % SV-Pauschale');
      expect(alg.lohnsteuerJahrCents, eur(9328), reason: 'fiktive LSt wie M1');
      expect(alg.soliJahrCents, 0);
      // Leistungsentgelt: (60.000 - 12.000 - 9.328) / 365 = 105,95 €/Tag
      expect(alg.leistungsentgeltTagCents, 10595);
      expect(alg.leistungssatz, 0.60);
      expect(alg.algTagCents, 6357, reason: '60 % von 105,95 €');
      expect(alg.algMonatCents, 190710, reason: '30 Tagessätze = 1.907,10 €/Monat');
    });

    test('130.000 € Brutto: Bemessungsentgelt an der BBG RV/AV gedeckelt', () {
      final alg = alg1Bemessung(
        bruttoJahrCents: eur(130000),
        steuerklasse: Steuerklasse.i,
        alter: 40,
      );
      expect(alg.bemessungsentgeltJahrCents, eur(101400), reason: 'BBG-Deckelung');
      // LSt auf 101.400 € (StKl I): zvE 82.925 -> 23.692 €; Soli 397,69 €
      expect(alg.lohnsteuerJahrCents, eur(23692));
      expect(alg.soliJahrCents, 39769);
      // LE = (101.400 - 20.280 - 23.692 - 397,69) / 365 = 156,24 €/Tag
      expect(alg.leistungsentgeltTagCents, 15624);
      expect(alg.algTagCents, 9374);
      expect(alg.algMonatCents, 281220, reason: 'Höchst-ALG kinderlos: 2.812,20 €/Monat');
    });

    test('mehr Brutto oberhalb der BBG ändert das ALG nicht mehr', () {
      Alg1Bemessung mit(int brutto) => alg1Bemessung(
          bruttoJahrCents: eur(brutto), steuerklasse: Steuerklasse.i, alter: 40);
      expect(mit(101400).algMonatCents, mit(200000).algMonatCents);
    });

    test('erhöhter Leistungssatz 67 % mit Kind', () {
      Alg1Bemessung mit({required bool kind}) => alg1Bemessung(
            bruttoJahrCents: eur(60000),
            steuerklasse: Steuerklasse.i,
            alter: 35,
            mindestensEinKind: kind,
          );
      final ohne = mit(kind: false);
      final erhoeht = mit(kind: true);
      expect(erhoeht.leistungssatz, 0.67);
      expect(erhoeht.algTagCents, anteilFloor(erhoeht.leistungsentgeltTagCents, 0.67));
      expect(erhoeht.algMonatCents, greaterThan(ohne.algMonatCents));
    });

    test('Steuerklasse V senkt das ALG deutlich gegenüber III', () {
      Alg1Bemessung mit(Steuerklasse stkl) => alg1Bemessung(
          bruttoJahrCents: eur(60000), steuerklasse: stkl, alter: 35);
      expect(mit(Steuerklasse.v).algMonatCents, lessThan(mit(Steuerklasse.iii).algMonatCents));
    });
  });

  group('M4 – Anspruchsdauer (§ 147 SGB III)', () {
    int dauer(int monate, int alter) =>
        alg1AnspruchsdauerTage(versicherungsmonate: monate, alter: alter);

    test('Anwartschaft nicht erfüllt: unter 12 Monaten kein Anspruch', () {
      expect(dauer(11, 40), 0);
    });

    test('Basisstufen ohne Altersbedingung', () {
      expect(dauer(12, 25), 180);
      expect(dauer(15, 25), 180);
      expect(dauer(16, 25), 240);
      expect(dauer(20, 25), 300);
      expect(dauer(24, 30), 360);
      expect(dauer(48, 49), 360, reason: 'unter 50 bleibt es bei 12 Monaten');
    });

    test('verlängerte Dauer ab 50/55/58 nur mit Alter UND Vorversicherungszeit', () {
      expect(dauer(30, 50), 450);
      expect(dauer(30, 49), 360);
      expect(dauer(36, 55), 540);
      expect(dauer(36, 54), 450, reason: '54 < 55: nur Stufe ab 50');
      expect(dauer(48, 58), 720);
      expect(dauer(48, 57), 540, reason: '57 < 58: nur Stufe ab 55');
      expect(dauer(47, 58), 540, reason: '47 Monate reichen nicht für 720 Tage');
    });
  });

  group('M4 – Sperrzeit (§ 159 / § 148 SGB III)', () {
    test('12 Wochen Sperrzeit, Minderung mindestens ein Viertel', () {
      final s = sperrzeitSimulation(anspruchTage: 360, algTagCents: 6357);
      expect(s.sperrzeitTage, 84);
      expect(s.minderungTage, 90, reason: '360/4 = 90 > 84');
      expect(s.verbleibendeAnspruchTage, 270);
      expect(s.verlorenesAlgCents, 90 * 6357);
    });

    test('bei kurzer Anspruchsdauer dominiert die Sperrzeit selbst', () {
      final s = sperrzeitSimulation(anspruchTage: 180, algTagCents: 5000);
      expect(s.minderungTage, 84, reason: '180/4 = 45 < 84 Tage Sperrzeit');
      expect(s.verbleibendeAnspruchTage, 96);
    });

    test('720 Tage Anspruch: Minderung 180 Tage (ein halbes Jahr!)', () {
      final s = sperrzeitSimulation(anspruchTage: 720, algTagCents: 9374);
      expect(s.minderungTage, 180);
      expect(s.verbleibendeAnspruchTage, 540);
      expect(s.verlorenesAlgCents, 180 * 9374);
    });
  });

  group('M4 – Ruhen bei Abfindung (§ 158 SGB III)', () {
    test('Kündigungsfrist eingehalten: kein Ruhen', () {
      final r = ruhen158(
        abfindungCents: eur(50000),
        alter: 40,
        betriebszugehoerigkeitJahre: 10,
        kalendertagEntgeltCents: 16438,
        fehlendeKuendigungsfristTage: 0,
      );
      expect(r.ruhenTage, 0);
    });

    test('maßgeblicher Anteil: 60 % − 5 %-Schritte für Alter und Betriebszugehörigkeit', () {
      final r = ruhen158(
        abfindungCents: eur(50000),
        alter: 40,
        betriebszugehoerigkeitJahre: 10,
        kalendertagEntgeltCents: 16438,
        fehlendeKuendigungsfristTage: 60,
      );
      // 60 % - 2*5 % (10 Jahre Betrieb) - 1*5 % (40 J = 5 J über 35) = 45 %
      expect(r.massgeblicherAnteil, 0.45);
      expect(r.anteilAbfindungCents, eur(22500));
      // 22.500 € / 164,38 € = 136 Tage, aber Deckel: fehlende Frist 60 Tage
      expect(r.ruhenTageUngedeckelt, 136);
      expect(r.ruhenTage, 60);
    });

    test('kurze Abfindung ist vor Fristende verbraucht', () {
      final r = ruhen158(
        abfindungCents: eur(5000),
        alter: 40,
        betriebszugehoerigkeitJahre: 10,
        kalendertagEntgeltCents: 16438,
        fehlendeKuendigungsfristTage: 90,
      );
      // 45 % von 5.000 € = 2.250 € / 164,38 € = 13 Tage
      expect(r.ruhenTage, 13);
    });

    test('Untergrenze 25 % bei hohem Alter und langer Betriebszugehörigkeit', () {
      final r = ruhen158(
        abfindungCents: eur(50000),
        alter: 63,
        betriebszugehoerigkeitJahre: 30,
        kalendertagEntgeltCents: 16438,
        fehlendeKuendigungsfristTage: 200,
      );
      expect(r.massgeblicherAnteil, 0.25);
    });

    test('Ruhen ist auf ein Jahr gedeckelt', () {
      final r = ruhen158(
        abfindungCents: eur(500000),
        alter: 30,
        betriebszugehoerigkeitJahre: 4,
        kalendertagEntgeltCents: 16438,
        fehlendeKuendigungsfristTage: 500,
      );
      expect(r.massgeblicherAnteil, 0.60);
      expect(r.ruhenTage, 365);
    });
  });
}
