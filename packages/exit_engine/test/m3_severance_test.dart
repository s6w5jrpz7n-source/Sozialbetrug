import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

int eur(int euro) => euro * 100;

void main() {
  group('M3 – Fünftelregelung vs. Regelbesteuerung', () {
    test('40.000 € zvE + 50.000 € Abfindung (handgerechnet)', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(40000),
        abfindungCents: eur(50000),
      );
      expect(r.steuerOhneAbfindungCents, eur(7209));
      // Regel: T(90.000) = 0,42 * 90.000 - 11.135,63 = 26.664,37 -> 26.664
      expect(r.steuerRegelCents, eur(26664));
      // Fünftel: 7.209 + 5 * (T(50.000) - 7.209) = 7.209 + 5 * (10.548 - 7.209)
      expect(r.steuerFuenftelCents, eur(23904));
      expect(r.ersparnisCents, eur(2760));
      expect(r.nurUeberVeranlagung, isTrue);
    });

    test('größter Effekt: niedriges zvE, Abfindungs-Fünftel unter dem Grundfreibetrag', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: 0,
        abfindungCents: eur(20000),
      );
      // T(20.000) = 1.570; ein Fünftel (4.000 €) bleibt unter dem
      // Grundfreibetrag -> Fünftelsteuer 0.
      expect(r.steuerRegelCents, eur(1570));
      expect(r.steuerFuenftelCents, 0);
      expect(r.ersparnisCents, eur(1570));
    });

    test('kein Vorteil, wenn Rest-zvE und Spitze in der 42 %-Zone liegen', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(100000),
        abfindungCents: eur(100000),
      );
      expect(r.steuerRegelCents, eur(72864));
      expect(r.steuerFuenftelCents, r.steuerRegelCents,
          reason: 'linearer Tarif: 5 * 0,42 * A/5 = 0,42 * A');
      expect(r.ersparnisCents, 0);
      expect(r.nurUeberVeranlagung, isFalse);
    });

    test('Reichensteuer: Fünftelregelung hält die Abfindung unter der 45 %-Zone', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(250000),
        abfindungCents: eur(100000),
      );
      expect(r.steuerRegelCents, eur(138029));
      expect(r.steuerFuenftelCents, eur(135864));
      expect(r.ersparnisCents, eur(2165));
    });

    test('Abfindung 0: alle Varianten identisch', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(40000),
        abfindungCents: 0,
      );
      expect(r.steuerRegelCents, r.steuerOhneAbfindungCents);
      expect(r.steuerFuenftelCents, r.steuerOhneAbfindungCents);
      expect(r.ersparnisCents, 0);
      expect(r.nurUeberVeranlagung, isFalse);
    });

    test('Splitting: Vergleich nutzt durchgängig den Splittingtarif', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(80000),
        abfindungCents: eur(60000),
        splitting: true,
      );
      expect(r.steuerOhneAbfindungCents,
          einkommensteuer(zvECents: eur(80000), splitting: true));
      expect(r.steuerRegelCents,
          einkommensteuer(zvECents: eur(140000), splitting: true));
      expect(r.ersparnisCents, greaterThan(0));
    });

    test('Steueranteile der Abfindung sind konsistent', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: eur(40000),
        abfindungCents: eur(50000),
      );
      expect(r.steuerAufAbfindungRegelCents,
          r.steuerRegelCents - r.steuerOhneAbfindungCents);
      expect(r.steuerAufAbfindungFuenftelCents,
          r.steuerAufAbfindungRegelCents - r.ersparnisCents);
    });

    test('negatives Rest-zvE wird als 0 behandelt', () {
      final r = abfindungVergleich(
        zvEOhneAbfindungCents: -eur(5000),
        abfindungCents: eur(20000),
      );
      expect(r.zvEOhneAbfindungCents, 0);
      expect(r.steuerFuenftelCents, 0);
    });
  });
}
