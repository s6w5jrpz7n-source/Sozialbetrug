/// Hilfsfunktionen für Cent-Arithmetik.
///
/// Konvention der Engine: Geldbeträge sind `int` in Cent. Steuerformeln
/// des EStG arbeiten auf volle Euro abgerundeten Beträgen; diese Helfer
/// kapseln die Übergänge.
library;

/// Cent → volle Euro, abgerundet (§ 32a Abs. 1 S. 5 EStG: zvE wird auf
/// einen vollen Euro-Betrag abgerundet). Nur für nicht-negative Beträge.
int centsToEuroFloor(int cents) {
  assert(cents >= 0, 'nur nicht-negative Beträge');
  return cents ~/ 100;
}

/// Volle Euro → Cent.
int euroToCents(int euro) => euro * 100;

/// Anteil eines Cent-Betrags, abgerundet auf volle Cent
/// (steuerliche Konvention: Bruchteile eines Cents bleiben außer Ansatz).
int anteilFloor(int cents, double satz) => (cents * satz).floor();

/// Anteil eines Cent-Betrags, kaufmännisch gerundet.
int anteilRound(int cents, double satz) => (cents * satz).round();
