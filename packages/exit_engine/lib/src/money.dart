/// Hilfsfunktionen für Cent-Arithmetik.
///
/// Konvention der Engine: Geldbeträge sind `int` in Cent. Steuerformeln
/// des EStG arbeiten auf volle Euro abgerundeten Beträgen; diese Helfer
/// kapseln die Übergänge.
///
/// Prozentsätze werden intern auf eine ganzzahlige Skala von 1e6
/// gebracht (Voraussetzung: höchstens 6 Nachkommastellen, was alle
/// Sätze der Parameterdatei erfüllen). Damit sind Ausdrücke wie
/// `0,6 × Betrag` exakt und kippen nicht durch binäre
/// Gleitkomma-Darstellung um einen Cent.
library;

/// Skala für ganzzahlige Satz-Arithmetik (6 Nachkommastellen).
const int _skala = 1000000;

int _satzSkaliert(double satz) {
  final skaliert = (satz * _skala).round();
  assert((skaliert / _skala - satz).abs() < 1e-9,
      'Satz $satz hat mehr als 6 Nachkommastellen');
  return skaliert;
}

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
int anteilFloor(int cents, double satz) => (cents * _satzSkaliert(satz)) ~/ _skala;

/// Anteil eines Cent-Betrags, kaufmännisch auf volle Cent gerundet
/// (Konvention der SV-Beitragsberechnung).
int anteilRound(int cents, double satz) =>
    (cents * _satzSkaliert(satz) + _skala ~/ 2) ~/ _skala;

/// Anteil eines Cent-Betrags, auf volle **Euro** aufgerundet, Rückgabe in
/// Cent (PAP-Konvention für die Teilbeträge der Vorsorgepauschale).
int anteilCeilEuro(int cents, double satz) {
  const centJeEuro = _skala * 100;
  final produkt = cents * _satzSkaliert(satz);
  return ((produkt + centJeEuro - 1) ~/ centJeEuro) * 100;
}
