/// ExitKompass-Rechen-Engine (Steuerjahr 2026).
///
/// Module:
/// * M1 – Einkommensteuer/Lohnsteuer (`m1_income_tax.dart`)
/// * M2 – Sozialversicherung (`m2_social_insurance.dart`)
/// * M3 – Abfindung/Fünftelregelung (`m3_severance.dart`)
/// * M4 – ALG 1 (`m4_alg1.dart`)
///
/// Alle Geldbeträge werden als `int` in **Cent** übergeben und
/// zurückgegeben, sofern nicht anders dokumentiert.
library;

export 'src/m1_income_tax.dart';
export 'src/m2_social_insurance.dart';
export 'src/m3_severance.dart';
export 'src/money.dart';
export 'src/netto.dart';
export 'src/params.dart';
export 'src/params_2026_data.dart' show params2026Json;
export 'src/sv_rates.dart';
