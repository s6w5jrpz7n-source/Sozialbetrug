// ================================================================
//  Sozialbetrug: Arbeitslos zum Millionär – script.js  (Version 6.1 – Balancing)
//  Neue Systeme: Prozedurale Gebäude, Ehe-Krise Quest, Razzia-Logik,
//  Bargeld-Transport, verbessertes Balancing, updateUI Tick-Sync
// ================================================================

// ================================================================
// ABSCHNITT 1: SPIEL-ZUSTAND  (Single Source of Truth)
// ================================================================
const gameState = {
  // Finanzen
  kontostand:    50000,
  schwarzeKasse: 0,

  // Wohlbefinden (0–100)
  energie:          80,
  happinessSpieler: 70,
  happinessPartner: 70,

  // Risiko & Status
  risikoRaster:  10,
  status:        'ALG1',    // 'ALG1' | 'ALG2'
  monat:         1,
  woche:         1,

  // Termine & Verpflichtungen
  naechsterAmtsBesuch: 2,
  scheinbewerbungen:   0,

  // Cheat-Akkumulatoren
  monatlicheExtras: 0,      // Monatliche Schwarzgeld-Einnahmen durch Cheats
  risikoProMonat:   0,      // Monatlicher Risiko-Aufschlag durch Cheats

  // ---- NEU v3: Bargeld-Transport-Risiko ----
  // Schwarzarbeit-Einnahmen landen zunächst als "losesBargeld".
  // Man muss explizit zur Bank oder zum Pfandleiher laufen,
  // um es zu sichern – Transport erhöht das Risiko.
  losesBargeld: 0,          // Noch nicht gesichertes Bargeld (sichtbar für Razzien)

  // ---- NEU v3: Ehe-Krise Quest-State ----
  eheKriseAktiv:  false,    // Wird true wenn happinessPartner < 30
  eheKriseSchritt: 0,       // 0–5: Fortschritt in der 5-stufigen Quest-Reihe
  eheKriseGescheitert: false,

  // ---- NEU v3: Razzia-Timer ----
  razziaTimer: 60,          // Countdown in Sekunden (bei Risiko > 70 aktiv)

  // Tracking
  realSekundenGespielt:  0,
  letzterMonatsAbschluss: 0,

  // Game Over Flag
  gameOver: false,

  // Schattenbank-Guthaben wird monatlich um 10% reduziert
  schattenbankAktiv: false,  // true wenn Schwarzkasse über Schattenbank gesichert ist
  bankEinzahlungDieseWoche: 0,  // Reset jede Spielwoche

  // ---- Kindergeld-System ----
  // Array von Kindernamen (max. 4). Jedes Kind = +300€/Monat aufs Konto, Risiko +5/Monat.
  kindergeldKinder: [],     // z.B. ['Kwame', 'Amara', ...]
  razziaChanceAktuell: 0,  // Wird von updateHUD gesetzt, von tickRazziaTimer genutzt

  // ---- Aktiendepot ----
  depot: [],          // Array von { name, type, anteile, kaufkurs, aktuellerKurs }
  depotWert: 0,       // Aktueller Gesamtwert des Depots (wird monatlich neu berechnet)

  // ---- Zeit: Tage ----
  tag: 1,             // 1–7 innerhalb einer Woche (für Tagesanzeige)

  // ---- Loan-Shark-Schulden ----
  loanSharkSchuld: 0,
  loanSharkMahnungStufe: 0, // 0=keine, 1=Mahnung, 2=erster Besuch, 3=zweiter Besuch

  // ---- Gold (im Garten vergraben – sicher & unsichtbar) ----
  goldBarren: 0,            // Anzahl Goldbarren (je 500€, kein ALG2-Limit)

  // ---- Pfandleiher: verpfändete Gegenstände ----
  verpfaendet: {},          // z.B. { handy:true, auto:true } – jedes Item nur 1×

  // ---- Gesundheit ----
  gesundheit: 80,           // 0–100, Tod bei 0

  // ---- Frau ausgezogen ----
  frauAusgezogen: false,    // true wenn happinessPartner < 20
  unterhaltProMonat: 0,     // 1000€/M wenn Frau weg
  geschenkeSumme: 0,        // Zählt Geschenke bis 5000€ für Rückkehr

  // ---- Supermarkt ----
  lebensmittelDiesenMonat: null, // 'gut'|'normal'|'billig'|null
  billigKaeufeInFolge: 0,   // Für "Frau beschwert sich"-Event
  supermarktFaellig: false, // true ab Tag 3 des Monats

  // ---- Arbeitsamt-Fehltermine ----
  amtsTermineVerpasst: 0,   // Zurückgesetzt bei erstem Besuch
  algGesperrt: false,       // true nach 3 verpassten Terminen, bis Besuch

  // ---- Legale Mehrbedarfe / Anträge (Arbeitsamt) ----
  mehrbedarf: {             // aktive monatliche Zuschläge
    warmwasser:      false, // +15  legal, ohne Bedingung
    alleinerziehend: false, // +70  braucht ≥1 Kind
    ernaehrung:      false, // +110 braucht Attest
    but:             false, // +40  braucht ≥1 Kind
  },
  ernaehrungFake: false,    // true wenn Attest gefälscht → Jobcenter-Prüfrisiko
  einstiegsgeldMonate: 0,   // verbleibende Monate mit +338 (Gründerbonus)

  // ---- Minijob (Supermarkt) – legales Einkommen mit Freibetrag ----
  minijobLohn: 0,           // 0 = kein Job, sonst Bruttolohn/Monat

  // ---- Unterhalts-Tarnung (Schattenbank) ----
  unterhaltsTarnung: false, // Afrika-Kindergeld behalten statt anrechnen

  // ---- Kur / Sanatorium ----
  kurCooldownMonat: 0,      // frühester Monat für die nächste Kur

  // ---- Schein-WG (Wohnung) ----
  scheinWG: false,          // Partner als WG deklariert → +Bonus, Prüf-Risiko

  // ---- Umzug / Mietkaution-Darlehen ----
  kautionRest: 0,           // verbleibendes Kaution-Darlehen (in Raten zurück)
  umzugGemacht: false,      // schaltet Wohnungs-Erstausstattung frei

  // ---- Einmalige Pauschalen (Arbeitsamt) ----
  pauschalen: { erstausstattung: false, moebel: false },
  bekleidungCooldownMonat: 0,

  // ---- Immobilie (Schattenbank / Strohmann) ----
  // null oder { wert, miete, modus:'eigen'|'vermietet' }
  immobilie: null,

  // ---- Zahlungsrückstand (universell) ----
  zahlungsRueckstand: 0,    // offene, nicht bezahlte Verpflichtungen
  rueckstandMonate: 0,      // aufeinanderfolgende Monate mit Rückstand → 3 = Game Over

  // ---- Depot verschleiert (in der Schattenbank, für Amt unsichtbar) ----
  depotVerschleiert: false, // kostet 5%/Monat, zählt dafür nicht zur Vermögensprüfung

  // ---- Statistik: insgesamt vom Staat kassiert ----
  vomStaatGesamt: 0,

  // ---- Strafsystem (Sozialbetrug) ----
  // 0=sauber, 1=Ermittlung, 2=Bewährung, 3=vorbestraft(war im Knast), 4=Game Over
  strafStufe: 0,

  // ---- Korrupter Sachbearbeiter (senkt Jobcenter-Prüf-Chance) ----
  sachbearbeiterBestochen: false,

  // ---- Sucht (0=keine, 1-3) durch Amüsierbetrieb/Alkohol/Glücksspiel ----
  suchtStufe: 0,

  // ---- Glücks-Kleeblatt: halbiert einmalig die nächste Razzia-Chance ----
  kleeblatt: false,
};

const AUSWANDERN_GRENZE     = 1000000;   // € Gesamtvermögen für den Auswander-Sieg
const SACHBEARBEITER_KOSTEN = 150;       // €/Monat Schmiergeld

// Name der aktuellen Strafstufe (für Anwalt/Anzeigen)
function strafStufeName(n) {
  return ({ 0: 'sauber', 1: 'Ermittlung', 2: 'Bewährung', 3: 'Vorbestraft' })[n] || 'sauber';
}

// Gesamtvermögen (inkl. versteckter Werte, abzgl. Schulden) – für den Auswander-Sieg
function gesamtVermoegen() {
  const gs = gameState;
  const depotWert = (gs.depot || []).reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
  const immoNet   = gs.immobilie ? Math.max(0, gs.immobilie.wert - (gs.immobilie.restSchuld || 0)) : 0;
  return Math.round(
    gs.kontostand + gs.schwarzeKasse + gs.losesBargeld
    + (gs.goldBarren || 0) * 500 + depotWert + immoNet
    - (gs.loanSharkSchuld || 0) - (gs.kautionRest || 0) - (gs.zahlungsRueckstand || 0)
  );
}

// Zählt staatliche Leistungen für den "Vom Staat kassiert"-Counter mit
function staatGibt(betrag) {
  if (betrag > 0) gameState.vomStaatGesamt = (gameState.vomStaatGesamt || 0) + betrag;
}

// ================================================================
// ABSCHNITT 2: KONSTANTEN
// ================================================================
const MIETE                  = 650;
const KRANKENKASSE_BEITRAG   = 120;      // €/Monat KV+PV-Pauschale, vom Staat übernommen
const NEBENKOSTEN            = 200;      // €/Monat Strom, Internet, Handy (selbst zahlen)
const ALG1_ZAHLUNG           = 1200;
const ALG2_ZAHLUNG           = 563;
const ALG2_VERMOEGENS_GRENZE = 50000;
const ECHTZEIT_PRO_WOCHE     = 60;       // Sekunden pro Spielwoche
const WOCHEN_PRO_MONAT       = 4;
const RAZZIA_INTERVALL       = 60;       // Sekunden zwischen Razzia-Prüfungen
const RAZZIA_SCHWELLE        = 70;       // Ab diesem Risiko aktiv
const RAZZIA_CHANCE          = 0.10;     // 10% pro Prüfung

// ---- Legale Mehrbedarfe (monatliche Zuschläge) ----
const MEHRBEDARF_BETRAG = { warmwasser: 15, alleinerziehend: 70, ernaehrung: 110, but: 40 };
const EINSTIEGSGELD_BETRAG = 338;        // €/Monat Gründerbonus
const EINSTIEGSGELD_KOSTEN = 800;        // einmalig "Steuerberater/Businessplan"
const EINSTIEGSGELD_ZUSCHUSS = 2000;     // einmaliger Investitions-Zuschuss
const EINSTIEGSGELD_DAUER  = 6;          // Monate
const SCHEINWG_BETRAG      = 200;        // €/Monat Schein-WG-Bonus
const KAUTION_RATE         = 150;        // €/Monat Kaution-Darlehen-Rückzahlung
const IMMO_KAUFPREIS       = 100000;     // € Gesamtpreis (Spätspiel-Ziel)
const IMMO_EIGENKAPITAL    = 40000;      // € Anzahlung bei Kauf (aus Schwarzkasse)
const IMMO_LAUFZEIT        = 24;         // Monate Ratenzahlung
const IMMO_RATE            = Math.round((IMMO_KAUFPREIS - IMMO_EIGENKAPITAL) / IMMO_LAUFZEIT); // 2.500 €/M
const IMMO_MIETE           = 1250;       // €/Monat KdU bzw. Mieteinnahmen
const IMMO_WERT_WACHSTUM   = 1.02;       // +2% Wert pro Monat

// Bürgergeld-Freibetrag auf Erwerbseinkommen (Minijob):
//   erste 100 € frei, 100–520 € → 20% frei, 520–1000 € → 30% frei
function minijobFreibetrag(lohn) {
  if (lohn <= 0) return 0;
  let f = Math.min(lohn, 100);
  if (lohn > 100) f += 0.20 * (Math.min(lohn, 520) - 100);
  if (lohn > 520) f += 0.30 * (Math.min(lohn, 1000) - 520);
  return Math.round(f);
}

// ================================================================
// ABSCHNITT 3: ORTE-KONFIGURATION
//   NEU v3: 'bank' als eigener Ort zum Bargeld einzahlen
// ================================================================
const ORTE_CONFIG = [
  {
    id: 'wohnung', name: '🏠 Wohnung', col: 2, row: 2,
    farbe: 0x3a5a8c, dachFarbe: 0x5a8abd,
    beschreibung: 'Dein Zuhause. Hier schläfst du, versteckst Bargeld und planst Cheats.',
    aktionen: [
      { label: '🛏️  Schlafen (Energie +25)',                    id: 'schlafen' },
      { label: '💵  500 € verstecken (Konto → Schwarze Kasse)', id: 'verstecken' },
      { label: '💵  500 € holen  (Schwarze Kasse → Konto)',     id: 'holen' },
      { label: '🏖️  Kur beantragen (volle Erholung)',           id: 'kur' },
      { label: '🏠  Schein-WG deklarieren (+200 €/M, riskant)', id: 'scheinwg' },
      { label: '📦  Umzug in größere Wohnung',                  id: 'umzug' },
      { label: '⚖️  Anwalt anrufen (Strafe anfechten)',         id: 'anwalt' },
      { label: '✈️  Ins Ausland absetzen (Sieg ab 1 Mio €)',    id: 'auswandern' },
      { label: '🎭  Cheats öffnen...',                          id: 'cheats_menu' }
    ]
  },
  {
    id: 'arbeitsamt', name: '🏛️  Arbeitsamt', col: 6, row: 2,
    farbe: 0x5a3a8c, dachFarbe: 0x8a6abf,
    beschreibung: 'Pflichtbesuche alle 14 Tage. Hier beantragst du legale Mehrbedarfe & Förderungen.',
    aktionen: [
      { label: '📋  Pflichttermin wahrnehmen',               id: 'pflichttermin' },
      { label: '📝  Scheinbewerbung einreichen (Risiko -5)', id: 'scheinbewerbung' },
      { label: '🚿  Mehrbedarf Warmwasser (+15 €/M)',         id: 'mb_warmwasser' },
      { label: '👨‍👧  Mehrbedarf Alleinerziehend (+70 €/M)',    id: 'mb_alleinerziehend' },
      { label: '🥗  Ernährungs-Mehrbedarf / Attest (+110 €/M)', id: 'mb_ernaehrung' },
      { label: '🎒  Bildung & Teilhabe (+40 €/M)',            id: 'mb_but' },
      { label: '🚀  Einstiegsgeld (Gründerbonus) beantragen', id: 'einstiegsgeld' },
      { label: '🛋️  Erstausstattung Wohnung (einmalig +1.200 €)', id: 'pausch_erstausstattung' },
      { label: '🪑  Möbel/Schreibtisch fürs Kind (+250 €)',       id: 'pausch_moebel' },
      { label: '👕  Kinder-Bekleidung (+150 €, alle 6 Monate)',    id: 'pausch_bekleidung' },
      { label: '🤝  Sachbearbeiter schmieren (150 €/M, weniger Prüfungen)', id: 'sachbearbeiter' }
    ]
  },
  {
    id: 'baustelle', name: '🏗️  Baustelle', col: 2, row: 10,
    farbe: 0x8c5a1a, dachFarbe: 0xbb8a40,
    beschreibung: 'Schwarzarbeit. Einnahmen landen als LOSES BARGELD – Transport-Risiko!',
    aktionen: [
      { label: '⛏️  Ganzer Tag  (Loses Bargeld +300, Risiko +12, E -20)', id: 'schwarzarbeit' },
      { label: '🔧  Halber Tag  (Loses Bargeld +120, Risiko  +5, E  -8)', id: 'halbertag' }
    ]
  },
  {
    id: 'bank', name: '🏦  Bank', col: 2, row: 6,
    farbe: 0x2a7a4a, dachFarbe: 0x45aa6e,
    beschreibung: 'Loses Bargeld offiziell aufs Konto einzahlen (max. 200 €/Woche) oder Geld abheben. Aktiendepot.',
    aktionen: [
      { label: '💳  → KONTO einzahlen (Loses Bargeld → Bankkonto)',         id: 'einzahlen' },
      { label: '💵  500 € abheben (Bankkonto → Loses Bargeld)',              id: 'abheben' },
      { label: '📈  Aktiendepot – Kaufen (MSCI World / Spekulation)',        id: 'depot_kaufen' },
      { label: '📉  Aktiendepot – Verkaufen / Übersicht',                   id: 'depot_verkaufen' }
    ]
  },
  {
    id: 'pawn', name: '💍  Pfandleiher', col: 6, row: 6,
    farbe: 0x8c1a1a, dachFarbe: 0xbf4545,
    beschreibung: 'Goldbarren kaufen (im Garten vergraben) oder Gegenstände verpfänden. Auslösen kostet 25% Zins.',
    aktionen: [
      { label: '🥇  Goldbarren kaufen (500 € · Bargeld/Konto → im Garten vergraben)', id: 'gold_kaufen' },
      { label: '🥇  Gold ausgraben & verkaufen',                                       id: 'gold_verkaufen' },
      { label: '📱  Handy verpfänden',                                                  id: 'pfand_handy' },
      { label: '💎  Schmuck verpfänden',                                                id: 'pfand_schmuck' },
      { label: '📺  Fernseher verpfänden',                                              id: 'pfand_fernseher' },
      { label: '🎮  Spielekonsole verpfänden',                                          id: 'pfand_konsole' },
      { label: '🚗  Auto verpfänden',                                                   id: 'pfand_auto' }
    ]
  },
  {
    id: 'amuesier', name: '🍸  Amüsierbetrieb', col: 6, row: 10,
    farbe: 0x1a6c4a, dachFarbe: 0x2aaa72,
    beschreibung: 'Kostet 200 €. Hebt die Stimmung – 25 % Chance, erwischt zu werden!',
    aktionen: [
      { label: '🥂  Abend genießen (-200 €, Laune +30)', id: 'amuesieren' }
    ]
  },
  {
    id: 'sportverein', name: '⚽  Sportverein', col: 10, row: 2,
    farbe: 0x2a6a3a, dachFarbe: 0x3a9a52,
    beschreibung: 'Ehrenamtliche Tätigkeit. Kostet Energie, gibt kein Geld – senkt aber Risiko.',
    aktionen: [
      { label: '🏃  Soziale Tätigkeit (1 Tag, E -20, Risiko -23, Laune +10)', id: 'sozial' },
      { label: '⚽  Training leiten  (1 Tag, E -15, Risiko -15, Laune +5)',   id: 'training' }
    ]
  },
  {
    id: 'supermarkt', name: '🛒  Supermarkt', col: 14, row: 2,
    farbe: 0x2a6a8a, dachFarbe: 0x3a9aba,
    beschreibung: 'Kaufe Lebensmittel für den Monat. Beeinflusst Gesundheit und Stimmung.',
    aktionen: [
      { label: '🥗  Bio-Qualität  (800€, Gesundheit +10, Laune +10)',        id: 'einkauf_gut'    },
      { label: '🥙  Normal       (500€, Gesundheit ±0, Laune ±0)',            id: 'einkauf_normal' },
      { label: '🍟  Billig       (250€, Gesundheit -5/M, Laune -10/M)',       id: 'einkauf_billig' },
      { label: '🎁  Geschenk kaufen (500€ → Frau-Geschenke, Rückkehr ab 5.000€)', id: 'geschenk'  },
      { label: '💼  Minijob (Aushilfe) – legales Einkommen',                       id: 'minijob'   }
    ]
  },
  {
    id: 'kiosk', name: '🏪  Kiosk', col: 2, row: 14,
    farbe: 0xc23a3a, dachFarbe: 0x8a2020,
    beschreibung: 'Späti um die Ecke: Rubbellose, Alkohol & Zigaretten. Vorsicht – macht süchtig.',
    aktionen: [
      { label: '🎟️  Rubbellos kaufen (5€ · Glück?)',                       id: 'rubbellos' },
      { label: '🍺  Alkohol & Zigaretten (15€, Laune +8, Gesundheit -3)',  id: 'genussmittel' }
    ]
  },
  {
    id: 'arztpraxis', name: '⚕️  Arztpraxis', col: 14, row: 10,
    farbe: 0xcfd8e0, dachFarbe: 0x9aa6b4,
    beschreibung: 'Behandlung, Krankschreibung und Entzug. Hält dich auf den Beinen.',
    aktionen: [
      { label: '🩺  Behandlung (Gesundheit +30, 500€)',           id: 'arzt_behandlung' },
      { label: '🤒  Krankschreibung (Risiko -8, Energie +10)',     id: 'arzt_krank' },
      { label: '💉  Entzug / Therapie (Sucht heilen, 800€)',       id: 'arzt_entzug' }
    ]
  },
  {
    id: 'villa', name: '🏖️  Villa', col: 10, row: 14,
    farbe: 0xf0e6d0, dachFarbe: 0xd8b070,
    beschreibung: 'Dein Luxus-Domizil – nur bewohnbar, wenn du die Immobilie selbst nutzt.',
    aktionen: [
      { label: '🛌  Luxuriös schlafen (Energie +40, 1 Tag)',   id: 'villa_schlafen' },
      { label: '🏊  Pool & Sauna (Laune +20)',                 id: 'villa_pool' },
      { label: '🍸  Gäste empfangen (Laune +10, Partner +10)', id: 'villa_gaeste' }
    ]
  },
  {
    id: 'kasino', name: '🎰  Kasino', col: 10, row: 6,
    farbe: 0x6a1a6a, dachFarbe: 0x9a2a9a,
    beschreibung: 'Spiele mit losem Bargeld. Rückzahlung 50–120% des Einsatzes aufs Konto (legal). Das Kasino behält im Schnitt 15%.',
    aktionen: [
      { label: '🎰  100 € setzen  → 50–120% aufs Konto (legal)',  id: 'waschen_100'  },
      { label: '🎰  500 € setzen  → 50–120% aufs Konto (legal)',  id: 'waschen_500'  },
      { label: '🎰  1.000 € setzen → 50–120% aufs Konto (legal)', id: 'waschen_1000' },
      { label: '🎰  Alles setzen   → 50–120% des Bargelds aufs Konto', id: 'waschen_alles'}
    ]
  },
  {
    id: 'schattenbank', name: '🏴  Schattenbank', col: 14, row: 6,
    farbe: 0x1a1a2a, dachFarbe: 0x0a0a18,
    beschreibung: 'Wandle Loses Bargeld in sichere Schwarzkasse um. Kostet 5%/Monat Verwaltungsgebühr.',
    aktionen: [
      { label: '🔒  Alles Bargeld sichern (→ Schwarzkasse, 5%/Monat Gebühr)', id: 'alles_sichern'  },
      { label: '🔒  500 € sichern (→ Schwarzkasse)',                           id: 'sichern_500'   },
      { label: '🔒  Schwarzkasse abheben (→ Loses Bargeld)',                    id: 'sk_abheben'    },
      { label: '🌍  Unterhalts-Tarnung (Auslands-Kindergeld behalten)',        id: 'unterhalts_tarnung' },
      { label: '🏘️  Immobilie kaufen (40.000 € EK + Rate)',                    id: 'immo_kaufen'   },
      { label: '🔑  Immobilie: Eigennutzung ⇄ Vermieten',                      id: 'immo_modus'    },
      { label: '🏦  Immobilie sofort abbezahlen (Restschuld tilgen)',          id: 'immo_tilgen'   },
      { label: '💰  Immobilie verkaufen (Wert − Restschuld → Schwarzkasse)',   id: 'immo_verkaufen'},
      { label: '📈  Depot verschleiern (für Amt unsichtbar, 5%/Monat)',        id: 'depot_verschleiern' }
    ]
  },
  {
    id: 'loanshark', name: '🦈  Kredithai', col: 10, row: 10,
    farbe: 0x5a1a1a, dachFarbe: 0x8a2a2a,
    beschreibung: 'Schnelles Geld, hohe Risiken. Schulden wachsen monatlich.',
    aktionen: [
      { label: '💰  Kredit 1.000 € aufnehmen (Risiko +15, Zins 10%/Monat)',  id: 'kredit_klein' },
      { label: '💰  Kredit 3.000 € aufnehmen (Risiko +25, Zins 10%/Monat)',  id: 'kredit_gross' },
      { label: '💸  Schulden zurückzahlen (aktuell: 0 €)',                    id: 'schulden_zahlen' },
      { label: '🤝  Schuldenerlass verhandeln (Risiko +20, 50/50)',           id: 'schulden_verhandeln' }
    ]
  }
];

// ================================================================
// PFANDLEIHER: Verpfändbare Gegenstände
//   wert  = Pfandkredit (aufs Konto)
//   laune = Laune-Abzug beim Verpfänden (wird beim Auslösen zurückgegeben)
//   ziel  = 'spieler' oder 'partner' (welche Laune betroffen ist)
//   Auslösen kostet wert × PFAND_ZINS. Jedes Item nur 1× gleichzeitig.
// ================================================================
const PFAND_ZINS = 1.25;   // +25% Zins beim Auslösen
const PFAND_ITEMS = {
  handy:     { name: '📱 Handy',         wert: 240,  laune: 4,  ziel: 'spieler' },
  schmuck:   { name: '💎 Schmuck',       wert: 500,  laune: 6,  ziel: 'partner' },
  fernseher: { name: '📺 Fernseher',     wert: 440,  laune: 8,  ziel: 'spieler' },
  konsole:   { name: '🎮 Spielekonsole', wert: 360,  laune: 10, ziel: 'spieler' },
  auto:      { name: '🚗 Auto',          wert: 2400, laune: 12, ziel: 'spieler' },
};

// ================================================================
// ABSCHNITT 4: CHEAT-SYSTEM
// ================================================================
const cheatDefinitions = {
  'Scheinbewerbung': {
    label: '📝 Scheinbewerbung', kosten: { energie: 5 },
    beschreibung: 'Gefälschte Bewerbung – senkt Risiko.',
    sofortEffekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); gs.scheinbewerbungen++; },
    logText: '📝 Scheinbewerbung. Risiko -5.'
  },
  'Krankmeldung': {
    label: '🤒 Krankmeldung fälschen', kosten: { energie: 40 },
    beschreibung: '+100 € Konto, Risiko +15.',
    sofortEffekt(gs) { gs.kontostand += 100; gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); },
    logText: '🤒 Krankmeldung: +100 € Konto, Risiko +15.'
  },
  'Schwarzarbeit': {
    label: '⛏️ Schwarzarbeit (Cheat)', kosten: { energie: 60 },
    beschreibung: '+200 € Loses Bargeld, Risiko +20.',
    sofortEffekt(gs) { gs.losesBargeld += 200; gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); },
    logText: '⛏️ Schwarzarbeit (Cheat): +200 € Loses Bargeld, Risiko +20.'
  },
  'Kindergeld-Trick': {
    label: '👶 Kindergeld-Trick', kosten: { energie: 50 },
    beschreibung: 'Fliege nach Afrika, bestich eine Mutter (1.000 €). +300 €/Monat pro Kind (max. 4).',
    sofortEffekt(gs) {
      // Wird von oeffneAfrikaReiseModal() übernommen – kein direkter Effekt hier
      oeffneAfrikaReiseModal();
    },
    logText: '✈️ Afrika-Reise gebucht...'
  },
  'Immobilien-Fake': {
    label: '🏢 Immobilien-Fake', kosten: { energie: 100 },
    beschreibung: '+500 €/Monat (Schwarzkasse), Risiko +40/Monat.',
    sofortEffekt(gs) { gs.monatlicheExtras += 500; gs.risikoProMonat += 40; },
    logText: '🏢 Immobilien-Fake: +500 €/Monat, Risiko +40/Monat.'
  },

  // ---- Spende: Risiko sofort halbieren, kostet Geld vom Konto ----
  'Spende': {
    label: '🎗️ Spende (Risiko -50%)', kosten: { energie: 0 },
    beschreibung: 'Zahle 10% deines Kontos (mind. 1.000 €) – Risikoraster halbiert sich sofort.',
    sofortEffekt(gs) {
      const spende = Math.max(1000, Math.floor(gs.kontostand * 0.10));
      if (gs.kontostand < spende) {
        // Wird in runCheat() separat abgefangen – hier nur als Fallback
        logEvent('⚠️ Nicht genug Geld für die Spende.', 'warn');
        return;
      }
      gs.kontostand  -= spende;
      gs.risikoRaster = Math.floor(gs.risikoRaster * 0.5);
      logEvent(`🎗️ Spende ${formatEuro(spende)}: Risiko halbiert auf ${gs.risikoRaster}%.`, 'good');
    },
    logText: '🎗️ Spende: Risiko -50%.'
  }
};


// ================================================================
// KINDERGELD-SYSTEM: Afrika-Reise Modal
//   Schritt 1: Fliege nach Afrika (kostet 1.000 € + 50 Energie)
//   Schritt 2: Kind auswählen und Mutter bestechen
//   Schritt 3: Kind wird zu kindergeldKinder[] hinzugefügt
//   Max. 4 Kinder. Jedes Kind = +300 €/Monat aufs Konto, Risiko +5/Monat.
// ================================================================

// Zufällige afrikanische Kindernamen für den Spielwitz
const AFRIKA_KINDERNAMEN = [
  'Kwame', 'Amara', 'Kofi', 'Nia', 'Chidi', 'Fatou', 'Seun', 'Aisha',
  'Emeka', 'Zara', 'Tunde', 'Adaeze', 'Kojo', 'Nkechi', 'Bamidele',
  'Yewande', 'Oluwaseun', 'Chiamaka', 'Ifeanyi', 'Adaora'
];

function zufaelligerKindername() {
  const verfuegbar = AFRIKA_KINDERNAMEN.filter(
    n => !gameState.kindergeldKinder.includes(n)
  );
  if (verfuegbar.length === 0) return 'Kind_' + (gameState.kindergeldKinder.length + 1);
  return verfuegbar[Math.floor(Math.random() * verfuegbar.length)];
}

function oeffneAfrikaReiseModal() {
  const gs = gameState;

  // Maximale Anzahl erreicht?
  if (gs.kindergeldKinder.length >= 4) {
    oeffneModal(
      '👶 Limit erreicht',
      `Du hast bereits <strong>4 Kinder</strong> angemeldet – das Maximum.<br><br>
       Aktuell: ${gs.kindergeldKinder.join(', ')}<br><br>
       Das Finanzamt würde bei mehr Kindern misstrauisch.`,
      []
    );
    return;
  }

  const kinderAnzahl = gs.kindergeldKinder.length;
  const neueKinder   = 4 - kinderAnzahl;
  const vorschau     = [];
  for (let i = 0; i < Math.min(3, neueKinder); i++) vorschau.push(zufaelligerKindername());

  oeffneModal(
    '✈️ Schritt 1: Flug nach Afrika',
    `Du planst eine "humanitäre Reise" nach Westafrika.<br><br>
     <strong>Kosten:</strong> 1.000 € (Flug + Bestechung der Mutter)<br>
     <strong>Energie:</strong> −50 (lange Reise)<br>
     <strong>Ertrag:</strong> +300 €/Monat auf Konto, Risiko +5/Monat<br><br>
     Du hast bereits <strong>${kinderAnzahl}/4</strong> Kinder angemeldet.<br>
     ${kinderAnzahl > 0 ? `Aktuell: ${gs.kindergeldKinder.join(', ')}<br><br>` : ''}
     <span style="color:var(--text-dim); font-size:0.62rem;">
       Mögliche neue Kinder: ${vorschau.join(', ')}…
     </span>`,
    [
      {
        label:   '✈️ Jetzt fliegen (−1.000 € · −50 Energie)',
        primary: true,
        callback: () => verarbeiteAfrikaReise()
      }
    ]
  );
}

function verarbeiteAfrikaReise() {
  const gs = gameState;

  // Checks
  if (gs.kindergeldKinder.length >= 4) {
    logEvent('⚠️ Bereits 4 Kinder angemeldet – Maximum erreicht.', 'warn'); return;
  }
  if (gs.kontostand < 1000) {
    oeffneModal('❌ Nicht genug Geld',
      `Die Reise kostet <strong>1.000 €</strong>.<br>
       Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, []);
    return;
  }
  if (gs.energie < 50) {
    oeffneModal('❌ Zu erschöpft',
      `Die Reise kostet <strong>50 Energie</strong>.<br>
       Deine Energie: <strong>${Math.round(gs.energie)}</strong><br><br>
       Schlafe zuerst!`, []);
    return;
  }

  // Kosten abziehen
  gs.kontostand -= 1000;
  gs.energie     = clamp(gs.energie - 50, 0, 100);
  verbraucheTag(3); // Lange Reise = 3 Tage

  // Kind hinzufügen
  const name = zufaelligerKindername();
  gs.kindergeldKinder.push(name);
  gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100);

  logEvent(`✈️ Zurück aus Afrika. ${name} angemeldet. +300€/Monat, Risiko +5.`, 'warn');
  updateHUD();

  // Ergebnis-Modal
  const anzahl = gs.kindergeldKinder.length;
  oeffneModal(
    `✈️ Erfolgreich! ${name} ist jetzt dein Kind`,
    `Du bist zurück aus Afrika.<br><br>
     <strong>${name}</strong> ist nun offiziell in Deutschland für Kindergeld angemeldet.<br><br>
     📋 Alle angemeldeten Kinder (${anzahl}/4):<br>
     <strong>${gs.kindergeldKinder.join(', ')}</strong><br><br>
     💰 Monatliche Kindergeld-Einnahmen: <strong>+${formatEuro(anzahl * 300)}</strong> aufs Konto<br>
     ⚠️ Risikoaufschlag: <strong>+${anzahl * 5}%/Monat</strong><br><br>
     ${anzahl < 4
       ? `<span style="color:var(--accent2);">Du kannst noch ${4 - anzahl} weitere Kinder anmelden.</span>`
       : '<span style="color:var(--danger);">Maximum von 4 Kindern erreicht!</span>'
     }`,
    anzahl < 4 ? [{
      label:   '✈️ Gleich nochmal fliegen (weiteres Kind)',
      callback: () => oeffneAfrikaReiseModal()
    }] : []
  );
}

function runCheat(cheatName) {
  const cheat = cheatDefinitions[cheatName];
  if (!cheat) return;
  const gs = gameState;

  // Spende: Geldprüfung statt Energieprüfung
  if (cheatName === 'Spende') {
    const spende = Math.max(1000, Math.floor(gs.kontostand * 0.10));
    if (gs.kontostand < spende) {
      oeffneModal('❌ Nicht genug Geld',
        `Die Spende beträgt <strong>${formatEuro(spende)}</strong><br>
         (10% deines Kontos, mind. 1.000 €).<br><br>
         Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, []);
      return;
    }
    // Bestätigung vor dem Abzug
    oeffneModal(
      '🎗️ Spende bestätigen',
      `Du zahlst <strong>${formatEuro(spende)}</strong> (10% des Kontos).<br><br>
       Dafür wird dein Risikoraster von <strong>${Math.round(gs.risikoRaster)}%</strong>
       auf <strong>${Math.floor(gs.risikoRaster * 0.5)}%</strong> halbiert.`,
      [{
        label: `✅ Spende zahlen (${formatEuro(spende)})`,
        primary: true,
        callback: () => {
          cheat.sofortEffekt(gs);
          updateHUD();
          pruefeRisiko();
        }
      }]
    );
    return;
  }

  // Kindergeld-Trick: öffnet eigenes Modal, kein Standard-Energie-Check
  if (cheatName === 'Kindergeld-Trick') {
    cheat.sofortEffekt(gs);  // ruft oeffneAfrikaReiseModal() auf
    return;
  }

  // Alle anderen Cheats: Energie-Check
  if (gs.energie < cheat.kosten.energie) {
    oeffneModal('❌ Zu erschöpft!',
      `Benötigt: <strong>${cheat.kosten.energie} Energie</strong><br>
       Vorhanden: <strong>${Math.round(gs.energie)}</strong><br><br>Schlafe zuerst!`, []);
    return;
  }
  gs.energie = clamp(gs.energie - cheat.kosten.energie, 0, 100);
  cheat.sofortEffekt(gs);
  logEvent(cheat.logText, 'warn');
  updateHUD();
  pruefeRisiko();
}

function oeffneCheatMenu() {
  const aktionen = Object.entries(cheatDefinitions).map(([name, def]) => ({
    label: `${def.label}  [E: -${def.kosten.energie}]  ${def.beschreibung}`,
    callback: () => runCheat(name)
  }));
  oeffneModal('🎭 Cheat-Menü',
    'Illegale Aktionen. Jede kostet Energie und beeinflusst Risiko.', aktionen);
}

// ================================================================
// ABSCHNITT 5: EHE-KRISE QUEST-REIHE
//   Wird ausgelöst wenn happinessPartner < 30.
//   5 Schritte, jeder mit Anwaltskosten.
//   Scheitern → Game Over "Sorgerechtsstreit verloren".
// ================================================================

const eheKriseSchritte = [
  {
    schritt: 1,
    titel: '💔 Krise Stufe 1 – Auszug angedroht',
    text: 'Deine Partnerin hat die Koffer gepackt. Sie fordert ein ernsthaftes Gespräch über eure Zukunft.',
    optionA: {
      label: '⚖️ Mediator einschalten (-400 € Konto)',
      effekt(gs) {
        if (gs.kontostand >= 400) {
          gs.kontostand -= 400;
          gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
          gs.eheKriseSchritt = 2;
          return { erfolg: true, text: 'Der Mediator hilft. Sie bleibt vorerst. Weiter zu Schritt 2.' };
        }
        gs.eheKriseSchritt = 99; // Scheitern
        return { erfolg: false, text: 'Du kannst den Mediator nicht bezahlen. Sie zieht aus.' };
      }
    },
    optionB: {
      label: '🙏 Selbst reden ohne Hilfe',
      effekt(gs) {
        gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100);
        gs.eheKriseSchritt = 99; // Scheitern ohne professionelle Hilfe
        return { erfolg: false, text: 'Das Gespräch eskaliert. Sie zieht aus.' };
      }
    }
  },
  {
    schritt: 2,
    titel: '⚖️ Krise Stufe 2 – Getrennte Konten',
    text: 'Die Partnerin verlangt getrennte Konten und einen Unterhaltsnachweis.',
    optionA: {
      label: '📄 Anwalt für Unterhaltsvereinbarung (-600 € Konto)',
      effekt(gs) {
        if (gs.kontostand >= 600) {
          gs.kontostand -= 600;
          gs.happinessPartner = clamp(gs.happinessPartner + 8, 0, 100);
          gs.eheKriseSchritt = 3;
          return { erfolg: true, text: 'Die Vereinbarung ist rechtlich klar. Weiter zu Schritt 3.' };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Kein Geld für den Anwalt. Verfahren eskaliert.' };
      }
    },
    optionB: {
      label: '😤 Ablehnen – kein Unterhalt',
      effekt(gs) {
        gs.risikoRaster    = clamp(gs.risikoRaster + 15, 0, 100);
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Die Weigerung löst ein Gerichtsverfahren aus.' };
      }
    }
  },
  {
    schritt: 3,
    titel: '🏛️ Krise Stufe 3 – Gericht droht',
    text: 'Deine Partnerin hat einen Rechtsanwalt eingeschaltet. Das Gericht fordert Auskunft über dein Vermögen.',
    optionA: {
      label: '⚖️ Eigenen Anwalt beauftragen (-900 € Konto)',
      effekt(gs) {
        if (gs.kontostand >= 900) {
          gs.kontostand -= 900;
          gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100);
          gs.eheKriseSchritt = 4;
          return { erfolg: true, text: 'Dein Anwalt stabilisiert die Lage. Weiter zu Schritt 4.' };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Kein Geld. Du gehst ohne Anwalt ins Verfahren – das ist fatal.' };
      }
    },
    optionB: {
      label: '🏃 Vermögen in Schwarze Kasse verstecken (Risiko +30)',
      effekt(gs) {
        const betrag = Math.min(gs.kontostand, 2000);
        gs.kontostand    -= betrag;
        gs.schwarzeKasse += betrag;
        gs.risikoRaster   = clamp(gs.risikoRaster + 30, 0, 100);
        gs.eheKriseSchritt = 4; // Riskant aber weiter möglich
        return { erfolg: true, text: `${formatEuro(betrag)} versteckt. Risiko +30. Gefährlich.` };
      }
    }
  },
  {
    schritt: 4,
    titel: '👶 Krise Stufe 4 – Sorgerechtsantrag eingereicht',
    text: 'Deine Partnerin hat offiziell das alleinige Sorgerecht beantragt, da sie deine finanzielle Stabilität anzweifelt.',
    optionA: {
      label: '⚖️ Vollständige Verteidigung (-1200 € Konto)',
      effekt(gs) {
        if (gs.kontostand >= 1200) {
          gs.kontostand -= 1200;
          gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
          gs.eheKriseSchritt = 5;
          return { erfolg: true, text: 'Dein Anwalt kämpft erfolgreich. Gemeinsames Sorgerecht vorerst gesichert.' };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Du kannst die Verteidigung nicht bezahlen. Sorgerecht verloren.' };
      }
    },
    optionB: {
      label: '😔 Nachgeben – alleiniges Sorgerecht akzeptieren',
      effekt(gs) {
        gs.happinessSpieler = clamp(gs.happinessSpieler - 30, 0, 100);
        gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100);
        gs.eheKriseSchritt  = 99; // Quest scheitert
        return { erfolg: false, text: 'Du gibst auf. Das Sorgerecht geht verloren.' };
      }
    }
  },
  {
    schritt: 5,
    titel: '🕊️ Krise Stufe 5 – Letzte Chance',
    text: 'Das Gericht bietet eine letzte Einigungsmöglichkeit vor dem Urteil. Eine Zahlung kann die Beziehung retten.',
    optionA: {
      label: '❤️ Alles zahlen – Beziehung retten (-1500 € Konto)',
      effekt(gs) {
        if (gs.kontostand >= 1500) {
          gs.kontostand -= 1500;
          gs.happinessPartner  = clamp(gs.happinessPartner + 25, 0, 100);
          gs.happinessSpieler  = clamp(gs.happinessSpieler + 15, 0, 100);
          gs.eheKriseAktiv     = false;
          gs.eheKriseGescheitert = false;
          gs.eheKriseSchritt   = 0;
          return { erfolg: true, text: '✅ Die Beziehung ist gerettet. Das Sorgerecht bleibt gemeinsam. Ehe-Krise beendet!' };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Kein Geld. Das Gericht entscheidet gegen dich.' };
      }
    },
    optionB: {
      label: '💔 Aufgeben (Sorgerechtsstreit verloren)',
      effekt(gs) {
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: 'Du gibst auf. Das Gericht fällt sein Urteil.' };
      }
    }
  }
];

/**
 * Prüft bei jedem Monatsabschluss und bei Partnerlaune-Änderungen,
 * ob die Ehe-Krise ausgelöst oder weitergeführt werden soll.
 */
function pruefeEheKrise() {
  // Sorgerechtsstreit/Ehe-Krise-Quest entfernt: ohne Kind im Haushalt sinnlos.
  // Niedrige Partnerlaune führt stattdessen zum Auszug der Partnerin (siehe
  // monatsAbschluss, happinessPartner < 20) – kein Game Over mehr durch Sorgerecht.
  return;
}

function _pruefeEheKrise_DEAKTIVIERT() {
  const gs = gameState;
  if (gs.gameOver || gs.eheKriseGescheitert) return;

  // Auslösen: happinessPartner unter 30
  if (!gs.eheKriseAktiv && gs.happinessPartner < 30) {
    gs.eheKriseAktiv    = true;
    gs.eheKriseSchritt  = 1;
    logEvent('💔 EHE-KRISE ausgelöst! Partnerlaune < 30.', 'danger');
    setTimeout(() => zeigeEheKriseSchritt(), 400);
    return;
  }

  // Aktive Quest: nächsten Schritt zeigen wenn fällig
  if (gs.eheKriseAktiv && gs.eheKriseSchritt >= 1 && gs.eheKriseSchritt <= 5) {
    setTimeout(() => zeigeEheKriseSchritt(), 400);
  }
}

/** Zeigt den aktuellen Ehe-Krise-Schritt als Modal */
function zeigeEheKriseSchritt() {
  const gs = gameState;
  if (gs.eheKriseSchritt < 1 || gs.eheKriseSchritt > 5) return;

  const schritt = eheKriseSchritte[gs.eheKriseSchritt - 1];
  if (!schritt) return;

  // Fortschrittsanzeige im Titel
  const progressBar = '●'.repeat(gs.eheKriseSchritt) + '○'.repeat(5 - gs.eheKriseSchritt);

  modalOffen = true;
  document.getElementById('modal-title').textContent = schritt.titel;

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <p style="color:#e84bb8; font-size:0.6rem; margin-bottom:6px; letter-spacing:1px;">
      💔 EHE-KRISE  ${progressBar}  (${gs.eheKriseSchritt}/5)
    </p>
    <p>${schritt.text}</p>
    <p style="margin-top:10px; color:var(--text-dim); font-size:0.65rem;">Wähle sorgfältig:</p>
  `;

  // Option A
  const btnA = document.createElement('button');
  btnA.className   = 'action-btn primary';
  btnA.textContent = `A: ${schritt.optionA.label}`;
  btnA.onclick     = () => verarbeiteEheKriseWahl(schritt, 'A');
  body.appendChild(btnA);

  // Option B
  const btnB = document.createElement('button');
  btnB.className   = 'action-btn danger-btn';
  btnB.textContent = `B: ${schritt.optionB.label}`;
  btnB.onclick     = () => verarbeiteEheKriseWahl(schritt, 'B');
  body.appendChild(btnB);

  document.getElementById('modal-overlay').classList.add('active');
}

function verarbeiteEheKriseWahl(schritt, wahl) {
  const gs     = gameState;
  const option = wahl === 'A' ? schritt.optionA : schritt.optionB;
  const result = option.effekt(gs);

  updateHUD();
  logEvent(`⚖️ Ehe-Krise Schritt ${schritt.schritt}: ${result.text}`,
    result.erfolg ? 'warn' : 'danger');

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <p style="color:${result.erfolg ? 'var(--accent2)' : 'var(--danger)'}; font-size:0.65rem;">
      ${result.erfolg ? '→ Fortgeschritten' : '→ Gescheitert'}
    </p>
    <p>${result.text}</p>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'action-btn primary';
  closeBtn.textContent = '✅ Weiter';
  closeBtn.onclick = () => {
    schliesseModal();

    // Scheitern prüfen
    if (gs.eheKriseSchritt === 99) {
      gs.eheKriseGescheitert = true;
      gs.eheKriseAktiv       = false;
      setTimeout(() => triggerGameOver('sorgerecht'), 300);
    }
    // Quest erfolgreich beendet
    else if (!gs.eheKriseAktiv && gs.eheKriseSchritt === 0) {
      setTimeout(() => oeffneModal('🎊 Ehe-Krise überwunden!',
        'Ihr habt die Krise gemeinsam überstanden. Die Beziehung ist stabilisiert.', []), 300);
    }
    // Nächsten Schritt nach kurzer Pause zeigen
    else if (gs.eheKriseAktiv && gs.eheKriseSchritt <= 5) {
      setTimeout(() => zeigeEheKriseSchritt(), 500);
    }
  };
  body.appendChild(closeBtn);
}

// ================================================================
// ABSCHNITT 6: GAME OVER SYSTEM
// ================================================================

/**
 * Löst einen Game-Over-Zustand aus.
 * grund: 'sorgerecht' | 'razzia' | 'bankrott'
 */
function triggerGameOver(grund) {
  const gs = gameState;
  if (gs.gameOver) return;
  gs.gameOver = true;

  const texte = {
    gesundheit: {
      titel: '💀 Game Over – Tod durch Vernachlässigung',
      text: 'Deine Gesundheit ist auf 0 gesunken. Du hast es nicht rechtzeitig ins Krankenhaus geschafft.<br><br>'
            + 'Das Ergebnis eines Lebens voller Stress, schlechter Ernährung und zu viel Risiko.<br><br>'
            + '<strong>Neustart für einen zweiten Versuch?</strong>'
    },
    bankrott: {
      titel: '💸 Game Over – Bankrott',
      text: 'Du hast kein Geld mehr und beziehst ALG2. Keine Reserven, kein Gold, kein Depot.<br><br>'
            + 'Das System hat gewonnen.<br><br>'
            + '<strong>Neustart für einen zweiten Versuch?</strong>'
    },
    sorgerecht: {
      titel:  '💔 Game Over – Sorgerechtsstreit verloren',
      text:   'Du hast die Ehe-Krise nicht überstanden. Das Gericht hat das alleinige Sorgerecht<br>' +
              'deiner Partnerin zugesprochen. Du verlierst den Kontakt zu deinem Kind.<br><br>' +
              'Die finanzielle und emotionale Last war zu groß.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>'
    },
    razzia: {
      titel:  '🚨 Game Over – Razzia ohne Ausrede',
      text:   'Die Behörden haben dich auf frischer Tat ertappt. Deine schwarze Kasse ist<br>' +
              'konfisziert, dein Konto eingefroren. Ein Strafverfahren wegen Sozialbetrugs<br>' +
              'wurde eröffnet.<br><br><strong>Neustart für einen zweiten Versuch?</strong>'
    },
    knast: {
      titel:  '🔒 Game Over – Lange Haft',
      text:   'Als Wiederholungstäter beim Sozialbetrug verurteilt dich das Gericht zu<br>' +
              'einer mehrjährigen Haftstrafe ohne Bewährung. Vermögen eingezogen,<br>' +
              'Familie verloren. Das System hat doch gewonnen.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>'
    },
    zahlungsunfaehig: {
      titel:  '💀 Game Over – Zahlungsunfähig',
      text:   'Du konntest deine Verpflichtungen drei Monate lang nicht begleichen.<br>' +
              'Der Gerichtsvollzieher pfändet alles, du wirst aus der Wohnung geklagt.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>'
    },
    bankrott: {
      titel:  '💸 Game Over – Totalpleite',
      text:   'Konto leer, Schwarze Kasse leer, keine Leistungen mehr.<br>' +
              'Du kannst die Miete nicht mehr zahlen und wirst obdachlos.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>'
    }
  };

  const info = texte[grund] || texte.bankrott;

  // Danger-Flash
  const flash = document.getElementById('danger-flash');
  if (flash) {
    flash.style.display = 'block';
    setTimeout(() => { flash.style.display = 'none'; }, 1200);
  }

  logEvent(`💀 GAME OVER: ${info.titel}`, 'danger');
  soundGameOver();  // Finaler Sound

  setTimeout(() => {
    modalOffen = true;
    document.getElementById('modal-title').textContent = info.titel;
    const body = document.getElementById('modal-body');
    body.innerHTML = `<p>${info.text}</p>`;

    const restartBtn = document.createElement('button');
    restartBtn.className   = 'action-btn danger-btn';
    restartBtn.textContent = '🔄 Neustart';
    restartBtn.onclick     = () => window.location.reload();
    body.appendChild(restartBtn);

    document.getElementById('modal-overlay').classList.add('active');
  }, 800);
}

// ================================================================
// ABSCHNITT 7: RAZZIA-MECHANIK v3
//   Separater Timer (60 Sek) der NUR bei risikoRaster > 70 läuft.
//   Bei Auslösung: Spieler hat Ausrede-Optionen.
//   Ohne Ausrede → schwarzeKasse = 0, risikoRaster = 95.
//   Mit Ausrede → Kosten, aber kein Game Over.
// ================================================================

let razziaTimerLaeuft = false;
let razziaTimerSek    = RAZZIA_INTERVALL;

/**
 * Wird jede Sekunde aus dem Phaser-Update aufgerufen (nur wenn kein Modal).
 * Zählt den Razzia-Timer herunter wenn Risiko > 70.
 */
function tickRazziaTimer(dt) {
  const gs = gameState;
  if (gs.gameOver || gs.risikoRaster <= RAZZIA_SCHWELLE) {
    razziaTimerSek = RAZZIA_INTERVALL; // Reset wenn Risiko sinkt
    return;
  }

  razziaTimerSek -= dt;
  if (razziaTimerSek <= 0) {
    razziaTimerSek = RAZZIA_INTERVALL;
    // Chance korreliert direkt mit risikoRaster:
    // Bei 70 Risiko: ~14%, bei 80: ~20%, bei 90: ~27%, bei 100: ~40%
    let chance = Math.min(0.40, Math.pow(gs.risikoRaster, 1.5) / 25000);
    if (gs.kleeblatt) { chance *= 0.5; gs.kleeblatt = false; }   // Glücks-Kleeblatt (1×)
    if (Math.random() < chance) {
      ausloesenRazziaV3();
    }
  }
}

/**
 * Öffnet das Razzia-Event mit Ausrede-Optionen.
 * Das Spiel pausiert (modalOffen = true).
 */
function ausloesenRazziaV3() {
  const gs = gameState;

  const flash = document.getElementById('danger-flash');
  if (flash) { flash.style.display = 'block'; setTimeout(() => { flash.style.display = 'none'; }, 800); }

  soundRazzia();  // Sirenen-Sound!
  logEvent('🚨 RAZZIA-PRÜFUNG! Wähle sofort eine Ausrede!', 'danger');

  modalOffen = true;
  document.getElementById('modal-title').textContent = '🚨 RAZZIA!';

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <p style="color:var(--danger); font-size:0.7rem; margin-bottom:8px;">
      ⚡ SOFORTENTSCHEIDUNG ERFORDERLICH
    </p>
    <p>Behörden stehen vor der Tür! Du hast Sekunden, um zu reagieren.</p>
    <p style="margin-top:8px; color:var(--text-dim); font-size:0.65rem;">
      Aktuell: Loses Bargeld ${formatEuro(gs.losesBargeld)} · 
      Schwarzkasse ${formatEuro(gs.schwarzeKasse)} · 
      Risiko ${Math.round(gs.risikoRaster)}%
    </p>
  `;

  // Ausrede A: Bargeld zeigen, zahlen
  const btnA = document.createElement('button');
  btnA.className   = 'action-btn';
  btnA.textContent = '💸 Bestechung (-300 € Bargeld, Risiko -20)';
  btnA.onclick     = () => verarbeiteRazzia('bestechung');
  body.appendChild(btnA);

  // Ausrede B: Lügen (riskant, aber gratis)
  const btnB = document.createElement('button');
  btnB.className   = 'action-btn primary';
  btnB.textContent = '🙂 Glaubwürdige Ausrede erfinden (50/50 Chance)';
  btnB.onclick     = () => verarbeiteRazzia('ausrede');
  body.appendChild(btnB);

  // Keine Ausrede → maximale Strafe
  const btnC = document.createElement('button');
  btnC.className   = 'action-btn danger-btn';
  btnC.textContent = '😶 Keine Ausrede – alles zugeben (Schwarzkasse = 0, Risiko 95)';
  btnC.onclick     = () => verarbeiteRazzia('kapitulation');
  body.appendChild(btnC);

  document.getElementById('modal-overlay').classList.add('active');
}

// ================================================================
// STRAFSYSTEM: Sozialbetrug → gestufte Eskalation bis Gefängnis
//   1. Bust: Ermittlung (Verwarnung)
//   2. Bust: Anklage → Geldstrafe + Bewährung
//   3. Bust: Gefängnis (3 Monate Zeitstrafe, Schwarzgeld konfisziert)
//   4. Bust (nach Haft): Game Over (Wiederholungstäter)
// ================================================================
// Großer "SOZIALBETRUG"-Stempel (Stufen 1-3)
function zeigeBetrugFlash() {
  const el = document.getElementById('betrug-flash');
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;            // Reflow → Animation neu starten
  el.classList.add('show');
  soundAlarm && soundAlarm();
  setTimeout(() => el.classList.remove('show'), 1600);
}

function sozialbetrugErwischt() {
  const gs = gameState;
  if (gs.gameOver) return;
  gs.strafStufe = (gs.strafStufe || 0) + 1;

  if (gs.strafStufe >= 4) {
    triggerGameOver('knast');
    return;
  }

  // Großer Betrugs-Stempel für Stufen 1-3
  zeigeBetrugFlash();

  if (gs.strafStufe === 3) {
    // ---- Gefängnis: Zeitstrafe + Konfiszierung ----
    const haftMonate  = 3;
    const konfisziert = gs.losesBargeld + gs.schwarzeKasse;
    gs.losesBargeld   = 0;
    gs.schwarzeKasse  = 0;
    gs.gesundheit       = clamp(gs.gesundheit - 20, 0, 100);
    gs.happinessPartner = clamp(gs.happinessPartner - 30, 0, 100);
    gs.risikoRaster     = 20;                 // nach verbüßter Strafe geringerer Verdacht
    gs.monat           += haftMonate;         // 3 Monate weg (kein Phasenbruch: +3 ≡ 0 mod 3)
    // laufende Maschen fliegen auf
    gs.ernaehrungFake = false;
    gs.unterhaltsTarnung = false;
    gs.scheinWG = false;
    if (gs.immobilie && gs.immobilie.modus === 'eigen') gs.immobilie.modus = 'vermietet';
    soundAlarm && soundAlarm();
    logEvent('🔒 Gefängnis! 3 Monate Haft, Schwarzgeld konfisziert.', 'danger');
    setTimeout(() => oeffneModal('🔒 Gefängnis – Sozialbetrug',
      `Das Gericht verurteilt dich zu <strong>${haftMonate} Monaten Haft</strong>.<br><br>`
      + `Konfisziert: <strong>${formatEuro(konfisziert)}</strong> (loses Bargeld + Schwarzkasse).<br>`
      + 'Gesundheit −20, Partnerlaune −30. Alle laufenden Maschen sind aufgeflogen.<br><br>'
      + '⚠️ Als Vorbestrafter gilt: Wirst du <strong>noch einmal</strong> erwischt, ist es vorbei.', []), 1700);
    updateHUD();
    return;
  }

  if (gs.strafStufe === 2) {
    // ---- Anklage: Geldstrafe + Bewährung ----
    const strafe = Math.min(Math.max(0, gs.kontostand), Math.max(2000, Math.floor((gs.vomStaatGesamt || 0) * 0.10)));
    gs.kontostand -= strafe;
    logEvent(`⚖️ Anklage: Geldstrafe ${formatEuro(strafe)} + Bewährung.`, 'danger');
    setTimeout(() => oeffneModal('⚖️ Anklage – Bewährung',
      `Anklage wegen Sozialbetrugs. <strong>Geldstrafe ${formatEuro(strafe)}</strong> und <strong>Bewährung</strong>.<br><br>`
      + 'Das nächste Mal drohen <strong>Gefängnis</strong>.', []), 1700);
    updateHUD();
    return;
  }

  // ---- Erster Bust: Ermittlung / Verwarnung ----
  logEvent('📂 Ermittlungsverfahren wegen Sozialbetrugs eröffnet.', 'danger');
  updateHUD();
  setTimeout(() => oeffneModal('📂 Ermittlungsverfahren',
    'Gegen dich wird wegen Verdachts auf Sozialbetrug ermittelt – noch eine <strong>Verwarnung</strong>.<br><br>'
    + 'Halte dein Risiko niedrig (Sportverein, Spende) und versteck dein Geld (Gold/verschleiertes Depot), sonst wird es ernst.', []), 1700);
}

function verarbeiteRazzia(wahl) {
  const gs = gameState;
  let resultatText = '';
  let erwischt = false;

  if (wahl === 'bestechung') {
    const verfuegbar = gs.losesBargeld + gs.schwarzeKasse;
    if (verfuegbar >= 300) {
      // Zuerst von losem Bargeld abziehen
      const ausLose = Math.min(300, gs.losesBargeld);
      gs.losesBargeld  -= ausLose;
      gs.schwarzeKasse  = Math.max(0, gs.schwarzeKasse - (300 - ausLose));
      gs.risikoRaster   = clamp(gs.risikoRaster - 20, 0, 100);
      resultatText = 'Der Beamte steckt das Geld ein und geht. Risiko -20.';
    } else {
      // Nicht genug Geld → eskaliert
      gs.schwarzeKasse = 0;
      gs.losesBargeld  = 0;
      gs.risikoRaster  = 95;
      resultatText = 'Kein Bargeld! Der Beamte ist wütend. Alles konfisziert, Risiko 95%.';
      erwischt = true;
    }
    logEvent(`🚨 Razzia: Bestechung. ${resultatText}`, 'danger');
  }

  else if (wahl === 'ausrede') {
    if (Math.random() < 0.5) {
      // Ausrede klappt
      gs.risikoRaster  = clamp(gs.risikoRaster - 10, 0, 100);
      resultatText = '✅ Ausrede geglaubt! Beamter zieht ab. Risiko -10.';
      logEvent('🚨 Razzia: Ausrede geglaubt. Risiko -10.', 'warn');
    } else {
      // Ausrede fliegt auf
      const konfisziert = gs.losesBargeld + Math.floor(gs.schwarzeKasse * 0.5);
      gs.losesBargeld  = 0;
      gs.schwarzeKasse = Math.floor(gs.schwarzeKasse * 0.5);
      gs.risikoRaster  = 95;
      resultatText = `❌ Ausrede aufgeflogen! ${formatEuro(konfisziert)} konfisziert. Risiko 95%.`;
      logEvent('🚨 Razzia: Ausrede aufgeflogen!', 'danger');
      erwischt = true;
    }
  }

  else { // kapitulation
    gs.schwarzeKasse = 0;
    gs.losesBargeld  = 0;
    gs.risikoRaster  = 95;
    resultatText = 'Du gibst alles zu. Schwarzkasse = 0, Risiko = 95%.';
    logEvent('🚨 Razzia: Kapitulation – Ermittlungen folgen!', 'danger');
    erwischt = true;
  }

  updateHUD();

  const body = document.getElementById('modal-body');
  body.innerHTML = `<p>${resultatText}</p>`;

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'action-btn primary';
  closeBtn.textContent = '✅ Verstanden';
  closeBtn.onclick     = () => {
    schliesseModal();
    if (erwischt) setTimeout(() => sozialbetrugErwischt(), 300);
  };
  body.appendChild(closeBtn);
}

// ================================================================
// ABSCHNITT 8: EVENT-DATENBANK (30 Events – unverändert aus V2)
// ================================================================
const eventDatabase = [
  // ---------- 🎲 ALLTAG / GLÜCK (kurze, witzige Mini-Effekte) ----------
  {
    id: 'alltag_hund', kategorie: 'alltag',
    titel: '🐕 Wurst-Raub',
    text: 'Der Hund vom Nachbarn schnappt sich deine Bratwurst vom Balkon.',
    optionA: { label: '🤬 Schimpfen', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 3, 0, 100); return 'Der Köter rennt grinsend weg.'; }},
    optionB: { label: '😂 Drüber lachen', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 2, 0, 100); return 'War eh nur die Billig-Wurst.'; }}
  },
  {
    id: 'alltag_pfand', kategorie: 'alltag',
    titel: '💶 Pfandflaschen-Bonanza',
    text: 'Im Park steht ein praller Sack voll Pfandflaschen – herrenlos.',
    optionA: { label: '♻️ Einsammeln', effekt(gs) { gs.losesBargeld += 15; return '+15 € Pfand kassiert.'; }},
    optionB: { label: '🚶 Zu stolz', effekt(gs) { return 'Du gehst würdevoll weiter.'; }}
  },
  {
    id: 'alltag_bonusheft', kategorie: 'alltag',
    titel: '🛒 Bonusheft voll',
    text: 'Dein Discounter-Bonusheft ist endlich vollgeklebt.',
    optionA: { label: '🎁 Einlösen', effekt(gs) { gs.kontostand += 25; return '+25 € Gutschrift aufs Konto.'; }},
    optionB: { label: '🗑️ Verlegt', effekt(gs) { return 'Wo war das Heft nochmal…?'; }}
  },
  {
    id: 'alltag_trashtv', kategorie: 'alltag',
    titel: '📺 Trash-TV-Marathon',
    text: 'Deine Lieblings-Trash-Show läuft den ganzen Tag am Stück.',
    optionA: { label: '📺 Reinziehen (1 Tag)', effekt(gs) { gs.energie = clamp(gs.energie + 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); verbraucheTag(1); return 'Herrlich vergammelt. E +10, Laune +5.'; }},
    optionB: { label: '🙅 Produktiv bleiben', effekt(gs) { return 'Diszipliniert ausgeschaltet.'; }}
  },
  {
    id: 'alltag_spielhalle', kategorie: 'alltag',
    titel: '🎰 Spielhallen-Glück',
    text: 'Du kommst an der Daddelhalle vorbei. Die Automaten blinken verführerisch.',
    optionA: { label: '🎰 Zocken', effekt(gs) { gs.losesBargeld += 120; if (Math.random() < 0.25 && gs.suchtStufe < 3) { gs.suchtStufe++; return `Heute lief's! +120 €. Aber das Zocken packt dich (Sucht ${gs.suchtStufe}).`; } return "Heute lief's! +120 € Bargeld."; }},
    optionB: { label: '🚶 Weitergehen', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 2, 0, 100); return 'Diszipliniert geblieben (schade eigentlich).'; }}
  },
  {
    id: 'alltag_schwarzfahren', kategorie: 'alltag',
    titel: '🚌 Kontrolle im Bus!',
    text: 'Kontrolleure steigen ein – und du hast (mal wieder) kein Ticket.',
    optionA: { label: '🎫 Strafe zahlen (-60 €)', effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 60); return '60 € erhöhtes Beförderungsentgelt.'; }},
    optionB: { label: '🏃 Wegrennen', effekt(gs) { gs.energie = clamp(gs.energie - 10, 0, 100); gs.risikoRaster = clamp(gs.risikoRaster + 3, 0, 100); return 'Entkommen – aber Stress. E -10, Risiko +3.'; }}
  },
  {
    id: 'alltag_wetter', kategorie: 'alltag',
    titel: '🌧️ Schmuddelwetter',
    text: 'Seit Tagen nur Regen. Die Stimmung ist im Keller.',
    optionA: { label: '😞 Drin verkriechen', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 4, 0, 100); return 'Couch-Tristesse. Laune -4.'; }},
    optionB: { label: '☔ Trotzdem raus', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 2, 0, 100); gs.energie = clamp(gs.energie - 5, 0, 100); return 'Frische Luft tut gut. Laune +2, E -5.'; }}
  },
  {
    id: 'alltag_paket', kategorie: 'alltag',
    titel: '📦 Falsches Paket',
    text: 'Ein Paket landet bei dir – adressiert an einen Nachbarn.',
    optionA: { label: '📦 Behalten', effekt(gs) {
      const verpfaendet = Object.keys(gs.verpfaendet || {}).filter(k => gs.verpfaendet[k]);
      if (verpfaendet.length > 0) {
        const itemId = verpfaendet[Math.floor(Math.random() * verpfaendet.length)];
        gs.verpfaendet[itemId] = false;
        gs.risikoRaster = clamp(gs.risikoRaster + 2, 0, 100);
        return `Im Paket: dein ${PFAND_ITEMS[itemId].name}! Quasi zurück (Risiko +2).`;
      }
      gs.losesBargeld += 30; gs.risikoRaster = clamp(gs.risikoRaster + 2, 0, 100);
      return 'Drin: 30 € und Krimskrams. Risiko +2.';
    }},
    optionB: { label: '📮 Zurückgeben', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return 'Ehrlich währt am längsten. Laune +3.'; }}
  },
  {
    id: 'alltag_kleeblatt', kategorie: 'alltag',
    titel: '🍀 Vierblättriges Kleeblatt',
    text: 'Du entdeckst tatsächlich ein vierblättriges Kleeblatt.',
    optionA: { label: '🍀 Aufheben', effekt(gs) { gs.kleeblatt = true; gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return 'Glück im Anflug: nächste Razzia-Chance halbiert!'; }},
    optionB: { label: '🌱 Stehen lassen', effekt(gs) { return 'Soll ein anderer Glück haben.'; }}
  },
  {
    id: 'alltag_oma', kategorie: 'alltag',
    titel: '🧧 Post von Oma',
    text: 'Ein Brief von Oma – mit einem Geldschein und einem gestrickten Schal.',
    optionA: { label: '💌 Annehmen', effekt(gs) { gs.kontostand += 50; gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); return 'Danke, Oma! +50 €, Laune +5.'; }},
    optionB: { label: '📞 Zurückschicken', effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return 'Zu stolz – aber nett telefoniert. Laune +3.'; }}
  },
  {
    id: 'alltag_erkaeltung', kategorie: 'alltag',
    titel: '🦠 Erkältung',
    text: 'Du wachst mit Halsschmerzen und Schnupfen auf.',
    optionA: { label: '🛌 Schonen', effekt(gs) { gs.gesundheit = clamp(gs.gesundheit - 3, 0, 100); gs.energie = clamp(gs.energie - 10, 0, 100); return 'Auskuriert. Gesundheit -3, E -10.'; }},
    optionB: { label: '💪 Durchziehen', effekt(gs) { gs.gesundheit = clamp(gs.gesundheit - 8, 0, 100); return 'Wird schlimmer. Gesundheit -8.'; }}
  },

  {
    id: 'anzeige_anonym', kategorie: 'behoerde',
    titel: '📣 Anonyme Anzeige',
    text: 'Ein Nachbar (oder dein Ex?) hat dich beim Jobcenter wegen Sozialbetrugs angeschwärzt. Eine Sonderprüfung droht.',
    optionA: { label: '🤐 Schweigegeld zahlen (-1.500 €)',
      effekt(gs) {
        if (gs.kontostand + gs.schwarzeKasse < 1500) {
          gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100);
          return 'Kein Geld fürs Schweigegeld – Risiko +10.';
        }
        let r = 1500;
        const sk = Math.min(r, gs.schwarzeKasse); gs.schwarzeKasse -= sk; r -= sk;
        gs.kontostand -= r;
        return 'Der Informant hält den Mund. Vorerst Ruhe.';
      }},
    optionB: { label: '😶 Aussitzen (Sonderprüfung riskieren)',
      effekt(gs) {
        const maschen = gs.ernaehrungFake || gs.unterhaltsTarnung || gs.scheinWG ||
          (gs.immobilie && gs.immobilie.modus === 'eigen');
        if (maschen && Math.random() < 0.6) {
          setTimeout(() => sozialbetrugErwischt(), 400);
          return 'Sonderprüfung! Deine Maschen sind aufgeflogen…';
        }
        gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100);
        return 'Die Prüfung ergab (diesmal) nichts Konkretes. Risiko +20.';
      }}
  },
  {
    id: 'behoerde_01', kategorie: 'behoerde',
    titel: '📬 Brief vom Jobcenter',
    text: 'Das Jobcenter fordert Bewerbungsnachweise. Du hast 7 Tage.',
    optionA: { label: '📝 Scheinbewerbungen einreichen (Risiko -10)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return 'Jobcenter besänftigt.'; }},
    optionB: { label: '🚪 Brief ignorieren (Risiko +20)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); return 'Das wird Konsequenzen haben.'; }}
  },
  {
    id: 'behoerde_02', kategorie: 'behoerde',
    titel: '🚔 Finanzamt-Kontrolle',
    text: 'Ein Finanzbeamter klingelt für eine Routinekontrolle.',
    optionA: { label: '🤝 Kooperieren',
      effekt(gs) { const v = Math.floor(gs.kontostand * 0.05); gs.kontostand = Math.max(0, gs.kontostand - v); gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); return `Nachzahlung ${formatEuro(v)}.`; }},
    optionB: { label: '🚫 Tür nicht öffnen (Risiko +25)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 25, 0, 100); return 'Formelle Prüfung angekündigt.'; }}
  },
  {
    id: 'behoerde_03', kategorie: 'behoerde',
    titel: '📧 Einladung zur Amtsprüfung',
    text: 'Persönliche Anhörung beim Jobcenter wegen unklarer Einkommensverhältnisse.',
    optionA: { label: '✅ Erscheinen und lügen (Risiko -5, E -15)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); gs.energie = clamp(gs.energie - 15, 0, 100); return 'Überstanden.'; }},
    optionB: { label: '🏃 Termin absagen (Risiko +15)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return 'Kontrolldichte erhöht.'; }}
  },
  {
    id: 'behoerde_04', kategorie: 'behoerde',
    titel: '🚨 Außenprüfung Sozialamt',
    text: 'Unangekündigte Prüfung wegen Schwarzarbeitsverdacht.',
    optionA: { label: '💸 Bestechung (-300 € Bargeld, Risiko -20)',
      effekt(gs) { if (gs.losesBargeld + gs.schwarzeKasse >= 300) { const ausL = Math.min(300, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (300 - ausL)); gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); return 'Akte geschlossen.'; } gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); return 'Kein Geld. Risiko +10.'; }},
    optionB: { label: '😇 Nichts wissen (Risiko +10)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); const k = Math.floor(gs.losesBargeld * 0.5); gs.losesBargeld = Math.max(0, gs.losesBargeld - k); return `${formatEuro(k)} loses Bargeld konfisziert.`; }}
  },
  {
    id: 'behoerde_05', kategorie: 'behoerde',
    titel: '📮 Zoll-Brief',
    text: 'Verdächtige Transaktion mit deinem Namen.',
    optionA: { label: '📄 Erklärung (-200 € Konto)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 200); gs.risikoRaster = clamp(gs.risikoRaster - 8, 0, 100); return 'Verfahren eingestellt.'; }},
    optionB: { label: '🗑️ Brief wegwerfen (Risiko +30)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 30, 0, 100); return 'Mahnbescheid folgt.'; }}
  },
  {
    id: 'behoerde_06', kategorie: 'behoerde',
    titel: '💻 Datenleck – Kontobewegungen prüfbar',
    text: 'Ungewöhnliche Bewegungen im Konto aufgefallen.',
    optionA: { label: '🏦 Geld verschieben (-1000 € → Schwarzkasse)',
      effekt(gs) { const b = Math.min(1000, gs.kontostand); gs.kontostand -= b; gs.schwarzeKasse += b; gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100); return `${formatEuro(b)} gesichert.`; }},
    optionB: { label: '😅 Abwarten',
      effekt(gs) { if (gs.risikoRaster > 50) { const v = Math.floor(gs.kontostand * 0.15); gs.kontostand = Math.max(0, gs.kontostand - v); return `Rückforderung ${formatEuro(v)}.`; } return 'Diesmal Glück.'; }}
  },
  {
    id: 'behoerde_07', kategorie: 'behoerde',
    titel: '🧾 Steuerbescheid - 480 €',
    text: 'Nachzahlung fällig.',
    optionA: { label: '✅ Zahlen (-480 € Konto, Risiko -5)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 480); gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); return 'Bezahlt.'; }},
    optionB: { label: '⏳ Widerspruch (Risiko +10)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); return 'Zinsen laufen.'; }}
  },
  {
    id: 'behoerde_08', kategorie: 'behoerde',
    titel: '🕵️ Observierung – Baustellen-Video',
    text: 'Ein Nachbar hat dich gefilmt.',
    optionA: { label: '🤐 Anwalt (-600 € Konto)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 600); gs.risikoRaster = clamp(gs.risikoRaster - 15, 0, 100); return 'Verfahren eingestellt.'; }},
    optionB: { label: '😬 Zugeben (-800 € Strafe, Risiko -30)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 800); gs.risikoRaster = clamp(gs.risikoRaster - 30, 0, 100); return 'Strafe bezahlt, Akte geschlossen.'; }}
  },
  {
    id: 'behoerde_09', kategorie: 'behoerde',
    titel: '🏛️ Vorladung Staatsanwaltschaft',
    text: 'Verdacht auf Sozialbetrug.',
    optionA: { label: '⚖️ Anwalt (-1000 € Konto)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 1000); gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); return 'Überstanden.'; }},
    optionB: { label: '🏃 Untertauchen (E -30, Risiko -10)',
      effekt(gs) { gs.energie = clamp(gs.energie - 30, 0, 100); gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return 'Verfahren läuft ohne dich.'; }}
  },
  {
    id: 'behoerde_10', kategorie: 'behoerde',
    titel: '📰 Lokalpresse: "Sozialbetrug"',
    text: 'Artikel in der Zeitung. Dein Name nicht direkt genannt – noch nicht.',
    optionA: { label: '🤫 Profil senken (Risiko -5)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); return 'Artikel zieht vorbei.'; }},
    optionB: { label: '😤 Gegendarstellung (Risiko +15)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return 'Mehr Aufmerksamkeit.'; }}
  },
  // LOAN SHARK EVENTS
  {
    id: 'shark_01', kategorie: 'loan_shark',
    titel: '🦈 Erste Mahnung',
    text: 'Bote fordert 200 € zurück.',
    optionA: { label: '💸 200 € zahlen (Bargeld)',
      effekt(gs) { const z = Math.min(200, gs.losesBargeld + gs.schwarzeKasse); const ausL = Math.min(z, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (z - ausL)); return z >= 200 ? 'Bote geht.' : 'Nicht genug – Unzufriedenheit.'; }},
    optionB: { label: '😤 Vertrösten (Risiko +10)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); return 'Zinsaufschlag läuft.'; }}
  },
  {
    id: 'shark_02', kategorie: 'loan_shark',
    titel: '🦈 "Wir kennen deine Adresse"',
    text: 'Drohung: 500 € bis Freitag.',
    optionA: { label: '💰 500 € zahlen',
      effekt(gs) { if (gs.losesBargeld + gs.schwarzeKasse >= 500) { const ausL = Math.min(500, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (500 - ausL)); return 'Zahlt. Ruhe.'; } gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); return 'Kein Bargeld. Risiko +20.'; }},
    optionB: { label: '📞 Polizei (Risiko -15)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 15, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); return 'Kreditgeber weg, aber Akte offen.'; }}
  },
  {
    id: 'shark_03', kategorie: 'loan_shark',
    titel: '🦈 Einschüchterung',
    text: 'Zwei Männer vor der Tür.',
    optionA: { label: '🤝 400 € Bargeld geben',
      effekt(gs) { const z = Math.min(400, gs.losesBargeld + gs.schwarzeKasse); const ausL = Math.min(z, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (z - ausL)); return `${formatEuro(z)} gegeben.`; }},
    optionB: { label: '🚪 Flüchten (E -20)',
      effekt(gs) { gs.energie = clamp(gs.energie - 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 15, 0, 100); return 'Bei Bekanntem geschlafen.'; }}
  },
  {
    id: 'shark_04', kategorie: 'loan_shark',
    titel: '🦈 Neue Konditionen: +300 €',
    text: 'Kreditgeber verdoppelt Zinsen.',
    optionA: { label: '😤 Akzeptieren (-300 €)',
      effekt(gs) { const ausL = Math.min(300, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (300 - ausL)); return '300 € weg.'; }},
    optionB: { label: '⚖️ Rechtlich prüfen (-150 € Konto)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 150); return 'Anwalt prüft.'; }}
  },
  {
    id: 'shark_05', kategorie: 'loan_shark',
    titel: '🦈 Paket abholen?',
    text: 'Schulden weg für einen Gefallen.',
    optionA: { label: '📦 Abholen (Cash +300, Risiko +35)',
      effekt(gs) { gs.losesBargeld += 300; gs.risikoRaster = clamp(gs.risikoRaster + 35, 0, 100); return 'Paket abgeholt. Inhalt unbekannt.'; }},
    optionB: { label: '❌ Ablehnen (Risiko +5)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100); return 'Schulden bleiben.'; }}
  },
  {
    id: 'shark_06', kategorie: 'loan_shark',
    titel: '🦈 Kreditgeber ruft Jobcenter an',
    text: 'Anonymer Tipp auf dein Schwarzgeld.',
    optionA: { label: '🏃 2000 € verstecken',
      effekt(gs) { const b = Math.min(2000, gs.kontostand); gs.kontostand -= b; gs.schwarzeKasse += b; gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return `${formatEuro(b)} gesichert.`; }},
    optionB: { label: '😇 Nichts tun',
      effekt(gs) { const v = Math.floor(gs.kontostand * 0.2); gs.kontostand = Math.max(0, gs.kontostand - v); return `Rückforderung ${formatEuro(v)}.`; }}
  },
  {
    id: 'shark_07', kategorie: 'loan_shark',
    titel: '🦈 Schulden-Reset Angebot',
    text: 'Alle Schulden weg gegen 20% Schwarzkasse.',
    optionA: { label: '✅ Deal (-20% Schwarzkasse)',
      effekt(gs) { const z = Math.floor(gs.schwarzeKasse * 0.2); gs.schwarzeKasse -= z; gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return `${formatEuro(z)} weg. Risiko -10.`; }},
    optionB: { label: '❌ Ablehnen',
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 15, 0, 100); return 'Schulden laufen.'; }}
  },
  {
    id: 'shark_08', kategorie: 'loan_shark',
    titel: '🦈 Zins-Forderung 750 €',
    text: 'Kreditgeber fordert 3 Monate Zinsen.',
    optionA: { label: '💸 Zahlen (-750 € Bargeld)',
      effekt(gs) { const ausL = Math.min(750, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (750 - ausL)); return 'Bezahlt.'; }},
    optionB: { label: '🤬 Bestreiten (Risiko +20)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); return 'Eskalation. Nachbarn aufmerksam.'; }}
  },
  {
    id: 'shark_09', kategorie: 'loan_shark',
    titel: '🦈 Sofortkredit: +1000 €',
    text: '1000 € jetzt gegen 1500 € in 4 Wochen.',
    optionA: { label: '✅ Annehmen (+1000 € loses Bargeld)',
      effekt(gs) { gs.losesBargeld += 1000; gs.risikoProMonat = clamp(gs.risikoProMonat + 5, 0, 100); return 'Geld da. Rückzahlung drückt.'; }},
    optionB: { label: '❌ Ablehnen',
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 5, 0, 100); return 'Abgelehnt.'; }}
  },
  {
    id: 'shark_10', kategorie: 'loan_shark',
    titel: '🦈 Kreditgeber verhaftet',
    text: 'Kreditgeber festgenommen. Unterlagen beschlagnahmt.',
    optionA: { label: '😅 Abwarten (Risiko -10)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return 'Schulden de facto erloschen.'; }},
    optionB: { label: '🤝 Polizei-Aussage (Risiko -20)',
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100); return 'Teilimmunität erhalten.'; }}
  },
  // BEZIEHUNGS-EVENTS
  {
    id: 'beziehung_01', kategorie: 'beziehung',
    titel: '💔 Partnerin enttäuscht',
    text: 'Sie fragt, ob du wirklich suchst.',
    optionA: { label: '🤝 Ehrlich sein (Partner +15, E -10)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 15, 0, 100); gs.energie = clamp(gs.energie - 10, 0, 100); pruefeEheKrise(); return 'Schwieriges, ehrliches Gespräch.'; }},
    optionB: { label: '🎭 Lügen (Partner -5)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 5, 0, 100); pruefeEheKrise(); return 'Misstrauen wächst.'; }}
  },
  {
    id: 'beziehung_02', kategorie: 'beziehung',
    titel: '🌹 Romantischer Abend',
    text: 'Sie schlägt ein gutes Restaurant vor.',
    optionA: { label: '🍽️ Einladen (-300 €, Partner +25)',
      effekt(gs) { if (gs.kontostand >= 300 || gs.schwarzeKasse >= 300) { if (gs.schwarzeKasse >= 300) gs.schwarzeKasse -= 300; else gs.kontostand -= 300; gs.happinessPartner = clamp(gs.happinessPartner + 25, 0, 100); return 'Wunderschöner Abend.'; } return 'Kein Geld.'; }},
    optionB: { label: '🍕 Zu Hause (Partner +5)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100); return 'Gemütlich.'; }}
  },
  {
    id: 'beziehung_03', kategorie: 'beziehung',
    titel: '😡 Geld-Streit',
    text: 'Heftiger Streit über Finanzen.',
    optionA: { label: '💬 Offen reden (Partner +10, E -15)',
      effekt(gs) { gs.energie = clamp(gs.energie - 15, 0, 100); gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100); pruefeEheKrise(); return 'Schwieriges Gespräch.'; }},
    optionB: { label: '🚶 Rausgehen (Partner -10)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); pruefeEheKrise(); return 'Spannung ungelöst.'; }}
  },
  {
    id: 'beziehung_04', kategorie: 'beziehung',
    titel: '🍼 Kind braucht 250 €',
    text: 'Schulfahrt.',
    optionA: { label: '✅ Geld geben (-250 €, Partner +10)',
      effekt(gs) { if (gs.kontostand >= 250 || gs.schwarzeKasse >= 250) { if (gs.schwarzeKasse >= 250) gs.schwarzeKasse -= 250; else gs.kontostand -= 250; gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100); return 'Kind glücklich.'; } gs.happinessPartner = clamp(gs.happinessPartner - 15, 0, 100); pruefeEheKrise(); return 'Kein Geld.'; }},
    optionB: { label: '❌ Ablehnen (Partner -20)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); pruefeEheKrise(); return 'Belastend.'; }}
  },
  {
    id: 'beziehung_05', kategorie: 'beziehung',
    titel: '🎂 Jahrestag vergessen',
    text: 'Sie wartet schweigend.',
    optionA: { label: '🌹 Blumen kaufen (-80 €, Partner +15)',
      effekt(gs) { if (gs.schwarzeKasse >= 80) gs.schwarzeKasse -= 80; else gs.kontostand = Math.max(0, gs.kontostand - 80); gs.happinessPartner = clamp(gs.happinessPartner + 15, 0, 100); return 'Entschuldigt.'; }},
    optionB: { label: '😅 Ohne Geschenk (Partner -5)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 5, 0, 100); return 'Halbwegs verziehen.'; }}
  },
  {
    id: 'beziehung_06', kategorie: 'beziehung',
    titel: '🏠 Drohung auszuziehen',
    text: 'Zu viel Belastung.',
    optionA: { label: '❤️ Paartherapie (-400 €, Partner +30)',
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 400); gs.happinessPartner = clamp(gs.happinessPartner + 30, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 15, 0, 100); return 'Teuer aber wirksam.'; }},
    optionB: { label: '😶 Nichts tun (Partner -30)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 30, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); pruefeEheKrise(); return 'Sie geht zur Schwester.'; }}
  },
  {
    id: 'beziehung_07', kategorie: 'beziehung',
    titel: '🎉 Freunde kommen',
    text: 'Spontaner Besuch, wollen feiern.',
    optionA: { label: '🍺 Party (-150 €, Laune +20)',
      effekt(gs) { if (gs.schwarzeKasse >= 150) gs.schwarzeKasse -= 150; else gs.kontostand = Math.max(0, gs.kontostand - 150); gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100); gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100); return 'Unvergesslicher Abend.'; }},
    optionB: { label: '🙁 Absagen (Laune -5)',
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 5, 0, 100); return 'Vernünftig aber schade.'; }}
  },
  {
    id: 'beziehung_08', kategorie: 'beziehung',
    titel: '💍 Heiratsantrag',
    text: '"Gemeinsam durch alles."',
    optionA: { label: '💍 Ja sagen (Partner +40, E -20)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 40, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 30, 0, 100); gs.energie = clamp(gs.energie - 20, 0, 100); return 'Ja gesagt. Freude.'; }},
    optionB: { label: '😰 Noch nicht (Partner -25)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 25, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); pruefeEheKrise(); return 'Schwere Stille.'; }}
  },
  {
    id: 'beziehung_09', kategorie: 'beziehung',
    titel: '💌 Brief vom Ex',
    text: '"Frisch anfangen?"',
    optionA: { label: '💬 Treffen (Partner -15)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 15, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100); pruefeEheKrise(); return 'Sie erfährt es.'; }},
    optionB: { label: '🚫 Ablehnen (Partner +5)',
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100); return 'Richtige Entscheidung.'; }}
  },
];


// ================================================================
// ABSCHNITT 8b: AUDIO-SYSTEM (Web Audio API – keine externen Assets)
//
//  Alle Sounds werden prozedural per Oscillator erzeugt.
//  audioCtx wird beim ersten User-Interaktion gestartet (Browser-Regel).
//  Hintergrundmusik: Loop aus 8 Noten (Moll-Arpeggio, düster/traurig)
//  Event-Sounds: je nach Kategorie unterschiedlich
// ================================================================

let audioCtx  = null;
let musikNode = null;  // GainNode für Musik-Lautstärke
let musikLaeuft = false;

/** Erstellt AudioContext für Soundeffekte (Hintergrundmusik läuft über Phaser) */
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // KEIN starteHintergrundMusik() hier – Phaser-MP3 übernimmt
  } catch (e) {
    console.warn('Web Audio nicht verfügbar:', e);
  }
}

// AudioContext für Soundeffekte aktivieren
document.addEventListener('click',   initAudio, { once: false });
document.addEventListener('keydown', initAudio, { once: false });

// ----------------------------------------------------------------
// HILFSFUNKTION: Einzelnen Ton abspielen
//   freq: Frequenz in Hz
//   type: 'sine' | 'square' | 'sawtooth' | 'triangle'
//   startTime: AudioContext-Zeit
//   duration: in Sekunden
//   volume: 0–1
//   attack/release: in Sekunden
// ----------------------------------------------------------------
function playTone(freq, type, startTime, duration, volume, attack, release) {
  if (!audioCtx) return;
  attack  = attack  || 0.01;
  release = release || 0.05;
  volume  = volume  || 0.3;

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.setValueAtTime(volume, startTime + duration - release);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ----------------------------------------------------------------
// HINTERGRUNDMUSIK: Stimmungsabhängig (3 Modi)
//
//  FRÖHLICH  (happinessSpieler > 60):
//    C-Dur Arpeggio, schnell (110 BPM), Sinus/Dreieck, hell
//  NEUTRAL   (30–60):
//    G-Moll Motiv, mittel (85 BPM), Dreieck, gedämpft
//  DÜSTER    (< 30):
//    Tiefer Moll-Loop, langsam (65 BPM), Sägezahn, dunkel
// ----------------------------------------------------------------

// Musik-Preset-Definitionen
const MUSIK_PRESETS = {
  frohlich: {
    beat:      60/110,  // 110 BPM
    wellenform:'sine',
    // C-Dur Arpeggio: C4 E4 G4 C5 G4 E4 + Wiederholung mit Variation
    melodie: [
      [261.6, 0.5, 0.20], [329.6, 0.5, 0.18], [392.0, 0.5, 0.18],
      [523.3, 0.5, 0.15], [392.0, 0.5, 0.16], [329.6, 0.5, 0.14],
      [261.6, 0.5, 0.18], [392.0, 0.5, 0.16], [523.3, 0.75, 0.14],
      [440.0, 0.25, 0.18], [392.0, 0.5, 0.16], [329.6, 1.0, 0.12],
    ],
    bass: [
      [130.8, 1.0, 0.16], [98.0, 1.0, 0.14], [130.8, 1.0, 0.16], [98.0, 1.0, 0.14],
    ],
    bassTyp: 'sine',
    lfoRate: 5.5, lfoDepth: 1.5,
    volMult: 1.0,
  },
  neutral: {
    beat:      60/85,   // 85 BPM
    wellenform:'triangle',
    // G-Moll: G3 Bb3 D4 G4 F4 D4
    melodie: [
      [196.0, 0.5, 0.17], [233.1, 0.5, 0.14], [293.7, 0.5, 0.16],
      [392.0, 0.5, 0.13], [349.2, 0.5, 0.15], [293.7, 0.5, 0.13],
      [261.6, 0.75, 0.15], [233.1, 0.25, 0.11], [196.0, 1.0, 0.14],
    ],
    bass: [
      [49.0, 2.0, 0.20], [43.65, 2.0, 0.18],
    ],
    bassTyp: 'sawtooth',
    lfoRate: 4, lfoDepth: 2,
    volMult: 0.9,
  },
  duester: {
    beat:      60/65,   // 65 BPM – langsam und schwer
    wellenform:'sawtooth',
    // A-Moll sehr tief, fallend: A3 G3 F3 E3 D3 E3
    melodie: [
      [220.0, 0.75, 0.16], [196.0, 0.75, 0.14], [174.6, 0.75, 0.16],
      [164.8, 0.75, 0.14], [146.8, 1.0,  0.18], [164.8, 0.5,  0.12],
      [174.6, 0.5,  0.14], [196.0, 1.5,  0.10],
    ],
    bass: [
      [55.0, 3.0, 0.24], [41.2, 3.0, 0.22],
    ],
    bassTyp: 'sawtooth',
    lfoRate: 2.5, lfoDepth: 3,
    volMult: 0.85,
  }
};

// Aktueller Musik-Modus
let aktuellerMusikModus = 'neutral';
let musikScheduleTimeout = null;

/** Berechnet Modus aus Spieler-Stimmung */
function berechneMusikModus() {
  const h = gameState ? gameState.happinessSpieler : 50;
  if (h > 60) return 'frohlich';
  if (h < 30) return 'duester';
  return 'neutral';
}

/** Wird von updateHUD() aufgerufen – wechselt Modus bei Stimmungsänderung */
function aktualisiereMusikModus() {
  if (!audioCtx || !musikLaeuft) return;
  const neuerModus = berechneMusikModus();
  if (neuerModus !== aktuellerMusikModus) {
    aktuellerMusikModus = neuerModus;
    // Sanfter Übergang: Lautstärke kurz senken, dann beim nächsten Loop-Zyklus
    // ist der Modus bereits gesetzt – kein hartes Stoppen nötig
  }
}

function starteHintergrundMusik() {
  // Deaktiviert – Hintergrundmusik läuft über Phaser-MP3 (Pixel_Parade.mp3)
  return;
  // eslint-disable-next-line no-unreachable
  if (!audioCtx || musikLaeuft) return;
  musikLaeuft = true;

  musikNode = audioCtx.createGain();
  musikNode.gain.value = 0.50;
  musikNode.connect(audioCtx.destination);

  function scheduleLoop() {
    if (!musikLaeuft || !audioCtx) return;

    // Modus beim Start jedes Loops neu bestimmen
    aktuellerMusikModus = berechneMusikModus();
    const preset = MUSIK_PRESETS[aktuellerMusikModus];
    const BEAT   = preset.beat;
    const now    = audioCtx.currentTime;

    // Melodie-Stimme
    let t = now;
    preset.melodie.forEach(([freq, beats, vol]) => {
      if (!audioCtx) return;
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type   = preset.wellenform;
      osc.frequency.setValueAtTime(freq, t);

      // Vibrato-LFO
      const lfo     = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.value  = preset.lfoRate;
      lfoGain.gain.value   = preset.lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + beats * BEAT + 0.1);

      osc.connect(gain);
      gain.connect(musikNode);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol * preset.volMult, t + 0.04);
      gain.gain.setValueAtTime(vol * preset.volMult, t + beats * BEAT * 0.75);
      gain.gain.linearRampToValueAtTime(0, t + beats * BEAT);
      osc.start(t); osc.stop(t + beats * BEAT + 0.05);
      t += beats * BEAT;
    });

    // Bass-Stimme
    let tb = now;
    preset.bass.forEach(([freq, beats, vol]) => {
      if (!audioCtx) return;
      const osc    = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain   = audioCtx.createGain();
      osc.type                = preset.bassTyp;
      filter.type             = 'lowpass';
      filter.frequency.value  = preset.wellenform === 'sine' ? 400 : 180;
      osc.connect(filter); filter.connect(gain); gain.connect(musikNode);
      osc.frequency.setValueAtTime(freq, tb);
      gain.gain.setValueAtTime(0, tb);
      gain.gain.linearRampToValueAtTime(vol * preset.volMult, tb + 0.08);
      gain.gain.setValueAtTime(vol * preset.volMult, tb + beats * BEAT * 0.8);
      gain.gain.linearRampToValueAtTime(0, tb + beats * BEAT);
      osc.start(tb); osc.stop(tb + beats * BEAT + 0.05);
      tb += beats * BEAT;
    });

    // Gesamtdauer und nächster Loop
    const loopDauer = preset.melodie.reduce((s, [,b]) => s + b, 0) * BEAT * 1000;
    musikScheduleTimeout = setTimeout(scheduleLoop, loopDauer - 150);
  }

  scheduleLoop();
}

function stoppeMusik() {
  musikLaeuft = false;
  clearTimeout(musikScheduleTimeout);
  if (musikNode) {
    musikNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
  }
}

function musikLautstaerke(vol) {
  if (musikNode) musikNode.gain.setValueAtTime(vol, audioCtx.currentTime);
}

// ----------------------------------------------------------------
// SOUND-EFFEKTE  (je nach Event-Typ)
// ----------------------------------------------------------------

/** Positives Event / gute Aktion: kurzer heller Zweiklang */
function soundGut() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  playTone(523.25, 'sine',     now,        0.12, 0.25, 0.01, 0.05);  // C5
  playTone(659.25, 'sine',     now + 0.10, 0.15, 0.20, 0.01, 0.06);  // E5
  playTone(783.99, 'triangle', now + 0.20, 0.20, 0.18, 0.01, 0.08);  // G5
}

/** Neutrale Aktion / Info: einzelner mittlerer Klick */
function soundNeutral() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  playTone(440, 'sine', now, 0.08, 0.20, 0.005, 0.04);  // A4
}

/**
 * SCHLECHTES EVENT / Behörden-Warnung:
 *   Erschreckendes, absteigendes Alarm-Glissando
 *   + tiefer Donner-Rumble
 */
function soundAlarm() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Fallender Glissando-Sweep (Siren abwärts)
  const osc1 = audioCtx.createOscillator();
  const g1   = audioCtx.createGain();
  osc1.connect(g1); g1.connect(audioCtx.destination);
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(110, now + 0.8);
  g1.gain.setValueAtTime(0.4, now);
  g1.gain.linearRampToValueAtTime(0, now + 0.85);
  osc1.start(now); osc1.stop(now + 0.9);

  // Harter Attack-Knall
  const osc2 = audioCtx.createOscillator();
  const g2   = audioCtx.createGain();
  osc2.connect(g2); g2.connect(audioCtx.destination);
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(60, now);
  osc2.frequency.exponentialRampToValueAtTime(20, now + 0.3);
  g2.gain.setValueAtTime(0.5, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.start(now); osc2.stop(now + 0.4);

  // Rumble (tiefes Rauschen simuliert mit Noise-artigen Freq-Wechseln)
  for (let i = 0; i < 6; i++) {
    const t = now + i * 0.05;
    const f = 40 + Math.random() * 30;
    playTone(f, 'sawtooth', t, 0.08, 0.15 - i * 0.02, 0.005, 0.04);
  }

  // Musik kurz leiser während Alarm
  musikLautstaerke(0.15);
  setTimeout(() => musikLautstaerke(0.55), 1200);
}

/**
 * RAZZIA-SOUND: Sirene – zwei Töne wechselnd (typisch deutsch: 440/480 Hz)
 */
function soundRazzia() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  for (let i = 0; i < 6; i++) {
    const t    = now + i * 0.18;
    const freq = i % 2 === 0 ? 440 : 480;
    playTone(freq, 'square', t, 0.16, 0.35, 0.01, 0.05);
  }

  // Tiefer Begleit-Bass
  playTone(55, 'sawtooth', now, 1.2, 0.3, 0.05, 0.3);

  musikLautstaerke(0.1);
  setTimeout(() => musikLautstaerke(0.55), 1500);
}

/** Beziehungs-Event: melancholische fallende Terz */
function soundBeziehung() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  playTone(392.0, 'triangle', now,        0.25, 0.22, 0.02, 0.10);  // G4
  playTone(329.6, 'triangle', now + 0.20, 0.35, 0.18, 0.02, 0.15);  // E4
  playTone(261.6, 'sine',     now + 0.50, 0.45, 0.14, 0.03, 0.20);  // C4
}

/** Loan-Shark-Event: bedrohliche, tiefe Töne */
function soundShark() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // Tiefer Bedrohungs-Ton
  playTone(80,  'sawtooth', now,        0.3,  0.4,  0.02, 0.15);
  playTone(60,  'square',   now + 0.25, 0.25, 0.35, 0.01, 0.10);
  playTone(55,  'sawtooth', now + 0.45, 0.4,  0.3,  0.03, 0.20);
  // Knurren-Effekt
  for (let i = 0; i < 4; i++) {
    playTone(85 + i*5, 'sawtooth', now + i*0.12, 0.1, 0.2, 0.005, 0.05);
  }
}

/** Geldgeräusch (Kasse, Einzahlung): helles Klingeln */
function soundGeld() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [1047, 1319, 1568].forEach((f, i) => {
    playTone(f, 'sine', now + i * 0.07, 0.15, 0.25 - i*0.05, 0.005, 0.08);
  });
}

/** Game-Over-Sound: absteigend, finalistisch */
function soundGameOver() {
  if (!audioCtx) return;
  stoppeMusik();
  const now = audioCtx.currentTime;
  const noten = [440, 349, 294, 220, 165, 110];
  noten.forEach((f, i) => {
    playTone(f, 'sawtooth', now + i * 0.3, 0.35, 0.35 - i*0.04, 0.02, 0.15);
  });
}

// ----------------------------------------------------------------
// SOUND-DISPATCH: zentrale Funktion die aus triggerEvent aufgerufen wird
// ----------------------------------------------------------------
function spieleSoundFuerEvent(kategorie, istGutesErgebnis) {
  if (istGutesErgebnis) {
    soundGut();
    return;
  }
  switch (kategorie) {
    case 'behoerde':   soundAlarm();    break;
    case 'loan_shark': soundShark();    break;
    case 'beziehung':  soundBeziehung();break;
    default:           soundNeutral();  break;
  }
}

// ================================================================
// ABSCHNITT 9: EVENT-SCHEDULER
// ================================================================
function randomEventIntervall() { return 30 + Math.random() * 30; }

function waehleEvent() {
  const gs = gameState;
  const behoerden  = eventDatabase.filter(e => e.kategorie === 'behoerde');
  const beziehung  = eventDatabase.filter(e => e.kategorie === 'beziehung');

  // Loan-Shark-Events NUR wenn Schulden vorhanden
  const verfuegbar = gs.loanSharkSchuld > 0
    ? eventDatabase
    : eventDatabase.filter(e => e.kategorie !== 'loan_shark');

  // Bei hohem Risiko → Behörden-Events bevorzugt
  if (gs.risikoRaster >= 90 && Math.random() < 0.70)
    return behoerden[Math.floor(Math.random() * behoerden.length)];

  return verfuegbar[Math.floor(Math.random() * verfuegbar.length)];
}

function triggerEvent(event) {
  logEvent(`📨 "${event.titel}"`, event.kategorie === 'behoerde' ? 'danger' : 'warn');
  if (event.kategorie === 'behoerde') {
    const f = document.getElementById('danger-flash');
    if (f) { f.style.display = 'block'; setTimeout(() => { f.style.display = 'none'; }, 500); }
    soundAlarm();   // Erschreckender Alarm-Sound bei Behörden-Events
  } else if (event.kategorie === 'loan_shark') {
    soundShark();   // Bedrohlicher Ton bei Kredithai-Events
  } else if (event.kategorie === 'beziehung') {
    soundBeziehung(); // Melancholischer Ton bei Beziehungs-Events
  } else if (event.kategorie === 'alltag') {
    soundNeutral && soundNeutral();
  }
  oeffneEventModal(event);
}

function oeffneEventModal(event) {
  if (modalOffen) { modalQueue.push({ typ: 'event', event }); return; }   // anstellen
  modalOffen = true;
  _renderEventModal(event);
}

function _renderEventModal(event) {
  document.getElementById('modal-title').textContent = event.titel;
  const body = document.getElementById('modal-body');
  const kat = { behoerde: '🏛️ Behörden', loan_shark: '🦈 Kreditgeber', beziehung: '💑 Beziehung', alltag: '🎲 Alltag' }[event.kategorie] || '📨';
  body.innerHTML = `
    <p style="color:var(--text-dim);font-size:0.6rem;margin-bottom:8px;">${kat}</p>
    <p>${event.text}</p>
    <p style="margin-top:10px;color:var(--text-dim);font-size:0.65rem;">Wähle eine Option:</p>
  `;
  const btnA = document.createElement('button'); btnA.className = 'action-btn primary';
  btnA.textContent = `A: ${event.optionA.label}`; btnA.onclick = () => verarbeiteEventWahl(event, 'A');
  body.appendChild(btnA);
  const btnB = document.createElement('button'); btnB.className = 'action-btn';
  btnB.textContent = `B: ${event.optionB.label}`; btnB.onclick = () => verarbeiteEventWahl(event, 'B');
  body.appendChild(btnB);
  document.getElementById('modal-overlay').classList.add('active');
}

function verarbeiteEventWahl(event, wahl) {
  const gs = gameState;
  const option = wahl === 'A' ? event.optionA : event.optionB;
  const resultat = option.effekt(gs);
  logEvent(`↳ ${wahl}: ${resultat}`, gs.risikoRaster > 70 ? 'danger' : '');
  updateHUD();
  const body = document.getElementById('modal-body');
  body.innerHTML = `<p style="color:var(--text-dim);font-size:0.6rem;">Ergebnis:</p><p>${resultat}</p>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'action-btn primary'; closeBtn.textContent = '✅ Weiter';
  closeBtn.onclick = () => { schliesseModal(); pruefeRisiko(); };
  body.appendChild(closeBtn);
}

// ================================================================
// ABSCHNITT 10: HILFSFUNKTIONEN
// ================================================================
function isoToScreen(col, row, tileW, tileH, offsetX, offsetY) {
  return { x: offsetX + (col - row) * (tileW / 2), y: offsetY + (col + row) * (tileH / 2) };
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function formatEuro(n) { return (Math.round(n)).toLocaleString('de-DE') + ' €'; }
function logEvent(text, typ = '') {
  const log = document.getElementById('event-log');
  if (!log) return;
  const e = document.createElement('div');
  e.className = 'log-entry' + (typ ? ' ' + typ : '');
  e.textContent = text;
  log.insertBefore(e, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

// ================================================================
// ABSCHNITT 11: updateHUD  (wird bei jedem Tick und jeder Änderung aufgerufen)
// ================================================================
function updateHUD() {
  const gs = gameState;

  // ---- Zeit (Monat / Woche / Tag) ----
  const zeitEl = document.getElementById('hud-zeit');
  if (zeitEl) zeitEl.textContent = `M${gs.monat}  W${gs.woche}  T${gs.tag}`;
  const clock = document.getElementById('header-clock');
  if (clock) clock.textContent = `Monat ${gs.monat} · Woche ${gs.woche} · Tag ${gs.tag}`;

  // ---- "Vom Staat kassiert"-Counter ----
  const staatEl = document.getElementById('hud-vom-staat');
  if (staatEl) staatEl.textContent = formatEuro(gs.vomStaatGesamt || 0);

  // ---- Justiz / Vorstrafen-Status ----
  const justizRow = document.getElementById('justiz-row');
  const justizBadge = document.getElementById('justiz-badge');
  if (justizRow && justizBadge) {
    const stufen = {
      1: { txt: '📂 Ermittlung',  farbe: '#e8b84b' },
      2: { txt: '⚖️ Bewährung',   farbe: '#e8924b' },
      3: { txt: '🔒 Vorbestraft', farbe: '#e84b4b' },
    };
    const s = stufen[gs.strafStufe || 0];
    if (s) {
      justizRow.style.display = '';
      justizBadge.textContent = s.txt;
      justizBadge.style.color = s.farbe;
    } else {
      justizRow.style.display = 'none';
    }
  }

  // ---- Amtsbesuch-Countdown in TAGEN ----
  const amtBar = document.getElementById('bar-amtsbesuch');
  const amtVal = document.getElementById('val-amtsbesuch');
  if (amtBar && amtVal) {
    const maxTage = 14; // 2 Wochen = 14 Tage Intervall
    // Verbleibende Tage = Wochen × 7 minus bereits vergangene Tage in aktueller Woche
    const verbleibendeTage = Math.max(0,
      gs.naechsterAmtsBesuch * 7 - (gs.tag - 1)
    );
    const restPct = (verbleibendeTage / maxTage) * 100;
    amtBar.style.width      = clamp(restPct, 0, 100) + '%';
    amtBar.style.background = verbleibendeTage <= 0 ? '#e84b4b'
                            : verbleibendeTage <= 3 ? '#e8a84b'
                            : '#3dd6b0';
    amtVal.textContent = verbleibendeTage <= 0
      ? '⚠️FÄLLIG'
      : `${verbleibendeTage}T`;
    // Auch Label-Text aktualisieren
    const amtLabel = document.getElementById('label-amtsbesuch');
    if (amtLabel) amtLabel.textContent = verbleibendeTage <= 0
      ? '🏛️ Amt ⚠️'
      : `🏛️ Amt`;
  }

  // ---- Depot-Wert ----
  const depotDom = document.getElementById('hud-depot');
  if (depotDom) {
    const dw = gs.depot.reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
    gs.depotWert = dw;
    depotDom.textContent = dw > 0 ? formatEuro(Math.round(dw)) : '–';
    depotDom.style.color = dw > 0 ? 'var(--accent2)' : 'var(--text-dim)';
  }

  // ---- Loan-Shark-Schulden ----
  const lsDom = document.getElementById('hud-loanshark');
  if (lsDom) {
    lsDom.textContent = gs.loanSharkSchuld > 0 ? formatEuro(gs.loanSharkSchuld) : '–';
    lsDom.style.color = gs.loanSharkSchuld > 0 ? 'var(--danger)' : 'var(--text-dim)';
  }

  // ---- Konto ----
  const kDom = document.getElementById('hud-konto');
  if (kDom) {
    kDom.textContent = formatEuro(gs.kontostand);
    kDom.className   = 'mval mval-konto' + (gs.kontostand < 500 ? ' low' : '');
  }

  // ---- Schwarze Kasse ----
  const skDom = document.getElementById('hud-kasse');
  if (skDom) skDom.textContent = formatEuro(gs.schwarzeKasse);

  // ---- Loses Bargeld ----
  const lbDom = document.getElementById('hud-loses-bargeld');
  if (lbDom) {
    lbDom.textContent = formatEuro(gs.losesBargeld);
    lbDom.className   = 'mval mval-lose' + (gs.losesBargeld === 0 ? ' empty' : '');
  }

  // ---- Gesundheit ----
  setBar('gesundheit', gs.gesundheit,
    gs.gesundheit < 20 ? '#e84b4b' : gs.gesundheit < 40 ? '#e8a84b' : '#4be87a');
  const gesEl = document.getElementById('val-gesundheit');
  if (gesEl) gesEl.textContent = Math.round(gs.gesundheit);

  // ---- Lebensmittel-Balken ----
  const lmEl  = document.getElementById('hud-lebensmittel');
  const lmBar = document.getElementById('bar-lebensmittel');
  const lmVal = document.getElementById('val-lebensmittel');
  if (lmBar && lmVal) {
    const lm = gs.lebensmittelDiesenMonat;
    if (lm === 'gut') {
      lmBar.style.width = '100%'; lmBar.style.background = '#4be87a';
      lmVal.textContent = '🥗 Bio'; lmVal.style.color = '#4be87a';
    } else if (lm === 'normal') {
      lmBar.style.width = '65%';  lmBar.style.background = '#e8b84b';
      lmVal.textContent = '🥙 Normal'; lmVal.style.color = '#e8b84b';
    } else if (lm === 'billig') {
      lmBar.style.width = '30%';  lmBar.style.background = '#e87a4b';
      lmVal.textContent = '🍟 Billig'; lmVal.style.color = '#e87a4b';
    } else {
      lmBar.style.width = '0%';   lmBar.style.background = '#e84b4b';
      lmVal.textContent = gs.supermarktFaellig ? '⚠️ Fällig!' : '–';
      lmVal.style.color = gs.supermarktFaellig ? '#e84b4b' : 'var(--text-dim)';
    }
  }

  // ---- Gold ----
  const goldEl = document.getElementById('hud-gold');
  if (goldEl) {
    goldEl.textContent = gs.goldBarren > 0
      ? `${gs.goldBarren} Barren (${formatEuro(gs.goldBarren * 500)})`
      : '–';
    goldEl.style.color = gs.goldBarren > 0 ? '#ffd700' : 'var(--text-dim)';
  }

  // ---- Frau-Status ----
  const frauEl = document.getElementById('hud-frau');
  if (frauEl) {
    frauEl.textContent  = gs.frauAusgezogen ? '💔 Ausgezogen' : '💑 Zusammen';
    frauEl.style.color  = gs.frauAusgezogen ? 'var(--danger)' : 'var(--text-dim)';
  }

  // ---- Cheat-Extras (Immobilien + Kindergeld) ----
  const exDom = document.getElementById('hud-extras');
  if (exDom) {
    const kgAnzahl   = gs.kindergeldKinder ? gs.kindergeldKinder.length : 0;
    const kgBetrag   = kgAnzahl * 300;
    const gesamt     = gs.monatlicheExtras + kgBetrag;
    if (gesamt > 0) {
      const teile = [];
      if (kgBetrag > 0)            teile.push(`👶×${kgAnzahl}`);
      if (gs.monatlicheExtras > 0) teile.push('🏢');
      exDom.textContent = `+${formatEuro(gesamt)}/M ${teile.join(' ')}`;
      exDom.style.color = 'var(--accent2)';
    } else {
      exDom.textContent = '–';
      exDom.style.color = 'var(--text-dim)';
    }
  }

  // ---- Status-Badge ----
  const badge = document.getElementById('status-badge');
  if (badge) {
    if (gs.status === 'ALG2') {
      badge.textContent = '💶 Bürgergeld';
      badge.className   = 'badge-alg2';
    } else {
      badge.textContent = 'ALG I';
      badge.className   = 'badge-alg1';
    }
  }

  // ---- Statusbalken ----
  setBar('energie',       gs.energie,         '#3dd6b0');
  setBar('happy-spieler', gs.happinessSpieler, '#e8b84b');
  setBar('happy-partner', gs.happinessPartner,
    gs.happinessPartner < 30 ? '#e84b4b' : '#e84bb8');

  // Risiko-Balken: Farbe + Wahrscheinlichkeits-Label
  // Razzia-Chance pro Minute = risikoRaster^1.5 / 250  (0%…40%)
  const razziaChanceProMin = Math.min(40, Math.pow(gs.risikoRaster, 1.5) / 250);
  const rFarbe = gs.risikoRaster >= 90 ? '#e84b4b'
               : gs.risikoRaster >= 60 ? '#e8a84b'
               : gs.risikoRaster >= 30 ? '#e8e84b'
               : '#4be8b8';
  setBar('risiko', gs.risikoRaster, rFarbe);

  // Wert-Anzeige: zeigt Razzia-% statt rohen Wert
  const rValEl = document.getElementById('val-risiko');
  if (rValEl) {
    rValEl.textContent = razziaChanceProMin < 1
      ? '<1%'
      : Math.round(razziaChanceProMin) + '%';
    rValEl.title = `Razzia-Chance: ~${razziaChanceProMin.toFixed(1)}% pro Minute`;
  }

  // Risiko-Label im HUD aktualisieren
  const rLabel = document.getElementById('label-risiko');
  if (rLabel) {
    rLabel.textContent = gs.risikoRaster >= 90 ? '🚨 KRITISCH'
                       : gs.risikoRaster >= 60 ? '⚠️ Erhöht'
                       : gs.risikoRaster >= 30 ? '🟡 Mittel'
                       : '🟢 Niedrig';
  }

  // Track: Glow + Blink bei kritisch
  const rTrack = document.getElementById('track-risiko');
  if (rTrack) rTrack.classList.toggle('danger-glow', gs.risikoRaster >= 90);
  const rBar = document.getElementById('bar-risiko');
  if (rBar) rBar.style.animation = gs.risikoRaster >= 90 ? 'risikoBlinkAnim 0.8s infinite' : 'none';

  // tickRazziaTimer nutzt jetzt korrelierte Chance:
  // gespeichert als gameState.razziaChanceAktuell
  gs.razziaChanceAktuell = razziaChanceProMin / 100 / 60; // Chance pro Sekunde

  // ---- Ehe-Krise Indikator ----
  const eheEl = document.getElementById('hud-ehe-krise');
  if (eheEl) {
    if (gs.eheKriseAktiv) {
      eheEl.textContent  = `💔 Ehe-Krise  Schritt ${gs.eheKriseSchritt} / 5`;
      eheEl.style.display = 'block';
    } else {
      eheEl.style.display = 'none';
    }
  }

  // ---- Musik-Modus aktualisieren (je nach Stimmung) ----
  aktualisiereMusikModus && aktualisiereMusikModus();
  // ---- Wetter-Badge (wird von SpielSzene gesetzt, hier nur sicherstellen) ----
}

function setBar(id, wert, farbe) {
  const fill = document.getElementById('bar-' + id);
  const val  = document.getElementById('val-' + id);
  if (!fill || !val) return;
  fill.style.width = clamp(wert, 0, 100) + '%';
  fill.style.background = farbe;
  val.textContent = Math.round(clamp(wert, 0, 100));
}

// ================================================================
// ABSCHNITT 12: MODAL-SYSTEM
// ================================================================
let modalOffen = false;
let modalQueue = [];   // Warteschlange, damit sich Popups nicht überschreiben

// Zeigt das nächste Modal aus der Warteschlange – oder schließt das Overlay.
function _modalNaechstes() {
  if (modalQueue.length > 0) {
    const next = modalQueue.shift();
    modalOffen = true;
    if (next.typ === 'event') _renderEventModal(next.event);
    else                      _renderStdModal(next);
  } else {
    document.getElementById('modal-overlay').classList.remove('active');
    modalOffen = false;
  }
}

function oeffneModal(titel, beschreibungHTML, aktionen, schliessenCallback) {
  const item = { typ: 'std', titel, beschreibungHTML, aktionen: aktionen || [], schliessenCallback };
  if (modalOffen) { modalQueue.push(item); return; }   // läuft schon eins → anstellen
  modalOffen = true;
  _renderStdModal(item);
}

function _renderStdModal(item) {
  document.getElementById('modal-title').textContent = item.titel;
  const body = document.getElementById('modal-body');
  body.innerHTML = `<p>${item.beschreibungHTML}</p>`;
  item.aktionen.forEach(a => {
    const btn = document.createElement('button');
    btn.className   = 'action-btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger-btn' : '');
    btn.textContent = a.label;
    btn.onclick = () => {
      const titelVorher = document.getElementById('modal-title').textContent;
      a.callback();
      const titelNachher = document.getElementById('modal-title').textContent;
      if (titelVorher === titelNachher) schliesseModal();
    };
    body.appendChild(btn);
  });
  const closeBtn = document.createElement('button');
  closeBtn.id          = 'modal-close-btn';
  closeBtn.textContent = '✕ Schließen (ESC)';
  closeBtn.onclick = () => { if (item.schliessenCallback) item.schliessenCallback(); schliesseModal(); };
  body.appendChild(closeBtn);
  document.getElementById('modal-overlay').classList.add('active');
}

function schliesseModal() {
  modalOffen = false;
  _modalNaechstes();   // ggf. nächstes wartendes Popup zeigen
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOffen && !gameState.gameOver) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay.querySelector('.event-lock')) schliesseModal();
  }
});

// ================================================================
// ABSCHNITT 13: ORTE-INTERAKTION
// ================================================================
function interact(ortId) {
  const ort = ORTE_CONFIG.find(o => o.id === ortId);
  if (!ort) return;
  const gs = gameState;

  // Villa nur bewohnbar, wenn die Immobilie selbst genutzt wird
  if (ortId === 'villa' && !(gs.immobilie && gs.immobilie.modus === 'eigen')) {
    oeffneModal('🏖️ Leeres Baugrundstück',
      'Hier könnte deine Villa stehen!<br><br>'
      + 'Kaufe bei der <strong>Schattenbank</strong> eine Immobilie und stelle sie auf <strong>Eigennutzung</strong> – dann ziehst du hier ein.', []);
    return;
  }

  const aktionen = ort.aktionen.map(a => {
    // Dynamische Labels für kontextabhängige Infos
    let label = a.label;
    if (ortId === 'loanshark' && a.id === 'schulden_zahlen') {
      const schulden = gs.loanSharkSchuld || 0;
      label = schulden > 0
        ? `💸  Schulden zurückzahlen (aktuell: ${formatEuro(schulden)})`
        : '💸  Schulden zurückzahlen (keine Schulden)';
    }
    if (ortId === 'supermarkt' && a.id === 'geschenk') {
      const bereits = gs.geschenkeSumme || 0;
      label = `🎁  Geschenk kaufen (500€ · bereits: ${formatEuro(bereits)} / 5.000€)`;
    }
    if (ortId === 'bank' && a.id === 'einzahlen') {
      const limit  = 200;
      const uebrig = limit - (gs.bankEinzahlungDieseWoche || 0);
      label = `💳  Bargeld einzahlen → Konto (Limit: ${formatEuro(Math.max(0,uebrig))}/Woche)`;
    }
    // Pfandleiher: Verpfänden ⇄ Auslösen je nach Zustand
    if (ortId === 'pawn' && a.id.startsWith('pfand_')) {
      const itemId = a.id.slice(6);
      const item   = PFAND_ITEMS[itemId];
      if (item) {
        if (gs.verpfaendet[itemId]) {
          const kosten = Math.round(item.wert * PFAND_ZINS);
          label = `${item.name} auslösen (${formatEuro(kosten)} · +25% Zins)`;
        } else {
          label = `${item.name} verpfänden (+${formatEuro(item.wert)} → Konto, Laune −${item.laune})`;
        }
      }
    }
    if (ortId === 'pawn' && a.id === 'gold_verkaufen') {
      const n = gs.goldBarren || 0;
      label = `🥇  Gold ausgraben & verkaufen (${n} Barren · ${formatEuro(n * 500)})`;
    }
    // Arbeitsamt: Mehrbedarfe zeigen Aktiv-Status
    if (ortId === 'arbeitsamt' && a.id.startsWith('mb_')) {
      const key = a.id.slice(3);
      if (gs.mehrbedarf && gs.mehrbedarf[key]) {
        const fake = (key === 'ernaehrung' && gs.ernaehrungFake) ? ' ⚠️gefälscht' : '';
        label = label.replace(/^(\S+\s+\S+)/, '$1') + '  ✅ aktiv' + fake;
      }
    }
    if (ortId === 'arbeitsamt' && a.id === 'einstiegsgeld' && gs.einstiegsgeldMonate > 0) {
      label = `🚀  Einstiegsgeld läuft (noch ${gs.einstiegsgeldMonate} Monate · +${EINSTIEGSGELD_BETRAG} €/M)`;
    }
    if (ortId === 'supermarkt' && a.id === 'minijob') {
      label = gs.minijobLohn > 0
        ? `💼  Minijob aktiv (${formatEuro(gs.minijobLohn)}/M · ändern/kündigen)`
        : '💼  Minijob annehmen (legales Einkommen mit Freibetrag)';
    }
    if (ortId === 'schattenbank' && a.id === 'unterhalts_tarnung') {
      label = gs.unterhaltsTarnung
        ? '🌍  Unterhalts-Tarnung AKTIV (abschalten)'
        : '🌍  Unterhalts-Tarnung aktivieren (Auslands-Kindergeld behalten)';
    }
    if (ortId === 'schattenbank' && a.id === 'immo_kaufen' && gs.immobilie) {
      const rs = gs.immobilie.restSchuld || 0;
      label = `🏘️  Immobilie: Wert ${formatEuro(gs.immobilie.wert)}${rs > 0 ? ` · Restschuld ${formatEuro(rs)}` : ' · schuldenfrei'}`;
    }
    if (ortId === 'schattenbank' && a.id === 'immo_modus' && gs.immobilie) {
      label = gs.immobilie.modus === 'eigen'
        ? '🔑  Modus: Eigennutzung → auf Vermieten umschalten'
        : '🔑  Modus: Vermietet → auf Eigennutzung umschalten';
    }
    if (ortId === 'schattenbank' && a.id === 'immo_tilgen' && gs.immobilie) {
      const rs = gs.immobilie.restSchuld || 0;
      label = rs > 0 ? `🏦  Sofort tilgen (Restschuld ${formatEuro(rs)})` : '🏦  Bereits schuldenfrei';
    }
    if (ortId === 'schattenbank' && a.id === 'immo_verkaufen' && gs.immobilie) {
      const netto = Math.max(0, Math.round(gs.immobilie.wert) - (gs.immobilie.restSchuld || 0));
      label = `💰  Immobilie verkaufen (netto ${formatEuro(netto)} → Schwarzkasse)`;
    }
    if (ortId === 'schattenbank' && a.id === 'depot_verschleiern') {
      label = gs.depotVerschleiert
        ? '📈  Depot verschleiert AKTIV (wieder offiziell machen)'
        : '📈  Depot verschleiern (Amt-unsichtbar, 5%/Monat)';
    }
    if (ortId === 'wohnung' && a.id === 'anwalt') {
      label = (gs.strafStufe || 0) > 0
        ? `⚖️  Anwalt anrufen (Status: ${strafStufeName(gs.strafStufe)})`
        : '⚖️  Anwalt anrufen (keine Probleme)';
    }
    if (ortId === 'wohnung' && a.id === 'auswandern') {
      const v = gesamtVermoegen();
      label = v >= AUSWANDERN_GRENZE
        ? '✈️  AUSWANDERN – du kannst gewinnen!'
        : `✈️  Auswandern (${formatEuro(v)} / ${formatEuro(AUSWANDERN_GRENZE)})`;
    }
    if (ortId === 'arbeitsamt' && a.id === 'sachbearbeiter') {
      label = gs.sachbearbeiterBestochen
        ? '🤝  Sachbearbeiter geschmiert AKTIV (beenden)'
        : '🤝  Sachbearbeiter schmieren (150 €/M)';
    }
    // Wohnung: Kur / Schein-WG / Umzug
    if (ortId === 'wohnung' && a.id === 'kur') {
      label = gs.monat < gs.kurCooldownMonat
        ? `🏖️  Kur (erst wieder ab Monat ${gs.kurCooldownMonat})`
        : '🏖️  Kur beantragen (volle Erholung)';
    }
    if (ortId === 'wohnung' && a.id === 'scheinwg') {
      label = gs.scheinWG
        ? '🏠  Schein-WG AKTIV (abmelden)'
        : `🏠  Schein-WG deklarieren (+${SCHEINWG_BETRAG} €/M, riskant)`;
    }
    if (ortId === 'wohnung' && a.id === 'umzug' && gs.kautionRest > 0) {
      label = `📦  Umzug (Kaution-Darlehen läuft: ${formatEuro(gs.kautionRest)})`;
    }
    // Arbeitsamt: Pauschalen Status
    if (ortId === 'arbeitsamt' && a.id === 'pausch_erstausstattung' && gs.pauschalen.erstausstattung) {
      label = '🛋️  Erstausstattung Wohnung  ✅ bezogen';
    }
    if (ortId === 'arbeitsamt' && a.id === 'pausch_moebel' && gs.pauschalen.moebel) {
      label = '🪑  Möbel/Schreibtisch fürs Kind  ✅ bezogen';
    }
    return { label, callback: () => aktionAusfuehren(ortId, a.id) };
  });

  // Gebäude-Beschreibung dynamisch anreichern
  let beschreibung = ort.beschreibung;
  if (ortId === 'loanshark' && (gs.loanSharkSchuld || 0) > 0) {
    beschreibung += `<br><br>⚠️ Aktuelle Schulden: <strong style="color:#e84b4b">${formatEuro(gs.loanSharkSchuld)}</strong> (Zinsen: 10%/Monat)`;
  }
  if (ortId === 'pawn' && (gs.goldBarren || 0) > 0) {
    beschreibung += `<br><br>🥇 Im Garten vergraben: <strong>${gs.goldBarren} Barren</strong> (${formatEuro(gs.goldBarren * 500)})`;
  }
  if (ortId === 'supermarkt') {
    const einkauf = gs.lebensmittelDiesenMonat;
    beschreibung += einkauf
      ? `<br><br>✅ Diesen Monat eingekauft: <strong>${einkauf === 'gut' ? 'Bio 🥗' : einkauf === 'normal' ? 'Normal 🥙' : 'Billig 🍟'}</strong>`
      : `<br><br>⚠️ <strong>Noch kein Einkauf</strong> diesen Monat!`;
  }

  oeffneModal(ort.name, beschreibung, aktionen);
}

/**
 * Lässt einen oder mehrere Tage vergehen.
 * Wenn Tag > 7, rückt die Spielwoche vor.
 * (Die Phaser-Szene zählt die echte Zeit – dies ist nur für
 *  aktivitätsbasierte Tagessprünge, z.B. Arbeiten, Schlafen.)
 */
function verbraucheTag(anzahl) {
  const gs = gameState;
  for (let i = 0; i < anzahl; i++) {
    gs.tag++;
    if (gs.tag > 7) {
      gs.tag = 1;
      // Woche vorziehen – Phaser-Loop wird synchronisiert
      // (zeitAkku in SpielSzene bleibt unverändert, Woche wird manuell getriggert)
      gs.woche++;
      gs.naechsterAmtsBesuch = Math.max(0, gs.naechsterAmtsBesuch - 1);
      if (gs.naechsterAmtsBesuch <= 0) {
        gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100);
        gs.naechsterAmtsBesuch = 2;
        logEvent('⚠️ Pflichttermin beim Amt verpasst! Risiko +15.', 'danger');
      }
    }
    // Kleine Energie-Regeneration über Nacht (wenn Tag auf 1 zurückspringt)
    if (gs.tag === 1) {
      gs.energie = clamp(gs.energie + 5, 0, 100);
    }
  }
  updateHUD();
}

function aktionAusfuehren(ortId, aktionsId) {
  const gs = gameState;

  // ---- ENERGIE-CHECK: Bei 0 Energie nur Schlafen erlaubt ----
  if (gs.energie <= 0 && !(ortId === 'wohnung' && aktionsId === 'schlafen')) {
    oeffneModal('😴 Völlig erschöpft!',
      'Du hast <strong>0 Energie</strong> und kannst nichts mehr tun.<br><br>' +
      'Geh nach Hause und schlafe, um wieder handlungsfähig zu sein!',
      []
    );
    soundAlarm && soundAlarm();
    return;
  }

  // --- WOHNUNG ---
  if (ortId === 'wohnung') {
    if (aktionsId === 'schlafen') {
      // Basis-Energiegewinn
      let energieGewinn = 25;
      let schlafMeldung = '💤 Geschlafen. ';

      // Bonus: Eigene Stimmung hoch → man schläft besser
      if (gs.happinessSpieler > 60) {
        energieGewinn += 10;
        schlafMeldung += '+10 Bonus (gute Laune). ';
      }
      // Malus: Partnerstreit → schlechter Schlaf
      if (gs.happinessPartner < 40) {
        energieGewinn -= 5;
        schlafMeldung += '-5 Malus (Streit mit Partner). ';
      }

      gs.energie = clamp(gs.energie + energieGewinn, 0, 100);
      verbraucheTag(1);
      schlafMeldung += `Energie +${energieGewinn}. 1 Tag vergangen.`;
      logEvent(schlafMeldung, energieGewinn >= 25 ? 'good' : 'warn');
    }
    if (aktionsId === 'verstecken') {
      const b = Math.min(500, gs.kontostand);
      if (b <= 0) { logEvent('⚠️ Kein Geld zum Verstecken.', 'warn'); return; }
      gs.kontostand -= b; gs.schwarzeKasse += b;
      logEvent(`💵 ${formatEuro(b)} versteckt.`, 'good');
    }
    if (aktionsId === 'holen') {
      const b = Math.min(500, gs.schwarzeKasse);
      if (b <= 0) { logEvent('⚠️ Schwarze Kasse leer.', 'warn'); return; }
      gs.schwarzeKasse -= b; gs.kontostand += b;
      logEvent(`💵 ${formatEuro(b)} aufs Konto.`, 'good');
    }
    // ---- Kur / Sanatorium: volle Erholung, Cooldown 3 Monate ----
    if (aktionsId === 'kur') {
      if (gs.monat < gs.kurCooldownMonat) {
        oeffneModal('🏖️ Noch keine neue Kur', `Erst ab Monat ${gs.kurCooldownMonat} bekommst du wieder eine Kur bewilligt.`, []);
        return;
      }
      const attestKosten = 300;
      oeffneModal('🏖️ Kur – nur mit Attest',
        `Eine Kur gibt's nur mit ärztlichem Attest. Ein <strong>gefälschtes Attest</strong> vom willigen Arzt kostet <strong>${formatEuro(attestKosten)}</strong> und erhöht das Risiko (+12).<br><br>`
        + 'Dafür: 3 Wochen Reha auf Kassenkosten – du kommst topfit zurück (Energie & Gesundheit voll, Laune +20).',
        [{ label: `🩺 Gefälschtes Attest besorgen (${formatEuro(attestKosten)})`, danger: true, callback: () => {
            if (gs.kontostand < attestKosten) { logEvent('⚠️ Nicht genug Geld fürs Attest.', 'warn'); return; }
            gs.kontostand      -= attestKosten;
            gs.risikoRaster     = clamp(gs.risikoRaster + 12, 0, 100);
            gs.energie          = 100;
            gs.gesundheit       = 100;
            gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100);
            gs.kurCooldownMonat = gs.monat + 3;
            verbraucheTag(7);
            logEvent('🏖️ Kur (gefälschtes Attest): Energie & Gesundheit voll, Laune +20. Risiko +12.', 'warn');
            oeffneModal('🏖️ Ab in die Kur!', 'Drei Wochen Reha auf Kassenkosten – topfit zurück. Das Bürgergeld lief unverändert weiter.', []);
          }}]);
      return;
    }
    // ---- Schein-WG: voller Single-Satz, aber Prüf-Risiko ----
    if (aktionsId === 'scheinwg') {
      if (gs.scheinWG) {
        gs.scheinWG = false;
        logEvent('🏠 Schein-WG abgemeldet.', '');
        return;
      }
      if (gs.frauAusgezogen) {
        oeffneModal('🏠 Keine Mitbewohnerin', 'Eine Schein-WG kannst du nur deklarieren, solange eine Partnerin bei dir wohnt.', []);
        return;
      }
      gs.scheinWG = true;
      oeffneModal('🏠 Schein-WG deklariert',
        `Du meldest die Beziehung als reine Wohngemeinschaft – beide behalten den vollen Single-Satz: <strong>+${SCHEINWG_BETRAG} €/Monat</strong>.<br><br>`
        + '⚠️ Risiko: bei der <strong>Jobcenter-Prüfung</strong> kommt der Außendienst zum unangekündigten Hausbesuch!', []);
      logEvent(`🏠 Schein-WG aktiv: +${SCHEINWG_BETRAG} €/Monat (riskant).`, 'warn');
      return;
    }
    // ---- Umzug: einmalig Cash, dafür Kaution-Darlehen + schaltet Erstausstattung frei ----
    if (aktionsId === 'umzug') {
      if (gs.kautionRest > 0) {
        oeffneModal('📦 Darlehen läuft noch', `Zahle erst das laufende Kaution-Darlehen (${formatEuro(gs.kautionRest)}) ab, bevor du wieder umziehst.`, []);
        return;
      }
      const pauschale = 450;
      gs.kontostand += pauschale; staatGibt(pauschale);
      gs.kautionRest = 900;
      gs.umzugGemacht = true;
      gs.pauschalen.erstausstattung = false;   // neue Wohnung → Erstausstattung wieder beantragbar
      oeffneModal('📦 Umzug!',
        `Umzugs- & Renovierungspauschale: <strong>+${formatEuro(pauschale)}</strong> sofort.<br><br>`
        + `Die Mietkaution (${formatEuro(gs.kautionRest)}) ist ein Darlehen und wird in Raten von ${formatEuro(KAUTION_RATE)}/Monat abgezogen.<br><br>`
        + '💡 Tipp: Jetzt am Arbeitsamt die <strong>Erstausstattung Wohnung</strong> beantragen!', []);
      logEvent(`📦 Umzug: +${formatEuro(pauschale)}, Kaution-Darlehen ${formatEuro(gs.kautionRest)}.`, 'warn');
      return;
    }
    // ---- Anwalt / Strafverteidiger: Strafstufe anfechten ----
    if (aktionsId === 'anwalt') {
      if ((gs.strafStufe || 0) === 0) {
        oeffneModal('⚖️ Strafverteidiger', 'Du hast aktuell keine juristischen Probleme. Melde dich, wenn gegen dich ermittelt wird.', []);
        return;
      }
      const gebuehr = 2000 + 1500 * gs.strafStufe;
      oeffneModal('⚖️ Strafverteidiger',
        `Aktueller Status: <strong>${strafStufeName(gs.strafStufe)}</strong>.<br><br>`
        + `Ein guter Anwalt kann die Stufe um eine senken – Honorar <strong>${formatEuro(gebuehr)}</strong>, Erfolgschance <strong>65 %</strong> (bei Misserfolg ist das Honorar weg).`,
        [{ label: `⚖️ Beauftragen (${formatEuro(gebuehr)})`, primary: true, callback: () => {
            if (gs.kontostand < gebuehr) { logEvent('⚠️ Nicht genug Geld fürs Anwaltshonorar.', 'warn'); return; }
            gs.kontostand -= gebuehr;
            if (Math.random() < 0.65) {
              gs.strafStufe = Math.max(0, gs.strafStufe - 1);
              logEvent('⚖️ Anwalt erfolgreich – Strafe gemildert.', 'good');
              oeffneModal('⚖️ Erfolg!', `Dein Anwalt hat ganze Arbeit geleistet.<br><br>Neuer Status: <strong>${strafStufeName(gs.strafStufe)}</strong>.`, []);
            } else {
              logEvent('⚖️ Anwalt gescheitert – Honorar futsch.', 'danger');
              oeffneModal('⚖️ Abgewiesen', `Der Antrag wurde abgelehnt. Das Honorar (${formatEuro(gebuehr)}) ist weg, der Status bleibt.`, []);
            }
            updateHUD();
          }}]);
      return;
    }
    // ---- Auswandern: Sieg ab AUSWANDERN_GRENZE Gesamtvermögen ----
    if (aktionsId === 'auswandern') {
      const v = gesamtVermoegen();
      if (v < AUSWANDERN_GRENZE) {
        oeffneModal('✈️ Auswandern',
          `Um dich endgültig abzusetzen, brauchst du <strong>${formatEuro(AUSWANDERN_GRENZE)}</strong> Gesamtvermögen (inkl. Gold, Schwarzkasse, Depot, Immobilie).<br><br>`
          + `Aktuell: <strong>${formatEuro(v)}</strong> – es fehlen noch <strong>${formatEuro(AUSWANDERN_GRENZE - v)}</strong>.`, []);
        return;
      }
      gs.gameOver = true;
      soundGut && soundGut();
      oeffneModal('🏆 Ausgewandert – Gewonnen!',
        `<div style="text-align:center; padding:10px 0;">
          <div style="font-size:2rem; margin-bottom:10px;">🏝️ ✈️ 🍹</div>
          <strong>Du hast es geschafft!</strong><br><br>
          Mit <strong style="color:#ffd700; font-size:1.1rem;">${formatEuro(v)}</strong> setzt du dich ins sonnige Ausland ab.<br>
          Kein Amt, keine Razzia, kein Knast – nur Strand.<br><br>
          Vom Arbeitslosen zum Millionär. <strong>Der Staat hat verloren.</strong>
        </div>`,
        [{ label: '🔄 Neues Spiel', primary: true, callback: () => {
            window._phaserGameRef && window._phaserGameRef.scene.stop('SpielSzene');
            window._phaserGameRef && window._phaserGameRef.scene.start('StartSzene');
          }}]);
      logEvent(`🏆 Ausgewandert mit ${formatEuro(v)} – gewonnen!`, 'good');
      return;
    }
    if (aktionsId === 'cheats_menu') { oeffneCheatMenu(); return; }
  }

  // --- ARBEITSAMT ---
  if (ortId === 'arbeitsamt') {
    if (aktionsId === 'pflichttermin') {
      gs.naechsterAmtsBesuch = 2;
      gs.amtsTermineVerpasst = 0;
      gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100);
      if (gs.algGesperrt) {
        gs.algGesperrt = false;
        logEvent('✅ ALG-Sperre aufgehoben! Ab nächstem Monat wieder normale Zahlung. Risiko -5.', 'good');
        oeffneModal('✅ Sperre aufgehoben!',
          'Du hast das Amt besucht. Die ALG-Sperre ist aufgehoben.<br><br>'
          + 'Ab nächstem Monat erhältst du wieder normale Zahlungen.', []);
      } else {
        logEvent('📋 Pflichttermin erledigt. Risiko -5.', 'good');
      }
    }
    if (aktionsId === 'scheinbewerbung') {
      gs.scheinbewerbungen++;
      gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100);
      logEvent(`📝 Scheinbewerbung Nr.${gs.scheinbewerbungen}. Risiko -5.`, 'good');
    }

    // ---- Mehrbedarf: Warmwasser (legal, ohne Bedingung) ----
    if (aktionsId === 'mb_warmwasser') {
      if (gs.mehrbedarf.warmwasser) { logEvent('ℹ️ Warmwasser-Mehrbedarf läuft bereits.', ''); return; }
      gs.mehrbedarf.warmwasser = true;
      logEvent(`🚿 Warmwasser-Mehrbedarf bewilligt: +${MEHRBEDARF_BETRAG.warmwasser} €/Monat.`, 'good');
    }
    // ---- Mehrbedarf: Alleinerziehend (braucht ≥1 Kind) ----
    if (aktionsId === 'mb_alleinerziehend') {
      if (gs.mehrbedarf.alleinerziehend) { logEvent('ℹ️ Mehrbedarf Alleinerziehend läuft bereits.', ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal('👨‍👧 Kein Kind gemeldet', 'Den Mehrbedarf für Alleinerziehende gibt es nur mit mindestens einem Kind. Hol dir erst über den Kindergeld-Trick (Wohnung → Cheats) ein Kind.', []);
        return;
      }
      gs.mehrbedarf.alleinerziehend = true;
      logEvent(`👨‍👧 Mehrbedarf Alleinerziehend bewilligt: +${MEHRBEDARF_BETRAG.alleinerziehend} €/Monat.`, 'good');
    }
    // ---- Bildung & Teilhabe (braucht ≥1 Kind) ----
    if (aktionsId === 'mb_but') {
      if (gs.mehrbedarf.but) { logEvent('ℹ️ Bildung & Teilhabe läuft bereits.', ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal('🎒 Kein Kind gemeldet', 'Bildung & Teilhabe gibt es nur für gemeldete Kinder.', []);
        return;
      }
      gs.mehrbedarf.but = true;
      logEvent(`🎒 Bildung & Teilhabe bewilligt: +${MEHRBEDARF_BETRAG.but} €/Monat.`, 'good');
    }
    // ---- Ernährungs-Mehrbedarf: echtes oder gefälschtes Attest ----
    if (aktionsId === 'mb_ernaehrung') {
      if (gs.mehrbedarf.ernaehrung) { logEvent('ℹ️ Ernährungs-Mehrbedarf läuft bereits.', ''); return; }
      oeffneModal('🥗 Ernährungs-Mehrbedarf',
        `Für +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat brauchst du ein ärztliches Attest (z. B. Zöliakie).`,
        [
          { label: '🩺 Echtes Attest besorgen (50 €, legal)', callback: () => {
              if (gs.kontostand < 50) { logEvent('⚠️ Nicht genug Geld für das Attest (50 €).', 'warn'); return; }
              gs.kontostand -= 50;
              gs.mehrbedarf.ernaehrung = true;
              gs.ernaehrungFake = false;
              logEvent(`🥗 Ernährungs-Mehrbedarf (echtes Attest): +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat.`, 'good');
              updateHUD();
            } },
          { label: '🖊️ Attest fälschen (gratis, Prüf-Risiko!)', danger: true, callback: () => {
              gs.mehrbedarf.ernaehrung = true;
              gs.ernaehrungFake = true;
              logEvent(`🥗 Ernährungs-Mehrbedarf (gefälscht): +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat – riskant!`, 'warn');
              updateHUD();
            } },
        ]);
      return;
    }
    // ---- Einstiegsgeld / Gründerbonus ----
    if (aktionsId === 'einstiegsgeld') {
      if (gs.einstiegsgeldMonate > 0) { logEvent(`ℹ️ Einstiegsgeld läuft noch ${gs.einstiegsgeldMonate} Monate.`, ''); return; }
      oeffneModal('🚀 Einstiegsgeld (Gründerbonus)',
        `Gründe eine Selbstständigkeit. Kostet einmalig <strong>${formatEuro(EINSTIEGSGELD_KOSTEN)}</strong> (Steuerberater + Businessplan).<br><br>`
        + `Dann: <strong>+${EINSTIEGSGELD_BETRAG} €/Monat</strong> für ${EINSTIEGSGELD_DAUER} Monate (anrechnungsfrei) + einmaliger Investitions-Zuschuss von <strong>${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}</strong>.`,
        [
          { label: `🚀 Gründen (${formatEuro(EINSTIEGSGELD_KOSTEN)})`, primary: true, callback: () => {
              if (gs.kontostand < EINSTIEGSGELD_KOSTEN) { logEvent('⚠️ Nicht genug Geld zum Gründen (800 €).', 'warn'); return; }
              gs.kontostand -= EINSTIEGSGELD_KOSTEN;
              gs.kontostand += EINSTIEGSGELD_ZUSCHUSS; staatGibt(EINSTIEGSGELD_ZUSCHUSS);
              gs.einstiegsgeldMonate = EINSTIEGSGELD_DAUER;
              logEvent(`🚀 Einstiegsgeld bewilligt! Zuschuss +${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}, dann +${EINSTIEGSGELD_BETRAG} €/M für ${EINSTIEGSGELD_DAUER} Monate.`, 'good');
              updateHUD();
            } },
        ]);
      return;
    }
    // ---- Einmalige Pauschalen ----
    if (aktionsId === 'pausch_erstausstattung') {
      if (gs.pauschalen.erstausstattung) { logEvent('ℹ️ Erstausstattung wurde bereits bezogen.', ''); return; }
      if (!gs.umzugGemacht) {
        oeffneModal('🛋️ Kein Anspruch', 'Die Wohnungs-Erstausstattung gibt es nur nach einem Umzug / Erstbezug (Wohnung → Umzug).', []);
        return;
      }
      gs.kontostand += 1200; staatGibt(1200);
      gs.pauschalen.erstausstattung = true;
      logEvent('🛋️ Erstausstattung Wohnung bewilligt: +1.200 €.', 'good');
    }
    if (aktionsId === 'pausch_moebel') {
      if (gs.pauschalen.moebel) { logEvent('ℹ️ Möbel-Zuschuss wurde bereits bezogen.', ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal('🪑 Kein Kind gemeldet', 'Den Möbel-Zuschuss (Jugendbett/Schreibtisch) gibt es nur fürs Kind.', []);
        return;
      }
      gs.kontostand += 250; staatGibt(250);
      gs.pauschalen.moebel = true;
      logEvent('🪑 Möbel/Schreibtisch fürs Kind: +250 €.', 'good');
    }
    if (aktionsId === 'pausch_bekleidung') {
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal('👕 Kein Kind gemeldet', 'Die Kinder-Bekleidungspauschale gibt es nur fürs Kind.', []);
        return;
      }
      if (gs.monat < gs.bekleidungCooldownMonat) {
        oeffneModal('👕 Noch zu früh', `Die Bekleidungspauschale gibt es nur alle 6 Monate – wieder ab Monat ${gs.bekleidungCooldownMonat}.`, []);
        return;
      }
      gs.kontostand += 150; staatGibt(150);
      gs.bekleidungCooldownMonat = gs.monat + 6;
      logEvent('👕 Kinder-Bekleidung: +150 €.', 'good');
    }
    // ---- Korrupter Sachbearbeiter schmieren ----
    if (aktionsId === 'sachbearbeiter') {
      if (gs.sachbearbeiterBestochen) {
        gs.sachbearbeiterBestochen = false;
        logEvent('🤝 Schmiergeld eingestellt.', '');
        return;
      }
      gs.sachbearbeiterBestochen = true;
      oeffneModal('🤝 Sachbearbeiter geschmiert',
        `Dein Sachbearbeiter drückt künftig beide Augen zu: <strong>halbe Entdeckungschance</strong> bei der Jobcenter-Prüfung.<br><br>`
        + `Kostet <strong>${formatEuro(SACHBEARBEITER_KOSTEN)}/Monat</strong>. Kannst du mal nicht zahlen, ist der Deal sofort geplatzt.`, []);
      logEvent(`🤝 Sachbearbeiter bestochen (${formatEuro(SACHBEARBEITER_KOSTEN)}/Monat).`, 'warn');
      return;
    }
  }

  // --- BAUSTELLE --- NEU v3: Einnahmen gehen in losesBargeld, nicht schwarzeKasse
  if (ortId === 'baustelle') {
    if (aktionsId === 'schwarzarbeit') {
      gs.losesBargeld += 300;
      gs.risikoRaster  = clamp(gs.risikoRaster + 12, 0, 100);
      gs.energie       = clamp(gs.energie - 20, 0, 100);
      verbraucheTag(1);
      logEvent('⛏️ +300 € loses Bargeld. Risiko +12, E -20. 1 Tag vergangen.', 'warn');
    }
    if (aktionsId === 'halbertag') {
      gs.losesBargeld += 120;
      gs.risikoRaster  = clamp(gs.risikoRaster + 5, 0, 100);
      gs.energie       = clamp(gs.energie - 8, 0, 100);
      // Halber Tag = kein ganzer Tagesverbrauch
      logEvent('🔧 +120 € loses Bargeld. Risiko +5, E -8.', 'warn');
    }
  }

  // --- BANK ---
  if (ortId === 'bank') {
    if (aktionsId === 'einzahlen') {
      if (gs.losesBargeld <= 0) { logEvent('⚠️ Kein loses Bargeld vorhanden.', 'warn'); return; }
      if (!gs.bankEinzahlungDieseWoche) gs.bankEinzahlungDieseWoche = 0;
      const wochenLimit = 200;
      const restLimit = wochenLimit - gs.bankEinzahlungDieseWoche;
      if (restLimit <= 0) {
        oeffneModal('⚠️ Wochenlimit erreicht',
          `Max. <strong>200 €/Woche</strong> Bargeld-Einzahlung – sonst werden Behörden misstrauisch.<br><br>
           Bereits diese Woche: <strong>${formatEuro(gs.bankEinzahlungDieseWoche)}</strong>`, []);
        return;
      }
      const betrag = Math.min(gs.losesBargeld, restLimit);
      const transportRisiko = Math.min(Math.floor(betrag / 100), 5);
      gs.kontostand   += betrag;
      gs.losesBargeld -= betrag;
      gs.bankEinzahlungDieseWoche += betrag;
      gs.risikoRaster  = clamp(gs.risikoRaster + transportRisiko, 0, 100);
      const uebrig = wochenLimit - gs.bankEinzahlungDieseWoche;
      logEvent(`💳 ${formatEuro(betrag)} auf Konto. Wochenlimit noch: ${formatEuro(uebrig)}. Risiko +${transportRisiko}.`, 'good');
      soundGeld && soundGeld();
    }
    if (aktionsId === 'abheben') {
      const b = Math.min(500, gs.kontostand);
      if (b <= 0) { logEvent('⚠️ Konto leer.', 'warn'); return; }
      gs.kontostand   -= b;
      gs.losesBargeld += b;
      logEvent(`💵 ${formatEuro(b)} abgehoben.`, 'warn');
    }
    if (aktionsId === 'depot_kaufen') {
      oeffneDepotKaufMenu();
      return;
    }
    if (aktionsId === 'depot_verkaufen') {
      oeffneDepotVerkaufMenu();
      return;
    }
  }

  // --- PFANDLEIHER ---
  if (ortId === 'pawn') {
    // ---- Gold kaufen: 1 Barren = 500 € (Bargeld zuerst, dann Konto) ----
    if (aktionsId === 'gold_kaufen') {
      const preis = 500;
      if (gs.losesBargeld + gs.kontostand < preis) {
        logEvent('⚠️ Mindestens 500 € (Bargeld oder Konto) für einen Goldbarren nötig.', 'warn'); return;
      }
      let rest = preis;
      const ausLose = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= ausLose; rest -= ausLose;
      gs.kontostand -= rest;
      gs.goldBarren += 1;
      logEvent('🥇 1 Goldbarren gekauft (500 €) und im Garten vergraben – unsichtbar für Behörden.', 'good');
      soundGeld && soundGeld();
    }
    // ---- Gold ausgraben & verkaufen → loses Bargeld ----
    if (aktionsId === 'gold_verkaufen') {
      if (gs.goldBarren <= 0) { logEvent('⚠️ Kein Gold im Garten vergraben.', 'warn'); return; }
      const erloese = gs.goldBarren * 500;
      gs.losesBargeld += erloese;
      logEvent(`🥇 ${gs.goldBarren} Goldbarren ausgegraben & verkauft: +${formatEuro(erloese)} loses Bargeld.`, 'good');
      gs.goldBarren = 0;
      soundGeld && soundGeld();
    }
    // ---- Verpfänden ⇄ Auslösen ----
    if (aktionsId.startsWith('pfand_')) {
      const itemId = aktionsId.slice(6);
      const item   = PFAND_ITEMS[itemId];
      if (!item) return;
      const launeFeld = item.ziel === 'partner' ? 'happinessPartner' : 'happinessSpieler';

      if (gs.verpfaendet[itemId]) {
        // AUSLÖSEN: Pfandwert × 1.25 (Konto zuerst, dann loses Bargeld)
        const kosten = Math.round(item.wert * PFAND_ZINS);
        if (gs.kontostand + gs.losesBargeld < kosten) {
          logEvent(`⚠️ Nicht genug Geld zum Auslösen von ${item.name} (${formatEuro(kosten)}).`, 'warn'); return;
        }
        let rest = kosten;
        const ausKonto = Math.min(rest, gs.kontostand); gs.kontostand -= ausKonto; rest -= ausKonto;
        gs.losesBargeld -= rest;
        gs.verpfaendet[itemId] = false;
        gs[launeFeld] = clamp(gs[launeFeld] + item.laune, 0, 100);
        logEvent(`${item.name} ausgelöst: −${formatEuro(kosten)} (inkl. 25% Zins). Laune +${item.laune}.`, 'good');
        soundGeld && soundGeld();
      } else {
        // VERPFÄNDEN: Pfandwert aufs Konto, Laune sinkt
        gs.kontostand += item.wert;
        gs.verpfaendet[itemId] = true;
        gs[launeFeld] = clamp(gs[launeFeld] - item.laune, 0, 100);
        logEvent(`${item.name} verpfändet: +${formatEuro(item.wert)} aufs Konto. Laune −${item.laune}.`, 'warn');
        soundGeld && soundGeld();
      }
    }
  }

  // --- AMÜSIERBETRIEB ---
  if (ortId === 'amuesier') {
    if (aktionsId === 'amuesieren') {
      const gesamt = gs.kontostand + gs.schwarzeKasse;
      if (gesamt < 200) { logEvent('⚠️ Nicht genug Geld.', 'warn'); return; }
      if (gs.schwarzeKasse >= 200) gs.schwarzeKasse -= 200;
      else gs.kontostand -= 200;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 30, 0, 100);
      logEvent('🍸 Schöner Abend! Laune +30. -200 €.', 'good');
      if (Math.random() < 0.20 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(`🍸 Das Nachtleben zieht dich rein… Sucht-Stufe ${gs.suchtStufe}.`, 'danger');
      }
      if (Math.random() < 0.25) {
        gs.happinessPartner = clamp(gs.happinessPartner - 20, 0, 100);
        setTimeout(() => {
          oeffneModal('😬 Ertappt!', 'Partner hat herausgefunden, wo du warst!<br><br><strong>Partnerlaune -20</strong>', []);
          logEvent('😬 Ertappt! Partnerlaune -20.', 'danger');
          pruefeEheKrise();
        }, 300);
        return;
      }
    }
  }

  // --- SPORTVEREIN ---
  if (ortId === 'sportverein') {
    if (aktionsId === 'sozial') {
      if (gs.energie < 20) { logEvent('⚠️ Zu wenig Energie.', 'warn'); return; }
      gs.energie         = clamp(gs.energie - 20, 0, 100);
      gs.risikoRaster    = clamp(gs.risikoRaster - 23, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      verbraucheTag(1);
      logEvent('⚽ Soziale Tätigkeit: E -20, Risiko -23, Laune +10. 1 Tag vergangen.', 'good');
    }
    if (aktionsId === 'training') {
      if (gs.energie < 15) { logEvent('⚠️ Zu wenig Energie.', 'warn'); return; }
      gs.energie         = clamp(gs.energie - 15, 0, 100);
      gs.risikoRaster    = clamp(gs.risikoRaster - 15, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100);
      verbraucheTag(1);
      logEvent('🏃 Training geleitet: E -15, Risiko -15, Laune +5. 1 Tag vergangen.', 'good');
    }
  }

  // --- LOAN SHARK ---
  if (ortId === 'loanshark') {
    if (aktionsId === 'kredit_klein') {
      gs.losesBargeld   += 1000;
      gs.loanSharkSchuld += 1000;
      gs.risikoRaster    = clamp(gs.risikoRaster + 15, 0, 100);
      logEvent('🦈 Kredit 1.000 € vom Hai. Schulden: ' + formatEuro(gs.loanSharkSchuld) + '. Risiko +15.', 'danger');
    }
    if (aktionsId === 'kredit_gross') {
      gs.losesBargeld   += 3000;
      gs.loanSharkSchuld += 3000;
      gs.risikoRaster    = clamp(gs.risikoRaster + 25, 0, 100);
      logEvent('🦈 Kredit 3.000 € vom Hai. Schulden: ' + formatEuro(gs.loanSharkSchuld) + '. Risiko +25.', 'danger');
    }
    if (aktionsId === 'schulden_zahlen') {
      if (gs.loanSharkSchuld <= 0) { logEvent('ℹ️ Keine Schulden beim Kredithai.', ''); return; }
      const zahlung = Math.min(gs.loanSharkSchuld, gs.kontostand + gs.schwarzeKasse + gs.losesBargeld);
      if (zahlung <= 0) { logEvent('⚠️ Kein Geld zum Zurückzahlen.', 'warn'); return; }
      // Erst loses Bargeld verwenden, dann Schwarzkasse, dann Konto
      let rest = zahlung;
      const ausLose   = Math.min(rest, gs.losesBargeld);  rest -= ausLose; gs.losesBargeld   -= ausLose;
      const ausSchwarz= Math.min(rest, gs.schwarzeKasse); rest -= ausSchwarz; gs.schwarzeKasse -= ausSchwarz;
      gs.kontostand = Math.max(0, gs.kontostand - rest);
      gs.loanSharkSchuld -= zahlung;
      gs.risikoRaster     = clamp(gs.risikoRaster - 10, 0, 100);
      logEvent('💸 ' + formatEuro(zahlung) + ' Schulden zurückgezahlt. Risiko -10.', 'good');
    }
    if (aktionsId === 'schulden_verhandeln') {
      if (gs.loanSharkSchuld <= 0) { logEvent('ℹ️ Keine Schulden.', ''); return; }
      gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100);
      if (Math.random() < 0.5) {
        const erlass = Math.floor(gs.loanSharkSchuld * 0.5);
        gs.loanSharkSchuld -= erlass;
        logEvent('🤝 Erlass von ' + formatEuro(erlass) + '! Verbleibend: ' + formatEuro(gs.loanSharkSchuld) + '.', 'good');
      } else {
        gs.loanSharkSchuld = Math.floor(gs.loanSharkSchuld * 1.3);
        logEvent('😡 Verhandlung gescheitert! Schulden jetzt: ' + formatEuro(gs.loanSharkSchuld) + '.', 'danger');
      }
    }
  }

  // --- SCHATTENBANK ---
  if (ortId === 'schattenbank') {
    if (aktionsId === 'alles_sichern') {
      if (gs.losesBargeld <= 0) { logEvent('⚠️ Kein Bargeld zum Sichern.', 'warn'); return; }
      const betrag = gs.losesBargeld;
      gs.schwarzeKasse  += betrag;
      gs.losesBargeld    = 0;
      gs.schattenbankAktiv = true;
      logEvent(`🏴 Schattenbank: ${formatEuro(betrag)} gesichert. 5%/Monat Gebühr.`, 'good');
    }
    if (aktionsId === 'sichern_500') {
      const betrag = Math.min(500, gs.losesBargeld);
      if (betrag <= 0) { logEvent('⚠️ Kein Bargeld.', 'warn'); return; }
      gs.schwarzeKasse  += betrag;
      gs.losesBargeld   -= betrag;
      gs.schattenbankAktiv = true;
      logEvent(`🏴 Schattenbank: ${formatEuro(betrag)} gesichert.`, 'good');
    }
    if (aktionsId === 'sk_abheben') {
      if (gs.schwarzeKasse <= 0) { logEvent('⚠️ Schwarzkasse leer.', 'warn'); return; }
      gs.losesBargeld  += gs.schwarzeKasse;
      gs.schwarzeKasse  = 0;
      gs.schattenbankAktiv = false;
      logEvent(`🏴 Schwarzkasse abgehoben → loses Bargeld.`, 'warn');
    }
    // ---- Unterhalts-Tarnung: Auslands-Kindergeld behalten statt anrechnen ----
    if (aktionsId === 'unterhalts_tarnung') {
      if (gs.unterhaltsTarnung) {
        gs.unterhaltsTarnung = false;
        logEvent('🌍 Unterhalts-Tarnung abgeschaltet. Auslands-Kindergeld wird wieder angerechnet (netto 0).', '');
        return;
      }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal('🌍 Keine Auslandskinder', 'Die Unterhalts-Tarnung lohnt sich nur mit Kindergeld für Kinder im Ausland (Wohnung → Cheats → Kindergeld-Trick).', []);
        return;
      }
      gs.unterhaltsTarnung = true;
      oeffneModal('🌍 Unterhalts-Tarnung aktiviert',
        'Du reichst gefälschte Belege ein, dass du das Kindergeld als Unterhalt ins Ausland überweist.<br><br>'
        + 'Das Amt rechnet es nicht mehr an – du <strong>behältst</strong> das Auslands-Kindergeld.<br><br>'
        + '⚠️ Aber: Bei der <strong>Jobcenter-Prüfung</strong> (alle paar Monate) steigt das Entdeckungsrisiko mit jedem Auslandskind!', []);
      logEvent('🌍 Unterhalts-Tarnung aktiv – Auslands-Kindergeld wird behalten (riskant!).', 'warn');
      return;
    }
    // ---- Immobilie kaufen (40.000 € EK aus Schwarzkasse, Rest in Raten) ----
    if (aktionsId === 'immo_kaufen') {
      if (gs.immobilie) { oeffneModal('🏘️ Schon im Besitz', 'Du besitzt bereits eine Immobilie.', []); return; }
      if (gs.schwarzeKasse < IMMO_EIGENKAPITAL) {
        oeffneModal('🏘️ Zu wenig Eigenkapital', `Für die Anzahlung brauchst du <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong> in der Schwarzkasse.<br><br>Vorhanden: ${formatEuro(gs.schwarzeKasse)}.`, []);
        return;
      }
      gs.schwarzeKasse -= IMMO_EIGENKAPITAL;
      const restSchuld = IMMO_KAUFPREIS - IMMO_EIGENKAPITAL;
      gs.immobilie = { wert: IMMO_KAUFPREIS, miete: IMMO_MIETE, modus: 'eigen', restSchuld };
      oeffneModal('🏘️ Immobilie gekauft!',
        `Über einen Strohmann erworben. Anzahlung: <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong>.<br><br>`
        + `Restschuld <strong>${formatEuro(restSchuld)}</strong> → Rate <strong>${formatEuro(IMMO_RATE)}/Monat</strong> über ${IMMO_LAUFZEIT} Monate (jederzeit sofort tilgbar).<br><br>`
        + `Modus: <strong>Eigennutzung</strong> – im Bürgergeld zahlt das Amt die Miete (${formatEuro(IMMO_MIETE)}/M) in deine Schwarzkasse. Wert +2 %/Monat.<br><br>`
        + '⚠️ Eigennutzung ist Leistungsbetrug → erhöhtes Risiko + Jobcenter-Prüfung.', []);
      logEvent(`🏘️ Immobilie gekauft. EK ${formatEuro(IMMO_EIGENKAPITAL)}, Restschuld ${formatEuro(restSchuld)}.`, 'warn');
      return;
    }
    if (aktionsId === 'immo_modus') {
      if (!gs.immobilie) { oeffneModal('🏘️ Keine Immobilie', 'Kaufe zuerst eine Immobilie.', []); return; }
      gs.immobilie.modus = gs.immobilie.modus === 'eigen' ? 'vermietet' : 'eigen';
      logEvent(`🔑 Immobilie: ${gs.immobilie.modus === 'eigen' ? 'Eigennutzung – Amt zahlt Miete' : 'Vermietet – Mieteinnahmen'}.`, '');
      return;
    }
    if (aktionsId === 'immo_tilgen') {
      if (!gs.immobilie || gs.immobilie.restSchuld <= 0) { oeffneModal('🏦 Nichts zu tilgen', 'Es besteht keine Restschuld.', []); return; }
      const rest = gs.immobilie.restSchuld;
      if (gs.schwarzeKasse + gs.kontostand < rest) {
        oeffneModal('🏦 Zu wenig Geld', `Zum Abbezahlen der Restschuld brauchst du <strong>${formatEuro(rest)}</strong> (Schwarzkasse + Konto).`, []);
        return;
      }
      let r = rest;
      const ausSK = Math.min(r, gs.schwarzeKasse); gs.schwarzeKasse -= ausSK; r -= ausSK;
      gs.kontostand -= r;
      gs.immobilie.restSchuld = 0;
      oeffneModal('🏦 Abbezahlt!', `Restschuld von ${formatEuro(rest)} sofort getilgt. Die Immobilie gehört dir schuldenfrei.`, []);
      logEvent(`🏦 Immobilie abbezahlt: -${formatEuro(rest)}.`, 'good');
      return;
    }
    if (aktionsId === 'immo_verkaufen') {
      if (!gs.immobilie) { oeffneModal('🏘️ Keine Immobilie', 'Du besitzt keine Immobilie.', []); return; }
      const erloes = Math.max(0, Math.round(gs.immobilie.wert) - (gs.immobilie.restSchuld || 0));
      gs.schwarzeKasse += erloes;
      const rs = gs.immobilie.restSchuld || 0;
      gs.immobilie = null;
      oeffneModal('💰 Immobilie verkauft', `Verkauft. Wert minus Restschuld (${formatEuro(rs)}) = <strong>${formatEuro(erloes)}</strong> → Schwarzkasse.`, []);
      logEvent(`💰 Immobilie verkauft: +${formatEuro(erloes)} Schwarzkasse.`, 'good');
      return;
    }
    // ---- Depot verschleiern (vor dem Amt verstecken) ----
    if (aktionsId === 'depot_verschleiern') {
      if (gs.depotVerschleiert) {
        gs.depotVerschleiert = false;
        oeffneModal('📈 Depot wieder offiziell', 'Dein Depot läuft wieder auf deinen Namen – es zählt damit wieder zur Vermögensprüfung, kostet aber keine Gebühr mehr.', []);
        logEvent('📈 Depot nicht mehr verschleiert.', '');
        return;
      }
      if ((gs.depot || []).length === 0) {
        oeffneModal('📈 Kein Depot', 'Du hast keine Wertpapiere, die du verschleiern könntest. Kaufe erst welche bei der Bank.', []);
        return;
      }
      gs.depotVerschleiert = true;
      oeffneModal('📈 Depot verschleiert',
        'Deine Wertpapiere laufen jetzt über einen Strohmann der Schattenbank.<br><br>'
        + 'Das Depot zählt <strong>nicht mehr zur Vermögensprüfung</strong> – die Schattenbank nimmt dafür <strong>5 % des Depotwerts pro Monat</strong>.', []);
      logEvent('📈 Depot verschleiert (5%/Monat, Amt-unsichtbar).', 'warn');
      return;
    }
  }

  // --- SUPERMARKT ---
  if (ortId === 'supermarkt') {
    const kaufOptionen = { einkauf_gut: 800, einkauf_normal: 500, einkauf_billig: 250 };
    const kosten = kaufOptionen[aktionsId];
    if (kosten !== undefined) {
      if (gs.kontostand < kosten) {
        logEvent(`⚠️ Nicht genug Geld. Benötigt: ${formatEuro(kosten)}`, 'warn');
        return;
      }
      gs.kontostand -= kosten;
      gs.supermarktFaellig = false;
      const typ = aktionsId.replace('einkauf_', '');
      gs.lebensmittelDiesenMonat = typ;

      if (typ === 'gut') {
        gs.gesundheit       = clamp(gs.gesundheit + 10, 0, 100);
        gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
        gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
        gs.billigKaeufeInFolge = 0;
        logEvent(`🥗 Bio-Einkauf: -${formatEuro(kosten)}. Gesundheit +10, Laune +10.`, 'good');
      } else if (typ === 'normal') {
        gs.billigKaeufeInFolge = 0;
        logEvent(`🥙 Normaler Einkauf: -${formatEuro(kosten)}.`, 'good');
      } else if (typ === 'billig') {
        gs.billigKaeufeInFolge++;
        logEvent(`🍟 Billiger Einkauf: -${formatEuro(kosten)}. Gesundheit -5/M, Laune -10/M.`, 'warn');
        if (gs.billigKaeufeInFolge >= 2) {
          setTimeout(() => oeffneModal('😤 Deine Frau beschwert sich!',
            'Zwei Monate hintereinander Billig-Essen! Deine Partnerin ist sauer.<br><br>'
            + '<strong>Partnerlaune −15</strong>',
            []
          ), 300);
          gs.happinessPartner = clamp(gs.happinessPartner - 15, 0, 100);
          logEvent('😤 Frau beschwert sich über Billig-Essen!', 'danger');
        }
      }
      soundGeld && soundGeld();
    }

    if (aktionsId === 'geschenk') {
      if (gs.kontostand < 500) { logEvent('⚠️ Nicht genug Geld (500€).', 'warn'); return; }
      gs.kontostand    -= 500;
      gs.geschenkeSumme += 500;
      logEvent(`🎁 Geschenk 500€. Gesamt: ${formatEuro(gs.geschenkeSumme)} / 5.000€.`, 'good');
      if (gs.geschenkeSumme >= 5000 && gs.frauAusgezogen) {
        gs.frauAusgezogen      = false;
        gs.unterhaltProMonat   = 0;
        gs.geschenkeSumme      = 0;
        gs.happinessPartner    = 70;
        gs.eheKriseAktiv       = false;   // Ehe-Krise beendet
        gs.eheKriseSchritt     = 0;
        gs.eheKriseGescheitert = false;
        logEvent('💑 Frau ist zurückgekommen! Unterhalt entfällt.', 'good');
        oeffneModal('💑 Sie ist zurück!',
          'Du hast genug Geschenke gemacht (5.000 €).<br><br>'
          + 'Deine Partnerin zieht wieder ein. Partnerlaune: <strong>70</strong>.<br>'
          + 'Der monatliche Unterhalt von 1.000 € entfällt.', []);
      }
    }

    // ---- Minijob (legales Einkommen mit Freibetrag) ----
    if (aktionsId === 'minijob') {
      const setze = (lohn) => {
        gs.minijobLohn = lohn;
        if (lohn > 0) {
          const fb = minijobFreibetrag(lohn);
          logEvent(`💼 Minijob angenommen: ${formatEuro(lohn)}/Monat brutto. Davon anrechnungsfrei: ${formatEuro(fb)}.`, 'good');
        } else {
          logEvent('💼 Minijob gekündigt.', '');
        }
        updateHUD();
      };
      const fb538 = minijobFreibetrag(538);
      const fb250 = minijobFreibetrag(250);
      oeffneModal('💼 Minijob (Aushilfe)',
        'Legales Einkommen – aber das Amt rechnet an. Du behältst nur den <strong>Freibetrag</strong> (erste 100 € + 20 % vom Rest).<br><br>'
        + `Kostet jeden Monat etwas Energie.`,
        [
          { label: `🧹 250 €/Monat (netto +${formatEuro(fb250)})`, callback: () => setze(250) },
          { label: `🛒 538 €/Monat (netto +${formatEuro(fb538)})`, primary: true, callback: () => setze(538) },
          { label: '🚪 Minijob kündigen', danger: true, callback: () => setze(0) },
        ]);
      return;
    }

  }

  // --- KIOSK ---
  if (ortId === 'kiosk') {
    // ---- Rubbellos ----
    if (aktionsId === 'rubbellos') {
      if (gs.kontostand < 5) { logEvent('⚠️ Kein Geld für ein Rubbellos.', 'warn'); return; }
      gs.kontostand -= 5;
      const r = Math.random();
      let gewinn = 0;
      if (r < 0.60)       gewinn = 0;
      else if (r < 0.85)  gewinn = 10;
      else if (r < 0.95)  gewinn = 30;
      else if (r < 0.99)  gewinn = 200;
      else if (r < 0.999) gewinn = 2000;
      else                gewinn = 50000;
      if (gewinn > 0) {
        gs.kontostand += gewinn;
        soundGeld && soundGeld();
        oeffneModal('🎟️ Rubbellos', gewinn >= 2000
          ? `🎉 <strong>JACKPOT!</strong> Du gewinnst <strong>${formatEuro(gewinn)}</strong>!`
          : `Gewonnen: <strong>${formatEuro(gewinn)}</strong>.`, []);
        logEvent(`🎟️ Rubbellos: +${formatEuro(gewinn)}.`, 'good');
      } else {
        logEvent('🎟️ Rubbellos: Niete.', 'warn');
      }
      // kleines Sucht-Risiko (Glücksspiel)
      if (Math.random() < 0.15 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(`🎰 Das Zocken packt dich… Sucht-Stufe ${gs.suchtStufe}.`, 'danger');
      }
      return;
    }
    // ---- Alkohol & Zigaretten ----
    if (aktionsId === 'genussmittel') {
      if (gs.kontostand < 15) { logEvent('⚠️ Kein Geld für Genussmittel.', 'warn'); return; }
      gs.kontostand      -= 15;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 8, 0, 100);
      gs.gesundheit       = clamp(gs.gesundheit - 3, 0, 100);
      logEvent('🍺 Alkohol & Zigaretten: Laune +8, Gesundheit -3.', 'warn');
      if (Math.random() < 0.20 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(`🍺 Es wird zur Gewohnheit… Sucht-Stufe ${gs.suchtStufe}.`, 'danger');
      }
      return;
    }
  }

  // --- ARZTPRAXIS ---
  if (ortId === 'arztpraxis') {
    if (aktionsId === 'arzt_behandlung') {
      if (gs.kontostand < 500) { logEvent('⚠️ Nicht genug Geld für die Behandlung (500€).', 'warn'); return; }
      gs.kontostand -= 500;
      gs.gesundheit  = clamp(gs.gesundheit + 30, 0, 100);
      logEvent('🩺 Behandlung: Gesundheit +30 (-500€).', 'good');
    }
    if (aktionsId === 'arzt_krank') {
      gs.risikoRaster = clamp(gs.risikoRaster - 8, 0, 100);
      gs.energie      = clamp(gs.energie + 10, 0, 100);
      gs.naechsterAmtsBesuch = Math.max(gs.naechsterAmtsBesuch, 2);
      logEvent('🤒 Krankschreibung: Risiko -8, Energie +10.', 'good');
    }
    if (aktionsId === 'arzt_entzug') {
      if ((gs.suchtStufe || 0) === 0) { oeffneModal('💉 Entzug', 'Du hast (noch) keine Sucht. Bleib so!', []); return; }
      if (gs.kontostand < 800) { logEvent('⚠️ Nicht genug Geld für die Therapie (800€).', 'warn'); return; }
      gs.kontostand -= 800;
      gs.suchtStufe  = 0;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      logEvent('💉 Entzug erfolgreich – Sucht überwunden!', 'good');
      oeffneModal('💉 Clean!', 'Die Therapie hat angeschlagen. Deine Sucht ist überwunden, Laune +10.', []);
      return;
    }
  }

  // --- VILLA (Luxus-Domizil, nur bei Eigennutzung erreichbar) ---
  if (ortId === 'villa') {
    if (aktionsId === 'villa_schlafen') {
      gs.energie = clamp(gs.energie + 40, 0, 100);
      verbraucheTag(1);
      logEvent('🛌 Luxuriös geschlafen: Energie +40. 1 Tag vergangen.', 'good');
    }
    if (aktionsId === 'villa_pool') {
      gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100);
      logEvent('🏊 Pool & Sauna: Laune +20.', 'good');
    }
    if (aktionsId === 'villa_gaeste') {
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
      logEvent('🍸 Gäste in der Villa empfangen: Laune +10, Partner +10.', 'good');
    }
  }

  // --- KASINO ---
  if (ortId === 'kasino') {
    const betraege = { waschen_100: 100, waschen_500: 500, waschen_1000: 1000 };
    let betrag = betraege[aktionsId];

    if (aktionsId === 'waschen_alles') {
      betrag = gs.losesBargeld;
      if (betrag <= 0) { logEvent('⚠️ Kein loses Bargeld zum Setzen.', 'warn'); return; }
    }

    if (betrag !== undefined) {
      if (gs.losesBargeld < betrag) {
        logEvent(`⚠️ Nicht genug loses Bargeld. Vorhanden: ${formatEuro(gs.losesBargeld)}`, 'warn');
        return;
      }
      // Rückzahlung: gleichmäßig verteilt zwischen 50% und 120%
      // Erwartungswert: 85% → Kasino behält im Schnitt 15% als Provision
      const faktor    = 0.50 + Math.random() * 0.70;  // 0.50 – 1.20
      const rueckgabe = Math.round(betrag * faktor);
      const diff      = rueckgabe - betrag;  // positiv = Gewinn, negativ = Verlust

      gs.losesBargeld -= betrag;
      gs.kontostand   += rueckgabe;   // immer aufs Konto – legal als Spielgewinn

      const pct     = Math.round(faktor * 100);
      const pfeil   = diff >= 0 ? '▲' : '▼';
      const diffStr = (diff >= 0 ? '+' : '') + formatEuro(diff);

      if (diff >= 0) {
        soundGut && soundGut();
        logEvent(`🎰 Gewaschen: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (+${pct - 100}% Bonus). Konto +${formatEuro(rueckgabe)}.`, 'good');
        oeffneModal('🎰 Gewaschen!',
          `Einsatz: <strong>${formatEuro(betrag)}</strong><br>
           Rückzahlung: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Ergebnis: <strong style="color:var(--accent2);">${diffStr}</strong><br><br>
           Das Geld ist legal auf deinem Bankkonto – als Spielgewinn verbucht.`,
          []
        );
      } else {
        soundNeutral && soundNeutral();
        logEvent(`🎰 Gewaschen: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (${pct}%, Provision ${formatEuro(-diff)}). Konto +${formatEuro(rueckgabe)}.`, 'warn');
        oeffneModal('🎰 Gewaschen (mit Abzug)',
          `Einsatz: <strong>${formatEuro(betrag)}</strong><br>
           Rückzahlung: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Kasino-Provision: <strong style="color:var(--danger);">${formatEuro(-diff)}</strong><br><br>
           Das gereinigte Geld ist trotzdem auf deinem Konto – legal.`,
          []
        );
      }
    }
  }

  updateHUD();
  pruefeRisiko();
  pruefeGameOverBedingungen();
}


// ================================================================
// ABSCHNITT 13b: AKTIENDEPOT-SYSTEM
// ================================================================

// Verfügbare Wertpapiere
const AKTIEN_KATALOG = [
  {
    id: 'msci_world',
    name: '🌍 MSCI World ETF',
    typ: 'etf',
    beschreibung: 'Solide. +8% pro Monat, kein Verlustrisiko.',
    minKauf: 500,
    fix: 0.08,
    startKurs: 100
  },
  {
    id: 'kryptoXX',
    name: '₿ KryptoXX Coin',
    typ: 'spekulation',
    beschreibung: 'Stark schwankend: −25% bis +50% pro Monat (zufällig verteilt).',
    minKauf: 100,
    renditeMin: -0.25, renditeMax: 0.50,
    startKurs: 10
  },
  {
    id: 'techzock',
    name: '🚀 Risiko-Firma AG',
    typ: 'spekulation',
    beschreibung: 'Extrem riskant: −50% bis +100% pro Monat (zufällig verteilt).',
    minKauf: 200,
    renditeMin: -0.50, renditeMax: 1.00,
    startKurs: 50
  },
  {
    id: 'immofonds',
    name: '🏢 Immo-Fonds D',
    typ: 'etf',
    beschreibung: 'Stabiler Immobilienfonds. +2% bis +8% pro Monat.',
    minKauf: 1000,
    renditeMin: 0.02,
    renditeMax: 0.08,
    startKurs: 200
  }
];

/** Öffnet das Kauf-Menü für das Aktiendepot */
function oeffneDepotKaufMenu() {
  const gs = gameState;
  const aktionen = AKTIEN_KATALOG.map(aktie => ({
    label: `${aktie.name} – ${aktie.beschreibung} Min. ${formatEuro(aktie.minKauf)}`,
    callback: () => oeffneKaufDialog(aktie)
  }));
  oeffneModal('📈 Depot – Wertpapier kaufen',
    `Kontostand: <strong>${formatEuro(gs.kontostand)}</strong><br>
     Kaufe Wertpapiere mit deinem Kontoguthaben. Kursschwankungen werden monatlich berechnet.`,
    aktionen
  );
}

/** Kaufdialog für eine spezifische Aktie – unbegrenzte Kauftranchen, Menü bleibt offen */
function oeffneKaufDialog(aktie) {
  const gs = gameState;
  const bestehend = gs.depot.find(p => p.id === aktie.id);
  const kurs = bestehend ? bestehend.aktuellerKurs : aktie.startKurs;

  if (gs.kontostand < kurs) {
    oeffneModal('❌ Nicht genug Geld',
      `Kurs: <strong>${formatEuro(kurs)}</strong> pro Anteil.<br>
       Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, []);
    return;
  }

  // Feste Tranchen: 1×, 5×, 10×, 25×, 50×, 100×, max. kaufbar
  // Alle Tranchen die sich der Spieler leisten kann bleiben immer im Menü
  const BASIS = Math.max(1, Math.floor(aktie.minKauf / kurs));
  const tranchen = [BASIS, BASIS*5, BASIS*10, BASIS*25, BASIS*50, BASIS*100].filter(s => s > 0);
  // Immer auch "alles kaufen"
  const maxStueck = Math.floor(gs.kontostand / kurs);
  if (!tranchen.includes(maxStueck) && maxStueck > 0) tranchen.push(maxStueck);

  function zeigeKaufMenu() {
    const pos = bestehend
      ? `<br>Im Depot: <strong>${bestehend.anteile} Anteile</strong> (Kaufkurs Ø ${formatEuro(bestehend.kaufkurs)})`
      : '';

    const aktionen = tranchen.map(stueck => {
      const kosten = Math.round(stueck * kurs);
      const kannKaufen = gs.kontostand >= kosten;
      return {
        label: kannKaufen
          ? `Kaufe ${stueck} Anteile → ${formatEuro(kosten)}`
          : `[Zu teuer] ${stueck} Anteile = ${formatEuro(kosten)}`,
        callback: () => {
          if (!kannKaufen) { zeigeKaufMenu(); return; }
          kaufeAktie(aktie, stueck, kurs);
          // Menü nach Kauf wieder öffnen (bleibt offen)
          setTimeout(() => oeffneKaufDialog(aktie), 250);
        }
      };
    });

    oeffneModal(
      `📈 ${aktie.name}`,
      `Kurs: <strong>${formatEuro(kurs)}</strong> · Konto: <strong>${formatEuro(gs.kontostand)}</strong>${pos}<br>
       Typ: ${aktie.typ === 'etf' ? '🛡️ ETF (stabil)' : '🎲 Spekulation (riskant)'} · 
       Rendite: <strong>${Math.round(aktie.renditeMin*100)}%</strong> bis <strong>+${Math.round(aktie.renditeMax*100)}%</strong> pro Monat`,
      aktionen
    );
  }
  zeigeKaufMenu();
}

function kaufeAktie(aktie, stueck, kurs) {
  const gs = gameState;
  const kosten = Math.round(stueck * kurs);
  if (gs.kontostand < kosten) {
    logEvent('⚠️ Nicht genug Geld für Kauf.', 'warn'); return;
  }
  gs.kontostand -= kosten;

  // In bestehendes Depot eintragen oder neuen Eintrag anlegen
  const idx = gs.depot.findIndex(p => p.id === aktie.id);
  if (idx >= 0) {
    // Durchschnittskurs berechnen
    const alt = gs.depot[idx];
    const gesamt = alt.anteile + stueck;
    alt.kaufkurs = (alt.anteile * alt.kaufkurs + stueck * kurs) / gesamt;
    alt.anteile  = gesamt;
    alt.aktuellerKurs = kurs;
  } else {
    gs.depot.push({
      id:           aktie.id,
      name:         aktie.name,
      typ:          aktie.typ,
      fix:          aktie.fix,
      up:           aktie.up,
      down:         aktie.down,
      chanceUp:     aktie.chanceUp,
      renditeMin:   aktie.renditeMin,
      renditeMax:   aktie.renditeMax,
      anteile:      stueck,
      kaufkurs:     kurs,
      aktuellerKurs: kurs
    });
  }

  logEvent(`📈 ${stueck}× ${aktie.name} für ${formatEuro(kosten)} gekauft.`, 'good');
  updateHUD();
}

/** Öffnet Verkaufs-Übersicht mit Teilverkauf */
function oeffneDepotVerkaufMenu() {
  const gs = gameState;
  if (gs.depot.length === 0) {
    oeffneModal('📉 Depot leer', 'Du hast noch keine Wertpapiere.', []);
    return;
  }

  const aktionen = gs.depot.map(pos => {
    const wert   = Math.round(pos.anteile * pos.aktuellerKurs);
    const gewinn = wert - Math.round(pos.anteile * pos.kaufkurs);
    const pfeil  = gewinn >= 0 ? '▲' : '▼';
    return {
      label: `${pos.name}: ${pos.anteile} Anteile · ${formatEuro(pos.aktuellerKurs)}/Anteil · Ges. ${formatEuro(wert)} · ${pfeil}${formatEuro(Math.abs(gewinn))}`,
      callback: () => oeffneTeilverkaufMenu(pos)
    };
  });

  const gesamtwert = gs.depot.reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
  oeffneModal(
    '📉 Depot – Position wählen',
    `Gesamtwert Depot: <strong>${formatEuro(Math.round(gesamtwert))}</strong><br>
     Wähle eine Position für Teil- oder Vollverkauf:`,
    aktionen
  );
}

/** Zeigt Teilverkauf-Optionen für eine Position */
function oeffneTeilverkaufMenu(pos) {
  const kurs    = pos.aktuellerKurs;
  const maxAnz  = pos.anteile;
  const gewinnPro = kurs - pos.kaufkurs;
  const pfeil   = gewinnPro >= 0 ? '▲' : '▼';

  // Tranchen: 25%, 50%, 75%, Alles + individuelle Stückelungen
  const BASIS = Math.max(1, Math.floor(maxAnz / 4));
  const tranchen = [
    { stueck: Math.floor(maxAnz * 0.25), label: '25%' },
    { stueck: Math.floor(maxAnz * 0.50), label: '50%' },
    { stueck: Math.floor(maxAnz * 0.75), label: '75%' },
    { stueck: maxAnz,                    label: '100% (Alles)' },
  ].filter(t => t.stueck > 0);

  // Deduplizieren falls maxAnz sehr klein
  const seen = new Set();
  const unique = tranchen.filter(t => {
    if (seen.has(t.stueck)) return false;
    seen.add(t.stueck); return true;
  });

  const aktionen = unique.map(({ stueck, label }) => {
    const wert   = Math.round(stueck * kurs);
    const gv     = Math.round(stueck * gewinnPro);
    const gvStr  = (gv >= 0 ? '+' : '') + formatEuro(gv);
    return {
      label: `${label}: ${stueck} Anteile → ${formatEuro(wert)} (G/V: ${gvStr})`,
      callback: () => {
        verkaufeTeilweise(pos, stueck);
        // Menü nach Teilverkauf wieder öffnen wenn noch Anteile vorhanden
        setTimeout(() => {
          const rest = gameState.depot.find(p => p.id === pos.id);
          if (rest && rest.anteile > 0) oeffneTeilverkaufMenu(rest);
          else oeffneDepotVerkaufMenu();
        }, 250);
      }
    };
  });

  oeffneModal(
    `📉 ${pos.name} verkaufen`,
    `Kurs: <strong>${formatEuro(kurs)}</strong> · Bestand: <strong>${maxAnz} Anteile</strong><br>
     Kaufkurs Ø: <strong>${formatEuro(pos.kaufkurs)}</strong> · 
     Latenter G/V: <strong>${pfeil}${formatEuro(Math.abs(Math.round(maxAnz * gewinnPro)))}</strong>`,
    aktionen
  );
}

function verkaufeTeilweise(pos, stueck) {
  const gs   = gameState;
  const idx  = gs.depot.findIndex(p => p.id === pos.id);
  if (idx < 0) return;
  const wert  = Math.round(stueck * pos.aktuellerKurs);
  const gewinn = Math.round(stueck * (pos.aktuellerKurs - pos.kaufkurs));
  gs.kontostand += wert;
  gs.depot[idx].anteile -= stueck;
  if (gs.depot[idx].anteile <= 0) gs.depot.splice(idx, 1);
  logEvent(`📉 ${pos.name}: ${stueck} Anteile verkauft → +${formatEuro(wert)} (${gewinn >= 0 ? '+' : ''}${formatEuro(gewinn)} G/V).`,
    gewinn >= 0 ? 'good' : 'warn');
  updateHUD();
}

// Alias für Vollverkauf (Kompatibilität)
function verkaufeAlles(pos) { verkaufeTeilweise(pos, pos.anteile); }

/**
 * Monatliche Kursaktualisierung (wird in monatsAbschluss() aufgerufen)
 * MSCI World: +3% bis +7% (zuverlässig)
 * Spekulation: -10% bis +150% (zufällig, stark gewichtet nach unten)
 */
function aktuelisiereDepotKurse() {
  const gs = gameState;
  if (gs.depot.length === 0) return;

  let meldungen = [];
  gs.depot.forEach(pos => {
    // Renditemodell je Wertpapier:
    //   fix            -> deterministisch (z.B. MSCI +8%)
    //   renditeMin..Max -> zufällig verteilt mit zentraler Tendenz (Mittelwert
    //                      zweier Zufallszahlen = dreieckverteilt um die Mitte)
    //   (up/down nur noch für ggf. alte Spielstände)
    let rendite;
    if (typeof pos.fix === 'number') {
      rendite = pos.fix;
    } else if (typeof pos.up === 'number') {
      rendite = (Math.random() < (pos.chanceUp ?? 0.5)) ? pos.up : pos.down;
    } else {
      const r = (Math.random() + Math.random()) / 2;   // Dreieckverteilung
      rendite = pos.renditeMin + r * (pos.renditeMax - pos.renditeMin);
    }
    const alterKurs = pos.aktuellerKurs;
    pos.aktuellerKurs = Math.max(0.01, pos.aktuellerKurs * (1 + rendite));
    const pct   = (rendite * 100).toFixed(1);
    const pfeil = rendite >= 0 ? '▲' : '▼';
    meldungen.push(`${pfeil} ${pos.name}: ${pct}% → Kurs ${formatEuro(pos.aktuellerKurs)}`);
    logEvent(`📊 ${pos.name} ${pfeil}${pct}%`, rendite < 0 ? 'danger' : 'good');
  });

  return meldungen;
}

// ================================================================
// ABSCHNITT 14: RISIKO-PRÜFUNG (einfache, sofortige Razzia nach Aktionen)
// ================================================================
function pruefeRisiko() {
  const gs = gameState;
  if (gs.gameOver) return;
  // Chance nach Aktionen: halb so hoch wie Timer-Chance
  // Bei 70: ~7%, bei 90: ~14%, bei 100: ~20%
  const chance = Math.min(0.20, Math.pow(gs.risikoRaster, 1.5) / 50000);
  if (Math.random() < chance) ausloesenRazziaV3();
}

// ================================================================
// ABSCHNITT 15: MONATSABSCHLUSS
// ================================================================
function monatsAbschluss() {
  const gs = gameState;

  // ---- Zahlungsrückstand: Game Over nach 3 Monaten ohne Begleichung ----
  if (gs.rueckstandMonate >= 3) {
    triggerGameOver('zahlungsunfaehig');
    return;
  }

  gs.monat++;
  let meldungen = [];

  // Hilfsfunktion: nicht zahlbarer Betrag → Zahlungsrückstand
  const fehlt = (betrag, was) => {
    if (betrag <= 0) return;
    gs.zahlungsRueckstand += betrag;
    meldungen.push(`❗ ${was} nicht (voll) bezahlt: +${formatEuro(betrag)} Rückstand.`);
    logEvent(`❗ Rückstand +${formatEuro(betrag)} (${was}).`, 'danger');
  };

  // ALG1 → ALG2 Wechsel
  if (gs.monat > 12 && gs.status === 'ALG1') {
    gs.status = 'ALG2';
    meldungen.push('⚠️ ALG I ausgelaufen – jetzt Bürgergeld!');
    logEvent('⚠️ ALG I → Bürgergeld.', 'danger');
  }
  if (gs.kontostand <= 0 && gs.status === 'ALG1') {
    gs.status = 'ALG2';
    meldungen.push('💸 Konto leer – Bürgergeld-Modus.');
    logEvent('💸 Konto leer → Bürgergeld.', 'danger');
  }

  // ---- Minijob: anrechenbarer Teil (Freibetrag bleibt frei) ----
  const minijobAnrechenbar = gs.minijobLohn > 0
    ? Math.max(0, gs.minijobLohn - minijobFreibetrag(gs.minijobLohn))
    : 0;

  // ALG-Zahlung (Grundleistung, danach Einkommens-Anrechnung)
  if (gs.status === 'ALG1') {
    if (gs.algGesperrt) {
      meldungen.push('🛑 ALG I gesperrt! Besuche das Arbeitsamt um die Sperre aufzuheben.');
      logEvent('🛑 ALG I gesperrt – kein Geld!', 'danger');
    } else {
      const auszahlung = Math.max(0, ALG1_ZAHLUNG - minijobAnrechenbar);
      gs.kontostand += auszahlung; staatGibt(auszahlung);
      meldungen.push(`✅ ALG I: +${formatEuro(auszahlung)}${minijobAnrechenbar > 0 ? ` (nach Anrechnung ${formatEuro(minijobAnrechenbar)} Minijob)` : ''}`);
      logEvent(`✅ ALG I +${formatEuro(auszahlung)}.`, 'good');
    }
  } else {
    // ALG2: Vermögensprüfung – nur alle 3 Monate, zählt Konto + (sichtbares) Depot
    // (Gold im Garten, Schwarzkasse und verschleiertes Depot zählen NICHT)
    const istPruefMonat  = (gs.monat % 3 === 0);
    const depotWert      = (gs.depot || []).reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
    const sichtbaresDepot = gs.depotVerschleiert ? 0 : depotWert;
    const pruefVermoegen = gs.kontostand + sichtbaresDepot;
    if (istPruefMonat && pruefVermoegen > ALG2_VERMOEGENS_GRENZE) {
      meldungen.push(`🛑 Vermögensprüfung (alle 3 Monate): Konto + sichtbares Depot = ${formatEuro(pruefVermoegen)} > ${formatEuro(ALG2_VERMOEGENS_GRENZE)}. Kein Bürgergeld diesen Monat!`);
      logEvent('🛑 Vermögensprüfung: zu viel sichtbares Vermögen.', 'danger');
    } else {
      const auszahlung = Math.max(0, ALG2_ZAHLUNG - minijobAnrechenbar);
      gs.kontostand += auszahlung; staatGibt(auszahlung);
      meldungen.push(`✅ Bürgergeld: +${formatEuro(auszahlung)}${minijobAnrechenbar > 0 ? ` (nach Anrechnung ${formatEuro(minijobAnrechenbar)} Minijob)` : ''}`);
      logEvent(`✅ Bürgergeld +${formatEuro(auszahlung)}.`, 'good');
    }
  }

  // ---- Minijob: Bruttolohn aufs Konto + Energie kostet ----
  if (gs.minijobLohn > 0) {
    gs.kontostand += gs.minijobLohn;
    gs.energie     = clamp(gs.energie - 10, 0, 100);
    const fb = minijobFreibetrag(gs.minijobLohn);
    meldungen.push(`💼 Minijob: +${formatEuro(gs.minijobLohn)} (anrechnungsfrei: ${formatEuro(fb)}). Energie -10.`);
    logEvent(`💼 Minijob +${formatEuro(gs.minijobLohn)}.`, 'good');
  }

  // ---- Legale Mehrbedarfe (monatliche Zuschläge aufs Konto) ----
  {
    let mbSumme = 0;
    const mbTeile = [];
    for (const key in MEHRBEDARF_BETRAG) {
      if (gs.mehrbedarf && gs.mehrbedarf[key]) {
        mbSumme += MEHRBEDARF_BETRAG[key];
        mbTeile.push(key);
      }
    }
    if (mbSumme > 0) {
      gs.kontostand += mbSumme; staatGibt(mbSumme);
      meldungen.push(`📑 Mehrbedarfe: +${formatEuro(mbSumme)} (${mbTeile.join(', ')})`);
      logEvent(`📑 Mehrbedarfe +${formatEuro(mbSumme)}.`, 'good');
    }
  }

  // ---- Einstiegsgeld (Gründerbonus, anrechnungsfrei) ----
  if (gs.einstiegsgeldMonate > 0) {
    gs.kontostand += EINSTIEGSGELD_BETRAG; staatGibt(EINSTIEGSGELD_BETRAG);
    gs.einstiegsgeldMonate--;
    meldungen.push(`🚀 Einstiegsgeld: +${formatEuro(EINSTIEGSGELD_BETRAG)} (noch ${gs.einstiegsgeldMonate} Monate)`);
    logEvent(`🚀 Einstiegsgeld +${formatEuro(EINSTIEGSGELD_BETRAG)}.`, 'good');
  }

  // ---- Schein-WG: Bonus, solange Partnerin da ist (sonst auto-aus) ----
  if (gs.scheinWG && gs.frauAusgezogen) {
    gs.scheinWG = false;
    meldungen.push('🏠 Schein-WG hinfällig – Partnerin ist ausgezogen.');
  } else if (gs.scheinWG) {
    gs.kontostand += SCHEINWG_BETRAG; staatGibt(SCHEINWG_BETRAG);
    meldungen.push(`🏠 Schein-WG: +${formatEuro(SCHEINWG_BETRAG)} (voller Single-Satz).`);
    logEvent(`🏠 Schein-WG +${formatEuro(SCHEINWG_BETRAG)}.`, 'warn');
  }

  // ---- Immobilie: Mieteinnahmen / KdU-Masche + Wertsteigerung ----
  if (gs.immobilie) {
    let einnahme = 0;
    if (gs.immobilie.modus === 'eigen') {
      // Amt zahlt KdU an den Strohmann – nur im Bürgergeld-Modus
      if (gs.status === 'ALG2') einnahme = gs.immobilie.miete;
    } else {
      einnahme = gs.immobilie.miete; // echte Mieteinnahmen
    }
    if (einnahme > 0) {
      gs.schwarzeKasse += einnahme;
      if (gs.immobilie.modus === 'eigen') staatGibt(einnahme); // KdU kommt vom Amt
      gs.risikoRaster   = clamp(gs.risikoRaster + 6, 0, 100);
      const quelle = gs.immobilie.modus === 'eigen' ? 'Amt-Miete (KdU-Masche)' : 'Mieteinnahmen';
      meldungen.push(`🏘️ Immobilie – ${quelle}: +${formatEuro(einnahme)} Schwarzkasse. Risiko +6.`);
      logEvent(`🏘️ Immobilie +${formatEuro(einnahme)} Schwarzkasse.`, 'warn');
    }
    // Ratenzahlung (Schwarzkasse zuerst, dann Konto)
    if (gs.immobilie.restSchuld > 0) {
      const rate = Math.min(IMMO_RATE, gs.immobilie.restSchuld);
      const verfuegbar = Math.max(0, gs.schwarzeKasse) + Math.max(0, gs.kontostand);
      const zahlbar = Math.min(rate, verfuegbar);
      let r = zahlbar;
      const ausSK = Math.min(r, Math.max(0, gs.schwarzeKasse)); gs.schwarzeKasse -= ausSK; r -= ausSK;
      gs.kontostand -= r;
      gs.immobilie.restSchuld -= zahlbar;
      meldungen.push(`🏘️ Immobilien-Rate: -${formatEuro(zahlbar)} (Restschuld: ${formatEuro(gs.immobilie.restSchuld)}).`);
      fehlt(rate - zahlbar, 'Immobilien-Rate');
    }
    // Wertsteigerung +2 %/Monat
    gs.immobilie.wert = Math.round(gs.immobilie.wert * IMMO_WERT_WACHSTUM);
    meldungen.push(`📈 Immobilienwert: ${formatEuro(gs.immobilie.wert)} (+2 %).`);
  }

  // ---- Mietkaution-Darlehen: Rate vom Konto ----
  if (gs.kautionRest > 0) {
    const rate = Math.min(KAUTION_RATE, gs.kautionRest);
    const zahlbar = Math.min(rate, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    gs.kautionRest -= zahlbar;
    meldungen.push(`📦 Kaution-Darlehen: -${formatEuro(zahlbar)} (Rest: ${formatEuro(gs.kautionRest)}).`);
    fehlt(rate - zahlbar, 'Kaution-Rate');
  }

  // ---- Depot: Monatliche Kursaktualisierung ----
  const depotMeldungen = aktuelisiereDepotKurse();
  if (depotMeldungen && depotMeldungen.length > 0) {
    meldungen.push('📊 <strong>Depot-Update:</strong><br>' + depotMeldungen.join('<br>'));
  }
  // ---- Schattenbank-Depotgebühr: 5% des Werts, wenn verschleiert ----
  if (gs.depotVerschleiert && (gs.depot || []).length > 0) {
    let fee = 0;
    gs.depot.forEach(pos => {
      fee += pos.anteile * pos.aktuellerKurs * 0.05;
      pos.aktuellerKurs *= 0.95;
    });
    fee = Math.round(fee);
    if (fee > 0) {
      meldungen.push(`🏴 Schattenbank-Depotgebühr: -${formatEuro(fee)} (5% des verschleierten Depots).`);
      logEvent(`🏴 Depotgebühr -${formatEuro(fee)}.`, 'warn');
    }
  }

  // ---- Loan-Shark: Monatliche Zinsen 20% ----
  if (gs.loanSharkSchuld > 0) {
    const zinsen = Math.round(gs.loanSharkSchuld * 0.10);
    gs.loanSharkSchuld += zinsen;
    gs.risikoRaster     = clamp(gs.risikoRaster + 5, 0, 100);
    meldungen.push(`🦈 Kredithai-Zinsen: +${formatEuro(zinsen)} → Schulden jetzt ${formatEuro(gs.loanSharkSchuld)}. Risiko +5.`);
    logEvent(`🦈 Zinsen +${formatEuro(zinsen)}. Schulden: ${formatEuro(gs.loanSharkSchuld)}.`, 'danger');
  }

  // ---- Auslands-Kindergeld (Kindergeld-Paradoxon) ----
  // Ohne Tarnung: fließt, wird aber voll als Einkommen angerechnet → netto 0.
  // Mit Unterhalts-Tarnung (Schattenbank): wird behalten – aber Prüf-Risiko!
  if (gs.kindergeldKinder && gs.kindergeldKinder.length > 0) {
    const anzahl  = gs.kindergeldKinder.length;
    const zahlung = anzahl * 300;
    if (gs.unterhaltsTarnung) {
      gs.kontostand  += zahlung; staatGibt(zahlung);
      gs.risikoRaster = clamp(gs.risikoRaster + anzahl * 5, 0, 100);
      meldungen.push(`👶 Auslands-Kindergeld (getarnt): +${formatEuro(zahlung)} behalten. Risiko +${anzahl * 5}.`);
      logEvent(`👶 Kindergeld +${formatEuro(zahlung)} (Tarnung aktiv).`, 'warn');
    } else {
      meldungen.push(`👶 Auslands-Kindergeld ${formatEuro(zahlung)} fließt, wird aber voll als Einkommen angerechnet → netto 0 €. Tipp: Unterhalts-Tarnung in der Schattenbank.`);
      logEvent('👶 Kindergeld komplett angerechnet (netto 0).', '');
    }
  }

  // ---- Jobcenter-Prüfung (Plausibilität) – versetzt zur Vermögensprüfung ----
  // Deckt gefälschte Atteste und die Unterhalts-Tarnung auf.
  if (gs.monat % 3 === 1) {
    let fakeFaktoren = 0;
    if (gs.ernaehrungFake) fakeFaktoren += 1;
    if (gs.unterhaltsTarnung) fakeFaktoren += (gs.kindergeldKinder || []).length;
    if (gs.scheinWG) fakeFaktoren += 1;
    if (gs.immobilie && gs.immobilie.modus === 'eigen' && gs.status === 'ALG2') fakeFaktoren += 1;
    if (fakeFaktoren > 0) {
      let chance = Math.min(0.85, 0.15 * fakeFaktoren);
      if (gs.sachbearbeiterBestochen) chance *= 0.5;   // geschmierter Sachbearbeiter
      if (Math.random() < chance) {
        let rueck = 0;
        const gestrichen = [];
        if (gs.ernaehrungFake) {
          rueck += MEHRBEDARF_BETRAG.ernaehrung * 3;
          gs.mehrbedarf.ernaehrung = false; gs.ernaehrungFake = false;
          gestrichen.push('Ernährungs-Mehrbedarf');
        }
        if (gs.unterhaltsTarnung) {
          rueck += (gs.kindergeldKinder || []).length * 300 * 3;
          gs.unterhaltsTarnung = false;
          gestrichen.push('Unterhalts-Tarnung');
        }
        if (gs.scheinWG) {
          rueck += SCHEINWG_BETRAG * 3;
          gs.scheinWG = false;
          gestrichen.push('Schein-WG (Hausbesuch!)');
        }
        if (gs.immobilie && gs.immobilie.modus === 'eigen' && gs.status === 'ALG2') {
          rueck += gs.immobilie.miete * 3;
          gs.immobilie.modus = 'vermietet';   // KdU-Masche auffgeflogen → nur noch vermieten
          gestrichen.push('Immobilien-KdU-Masche');
        }
        gs.kontostand   = Math.max(0, gs.kontostand - rueck);
        gs.risikoRaster = clamp(gs.risikoRaster + 30, 0, 100);
        meldungen.push(`🚨 Jobcenter-Prüfung AUFGEFLOGEN! Rückforderung ${formatEuro(rueck)}, Risiko +30. Gestrichen: ${gestrichen.join(', ')}.`);
        logEvent(`🚨 Jobcenter-Prüfung aufgeflogen: -${formatEuro(rueck)}, Risiko +30.`, 'danger');
        sozialbetrugErwischt();   // strafrechtliche Eskalation (Ermittlung → Bewährung → Knast)
      } else {
        meldungen.push('🔍 Jobcenter-Prüfung: diesmal nichts aufgefallen (Glück gehabt).');
        logEvent('🔍 Jobcenter-Prüfung überstanden.', 'warn');
      }
    }
  }

  // Immobilien-Fake und andere Cheat-Extras → schwarze Kasse
  if (gs.monatlicheExtras > 0) {
    gs.schwarzeKasse += gs.monatlicheExtras;
    meldungen.push(`🎭 Cheat-Extras: +${formatEuro(gs.monatlicheExtras)} (Schwarzkasse)`);
    logEvent(`🎭 Cheat +${formatEuro(gs.monatlicheExtras)}.`, 'warn');
  }

  // Risiko-Aufschlag durch Cheats
  if (gs.risikoProMonat > 0) {
    gs.risikoRaster = clamp(gs.risikoRaster + gs.risikoProMonat, 0, 100);
    meldungen.push(`⚠️ Cheat-Risiko: +${gs.risikoProMonat}%`);
    logEvent(`⚠️ Cheat-Risiko +${gs.risikoProMonat}.`, 'danger');
  }

  // ---- Schattenbank-Gebühr: 5% der Schwarzkasse pro Monat ----
  if (gs.schattenbankAktiv && gs.schwarzeKasse > 0) {
    const gebuehr = Math.floor(gs.schwarzeKasse * 0.05);
    gs.schwarzeKasse -= gebuehr;
    meldungen.push(`🏴 Schattenbank-Gebühr: -${formatEuro(gebuehr)} (5% der Schwarzkasse).`);
    logEvent(`🏴 Schattenbank -${formatEuro(gebuehr)}.`, 'warn');
  }

  // Miete
  if (gs.status === 'ALG1') {
    gs.kontostand -= MIETE;
    meldungen.push(`🏠 Miete: -${formatEuro(MIETE)} (selbst zahlen, ALG I)`);
    logEvent(`🏠 Miete -${formatEuro(MIETE)}.`, 'warn');
    if (gs.kontostand < 0) {
      gs.kontostand = 0; gs.status = 'ALG2';
      meldungen.push('❌ Konto überzogen → Bürgergeld-Notfall!');
      logEvent('❌ Konto überzogen → Bürgergeld.', 'danger');
    }
  } else {
    // Staat zahlt die Miete = geldwerter Vorteil -> zählt mit.
    // Ausnahme: bei der Immobilien-KdU-Masche (Eigennutzung) wird die
    // Amt-Miete bereits im Immobilien-Block gezählt -> keine Doppelzählung.
    if (!(gs.immobilie && gs.immobilie.modus === 'eigen')) {
      staatGibt(MIETE);
      meldungen.push(`🏠 Miete vom Staat übernommen: +${formatEuro(MIETE)} (gespart).`);
      logEvent(`🏠 Miete Staat +${formatEuro(MIETE)}.`, 'good');
    } else {
      meldungen.push('🏠 Wohnkosten laufen über die Immobilien-Masche.');
    }
  }

  // Krankenversicherung vom Staat übernommen (geldwerter Vorteil, kein Bargeld)
  staatGibt(KRANKENKASSE_BEITRAG);
  meldungen.push(`🏥 Krankenkasse vom Staat: +${formatEuro(KRANKENKASSE_BEITRAG)} (Beitrag übernommen).`);

  // Laufende Lebenshaltung (Strom, Internet, Handy) – selbst zahlen
  {
    const zahlbar = Math.min(NEBENKOSTEN, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    meldungen.push(`💡 Nebenkosten: -${formatEuro(zahlbar)} (Strom, Internet, Handy).`);
    fehlt(NEBENKOSTEN - zahlbar, 'Nebenkosten');
  }

  // ---- Schmiergeld für den Sachbearbeiter ----
  if (gs.sachbearbeiterBestochen) {
    if (gs.kontostand >= SACHBEARBEITER_KOSTEN) {
      gs.kontostand -= SACHBEARBEITER_KOSTEN;
      meldungen.push(`🤝 Sachbearbeiter-Schmiergeld: -${formatEuro(SACHBEARBEITER_KOSTEN)}.`);
    } else {
      gs.sachbearbeiterBestochen = false;
      meldungen.push('🤝 Schmiergeld nicht gezahlt – der Sachbearbeiter deckt dich nicht mehr!');
      logEvent('🤝 Schmiergeld geplatzt.', 'warn');
    }
  }

  // ---- Sucht: monatliche Folgen ----
  if (gs.suchtStufe > 0) {
    const kosten = gs.suchtStufe * 120;
    const zahlbar = Math.min(kosten, Math.max(0, gs.kontostand));
    gs.kontostand      -= zahlbar;
    gs.gesundheit       = clamp(gs.gesundheit - 4 * gs.suchtStufe, 0, 100);
    gs.happinessSpieler = clamp(gs.happinessSpieler - 3 * gs.suchtStufe, 0, 100);
    meldungen.push(`🍺 Sucht (Stufe ${gs.suchtStufe}): -${formatEuro(zahlbar)}, Gesundheit -${4*gs.suchtStufe}, Laune -${3*gs.suchtStufe}. Entzug in der Arztpraxis!`);
    logEvent(`🍺 Sucht Stufe ${gs.suchtStufe}: -${formatEuro(zahlbar)}.`, 'danger');
  }

  // Natürlicher Verfall
  gs.energie          = clamp(gs.energie - 5, 0, 100);
  gs.happinessSpieler = clamp(gs.happinessSpieler - 3, 0, 100);
  // Partnerlaune nur verfall wenn noch zusammen
  if (!gs.frauAusgezogen) {
    gs.happinessPartner = clamp(gs.happinessPartner - 2, 0, 100);
  }

  // ---- Lebensmittel-Effekte ----
  gs.supermarktFaellig = false; // Tag 3 wird in spielwocheVorbei gesetzt
  if (gs.lebensmittelDiesenMonat === 'billig') {
    gs.gesundheit       = clamp(gs.gesundheit - 5, 0, 100);
    gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100);
    if (!gs.frauAusgezogen) gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100);
    meldungen.push('🍟 Billiges Essen: Gesundheit -5, Laune -10.');
  } else if (gs.lebensmittelDiesenMonat === null) {
    // Kein Einkauf – Malus wird täglich in tickAutoSave abgerechnet
    meldungen.push('⚠️ Kein Lebensmittel-Einkauf diesen Monat!');
  }
  gs.lebensmittelDiesenMonat = null; // Reset für neuen Monat

  // ---- Frau ausgezogen – Prüfung ----
  if (!gs.frauAusgezogen && gs.happinessPartner < 20) {
    gs.frauAusgezogen    = true;
    gs.unterhaltProMonat = 1000;
    meldungen.push('💔 Deine Partnerin ist ausgezogen! Unterhalt: 1.000 €/Monat. Kaufe Geschenke für 5.000 € für ihre Rückkehr.');
    logEvent('💔 Frau ausgezogen! Unterhalt 1.000€/M.', 'danger');
    soundAlarm && soundAlarm();
  }
  // ---- Unterhalt abziehen ----
  if (gs.frauAusgezogen && gs.unterhaltProMonat > 0) {
    const zahlbar = Math.min(gs.unterhaltProMonat, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    meldungen.push(`💸 Unterhalt: -${formatEuro(zahlbar)}`);
    logEvent(`💸 Unterhalt -${formatEuro(zahlbar)}.`, 'danger');
    fehlt(gs.unterhaltProMonat - zahlbar, 'Unterhalt');
  }

  // ---- Gesundheit – Krankenhaus bei < 20 ----
  if (gs.gesundheit < 20 && gs.gesundheit > 0) {
    const behandlung = 20000;
    if (gs.kontostand >= behandlung) {
      gs.kontostand -= behandlung;
      gs.gesundheit  = clamp(gs.gesundheit + 20, 0, 100);
      meldungen.push(`🏥 Krankenhaus: -${formatEuro(behandlung)}, Gesundheit +20.`);
      logEvent('🏥 Krankenhausaufenthalt! -20.000€, Gesundheit +20.', 'danger');
    } else {
      meldungen.push('🏥 Krankenhaus nötig aber kein Geld! Gesundheit kritisch!');
      logEvent('🏥 KEIN GELD FÜR KRANKENHAUS! Gesundheit kritisch!', 'danger');
    }
  }
  // Game Over bei Gesundheit 0
  if (gs.gesundheit <= 0) {
    triggerGameOver('gesundheit');
    return;
  }

  // ---- Arbeitsamt-Sperre aufheben wenn Besuch gemacht ----
  if (gs.algGesperrt) {
    meldungen.push('🛑 ALG gesperrt wegen verpasster Termine! Bitte Arbeitsamt besuchen.');
    logEvent('🛑 ALG gesperrt – Arbeitsamt aufsuchen!', 'danger');
  }

  // ---- Loan-Shark Mahnung-System ----
  if (gs.loanSharkSchuld > 0) {
    gs.loanSharkMahnungStufe = (gs.loanSharkMahnungStufe || 0) + 1;
    // Rückzahlungszeit verdoppelt: Konsequenzen erst bei Stufe 2 / 4 / 6
    if (gs.loanSharkMahnungStufe === 2) {
      meldungen.push('🦈 Kredithai-Mahnung: Zahle deine Schulden!');
      logEvent('🦈 MAHNUNG vom Kredithai!', 'danger');
      setTimeout(() => oeffneModal('🦈 Mahnung vom Kredithai',
        `Du schuldest <strong>${formatEuro(gs.loanSharkSchuld)}</strong>.<br><br>`
        + 'Zahle bald, sonst kommen Eintreiber!', []), 400);
    } else if (gs.loanSharkMahnungStufe === 4) {
      gs.gesundheit = clamp(gs.gesundheit - 5, 0, 100);
      meldungen.push('🦈 Erster Besuch der Eintreiber: Gesundheit -5!');
      logEvent('🦈 Eintreiber! Gesundheit -5.', 'danger');
      soundAlarm && soundAlarm();
      setTimeout(() => oeffneModal('🦈 Eintreiber – erster Besuch!',
        'Zwei Männer haben dich aufgesucht. Eine Warnung.<br><br>'
        + '<strong>Gesundheit −5</strong><br><br>'
        + `Schulden: ${formatEuro(gs.loanSharkSchuld)}`, []), 400);
    } else if (gs.loanSharkMahnungStufe >= 6) {
      gs.gesundheit = clamp(gs.gesundheit - 15, 0, 100);
      meldungen.push('🦈 Zweiter Besuch! Schlimme Verletzungen: Gesundheit -15!');
      logEvent('🦈 Zweiter Besuch! Gesundheit -15!', 'danger');
      soundAlarm && soundAlarm();
      setTimeout(() => oeffneModal('🦈 Eintreiber – zweiter Besuch!',
        'Sie haben es ernst gemeint. Du liegst verletzt am Boden.<br><br>'
        + '<strong>Gesundheit −15</strong><br><br>'
        + 'Zahle sofort oder das nächste Mal wird es schlimmer.', []), 400);
      gs.loanSharkMahnungStufe = 0; // Reset
    }
  } else {
    gs.loanSharkMahnungStufe = 0; // Schulden bezahlt → Reset
  }

  // Loses Bargeld beim Transport penalisieren (noch nicht gesichertes Geld ist Risiko)
  if (gs.losesBargeld > 0) {
    gs.risikoRaster = clamp(gs.risikoRaster + Math.floor(gs.losesBargeld / 200), 0, 100);
    meldungen.push(`⚠️ Loses Bargeld ${formatEuro(gs.losesBargeld)} erhöht Risiko! Zur Bank/Pfandleiher!`);
  }

  // ---- Rückstand mit übrigem Konto-Guthaben tilgen ----
  if (gs.zahlungsRueckstand > 0 && gs.kontostand > 0) {
    const tilg = Math.min(gs.zahlungsRueckstand, gs.kontostand);
    gs.kontostand        -= tilg;
    gs.zahlungsRueckstand -= tilg;
    if (tilg > 0) meldungen.push(`📉 Rückstand getilgt: -${formatEuro(tilg)} (offen: ${formatEuro(gs.zahlungsRueckstand)}).`);
  }
  // Monatszähler für den Rückstand
  if (gs.zahlungsRueckstand > 0) gs.rueckstandMonate++;
  else gs.rueckstandMonate = 0;

  updateHUD();
  pruefeEheKrise();

  // ---- Monatsbericht (mit automatischem Kredithai-Angebot bei Rückstand) ----
  const summaryAktionen = [];
  if (gs.zahlungsRueckstand > 0) {
    const leihBetrag = gs.zahlungsRueckstand;
    const verbleibend = Math.max(0, 3 - gs.rueckstandMonate);
    meldungen.push(`⚠️ <strong>Offener Rückstand: ${formatEuro(leihBetrag)}</strong> – Rückstand seit ${gs.rueckstandMonate} Monat(en). Bei 3 Monaten ohne Begleichung droht <strong>Game Over</strong> (noch ${verbleibend}).`);
    summaryAktionen.push({
      label: `🦈 ${formatEuro(leihBetrag)} beim Kredithai leihen (Zins 10%/M, Risiko +15)`,
      danger: true,
      callback: () => {
        gs.loanSharkSchuld   += leihBetrag;
        gs.zahlungsRueckstand = 0;
        gs.rueckstandMonate   = 0;
        gs.risikoRaster       = clamp(gs.risikoRaster + 15, 0, 100);
        logEvent(`🦈 Rückstand (${formatEuro(leihBetrag)}) mit Kredithai-Kredit beglichen. Schulden jetzt ${formatEuro(gs.loanSharkSchuld)}.`, 'danger');
        soundShark && soundShark();
        updateHUD();
      }
    });
  }
  oeffneModal(`📅 Monatsabschluss – Monat ${gs.monat}`, meldungen.join('<br><br>'), summaryAktionen);
  pruefeGameOverBedingungen();
}

/** Prüft ob Bankrott-Game-Over eingetreten ist */
function pruefeGameOverBedingungen() {
  const gs = gameState;
  if (gs.gameOver) return;

  // ---- GEWINN: 1 Million € in Konto + Depot ----
  const depotWert   = (gs.depot || []).reduce((s,p) => s + p.anteile * p.aktuellerKurs, 0);
  const gesamtLegal = gs.kontostand + depotWert;
  if (gesamtLegal >= 1000000) {
    gs.gameOver = true;
    const formatiertGesamt = gesamtLegal.toLocaleString('de-DE', {minimumFractionDigits:0, maximumFractionDigits:0});
    soundGut && soundGut();
    oeffneModal(
      '🏆 GEWONNEN! Millionär!',
      `<div style="text-align:center; padding:10px 0;">
        <div style="font-size:2rem; margin-bottom:12px;">💰🎉🥂</div>
        <strong>Glückwunsch!</strong> Du hast es geschafft!<br><br>
        Kontostand + Depot: <strong style="color:#ffd700; font-size:1.1rem;">
          ${formatiertGesamt} €
        </strong><br><br>
        Vom Arbeitslosen zum Millionär!<br>
        Der Staat hat verloren.<br><br>
        <em style="color:var(--text-dim); font-size:0.75rem;">
          CEO – Chief Excuse Officer 🏆
        </em>
      </div>`,
      [{ label: '🔄 Neues Spiel', primary: true, callback: () => {
        window._phaserGameRef && window._phaserGameRef.scene.stop('SpielSzene');
        window._phaserGameRef && window._phaserGameRef.scene.start('StartSzene');
      }}]
    );
    logEvent('🏆 GEWONNEN! 1 Million €!', 'good');
    return;
  }

  // Gesundheits-Tod
  if (gs.gesundheit <= 0) {
    triggerGameOver('gesundheit');
    return;
  }

  // Krankenhaus-Warnung bei < 20
  if (gs.gesundheit < 20 && gs.gesundheit > 0) {
    const behandlung = 20000;
    if (gs.kontostand >= behandlung) {
      gs.kontostand -= behandlung;
      gs.gesundheit  = clamp(gs.gesundheit + 20, 0, 100);
      logEvent('🏥 Notfall-Krankenhaus! -20.000€, Gesundheit +20.', 'danger');
      soundAlarm && soundAlarm();
      oeffneModal('🏥 Notfall!',
        'Deine Gesundheit ist kritisch!<br><br>'
        + '<strong>-20.000 €</strong> Krankenhausrechnung.<br>'
        + '<strong>Gesundheit +20</strong>', []);
    } else {
      logEvent('🏥 Gesundheit kritisch! Kein Geld für Krankenhaus!', 'danger');
    }
  }

  // Bankrott (kein Geld, ALG2 läuft)
  if (gs.kontostand <= 0 && gs.schwarzeKasse <= 0 && gs.losesBargeld <= 0
      && (gs.goldBarren || 0) === 0 && gs.status === 'ALG2') {
    // Depot als letzte Reserve
    const depotWert = (gs.depot || []).reduce((s,p) => s + p.anteile * p.aktuellerKurs, 0);
    if (depotWert < 100) triggerGameOver('bankrott');
  }
}

// ================================================================
// ABSCHNITT 16: STADTGRAFIK  – Industrial Building Builder
//   Alle Gebäude bestehen aus echten 3D-Quadern mit:
//   - Noise/Grain-Texturen (Dithering-Muster pro Fläche)
//   - Ambient-Occlusion-Schatten am Sockel
//   - Cel-Shading-Outline nur an Schattenkanten
//   - Fenster mit zufälliger Emission (beleuchtet/dunkel)
//   - Dach-Schräge durch zwei Helligkeits-Flächen
//   - Individuelle Anbauten: Rohre, Antennen, Treppen, Schornsteine
// ================================================================

// ---- Layout (unverändert) ----
const STRASSENLAYOUT = {
  laengs: [0, 4, 8, 12],
  quer:   [0, 4, 8, 12],
};
function istStrasse(col, row) {
  return STRASSENLAYOUT.laengs.includes(col) || STRASSENLAYOUT.quer.includes(row);
}
function istSpielortMitte(col, row) {
  return ORTE_CONFIG.some(o => Math.abs(o.col - col) <= 1 && Math.abs(o.row - row) <= 1);
}

// ================================================================
// BUILDING BUILDER – Kern-Engine
// ================================================================

// ----------------------------------------------------------------
// BB.noise(seed, x, y) → deterministischer Pseudo-Noise-Wert 0..1
//   Kein Math.random() – selbe seed = selbes Muster (konsistente Textur)
// ----------------------------------------------------------------
const BB = {
  noise(seed, x, y) {
    const n = Math.sin(seed * 127.1 + x * 311.7 + y * 74.93) * 43758.5453;
    return n - Math.floor(n);
  },

  // ---- Dithering-Textur: streut kleine Rechtecke über eine Fläche ----
  // x,y = linke obere Ecke, w,h = Fläche, baseFarbe, seed = Gebäude-ID
  ditherFlaeche(g, x, y, w, h, baseFarbe, seed, dichte, helligkeit) {
    dichte     = dichte     || 0.28;  // Anteil Pixel die gezeichnet werden
    helligkeit = helligkeit || 1.15;  // Aufhell-Faktor für Grain
    const STEP = 5;
    const hell = lightenColor(baseFarbe, helligkeit);
    const dunkel = darkenColor(baseFarbe, 0.80);
    g.fillStyle(hell, 0.30);
    for (let px = x; px < x + w; px += STEP) {
      for (let py = y; py < y + h; py += STEP) {
        const v = BB.noise(seed, px * 0.1, py * 0.1);
        if (v < dichte) {
          g.fillRect(px, py, STEP - 1, STEP - 1);
        } else if (v > 0.85) {
          g.fillStyle(dunkel, 0.25);
          g.fillRect(px, py, STEP - 1, STEP - 1);
          g.fillStyle(hell, 0.30);
        }
      }
    }
  },

  // ---- ISO-Flächen-Primitives ----
  isoFill(g, x, y, w, h, col, alpha) {
    g.fillStyle(col, alpha !== undefined ? alpha : 1);
    g.fillPoints([
      {x: x,       y: y - h/2},
      {x: x + w/2, y: y      },
      {x: x,       y: y + h/2},
      {x: x - w/2, y: y      }
    ], true);
  },

  isoWandL(g, x, y, w, h, hoehe, col, alpha) {
    g.fillStyle(col, alpha !== undefined ? alpha : 1);
    g.fillPoints([
      {x: x - w/2, y: y          },
      {x: x,       y: y + h/2    },
      {x: x,       y: y + h/2 - hoehe},
      {x: x - w/2, y: y - hoehe  }
    ], true);
  },

  isoWandR(g, x, y, w, h, hoehe, col, alpha) {
    g.fillStyle(col, alpha !== undefined ? alpha : 1);
    g.fillPoints([
      {x: x,       y: y + h/2  },
      {x: x + w/2, y: y        },
      {x: x + w/2, y: y - hoehe},
      {x: x,       y: y + h/2 - hoehe}
    ], true);
  },

  // ---- Dach: zwei Flächen (hell/dunkel) für 3D-Volumen ----
  isoDach(g, x, y, w, h, hoehe, dachFarbe, seed) {
    // Linke Dach-Hälfte: heller (Lichtseite)
    const dachHell  = lightenColor(dachFarbe, 1.25);
    const dachDunkel = darkenColor(dachFarbe, 0.80);

    // Gesamte Dachfläche
    BB.isoFill(g, x, y - hoehe, w, h, dachFarbe);
    // Hellere linke Hälfte (Licht kommt von oben-links)
    g.fillStyle(dachHell, 0.35);
    g.fillPoints([
      {x: x,       y: y - hoehe - h/2},
      {x: x + w/4, y: y - hoehe - h/4},
      {x: x,       y: y - hoehe      },
      {x: x - w/4, y: y - hoehe - h/4}
    ], true);
    // Dunklere rechte Ecke (Schatten)
    g.fillStyle(dachDunkel, 0.25);
    g.fillPoints([
      {x: x + w/4, y: y - hoehe - h/4},
      {x: x + w/2, y: y - hoehe      },
      {x: x,       y: y - hoehe + h/2},
      {x: x,       y: y - hoehe      }
    ], true);
    // Grain
    BB.ditherFlaeche(g,
      x - w/2, y - hoehe - h/2,
      w * 0.6, h * 0.8,
      dachFarbe, seed + 99, 0.15, 1.2
    );
    // Dach-Rand (Cel-Shading): nur Schattenkante rechts/unten
    g.lineStyle(1.5, darkenColor(dachFarbe, 0.45), 0.8);
    g.lineBetween(x + w/2, y - hoehe, x, y - hoehe + h/2);
    g.lineBetween(x,       y - hoehe + h/2, x - w/2, y - hoehe);
  },

  // ---- Ambient Occlusion: weicher Sockelschatten ----
  ambientOcclusion(g, x, y, w, h) {
    for (let i = 4; i >= 1; i--) {
      const f = i / 4;
      g.fillStyle(0x000000, 0.07 * f);
      g.fillEllipse(x + w * 0.05, y + h * 0.35, w * (1.1 + f * 0.3), h * (0.7 + f * 0.2));
    }
  },

  // ---- Cel-Shading Outline: nur Schattenkanten ----
  celOutline(g, x, y, w, h, hoehe, farbe) {
    const dark = darkenColor(farbe, 0.35);
    g.lineStyle(2, dark, 0.75);
    // Rechte Wand-Kante (dunkel)
    g.lineBetween(x + w/2, y,        x + w/2, y - hoehe);
    // Untere Kante der rechten Wand
    g.lineBetween(x,       y + h/2,  x + w/2, y);
    // Vertikale Innenkante
    g.lineStyle(1, dark, 0.35);
    g.lineBetween(x, y + h/2, x, y + h/2 - hoehe);
  },

  // ---- Grain auf ISO-Wand (links oder rechts) ----
  wandGrain(g, x, y, w, h, hoehe, col, seite, seed) {
    const STEP = 6;
    const hell = lightenColor(col, 1.2);
    const dunkel = darkenColor(col, 0.75);

    if (seite === 'L') {
      // Linke Wand: Koordinatenraum ist Parallelogramm → vereinfacht als Streifen
      for (let ry = 0; ry < hoehe; ry += STEP) {
        const t  = ry / hoehe;
        const lx = x - w/2 + t * (w/2);
        const ly = y - hoehe + ry + t * (h/2);
        for (let rx = 0; rx < w/2; rx += STEP) {
          const nx  = lx + rx;
          const ny  = ly - rx * (h / w);
          const v   = BB.noise(seed, rx * 0.08, ry * 0.08);
          if (v < 0.22) {
            g.fillStyle(hell, 0.18);
            g.fillRect(nx, ny, STEP - 1, 2);
          } else if (v > 0.80) {
            g.fillStyle(dunkel, 0.20);
            g.fillRect(nx, ny, STEP - 1, 2);
          }
        }
      }
    } else {
      // Rechte Wand
      for (let ry = 0; ry < hoehe; ry += STEP) {
        const t  = ry / hoehe;
        const rx0 = x + t * (w/2);
        const ry0 = y - hoehe + ry + t * (h/2) - (h/2);
        for (let rx = 0; rx < w/2; rx += STEP) {
          const nx = rx0 + rx;
          const ny = ry0 - rx * (h / w);
          const v  = BB.noise(seed + 13, rx * 0.08, ry * 0.08);
          if (v < 0.20) {
            g.fillStyle(darkenColor(col, 0.85), 0.18);
            g.fillRect(nx, ny, STEP - 1, 2);
          }
        }
      }
    }
  },

  // ---- Fenster mit Emissions-Variation ----
  fensterReihe(g, x, y, anzahl, fensterW, fensterH, abstand, baseFarbe, seed) {
    for (let i = 0; i < anzahl; i++) {
      const fx = x + i * (fensterW + abstand);
      const v  = BB.noise(seed + i * 7, x * 0.03, y * 0.03);
      let col, alpha;
      if (v < 0.12) {
        col   = 0x111118;  alpha = 0.9; // dunkel: niemand zu Hause
      } else if (v < 0.55) {
        col   = lightenColor(baseFarbe, 1.8);  alpha = 0.8; // normal beleuchtet
      } else if (v < 0.80) {
        col   = 0xffd080;  alpha = 0.9; // warm beleuchtet
      } else {
        col   = 0xaaccff;  alpha = 0.75; // blaues Bildschirmlicht (TV/PC)
      }
      g.fillStyle(col, alpha);
      g.fillRect(fx, y, fensterW, fensterH);
      // Fensterrahmen
      g.lineStyle(1, darkenColor(baseFarbe, 0.5), 0.6);
      g.strokeRect(fx, y, fensterW, fensterH);
      // Fensterkreuz
      g.lineStyle(1, darkenColor(baseFarbe, 0.55), 0.4);
      g.lineBetween(fx + fensterW/2, y, fx + fensterW/2, y + fensterH);
      g.lineBetween(fx, y + fensterH/2, fx + fensterW, y + fensterH/2);
      // Licht-Emission: kleiner Glow wenn hell
      if (alpha > 0.7 && v > 0.12) {
        g.fillStyle(col, 0.08);
        g.fillRect(fx - 3, y - 3, fensterW + 6, fensterH + 6);
      }
    }
  },

  // ---- Anbauten: Rohre ----
  rohr(g, x, y1, y2, farbe) {
    g.lineStyle(4, darkenColor(farbe, 0.6), 0.9);
    g.lineBetween(x, y1, x, y2);
    g.lineStyle(2, lightenColor(farbe, 1.4), 0.3);
    g.lineBetween(x - 1, y1, x - 1, y2);
    // Schellen
    [y1 + 8, (y1+y2)/2, y2 - 8].forEach(sy => {
      g.fillStyle(darkenColor(farbe, 0.5), 0.8);
      g.fillRect(x - 3, sy - 2, 7, 4);
    });
  },

  // ---- Anbauten: Antenne ----
  antenne(g, x, y, hoehe, farbe) {
    g.lineStyle(2, darkenColor(farbe, 0.55), 0.9);
    g.lineBetween(x, y, x, y - hoehe);
    // Querstreben
    [-1, 0, 1].forEach((i, idx) => {
      const hy = y - hoehe * (0.3 + idx * 0.25);
      const hw = 6 + idx * 2;
      g.lineBetween(x - hw, hy, x + hw, hy);
    });
    // Spitze
    g.fillStyle(0xff4444, 0.8);
    g.fillCircle(x, y - hoehe, 2);
  },

  // ---- Anbauten: Treppe (ISO) ----
  treppe(g, x, y, breite, farbe) {
    const stufen = 3;
    for (let s = 0; s < stufen; s++) {
      const f  = (stufen - s) / stufen;
      const sw = breite * f;
      const sh = 5;
      g.fillStyle(lightenColor(farbe, 0.9 + s * 0.12), 0.9);
      g.fillRect(x - sw/2, y + s * sh, sw, sh);
      g.lineStyle(1, darkenColor(farbe, 0.5), 0.5);
      g.strokeRect(x - sw/2, y + s * sh, sw, sh);
    }
  },

  // ---- Anbauten: Schornstein ----
  schornstein(g, x, y, farbe) {
    const schH = 20, schW = 8;
    g.fillStyle(darkenColor(farbe, 0.70), 1);
    g.fillRect(x - schW/2, y - schH, schW, schH);
    g.fillStyle(darkenColor(farbe, 0.55), 1);
    g.fillRect(x - schW/2 - 2, y - schH, schW + 4, 4);
    // Rauch
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xaaaaaa, 0.12 + i * 0.05);
      g.fillCircle(x + i * 2, y - schH - 6 - i * 6, 4 + i * 2);
    }
  },

  // ---- Kompletter Iso-Quader mit allen Effekten ----
  quader(g, x, y, w, h, hoehe, opts) {
    const {
      farbeVorne,   // Vorderwand (links im ISO)
      farbeSeite,   // Seitenwand (rechts im ISO)
      farbeDach,
      seed = 42,
      mitGrain    = true,
      mitAO       = true,
      mitOutline  = true,
    } = opts;

    // 1. Ambient Occlusion (Boden-Schatten, zuerst gezeichnet)
    if (mitAO) BB.ambientOcclusion(g, x - w/2, y - h * 0.2, w, h);

    // 2. Wände
    BB.isoWandL(g, x, y, w, h, hoehe, farbeVorne);
    BB.isoWandR(g, x, y, w, h, hoehe, farbeSeite);

    // 3. Grain auf Wänden
    if (mitGrain) {
      BB.wandGrain(g, x, y, w, h, hoehe, farbeVorne, 'L', seed);
      BB.wandGrain(g, x, y, w, h, hoehe, farbeSeite, 'R', seed + 5);
    }

    // 4. Cel-Shading Outline
    if (mitOutline) BB.celOutline(g, x, y, w, h, hoehe, farbeSeite);

    // 5. Dach (mit Volumen-Shading)
    BB.isoDach(g, x, y, w, h, hoehe, farbeDach, seed);
  }
};

// ---- Farb-Hilfsfunktionen (global, vor BB genutzt) ----
function darkenColor(hex, factor) {
  const r  = Math.floor(((hex >> 16) & 0xff) * factor);
  const gr = Math.floor(((hex >> 8)  & 0xff) * factor);
  const b  = Math.floor(( hex        & 0xff) * factor);
  return (clamp(r,0,255) << 16) | (clamp(gr,0,255) << 8) | clamp(b,0,255);
}
function lightenColor(hex, factor) {
  const r  = Math.min(255, Math.floor(((hex >> 16) & 0xff) * factor));
  const gr = Math.min(255, Math.floor(((hex >> 8)  & 0xff) * factor));
  const b  = Math.min(255, Math.floor(( hex        & 0xff) * factor));
  return (r << 16) | (gr << 8) | b;
}

// ================================================================
// ISO-BASISPRIMITIVES (kompatibel mit altem Code)
// ================================================================
function isoFill(g, x, y, w, h, col, alpha) { BB.isoFill(g, x, y, w, h, col, alpha); }
function isoStroke(g, x, y, w, h, col, lw, alpha) {
  g.lineStyle(lw || 1, col, alpha !== undefined ? alpha : 1);
  g.strokePoints([{x:x,y:y-h/2},{x:x+w/2,y:y},{x:x,y:y+h/2},{x:x-w/2,y:y}], true);
}
function isoWandL(g, x, y, w, h, hoehe, col, alpha) { BB.isoWandL(g, x, y, w, h, hoehe, col, alpha); }
function isoWandR(g, x, y, w, h, hoehe, col, alpha) { BB.isoWandR(g, x, y, w, h, hoehe, col, alpha); }
function isoBlock(g, x, y, w, h, hoehe, dach, links, rechts, rand) {
  BB.isoWandL(g, x, y, w, h, hoehe, links);
  BB.isoWandR(g, x, y, w, h, hoehe, rechts);
  BB.isoFill(g, x, y - hoehe, w, h, dach);
  if (rand !== undefined) {
    isoStroke(g, x, y - hoehe, w, h, rand, 1, 0.4);
    g.lineStyle(1, rand, 0.25);
    g.lineBetween(x-w/2,y,x-w/2,y-hoehe);
    g.lineBetween(x+w/2,y,x+w/2,y-hoehe);
    g.lineBetween(x,y+h/2,x,y+h/2-hoehe);
  }
}

// ================================================================
// HAUPT-GEBÄUDE-ZEICHNER (Building Builder Stil)
// ================================================================

// ---- Gemeinsames Schild (wird von allen Hauptgebäuden genutzt) ----
function zeichneSchild(g, x, y, text, schildFarbe, seed) {
  const sW = Math.max(text.length * 6 + 16, 48);
  const sH = 16;
  // Holzbrett – kein harter Außenrahmen
  g.fillStyle(0x1a0e04, 0.85);
  g.fillRect(x - sW/2 - 1, y - sH/2 - 1, sW + 2, sH + 2);
  g.fillStyle(darkenColor(schildFarbe, 0.25), 0.90);
  g.fillRect(x - sW/2, y - sH/2, sW, sH);
  // Grain auf Schild
  BB.ditherFlaeche(g, x - sW/2, y - sH/2, sW, sH, schildFarbe, seed + 777, 0.18, 1.1);
  // Maserungslinien
  g.lineStyle(1, darkenColor(schildFarbe, 0.15), 0.25);
  for (let ly = -2; ly <= 2; ly += 2)
    g.lineBetween(x - sW/2 + 2, y + ly, x + sW/2 - 2, y + ly);
  // Nieten
  g.fillStyle(lightenColor(schildFarbe, 1.8), 0.55);
  [[-sW/2+4,-sH/2+4],[sW/2-4,-sH/2+4],[-sW/2+4,sH/2-4],[sW/2-4,sH/2-4]].forEach(([dx,dy]) =>
    g.fillCircle(x+dx, y+dy, 1.5)
  );
  // Schnur
  g.lineStyle(1, 0x806040, 0.55);
  g.lineBetween(x-5, y-sH/2-2, x-5, y-sH/2-8);
  g.lineBetween(x+5, y-sH/2-2, x+5, y-sH/2-8);
  // Glow + Text-Pixel
  g.fillStyle(schildFarbe, 0.12);
  g.fillRect(x-sW/2+4, y-5, sW-8, 10);
  g.fillStyle(schildFarbe, 0.95);
  const bW = Math.min(5, (sW-10)/text.length);
  const sx = x - (text.length*bW)/2;
  for (let i = 0; i < text.length; i++) {
    g.fillRect(sx + i*bW, y-4, bW-1, 3);
    g.fillRect(sx + i*bW, y+1, bW-1, 3);
  }
}

// ---- zeichneKlinkerhaus: Jetzt mit Building-Builder ----
function zeichneKlinkerhaus(g, cx, cy, tw, th, opts) {
  const {
    klinkerFarbe = 0xb05a30,
    dachFarbe    = 0x3a3a4a,
    hoehe        = th * 1.4,
    dachart      = 'sattel',
    etagen       = 2,
    fensterFarbe = 0x88aacc,
    tuerFarbe    = 0x4a3020,
    schild       = null,
    schildFarbe  = 0xffd700,
    seed         = Math.abs(Math.floor(cx + cy * 1000)) % 9999,
  } = opts;

  const W = tw * 0.82, H = th * 0.82;

  // Ambient-Occlusion Sockelschatten
  BB.ambientOcclusion(g, cx - W*0.6, cy - H*0.25, W*1.2, H*0.9);

  // Wände (linke = heller, rechte = dunkler)
  const wandVorne = klinkerFarbe;
  const wandSeite = darkenColor(klinkerFarbe, 0.68);
  BB.isoWandL(g, cx, cy, W, H, hoehe, wandVorne);
  BB.isoWandR(g, cx, cy, W, H, hoehe, wandSeite);

  // Grain auf Wänden (Klinker-Textur)
  BB.wandGrain(g, cx, cy, W, H, hoehe, wandVorne, 'L', seed);
  BB.wandGrain(g, cx, cy, W, H, hoehe, wandSeite, 'R', seed + 5);

  // Horizontale Fug-Linien (Ziegeloptik)
  const fugeCol = darkenColor(klinkerFarbe, 0.5);
  g.lineStyle(1, fugeCol, 0.35);
  const reihH = hoehe / (etagen * 3.5);
  for (let ri = 1; ri < etagen * 3; ri++) {
    const fy = cy + H/2 - ri * reihH;
    const t  = ri * reihH / hoehe;
    g.lineBetween(cx - W/2 * (1-t*0.3), fy + t*H*0.1, cx + t*W*0.05, fy + t*H*0.35);
  }

  // Cel-Outline
  BB.celOutline(g, cx, cy, W, H, hoehe, wandSeite);

  // Dach
  if (dachart === 'sattel') {
    const dachH = H * 0.85;
    const spX = cx, spY = cy - hoehe - dachH;
    // Linke Dachfläche (hell)
    g.fillStyle(lightenColor(dachFarbe, 1.35), 1);
    g.fillTriangle(cx-W/2, cy-hoehe, cx, cy-hoehe-H/2, spX, spY);
    // Rechte Dachfläche (dunkel)
    g.fillStyle(darkenColor(dachFarbe, 0.78), 1);
    g.fillTriangle(cx, cy-hoehe-H/2, cx+W/2, cy-hoehe, spX, spY);
    // Grain auf Dach
    BB.ditherFlaeche(g, cx-W/2, spY, W*0.55, hoehe*0.35 + dachH, dachFarbe, seed+11, 0.18, 1.2);
    // First-Linie (Cel-Shading)
    g.lineStyle(1.5, darkenColor(dachFarbe, 0.45), 0.85);
    g.lineBetween(cx-W/2, cy-hoehe, spX, spY);
    g.lineBetween(cx+W/2, cy-hoehe, spX, spY);
    // Dachfenster / Gaube
    g.fillStyle(fensterFarbe, 0.55 + BB.noise(seed+20, 1, 1) * 0.35);
    g.fillRect(cx-5, spY+dachH*0.35, 10, 9);
    g.lineStyle(1, dachFarbe, 0.7); g.strokeRect(cx-5, spY+dachH*0.35, 10, 9);
  } else if (dachart === 'flach') {
    BB.isoDach(g, cx, cy, W, H, hoehe, dachFarbe, seed);
    // Dachaufbau
    BB.quader(g, cx-W*0.18, cy-hoehe, W*0.32, H*0.32, H*0.38, {
      farbeVorne: darkenColor(dachFarbe, 0.9),
      farbeSeite: darkenColor(dachFarbe, 0.72),
      farbeDach:  darkenColor(dachFarbe, 0.85),
      seed: seed+3, mitGrain: false, mitAO: false
    });
  } else if (dachart === 'walm') {
    const dachH = H * 0.65;
    g.fillStyle(lightenColor(dachFarbe, 1.3), 1);
    g.fillTriangle(cx-W/2, cy-hoehe, cx+W/2, cy-hoehe, cx, cy-hoehe-dachH);
    g.fillStyle(darkenColor(dachFarbe, 0.72), 1);
    g.fillTriangle(cx-W/2, cy-hoehe, cx-W/2, cy-hoehe-H/2, cx, cy-hoehe-dachH);
    g.fillTriangle(cx+W/2, cy-hoehe, cx+W/2, cy-hoehe-H/2, cx, cy-hoehe-dachH);
    BB.ditherFlaeche(g, cx-W/2, cy-hoehe-dachH, W*0.55, dachH, dachFarbe, seed+9, 0.15, 1.15);
    g.lineStyle(1.5, darkenColor(dachFarbe, 0.4), 0.8);
    g.lineBetween(cx-W/2, cy-hoehe, cx, cy-hoehe-dachH);
    g.lineBetween(cx+W/2, cy-hoehe, cx, cy-hoehe-dachH);
  }

  // Fenster (etagen × 2 Spalten)
  const fW = W * 0.20, fH = hoehe / (etagen + 1) * 0.52;
  for (let e = 0; e < etagen; e++) {
    const fy = cy - hoehe * ((e + 0.68) / (etagen + 0.5)) + H * 0.1;
    const fx1 = cx - W * 0.31;
    BB.fensterReihe(g, fx1 - fW/2, fy - fH/2, 2, fW, fH, W*0.10, fensterFarbe, seed + e*17);
    // Fensterbänke
    g.fillStyle(lightenColor(klinkerFarbe, 1.28), 0.7);
    g.fillRect(fx1 - fW/2 - 2, fy + fH/2, fW*2 + W*0.10 + 4, 3);
    // Rollläden-Schlagläden
    g.fillStyle(darkenColor(klinkerFarbe, 0.58), 0.45);
    g.fillRect(fx1 - fW/2 - 4, fy - fH/2, 3, fH);
    g.fillRect(fx1 + fW/2 + W*0.10 + 1, fy - fH/2, 3, fH);
  }

  // Eingangstür
  const turH = hoehe * 0.30, turW = W * 0.20;
  const turX = cx - W * 0.14, turY = cy;
  g.fillStyle(tuerFarbe, 1);
  g.fillRect(turX-turW/2, turY-turH, turW, turH);
  g.fillStyle(tuerFarbe, 1); g.fillCircle(turX, turY-turH, turW/2);
  // Türdetails
  g.fillStyle(lightenColor(tuerFarbe, 1.5), 0.35);
  g.fillRect(turX-turW/2+3, turY-turH+4, turW-6, turH-4);
  g.fillStyle(0xffd700, 1); g.fillCircle(turX+turW*0.32, turY-turH*0.38, 2);
  // Türstufe
  BB.treppe(g, turX, turY, turW * 1.4, klinkerFarbe);

  // Schild
  if (schild) zeichneSchild(g, cx - W*0.24, cy - hoehe * 0.70, schild, schildFarbe, seed);
}

// ================================================================
// HAUPT-SPIELORTE (Building-Builder Stil)
// ================================================================

function baueWohnung(g, cx, cy, tw, th) {
  const W = tw * 0.88, H = th * 0.88;
  const hoehe = th * 1.65, seed = 1001;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0xb8642a, dachFarbe: 0x4a3830,
    hoehe, dachart: 'sattel', etagen: 2,
    fensterFarbe: 0xffd080, tuerFarbe: 0x5a2a10,
    schild: 'WOHNUNG', schildFarbe: 0x88aacc, seed
  });
  // Briefkasten
  g.fillStyle(0x2255bb, 1);
  g.fillRect(cx-W*0.50, cy-H*0.22, 8, 10);
  BB.ditherFlaeche(g, cx-W*0.50, cy-H*0.22, 8, 10, 0x2255bb, seed+50, 0.25, 1.2);
  g.fillStyle(0xffd700, 0.8); g.fillRect(cx-W*0.50, cy-H*0.14, 8, 2);
  // Blumenkasten
  g.fillStyle(0x6a3010, 0.95); g.fillRect(cx-W*0.42, cy-H*0.58, 18, 6);
  BB.ditherFlaeche(g, cx-W*0.42, cy-H*0.58, 18, 6, 0x6a3010, seed+51, 0.3, 1.0);
  [0,4,8,12].forEach(dx => { g.fillStyle(0xff4466+dx*0x010000, 1); g.fillCircle(cx-W*0.42+dx+2, cy-H*0.59, 2.5); });
  // Rohr an der Seite
  BB.rohr(g, cx+W*0.42, cy, cy-hoehe*0.7, 0x8a7060);
  // Schornstein
  BB.schornstein(g, cx - W*0.18, cy - hoehe);
}

function baueArbeitsamt(g, cx, cy, tw, th) {
  const W = tw * 1.05, H = th * 1.05;
  const hoehe = th * 1.95, seed = 1002;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x8a8a9a, dachFarbe: 0x505060,
    hoehe, dachart: 'flach', etagen: 3,
    fensterFarbe: 0xaabbcc, tuerFarbe: 0x2a3050,
    schild: 'JOBCENTER', schildFarbe: 0x3060d0, seed
  });
  // Fahnenmasten
  [-1,1].forEach(side => {
    const fx = cx + side*W*0.40;
    g.lineStyle(2, 0xb0b0b0, 1); g.lineBetween(fx, cy, fx, cy-hoehe*1.35);
    g.fillStyle(side>0 ? 0xcc0000 : 0xffcc00, 0.9);
    g.fillRect(fx, cy-hoehe*1.35, 22*side, 13);
    BB.ditherFlaeche(g, Math.min(fx,fx+22*side), cy-hoehe*1.35, 22, 13, side>0?0xcc0000:0xffcc00, seed+side*10, 0.2, 1.15);
  });
  // Treppe (3 Stufen)
  for (let i = 0; i < 3; i++) {
    const sf = 1 + i*0.09;
    g.fillStyle(lightenColor(0x8a8a9a, 0.88 + i*0.07), 0.85);
    BB.isoFill(g, cx, cy + i*H*0.12, W*sf*0.75, H*sf*0.4, 0x909090+i*0x080808);
    BB.ditherFlaeche(g, cx-W*sf*0.38, cy+i*H*0.12-H*0.15, W*sf*0.75, H*0.3, 0x909090, seed+i, 0.15, 1.1);
  }
  // Rohre am Dach
  BB.rohr(g, cx+W*0.38, cy, cy-hoehe*0.85, 0x707080);
  BB.rohr(g, cx+W*0.32, cy-hoehe*0.3, cy-hoehe*0.85, 0x707080);
}

function baueBaustelle(g, cx, cy, tw, th) {
  const W = tw, H = th, seed = 1003;
  // Erde
  BB.isoFill(g, cx, cy, W*1.2, H*1.2, 0x6a5030);
  BB.ditherFlaeche(g, cx-W*0.62, cy-H*0.5, W*1.2, H, 0x6a5030, seed, 0.35, 0.9);
  // Zaun
  const zfarben = [0xffcc00, 0x1a1a1a];
  for (let i = 0; i < 14; i++) {
    const zx = cx - W*0.62 + i*(W*1.24/14);
    g.fillStyle(zfarben[i%2], 0.92); g.fillRect(zx, cy-H*0.48, W*1.24/14-1, H*0.58);
  }
  for (let i = 0; i <= 3; i++) { g.fillStyle(0x404040,1); g.fillRect(cx-W*0.62+i*(W*1.24/3), cy-H*0.52, 5, H*0.65); }
  // Rohbau
  zeichneKlinkerhaus(g, cx, cy-H*0.12, tw*0.92, th*0.92, {
    klinkerFarbe: 0x757575, dachFarbe: 0x555555,
    hoehe: th*1.18, dachart: 'flach', etagen: 1,
    fensterFarbe: 0x303030, tuerFarbe: 0x252525,
    schild: 'BAUSTELLE', schildFarbe: 0xffcc00, seed
  });
  // Kran-Mast
  g.lineStyle(5, 0xffcc00, 1); g.lineBetween(cx+W*0.42, cy, cx+W*0.42, cy-H*3.5);
  g.lineStyle(4, 0xffcc00, 1); g.lineBetween(cx+W*0.42, cy-H*3.5, cx-W*0.38, cy-H*3.5);
  BB.ditherFlaeche(g, cx+W*0.40, cy-H*3.5, 5, H*3.5, 0xffcc00, seed+77, 0.25, 0.9);
  // Kran-Gegengewicht
  g.lineStyle(4, 0xff8800, 1); g.lineBetween(cx+W*0.42, cy-H*3.5, cx+W*0.62, cy-H*3.5);
  g.fillStyle(0xff8800,1); g.fillRect(cx+W*0.58, cy-H*3.5-7, 18, 14);
  BB.ditherFlaeche(g, cx+W*0.58, cy-H*3.5-7, 18, 14, 0xff8800, seed+88, 0.3, 0.85);
  // Seil + Last
  g.lineStyle(1.5, 0xd8d8d8, 0.9); g.lineBetween(cx-W*0.18, cy-H*3.5, cx-W*0.18, cy-H*1.55);
  g.fillStyle(0x808080,1); g.fillRect(cx-W*0.24, cy-H*1.55-6, 12, 10);
  BB.ditherFlaeche(g, cx-W*0.24, cy-H*1.55-6, 12, 10, 0x808080, seed+89, 0.35, 0.85);
  // Betonmischer
  g.fillStyle(0xcc3318, 0.92); g.fillEllipse(cx-W*0.32, cy-H*0.18, 22, 15);
  BB.ditherFlaeche(g, cx-W*0.42, cy-H*0.28, 22, 15, 0xcc3318, seed+90, 0.3, 0.9);
  // Rohre
  BB.rohr(g, cx+W*0.15, cy, cy-H*1.2, 0x808080);
  BB.rohr(g, cx+W*0.22, cy, cy-H*0.8, 0x707070);
}

function baueBank(g, cx, cy, tw, th) {
  const W = tw*1.08, H = th*1.08, hoehe = th*2.1, seed = 1004;
  zeichneKlinkerhaus(g, cx, cy, tw*1.05, th*1.05, {
    klinkerFarbe: 0x6a7860, dachFarbe: 0x384030,
    hoehe, dachart: 'walm', etagen: 3,
    fensterFarbe: 0x88b888, tuerFarbe: 0x1a2418,
    schild: 'SPARKASSE', schildFarbe: 0xff4444, seed
  });
  // Säulen mit Grain
  [-0.18, 0.10].forEach((xf, si) => {
    const sx = cx + W*xf;
    g.fillStyle(0xd0d4cc, 1); g.fillRect(sx-4, cy-hoehe*1.12, 8, hoehe*1.12);
    BB.ditherFlaeche(g, sx-4, cy-hoehe*1.12, 8, hoehe*1.12, 0xd0d4cc, seed+si*7, 0.22, 1.15);
    g.fillStyle(0xe0e4dc, 1); g.fillRect(sx-6, cy-hoehe*1.12, 12, 7); g.fillRect(sx-5, cy-7, 10, 7);
  });
  // Kuppel
  const kR = W*0.26;
  g.fillStyle(0x70987c, 1); g.fillEllipse(cx-W*0.10, cy-hoehe-kR*0.42, kR*2, kR);
  BB.ditherFlaeche(g, cx-W*0.10-kR, cy-hoehe-kR*0.9, kR*2, kR, 0x70987c, seed+44, 0.2, 1.18);
  g.fillStyle(0x90c8a0, 0.55); g.fillEllipse(cx-W*0.14, cy-hoehe-kR*0.52, kR*1.35, kR*0.6);
  g.fillStyle(0xffd700, 1); g.fillCircle(cx-W*0.10, cy-hoehe-kR*0.95, 3);
  g.fillTriangle(cx-W*0.10-3, cy-hoehe-kR*0.95, cx-W*0.10+3, cy-hoehe-kR*0.95, cx-W*0.10, cy-hoehe-kR*1.48);
  // Rohre Dach
  BB.rohr(g, cx+W*0.36, cy, cy-hoehe*0.75, 0x607060);
  BB.antenne(g, cx+W*0.28, cy-hoehe, 22, 0x708070);
}

function bauePfandleiher(g, cx, cy, tw, th) {
  const W = tw*0.88, H = th*0.88, hoehe = th*1.35, seed = 1005;
  zeichneKlinkerhaus(g, cx, cy, tw*0.88, th*0.88, {
    klinkerFarbe: 0x9a2828, dachFarbe: 0x601818,
    hoehe, dachart: 'flach', etagen: 1,
    fensterFarbe: 0xffcc88, tuerFarbe: 0x3a0e0e,
    schild: 'PFAND', schildFarbe: 0xffd700, seed
  });
  // Markise
  for (let i = 0; i < 8; i++) {
    const mx = cx - W*0.48 + i*(W*0.96/8);
    g.fillStyle(i%2===0 ? 0xcc1c1c : 0xf4f0f0, 0.95);
    g.fillRect(mx, cy-hoehe-3, W*0.96/8-1, 15);
    BB.ditherFlaeche(g, mx, cy-hoehe-3, W*0.96/8-1, 15, i%2===0?0xcc1c1c:0xf0f0f0, seed+i, 0.2, 1.1);
  }
  g.lineStyle(1.5, 0x880808, 0.8); g.strokeRect(cx-W*0.48, cy-hoehe-3, W*0.96, 15);
  // 3 goldene Kugeln
  const kY = cy - hoehe - 24;
  [-13, 0, 13].forEach(dx => {
    g.fillStyle(0xffd700, 1); g.fillCircle(cx-W*0.22+dx, kY, 8);
    BB.ditherFlaeche(g, cx-W*0.22+dx-8, kY-8, 16, 16, 0xffd700, seed+dx, 0.25, 1.25);
    g.fillStyle(0xffee88, 0.55); g.fillCircle(cx-W*0.22+dx-2.5, kY-2.5, 3.5);
  });
  g.lineStyle(2.5, 0xbb8800, 0.85); g.lineBetween(cx-W*0.22-13, kY, cx-W*0.22+13, kY);
  g.lineBetween(cx-W*0.22, kY, cx-W*0.22, kY+16);
  // Rohr
  BB.rohr(g, cx+W*0.42, cy, cy-hoehe*0.6, 0x802020);
}

function baueAmuesier(g, cx, cy, tw, th) {
  const W = tw, H = th, hoehe = th*1.58, seed = 1006;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x180a28, dachFarbe: 0x0c0418,
    hoehe, dachart: 'flach', etagen: 2,
    fensterFarbe: 0xff44cc, tuerFarbe: 0x080210,
    schild: 'NACHTCLUB', schildFarbe: 0xff44cc, seed
  });
  const topY = cy - hoehe;
  // Neon-Akzent: NUR Dachlinie + Ecken, kein Kasten
  g.lineStyle(2, 0xff44cc, 0.55);
  // Vorderkante des Daches (horizontal)
  g.lineBetween(cx-W*0.46, topY, cx, topY + H*0.5);
  g.lineStyle(1, 0xff44cc, 0.25);
  g.lineBetween(cx-W*0.46, topY, cx, topY + H*0.5);
  // Lichterkette
  for (let i = 0; i < 10; i++) {
    const lx = cx - W*0.43 + i*(W*0.86/10);
    const emit = BB.noise(seed+i*3, lx*0.1, topY*0.1);
    g.fillStyle(i%2===0 ? 0xffff88 : 0xff88ff, emit > 0.3 ? 0.92 : 0.4);
    g.fillCircle(lx, topY+7, 3);
    g.fillStyle(i%2===0 ? 0xffff88 : 0xff88ff, 0.15);
    g.fillCircle(lx, topY+7, 7);
  }
  // Cocktailglas Neon
  const gx = cx+W*0.28, gy = topY-28;
  g.lineStyle(2, 0x44ffcc, 0.9);
  g.strokeTriangle(gx-7, gy-14, gx+7, gy-14, gx, gy);
  g.lineBetween(gx, gy, gx, gy+9); g.lineBetween(gx-5, gy+9, gx+5, gy+9);
  g.fillStyle(0xff8844, 0.65); g.fillCircle(gx+6, gy-17, 3.5);
  // Bullaugen (beleuchtet/dunkel zufällig)
  [-0.28, 0.22].forEach((xf, bi) => {
    const bx = cx+W*xf, by = cy-hoehe*0.65;
    const emit = BB.noise(seed+bi*11, bx, by);
    g.fillStyle(emit > 0.4 ? 0xcc44ff : 0x220033, emit > 0.4 ? 0.55 : 0.8);
    g.fillCircle(bx, by, 11);
    if (emit > 0.4) { g.fillStyle(0xee88ff, 0.2); g.fillCircle(bx, by, 16); }
    g.lineStyle(2, 0xcc44ff, 0.85); g.strokeCircle(bx, by, 11);
  });
}

function baueSportverein(g, cx, cy, tw, th) {
  const seed = 1007;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x286030, dachFarbe: 0x184018,
    hoehe: th*1.32, dachart: 'flach', etagen: 1,
    fensterFarbe: 0x88ddaa, tuerFarbe: 0x153818,
    schild: 'SPORTVEREIN', schildFarbe: 0xffffff, seed
  });
  // Fußball mit Grain
  g.fillStyle(0xffffff, 1); g.fillCircle(cx+tw*0.36, cy-th*0.3, 11);
  BB.ditherFlaeche(g, cx+tw*0.25, cy-th*0.42, 22, 22, 0xffffff, seed+55, 0.15, 0.88);
  g.fillStyle(0x181818, 0.9); [[0,-3],[-4,3],[4,3]].forEach(([dx,dy]) => g.fillCircle(cx+tw*0.36+dx, cy-th*0.3+dy, 3.5));
  // Rasen
  BB.isoFill(g, cx, cy, tw*0.95, th*0.95, 0x205028, 0.28);
  BB.ditherFlaeche(g, cx-tw*0.48, cy-th*0.45, tw*0.95, th*0.5, 0x205028, seed+66, 0.3, 0.85);
  // Antenne
  BB.antenne(g, cx-tw*0.22, cy-th*1.32, 18, 0x8a9a8a);
}

function baueLoanShark(g, cx, cy, tw, th) {
  const W = tw, H = th, hoehe = th*1.22, seed = 1008;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x381010, dachFarbe: 0x1e0808,
    hoehe, dachart: 'flach', etagen: 1,
    fensterFarbe: 0xff3030, tuerFarbe: 0x0e0404,
    schild: 'KREDIT', schildFarbe: 0xff4444, seed
  });
  // Rote Warn-Akzente: nur Dachkante, KEIN Kasten
  g.lineStyle(2, 0xff2020, 0.50);
  g.lineBetween(cx-W*0.45, cy-hoehe, cx, cy-hoehe+H*0.5);
  // Haifisch
  const sx = cx-W*0.24, sy = cy-hoehe-20;
  g.fillStyle(0xff3333, 0.72);
  g.fillTriangle(sx-10, sy+5, sx+10, sy+5, sx, sy-16);
  g.lineStyle(1.5, 0xff7777, 0.5); g.strokeCircle(sx, sy+10, 12);
  // Rohre bedrohlich
  BB.rohr(g, cx+W*0.38, cy, cy-hoehe*0.9, 0x601010);
  BB.rohr(g, cx+W*0.30, cy-hoehe*0.2, cy-hoehe*0.9, 0x501010);
}

function baueKasino(g, cx, cy, tw, th) {
  const W = tw, H = th, hoehe = th*1.72, seed = 1009;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x501450, dachFarbe: 0x300830,
    hoehe, dachart: 'flach', etagen: 2,
    fensterFarbe: 0xffcc44, tuerFarbe: 0x180412,
    schild: 'KASINO', schildFarbe: 0xffcc00, seed
  });
  const topY = cy - hoehe;
  // Gold-Akzent: nur Dachkante, KEIN Kasten
  g.lineStyle(2, 0xffcc00, 0.55);
  g.lineBetween(cx-W*0.46, topY, cx, topY+H*0.5);
  // Roulette-Rad mit Grain
  const rx = cx-W*0.24, ry = topY-26, rad = 16;
  g.fillStyle(0x180028, 1); g.fillCircle(rx, ry, rad);
  BB.ditherFlaeche(g, rx-rad, ry-rad, rad*2, rad*2, 0x180028, seed+33, 0.3, 0.7);
  g.lineStyle(2, 0xffcc00, 0.95); g.strokeCircle(rx, ry, rad);
  for (let a = 0; a < 8; a++) {
    const ang = a/8*Math.PI*2;
    g.lineStyle(1.5, 0xffcc00, 0.8);
    g.lineBetween(rx, ry, rx+Math.cos(ang)*rad*0.85, ry+Math.sin(ang)*rad*0.85);
    g.fillStyle(a%2===0 ? 0xcc1818 : 0x181818, 0.75);
    g.fillCircle(rx+Math.cos(ang)*rad*0.55, ry+Math.sin(ang)*rad*0.55, 3.5);
  }
  g.fillStyle(0xffcc00, 1); g.fillCircle(rx, ry, 3.5);
  // Lichterkette
  for (let i = 0; i < 10; i++) {
    const lx = cx-W*0.43+i*(W*0.86/10);
    const emit = BB.noise(seed+i*5, lx*0.1, topY*0.1);
    g.fillStyle(0xffee00, emit>0.35 ? 0.95 : 0.35); g.fillCircle(lx, topY+6, 3);
    g.fillStyle(0xffee88, 0.18); g.fillCircle(lx, topY+6, 7);
  }
  // Vorhang Eingang
  g.fillStyle(0x780018, 0.92);
  g.fillRect(cx-W*0.10, cy-hoehe*0.52, W*0.26, hoehe*0.52);
  BB.ditherFlaeche(g, cx-W*0.10, cy-hoehe*0.52, W*0.26, hoehe*0.52, 0x780018, seed+22, 0.25, 0.85);
  g.fillStyle(0xa80028, 0.7);
  g.fillTriangle(cx-W*0.10, cy-hoehe*0.52, cx-W*0.10+9, cy-hoehe*0.52, cx-W*0.10, cy-hoehe*0.10);
  g.fillTriangle(cx-W*0.10+W*0.26-9, cy-hoehe*0.52, cx-W*0.10+W*0.26, cy-hoehe*0.52, cx-W*0.10+W*0.26, cy-hoehe*0.10);
}

// ================================================================
// FÜLLGEBÄUDE (kompakter, kein eigener Schild)
// ================================================================
function zeichneFuellgebaeude(g, tileW, tileH, offsetX, offsetY) {
  const klinkerPalette = [
    0xb8642a, 0xc87840, 0x9a5030, 0xa06838,
    0xb05a50, 0x906050, 0x8a7060, 0xc09060,
    0xa08050, 0x785040,
  ];
  const dachPalette = [0x3a3030, 0x403838, 0x2a2a3a, 0x384030, 0x3a3040, 0x282830];
  const dacharten  = ['sattel','sattel','flach','walm','sattel','sattel'];

  for (let c = 0; c <= 15; c++) {
    for (let r = 0; r <= 15; r++) {
      if (istStrasse(c, r))     continue;
      if (istSpielortMitte(c,r)) continue;
      const pos  = isoToScreen(c+0.5, r+0.5, tileW, tileH, offsetX, offsetY);
      const seed = (c*73 + r*137) % 9999;
      const si   = seed % klinkerPalette.length;
      const di   = (seed*3) % dachPalette.length;
      const hi   = (seed*7) % dacharten.length;
      const hfak = 0.72 + (seed % 5) * 0.10;
      const W2   = tileW * 0.60, H2 = tileH * 0.60;
      const hoehe = tileH * hfak;

      BB.ambientOcclusion(g, pos.x-W2*0.55, pos.y-H2*0.2, W2*1.1, H2*0.8);
      BB.isoWandL(g, pos.x, pos.y, W2, H2, hoehe, klinkerPalette[si]);
      BB.isoWandR(g, pos.x, pos.y, W2, H2, hoehe, darkenColor(klinkerPalette[si], 0.68));
      BB.wandGrain(g, pos.x, pos.y, W2, H2, hoehe, klinkerPalette[si], 'L', seed);
      BB.celOutline(g, pos.x, pos.y, W2, H2, hoehe, darkenColor(klinkerPalette[si], 0.55));

      if (dacharten[hi] === 'sattel') {
        const dH = H2 * 0.8;
        g.fillStyle(lightenColor(dachPalette[di], 1.3), 1);
        g.fillTriangle(pos.x-W2/2, pos.y-hoehe, pos.x, pos.y-hoehe-H2/2, pos.x, pos.y-hoehe-dH);
        g.fillStyle(darkenColor(dachPalette[di], 0.78), 1);
        g.fillTriangle(pos.x, pos.y-hoehe-H2/2, pos.x+W2/2, pos.y-hoehe, pos.x, pos.y-hoehe-dH);
      } else {
        BB.isoDach(g, pos.x, pos.y, W2, H2, hoehe, dachPalette[di], seed);
      }

      // Fenster (1 pro Etage)
      const fW = W2*0.20, fH = hoehe/4.5;
      const fy  = pos.y - hoehe*0.55;
      const fx  = pos.x - W2*0.28;
      BB.fensterReihe(g, fx-fW/2, fy-fH/2, 1, fW, fH, 0, 0x88aacc, seed);

      // Gelegentliche Anbauten
      if (seed % 5 === 0) BB.rohr(g, pos.x+W2*0.41, pos.y, pos.y-hoehe*0.65, darkenColor(klinkerPalette[si], 0.7));
      if (seed % 7 === 0) BB.antenne(g, pos.x-W2*0.15, pos.y-hoehe, 14, darkenColor(dachPalette[di], 0.7));
      if (seed % 11 === 0) BB.schornstein(g, pos.x-W2*0.20, pos.y-hoehe);
    }
  }
}

// ================================================================
// STADTBODEN & STRAẞEN
// ================================================================
function zeichneStadtboden(g, tileW, tileH, offsetX, offsetY, cols, rows) {
  for (let c = -1; c <= cols+1; c++) {
    for (let r = -1; r <= rows+1; r++) {
      const pos = isoToScreen(c+0.5, r+0.5, tileW, tileH, offsetX, offsetY);
      const strasse       = istStrasse(c, r);
      const neben_strasse = !strasse && (istStrasse(c-1,r)||istStrasse(c+1,r)||istStrasse(c,r-1)||istStrasse(c,r+1));
      const istKreuzung   = (c%4===0)&&(r%4===0);

      if (c<0||c>=cols||r<0||r>=rows) { isoFill(g,pos.x,pos.y,tileW,tileH,0x0a0c10,0.5); continue; }

      let farbe, alpha;
      if (strasse)        { farbe = istKreuzung ? 0x252730 : 0x1c1e2a; alpha = 1.0; }
      else if (neben_strasse){ farbe = 0x28303a; alpha = 0.95; }
      else                { farbe = 0x0e1520; alpha = 0.9; }

      isoFill(g, pos.x, pos.y, tileW, tileH, farbe, alpha);

      if (strasse) {
        isoStroke(g, pos.x, pos.y, tileW, tileH, 0x3a3e50, 1, 0.5);
        if (c%4===0 && r%2===0) { g.fillStyle(0xffd700,0.22); g.fillRect(pos.x-1,pos.y-1,2,2); }
        if (r%4===0 && c%2===0) { g.fillStyle(0xffffff,0.10); g.fillRect(pos.x-1,pos.y-1,2,2); }
      } else if (neben_strasse) {
        isoStroke(g, pos.x, pos.y, tileW, tileH, 0x4a5060, 1, 0.4);
      } else if (!istSpielortMitte(c, r)) {
        isoStroke(g, pos.x, pos.y, tileW, tileH, 0x1a2a18, 1, 0.3);
        if ((c+r)%5===0) {
          g.fillStyle(0x2a5a22, 0.5); g.fillCircle(pos.x, pos.y, 5);
          g.fillStyle(0x1a3a14, 0.4); g.fillCircle(pos.x+2, pos.y-2, 3);
        }
      }
    }
  }
}

function zeichneStrassendeko(g, tileW, tileH, offsetX, offsetY) {
  STRASSENLAYOUT.laengs.forEach(lx => {
    STRASSENLAYOUT.quer.forEach(qy => {
      const pos = isoToScreen(lx+0.5, qy+0.5, tileW, tileH, offsetX, offsetY);
      g.lineStyle(2, 0x707080, 1);
      g.lineBetween(pos.x, pos.y, pos.x-4, pos.y-tileH*1.1);
      g.lineBetween(pos.x-4, pos.y-tileH*1.1, pos.x-4, pos.y-tileH*1.3);
      g.fillStyle(0xfff0a0, 0.92); g.fillCircle(pos.x-4, pos.y-tileH*1.3, 5);
      g.fillStyle(0xfff0a0, 0.28); g.fillCircle(pos.x-4, pos.y-tileH*1.3, 10);
    });
    STRASSENLAYOUT.quer.forEach(qy => {
      for (let dc = 1; dc <= 3; dc++) {
        const pos = isoToScreen(lx+dc, qy+0.5, tileW, tileH, offsetX, offsetY);
        g.fillStyle(0xffffff, 0.10);
        for (let z = 0; z < 3; z++) g.fillRect(pos.x-tileW*0.2+z*(tileW*0.15), pos.y-2, tileW*0.08, 4);
      }
    });
  });
}

// ================================================================
// BILD-GEBÄUDE
// Ist für eine ort.id hier ein Eintrag hinterlegt UND die Textur
// geladen, wird das PNG statt der gezeichneten Vektor-Variante genutzt.
//   breite  = Anzeigebreite als Vielfaches von tileW
//   ankerY  = vertikaler Ankerpunkt (1 = Bildunterkante sitzt auf cy)
//   dy      = Feinjustierung hoch/runter (Vielfaches von tileH)
//   dx      = Feinjustierung links/rechts (Vielfaches von tileW, optional)
// ================================================================
const BUILDING_SPRITES = {
  bank:       { file: 'assets/buildings/bank.png',           breite: 2.28, ankerY: 0.86, dy: 0.10 },
  arbeitsamt: { file: 'assets/buildings/arbeitsamt.png',     breite: 2.83, ankerY: 0.92, dy: 0.18 },
  baustelle:  { file: 'assets/buildings/baustelle.png',      breite: 3.05, ankerY: 0.86, dy: 0.10, dx: 0.25 },
  pawn:       { file: 'assets/buildings/pfandleiher.png',    breite: 1.31, ankerY: 0.86, dy: 0.10 },
  amuesier:   { file: 'assets/buildings/amuesierbetrieb.png', breite: 1.75, ankerY: 0.86, dy: 0.10 },
  kasino:     { file: 'assets/buildings/casino_nacht.png',   breite: 2.28, ankerY: 0.86, dy: 0.08 },
  supermarkt: { file: 'assets/buildings/supermarkt.png',     breite: 1.55, ankerY: 0.88, dy: 0.06 },
};

// ================================================================
// HAUPTAUFRUF
// ================================================================
function zeichneAlleGebaeude(scene, tileW, tileH, offsetX, offsetY) {
  const COLS = 16, ROWS = 16;

  const gBoden = scene.add.graphics();
  zeichneStadtboden(gBoden, tileW, tileH, offsetX, offsetY, COLS, ROWS);

  const gDeko = scene.add.graphics();
  zeichneStrassendeko(gDeko, tileW, tileH, offsetX, offsetY);

  const gFuell = scene.add.graphics();
  zeichneFuellgebaeude(gFuell, tileW, tileH, offsetX, offsetY);

  const sortiertOrte = [...ORTE_CONFIG].sort((a, b) => (a.col+a.row) - (b.col+b.row));
  sortiertOrte.forEach(ort => {
    const pos = isoToScreen(ort.col+0.5, ort.row+0.5, tileW, tileH, offsetX, offsetY);

    // ---- Bild-Gebäude (PNG) bevorzugen, falls vorhanden ----
    const sprite = BUILDING_SPRITES[ort.id];
    if (sprite && scene.textures.exists('geb_' + ort.id)) {
      const img = scene.add.image(pos.x + tileW * (sprite.dx || 0), pos.y + tileH * (sprite.dy || 0), 'geb_' + ort.id);
      img.setOrigin(sprite.ankerX ?? 0.5, sprite.ankerY ?? 0.85);
      const src   = scene.textures.get('geb_' + ort.id).getSourceImage();
      const dispW = tileW * (sprite.breite ?? 1.5);
      img.setDisplaySize(dispW, dispW * src.height / src.width);

      const labelY = pos.y + tileH * 0.52;
      scene.add.text(pos.x, labelY, ort.name, {
        fontSize: '9px', fontFamily: '"Courier New", monospace',
        color: '#c8c0a0', stroke: '#080808', strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(10);
      return;   // gezeichnete Variante überspringen
    }

    const g   = scene.add.graphics();
    switch (ort.id) {
      case 'wohnung':     baueWohnung(g,     pos.x, pos.y, tileW, tileH); break;
      case 'arbeitsamt':  baueArbeitsamt(g,  pos.x, pos.y, tileW, tileH); break;
      case 'baustelle':   baueBaustelle(g,   pos.x, pos.y, tileW, tileH); break;
      case 'bank':        baueBank(g,        pos.x, pos.y, tileW, tileH); break;
      case 'pawn':        bauePfandleiher(g, pos.x, pos.y, tileW, tileH); break;
      case 'amuesier':    baueAmuesier(g,    pos.x, pos.y, tileW, tileH); break;
      case 'sportverein': baueSportverein(g, pos.x, pos.y, tileW, tileH); break;
      case 'loanshark':   baueLoanShark(g,   pos.x, pos.y, tileW, tileH); break;
      case 'kasino':      baueKasino(g,      pos.x, pos.y, tileW, tileH); break;
      case 'schattenbank': baueSchattenbank(g, pos.x, pos.y, tileW, tileH); break;
      case 'supermarkt':   baueSupermarkt(g,   pos.x, pos.y, tileW, tileH); break;
      case 'arztpraxis':   baueArztpraxis(g,   pos.x, pos.y, tileW, tileH); break;
      case 'kiosk':        baueKiosk(g,        pos.x, pos.y, tileW, tileH); break;
      case 'villa':
        if (gameState.immobilie && gameState.immobilie.modus === 'eigen')
             baueVilla(g,          pos.x, pos.y, tileW, tileH);
        else baueBaugrundstueck(g, pos.x, pos.y, tileW, tileH);
        break;
    }
    // Label: dezent, kein Pfahl, kein Rahmen – nur Text auf Bodenhöhe
    const labelY = pos.y + tileH * 0.52;
    scene.add.text(pos.x, labelY, ort.name, {
      fontSize:        '9px',
      fontFamily:      '"Courier New", monospace',
      color:           '#c8c0a0',
      stroke:          '#080808',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);
  });
}



// ----------------------------------------------------------------
// Schattenbank – Fast-schwarzes Gebäude, kein Schild, diskret
// ----------------------------------------------------------------
function baueSchattenbank(g, cx, cy, tw, th) {
  const W = tw * 0.92, H = th * 0.92;
  const hoehe = th * 1.45, seed = 1010;

  // AO
  BB.ambientOcclusion(g, cx - W*0.6, cy - H*0.25, W*1.2, H*0.9);

  // Wände: sehr dunkel, fast schwarz mit leichtem Blau-Stich
  const wandV = 0x1a1a2a, wandS = 0x101018;
  BB.isoWandL(g, cx, cy, W, H, hoehe, wandV);
  BB.isoWandR(g, cx, cy, W, H, hoehe, wandS);
  BB.wandGrain(g, cx, cy, W, H, hoehe, wandV, 'L', seed);
  BB.celOutline(g, cx, cy, W, H, hoehe, 0x080810);

  // Flachdach mit Aufbau
  BB.isoDach(g, cx, cy, W, H, hoehe, 0x0e0e1c, seed);
  BB.quader(g, cx - W*0.15, cy - hoehe, W*0.28, H*0.28, H*0.3, {
    farbeVorne: 0x181828, farbeSeite: 0x101018, farbeDach: 0x0c0c1a,
    seed: seed+3, mitGrain: false, mitAO: false
  });

  // Fenster: blau/violett schimmernd (Server-Räume)
  const fensterY = cy - hoehe * 0.6;
  BB.fensterReihe(g, cx - W*0.35, fensterY, 2, W*0.18, hoehe*0.15, W*0.1, 0x4444ff, seed);

  // Antenne mit roter Warnlampe
  BB.antenne(g, cx - W*0.10, cy - hoehe, 28, 0x303050);

  // Diskrete Beschriftung (kaum sichtbar)
  g.fillStyle(0x3a3a5a, 0.5);
  g.fillRect(cx - W*0.28, cy - hoehe*0.78, W*0.56, 10);
  g.fillStyle(0x5a5a8a, 0.7);
  const bW = 3.5;
  const txt = 'SCHATTENBANK';
  const sx = cx - (txt.length * bW) / 2;
  for (let i = 0; i < txt.length; i++) {
    g.fillRect(sx + i*bW, cy - hoehe*0.78 + 2, bW-0.5, 6);
  }

  // Überwachungskamera
  g.fillStyle(0x202030, 1);
  g.fillRect(cx + W*0.35, cy - hoehe*0.85, 8, 5);
  g.fillStyle(0x404060, 1);
  g.fillCircle(cx + W*0.35, cy - hoehe*0.87, 3);
  g.lineStyle(1, 0x303048, 0.6);
  g.lineBetween(cx + W*0.35, cy - hoehe*0.87, cx + W*0.44, cy - hoehe*0.82);

  // Rohre (Serverkühlsystem)
  BB.rohr(g, cx + W*0.40, cy, cy - hoehe * 0.7, 0x282838);
  BB.rohr(g, cx + W*0.33, cy - hoehe*0.2, cy - hoehe * 0.7, 0x202030);
}


// ---- Villa – Luxus-Domizil (wenn Immobilie selbst genutzt) ----
function baueVilla(g, cx, cy, tw, th) {
  const hoehe = th * 1.25;
  zeichneKlinkerhaus(g, cx, cy, tw * 1.05, th * 1.05, {
    klinkerFarbe: 0xf2ead6, dachFarbe: 0xc89858,
    hoehe, dachart: 'flach', etagen: 2,
    fensterFarbe: 0x9ad8ff, tuerFarbe: 0x6a4a2a,
    schild: 'VILLA', schildFarbe: 0xffd700, seed: 4242
  });
  // Pool (türkis) vorne rechts
  g.fillStyle(0x35c8e0, 0.9); g.fillRect(cx + tw * 0.12, cy + th * 0.05, tw * 0.30, th * 0.16);
  g.fillStyle(0x9fe8f4, 0.5); g.fillRect(cx + tw * 0.12, cy + th * 0.05, tw * 0.30, th * 0.05);
  // Palme links
  const px = cx - tw * 0.40, py = cy - th * 0.05;
  g.fillStyle(0x6a4a2a, 1); g.fillRect(px - 1.5, py - hoehe * 0.5, 3, hoehe * 0.5);
  g.fillStyle(0x3a9a52, 1);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    g.fillTriangle(px, py - hoehe * 0.5,
      px + Math.cos(a) * 14, py - hoehe * 0.5 + Math.sin(a) * 14 - 4,
      px + Math.cos(a) * 6,  py - hoehe * 0.5 + Math.sin(a) * 6);
  }
}

// ---- Baugrundstück – leeres Grundstück mit Schild ----
function baueBaugrundstueck(g, cx, cy, tw, th) {
  if (typeof isoFill === 'function') isoFill(g, cx, cy, tw * 0.7, th * 0.7, 0x4a4438, 0.6);
  g.fillStyle(0x7a6a4a, 1);
  for (let i = -2; i <= 2; i++) g.fillRect(cx + i * tw * 0.12, cy - 9, 2, 11);
  g.fillStyle(0x6a5a3a, 1); g.fillRect(cx - 1, cy - th * 0.5, 2, th * 0.5);
  g.fillStyle(0xf0d040, 1); g.fillRect(cx - tw * 0.13, cy - th * 0.58, tw * 0.26, 13);
  g.lineStyle(1.5, 0x806010, 1); g.strokeRect(cx - tw * 0.13, cy - th * 0.58, tw * 0.26, 13);
}

// ---- Kiosk – kleiner bunter Späti ----
function baueKiosk(g, cx, cy, tw, th) {
  const hoehe = th * 0.95;
  zeichneKlinkerhaus(g, cx, cy, tw * 0.62, th * 0.62, {
    klinkerFarbe: 0xc23a3a, dachFarbe: 0xf0c040,
    hoehe, dachart: 'flach', etagen: 1,
    fensterFarbe: 0xffe89a, tuerFarbe: 0x5a2a10,
    schild: 'KIOSK', schildFarbe: 0xffffff, seed: 777
  });
  // gelb-rote Markise
  const my = cy - hoehe * 0.5;
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 === 0 ? 0xe03030 : 0xf5f5f5, 0.95);
    g.fillRect(cx - tw * 0.3 + i * (tw * 0.6 / 6), my, tw * 0.6 / 6 - 1, 8);
  }
}

// ---- Arztpraxis – helles Gebäude mit rotem Kreuz ----
function baueArztpraxis(g, cx, cy, tw, th) {
  const hoehe = th * 1.3;
  zeichneKlinkerhaus(g, cx, cy, tw * 0.9, th * 0.9, {
    klinkerFarbe: 0xdfe6ee, dachFarbe: 0x9aa6b4,
    hoehe, dachart: 'flach', etagen: 1,
    fensterFarbe: 0xafe0ff, tuerFarbe: 0x3a6a8a,
    schild: 'PRAXIS', schildFarbe: 0xe84b4b, seed: 1207
  });
  // Rotes Kreuz auf dem Dach
  const ky = cy - hoehe - 6;
  g.fillStyle(0xe84b4b, 1);
  g.fillRect(cx - 3, ky - 9, 6, 18);
  g.fillRect(cx - 9, ky - 3, 18, 6);
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(cx - 1.5, ky - 7, 3, 14);
  g.fillRect(cx - 7, ky - 1.5, 14, 3);
}

// ---- Supermarkt – helles Gebäude mit Einkaufswagen-Symbol ----
function baueSupermarkt(g, cx, cy, tw, th) {
  const seed = 1011;
  zeichneKlinkerhaus(g, cx, cy, tw, th, {
    klinkerFarbe: 0x2a6a8a, dachFarbe: 0x1a4a6a,
    hoehe: th * 1.5, dachart: 'flach', etagen: 2,
    fensterFarbe: 0xaaddff, tuerFarbe: 0x1a3a5a,
    schild: 'SUPERMARKT', schildFarbe: 0xffffff, seed
  });
  const topY = cy - th * 1.5;
  const W = tw * 0.88;
  // Großes Schaufenster
  g.fillStyle(0x88ccff, 0.35);
  g.fillRect(cx - W*0.35, cy - th*1.0, W*0.7, th*0.65);
  g.lineStyle(2, 0xaaddff, 0.6);
  g.strokeRect(cx - W*0.35, cy - th*1.0, W*0.7, th*0.65);
  // Einkaufswagen-Symbol
  g.lineStyle(2, 0xffffff, 0.85);
  const ex = cx - W*0.18, ey = topY - 18;
  g.lineBetween(ex-10, ey, ex+10, ey);        // Griff
  g.lineBetween(ex-10, ey, ex-8, ey+12);      // linke Seite
  g.lineBetween(ex+10, ey, ex+8, ey+12);      // rechte Seite
  g.lineBetween(ex-8, ey+12, ex+8, ey+12);    // Boden
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(ex-5, ey+15, 2); g.fillCircle(ex+5, ey+15, 2); // Räder
  // Öffnungszeiten-Schild
  g.fillStyle(0xffee88, 0.8);
  g.fillRect(cx + W*0.18, cy - th*0.55, 22, 12);
  g.fillStyle(0x1a3a5a, 0.9);
  g.fillRect(cx + W*0.19, cy - th*0.54, 20, 2);
  g.fillRect(cx + W*0.19, cy - th*0.50, 20, 2);
  g.fillRect(cx + W*0.19, cy - th*0.46, 12, 2);
}

// ================================================================
// ABSCHNITT 16c: START-SZENE
//   Wird als erste Szene geladen. Zeigt Titelscreen, wartet auf
//   Klick/Enter, startet dann SpielSzene + Hintergrundmusik.
// ================================================================
// ================================================================
// ABSCHNITT 16c: START-SZENE  (PATCH – ersetzt die alte StartSzene)
//
//  ÄNDERUNG: Hintergrundbild wird als externe Datei geladen.
//  Lege "startbg.png" im selben Ordner wie index.html ab.
//  Phaser managed den Ladevorgang korrekt → kein Race Condition.
// ================================================================
class StartSzene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartSzene' });
    this._menuAktiv = false;
  }

  // ---- NEU: Bild extern laden statt addBase64 ----
  preload() {
    this.load.image('startbg', 'startbg.png');
  }

  create() {
    // HUD ausblenden -> Startbildschirm = reines Vollbild-Titelbild
    setHudSichtbar(false);
    const _c = document.getElementById('game-container');
    if (_c) this.scale.resize(_c.clientWidth, _c.clientHeight);
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- Startmusik ----
    window._startMusik = new Audio('Pixel_Parade_1.mp3');
    window._startMusik.loop   = true;
    window._startMusik.volume = 0.45;
    const _startAudio = () => {
      window._startMusik.play().catch(e => console.warn('Start-Audio:', e));
      document.removeEventListener('click',   _startAudio);
      document.removeEventListener('keydown', _startAudio);
    };
    document.addEventListener('click',   _startAudio);
    document.addEventListener('keydown', _startAudio);

    // ---- Hintergrundbild: vollflächig skaliert ----
    // Jetzt zuverlässig geladen weil preload() fertig ist
    let bgRect = null;   // {left, top, w, h} des angezeigten Bildes
    if (this.textures.exists('startbg')) {
      const bg = this.add.image(W/2, H/2, 'startbg');
      const scale = Math.max(W / bg.width, H / bg.height);
      bg.setScale(scale).setDepth(0);
      const dw = bg.width * scale, dh = bg.height * scale;
      bgRect = { left: W/2 - dw/2, top: H/2 - dh/2, w: dw, h: dh };
    } else {
      // Fallback: dunkler Hintergrund wenn Datei fehlt
      const bgFallback = this.add.graphics().setDepth(0);
      bgFallback.fillGradientStyle(0x050810, 0x050810, 0x0a1428, 0x0a1428, 1);
      bgFallback.fillRect(0, 0, W, H);
      const skyGfx = this.add.graphics().setDepth(1);
      this._zeichneSkylineFallback(skyGfx, W, H);
    }

    const MENU_ITEMS = [
      { icon: '👑', label: 'NEUES SPIEL',   relY: 0.510, aktion: () => this._neuesSpiel()    },
      { icon: '📁', label: 'SPIEL LADEN',   relY: 0.585, aktion: () => this._spielLaden()    },
      { icon: '⚙️', label: 'EINSTELLUNGEN', relY: 0.655, aktion: () => this._einstellungen() },
      { icon: '🏆', label: 'BESTENLISTE',   relY: 0.725, aktion: () => this._bestenliste()   },
      { icon: '🚪', label: 'BEENDEN',       relY: 0.790, aktion: () => this._beenden()        },
    ];

    this._menuButtons = [];

    if (bgRect) {
      // ---- Das Menü ist bereits IM Bild gezeichnet ----
      // Wir legen nur unsichtbare Klickflächen exakt darüber.
      const cx = 0.16, zw = 0.205, zh = 0.055;   // relativ zum Bild (deckt die eingebauten Buttons)
      MENU_ITEMS.forEach(item => {
        const sx = bgRect.left + cx * bgRect.w;
        const sy = bgRect.top + item.relY * bgRect.h;
        const w  = zw * bgRect.w;
        const h  = zh * bgRect.h;

        const hl = this.add.graphics().setDepth(4);   // dezentes Hover-Leuchten
        const zone = this.add.zone(sx, sy, w, h).setDepth(7).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
          hl.clear(); hl.fillStyle(0xffe87a, 0.16);
          hl.fillRoundedRect(sx - w/2, sy - h/2, w, h, 6);
        });
        zone.on('pointerout', () => hl.clear());
        zone.on('pointerdown', () => { if (this._menuAktiv) return; item.aktion(); });
        this._menuButtons.push({ hl, zone });
      });
    } else {
      // ---- Fallback (kein Bild): gezeichnetes Menü ----
      const menuX = W * 0.20, menuY0 = H * 0.54, menuH = H * 0.072, menuW = W * 0.22;
      MENU_ITEMS.forEach((item, i) => {
        const bx = menuX, by = menuY0 + i * menuH, bw = menuW, bh = menuH * 0.82;
        const isFirst = i === 0;
        const bg2 = this.add.graphics().setDepth(5);
        const zeichne = (hover) => {
          bg2.clear();
          bg2.fillStyle(isFirst ? (hover?0x4a3000:0x2a1a00) : (hover?0x202038:0x0a0a12), isFirst?0.9:0.75);
          bg2.fillRoundedRect(bx - bw/2, by - bh/2, bw, bh, 4);
          bg2.lineStyle(isFirst?2:1, isFirst?0xffd700:(hover?0xe8b84b:0x4a4a6a), isFirst?0.9:0.6);
          bg2.strokeRoundedRect(bx - bw/2, by - bh/2, bw, bh, 4);
        };
        zeichne(false);
        const txt = this.add.text(bx, by, `${item.icon}  ${item.label}`, {
          fontFamily: '"Courier New", monospace', fontSize: Math.min(Math.floor(W/50),18)+'px',
          fontStyle: 'bold', color: isFirst?'#ffd700':'#e8e0c8', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0.5).setDepth(6);
        const zone = this.add.zone(bx, by, bw, bh).setDepth(7).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { zeichne(true); txt.setColor(isFirst?'#ffe866':'#ffffff'); });
        zone.on('pointerout',  () => { zeichne(false); txt.setColor(isFirst?'#ffd700':'#e8e0c8'); });
        zone.on('pointerdown', () => { if (this._menuAktiv) return; item.aktion(); });
        this._menuButtons.push({ bg: bg2, txt, zone });
      });
    }

    this.input.keyboard.once('keydown-ENTER', () => this._neuesSpiel());
    this.input.keyboard.once('keydown-SPACE', () => this._neuesSpiel());
  }

  update() {}

  _zeichneSkylineFallback(g, W, H) {
    const grundlinie = H * 0.72;
    g.fillStyle(0x050a12, 1);
    let x = 0;
    const rand = (s, min, max) => min + ((s * 9301 + 49297) % 233280) / 233280 * (max - min);
    let seed = 42;
    while (x < W) {
      const b = rand(seed++, 20, 60), h2 = rand(seed++, 40, H * 0.38);
      g.fillRect(x, grundlinie - h2, b, h2 + H * 0.3);
      for (let fc = 0; fc < Math.floor(b/8); fc++) {
        for (let fr = 0; fr < Math.floor(h2/9); fr++) {
          if (rand(seed++, 0, 1) < 0.3) {
            g.fillStyle(rand(seed, 0, 1) < 0.7 ? 0xffd080 : 0x88aaff,
                        0.4 + rand(seed++, 0, 0.4));
            g.fillRect(x + fc*8 + 2, grundlinie - h2 + fr*9 + 3, 4, 4);
            g.fillStyle(0x050a12, 1);
          }
        }
      }
      x += b + rand(seed++, 2, 8);
    }
    g.fillStyle(0x080c14, 1);
    g.fillRect(0, grundlinie, W, H * 0.3);
  }

  // ---- Menü-Aktionen (unverändert) ----

  _neuesSpiel() {
    this._menuAktiv = true;
    this._musikStoppen();
    initAudio();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      Object.assign(gameState, {
        kontostand: 50000, schwarzeKasse: 0, losesBargeld: 0,
        energie: 80, happinessSpieler: 70, happinessPartner: 70,
        gesundheit: 80, risikoRaster: 10, status: 'ALG1',
        monat: 1, woche: 1, tag: 1,
        naechsterAmtsBesuch: 2, amtsTermineVerpasst: 0, algGesperrt: false,
        eheKriseAktiv: false, eheKriseSchritt: 0, frauAusgezogen: false,
        unterhaltProMonat: 0, geschenkeSumme: 0,
        loanSharkSchuld: 0, loanSharkMahnungStufe: 0,
        depot: [], goldBarren: 0,
        kindergeldKinder: [], kindergeldAktiv: false,
        monatlicheExtras: 0, risikoProMonat: 0,
        lebensmittelDiesenMonat: null, billigKaeufeInFolge: 0,
        supermarktFaellig: false, schattenbankAktiv: false,
        bankEinzahlungDieseWoche: 0, gameOver: false,
        // ---- neue Bürokratie-/Immobilien-Features zurücksetzen ----
        verpfaendet: {},
        mehrbedarf: { warmwasser: false, alleinerziehend: false, ernaehrung: false, but: false },
        ernaehrungFake: false, einstiegsgeldMonate: 0, minijobLohn: 0,
        unterhaltsTarnung: false, kurCooldownMonat: 0, scheinWG: false,
        kautionRest: 0, umzugGemacht: false,
        pauschalen: { erstausstattung: false, moebel: false },
        bekleidungCooldownMonat: 0, immobilie: null,
        zahlungsRueckstand: 0, rueckstandMonate: 0,
        depotVerschleiert: false, vomStaatGesamt: 0, strafStufe: 0,
        sachbearbeiterBestochen: false, suchtStufe: 0, kleeblatt: false,
      });
      this.scene.start('SpielSzene');
    });
  }

  _spielLaden() {
    this._menuAktiv = true;
    this._musikStoppen();
    initAudio();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SpielSzene');
      setTimeout(() => { if (typeof oeffneLadeMenu === 'function') oeffneLadeMenu(); }, 800);
    });
  }

  _einstellungen() {
    const W = this.scale.width, H = this.scale.height;
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(0x0a0c18, 0.96);
    panel.fillRoundedRect(W/2 - 200, H/2 - 120, 400, 240, 8);
    panel.lineStyle(2, 0xe8b84b, 0.8);
    panel.strokeRoundedRect(W/2 - 200, H/2 - 120, 400, 240, 8);

    const titel = this.add.text(W/2, H/2 - 85, '⚙️ EINSTELLUNGEN', {
      fontFamily: '"Courier New", monospace', fontSize: '18px',
      color: '#e8b84b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(21);

    const info = this.add.text(W/2, H/2 - 20,
      '🔊 Musik: Taste 🔊 im HUD\n\n🎮 Steuerung:\nPfeiltasten – Bewegen\nE / Enter – Interagieren\nSPACE – Woche überspringen\nF5 – Quick Save\nF9 – Laden',
      { fontFamily: '"Courier New", monospace', fontSize: '13px',
        color: '#c8c0a0', stroke: '#000', strokeThickness: 2,
        align: 'center', lineSpacing: 4 }
    ).setOrigin(0.5, 0.5).setDepth(21);

    const schliessenTxt = this.add.text(W/2, H/2 + 95, '[ Klicken zum Schließen ]', {
      fontFamily: '"Courier New", monospace', fontSize: '12px',
      color: '#606880',
    }).setOrigin(0.5, 0.5).setDepth(21);

    const schliessen = this.add.zone(W/2, H/2, 400, 240).setDepth(22).setInteractive();
    schliessen.once('pointerdown', () => {
      panel.destroy(); titel.destroy(); info.destroy();
      schliessenTxt.destroy(); schliessen.destroy();
    });
  }

  _bestenliste() {
    const W = this.scale.width, H = this.scale.height;

    const eintraege = [];
    for (let s = 1; s <= 3; s++) {
      try {
        const raw = localStorage.getItem('sozialbetrug_save_' + s);
        if (!raw) continue;
        const snap = JSON.parse(raw);
        if (!snap.state) continue;
        const gs = snap.state;
        const gesamt = gs.kontostand + gs.schwarzeKasse + (gs.goldBarren||0)*500
                     + (gs.depot||[]).reduce((a,p)=>a+p.anteile*p.aktuellerKurs,0);
        eintraege.push({ slot: s, monat: snap.monat, woche: snap.woche,
          gesamt: Math.round(gesamt), datum: snap.datum });
      } catch(e) {}
    }
    eintraege.sort((a,b) => b.gesamt - a.gesamt);

    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(0x0a0c18, 0.96);
    panel.fillRoundedRect(W/2 - 220, H/2 - 150, 440, 300, 8);
    panel.lineStyle(2, 0xffd700, 0.8);
    panel.strokeRoundedRect(W/2 - 220, H/2 - 150, 440, 300, 8);

    this.add.text(W/2, H/2 - 115, '🏆 BESTENLISTE', {
      fontFamily: '"Courier New", monospace', fontSize: '20px',
      color: '#ffd700', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(21);

    if (eintraege.length === 0) {
      this.add.text(W/2, H/2, 'Noch keine Spielstände gespeichert.', {
        fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#606880',
      }).setOrigin(0.5, 0.5).setDepth(21);
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      eintraege.forEach((e, i) => {
        const y = H/2 - 55 + i * 55;
        this.add.text(W/2 - 180, y, medals[i] || '  ', {
          fontFamily: '"Courier New", monospace', fontSize: '22px', color: '#ffd700',
        }).setOrigin(0, 0.5).setDepth(21);
        this.add.text(W/2 - 145, y - 10,
          `Slot ${e.slot}  ·  M${e.monat} W${e.woche}`,
          { fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#8090b8' }
        ).setOrigin(0, 0.5).setDepth(21);
        this.add.text(W/2 - 145, y + 12,
          `Gesamtvermögen: ${e.gesamt.toLocaleString('de-DE')} €`,
          { fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#e8d870',
            fontStyle: 'bold' }
        ).setOrigin(0, 0.5).setDepth(21);
        this.add.text(W/2 + 170, y, e.datum || '',
          { fontFamily: '"Courier New", monospace', fontSize: '10px', color: '#505060' }
        ).setOrigin(1, 0.5).setDepth(21);
      });
    }

    this.add.text(W/2, H/2 + 125, '[ Klicken zum Schließen ]', {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#606880',
    }).setOrigin(0.5, 0.5).setDepth(21);

    this.add.zone(W/2, H/2, 440, 300).setDepth(22).setInteractive()
      .once('pointerdown', () => this.scene.restart());
  }

  _beenden() {
    const W = this.scale.width, H = this.scale.height;
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(0x0a0c18, 0.96);
    panel.fillRoundedRect(W/2 - 200, H/2 - 80, 400, 160, 8);
    panel.lineStyle(2, 0xe84b4b, 0.8);
    panel.strokeRoundedRect(W/2 - 200, H/2 - 80, 400, 160, 8);

    this.add.text(W/2, H/2 - 35, '🚪 Spiel beenden?', {
      fontFamily: '"Courier New", monospace', fontSize: '18px',
      color: '#e84b4b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(21);

    this.add.text(W/2, H/2 + 5,
      'Browser-Tab schließen zum Beenden.\n(Web-Apps können sich nicht selbst beenden.)',
      { fontFamily: '"Courier New", monospace', fontSize: '12px',
        color: '#8090b8', align: 'center' }
    ).setOrigin(0.5, 0.5).setDepth(21);

    this.add.text(W/2, H/2 + 55, '[ OK – Tab manuell schließen ]', {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#606880',
    }).setOrigin(0.5, 0.5).setDepth(21);

    this.add.zone(W/2, H/2, 400, 160).setDepth(22).setInteractive()
      .once('pointerdown', () => this.scene.restart());
  }

  _musikStoppen() {
    try {
      if (window._startMusik) {
        window._startMusik.pause();
        window._startMusik.currentTime = 0;
      }
    } catch(e) {}
  }
}
class SpielSzene extends Phaser.Scene {
  constructor() {
    super({ key: 'SpielSzene' });
    this.tileW   = 120;
    this.tileH   = 60;
    // offsetX/Y werden in create() dynamisch berechnet (Zentrierung)
    this.offsetX = 400;
    this.offsetY = 120;

    this.spielerCol  = 4;   // Startposition auf Kreuzung (Straße)
    this.spielerRow  = 4;

    // Laufanimation
    this.walkFrame   = 0;
    this.walkTimer   = 0;
    this.WALK_FPS    = 0.11;
    this.istAufMove  = false;
    this._idleTimeout = null;

    this.inputCooldown    = 0;
    this.ortRects         = [];
    this.zeitAkku         = 0;
    this.wochenSeitMonat  = 0;
    this.eventTimer       = randomEventIntervall();
    this.hudTickTimer     = 0;

    // Regen
    this.regenTropfen = [];
    this.regenAktiv   = false;
    this.regenTimer   = 45;
    this.regenGfx     = null;

    // NPCs
    this.npcs    = [];
    this.npcGfx  = null;
    this.npcTick = 0;
  }

  preload() {
    // Bild-Gebäude laden (siehe BUILDING_SPRITES)
    for (const id in BUILDING_SPRITES) {
      this.load.image('geb_' + id, BUILDING_SPRITES[id].file);
    }
  }  // Audio läuft sonst über natives HTMLAudioElement

  create() {
    // HUD wieder einblenden (Header + rechtes Panel) und Canvas anpassen
    setHudSichtbar(true);
    const _c = document.getElementById('game-container');
    if (_c) this.scale.resize(_c.clientWidth, _c.clientHeight);
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- ZENTRIERUNG: offsetX/Y dynamisch berechnen ----
    // Die Karte hat COLS=14 Spalten und ROWS=12 Zeilen.
    // Kartengrenzen in ISO-Koordinaten:
    //   rechts: (COLS + ROWS) * tileW/2     links: -(ROWS) * tileW/2
    //   unten:  (COLS + ROWS) * tileH/2     oben:  0
    const COLS = 16, ROWS = 16;
    const karteBreite = (COLS + ROWS) * this.tileW / 2;
    const karteHoehe  = (COLS + ROWS) * this.tileH / 2;
    // Karte horizontal und vertikal zentrieren
    this.offsetX = W / 2 - (COLS - ROWS) * this.tileW / 4;
    this.offsetY = Math.max(40, (H - karteHoehe) / 2 + 20);

    // Stadtgrafik (einmalig)
    zeichneAlleGebaeude(this, this.tileW, this.tileH, this.offsetX, this.offsetY);

    // Kollisions-Daten – angepasst an pos.x+0.5-Offset
    ORTE_CONFIG.forEach(o => this.ortRects.push({ id: o.id, col: o.col, row: o.row }));

    // NPCs
    this.npcGfx = this.add.graphics();
    this.initNPCs();

    // Spieler (muss NACH allen statischen Grafiken kommen → höchste Z-Order)
    this.spielerGfx   = this.add.graphics().setDepth(20);
    this.highlightGfx = this.add.graphics().setDepth(15);
    this.zeichneSpieler(false);

    // Regen
    this.regenGfx = this.add.graphics().setDepth(25);
    this.initRegen(W, H);

    // Steuerung
    this.cursors       = this.input.keyboard.createCursorKeys();
    this.interactKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.interactEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.skipKey       = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Spiel-Musik: immer frisch starten, alte Instanz vorher stoppen
    try {
      // Startmusik sicher stoppen
      if (window._startMusik) {
        window._startMusik.pause();
        window._startMusik.currentTime = 0;
      }
      // Alte Spielmusik stoppen (verhindert Doppel-Wiedergabe bei Reload)
      if (window._spielMusik) {
        window._spielMusik.pause();
        window._spielMusik.currentTime = 0;
      }
      // Neue Instanz erstellen
      window._spielMusik = new Audio('Pixel_Parade.mp3');
      window._spielMusik.loop   = true;
      window._spielMusik.volume = 0.40;
      window._spielMusik.play().catch(err => {
        // Sollte nicht passieren – Nutzer hat bereits interagiert
        console.warn('Spielmusik:', err);
      });
      window._phaserSoundAktiv = true;
    } catch(e) { console.warn('Spielmusik nicht geladen:', e); }

    updateHUD();
    console.log('✅ Szene gestartet, Spieler col=' + this.spielerCol + ' row=' + this.spielerRow);
  }

  update(time, delta) {
    if (gameState.gameOver) return;
    const dt = delta / 1000;

    // Regen + NPCs immer animieren
    this.animiereRegen(dt, this.scale.width, this.scale.height);
    this.npcTick += dt;
    if (this.npcTick >= 0.09) { this.npcTick = 0; this.animiereNPCs(); }

    if (modalOffen) return;

    // Spielzeit
    this.zeitAkku += dt;
    // Tag-Fortschritt: 7 Tage pro Woche = alle ECHTZEIT_PRO_WOCHE/7 Sekunden 1 Tag
    const tagSek = ECHTZEIT_PRO_WOCHE / 7;
    const neuTag = Math.floor(this.zeitAkku / tagSek) + 1;
    if (neuTag !== gameState.tag && neuTag <= 7) {
      gameState.tag = neuTag;
    }
    if (this.zeitAkku >= ECHTZEIT_PRO_WOCHE) {
      this.zeitAkku -= ECHTZEIT_PRO_WOCHE;
      this.spielwocheVorbei();
    }

    // Events
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = randomEventIntervall();
      triggerEvent(waehleEvent());
      return;
    }

    tickRazziaTimer(dt);
    tickAutoSave(dt);  // Auto-Save alle 2 Minuten

    // Regen-Toggle
    this.regenTimer -= dt;
    if (this.regenTimer <= 0) {
      this.regenTimer = 30 + Math.random() * 40;
      this.regenAktiv = !this.regenAktiv;
      logEvent(this.regenAktiv ? '🌧️ Regen setzt ein.' : '☀️ Regen hört auf.',
               this.regenAktiv ? 'warn' : 'good');
      if (this.regenAktiv)
        gameState.happinessSpieler = clamp(gameState.happinessSpieler - 5, 0, 100);
      const wb = document.getElementById('wetter-badge');
      if (wb) { wb.textContent = this.regenAktiv ? '🌧️ Regen' : '☀️ Trocken'; wb.className = this.regenAktiv ? 'regen' : ''; }
    }

    this.hudTickTimer += dt;
    if (this.hudTickTimer >= 0.5) { this.hudTickTimer = 0; updateHUD(); }

    // Walk-Animation
    this.walkTimer -= dt;
    if (this.walkTimer <= 0 && this.istAufMove) {
      this.walkTimer = this.WALK_FPS;
      this.walkFrame = (this.walkFrame + 1) % 4;
      this.zeichneSpieler(true);
    }

    if (this.inputCooldown > 0) { this.inputCooldown -= delta; return; }

    // Bewegung
    let bewegt = false, dc = 0, dr = 0;
    if      (Phaser.Input.Keyboard.JustDown(this.cursors.left))  { dc = -1; bewegt = true; }
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) { dc =  1; bewegt = true; }
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up))    { dr = -1; bewegt = true; }
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down))  { dr =  1; bewegt = true; }

    if (bewegt) {
      this.spielerCol = clamp(this.spielerCol + dc, 0, 15);
      this.spielerRow = clamp(this.spielerRow + dr, 0, 15);
      this.inputCooldown = 130;
      this.istAufMove    = true;
      this.walkFrame     = (this.walkFrame + 1) % 4;
      this.walkTimer     = this.WALK_FPS;
      this.zeichneSpieler(true);
      this.aktualisiereHighlight();
      clearTimeout(this._idleTimeout);
      this._idleTimeout = setTimeout(() => {
        this.istAufMove = false;
        this.zeichneSpieler(false);
      }, 350);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        Phaser.Input.Keyboard.JustDown(this.interactEnter)) {
      this.versucheInteraktion();
    }

    // SPACE = Woche überspringen (sofort)
    if (Phaser.Input.Keyboard.JustDown(this.skipKey)) {
      this.skipWoche();
    }
  }

  // ------------------------------------------------------------------
  // SPIELER MIT LAUFANIMATION
  // ------------------------------------------------------------------
  zeichneSpieler(laufen) {
    // Spieler-Position für Savegame exportieren
    window._spielerPosExport = { col: this.spielerCol, row: this.spielerRow };
    this.spielerGfx.clear();
    const g = this.spielerGfx;

    // Spieler steht auf Kachelzentrum (col+0.5, row+0.5 wie Gebäude)
    const pos = isoToScreen(
      this.spielerCol + 0.5, this.spielerRow + 0.5,
      this.tileW, this.tileH, this.offsetX, this.offsetY
    );
    const cx = pos.x;
    const cy = pos.y - 8;

    // Bein-Frames (4 Walk-Frames)
    const frames = laufen ? [
      [-4, 5,  4, -5],
      [-2, 2,  2, -2],
      [ 4, -5,-4,  5],
      [ 2, -2,-2,  2],
    ] : [[0,0,0,0]];
    const [lxO, lyO, rxO, ryO] = frames[this.walkFrame % frames.length];

    // Schatten
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(cx + 2, cy + 20, 30, 11);

    // Linkes Bein
    g.fillStyle(0x2e3668, 1);
    g.fillRect(cx - 5 + lxO, cy + 9 + lyO, 6, 11);
    g.fillStyle(0x1e2448, 1);
    g.fillRect(cx - 7 + lxO, cy + 18 + lyO, 9, 4);

    // Rechtes Bein
    g.fillStyle(0x2e3668, 1);
    g.fillRect(cx + 1 + rxO, cy + 9 + ryO, 6, 11);
    g.fillStyle(0x1e2448, 1);
    g.fillRect(cx + 0 + rxO, cy + 18 + ryO, 9, 4);

    // Körper (blaue Jacke mit Revers)
    g.fillStyle(0x2a4a8c, 1);
    g.fillRect(cx - 9, cy - 2, 19, 12);
    g.fillStyle(0x3a5aa0, 0.6);  // Jackenfalte
    g.fillRect(cx - 4, cy - 1, 3, 10);
    // Hemdkragen
    g.fillStyle(0xf0f0e8, 1);
    g.fillTriangle(cx - 3, cy - 2, cx + 4, cy - 2, cx, cy + 3);
    // Krawatte
    g.fillStyle(0xcc2020, 1);
    g.fillTriangle(cx - 1, cy - 1, cx + 2, cy - 1, cx, cy + 8);

    // Linker Arm
    const aSwing = laufen ? (this.walkFrame % 2 === 0 ? 5 : -5) : 0;
    g.fillStyle(0x1e3a7c, 1);
    g.fillRect(cx - 13, cy - 1 + aSwing, 5, 10);
    g.fillStyle(0xf0c0a0, 1);
    g.fillCircle(cx - 11, cy + 9 + aSwing, 3.5);

    // Rechter Arm
    g.fillStyle(0x1e3a7c, 1);
    g.fillRect(cx + 9, cy - 1 - aSwing, 5, 10);
    // Aktentasche
    g.fillStyle(0x7a5030, 1);
    g.fillRect(cx + 10, cy + 4 - Math.abs(aSwing)*0.3, 10, 8);
    g.lineStyle(1.5, 0xa07050, 0.8);
    g.strokeRect(cx + 10, cy + 4 - Math.abs(aSwing)*0.3, 10, 8);
    g.fillStyle(0xf0c0a0, 1);
    g.fillCircle(cx + 13, cy + 9 - aSwing, 3.5);

    // Hals
    g.fillStyle(0xf0c0a0, 1);
    g.fillRect(cx - 2, cy - 9, 5, 8);

    // Gesicht
    g.fillStyle(0xf5c8a8, 1);
    g.fillEllipse(cx + 1, cy - 16, 18, 20);

    // Haare
    g.fillStyle(0x2a1a10, 1);
    g.fillEllipse(cx + 1, cy - 23, 18, 11);
    g.fillRect(cx - 8, cy - 25, 18, 8);
    // Seitenhaar
    g.fillRect(cx - 9, cy - 20, 4, 7);

    // Augen mit Pupillen
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 2, cy - 15, 3);
    g.fillCircle(cx + 4, cy - 15, 3);
    g.fillStyle(0x202530, 1);
    g.fillCircle(cx - 1, cy - 15, 1.8);
    g.fillCircle(cx + 5, cy - 15, 1.8);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(cx - 0.5, cy - 16, 0.8);
    g.fillCircle(cx + 5.5, cy - 16, 0.8);

    // Nase + Mund
    g.fillStyle(0xd8a880, 1);
    g.fillTriangle(cx + 1, cy - 12, cx, cy - 9, cx + 3, cy - 9);
    g.fillStyle(0xc07050, 1);
    g.fillRect(cx - 1, cy - 8, 5, 2);

    // Richtungs-Pfeil über Spieler (beim Bewegen kurz)
    if (laufen) {
      g.fillStyle(0xe8b84b, 0.7);
      g.fillTriangle(cx, cy - 32, cx - 5, cy - 26, cx + 5, cy - 26);
    }
  }

  // ----------------------------------------------------------------
  // REGEN
  // ----------------------------------------------------------------
  initRegen(W, H) {
    this.regenTropfen = [];
    for (let i = 0; i < 150; i++) {
      this.regenTropfen.push({
        x: Math.random() * W, y: Math.random() * H,
        speed: 200 + Math.random() * 150,
        len: 6 + Math.random() * 8,
        alpha: 0.2 + Math.random() * 0.3
      });
    }
  }
  animiereRegen(dt, W, H) {
    this.regenGfx.clear();
    if (!this.regenAktiv) return;
    this.regenTropfen.forEach(t => {
      t.x += 25 * dt; t.y += t.speed * dt;
      if (t.y > H) { t.y = -12; t.x = Math.random() * W; }
      if (t.x > W)  t.x = 0;
      this.regenGfx.fillStyle(0xaaccff, t.alpha);
      this.regenGfx.fillRect(Math.floor(t.x), Math.floor(t.y), 1, t.len);
    });
  }

  // ----------------------------------------------------------------
  // NPCs
  // ----------------------------------------------------------------
  initNPCs() {
    const farben = [0xff8866, 0x88bbff, 0x88ffaa, 0xffdd88, 0xdd88ff, 0xff88bb, 0xaaffee];
    this.npcs = [];
    for (let i = 0; i < 10; i++) {
      // NPCs bevorzugen Straßen-Positionen
      const onStrasse = STRASSENLAYOUT.laengs;
      this.npcs.push({
        col:   onStrasse[i % onStrasse.length] + (Math.random() - 0.5) * 0.8,
        row:   0.5 + Math.random() * 12,
        dcol:  (Math.random() - 0.5) * 0.025,
        drow:  (Math.random() - 0.5) * 0.025,
        timer: Math.random() * 80,
        farbe: farben[i % farben.length],
        walkF: Math.floor(Math.random() * 4)
      });
    }
  }
  animiereNPCs() {
    this.npcGfx.clear();
    const { tileW, tileH, offsetX, offsetY } = this;
    this.npcs.forEach(npc => {
      npc.col += npc.dcol; npc.row += npc.drow; npc.timer--;
      if (npc.col < 0.2 || npc.col > 15.8) { npc.dcol *= -1; npc.col = clamp(npc.col, 0.2, 9.8); }
      if (npc.row < 0.2 || npc.row > 11.8) { npc.drow *= -1; npc.row = clamp(npc.row, 0.2, 8.8); }
      if (npc.timer <= 0) {
        npc.timer = 40 + Math.random() * 80;
        const spd = 0.01 + Math.random() * 0.025;
        const a   = Math.random() * Math.PI * 2;
        npc.dcol  = Math.cos(a) * spd; npc.drow = Math.sin(a) * spd;
      }
      npc.walkF = (npc.walkF + 1) % 4;
      const frames = [[-3,4,3,-4],[-1,2,1,-2],[3,-4,-3,4],[1,-2,-1,2]];
      const [lxO, lyO, rxO, ryO] = frames[npc.walkF];
      const pos = isoToScreen(npc.col, npc.row, tileW, tileH, offsetX, offsetY);
      const nx = pos.x, ny = pos.y;
      // Schatten
      this.npcGfx.fillStyle(0x000000, 0.18);
      this.npcGfx.fillEllipse(nx + 1, ny + 9, 14, 5);
      // Beine
      this.npcGfx.fillStyle(npc.farbe, 0.65);
      this.npcGfx.fillRect(nx - 2 + lxO, ny + 3 + lyO, 4, 6);
      this.npcGfx.fillRect(nx + 1 + rxO, ny + 3 + ryO, 4, 6);
      // Körper
      this.npcGfx.fillStyle(npc.farbe, 0.85);
      this.npcGfx.fillRect(nx - 4, ny - 5, 9, 9);
      // Kopf
      this.npcGfx.fillCircle(nx + 1, ny - 9, 5);
      // Augen
      this.npcGfx.fillStyle(0x202020, 0.9);
      this.npcGfx.fillCircle(nx - 1, ny - 10, 1.2);
      this.npcGfx.fillCircle(nx + 3, ny - 10, 1.2);
    });
  }

  // ----------------------------------------------------------------
  // HILFSMETHODEN
  // ----------------------------------------------------------------
  spielwocheVorbei() {
    gameState.woche++; this.wochenSeitMonat++;
    gameState.tag = 1;  // Woche beginnt immer mit Tag 1
    gameState.energie = clamp(gameState.energie - 3, 0, 100);
    gameState.bankEinzahlungDieseWoche = 0;  // Wochenlimit Bank reset

    // ---- Supermarkt-Popup ab Tag 3 ----
    if (gameState.tag >= 3 && !gameState.lebensmittelDiesenMonat && !gameState.supermarktFaellig) {
      gameState.supermarktFaellig = true;
      setTimeout(() => oeffneModal('🛒 Lebensmittel kaufen!',
        'Es ist Tag ' + gameState.tag + ' und du hast noch keine Lebensmittel für diesen Monat gekauft!<br><br>'
        + 'Gehe zum <strong>Supermarkt</strong> und kaufe ein – sonst verlierst du täglich 5 Punkte Gesundheit!',
        []), 500);
      logEvent('🛒 Kein Einkauf! Gesundheit leidet!', 'warn');
    }
    // ---- Kein Einkauf: täglich -5 Gesundheit ----
    if (!gameState.lebensmittelDiesenMonat && gameState.tag > 3) {
      gameState.gesundheit = clamp(gameState.gesundheit - 5, 0, 100);
      logEvent('🍽️ Kein Einkauf: Gesundheit -5!', 'danger');
      if (gameState.gesundheit <= 0) triggerGameOver('gesundheit');
    }
    gameState.naechsterAmtsBesuch--;
    if (gameState.naechsterAmtsBesuch <= 0) {
      gameState.risikoRaster = clamp(gameState.risikoRaster + 15, 0, 100);
      gameState.naechsterAmtsBesuch = 2;
      gameState.amtsTermineVerpasst = (gameState.amtsTermineVerpasst || 0) + 1;
      logEvent(`⚠️ Pflichttermin verpasst! (${gameState.amtsTermineVerpasst}x) Risiko +15.`, 'danger');
      if (gameState.amtsTermineVerpasst >= 3) {
        gameState.algGesperrt = true;
        oeffneModal('🛑 ALG gesperrt!',
          `Du hast <strong>3 Pflichttermine</strong> verpasst!<br><br>`
          + 'Das ALG wird einbehalten bis du persönlich erscheinst.<br>'
          + 'Besuche das <strong>Arbeitsamt</strong>, um die Sperre aufzuheben.',
          []);
        logEvent('🛑 ALG gesperrt nach 3 verpassten Terminen!', 'danger');
        soundAlarm && soundAlarm();
      } else {
        oeffneModal('⚠️ Pflichttermin verpasst!',
          `Kein Amt-Besuch! (${gameState.amtsTermineVerpasst}/3)<br><br><strong>Risiko +15</strong><br>Bei 3 Fehlterminen wird das ALG gesperrt!`, []);
      }
    }
    if (this.wochenSeitMonat >= WOCHEN_PRO_MONAT) {
      this.wochenSeitMonat = 0; monatsAbschluss();
    }
    updateHUD(); pruefeRisiko();
  }

  aktualisiereHighlight() {
    this.highlightGfx.clear();
    const nah = this.ortRects.find(o =>
      Math.abs(o.col - this.spielerCol) <= 1 && Math.abs(o.row - this.spielerRow) <= 1
    );
    if (nah) {
      const pos = isoToScreen(nah.col + 0.5, nah.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      this.highlightGfx.lineStyle(3, 0xe8b84b, 0.9);
      this.highlightGfx.strokeEllipse(pos.x, pos.y + this.tileH * 0.2, this.tileW * 1.1, this.tileH * 0.65);
      this.highlightGfx.lineStyle(1, 0xe8b84b, 0.25);
      this.highlightGfx.strokeEllipse(pos.x, pos.y + this.tileH * 0.2, this.tileW * 1.35, this.tileH * 0.85);
    }
  }

  versucheInteraktion() {
    const nah = this.ortRects.find(o =>
      Math.abs(o.col - this.spielerCol) <= 1 && Math.abs(o.row - this.spielerRow) <= 1
    );
    if (nah) interact(nah.id);
    else logEvent('ℹ️ Näher an ein Gebäude gehen (E).', '');
  }

  /** Überspringt die aktuelle Woche sofort (SPACE-Taste) */
  skipWoche() {
    // Während des Überspringens wird "geschlafen" → Energie voll erholt
    gameState.energie = 100;
    // Restzeit der Woche sofort ablaufen lassen
    this.zeitAkku = ECHTZEIT_PRO_WOCHE;
    logEvent('⏩ Woche übersprungen – ausgeschlafen, Energie voll.', '');
    soundNeutral && soundNeutral();
    updateHUD();
  }
}

// ================================================================
// ABSCHNITT 18: PHASER KONFIGURATION & START
// ================================================================
const container    = document.getElementById('game-container');

const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  // Breite/Höhe werden von RESIZE-Mode übernommen – keine feste Größe nötig
  width:  window.innerWidth  - (document.getElementById('hud') ? document.getElementById('hud').offsetWidth || 260 : 260),
  height: window.innerHeight - (document.getElementById('game-header') ? document.getElementById('game-header').offsetHeight || 36 : 36),
  backgroundColor: '#020510',
  scene: [StartSzene, SpielSzene],  // StartSzene zuerst
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: {
    mode:       Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent:     'game-container'
  }
};

let game;  // Wird in window.onload initialisiert

window.addEventListener('load', () => {
  // Erst NACH vollständigem Layout-Rendering starten
  // → game-container hat jetzt korrekte clientWidth/Height
  game = new Phaser.Game(phaserConfig);
  window._phaserGameRef = game;
  console.log('🎮 Phaser gestartet, Canvas:', document.getElementById('game-container').clientWidth + 'x' + document.getElementById('game-container').clientHeight);
});

// HUD (Header + rechtes Panel) ein-/ausblenden.
// Auf dem Startbildschirm aus -> Titelbild fuellt das ganze Fenster.
function setHudSichtbar(sichtbar) {
  const header = document.getElementById('header');
  const hud    = document.getElementById('hud');
  if (header) header.style.display = sichtbar ? '' : 'none';
  if (hud)    hud.style.display    = sichtbar ? '' : 'none';
}

// Vollbild: Canvas-Größe immer an Container anpassen
function resizeGame() {
  if (!game) return;
  const c = document.getElementById('game-container');
  game.scale.resize(c.clientWidth, c.clientHeight);
}
window.addEventListener('resize', () => {
  resizeGame();
  // Offset neu berechnen wenn Fenster sich ändert
  const scene = game.scene.getScene('SpielSzene');
  if (scene && scene.sys.isActive()) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const COLS = 16, ROWS = 16;
    scene.offsetX = W / 2 - (COLS - ROWS) * scene.tileW / 4;
    scene.offsetY = Math.max(40, (H - (COLS + ROWS) * scene.tileH / 2) / 2 + 20);
  }
});
// Einmal nach dem Start nachschubsen
setTimeout(resizeGame, 200);


// ================================================================
// ABSCHNITT 19b: SAVEGAME-SYSTEM
//
//  3 Speicherslots in localStorage.
//  Gespeichert wird der komplette gameState als JSON.
//  Auto-Save alle 2 Minuten in Slot 0 (Auto-Save).
//  Funktionen: saveSpiel(slot), ladeSpiel(slot), loescheSpiel(slot)
//  UI:         oeffneSaveMenu(), oeffneLadeMenu()
// ================================================================

const SAVE_PREFIX    = 'sozialbetrug_save_';
const AUTO_SAVE_SLOT = 0;                 // Slot 0 = Auto-Save
const SAVE_VERSION   = 6;                // Inkompatible Versionen ablehnen

// ---- Auto-Save Timer ----
let autoSaveTimer = 0;
const AUTO_SAVE_INTERVALL = 120; // Sekunden

/** Wird aus dem Phaser update()-Loop aufgerufen */
function tickAutoSave(dt) {
  if (gameState.gameOver) return;
  autoSaveTimer += dt;
  if (autoSaveTimer >= AUTO_SAVE_INTERVALL) {
    autoSaveTimer = 0;
    saveSpiel(AUTO_SAVE_SLOT, true); // silent = kein Modal
  }
}

// ----------------------------------------------------------------
// saveSpiel(slot, silent?)
//   Serialisiert gameState + Metadaten → localStorage
// ----------------------------------------------------------------
function saveSpiel(slot, silent) {
  try {
    const spielerPos = window._spielerPosExport || { col: 0, row: 0 };
    const snapshot = {
      version:   SAVE_VERSION,
      datum:     new Date().toLocaleString('de-DE'),
      monat:     gameState.monat,
      woche:     gameState.woche,
      tag:       gameState.tag,
      status:    gameState.status,
      kontostand: gameState.kontostand,
      state:     JSON.parse(JSON.stringify(gameState)), // deep copy
    };
    localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(snapshot));

    if (!silent) {
      const name = slot === AUTO_SAVE_SLOT ? 'Auto-Save' : `Slot ${slot}`;
      logEvent(`💾 Gespeichert: ${name}.`, 'good');
      soundGut && soundGut();
      // Kurze Bestätigung im Modal
      oeffneModal('💾 Gespeichert',
        `Spielstand in <strong>${name}</strong> gesichert.<br>
         Monat ${gameState.monat}, Woche ${gameState.woche} · ${formatEuro(gameState.kontostand)} auf Konto`,
        []
      );
    }
  } catch (e) {
    logEvent('⚠️ Speichern fehlgeschlagen: ' + e.message, 'danger');
  }
}

// ----------------------------------------------------------------
// ladeSpiel(slot)
//   Lädt Snapshot aus localStorage → schreibt in gameState
// ----------------------------------------------------------------
function ladeSpiel(slot) {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) {
      oeffneModal('❌ Slot leer', 'Dieser Speicherplatz enthält keinen Spielstand.', []);
      return;
    }
    const snapshot = JSON.parse(raw);

    if (snapshot.version !== SAVE_VERSION) {
      oeffneModal('⚠️ Veralteter Spielstand',
        `Dieser Spielstand wurde mit Version ${snapshot.version} gespeichert.<br>
         Aktuelle Version: ${SAVE_VERSION}.<br>
         Er kann nicht geladen werden.`, []);
      return;
    }

    // gameState komplett überschreiben
    Object.assign(gameState, snapshot.state);

    // Sicherheitsnetz: fehlende neue Felder auffüllen
    if (gameState.depot          === undefined) gameState.depot          = [];
    if (gameState.loanSharkSchuld === undefined) gameState.loanSharkSchuld = 0;
    if (!Array.isArray(gameState.kindergeldKinder)) gameState.kindergeldKinder = [];
    if (gameState.gesundheit          === undefined) gameState.gesundheit          = 80;
    if (gameState.goldBarren          === undefined) gameState.goldBarren          = 0;
    if (gameState.frauAusgezogen      === undefined) gameState.frauAusgezogen      = false;
    if (gameState.unterhaltProMonat   === undefined) gameState.unterhaltProMonat   = 0;
    if (gameState.geschenkeSumme      === undefined) gameState.geschenkeSumme      = 0;
    if (gameState.supermarktFaellig   === undefined) gameState.supermarktFaellig   = false;
    if (gameState.lebensmittelDiesenMonat === undefined) gameState.lebensmittelDiesenMonat = null;
    if (gameState.billigKaeufeInFolge === undefined) gameState.billigKaeufeInFolge = 0;
    if (gameState.amtsTermineVerpasst === undefined) gameState.amtsTermineVerpasst = 0;
    if (gameState.algGesperrt         === undefined) gameState.algGesperrt         = false;
    if (gameState.loanSharkMahnungStufe === undefined) gameState.loanSharkMahnungStufe = 0;
    if (gameState.razziaChanceAktuell === undefined) gameState.razziaChanceAktuell = 0;
    if (gameState.tag             === undefined) gameState.tag             = 1;

    gameState.gameOver = false; // Sicherheitshalber zurücksetzen

    updateHUD();
    logEvent(`📂 Geladen: Slot ${slot === AUTO_SAVE_SLOT ? 'Auto' : slot} · M${gameState.monat} W${gameState.woche}.`, 'good');
    soundGut && soundGut();

    // Phaser-Szene neu starten (Karte neu aufbauen mit gleichen Daten)
    const phaserGame = window._phaserGameRef;
    if (phaserGame) {
      // Versuche SpielSzene zu stoppen und neu zu starten
      phaserGame.scene.stop('SpielSzene');
      phaserGame.scene.start('SpielSzene');
    }

    schliesseModal();

  } catch (e) {
    oeffneModal('❌ Ladefehler', 'Spielstand konnte nicht geladen werden:<br>' + e.message, []);
  }
}

// ----------------------------------------------------------------
// loescheSpiel(slot)
// ----------------------------------------------------------------
function loescheSpiel(slot) {
  localStorage.removeItem(SAVE_PREFIX + slot);
  logEvent(`🗑️ Slot ${slot} gelöscht.`, 'warn');
}

// ----------------------------------------------------------------
// leseSaveInfo(slot) → Lesbare Slot-Info für das Menü
// ----------------------------------------------------------------
function leseSaveInfo(slot) {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return {
      datum:     s.datum,
      monat:     s.monat,
      woche:     s.woche,
      tag:       s.tag || 1,
      status:    s.status,
      kontostand: s.kontostand,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// oeffneSaveMenu() – zeigt alle 3 Slots zum Überschreiben
// ----------------------------------------------------------------
function oeffneSaveMenu() {
  const aktionen = [1, 2, 3].map(slot => {
    const info = leseSaveInfo(slot);
    const label = info
      ? `Slot ${slot}: M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)} · ${info.datum}`
      : `Slot ${slot}: [leer]`;
    return {
      label,
      callback: () => saveSpiel(slot)
    };
  });

  oeffneModal(
    '💾 Spiel speichern',
    `Wähle einen Speicherplatz.<br>
     <span style="color:var(--text-dim); font-size:0.62rem;">Auto-Save läuft automatisch alle 2 Minuten.</span>`,
    aktionen
  );
}

// ----------------------------------------------------------------
// oeffneLadeMenu() – zeigt alle Slots zum Laden
// ----------------------------------------------------------------
function oeffneLadeMenu() {
  const autoInfo = leseSaveInfo(AUTO_SAVE_SLOT);
  const alle = [
    { slot: AUTO_SAVE_SLOT, label: 'Auto-Save' },
    { slot: 1, label: 'Slot 1' },
    { slot: 2, label: 'Slot 2' },
    { slot: 3, label: 'Slot 3' },
  ];

  const aktionen = alle.map(({ slot, label }) => {
    const info = leseSaveInfo(slot);
    if (!info) {
      return {
        label: `${label}: [leer]`,
        callback: () => oeffneModal('❌ Slot leer', 'Kein Spielstand vorhanden.', [])
      };
    }
    return {
      label: `${label}: M${info.monat} W${info.woche} T${info.tag} · ${info.status} · ${formatEuro(info.kontostand)}<br>
              <span style="font-size:0.58rem; color:var(--text-dim);">📅 ${info.datum}</span>`,
      callback: () => {
        // Bestätigung vor dem Laden (überschreibt aktuellen Fortschritt)
        oeffneModal(
          `📂 ${label} laden?`,
          `M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)}<br><br>
           ⚠️ Der aktuelle Spielstand geht verloren!`,
          [
            { label: '✅ Laden', primary: true, callback: () => ladeSpiel(slot) },
            { label: '❌ Abbrechen', callback: () => {} }
          ]
        );
      }
    };
  });

  oeffneModal('📂 Spiel laden', 'Wähle einen Spielstand zum Laden:', aktionen);
}

// ================================================================
// ABSCHNITT 19: SPIELSTART  (StartSzene übernimmt den Titelscreen)
// ================================================================
// Kein Modal mehr nötig – StartSzene zeigt den Titelscreen.
// Audio-Init passiert beim ersten Klick auf den Startbutton.
// Phaser wird in window.onload weiter oben (Abschnitt 18) gestartet.
// Kein zweiter load-Listener nötig.
