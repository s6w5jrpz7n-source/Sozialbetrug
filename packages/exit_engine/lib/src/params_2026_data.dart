/// Eingebettete Kopie von `assets/params_2026.json`.
///
/// GENERIERT aus der Asset-Datei - nicht von Hand editieren, sondern
/// `assets/params_2026.json` aendern und diese Datei neu erzeugen
/// (`tool/embed_params.py`). Der Test `params_sync_test.dart` stellt
/// sicher, dass beide Fassungen identisch sind.
library;

const String params2026Json = r'''
{
  "_meta": {
    "jahr": 2026,
    "stand": "2026-07-04",
    "hinweis": "Parameterdatei der ExitKompass-Engine für das Steuer-/Beitragsjahr 2026. Da die Spec-Datei docs/ExitKompass_Spezifikation_v1.md im Repo fehlte, wurden alle Werte direkt aus den offiziellen Rechtsquellen 2026 übernommen (je Block als _quelle dokumentiert) und konnten NICHT gegen Spec §5 abgeglichen werden – siehe ASSUMPTIONS.md.",
    "einheiten": "Beträge mit Suffix _euro in Euro (wie im Gesetz), Sätze als Dezimalzahlen (0.146 = 14,6 %). Die Engine rechnet intern in Cent."
  },

  "einkommensteuer_32a": {
    "_quelle": "§ 32a Abs. 1 EStG i. d. F. für VZ 2026 (Steuerfortentwicklungsgesetz v. 23.12.2024, BGBl. 2024 I Nr. 449); Formeln bestätigt u. a. via finanz-tools.de/einkommensteuer/berechnung-formeln/2026",
    "grundfreibetrag_euro": 12348,
    "zone2_ende_euro": 17799,
    "zone3_ende_euro": 69878,
    "zone4_ende_euro": 277825,
    "zone2_formel": "ESt = (914,51 * y + 1400) * y, y = (zvE - 12348) / 10000",
    "zone2_koeff_quadratisch": 914.51,
    "zone2_koeff_linear": 1400,
    "zone3_formel": "ESt = (173,10 * z + 2397) * z + 1034,87, z = (zvE - 17799) / 10000",
    "zone3_koeff_quadratisch": 173.10,
    "zone3_koeff_linear": 2397,
    "zone3_konstante": 1034.87,
    "zone4_satz": 0.42,
    "zone4_abzug_euro": 11135.63,
    "zone5_satz": 0.45,
    "zone5_abzug_euro": 19470.38,
    "rundung": "zvE auf vollen Euro abrunden; Steuerbetrag auf vollen Euro abrunden (§ 32a Abs. 1 S. 6 EStG)"
  },

  "lohnsteuer_39b": {
    "_quelle": "§ 39b Abs. 2 EStG; Programmablaufplan Lohnsteuer 2026 (BMF-Schreiben v. 12.11.2025); § 9a EStG (AN-Pauschbetrag), § 10c EStG (SA-Pauschbetrag), § 24b EStG (Entlastungsbetrag)",
    "arbeitnehmer_pauschbetrag_euro": 1230,
    "sonderausgaben_pauschbetrag_euro": 36,
    "entlastungsbetrag_alleinerziehende_euro": 4260,
    "stkl5_6_formel": "LSt = 2 * (T(1,25 * X) - T(0,75 * X)); mindestens 14 % von X; für den Teil über grenze1 höchstens 42 %, über grenze2 fest 42 %, über grenze3 fest 45 % (§ 39b Abs. 2 S. 7 EStG)",
    "stkl5_6_mindestsatz": 0.14,
    "stkl5_6_grenze1_euro": 14071,
    "stkl5_6_grenze2_euro": 34939,
    "stkl5_6_grenze3_euro": 222260,
    "vorsorgepauschale": {
      "_quelle": "§ 39b Abs. 2 S. 5 Nr. 3 EStG (Teilbeträge RV + KV + PV); Mindestvorsorgepauschale für KV/PV",
      "mindest_kvpv_satz": 0.12,
      "mindest_kvpv_max_euro": 1900,
      "mindest_kvpv_max_stkl3_euro": 3000
    }
  },

  "kinder": {
    "_quelle": "§ 32 Abs. 6 EStG i. d. F. 2026 (Steuerfortentwicklungsgesetz); Kindergeld: § 66 EStG (259 EUR/Monat ab 01.01.2026)",
    "kinderfreibetrag_je_elternteil_euro": 3414,
    "bea_freibetrag_je_elternteil_euro": 1464,
    "freibetrag_je_kind_beide_elternteile_euro": 9756,
    "kindergeld_monat_euro": 259,
    "hinweis": "freibetrag_je_kind = 2 * (3414 + 1464). Kinderfreibeträge wirken beim LSt-Abzug nur auf Soli/KiSt (§ 51a EStG), nicht auf die LSt selbst."
  },

  "solidaritaetszuschlag": {
    "_quelle": "§§ 3, 4 SolzG 1995 i. d. F. für VZ 2026 (Freigrenzen angehoben durch Steuerfortentwicklungsgesetz)",
    "satz": 0.055,
    "freigrenze_grundtarif_euro": 20350,
    "freigrenze_splitting_euro": 40700,
    "milderungszone_satz": 0.119,
    "formel": "Soli = min(0,055 * ESt; 0,119 * (ESt - Freigrenze)); 0 falls ESt <= Freigrenze"
  },

  "kirchensteuer": {
    "_quelle": "Kirchensteuergesetze der Länder: 8 % in Bayern und Baden-Württemberg, 9 % in allen übrigen Ländern; Bemessungsgrundlage ESt/LSt unter Berücksichtigung von Kinderfreibeträgen (§ 51a EStG)",
    "saetze_je_bundesland": {
      "BW": 0.08,
      "BY": 0.08,
      "BE": 0.09,
      "BB": 0.09,
      "HB": 0.09,
      "HH": 0.09,
      "HE": 0.09,
      "MV": 0.09,
      "NI": 0.09,
      "NW": 0.09,
      "RP": 0.09,
      "SL": 0.09,
      "SN": 0.09,
      "ST": 0.09,
      "SH": 0.09,
      "TH": 0.09
    }
  },

  "sozialversicherung": {
    "_quelle": "Sozialversicherungsrechengrößen-Verordnung 2026 (Kabinettsbeschluss 08.10.2025); Beitragssätze: § 241 SGB V, GKV-Zusatzbeitrag Bekanntmachung BMG (Ø 2,9 % für 2026), § 55 SGB XI, RVBeitrSBek 2026 (18,6 %), § 341 SGB III (2,6 %)",
    "bbg_kv_pv_jahr_euro": 69750,
    "bbg_kv_pv_monat_euro": 5812.50,
    "bbg_rv_av_jahr_euro": 101400,
    "bbg_rv_av_monat_euro": 8450,
    "versicherungspflichtgrenze_jahr_euro": 77400,
    "bezugsgroesse_monat_euro": 3955,
    "kv_allgemeiner_satz": 0.146,
    "kv_ermaessigter_satz": 0.140,
    "kv_zusatzbeitrag_durchschnitt": 0.029,
    "kv_an_anteil": "0,073 + Zusatzbeitrag/2",
    "pv_satz_gesamt": 0.036,
    "pv_an_anteil_normal": 0.018,
    "pv_an_anteil_sachsen": 0.023,
    "pv_ag_anteil_normal": 0.018,
    "pv_ag_anteil_sachsen": 0.013,
    "pv_kinderlosenzuschlag_an": 0.006,
    "pv_kinderlos_ab_alter": 23,
    "pv_abschlag_je_kind_ab_zweitem": 0.0025,
    "pv_abschlag_max_anzahl_kinder": 4,
    "pv_abschlag_hinweis": "Abschlag 0,25 %-Pkt. je Kind für das 2. bis 5. Kind unter 25 Jahren, nur auf den AN-Anteil (§ 55 Abs. 3 SGB XI)",
    "rv_satz": 0.186,
    "rv_an_anteil": 0.093,
    "av_satz": 0.026,
    "av_an_anteil": 0.013
  },

  "alg1": {
    "_quelle": "SGB III: § 147 (Anspruchsdauer), § 149 (Leistungssätze 60/67 %), §§ 151/152 (Bemessungsentgelt, BBG-Deckelung), § 153 (Leistungsentgelt: SV-Pauschale 20 %, LSt, Soli), § 154 (30 Tage/Monat), § 158 (Ruhen bei Entlassungsentschädigung), § 159 (Sperrzeit), § 148 Abs. 1 Nr. 4 (Minderung um mind. 1/4)",
    "leistungssatz_allgemein": 0.60,
    "leistungssatz_erhoeht": 0.67,
    "sv_pauschale": 0.20,
    "tage_je_monat": 30,
    "tage_je_jahr": 365,
    "anspruchsdauer_tabelle": [
      { "versicherungsmonate_min": 12, "mindestalter": 0, "anspruch_tage": 180 },
      { "versicherungsmonate_min": 16, "mindestalter": 0, "anspruch_tage": 240 },
      { "versicherungsmonate_min": 20, "mindestalter": 0, "anspruch_tage": 300 },
      { "versicherungsmonate_min": 24, "mindestalter": 0, "anspruch_tage": 360 },
      { "versicherungsmonate_min": 30, "mindestalter": 50, "anspruch_tage": 450 },
      { "versicherungsmonate_min": 36, "mindestalter": 55, "anspruch_tage": 540 },
      { "versicherungsmonate_min": 48, "mindestalter": 58, "anspruch_tage": 720 }
    ],
    "anspruchsdauer_hinweis": "Versicherungspflichtverhältnisse innerhalb der auf 5 Jahre erweiterten Rahmenfrist (§ 147 Abs. 1 SGB III); Angabe in Leistungstagen (30 Tage = 1 Monat)",
    "sperrzeit_arbeitsaufgabe_wochen": 12,
    "sperrzeit_minderung_anteil_mindestens": 0.25,
    "ruhen_158": {
      "anteil_basis": 0.60,
      "minderung_je_5_jahre_betriebszugehoerigkeit": 0.05,
      "minderung_je_5_lebensjahre_ueber": 35,
      "minderung_je_5_lebensjahre_satz": 0.05,
      "anteil_minimum": 0.25,
      "max_ruhen_tage": 365,
      "hinweis": "Ruhen längstens bis zum Ablauf der (fiktiven) ordentlichen Kündigungsfrist, max. 1 Jahr; Ende früher, wenn der maßgebliche Anteil der Abfindung als Arbeitsentgelt je Kalendertag verbraucht ist (§ 158 Abs. 2 SGB III)"
    }
  }
}
''';
