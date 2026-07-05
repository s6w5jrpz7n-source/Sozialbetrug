import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

/// Hilfsfunktion: Euro (ganzzahlig) → Cent.
int eur(int euro) => euro * 100;

void main() {
  group('M1 – § 32a-Tarif 2026 (Grundtarif)', () {
    test('Grundfreibetrag: bis 12.348 € fällt keine Steuer an', () {
      expect(einkommensteuer(zvECents: 0), 0);
      expect(einkommensteuer(zvECents: eur(5000)), 0);
      expect(einkommensteuer(zvECents: eur(12348)), 0);
      expect(einkommensteuer(zvECents: 1234899), 0, reason: 'zvE wird auf volle Euro abgerundet');
    });

    test('negatives zvE wird als 0 behandelt', () {
      expect(einkommensteuer(zvECents: -eur(10000)), 0);
    });

    test('Eintritt in Zone 2: Eingangssteuersatz 14 %', () {
      // (914,51 * 0,0001 + 1400) * 0,0001 = 0,1400... € -> abgerundet 0 €
      expect(einkommensteuer(zvECents: eur(12349)), 0);
      // 10 € über GFB: = 1,40 € -> 1 €
      expect(einkommensteuer(zvECents: eur(12358)), eur(1));
    });

    test('Ankerwerte der Progressionszonen (handgerechnet)', () {
      expect(einkommensteuer(zvECents: eur(15000)), eur(435));
      expect(einkommensteuer(zvECents: eur(17799)), eur(1034)); // Ende Zone 2
      expect(einkommensteuer(zvECents: eur(17800)), eur(1035)); // Beginn Zone 3
      expect(einkommensteuer(zvECents: eur(40000)), eur(7209));
      expect(einkommensteuer(zvECents: eur(69878)), eur(18213)); // Ende Zone 3
    });

    test('Proportionalzonen: 42 % und 45 % (Reichensteuer)', () {
      // 0,42 * 69.879 - 11.135,63 = 18.213,55 -> 18.213
      expect(einkommensteuer(zvECents: eur(69879)), eur(18213));
      // 0,42 * 100.000 - 11.135,63 = 30.864,37
      expect(einkommensteuer(zvECents: eur(100000)), eur(30864));
      // 0,45 * 300.000 - 19.470,38 = 115.529,62
      expect(einkommensteuer(zvECents: eur(300000)), eur(115529));
    });

    test('Tarif ist an allen Zonengrenzen (nahezu) stetig und monoton', () {
      const grenzen = [12348, 17799, 69878, 277825];
      for (final g in grenzen) {
        final unter = einkommensteuer(zvECents: eur(g));
        final ueber = einkommensteuer(zvECents: eur(g + 1));
        expect(ueber - unter, inInclusiveRange(0, eur(1)),
            reason: 'Sprung an Zonengrenze $g €');
      }
      var vorher = 0;
      for (var zvE = 10000; zvE <= 320000; zvE += 5000) {
        final st = einkommensteuer(zvECents: eur(zvE));
        expect(st, greaterThanOrEqualTo(vorher), reason: 'Monotonie bei $zvE €');
        vorher = st;
      }
    });

    test('Splittingtarif: doppelte Steuer auf halbes zvE', () {
      expect(einkommensteuer(zvECents: eur(80000), splitting: true),
          2 * einkommensteuer(zvECents: eur(40000)));
      expect(einkommensteuer(zvECents: eur(80000), splitting: true), eur(14418));
      // Splittingvorteil gegenüber Grundtarif
      expect(einkommensteuer(zvECents: eur(80000), splitting: true),
          lessThan(einkommensteuer(zvECents: eur(80000))));
    });
  });

  group('M1 – Solidaritätszuschlag', () {
    test('unterhalb der Freigrenze fällt kein Soli an', () {
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(20350)), 0);
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(15000)), 0);
    });

    test('Milderungszone: 11,9 % des übersteigenden Betrags', () {
      // 1 € über der Freigrenze: 11,9 Cent -> 11 Cent (abgerundet)
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(20351)), 11);
      // 1.000 € über der Freigrenze: 119 €  <  5,5 % von 21.350 € = 1.174,25 €
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(21350)), eur(119));
    });

    test('oberhalb der Milderungszone: voller Satz 5,5 %', () {
      // Zonenende bei 11,9(E-F) = 5,5E -> E = 37.838,28 €
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(40000)), eur(2200));
    });

    test('Splitting/Steuerklasse III: verdoppelte Freigrenze', () {
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(40700), splitting: true), 0);
      expect(solidaritaetszuschlag(bemessungsgrundlageCents: eur(40700)), greaterThan(0));
    });
  });

  group('M1 – Kirchensteuer', () {
    test('9 % im Regelfall, 8 % in Bayern und Baden-Württemberg', () {
      expect(
          kirchensteuer(
              bemessungsgrundlageCents: eur(10000),
              bundesland: Bundesland.nordrheinWestfalen),
          eur(900));
      expect(kirchensteuer(bemessungsgrundlageCents: eur(10000), bundesland: Bundesland.bayern),
          eur(800));
      expect(
          kirchensteuer(
              bemessungsgrundlageCents: eur(10000),
              bundesland: Bundesland.badenWuerttemberg),
          eur(800));
    });

    test('keine Kirchensteuer auf 0', () {
      expect(kirchensteuer(bemessungsgrundlageCents: 0, bundesland: Bundesland.bayern), 0);
    });
  });

  group('M1 – Bemessungsgrundlage Zuschlagsteuern (§ 51a EStG)', () {
    test('Kinderfreibeträge mindern die Bemessungsgrundlage', () {
      final ohneKind = bemessungsgrundlageZuschlagsteuern(zvECents: eur(50000));
      final einKind =
          bemessungsgrundlageZuschlagsteuern(zvECents: eur(50000), kinderfreibetragZaehler: 1);
      expect(ohneKind, einkommensteuer(zvECents: eur(50000)));
      // 1,0 Zähler = 9.756 € Freibetrag
      expect(einKind, einkommensteuer(zvECents: eur(50000 - 9756)));
      expect(einKind, lessThan(ohneKind));
    });
  });

  group('M1 – Vorsorgepauschale (vereinfacht)', () {
    test('60.000 € Brutto, StKl I, kinderlos: RV + KV + PV', () {
      // RV 9,3 % = 5.580 | KV (7,3+1,45) % = 5.250 | PV (1,8+0,6) % = 1.440
      final vp = vorsorgepauschale(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.i,
        alter: 30,
      );
      expect(vp, eur(5580 + 5250 + 1440));
    });

    test('Deckelung an beiden Beitragsbemessungsgrenzen (130.000 € Brutto)', () {
      // RV: 9,3 % von 101.400 = 9.430,20 -> aufgerundet 9.431
      // KV: 8,75 % von 69.750 = 6.103,125 -> 6.104
      // PV: 2,4 % von 69.750 = 1.674
      final vp = vorsorgepauschale(
        bruttoJahrCents: eur(130000),
        steuerklasse: Steuerklasse.i,
        alter: 40,
      );
      expect(vp, eur(9431 + 6104 + 1674));
      // Mehr Brutto ändert nichts mehr
      expect(
          vorsorgepauschale(
              bruttoJahrCents: eur(200000), steuerklasse: Steuerklasse.i, alter: 40),
          vp);
    });

    test('Kinder senken den PV-Anteil (2 Kinder unter 25)', () {
      final kinderlos = vorsorgepauschale(
          bruttoJahrCents: eur(60000), steuerklasse: Steuerklasse.iv, alter: 40);
      final zweiKinder = vorsorgepauschale(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.iv,
        alter: 40,
        anzahlKinder: 2,
        anzahlKinderUnter25: 2,
      );
      // kinderlos: PV 2,4 % | 2 Kinder: PV 1,8 - 0,25 = 1,55 %
      expect(kinderlos - zweiKinder, eur((60000 * 0.024 - 60000 * 0.0155).round()));
    });
  });

  group('M1 – Jahres-Lohnsteuer je Steuerklasse', () {
    test('StKl I, 60.000 € Brutto, kinderlos (handgerechnet)', () {
      final erg = jahresLohnsteuer(
        bruttoJahrCents: eur(60000),
        steuerklasse: Steuerklasse.i,
        alter: 30,
      );
      // zvE = 60.000 - 1.230 - 36 - 12.270 = 46.464
      expect(erg.zvECents, eur(46464));
      expect(erg.lohnsteuerCents, eur(9328));
      expect(erg.soliCents, 0, reason: 'LSt unter der Soli-Freigrenze von 20.350 €');
      expect(erg.kirchensteuerCents, 0, reason: 'kein Kirchenmitglied');
    });

    test('StKl III zahlt deutlich weniger als StKl I, StKl V mehr', () {
      LohnsteuerErgebnis fuer(Steuerklasse stkl) => jahresLohnsteuer(
            bruttoJahrCents: eur(60000),
            steuerklasse: stkl,
            alter: 35,
          );
      final i = fuer(Steuerklasse.i).lohnsteuerCents;
      final iii = fuer(Steuerklasse.iii).lohnsteuerCents;
      final v = fuer(Steuerklasse.v).lohnsteuerCents;
      expect(iii, lessThan(i));
      expect(v, greaterThan(i));
    });

    test('StKl V: Formel des § 39b Abs. 2 S. 7 (handgerechnet, 45.000 € Brutto)', () {
      final erg = jahresLohnsteuer(
        bruttoJahrCents: eur(45000),
        steuerklasse: Steuerklasse.v,
        alter: 30,
      );
      // VP = 4.185 (RV) + 3.938 (KV) + 1.080 (PV) = 9.203
      // zvE = 45.000 - 1.230 - 36 - 9.203 = 34.531
      expect(erg.zvECents, eur(34531));
      // 2*(T(43.163) - T(25.898)) = 2*(8.228 - 3.089) = 10.278 (Deckel greift nicht)
      expect(erg.lohnsteuerCents, eur(10278));
    });

    test('StKl V: Mindestsatz 14 % greift bei niedrigem Einkommen', () {
      final erg = jahresLohnsteuer(
        bruttoJahrCents: eur(15000),
        steuerklasse: Steuerklasse.v,
        alter: 30,
      );
      // zvE liegt weit unter dem Grundfreibetrag; Grundformel ergäbe 0,
      // der Mindestsatz von 14 % nicht.
      expect(erg.lohnsteuerCents, greaterThan(0));
      expect(erg.lohnsteuerCents / erg.zvECents, closeTo(0.14, 0.001));
    });

    test('StKl II: Entlastungsbetrag für Alleinerziehende mindert zvE', () {
      final i = jahresLohnsteuer(
          bruttoJahrCents: eur(45000), steuerklasse: Steuerklasse.i, alter: 35);
      final ii = jahresLohnsteuer(
          bruttoJahrCents: eur(45000), steuerklasse: Steuerklasse.ii, alter: 35);
      expect(i.zvECents - ii.zvECents, eur(4260));
    });

    test('StKl VI: keine Pauschbeträge', () {
      final vi = jahresLohnsteuer(
          bruttoJahrCents: eur(45000), steuerklasse: Steuerklasse.vi, alter: 35);
      final v = jahresLohnsteuer(
          bruttoJahrCents: eur(45000), steuerklasse: Steuerklasse.v, alter: 35);
      expect(v.zvECents - vi.zvECents, -eur(1230 + 36));
    });

    test('Kinderfreibeträge wirken nur auf Soli/KiSt, nicht auf die LSt', () {
      final ohne = jahresLohnsteuer(
        bruttoJahrCents: eur(95000),
        steuerklasse: Steuerklasse.i,
        alter: 40,
        kirchenmitglied: true,
      );
      final mit = jahresLohnsteuer(
        bruttoJahrCents: eur(95000),
        steuerklasse: Steuerklasse.i,
        alter: 40,
        kirchenmitglied: true,
        kinderfreibetragZaehler: 2,
        anzahlKinder: 2,
        anzahlKinderUnter25: 2,
      );
      expect(mit.lohnsteuerCents, greaterThanOrEqualTo(ohne.lohnsteuerCents),
          reason: 'Kinderfreibeträge senken die LSt nicht; die PV-Kinderabschläge '
              'verkleinern sogar die Vorsorgepauschale und erhöhen die LSt leicht');
      expect(mit.soliCents, lessThan(ohne.soliCents));
      expect(mit.kirchensteuerCents, lessThan(ohne.kirchensteuerCents));
    });
  });
}
