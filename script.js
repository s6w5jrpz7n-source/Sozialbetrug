// ================================================================
//  Sozialbetrug: Arbeitslos zum Millionär – script.js  (Version 6.1 – Balancing)
//  Neue Systeme: Prozedurale Gebäude, Ehe-Krise Quest, Razzia-Logik,
//  Bargeld-Transport, verbessertes Balancing, updateUI Tick-Sync
// ================================================================

// Sichtbare Build-Marke: zeigt im Header "v7", sobald DIESE Datei geladen ist.
// Bleibt im Header "v6" stehen, läuft noch eine alte (gecachte) script.js.
const BUILD_MARKE = 'v146 – Einliegerwhg. läuft trotz Prüfung weiter';
// Nutzer-sichtbare App-Version (zur versionName im Play Store passend halten)
const APP_VERSION = '1.0.0';

// ===== Mehrsprachigkeit (DE/EN) =================================================
// T('deutsch','english') liefert je nach Sprache den Text. Noch nicht übersetzte
// Stellen (ohne 2. Argument) bleiben automatisch Deutsch → nichts kaputt.
// Sprachwechsel speichert + lädt neu (damit auch fest definierte Texte greifen).
let SPRACHE = 'de';
try {
  const gespeichert = localStorage.getItem('lang');
  SPRACHE = gespeichert || ((navigator.language || 'de').toLowerCase().startsWith('en') ? 'en' : 'de');
} catch (e) {}
function T(de, en) { return (SPRACHE === 'en' && en != null) ? en : de; }
function setSprache(l) {
  try { localStorage.setItem('lang', l); } catch (e) {}
  location.reload();   // Neustart in der neuen Sprache (am Startbildschirm geht nichts verloren)
}
window.T = T; window.setSprache = setSprache;

// Erststart: Sprache wählen, BEVOR irgendetwas vom Spiel sichtbar ist.
// Greift nur, wenn noch keine Sprache gespeichert wurde (localStorage 'lang' leer).
function ersteSprachwahlNoetig() {
  try { return !localStorage.getItem('lang'); } catch (e) { return false; }
}
function zeigeSprachwahl() {
  if (document.getElementById('lang-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'lang-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:200000;background:#12151c;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;' +
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f0e9d6;padding:24px;text-align:center;';
  const titel = document.createElement('div');
  titel.textContent = 'Sprache wählen · Choose language';
  titel.style.cssText = 'font-size:22px;font-weight:bold;letter-spacing:.5px;';
  ov.appendChild(titel);
  const mk = (label, lang) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font-size:21px;padding:15px 44px;min-width:250px;border-radius:14px;' +
      'border:2px solid #c8a24a;background:#1d2431;color:#ffe9b0;cursor:pointer;';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); setSprache(lang); });
    return b;
  };
  ov.appendChild(mk('🇩🇪  Deutsch', 'de'));
  ov.appendChild(mk('🇬🇧  English', 'en'));
  (document.body || document.documentElement).appendChild(ov);
}
// ===============================================================================

// Begehbares Gitter: Spieldiamant 0..15 + ein Ring (−1 und 16) rundherum, damit
// man um den Diamanten herumlaufen kann (außen auf dem gemalten Gehsteig).
const GEH_MIN = -3, GEH_MAX = 50;   // feines Raster 0..47 + Laufweg-Ring (3 Felder = 1 alte Kachel)

// Einheitliche Anzeigehöhen der Figuren (px). Werden auf jede Pose angewandt,
// damit Front-/Seiten-Sheets gleich groß wirken (unabhängig von der Sheet-Höhe).
const SPIELER_H = 88;   // Spieler ~65% größer als zuvor
const BETTLER_H = 82;   // Bettler entsprechend größer
const RAEUBER_H = 84;   // Räuber etwa Spielergröße
document.addEventListener('DOMContentLoaded', () => {
  // Erststart: Sprachwahl vor allem anderen einblenden
  if (ersteSprachwahlNoetig()) zeigeSprachwahl();
  const st = document.querySelector('.subtitle');
  if (st) st.textContent = 'Arbeitslos zum Millionär — ' + BUILD_MARKE;
  console.log('[Sozialbetrug] script.js BUILD', BUILD_MARKE);
  // Dauerhaft sichtbares Build-Abzeichen (auch IM Spiel) – zum Prüfen, ob die
  // getestete Version aktuell ist. Zeigt nur das Versions-Kürzel (z. B. "v127").
  if (!document.getElementById('build-badge')) {
    const b = document.createElement('div');
    b.id = 'build-badge';
    b.textContent = BUILD_MARKE.split('–')[0].trim();
    b.style.cssText = 'position:fixed;left:6px;top:4px;z-index:100000;' +
      'font:bold 11px "Share Tech Mono",monospace;color:#9ff;' +
      'background:rgba(0,0,0,.6);padding:1px 6px;border-radius:7px;' +
      'pointer-events:none;letter-spacing:.5px;';
    document.body.appendChild(b);
  }
});

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
  hatSchwarzgearbeitet: false,  // true, sobald einmal schwarzgearbeitet wurde (Zoll-Brief-Bedingung)

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
  geschenkeSumme: 0,        // Zählt Geschenke bis 1000€ für Rückkehr

  // ---- Supermarkt ----
  lebensmittelDiesenMonat: null, // zuletzt gekaufte Qualität 'gut'|'normal'|'billig'|null (für Anzeige)
  lebensmittelTageRest: 0,       // verbleibende Vorrats-Tage (Einkauf füllt bis zur Kapazität)
  grosserKuehlschrank: false,    // gekauft → Vorrats-Kapazität 14 statt 7 Tage
  billigKaeufeInFolge: 0,   // Für "Frau beschwert sich"-Event
  supermarktFaellig: false, // true ab Tag 3 des Monats
  kuehlschrankWarnung: false, // "Kühlschrank leer"-Popup schon gezeigt (pro Monat)

  // ---- Arbeitsamt-Fehltermine ----
  amtsTermineVerpasst: 0,   // Zurückgesetzt bei erstem Besuch
  algGesperrt: false,       // true nach 3 verpassten Terminen, bis Besuch

  // ---- Krankmeldung (beim Arzt erkauft) ----
  krankmeldungWochenRest:     0,  // Wochen Krankschreibung übrig (kein Amt-Termin, keine Razzia)
  krankmeldungCooldownWochen: 0,  // Sperre bis zur nächsten Krankmeldung (max. alle 6 Wochen)
  kampfsportGelernt: false,       // Kampfsport gelernt → 75% statt 50% gegen den Räuber
  anzeigeCooldownMonat: 0,        // nach Schweigegeld: keine Anonyme-Anzeige bis zu diesem Monat
  bettlerAus: false,              // Bettler dauerhaft weggeschickt ("Nicht mehr fragen")
  millionHinweis: false,          // Millionär-Hinweis (auswandern!) schon gezeigt

  // ---- Legale Mehrbedarfe / Anträge (Arbeitsamt) ----
  mehrbedarf: {             // aktive monatliche Zuschläge
    warmwasser:      false, // +15  legal, ohne Bedingung
    alleinerziehend: false, // +70  braucht ≥1 Kind
    ernaehrung:      false, // +110 braucht Attest
    but:             false, // +40  braucht ≥1 Kind
  },
  ernaehrungFake: false,    // true wenn Attest gefälscht → Jobcenter-Prüfrisiko
  ernaehrungAttest: false,  // echtes Attest vom Arzt vorhanden (Voraussetzung fürs Amt)
  einstiegsgeldMonate: 0,   // verbleibende Monate mit +338 (Gründerbonus)
  kduMascheGestoppt: false, // true wenn KdU-Masche aufgeflog → Amt zahlt keine Villa-Miete mehr

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
  // Villa-Trick: Amt glaubt, wir wohnen in der Einliegerwohnung; in Wahrheit
  // vermieten wir sie schwarz für 650 €/M und leben in der Villa.
  einliegerVermietet: false,

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

  // ---- Kirche: Cooldowns (frühester Monat für nächste Nutzung) ----
  suendenerlassCooldownMonat: 0,
  beichteCooldownMonat: 0,
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
  // Positiv = Leistung kassiert; negativ = Rückzahlung an den Staat (Zähler sinkt, min. 0)
  gameState.vomStaatGesamt = Math.max(0, (gameState.vomStaatGesamt || 0) + betrag);
}

// Voll-Bild-Siegesbildschirm (nur nach Auswandern).
function zeigeGewonnen(vermoegen) {
  const el = document.getElementById('win-screen');
  const sub = document.getElementById('win-sub');
  if (sub) sub.innerHTML = T(`Mit <strong>${formatEuro(vermoegen)}</strong> hast du dich ins sonnige Ausland abgesetzt.<br>Kein Amt, keine Razzia, kein Knast – nur Strand. Der Staat hat verloren. 🍹`, `With <strong>${formatEuro(vermoegen)}</strong> you have slipped away to the sunny abroad.<br>No office, no raid, no prison – just beach. The state has lost. 🍹`);
  if (el) {
    const wt = el.querySelector('.win-title'); if (wt) wt.textContent = T('GEWONNEN!', 'YOU WON!');
    const wb = el.querySelector('.win-btn');   if (wb) wb.textContent = T('🔄 Neues Spiel', '🔄 New game');
    el.classList.add('show'); return;
  }
  // Fallback
  oeffneModal(T('🏆 Gewonnen!', '🏆 You won!'), T(`Ausgewandert mit ${formatEuro(vermoegen)}!`, `Emigrated with ${formatEuro(vermoegen)}!`), [
    { label: T('🔄 Neues Spiel', '🔄 New game'), primary: true, callback: () => window.location.reload() }]);
}

// Bettler dauerhaft abgeschaltet? (Spielstand-Flag + localStorage-Kompatibilität)
function bettlerDeaktiviert() {
  if (gameState.bettlerAus) return true;
  try { return localStorage.getItem('spende_aus') === '1'; } catch (e) { return false; }
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
const ECHTZEIT_PRO_WOCHE     = 280;      // Sekunden pro Spielwoche (7 Tage × 40 s = 1 Tag/40 s)
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
const EINLIEGER_MIETE      = 650;        // €/Monat schwarz aus der Einliegerwohnung

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
    id: 'wohnung', name: T('🏠 Wohnung', '🏠 Apartment'), col: 2, row: 2,
    farbe: 0x3a5a8c, dachFarbe: 0x5a8abd,
    beschreibung: T('Dein Zuhause. Hier schläfst du, versteckst Bargeld und planst Cheats.', 'Your home. Sleep, hide cash and plan your schemes here.'),
    aktionen: [
      { label: T('🛏️  Schlafen (Energie +25)', '🛏️ Sleep (Energy +25)'),                    id: 'schlafen' },
      { label: T('🎭  Sozialbetrug...', '🎭 Welfare fraud...'),                          id: 'cheats_menu' },
      { label: T('🛒  Kaufen …', '🛒 Buy …'),                                  id: 'kaufen_menu' },
      { label: T('🏠  Schein-WG deklarieren (+200 €/M, riskant)', '🏠 Declare fake flatshare (+200 €/mo, risky)'), id: 'scheinwg' },
      { label: T('📦  Umzug in größere Wohnung', '📦 Move to a bigger apartment'),                  id: 'umzug' },
      { label: T('⚖️  Anwalt anrufen (Strafe anfechten)', '⚖️ Call a lawyer (contest penalty)'),         id: 'anwalt' },
      { label: T('✈️  Ins Ausland absetzen (Sieg ab 1 Mio €)', '✈️ Flee abroad (win at 1M €)'),    id: 'auswandern' }
    ]
  },
  {
    id: 'arbeitsamt', name: T('🏛️  Arbeitsamt', '🏛️ Job Center'), col: 6, row: 2,
    farbe: 0x5a3a8c, dachFarbe: 0x8a6abf,
    beschreibung: T('Pflichtbesuche alle 14 Tage. Hier beantragst du legale Mehrbedarfe & Förderungen.', 'Mandatory visits every 14 days. Apply for legal extra benefits & subsidies here.'),
    aktionen: [
      { label: T('📋  Pflichttermin wahrnehmen', '📋 Attend mandatory appointment'),               id: 'pflichttermin' },
      { label: T('📝  Scheinbewerbung einreichen (Risiko -5)', '📝 Submit fake application (Risk -5)'), id: 'scheinbewerbung' },
      { label: T('🏖️  Kur beantragen (volle Erholung)', '🏖️ Apply for spa cure (full recovery)'),         id: 'kur' },
      { label: T('🚿  Mehrbedarf Warmwasser (+15 €/M)', '🚿 Hot-water extra benefit (+15 €/mo)'),         id: 'mb_warmwasser' },
      { label: T('👨‍👧  Mehrbedarf Alleinerziehend (+70 €/M)', '👨‍👧 Single-parent extra benefit (+70 €/mo)'),    id: 'mb_alleinerziehend' },
      { label: T('🥗  Ernährungs-Mehrbedarf / Attest (+110 €/M)', '🥗 Dietary extra benefit / certificate (+110 €/mo)'), id: 'mb_ernaehrung' },
      { label: T('🎒  Bildung & Teilhabe (+40 €/M)', '🎒 Education & participation (+40 €/mo)'),            id: 'mb_but' },
      { label: T('🚀  Einstiegsgeld (Gründerbonus) beantragen', '🚀 Apply for start-up grant'), id: 'einstiegsgeld' },
      { label: T('🛋️  Erstausstattung Wohnung (einmalig +1.200 €)', '🛋️ Home starter grant (one-time +1,200 €)'), id: 'pausch_erstausstattung' },
      { label: T('🪑  Möbel/Schreibtisch fürs Kind (+250 €)', '🪑 Furniture/desk for the kid (+250 €)'),       id: 'pausch_moebel' },
      { label: T('👕  Kinder-Bekleidung (+150 €, alle 6 Monate)', '👕 Kids clothing (+150 €, every 6 months)'),    id: 'pausch_bekleidung' },
      { label: T('🤝  Sachbearbeiter schmieren (150 €/M, weniger Prüfungen)', '🤝 Bribe caseworker (150 €/mo, fewer audits)'), id: 'sachbearbeiter' }
    ]
  },
  {
    id: 'baustelle', name: T('🏗️  Baustelle', '🏗️ Construction Site'), col: 2, row: 10,
    farbe: 0x8c5a1a, dachFarbe: 0xbb8a40,
    beschreibung: T('Schwarzarbeit. Einnahmen landen als LOSES BARGELD – Transport-Risiko!', 'Off-the-books work. Earnings come as LOOSE CASH – risky to carry!'),
    aktionen: [
      { label: T('⛏️  Ganzer Tag  (Loses Bargeld +300, Risiko +12, E -20)', '⛏️ Full day (Loose cash +300, Risk +12, E -20)'), id: 'schwarzarbeit' },
      { label: T('🔧  Halber Tag  (Loses Bargeld +120, Risiko  +5, E  -8)', '🔧 Half day (Loose cash +120, Risk +5, E -8)'), id: 'halbertag' }
    ]
  },
  {
    id: 'bank', name: T('🏦  Bank', '🏦 Bank'), col: 2, row: 6,
    farbe: 0x2a7a4a, dachFarbe: 0x45aa6e,
    beschreibung: T('Loses Bargeld offiziell aufs Konto einzahlen (max. 200 €/Woche) oder Geld abheben. Aktiendepot.', 'Deposit loose cash into your account (max. 200 €/week) or withdraw. Stock portfolio.'),
    aktionen: [
      { label: T('💳  → KONTO einzahlen (Loses Bargeld → Bankkonto)', '💳 → Deposit to ACCOUNT (Loose cash → bank account)'),         id: 'einzahlen' },
      { label: T('💵  500 € abheben (Bankkonto → Loses Bargeld)', '💵 Withdraw 500 € (Bank account → Loose cash)'),              id: 'abheben' },
      { label: T('📈  Aktiendepot – Kaufen (MSCI World / Spekulation)', '📈 Stock portfolio – Buy (MSCI World / speculation)'),        id: 'depot_kaufen' },
      { label: T('📉  Aktiendepot – Verkaufen / Übersicht', '📉 Stock portfolio – Sell / overview'),                   id: 'depot_verkaufen' }
    ]
  },
  {
    id: 'pawn', name: T('💍  Pfandleiher', '💍 Pawnshop'), col: 6, row: 6,
    farbe: 0x8c1a1a, dachFarbe: 0xbf4545,
    beschreibung: T('Goldbarren kaufen (im Garten vergraben) oder Gegenstände verpfänden. Auslösen kostet 25% Zins.', 'Buy gold bars (buried in the garden) or pawn items. Redeeming costs 25% interest.'),
    aktionen: [
      { label: T('🥇  Goldbarren kaufen (500 € · Bargeld/Konto → im Garten vergraben)', '🥇 Buy gold bar (500 € · cash/account → buried in garden)'), id: 'gold_kaufen' },
      { label: T('🥇  Gold ausgraben & verkaufen', '🥇 Dig up & sell gold'),                                       id: 'gold_verkaufen' },
      { label: T('📱  Handy verpfänden', '📱 Pawn phone'),                                                  id: 'pfand_handy' },
      { label: T('💎  Schmuck verpfänden', '💎 Pawn jewelry'),                                                id: 'pfand_schmuck' },
      { label: T('📺  Fernseher verpfänden', '📺 Pawn TV'),                                              id: 'pfand_fernseher' },
      { label: T('🎮  Spielekonsole verpfänden', '🎮 Pawn game console'),                                          id: 'pfand_konsole' },
      { label: T('🚗  Auto verpfänden', '🚗 Pawn car'),                                                   id: 'pfand_auto' }
    ]
  },
  {
    id: 'amuesier', name: T('🍸  Amüsierbetrieb', '🍸 Nightclub'), col: 6, row: 10,
    farbe: 0x1a6c4a, dachFarbe: 0x2aaa72,
    beschreibung: T('Kostet 200 €. Hebt die Stimmung – 25 % Chance, erwischt zu werden!', 'Costs 200 €. Boosts your mood – 25% chance of getting caught!'),
    aktionen: [
      { label: T('🥂  Abend genießen (-200 €, Laune +30)', '🥂 Enjoy the evening (-200 €, Mood +30)'), id: 'amuesieren' }
    ]
  },
  {
    id: 'sportverein', name: T('⚽  Sportverein', '⚽ Sports Club'), col: 10, row: 2,
    farbe: 0x2a6a3a, dachFarbe: 0x3a9a52,
    beschreibung: T('Ehrenamtliche Tätigkeit. Kostet Energie, gibt kein Geld – senkt aber Risiko.', 'Volunteer work. Costs energy, no money – but lowers your risk.'),
    aktionen: [
      { label: T('🏃  Soziale Tätigkeit (1 Tag, E -20, Risiko -23, Laune +10)', '🏃 Community work (1 day, E -20, Risk -23, Mood +10)'), id: 'sozial' },
      { label: T('⚽  Training leiten  (1 Tag, E -15, Risiko -15, Laune +5)', '⚽ Lead training (1 day, E -15, Risk -15, Mood +5)'),   id: 'training' },
      { label: T('🥊  Kampfsport lernen (300 €, einmalig)', '🥊 Learn martial arts (300 €, one-time)'),                    id: 'kampfsport' }
    ]
  },
  {
    id: 'supermarkt', name: T('🛒  Supermarkt', '🛒 Supermarket'), col: 14, row: 2,
    farbe: 0x2a6a8a, dachFarbe: 0x3a9aba,
    beschreibung: T('Kaufe Lebensmittel für den Monat. Beeinflusst Gesundheit und Stimmung.', 'Buy groceries. Affects your health and mood.'),
    aktionen: [
      { label: T('🥗  Bio-Qualität  (57€/Tag, Gesundheit & Laune +)', '🥗 Organic (57€/day, Health & Mood +)'),           id: 'einkauf_gut'    },
      { label: T('🥙  Normal       (36€/Tag)', '🥙 Normal (36€/day)'),                                   id: 'einkauf_normal' },
      { label: T('🍟  Billig       (18€/Tag, Gesundheit/Laune -)', '🍟 Cheap (18€/day, Health/Mood -)'),              id: 'einkauf_billig' },
      { label: T('🎁  Geschenk kaufen (500€ → Frau-Geschenke, Rückkehr ab 1.000€)', '🎁 Buy a gift (500€ → for your wife, return at 1,000€)'), id: 'geschenk'  },
      { label: T('💼  Minijob (Aushilfe) – legales Einkommen', '💼 Mini-job (part-time) – legal income'),                       id: 'minijob'   }
    ]
  },
  {
    id: 'kiosk', name: T('🏪  Kiosk', '🏪 Kiosk'), col: 2, row: 14,
    farbe: 0xc23a3a, dachFarbe: 0x8a2020,
    beschreibung: T('Späti um die Ecke: Rubbellose, Alkohol & Zigaretten. Vorsicht – macht süchtig.', 'Corner shop: scratch cards, alcohol & cigarettes. Careful – addictive.'),
    aktionen: [
      { label: T('🎟️  Rubbellos kaufen (5€ · Glück?)', '🎟️ Buy scratch card (5€ · luck?)'),                       id: 'rubbellos' },
      { label: T('🎟️  5 Rubbellose kaufen (25€ · mehr Chancen)', '🎟️ Buy 5 scratch cards (25€ · more chances)'),            id: 'rubbellos_5' },
      { label: T('🍺  Alkohol & Zigaretten (15€, Laune +8, Gesundheit -3)', '🍺 Alcohol & cigarettes (15€, Mood +8, Health -3)'),  id: 'genussmittel' }
    ]
  },
  {
    id: 'arztpraxis', name: T('⚕️  Arztpraxis', '⚕️ Medical Practice'), col: 14, row: 10,
    farbe: 0xcfd8e0, dachFarbe: 0x9aa6b4,
    beschreibung: T('Behandlung, Krankschreibung und Entzug. Hält dich auf den Beinen.', 'Treatment, sick notes and rehab. Keeps you on your feet.'),
    aktionen: [
      { label: T('🩺  Behandlung (Gesundheit +30, 500€)', '🩺 Treatment (Health +30, 500€)'),                  id: 'arzt_behandlung' },
      { label: T('🤒  Krankmeldung 1 Woche (50€ Bestechung)', '🤒 Sick note 1 week (50€ bribe)'),              id: 'arzt_krank1' },
      { label: T('🤒  Krankmeldung 2 Wochen (100€ Bestechung)', '🤒 Sick note 2 weeks (100€ bribe)'),            id: 'arzt_krank2' },
      { label: T('🥗  Ernährungs-Attest ausstellen (50€, fürs Amt)', '🥗 Issue dietary certificate (50€, for the office)'),       id: 'arzt_attest' },
      { label: T('💉  Entzug / Therapie (Sucht heilen, 800€)', '💉 Rehab / therapy (cure addiction, 800€)'),             id: 'arzt_entzug' }
    ]
  },
  {
    id: 'villa', name: T('🏖️  Villa', '🏖️ Villa'), col: 10, row: 14,
    farbe: 0xf0e6d0, dachFarbe: 0xd8b070,
    beschreibung: T('Dein Luxus-Domizil – nur bewohnbar, wenn du die Immobilie selbst nutzt. Hier wohnst du jetzt.', 'Your luxury home – only livable if you use the property yourself. You live here now.'),
    aktionen: [
      { label: T('🏊  Pool & Sauna (Laune +20)', '🏊 Pool & sauna (Mood +20)'),                 id: 'villa_pool' },
      { label: T('🍸  Gäste empfangen (Laune +10, Partner +10)', '🍸 Host guests (Mood +10, Partner +10)'), id: 'villa_gaeste' },
      { label: T('🚪  Einliegerwohnung schwarz vermieten', '🚪 Rent out granny flat off the books'),        id: 'villa_einlieger' }
    ]
  },
  {
    id: 'kirche', name: T('⛪  Kirche', '⛪ Church'), col: 6, row: 14,
    farbe: 0xd8d0c0, dachFarbe: 0x8a7a5a,
    beschreibung: T('Sündenerlass (Risiko halbieren) und Beichte (Trost) – jeweils alle 3 Monate.', 'Absolution (halve risk) and confession (comfort) – each every 3 months.'),
    aktionen: [
      { label: T('🙏  Sündenerlass (150 €, Risiko halbiert)', '🙏 Absolution (150 €, risk halved)'), id: 'suendenerlass' },
      { label: T('🕯️  Beichte (Energie -15, Laune +10)', '🕯️ Confession (Energy -15, Mood +10)'),      id: 'beichte' }
    ]
  },
  {
    id: 'kasino', name: T('🎰  Kasino', '🎰 Casino'), col: 10, row: 6,
    farbe: 0x6a1a6a, dachFarbe: 0x9a2a9a,
    beschreibung: T('Spiele mit losem Bargeld. Rückzahlung 50–120% des Einsatzes aufs Konto (legal). Das Kasino behält im Schnitt 15%.', 'Gamble with loose cash. Payout 50–120% of the stake to your account (legal). The casino keeps ~15% on average.'),
    aktionen: [
      { label: T('🎰  100 € setzen  → 50–120% aufs Konto (legal)', '🎰 Bet 100 € → 50–120% to account (legal)'),  id: 'waschen_100'  },
      { label: T('🎰  500 € setzen  → 50–120% aufs Konto (legal)', '🎰 Bet 500 € → 50–120% to account (legal)'),  id: 'waschen_500'  },
      { label: T('🎰  1.000 € setzen → 50–120% aufs Konto (legal)', '🎰 Bet 1,000 € → 50–120% to account (legal)'), id: 'waschen_1000' },
      { label: T('🎰  Alles setzen   → 50–120% des Bargelds aufs Konto', '🎰 Bet everything → 50–120% of cash to account'), id: 'waschen_alles'}
    ]
  },
  {
    id: 'schattenbank', name: T('🏴  Schattenbank', '🏴 Shadow Bank'), col: 14, row: 6,
    farbe: 0x1a1a2a, dachFarbe: 0x0a0a18,
    beschreibung: T('Wandle Loses Bargeld in sichere Schwarzkasse um. Kostet 5%/Monat Verwaltungsgebühr.', 'Convert loose cash into a safe slush fund. Costs 5%/month admin fee.'),
    aktionen: [
      { label: T('🔒  Alles Bargeld sichern (→ Schwarzkasse, 5%/Monat Gebühr)', '🔒 Secure all cash (→ slush fund, 5%/mo fee)'), id: 'alles_sichern'  },
      { label: T('🔒  500 € sichern (→ Schwarzkasse)', '🔒 Secure 500 € (→ slush fund)'),                           id: 'sichern_500'   },
      { label: T('🔒  Schwarzkasse abheben (→ Loses Bargeld)', '🔒 Withdraw slush fund (→ loose cash)'),                    id: 'sk_abheben'    },
      { label: T('🌍  Unterhalts-Tarnung (Auslands-Kindergeld behalten)', '🌍 Support cover-up (keep foreign child benefit)'),        id: 'unterhalts_tarnung' },
      { label: T('🏘️  Immobilie kaufen (40.000 € EK + Rate)', '🏘️ Buy property (40,000 € down + installments)'),                    id: 'immo_kaufen'   },
      { label: T('🔑  Immobilie: Eigennutzung ⇄ Vermieten', '🔑 Property: own use ⇄ rent out'),                      id: 'immo_modus'    },
      { label: T('🏦  Immobilie sofort abbezahlen (Restschuld tilgen)', '🏦 Pay off property now (clear balance)'),          id: 'immo_tilgen'   },
      { label: T('💰  Immobilie verkaufen (Wert − Restschuld → Schwarzkasse)', '💰 Sell property (value − balance → slush fund)'),   id: 'immo_verkaufen'},
      { label: T('📈  Depot verschleiern (für Amt unsichtbar, 5%/Monat)', '📈 Hide portfolio (invisible to office, 5%/mo)'),        id: 'depot_verschleiern' }
    ]
  },
  {
    id: 'loanshark', name: T('🦈  Kredithai', '🦈 Loan Shark'), col: 10, row: 10,
    farbe: 0x5a1a1a, dachFarbe: 0x8a2a2a,
    beschreibung: T('Schnelles Geld, hohe Risiken. Schulden wachsen monatlich.', 'Fast money, high risk. Debt grows every month.'),
    aktionen: [
      { label: T('💰  Kredit 1.000 € aufnehmen (Risiko +15, Zins 10%/Monat)', '💰 Take 1,000 € loan (Risk +15, 10%/mo interest)'),  id: 'kredit_klein' },
      { label: T('💰  Kredit 3.000 € aufnehmen (Risiko +25, Zins 10%/Monat)', '💰 Take 3,000 € loan (Risk +25, 10%/mo interest)'),  id: 'kredit_gross' },
      { label: T('💸  Schulden zurückzahlen (aktuell: 0 €)', '💸 Repay debt (currently: 0 €)'),                    id: 'schulden_zahlen' }
    ]
  },
  {
    id: 'dealer', name: T('🌳  Park', '🌳 Park'), col: 4, row: 34,
    farbe: 0x3a6a2a, dachFarbe: 0x2a4a1a,
    beschreibung: T('Ein Park mit Bänken und Bäumen – und einer zwielichtigen Gestalt im Gebüsch.', 'A park with benches and trees – and a shady figure in the bushes.'),
    aktionen: [
      { label: T('💊  Beim Dealer was holen (80 € Bargeld)', '💊 Score from the dealer (80 € cash)'), id: 'stoff_kaufen' }
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
  handy:     { name: T('📱 Handy', '📱 Phone'),         wert: 240,  laune: 4,  ziel: 'spieler' },
  schmuck:   { name: T('💎 Schmuck', '💎 Jewelry'),       wert: 500,  laune: 6,  ziel: 'partner' },
  fernseher: { name: T('📺 Fernseher', '📺 TV'),     wert: 440,  laune: 8,  ziel: 'spieler' },
  konsole:   { name: T('🎮 Spielekonsole', '🎮 Game console'), wert: 360,  laune: 10, ziel: 'spieler' },
  auto:      { name: T('🚗 Auto', '🚗 Car'),          wert: 2400, laune: 12, ziel: 'spieler' },
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
  'Schwarzarbeit': {
    label: '⛏️ Schwarzarbeit', kosten: { energie: 0 },
    beschreibung: 'Geh zur Baustelle und arbeite schwarz – kostet einen Tag.',
    gehZu: 'baustelle',
    logText: '⛏️ Du machst dich auf den Weg zur Baustelle …'
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

  // ---- Spende: Risiko sofort halbieren, kostet Geld vom Konto ----
  'Spende': {
    label: '🎗️ Spende (Risiko -50%)', kosten: { energie: 0 },
    beschreibung: 'Zahle 10% deines Kontos (mind. 1.000 €) – Risikoraster halbiert sich sofort.',
    sofortEffekt(gs) {
      const spende = Math.max(1000, Math.floor(gs.kontostand * 0.10));
      if (gs.kontostand < spende) {
        // Wird in runCheat() separat abgefangen – hier nur als Fallback
        logEvent(T('⚠️ Nicht genug Geld für die Spende.', '⚠️ Not enough money for the donation.'), 'warn');
        return;
      }
      gs.kontostand  -= spende;
      gs.risikoRaster = Math.floor(gs.risikoRaster * 0.5);
      logEvent(T(`🎗️ Spende ${formatEuro(spende)}: Risiko halbiert auf ${gs.risikoRaster}%.`, `🎗️ Donation ${formatEuro(spende)}: Risk halved to ${gs.risikoRaster}%.`), 'good');
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
    oeffneModal(T('❌ Nicht genug Geld', '❌ Not enough money'),
      T(`Die Reise kostet <strong>1.000 €</strong>.<br>
       Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, `The trip costs <strong>€1,000</strong>.<br>
       Your account: <strong>${formatEuro(gs.kontostand)}</strong>`), []);
    return;
  }
  if (gs.energie < 50) {
    oeffneModal(T('❌ Zu erschöpft', '❌ Too exhausted'),
      T(`Die Reise kostet <strong>50 Energie</strong>.<br>
       Deine Energie: <strong>${Math.round(gs.energie)}</strong><br><br>
       Schlafe zuerst!`, `The trip costs <strong>50 Energy</strong>.<br>
       Your energy: <strong>${Math.round(gs.energie)}</strong><br><br>
       Sleep first!`), []);
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

  logEvent(T(`✈️ Zurück aus Afrika. ${name} angemeldet. +300€/Monat, Risiko +5.`, `✈️ Back from Africa. ${name} registered. +€300/month, Risk +5.`), 'warn');
  updateHUD();

  // Ergebnis-Modal
  const anzahl = gs.kindergeldKinder.length;
  oeffneModal(
    T(`✈️ Erfolgreich! ${name} ist jetzt dein Kind`, `✈️ Success! ${name} is now your child`),
    T(`Du bist zurück aus Afrika.<br><br>
     <strong>${name}</strong> ist nun offiziell in Deutschland für Kindergeld angemeldet.<br><br>
     📋 Alle angemeldeten Kinder (${anzahl}/4):<br>
     <strong>${gs.kindergeldKinder.join(', ')}</strong><br><br>
     💰 Monatliche Kindergeld-Einnahmen: <strong>+${formatEuro(anzahl * 300)}</strong> aufs Konto<br>
     ⚠️ Risikoaufschlag: <strong>+${anzahl * 5}%/Monat</strong><br><br>
     ${anzahl < 4
       ? `<span style="color:var(--accent2);">Du kannst noch ${4 - anzahl} weitere Kinder anmelden.</span>`
       : '<span style="color:var(--danger);">Maximum von 4 Kindern erreicht!</span>'
     }`, `You're back from Africa.<br><br>
     <strong>${name}</strong> is now officially registered in Germany for child benefit.<br><br>
     📋 All registered children (${anzahl}/4):<br>
     <strong>${gs.kindergeldKinder.join(', ')}</strong><br><br>
     💰 Monthly child benefit income: <strong>+${formatEuro(anzahl * 300)}</strong> into your account<br>
     ⚠️ Risk surcharge: <strong>+${anzahl * 5}%/month</strong><br><br>
     ${anzahl < 4
       ? `<span style="color:var(--accent2);">You can still register ${4 - anzahl} more children.</span>`
       : '<span style="color:var(--danger);">Maximum of 4 children reached!</span>'
     }`),
    anzahl < 4 ? [{
      label:   T('✈️ Gleich nochmal fliegen (weiteres Kind)', '✈️ Fly again right away (another child)'),
      callback: () => oeffneAfrikaReiseModal()
    }] : []
  );
}

function runCheat(cheatName) {
  const cheat = cheatDefinitions[cheatName];
  if (!cheat) return;
  const gs = gameState;

  // Aktionen, die zu einem Gebäude führen (z. B. Schwarzarbeit → Baustelle)
  if (cheat.gehZu) {
    const sz = window._phaserGameRef && window._phaserGameRef.scene.getScene('SpielSzene');
    if (sz && typeof sz.geheZuGebaeude === 'function') {
      sz.geheZuGebaeude(cheat.gehZu);
      logEvent(cheat.logText, '');
    }
    return;
  }

  // Spende: Geldprüfung statt Energieprüfung
  if (cheatName === 'Spende') {
    const spende = Math.max(1000, Math.floor(gs.kontostand * 0.10));
    if (gs.kontostand < spende) {
      oeffneModal(T('❌ Nicht genug Geld', '❌ Not enough money'),
        T(`Die Spende beträgt <strong>${formatEuro(spende)}</strong><br>
         (10% deines Kontos, mind. 1.000 €).<br><br>
         Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, `The donation is <strong>${formatEuro(spende)}</strong><br>
         (10% of your account, min. €1,000).<br><br>
         Your account: <strong>${formatEuro(gs.kontostand)}</strong>`), []);
      return;
    }
    // Bestätigung vor dem Abzug
    oeffneModal(
      T('🎗️ Spende bestätigen', '🎗️ Confirm donation'),
      T(`Du zahlst <strong>${formatEuro(spende)}</strong> (10% des Kontos).<br><br>
       Dafür wird dein Risikoraster von <strong>${Math.round(gs.risikoRaster)}%</strong>
       auf <strong>${Math.floor(gs.risikoRaster * 0.5)}%</strong> halbiert.`, `You pay <strong>${formatEuro(spende)}</strong> (10% of your account).<br><br>
       In return your risk rating is halved from <strong>${Math.round(gs.risikoRaster)}%</strong>
       to <strong>${Math.floor(gs.risikoRaster * 0.5)}%</strong>.`),
      [{
        label: T(`✅ Spende zahlen (${formatEuro(spende)})`, `✅ Pay donation (${formatEuro(spende)})`),
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
    oeffneModal(T('❌ Zu erschöpft!', '❌ Too exhausted!'),
      T(`Benötigt: <strong>${cheat.kosten.energie} Energie</strong><br>
       Vorhanden: <strong>${Math.round(gs.energie)}</strong><br><br>Schlafe zuerst!`, `Required: <strong>${cheat.kosten.energie} Energy</strong><br>
       Available: <strong>${Math.round(gs.energie)}</strong><br><br>Sleep first!`), []);
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
    label: `${def.label}${def.kosten.energie ? `  [E: -${def.kosten.energie}]` : ''}  ${def.beschreibung}`,
    callback: () => runCheat(name)
  }));
  oeffneModal(T('🎭 Sozialbetrug', '🎭 Welfare Fraud'),
    T('Illegale Aktionen. Jede kostet Energie und beeinflusst Risiko.', 'Illegal actions. Each one costs Energy and affects Risk.'), aktionen);
}

// ================================================================
//  DISCLAIMER (Pflicht-Hinweis) + INFO/ANLEITUNG (mit Reitern)
// ================================================================
function zeigeDisclaimer(ausInfo) {
  const txt = T(
    '<span style="display:block;font-size:12.5px;line-height:1.6;color:#d6ceb4;">' +
    'Dieses Spiel ist reine <strong>Satire und Fiktion</strong> – bewusst überzeichnet und ' +
    '<strong>ironisch</strong> gemeint. „Gurkistan", alle Figuren und Vorgänge sind frei erfunden.<br><br>' +
    '<strong>Sozialbetrug ist kein Kavaliersdelikt.</strong> Er schadet der Allgemeinheit und ' +
    'gerade den Menschen, die wirklich auf Unterstützung angewiesen sind. Die im Spiel ' +
    'dargestellten Handlungen (z. B. Leistungsbetrug, Schwarzarbeit, gefälschte Atteste, ' +
    'Bestechung, Drogenhandel) sind in der Realität <strong>strafbar</strong>.<br><br>' +
    'Dieses Spiel ist <strong>keine Anleitung</strong> und ruft <strong>nicht</strong> zur ' +
    'Nachahmung auf. Bitte nichts davon im echten Leben tun.<br><br>' +
    '<span style="color:#9aa6b4;">Mit „Verstanden" bestätigst du, dass du diesen Hinweis gelesen und verstanden hast.</span>' +
    '</span>',
    '<span style="display:block;font-size:12.5px;line-height:1.6;color:#d6ceb4;">' +
    'This game is pure <strong>satire and fiction</strong> – deliberately exaggerated and meant ' +
    '<strong>ironically</strong>. "Gurkistan" and all characters and events are entirely made up.<br><br>' +
    '<strong>Welfare fraud is no trivial offence.</strong> It harms society as a whole and ' +
    'above all the people who genuinely depend on support. The actions depicted in this game ' +
    '(e.g. benefit fraud, off-the-books work, forged medical certificates, ' +
    'bribery, drug dealing) are <strong>criminal offences</strong> in real life.<br><br>' +
    'This game is <strong>not a how-to guide</strong> and does <strong>not</strong> encourage ' +
    'imitation. Please do not do any of this in real life.<br><br>' +
    '<span style="color:#9aa6b4;">By clicking "Understood" you confirm that you have read and understood this notice.</span>' +
    '</span>');
  oeffneModal(T('⚖️ Wichtiger Hinweis – bitte lesen', '⚖️ Important Notice – please read'), txt, [
    { label: T('✅ Verstanden – ich habe gelesen', '✅ Understood – I have read this'), primary: true, callback: () => {
        try { localStorage.setItem('disclaimer_ok', '1'); } catch (e) {}
        if (ausInfo) oeffneInfo('disclaimer');
      } },
    { label: SPRACHE === 'en' ? '🇩🇪 Auf Deutsch lesen' : '🇬🇧 Read in English', callback: () => setSprache(SPRACHE === 'en' ? 'de' : 'en') },
  ]);
}

const INFO_TEXTE = {
  story: T(
    '<strong>📖 Willkommen in Gurkistan</strong><br><br>' +
    'Gurkistan – ein kleines Land mit einem erstaunlich großzügigen Sozialsystem. ' +
    'Arbeit gilt hier als… überbewertet. Schon mit ganz normaler Unterstützung lässt es ' +
    'sich bequem leben. Aber du hast Größeres vor: Mit ein paar „kreativen Optimierungen" ' +
    'willst du es vom Arbeitslosen zum <strong>Millionär</strong> bringen.<br><br>' +
    '<span style="color:#9aa6b4;font-size:0.85em;">(Alles satirisch &amp; fiktiv – siehe Reiter „Hinweis".)</span>',
    '<strong>📖 Welcome to Gurkistan</strong><br><br>' +
    'Gurkistan – a small country with an astonishingly generous welfare system. ' +
    'Work is considered… overrated around here. Even on ordinary benefits you can ' +
    'live quite comfortably. But you have bigger plans: with a few "creative optimisations" ' +
    'you intend to go from unemployed to <strong>millionaire</strong>.<br><br>' +
    '<span style="color:#9aa6b4;font-size:0.85em;">(All satirical &amp; fictional – see the "Notice" tab.)</span>'),
  ziel: T(
    '<strong>🎯 Dein Ziel</strong><br><br>Erreiche eines von beiden:<br>' +
    '• <strong>100.000 €</strong> vom Staat kassiert, <em>oder</em><br>' +
    '• <strong>1.000.000 €</strong> Gesamtvermögen.<br><br>' +
    'Achte dabei auf <strong>Gesundheit, Energie, Laune</strong> und dein <strong>Risiko-Raster</strong>. ' +
    'Zu viel Risiko → Razzia. Bei 0 Gesundheit ist Schluss.',
    '<strong>🎯 Your Goal</strong><br><br>Reach one of the two:<br>' +
    '• <strong>€100,000</strong> milked from the state, <em>or</em><br>' +
    '• <strong>€1,000,000</strong> in total assets.<br><br>' +
    'Keep an eye on your <strong>Health, Energy, Mood</strong> and your <strong>Risk grid</strong>. ' +
    'Too much risk → raid. At 0 Health it is game over.'),
  amt: T(
    '<strong>🏛️ Arbeitsamt &amp; Pflichten</strong><br><br>' +
    '• Zieh erst eine <strong>Wartenummer</strong> (grünes LED-Schild). Erst wenn deine Nummer dran ist ' +
    '(oder du dich für 100 € vordrängelst), kommst du zu den Anträgen.<br>' +
    '• <strong>Pflichttermine</strong> wahrnehmen – sonst Risiko +15, nach 3 Fehlterminen ALG-Sperre.<br>' +
    '• Unter <strong>Anträge</strong>: legale Mehrbedarfe &amp; Förderungen (Warmwasser, Alleinerziehend, ' +
    'Ernährung [<em>Attest vom Arzt nötig</em>], Bildung, Erstausstattung, Möbel, Bekleidung, Einstiegsgeld).<br>' +
    '• <strong>Krankmeldung</strong> beim Arzt befreit dich zeitweise von Terminen &amp; Prüfungen.',
    '<strong>🏛️ Job Center &amp; Obligations</strong><br><br>' +
    '• First take a <strong>queue number</strong> (green LED sign). Only once your number is called ' +
    '(or you push in for €100) do you get to the applications.<br>' +
    '• Attend your <strong>mandatory appointments</strong> – otherwise Risk +15, and after 3 missed appointments your benefits are suspended.<br>' +
    '• Under <strong>Applications</strong>: legal extra benefits &amp; grants (hot water, single parent, ' +
    'nutrition [<em>doctor’s certificate required</em>], education, initial set-up, furniture, clothing, start-up allowance).<br>' +
    '• A <strong>sick note</strong> from the doctor temporarily exempts you from appointments &amp; audits.'),
  essen: T(
    '<strong>🛒 Einkaufen</strong><br><br>' +
    'Du bezahlst <strong>pro Tag</strong> und füllst nur bis zur Kapazität auf ' +
    '(<strong>7 Tage</strong>, mit großem Kühlschrank <strong>14 Tage</strong>). Läuft der Vorrat leer ' +
    '(„Kühlschrank ist leer"), verlierst du <strong>täglich Gesundheit, Energie und Laune</strong>, ' +
    'bis du wieder einkaufst.<br><br>' +
    'Bio-Einkauf gibt Boni, billig spart Geld (aber Abzüge &amp; Ärger mit der Partnerin).',
    '<strong>🛒 Shopping</strong><br><br>' +
    'You pay <strong>per day</strong> and only top up to capacity ' +
    '(<strong>7 days</strong>, with a big fridge <strong>14 days</strong>). If the supply runs out ' +
    '("the fridge is empty"), you lose <strong>Health, Energy and Mood every day</strong> ' +
    'until you go shopping again.<br><br>' +
    'Organic shopping gives bonuses, cheap food saves money (but means penalties &amp; trouble with your partner).'),
  npc: T(
    '<strong>👥 Leute auf der Straße</strong><br><br>' +
    '• <strong>Bettler:</strong> bittet um Spenden (freiwillige Unterstützung fürs Projekt).<br>' +
    '• <strong>Räuber</strong> (Schatten-Viertel um Schattenbank &amp; Arzt): überfällt dich bei Kontakt – ' +
    'kooperieren (Bargeld weg) oder kämpfen (50/50). Verlässt du das Viertel, entkommst du.<br>' +
    '• <strong>Dealer</strong> (Park): Laune rauf – Gesundheit &amp; Risiko leider auch.<br><br>' +
    'Tipp: <strong>Loses Bargeld</strong> schnell sichern (Bank/Schattenbank) – sonst Beute für Räuber oder Razzia.',
    '<strong>👥 People on the Street</strong><br><br>' +
    '• <strong>Beggar:</strong> asks for donations (a voluntary contribution to the project).<br>' +
    '• <strong>Mugger</strong> (the shady district around the shadow bank &amp; doctor): attacks you on contact – ' +
    'cooperate (lose your cash) or fight (50/50). Leave the district and you escape.<br>' +
    '• <strong>Dealer</strong> (park): boosts your Mood – unfortunately your Health &amp; Risk too.<br><br>' +
    'Tip: stash <strong>loose cash</strong> quickly (bank/shadow bank) – otherwise it is loot for muggers or a raid.'),
  gebaeude: T(
    '<strong>🏢 Wichtige Orte</strong><br><br>' +
    '• <strong>Wohnung/Villa:</strong> schlafen, Geld verstecken, „Sozialbetrug"-Menü.<br>' +
    '• <strong>Bank:</strong> Bargeld aufs Konto, Aktiendepot.<br>' +
    '• <strong>Schattenbank:</strong> Schwarzkasse sichern, Immobilien, Tarnungen.<br>' +
    '• <strong>Baustelle:</strong> Schwarzarbeit (Bargeld, aber Risiko).<br>' +
    '• <strong>Supermarkt:</strong> Lebensmittel, Minijob.<br>' +
    '• <strong>Arztpraxis:</strong> Behandlung, Krankmeldung, Ernährungs-Attest.<br>' +
    '• <strong>Arbeitsamt:</strong> Pflichttermine &amp; Anträge.<br>' +
    '• <strong>Pfandleiher, Kasino, Kiosk, Sportverein, Amüsierbetrieb, Kredithai, Kirche</strong> – entdecke sie selbst.',
    '<strong>🏢 Important Places</strong><br><br>' +
    '• <strong>Flat/Villa:</strong> sleep, hide money, the "Welfare Fraud" menu.<br>' +
    '• <strong>Bank:</strong> deposit cash, stock portfolio.<br>' +
    '• <strong>Shadow Bank:</strong> stash the slush fund, real estate, cover stories.<br>' +
    '• <strong>Construction Site:</strong> off-the-books work (cash, but risk).<br>' +
    '• <strong>Supermarket:</strong> groceries, mini-job.<br>' +
    '• <strong>Doctor’s Office:</strong> treatment, sick notes, nutrition certificate.<br>' +
    '• <strong>Job Center:</strong> mandatory appointments &amp; applications.<br>' +
    '• <strong>Pawnshop, Casino, Kiosk, Sports Club, Entertainment Venue, Loan Shark, Church</strong> – discover them yourself.'),
  disclaimer: T(
    '<strong>⚖️ Rechtlicher Hinweis</strong><br><br>' +
    'Reine <strong>Satire &amp; Fiktion</strong>, ironisch gemeint. <strong>Sozialbetrug ist strafbar</strong> ' +
    'und schadet der Allgemeinheit. Dieses Spiel ist <strong>keine Anleitung</strong> und ruft nicht zur ' +
    'Nachahmung auf. Bitte nichts davon im echten Leben nachmachen.',
    '<strong>⚖️ Legal Notice</strong><br><br>' +
    'Pure <strong>satire &amp; fiction</strong>, meant ironically. <strong>Welfare fraud is a crime</strong> ' +
    'and harms society as a whole. This game is <strong>not a how-to guide</strong> and does not encourage ' +
    'imitation. Please do not copy any of this in real life.'),
};

function oeffneInfo(tab) {
  tab = tab || 'story';
  const tabs = [
    ['story', '📖 Story'], ['ziel', '🎯 Ziel'], ['amt', '🏛️ Amt'],
    ['essen', '🛒 Essen'], ['npc', '👥 Leute'], ['gebaeude', '🏢 Orte'], ['disclaimer', '⚖️ Hinweis'],
  ];
  const nav = tabs.map(([k, l]) =>
    `<button class="info-tab${k === tab ? ' aktiv' : ''}" onclick="oeffneInfo('${k}')">${l}</button>`).join('');
  // Direkt rendern (nicht über oeffneModal, sonst landet der Reiter-Wechsel in der Warteschlange)
  modalOffen = true;
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  if (!body) return;
  if (titleEl) titleEl.textContent = 'ℹ️ Info & Anleitung';
  body.innerHTML =
    `<div class="info-nav">${nav}</div>` +
    `<div class="info-body">${INFO_TEXTE[tab] || ''}</div>` +
    `<div style="text-align:center;margin-top:10px;font-size:11px;color:#7f8db5;">` +
    `Version ${APP_VERSION} · © 2026 Andreas Lang</div>`;
  const close = document.createElement('button');
  close.className = 'action-btn'; close.textContent = T('✕ Schließen', '✕ Close');
  close.onclick = () => schliesseModal();
  body.appendChild(close);
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('active');
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
    titel: T('💔 Krise Stufe 1 – Auszug angedroht', '💔 Crisis Level 1 – Threat to Move Out'),
    text: T('Deine Partnerin hat die Koffer gepackt. Sie fordert ein ernsthaftes Gespräch über eure Zukunft.', 'Your partner has packed her bags. She demands a serious talk about your future together.'),
    optionA: {
      label: T('⚖️ Mediator einschalten (-400 € Konto)', '⚖️ Bring in a mediator (-€400 from account)'),
      effekt(gs) {
        if (gs.kontostand >= 400) {
          gs.kontostand -= 400;
          gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
          gs.eheKriseSchritt = 2;
          return { erfolg: true, text: T('Der Mediator hilft. Sie bleibt vorerst. Weiter zu Schritt 2.', 'The mediator helps. She stays for now. On to step 2.') };
        }
        gs.eheKriseSchritt = 99; // Scheitern
        return { erfolg: false, text: T('Du kannst den Mediator nicht bezahlen. Sie zieht aus.', 'You cannot afford the mediator. She moves out.') };
      }
    },
    optionB: {
      label: T('🙏 Selbst reden ohne Hilfe', '🙏 Talk it out yourself, no help'),
      effekt(gs) {
        gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100);
        gs.eheKriseSchritt = 99; // Scheitern ohne professionelle Hilfe
        return { erfolg: false, text: T('Das Gespräch eskaliert. Sie zieht aus.', 'The conversation escalates. She moves out.') };
      }
    }
  },
  {
    schritt: 2,
    titel: T('⚖️ Krise Stufe 2 – Getrennte Konten', '⚖️ Crisis Level 2 – Separate Accounts'),
    text: T('Die Partnerin verlangt getrennte Konten und einen Unterhaltsnachweis.', 'Your partner demands separate accounts and proof of maintenance payments.'),
    optionA: {
      label: T('📄 Anwalt für Unterhaltsvereinbarung (-600 € Konto)', '📄 Lawyer for a maintenance agreement (-€600 from account)'),
      effekt(gs) {
        if (gs.kontostand >= 600) {
          gs.kontostand -= 600;
          gs.happinessPartner = clamp(gs.happinessPartner + 8, 0, 100);
          gs.eheKriseSchritt = 3;
          return { erfolg: true, text: T('Die Vereinbarung ist rechtlich klar. Weiter zu Schritt 3.', 'The agreement is legally watertight. On to step 3.') };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Kein Geld für den Anwalt. Verfahren eskaliert.', 'No money for the lawyer. The proceedings escalate.') };
      }
    },
    optionB: {
      label: T('😤 Ablehnen – kein Unterhalt', '😤 Refuse – no maintenance'),
      effekt(gs) {
        gs.risikoRaster    = clamp(gs.risikoRaster + 15, 0, 100);
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Die Weigerung löst ein Gerichtsverfahren aus.', 'Your refusal triggers court proceedings.') };
      }
    }
  },
  {
    schritt: 3,
    titel: T('🏛️ Krise Stufe 3 – Gericht droht', '🏛️ Crisis Level 3 – Court Looms'),
    text: T('Deine Partnerin hat einen Rechtsanwalt eingeschaltet. Das Gericht fordert Auskunft über dein Vermögen.', 'Your partner has hired a lawyer. The court demands full disclosure of your assets.'),
    optionA: {
      label: T('⚖️ Eigenen Anwalt beauftragen (-900 € Konto)', '⚖️ Hire your own lawyer (-€900 from account)'),
      effekt(gs) {
        if (gs.kontostand >= 900) {
          gs.kontostand -= 900;
          gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100);
          gs.eheKriseSchritt = 4;
          return { erfolg: true, text: T('Dein Anwalt stabilisiert die Lage. Weiter zu Schritt 4.', 'Your lawyer steadies the situation. On to step 4.') };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Kein Geld. Du gehst ohne Anwalt ins Verfahren – das ist fatal.', 'No money. You face the proceedings without a lawyer – that is fatal.') };
      }
    },
    optionB: {
      label: T('🏃 Vermögen in Schwarze Kasse verstecken (Risiko +30)', '🏃 Hide assets in the slush fund (Risk +30)'),
      effekt(gs) {
        const betrag = Math.min(gs.kontostand, 2000);
        gs.kontostand    -= betrag;
        gs.schwarzeKasse += betrag;
        gs.risikoRaster   = clamp(gs.risikoRaster + 30, 0, 100);
        gs.eheKriseSchritt = 4; // Riskant aber weiter möglich
        return { erfolg: true, text: T(`${formatEuro(betrag)} versteckt. Risiko +30. Gefährlich.`, `${formatEuro(betrag)} hidden away. Risk +30. Dangerous.`) };
      }
    }
  },
  {
    schritt: 4,
    titel: T('👶 Krise Stufe 4 – Sorgerechtsantrag eingereicht', '👶 Crisis Level 4 – Custody Application Filed'),
    text: T('Deine Partnerin hat offiziell das alleinige Sorgerecht beantragt, da sie deine finanzielle Stabilität anzweifelt.', 'Your partner has officially applied for sole custody, doubting your financial stability.'),
    optionA: {
      label: T('⚖️ Vollständige Verteidigung (-1200 € Konto)', '⚖️ Full legal defence (-€1200 from account)'),
      effekt(gs) {
        if (gs.kontostand >= 1200) {
          gs.kontostand -= 1200;
          gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
          gs.eheKriseSchritt = 5;
          return { erfolg: true, text: T('Dein Anwalt kämpft erfolgreich. Gemeinsames Sorgerecht vorerst gesichert.', 'Your lawyer fights and wins. Joint custody is secured for now.') };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Du kannst die Verteidigung nicht bezahlen. Sorgerecht verloren.', 'You cannot afford the defence. Custody lost.') };
      }
    },
    optionB: {
      label: T('😔 Nachgeben – alleiniges Sorgerecht akzeptieren', '😔 Give in – accept sole custody'),
      effekt(gs) {
        gs.happinessSpieler = clamp(gs.happinessSpieler - 30, 0, 100);
        gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100);
        gs.eheKriseSchritt  = 99; // Quest scheitert
        return { erfolg: false, text: T('Du gibst auf. Das Sorgerecht geht verloren.', 'You give up. Custody is lost.') };
      }
    }
  },
  {
    schritt: 5,
    titel: T('🕊️ Krise Stufe 5 – Letzte Chance', '🕊️ Crisis Level 5 – Last Chance'),
    text: T('Das Gericht bietet eine letzte Einigungsmöglichkeit vor dem Urteil. Eine Zahlung kann die Beziehung retten.', 'The court offers one final chance to settle before the verdict. A payment could save the relationship.'),
    optionA: {
      label: T('❤️ Alles zahlen – Beziehung retten (-1500 € Konto)', '❤️ Pay it all – save the relationship (-€1500 from account)'),
      effekt(gs) {
        if (gs.kontostand >= 1500) {
          gs.kontostand -= 1500;
          gs.happinessPartner  = clamp(gs.happinessPartner + 25, 0, 100);
          gs.happinessSpieler  = clamp(gs.happinessSpieler + 15, 0, 100);
          gs.eheKriseAktiv     = false;
          gs.eheKriseGescheitert = false;
          gs.eheKriseSchritt   = 0;
          return { erfolg: true, text: T('✅ Die Beziehung ist gerettet. Das Sorgerecht bleibt gemeinsam. Ehe-Krise beendet!', '✅ The relationship is saved. Custody stays joint. Marriage crisis resolved!') };
        }
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Kein Geld. Das Gericht entscheidet gegen dich.', 'No money. The court rules against you.') };
      }
    },
    optionB: {
      label: T('💔 Aufgeben (Sorgerechtsstreit verloren)', '💔 Give up (custody battle lost)'),
      effekt(gs) {
        gs.eheKriseSchritt = 99;
        return { erfolg: false, text: T('Du gibst auf. Das Gericht fällt sein Urteil.', 'You give up. The court delivers its verdict.') };
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
    logEvent(T('💔 EHE-KRISE ausgelöst! Partnerlaune < 30.', '💔 MARRIAGE CRISIS triggered! Partner mood < 30.'), 'danger');
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
  logEvent(T(`⚖️ Ehe-Krise Schritt ${schritt.schritt}: ${result.text}`, `⚖️ Marriage crisis step ${schritt.schritt}: ${result.text}`),
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
  closeBtn.textContent = T('✅ Weiter', '✅ Continue');
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
      setTimeout(() => oeffneModal(T('🎊 Ehe-Krise überwunden!', '🎊 Marriage crisis overcome!'),
        T('Ihr habt die Krise gemeinsam überstanden. Die Beziehung ist stabilisiert.', 'You weathered the crisis together. The relationship is stabilized.'), []), 300);
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
      titel: T('💀 Game Over – Tod durch Vernachlässigung', '💀 Game Over – Death by neglect'),
      text: T('Deine Gesundheit ist auf 0 gesunken. Du hast es nicht rechtzeitig ins Krankenhaus geschafft.<br><br>'
            + 'Das Ergebnis eines Lebens voller Stress, schlechter Ernährung und zu viel Risiko.<br><br>'
            + '<strong>Neustart für einen zweiten Versuch?</strong>',
            'Your health has dropped to 0. You did not make it to the hospital in time.<br><br>'
            + 'The result of a life full of stress, bad nutrition and too much risk.<br><br>'
            + '<strong>Restart for a second try?</strong>')
    },
    bankrott: {
      titel: T('💸 Game Over – Bankrott', '💸 Game Over – Bankrupt'),
      text: T('Du hast kein Geld mehr und beziehst ALG2. Keine Reserven, kein Gold, kein Depot.<br><br>'
            + 'Das System hat gewonnen.<br><br>'
            + '<strong>Neustart für einen zweiten Versuch?</strong>',
            'You are out of money and back on welfare. No reserves, no gold, no portfolio.<br><br>'
            + 'The system has won.<br><br>'
            + '<strong>Restart for a second try?</strong>')
    },
    sorgerecht: {
      titel:  T('💔 Game Over – Sorgerechtsstreit verloren', '💔 Game Over – Custody battle lost'),
      text:   T('Du hast die Ehe-Krise nicht überstanden. Das Gericht hat das alleinige Sorgerecht<br>' +
              'deiner Partnerin zugesprochen. Du verlierst den Kontakt zu deinem Kind.<br><br>' +
              'Die finanzielle und emotionale Last war zu groß.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>',
              'You did not survive the marriage crisis. The court granted sole custody<br>' +
              'to your partner. You lose contact with your child.<br><br>' +
              'The financial and emotional burden was too much.<br><br>' +
              '<strong>Restart for a second try?</strong>')
    },
    razzia: {
      titel:  T('🚨 Game Over – Razzia ohne Ausrede', '🚨 Game Over – Raid with no excuse'),
      text:   T('Die Behörden haben dich auf frischer Tat ertappt. Deine schwarze Kasse ist<br>' +
              'konfisziert, dein Konto eingefroren. Ein Strafverfahren wegen Sozialbetrugs<br>' +
              'wurde eröffnet.<br><br><strong>Neustart für einen zweiten Versuch?</strong>',
              'The authorities caught you red-handed. Your slush fund is<br>' +
              'confiscated, your account frozen. Criminal proceedings for welfare fraud<br>' +
              'have been opened.<br><br><strong>Restart for a second try?</strong>')
    },
    knast: {
      titel:  T('🔒 Game Over – Lange Haft', '🔒 Game Over – Long prison sentence'),
      text:   T('Als Wiederholungstäter beim Sozialbetrug verurteilt dich das Gericht zu<br>' +
              'einer mehrjährigen Haftstrafe ohne Bewährung. Vermögen eingezogen,<br>' +
              'Familie verloren. Das System hat doch gewonnen.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>',
              'As a repeat offender in welfare fraud the court sentences you to<br>' +
              'several years in prison without parole. Assets seized,<br>' +
              'family lost. The system has won after all.<br><br>' +
              '<strong>Restart for a second try?</strong>')
    },
    zahlungsunfaehig: {
      titel:  T('💀 Game Over – Zahlungsunfähig', '💀 Game Over – Insolvent'),
      text:   T('Du konntest deine Verpflichtungen drei Monate lang nicht begleichen.<br>' +
              'Der Gerichtsvollzieher pfändet alles, du wirst aus der Wohnung geklagt.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>',
              'You could not settle your obligations for three months straight.<br>' +
              'The bailiff seizes everything and you are evicted from your apartment.<br><br>' +
              '<strong>Restart for a second try?</strong>')
    },
    bankrott: {
      titel:  T('💸 Game Over – Totalpleite', '💸 Game Over – Flat broke'),
      text:   T('Konto leer, Schwarze Kasse leer, keine Leistungen mehr.<br>' +
              'Du kannst die Miete nicht mehr zahlen und wirst obdachlos.<br><br>' +
              '<strong>Neustart für einen zweiten Versuch?</strong>',
              'Account empty, slush fund empty, no more benefits.<br>' +
              'You can no longer pay the rent and end up homeless.<br><br>' +
              '<strong>Restart for a second try?</strong>')
    }
  };

  const info = texte[grund] || texte.bankrott;

  // Danger-Flash
  const flash = document.getElementById('danger-flash');
  if (flash) {
    flash.style.display = 'block';
    setTimeout(() => { flash.style.display = 'none'; }, 1200);
  }

  logEvent(T(`💀 GAME OVER: ${info.titel}`, `💀 GAME OVER: ${info.titel}`), 'danger');
  try { soundGameOver(); } catch (e) {}   // Sound darf den Game-Over-Bildschirm nicht verhindern

  // Vollbild-Game-Over (knallig). Grund-Text klein darunter.
  setTimeout(() => {
    const go = document.getElementById('gameover-screen');
    const gt = document.getElementById('go-text');
    if (gt) gt.innerHTML = T('Viel Glück im nächsten Leben als Arbeitsloser.', 'Good luck in your next life as an unemployed.') + '<br><span style="opacity:0.7;font-size:0.85em;">(' + info.titel.replace(/^[^–]*–\s*/, '') + ')</span>';
    if (go) {
      const gsub = go.querySelector('.go-sub'); if (gsub) gsub.textContent = T('Du bist gestorben.', 'You have died.');
      const gbtn = go.querySelector('.go-btn'); if (gbtn) gbtn.textContent = T('🔄 Neues Leben', '🔄 New life');
      go.classList.add('show');
    }
    else {
      // Fallback: altes Modal, falls das Element fehlt
      modalOffen = true;
      document.getElementById('modal-title').textContent = info.titel;
      const body = document.getElementById('modal-body');
      body.innerHTML = `<p>${info.text}</p>`;
      const rb = document.createElement('button');
      rb.className = 'action-btn danger-btn'; rb.textContent = T('🔄 Neustart', '🔄 Restart');
      rb.onclick = () => window.location.reload();
      body.appendChild(rb);
      document.getElementById('modal-overlay').classList.add('active');
    }
  }, 700);
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
  // Während einer Krankmeldung findet keine Razzia/Prüfung statt
  if (gs.gameOver || gs.risikoRaster <= RAZZIA_SCHWELLE || (gs.krankmeldungWochenRest || 0) > 0) {
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
  logEvent(T('🚨 RAZZIA-PRÜFUNG! Wähle sofort eine Ausrede!', '🚨 RAID AUDIT! Pick an excuse right now!'), 'danger');

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

// "NIETE"-Stempel beim Rubbellos (mit Knall). Re-entrant: jeder Aufruf startet
// die Animation neu, sodass mehrere Nieten schnell hintereinander knallen.
function _zeigeStempel(elId, anderId) {
  const el = document.getElementById(elId), ander = document.getElementById(anderId);
  if (ander) ander.classList.remove('show');   // immer nur EIN Stempel sichtbar
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;            // Reflow → Animation neu starten
  el.classList.add('show');
  soundStempel && soundStempel();
  clearTimeout(el._stempelTimer);
  el._stempelTimer = setTimeout(() => el.classList.remove('show'), 1500);
}
function zeigeNieteStempel()  {
  const t = document.querySelector('#niete-flash .niete-text'); if (t) t.textContent = T('Niete', 'Blank');
  _zeigeStempel('niete-flash',  'gewinn-flash');
}
function zeigeGewinnStempel() {
  const t = document.querySelector('#gewinn-flash .gewinn-text'); if (t) t.textContent = T('Gewinn', 'Win');
  _zeigeStempel('gewinn-flash', 'niete-flash');
}

// Ein einzelnes Los ziehen → Gewinnbetrag (0 = Niete).
function rubbellosZiehung() {
  const r = Math.random();
  if (r < 0.80)   return 0;       // Gewinnchance halbiert (vorher 40% → jetzt 20%)
  if (r < 0.925)  return 10;
  if (r < 0.975)  return 30;
  if (r < 0.995)  return 200;
  if (r < 0.9995) return 2000;
  return 50000;
}

// Kauft `anzahl` Rubbellose à 5 €. Nieten → schnelle NIETE-Stempel mit Knall,
// jeder Gewinn → Fanfare.
function kaufeRubbellose(anzahl) {
  const gs = gameState;
  const kosten = 5 * anzahl;
  if (gs.kontostand < kosten) {
    logEvent(T(`⚠️ Kein Geld für ${anzahl === 1 ? 'ein Rubbellos' : anzahl + ' Rubbellose'} (${formatEuro(kosten)}).`, `⚠️ No money for ${anzahl === 1 ? 'one scratch card' : anzahl + ' scratch cards'} (${formatEuro(kosten)}).`), 'warn');
    return;
  }
  gs.kontostand -= kosten;

  const gewinne = [];
  let summe = 0, nieten = 0, maxGewinn = 0;
  for (let i = 0; i < anzahl; i++) {
    const g = rubbellosZiehung();
    gewinne.push(g);
    summe += g;
    if (g === 0) nieten++; else maxGewinn = Math.max(maxGewinn, g);
  }
  gs.kontostand += summe;

  // Pro Los ein Stempel – GEWINN (grün) oder NIETE (rot) – 0,5 s Abstand
  gewinne.forEach((g, i) => setTimeout(() => (g > 0 ? zeigeGewinnStempel() : zeigeNieteStempel()), i * 500));
  const seqDauer = anzahl * 500;

  // Jeder Gewinn → Fanfare
  if (summe > 0) { soundFanfare && soundFanfare(); soundGeld && soundGeld(); }

  const netto  = summe - kosten;
  const detail = gewinne.map(g => g === 0 ? '✖️' : `+${formatEuro(g)}`).join('   ');
  if (anzahl === 1) {
    logEvent(summe > 0 ? T(`🎟️ Rubbellos: +${formatEuro(summe)}.`, `🎟️ Scratch card: +${formatEuro(summe)}.`) : T('🎟️ Rubbellos: Niete.', '🎟️ Scratch card: Blank.'), summe > 0 ? 'good' : 'warn');
    if (summe >= 2000) setTimeout(() => oeffneModal(T('🎉 JACKPOT!', '🎉 JACKPOT!'), T(`Du gewinnst <strong>${formatEuro(summe)}</strong>!`, `You win <strong>${formatEuro(summe)}</strong>!`), []), seqDauer + 250);
  } else {
    logEvent(T(`🎟️ 5 Lose: +${formatEuro(summe)} bei ${nieten} Nieten.`, `🎟️ 5 cards: +${formatEuro(summe)} with ${nieten} blanks.`), netto >= 0 ? 'good' : 'warn');
    // Zusammenfassung erst NACH der Stempel-Sequenz
    setTimeout(() => oeffneModal(maxGewinn >= 2000 ? T('🎉 JACKPOT!', '🎉 JACKPOT!') : T('🎟️ 5 Rubbellose', '🎟️ 5 Scratch Cards'),
      summe > 0
        ? T(`${detail}<br><br>Gewinn gesamt: <strong>${formatEuro(summe)}</strong> (Einsatz ${formatEuro(kosten)} → ${netto >= 0 ? '+' : ''}${formatEuro(netto)}).`, `${detail}<br><br>Total winnings: <strong>${formatEuro(summe)}</strong> (stake ${formatEuro(kosten)} → ${netto >= 0 ? '+' : ''}${formatEuro(netto)}).`)
        : T(`Alles Nieten! ${detail}<br><br>${formatEuro(kosten)} verspielt.`, `All blanks! ${detail}<br><br>${formatEuro(kosten)} gambled away.`), []), seqDauer + 250);
  }

  // Sucht-Risiko (steigt leicht mit Einsatz)
  if (Math.random() < 0.15 * Math.min(2, anzahl) && gs.suchtStufe < 3) {
    gs.suchtStufe++;
    logEvent(T(`🎰 Das Zocken packt dich… Sucht-Stufe ${gs.suchtStufe}.`, `🎰 The gambling bug bites… Addiction level ${gs.suchtStufe}.`), 'danger');
  }
  updateHUD();
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
    gs.einliegerVermietet = false;
    // Villa bleibt IMMER in deinem Besitz (Eigennutzung) – Haft ändert daran nichts.
    soundAlarm && soundAlarm();
    logEvent(T('🔒 Gefängnis! 3 Monate Haft, Schwarzgeld konfisziert.', '🔒 Prison! 3 months behind bars, dirty money confiscated.'), 'danger');
    setTimeout(() => oeffneModal(T('🔒 Gefängnis – Sozialbetrug', '🔒 Prison – Welfare Fraud'),
      T(`Das Gericht verurteilt dich zu <strong>${haftMonate} Monaten Haft</strong>.<br><br>`
      + `Konfisziert: <strong>${formatEuro(konfisziert)}</strong> (loses Bargeld + Schwarzkasse).<br>`
      + 'Gesundheit −20, Partnerlaune −30. Alle laufenden Maschen sind aufgeflogen.<br>'
      + 'Deine <strong>Villa behältst du</strong> (bleibt in deinem Besitz).<br><br>'
      + '⚠️ Als Vorbestrafter gilt: Wirst du <strong>noch einmal</strong> erwischt, ist es vorbei.',
      `The court sentences you to <strong>${haftMonate} months in prison</strong>.<br><br>`
      + `Confiscated: <strong>${formatEuro(konfisziert)}</strong> (loose cash + slush fund).<br>`
      + 'Health −20, Partner mood −30. All your running scams have been blown.<br>'
      + 'You <strong>keep your villa</strong> (stays in your possession).<br><br>'
      + '⚠️ As a repeat offender: if you get caught <strong>one more time</strong>, it is over.'), []), 1700);
    updateHUD();
    return;
  }

  if (gs.strafStufe === 2) {
    // ---- Anklage: Geldstrafe + Bewährung ----
    const strafe = Math.min(Math.max(0, gs.kontostand), Math.max(2000, Math.floor((gs.vomStaatGesamt || 0) * 0.10)));
    gs.kontostand -= strafe;
    logEvent(T(`⚖️ Anklage: Geldstrafe ${formatEuro(strafe)} + Bewährung.`, `⚖️ Charge: fine ${formatEuro(strafe)} + suspended sentence.`), 'danger');
    setTimeout(() => oeffneModal(T('⚖️ Anklage – Bewährung', '⚖️ Charge – Suspended Sentence'),
      T(`Anklage wegen Sozialbetrugs. <strong>Geldstrafe ${formatEuro(strafe)}</strong> und <strong>Bewährung</strong>.<br><br>`
      + 'Das nächste Mal drohen <strong>Gefängnis</strong>.',
      `Charged with welfare fraud. <strong>Fine of ${formatEuro(strafe)}</strong> and a <strong>suspended sentence</strong>.<br><br>`
      + 'Next time you face <strong>prison</strong>.'), []), 1700);
    updateHUD();
    return;
  }

  // ---- Erster Bust: Ermittlung / Verwarnung ----
  logEvent(T('📂 Ermittlungsverfahren wegen Sozialbetrugs eröffnet.', '📂 Criminal investigation for welfare fraud opened.'), 'danger');
  updateHUD();
  setTimeout(() => oeffneModal(T('📂 Ermittlungsverfahren', '📂 Criminal Investigation'),
    T('Gegen dich wird wegen Verdachts auf Sozialbetrug ermittelt – noch eine <strong>Verwarnung</strong>.<br><br>'
    + 'Halte dein Risiko niedrig (Sportverein, Spende) und versteck dein Geld (Gold/verschleiertes Depot), sonst wird es ernst.',
    'You are under investigation on suspicion of welfare fraud – consider this a <strong>warning</strong>.<br><br>'
    + 'Keep your Risk low (sports club, donation) and hide your money (gold/disguised portfolio), or things will get serious.'), []), 1700);
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
      resultatText = T('Der Beamte steckt das Geld ein und geht. Risiko -20.', 'The official pockets the cash and leaves. Risk -20.');
    } else {
      // Nicht genug Geld → eskaliert
      gs.schwarzeKasse = 0;
      gs.losesBargeld  = 0;
      gs.risikoRaster  = 95;
      resultatText = T('Kein Bargeld! Der Beamte ist wütend. Alles konfisziert, Risiko 95%.', 'No cash! The official is furious. Everything confiscated, Risk 95%.');
      erwischt = true;
    }
    logEvent(T(`🚨 Razzia: Bestechung. ${resultatText}`, `🚨 Raid: bribe. ${resultatText}`), 'danger');
  }

  else if (wahl === 'ausrede') {
    if (Math.random() < 0.5) {
      // Ausrede klappt
      gs.risikoRaster  = clamp(gs.risikoRaster - 10, 0, 100);
      resultatText = T('✅ Ausrede geglaubt! Beamter zieht ab. Risiko -10.', '✅ Excuse believed! The official leaves. Risk -10.');
      logEvent(T('🚨 Razzia: Ausrede geglaubt. Risiko -10.', '🚨 Raid: excuse believed. Risk -10.'), 'warn');
    } else {
      // Ausrede fliegt auf
      const konfisziert = gs.losesBargeld + Math.floor(gs.schwarzeKasse * 0.5);
      gs.losesBargeld  = 0;
      gs.schwarzeKasse = Math.floor(gs.schwarzeKasse * 0.5);
      gs.risikoRaster  = 95;
      resultatText = T(`❌ Ausrede aufgeflogen! ${formatEuro(konfisziert)} konfisziert. Risiko 95%.`, `❌ Excuse blown! ${formatEuro(konfisziert)} confiscated. Risk 95%.`);
      logEvent(T('🚨 Razzia: Ausrede aufgeflogen!', '🚨 Raid: excuse blown!'), 'danger');
      erwischt = true;
    }
  }

  else { // kapitulation
    gs.schwarzeKasse = 0;
    gs.losesBargeld  = 0;
    gs.risikoRaster  = 95;
    resultatText = T('Du gibst alles zu. Schwarzkasse = 0, Risiko = 95%.', 'You confess to everything. Slush fund = 0, Risk = 95%.');
    logEvent(T('🚨 Razzia: Kapitulation – Ermittlungen folgen!', '🚨 Raid: surrender – investigation follows!'), 'danger');
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
    titel: T('🐕 Wurst-Raub', '🐕 Sausage Heist'),
    text: T('Der Hund vom Nachbarn schnappt sich deine Bratwurst vom Balkon.', "The neighbour's dog snatches your bratwurst right off the balcony."),
    optionA: { label: T('🤬 Schimpfen', '🤬 Yell at it'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 3, 0, 100); return T('Der Köter rennt grinsend weg.', 'The mutt trots off grinning.'); }},
    optionB: { label: T('😂 Drüber lachen', '😂 Laugh it off'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 2, 0, 100); return T('War eh nur die Billig-Wurst.', 'It was just the cheap sausage anyway.'); }}
  },
  {
    id: 'alltag_automat', kategorie: 'alltag',
    titel: T('🎰 Der letzte Zehner', '🎰 The Last Tenner'),
    text: T('Beim Kiosk blinkt der Geldspielautomat dich verführerisch an.', 'The slot machine at the kiosk blinks at you seductively.'),
    optionA: { label: T('🎰 Zocken (10 €)', '🎰 Gamble (10 €)'), effekt(gs) {
      if (gs.losesBargeld + gs.kontostand < 10) return T('Nicht mal 10 € übrig. Tragisch.', 'Not even 10 € to spare. Tragic.');
      const ausB = Math.min(10, gs.losesBargeld); gs.losesBargeld -= ausB; gs.kontostand -= (10 - ausB);
      if (Math.random() < 0.4) { gs.losesBargeld += 40; gs.happinessSpieler = clamp(gs.happinessSpieler + 6, 0, 100); return T('JACKPOT! +40 € und ein Adrenalinschub.', 'JACKPOT! +40 € and an adrenaline rush.'); }
      gs.happinessSpieler = clamp(gs.happinessSpieler - 4, 0, 100); return T('Verzockt. Der Automat lacht dich aus.', 'Lost it all. The machine laughs at you.'); }},
    optionB: { label: T('🚶 Stark bleiben', '🚶 Stay strong'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 2, 0, 100); return T('Du gehst erhobenen Hauptes vorbei.', 'You walk past with your head held high.'); }}
  },
  {
    id: 'alltag_falschgeld', kategorie: 'alltag',
    titel: T('💵 Falscher Fuffziger', '💵 The Fake Fifty'),
    text: T('Der Späti gibt dir versehentlich einen verdächtig glänzenden 50er heraus.', 'The corner shop accidentally gives you a suspiciously shiny 50.'),
    optionA: { label: T('🤐 Behalten', '🤐 Keep it'), effekt(gs) { gs.losesBargeld += 50; gs.risikoRaster = clamp(gs.risikoRaster + 8, 0, 100); return T('+50 € Bargeld – aber Falschgeld ist heiß.', '+50 € cash – but counterfeit money is hot.'); }},
    optionB: { label: T('😇 Zurückgeben', '😇 Give it back'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); return T('Ehrlich währt am längsten. Reines Gewissen.', 'Honesty is the best policy. Clean conscience.'); }}
  },
  {
    id: 'alltag_grillfest', kategorie: 'alltag',
    titel: T('🌭 Gratis-Grillfest', '🌭 Free Barbecue'),
    text: T('Die Kirchengemeinde grillt umsonst für alle Bedürftigen.', 'The church congregation is grilling for free for everyone in need.'),
    optionA: { label: T('🍖 Vollschlagen', '🍖 Stuff yourself'), effekt(gs) { gs.energie = clamp(gs.energie + 12, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); gs.gesundheit = clamp(gs.gesundheit - 3, 0, 100); return T('Fünf Bratwürste später: satt, glücklich, leicht übel.', 'Five bratwursts later: full, happy, slightly queasy.'); }},
    optionB: { label: T('🥗 Nur Salat', '🥗 Just salad'), effekt(gs) { gs.energie = clamp(gs.energie + 4, 0, 100); gs.gesundheit = clamp(gs.gesundheit + 2, 0, 100); return T('Vernünftig. Langweilig, aber vernünftig.', 'Sensible. Boring, but sensible.'); }}
  },
  {
    id: 'alltag_fahrrad', kategorie: 'alltag',
    titel: T('🚲 Herrenloses Fahrrad', '🚲 Abandoned Bicycle'),
    text: T('Ein fast neues Rad steht seit Tagen ohne Schloss an der Laterne.', 'An almost-new bike has been chained to nothing at the lamppost for days.'),
    optionA: { label: T('🚲 „Mitnehmen"', '🚲 “Borrow” it'), effekt(gs) { gs.losesBargeld += 25; gs.risikoRaster = clamp(gs.risikoRaster + 6, 0, 100); return T('+25 € beim Hehler – fühlt sich trotzdem komisch an.', '+25 € at the fence – still feels weird though.'); }},
    optionB: { label: T('👮 Fundbüro', '👮 Lost & found'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); gs.losesBargeld += 5; return T('Ehrenmann! Der Besitzer drückt dir 5 € Finderlohn in die Hand.', 'Stand-up citizen! The owner presses a 5 € reward into your hand.'); }}
  },
  {
    id: 'alltag_wahrsagerin', kategorie: 'alltag',
    titel: T('🔮 Wahrsagerin', '🔮 Fortune Teller'),
    text: T('Am Marktstand will dir eine Wahrsagerin die Zukunft lesen.', 'At the market stall a fortune teller wants to read your future.'),
    optionA: { label: T('💸 5 € zahlen', '💸 Pay 5 €'), effekt(gs) { if (gs.losesBargeld + gs.kontostand < 5) return T('Nicht mal 5 € für die Zukunft übrig.', 'Not even 5 € to spare for the future.'); if (gs.losesBargeld >= 5) gs.losesBargeld -= 5; else gs.kontostand -= 5; gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); return T('„Großer Reichtum steht dir bevor!" Na also.', '“Great wealth lies ahead of you!” There you go.'); }},
    optionB: { label: T('🙄 Humbug', '🙄 Hogwash'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 1, 0, 100); return T('Sie murmelt dir einen kleinen Fluch hinterher.', 'She mutters a little curse after you.'); }}
  },
  {
    id: 'alltag_pfand', kategorie: 'alltag',
    titel: T('💶 Pfandflaschen-Bonanza', '💶 Deposit Bottle Bonanza'),
    text: T('Im Park steht ein praller Sack voll Pfandflaschen – herrenlos.', 'In the park sits a bulging sack of deposit bottles – ownerless.'),
    optionA: { label: T('♻️ Einsammeln', '♻️ Collect them'), effekt(gs) { gs.losesBargeld += 15; return T('+15 € Pfand kassiert.', '+15 € in deposits cashed in.'); }},
    optionB: { label: T('🚶 Zu stolz', '🚶 Too proud'), effekt(gs) { return T('Du gehst würdevoll weiter.', 'You walk on with dignity.'); }}
  },
  {
    id: 'alltag_bonusheft', kategorie: 'alltag',
    titel: T('🛒 Bonusheft voll', '🛒 Loyalty Card Full'),
    text: T('Dein Discounter-Bonusheft ist endlich vollgeklebt.', 'Your discount-store loyalty card is finally full of stamps.'),
    optionA: { label: T('🎁 Einlösen', '🎁 Redeem'), effekt(gs) { gs.kontostand += 25; return T('+25 € Gutschrift aufs Konto.', '+25 € credited to your account.'); }},
    optionB: { label: T('🗑️ Verlegt', '🗑️ Misplaced'), effekt(gs) { return T('Wo war das Heft nochmal…?', 'Now where did that card go…?'); }}
  },
  {
    id: 'alltag_trashtv', kategorie: 'alltag',
    titel: T('📺 Trash-TV-Marathon', '📺 Trash-TV Marathon'),
    text: T('Deine Lieblings-Trash-Show läuft den ganzen Tag am Stück.', 'Your favourite trash show is running back-to-back all day.'),
    optionA: { label: T('📺 Reinziehen (1 Tag)', '📺 Binge it (1 day)'), effekt(gs) { gs.energie = clamp(gs.energie + 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); verbraucheTag(1); return T('Herrlich vergammelt. E +10, Laune +5.', 'Gloriously wasted day. Energy +10, Mood +5.'); }},
    optionB: { label: T('🙅 Produktiv bleiben', '🙅 Stay productive'), effekt(gs) { return T('Diszipliniert ausgeschaltet.', 'Switched off with discipline.'); }}
  },
  {
    id: 'alltag_spielhalle', kategorie: 'alltag',
    titel: T('🎰 Spielhallen-Glück', '🎰 Arcade Luck'),
    text: T('Du kommst an der Daddelhalle vorbei. Die Automaten blinken verführerisch.', 'You walk past the amusement arcade. The machines blink seductively.'),
    optionA: { label: T('🎰 Zocken', '🎰 Gamble'), effekt(gs) { gs.losesBargeld += 120; if (Math.random() < 0.25 && gs.suchtStufe < 3) { gs.suchtStufe++; return T(`Heute lief's! +120 €. Aber das Zocken packt dich (Sucht ${gs.suchtStufe}).`, `Today was your day! +120 €. But the gambling grabs you (Addiction ${gs.suchtStufe}).`); } return T("Heute lief's! +120 € Bargeld.", 'Today was your day! +120 € cash.'); }},
    optionB: { label: T('🚶 Weitergehen', '🚶 Walk on'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 2, 0, 100); return T('Diszipliniert geblieben (schade eigentlich).', 'Stayed disciplined (a shame, really).'); }}
  },
  {
    id: 'alltag_schwarzfahren', kategorie: 'alltag',
    titel: T('🚌 Kontrolle im Bus!', '🚌 Ticket Check on the Bus!'),
    text: T('Kontrolleure steigen ein – und du hast (mal wieder) kein Ticket.', 'Inspectors get on – and (once again) you have no ticket.'),
    optionA: { label: T('🎫 Strafe zahlen (-60 €)', '🎫 Pay the fine (-60 €)'), effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 60); return T('60 € erhöhtes Beförderungsentgelt.', '60 € fare-dodging penalty.'); }},
    optionB: { label: T('🏃 Wegrennen', '🏃 Run for it'), effekt(gs) { gs.energie = clamp(gs.energie - 10, 0, 100); gs.risikoRaster = clamp(gs.risikoRaster + 3, 0, 100); return T('Entkommen – aber Stress. E -10, Risiko +3.', 'Got away – but stressful. Energy -10, Risk +3.'); }}
  },
  {
    id: 'alltag_wetter', kategorie: 'alltag',
    titel: T('🌧️ Schmuddelwetter', '🌧️ Miserable Weather'),
    text: T('Seit Tagen nur Regen. Die Stimmung ist im Keller.', 'Nothing but rain for days. Spirits are in the gutter.'),
    optionA: { label: T('😞 Drin verkriechen', '😞 Hide indoors'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 4, 0, 100); return T('Couch-Tristesse. Laune -4.', 'Couch-bound gloom. Mood -4.'); }},
    optionB: { label: T('☔ Trotzdem raus', '☔ Go out anyway'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 2, 0, 100); gs.energie = clamp(gs.energie - 5, 0, 100); return T('Frische Luft tut gut. Laune +2, E -5.', 'Fresh air does you good. Mood +2, Energy -5.'); }}
  },
  {
    id: 'alltag_paket', kategorie: 'alltag',
    titel: T('📦 Falsches Paket', '📦 Wrong Parcel'),
    text: T('Ein Paket landet bei dir – adressiert an einen Nachbarn.', 'A parcel lands at your place – addressed to a neighbour.'),
    optionA: { label: T('📦 Behalten', '📦 Keep it'), effekt(gs) {
      const verpfaendet = Object.keys(gs.verpfaendet || {}).filter(k => gs.verpfaendet[k]);
      if (verpfaendet.length > 0) {
        const itemId = verpfaendet[Math.floor(Math.random() * verpfaendet.length)];
        gs.verpfaendet[itemId] = false;
        gs.risikoRaster = clamp(gs.risikoRaster + 2, 0, 100);
        return T(`Im Paket: dein ${PFAND_ITEMS[itemId].name}! Quasi zurück (Risiko +2).`, `Inside the parcel: your ${PFAND_ITEMS[itemId].name}! Practically back (Risk +2).`);
      }
      gs.losesBargeld += 30; gs.risikoRaster = clamp(gs.risikoRaster + 2, 0, 100);
      return T('Drin: 30 € und Krimskrams. Risiko +2.', 'Inside: 30 € and odds and ends. Risk +2.');
    }},
    optionB: { label: T('📮 Zurückgeben', '📮 Return it'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return T('Ehrlich währt am längsten. Laune +3.', 'Honesty is the best policy. Mood +3.'); }}
  },
  {
    id: 'alltag_kleeblatt', kategorie: 'alltag',
    titel: T('🍀 Vierblättriges Kleeblatt', '🍀 Four-Leaf Clover'),
    text: T('Du entdeckst tatsächlich ein vierblättriges Kleeblatt.', 'You actually spot a four-leaf clover.'),
    optionA: { label: T('🍀 Aufheben', '🍀 Pick it up'), effekt(gs) { gs.kleeblatt = true; gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return T('Glück im Anflug: nächste Razzia-Chance halbiert!', 'Luck incoming: next raid chance halved!'); }},
    optionB: { label: T('🌱 Stehen lassen', '🌱 Leave it'), effekt(gs) { return T('Soll ein anderer Glück haben.', 'Let someone else have the luck.'); }}
  },
  {
    id: 'alltag_oma', kategorie: 'alltag',
    titel: T('🧧 Post von Oma', '🧧 Mail from Grandma'),
    text: T('Ein Brief von Oma – mit einem Geldschein und einem gestrickten Schal.', 'A letter from Grandma – with a banknote and a knitted scarf.'),
    optionA: { label: T('💌 Annehmen', '💌 Accept'), effekt(gs) { gs.kontostand += 50; gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); return T('Danke, Oma! +50 €, Laune +5.', 'Thanks, Grandma! +50 €, Mood +5.'); }},
    optionB: { label: T('📞 Zurückschicken', '📞 Send it back'), effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler + 3, 0, 100); return T('Zu stolz – aber nett telefoniert. Laune +3.', 'Too proud – but a nice phone chat. Mood +3.'); }}
  },
  {
    id: 'alltag_erkaeltung', kategorie: 'alltag',
    titel: T('🦠 Erkältung', '🦠 A Cold'),
    text: T('Du wachst mit Halsschmerzen und Schnupfen auf.', 'You wake up with a sore throat and a runny nose.'),
    optionA: { label: T('🛌 Schonen', '🛌 Rest up'), effekt(gs) { gs.gesundheit = clamp(gs.gesundheit - 3, 0, 100); gs.energie = clamp(gs.energie - 10, 0, 100); return T('Auskuriert. Gesundheit -3, E -10.', 'Nursed back to health. Health -3, Energy -10.'); }},
    optionB: { label: T('💪 Durchziehen', '💪 Tough it out'), effekt(gs) { gs.gesundheit = clamp(gs.gesundheit - 8, 0, 100); return T('Wird schlimmer. Gesundheit -8.', 'It gets worse. Health -8.'); }}
  },

  {
    id: 'anzeige_anonym', kategorie: 'behoerde',
    bedingung: gs => gs.monat >= (gs.anzeigeCooldownMonat || 0),   // nach Schweigegeld 3 Monate Ruhe
    titel: T('📣 Anonyme Anzeige', '📣 Anonymous Tip-Off'),
    text: T('Ein Nachbar (oder dein Ex?) hat dich beim Jobcenter wegen Sozialbetrugs angeschwärzt. Eine Sonderprüfung droht.', 'A neighbour (or your ex?) reported you to the Job Center for welfare fraud. A special audit looms.'),
    optionA: { label: T('🤐 Schweigegeld zahlen (-1.500 €)', '🤐 Pay hush money (-1.500 €)'),
      effekt(gs) {
        if (gs.kontostand + gs.schwarzeKasse < 1500) {
          gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100);
          return T('Kein Geld fürs Schweigegeld – Risiko +10.', 'No money for hush money – Risk +10.');
        }
        let r = 1500;
        const sk = Math.min(r, gs.schwarzeKasse); gs.schwarzeKasse -= sk; r -= sk;
        gs.kontostand -= r;
        gs.anzeigeCooldownMonat = gs.monat + 3;   // 3 Monate keine neue Anzeige
        return T('Der Informant hält den Mund. 3 Monate Ruhe.', 'The informant keeps quiet. 3 months of peace.');
      }},
    optionB: { label: T('😶 Aussitzen (Sonderprüfung riskieren)', '😶 Sit it out (risk a special audit)'),
      effekt(gs) {
        const maschen = gs.ernaehrungFake || gs.unterhaltsTarnung || gs.scheinWG ||
          (gs.immobilie && gs.immobilie.modus === 'eigen');
        if (maschen && Math.random() < 0.6) {
          setTimeout(() => sozialbetrugErwischt(), 400);
          return T('Sonderprüfung! Deine Maschen sind aufgeflogen…', 'Special audit! Your schemes have been blown wide open…');
        }
        gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100);
        return T('Die Prüfung ergab (diesmal) nichts Konkretes. Risiko +20.', 'The audit turned up nothing concrete (this time). Risk +20.');
      }}
  },
  {
    id: 'behoerde_01', kategorie: 'behoerde',
    titel: T('📬 Brief vom Jobcenter', '📬 Letter from the Job Center'),
    text: T('Das Jobcenter fordert Bewerbungsnachweise. Du hast 7 Tage.', 'The Job Center demands proof of job applications. You have 7 days.'),
    optionA: { label: T('📝 Scheinbewerbungen einreichen (Risiko -10)', '📝 Submit sham applications (Risk -10)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return T('Jobcenter besänftigt.', 'Job Center placated.'); }},
    optionB: { label: T('🚪 Brief ignorieren (Risiko +20)', '🚪 Ignore the letter (Risk +20)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); return T('Das wird Konsequenzen haben.', 'This will have consequences.'); }}
  },
  {
    id: 'behoerde_03', kategorie: 'behoerde',
    titel: T('📧 Einladung zur Amtsprüfung', '📧 Invitation to an Official Review'),
    text: T('Persönliche Anhörung beim Jobcenter wegen unklarer Einkommensverhältnisse.', 'In-person hearing at the Job Center over unclear income circumstances.'),
    optionA: { label: T('✅ Erscheinen und lügen (Risiko -5, E -15)', '✅ Show up and lie (Risk -5, Energy -15)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); gs.energie = clamp(gs.energie - 15, 0, 100); return T('Überstanden.', 'Survived it.'); }},
    optionB: { label: T('🏃 Termin absagen (Risiko +15)', '🏃 Cancel the appointment (Risk +15)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return T('Kontrolldichte erhöht.', 'Scrutiny ramped up.'); }}
  },
  {
    id: 'behoerde_04', kategorie: 'behoerde',
    titel: T('🚨 Außenprüfung Sozialamt', '🚨 Welfare Office Field Audit'),
    text: T('Unangekündigte Prüfung wegen Schwarzarbeitsverdacht.', 'Unannounced audit over suspicion of off-the-books work.'),
    optionA: { label: T('💸 Bestechung (-300 € Bargeld, Risiko -20)', '💸 Bribe (-300 € cash, Risk -20)'),
      effekt(gs) { if (gs.losesBargeld + gs.schwarzeKasse >= 300) { const ausL = Math.min(300, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (300 - ausL)); gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); return T('Akte geschlossen.', 'Case closed.'); } gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); return T('Kein Geld. Risiko +10.', 'No money. Risk +10.'); }},
    optionB: { label: T('😇 Nichts wissen (Risiko +10)', '😇 Play dumb (Risk +10)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); const k = Math.floor(gs.losesBargeld * 0.5); gs.losesBargeld = Math.max(0, gs.losesBargeld - k); return T(`${formatEuro(k)} loses Bargeld konfisziert.`, `${formatEuro(k)} loose cash confiscated.`); }}
  },
  {
    id: 'behoerde_05', kategorie: 'behoerde',
    bedingung: gs => gs.hatSchwarzgearbeitet,   // nur nach erster Schwarzarbeit
    titel: T('📮 Zoll-Brief', '📮 Customs Letter'),
    text: T('Verdächtige Transaktion mit deinem Namen.', 'A suspicious transaction with your name on it.'),
    optionA: { label: T('📄 Erklärung (-200 € Konto)', '📄 File a statement (-200 € account)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 200); gs.risikoRaster = clamp(gs.risikoRaster - 8, 0, 100); return T('Verfahren eingestellt.', 'Proceedings dropped.'); }},
    optionB: { label: T('🗑️ Brief wegwerfen (Risiko +30)', '🗑️ Bin the letter (Risk +30)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 30, 0, 100); return T('Mahnbescheid folgt.', 'A payment order follows.'); }}
  },
  {
    id: 'behoerde_06', kategorie: 'behoerde',
    bedingung: gs => (gs.schwarzeKasse || 0) > 0,   // nur wenn Schwarzkasse genutzt
    titel: T('💻 Datenleck – Kontobewegungen prüfbar', '💻 Data Leak – Account Movements Exposed'),
    text: T('Ungewöhnliche Bewegungen im Konto aufgefallen.', 'Unusual movements spotted in your account.'),
    optionA: { label: T('🏦 Geld verschieben (-1000 € → Schwarzkasse)', '🏦 Move money (-1000 € → slush fund)'),
      effekt(gs) { const b = Math.min(1000, gs.kontostand); gs.kontostand -= b; gs.schwarzeKasse += b; gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100); return T(`${formatEuro(b)} gesichert.`, `${formatEuro(b)} secured.`); }},
    optionB: { label: T('😅 Abwarten', '😅 Wait and see'),
      effekt(gs) { if (gs.risikoRaster > 50) { const v = Math.floor(gs.kontostand * 0.15); gs.kontostand = Math.max(0, gs.kontostand - v); return T(`Rückforderung ${formatEuro(v)}.`, `Clawback of ${formatEuro(v)}.`); } return T('Diesmal Glück.', 'Lucky this time.'); }}
  },
  {
    id: 'behoerde_07', kategorie: 'behoerde',
    titel: T('🧾 Steuerbescheid - 480 €', '🧾 Tax Assessment - 480 €'),
    text: T('Nachzahlung fällig.', 'Back payment due.'),
    optionA: { label: T('✅ Zahlen (-480 € Konto, Risiko -5)', '✅ Pay (-480 € account, Risk -5)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 480); gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); return T('Bezahlt.', 'Paid.'); }},
    optionB: { label: T('⏳ Widerspruch (Risiko +10)', '⏳ Appeal (Risk +10)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); return T('Zinsen laufen.', 'Interest is accruing.'); }}
  },
  {
    id: 'behoerde_08', kategorie: 'behoerde',
    titel: T('🕵️ Observierung – Baustellen-Video', '🕵️ Surveillance – Construction-Site Video'),
    text: T('Ein Nachbar hat dich gefilmt.', 'A neighbour filmed you.'),
    optionA: { label: T('🤐 Anwalt (-600 € Konto)', '🤐 Lawyer (-600 € account)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 600); gs.risikoRaster = clamp(gs.risikoRaster - 15, 0, 100); return T('Verfahren eingestellt.', 'Proceedings dropped.'); }},
    optionB: { label: T('😬 Zugeben (-800 € Strafe, Risiko -30)', '😬 Confess (-800 € fine, Risk -30)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 800); gs.risikoRaster = clamp(gs.risikoRaster - 30, 0, 100); return T('Strafe bezahlt, Akte geschlossen.', 'Fine paid, case closed.'); }}
  },
  {
    id: 'behoerde_09', kategorie: 'behoerde',
    titel: T('🏛️ Vorladung Staatsanwaltschaft', '🏛️ Prosecutor Summons'),
    text: T('Verdacht auf Sozialbetrug.', 'Suspicion of welfare fraud.'),
    optionA: { label: T('⚖️ Anwalt (-1000 € Konto)', '⚖️ Lawyer (-1000 € account)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 1000); gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); return T('Überstanden.', 'Survived it.'); }},
    optionB: { label: T('🏃 Untertauchen (E -30, Risiko -10)', '🏃 Go underground (Energy -30, Risk -10)'),
      effekt(gs) { gs.energie = clamp(gs.energie - 30, 0, 100); gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return T('Verfahren läuft ohne dich.', 'Proceedings continue without you.'); }}
  },
  {
    id: 'behoerde_10', kategorie: 'behoerde',
    titel: T('📰 Lokalpresse: "Sozialbetrug"', '📰 Local Press: "Welfare Fraud"'),
    text: T('Artikel in der Zeitung. Dein Name nicht direkt genannt – noch nicht.', 'An article in the paper. Your name not directly mentioned – not yet.'),
    optionA: { label: T('🤫 Profil senken (Risiko -5)', '🤫 Keep a low profile (Risk -5)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); return T('Artikel zieht vorbei.', 'The article blows over.'); }},
    optionB: { label: T('😤 Gegendarstellung (Risiko +15)', '😤 Demand a correction (Risk +15)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return T('Mehr Aufmerksamkeit.', 'More attention.'); }}
  },
  // LOAN SHARK EVENTS
  {
    id: 'shark_01', kategorie: 'loan_shark',
    titel: T('🦈 Erste Mahnung', '🦈 First Reminder'),
    text: T('Bote fordert 200 € zurück.', 'A courier demands 200 € back.'),
    optionA: { label: T('💸 200 € zahlen (Bargeld)', '💸 Pay 200 € (cash)'),
      effekt(gs) { const z = Math.min(200, gs.losesBargeld + gs.schwarzeKasse); const ausL = Math.min(z, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (z - ausL)); return z >= 200 ? T('Bote geht.', 'The courier leaves.') : T('Nicht genug – Unzufriedenheit.', 'Not enough – discontent.'); }},
    optionB: { label: T('😤 Vertrösten (Risiko +10)', '😤 Stall him (Risk +10)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); return T('Zinsaufschlag läuft.', 'Interest surcharge is ticking.'); }}
  },
  {
    id: 'shark_02', kategorie: 'loan_shark',
    titel: T('🦈 "Wir kennen deine Adresse"', '🦈 "We Know Where You Live"'),
    text: T('Drohung: 500 € bis Freitag.', 'Threat: 500 € by Friday.'),
    optionA: { label: T('💰 500 € zahlen', '💰 Pay 500 €'),
      effekt(gs) { if (gs.losesBargeld + gs.schwarzeKasse >= 500) { const ausL = Math.min(500, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (500 - ausL)); return T('Zahlt. Ruhe.', 'Paid. Quiet now.'); } gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); return T('Kein Bargeld. Risiko +20.', 'No cash. Risk +20.'); }},
    optionB: { label: T('📞 Polizei (Risiko -15)', '📞 Police (Risk -15)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 15, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); return T('Kreditgeber weg, aber Akte offen.', 'Loan shark gone, but the case stays open.'); }}
  },
  {
    id: 'shark_03', kategorie: 'loan_shark',
    titel: T('🦈 Einschüchterung', '🦈 Intimidation'),
    text: T('Zwei Männer vor der Tür.', 'Two men at your door.'),
    optionA: { label: T('🤝 400 € Bargeld geben', '🤝 Hand over 400 € cash'),
      effekt(gs) { const z = Math.min(400, gs.losesBargeld + gs.schwarzeKasse); const ausL = Math.min(z, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (z - ausL)); return T(`${formatEuro(z)} gegeben.`, `${formatEuro(z)} handed over.`); }},
    optionB: { label: T('🚪 Flüchten (E -20)', '🚪 Flee (Energy -20)'),
      effekt(gs) { gs.energie = clamp(gs.energie - 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 15, 0, 100); return T('Bei Bekanntem geschlafen.', 'Crashed at an acquaintance’s place.'); }}
  },
  {
    id: 'shark_04', kategorie: 'loan_shark',
    titel: T('🦈 Neue Konditionen: +300 €', '🦈 New Terms: +300 €'),
    text: T('Kreditgeber verdoppelt Zinsen.', 'The loan shark doubles the interest.'),
    optionA: { label: T('😤 Akzeptieren (-300 €)', '😤 Accept (-300 €)'),
      effekt(gs) { const ausL = Math.min(300, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (300 - ausL)); return T('300 € weg.', '300 € gone.'); }},
    optionB: { label: T('⚖️ Rechtlich prüfen (-150 € Konto)', '⚖️ Check it legally (-150 € account)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 150); return T('Anwalt prüft.', 'The lawyer is looking into it.'); }}
  },
  {
    id: 'shark_05', kategorie: 'loan_shark',
    titel: T('🦈 Paket abholen?', '🦈 Pick Up a Package?'),
    text: T('Schulden weg für einen Gefallen.', 'Debt wiped for a favour.'),
    optionA: { label: T('📦 Abholen (Cash +300, Risiko +35)', '📦 Pick it up (cash +300, Risk +35)'),
      effekt(gs) { gs.losesBargeld += 300; gs.risikoRaster = clamp(gs.risikoRaster + 35, 0, 100); return T('Paket abgeholt. Inhalt unbekannt.', 'Package picked up. Contents unknown.'); }},
    optionB: { label: T('❌ Ablehnen (Risiko +5)', '❌ Decline (Risk +5)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100); return T('Schulden bleiben.', 'The debt stays.'); }}
  },
  {
    id: 'shark_06', kategorie: 'loan_shark',
    titel: T('🦈 Kreditgeber ruft Jobcenter an', '🦈 Loan Shark Calls the Job Center'),
    text: T('Anonymer Tipp auf dein Schwarzgeld.', 'An anonymous tip about your off-the-books money.'),
    optionA: { label: T('🏃 2000 € verstecken', '🏃 Hide 2000 €'),
      effekt(gs) { const b = Math.min(2000, gs.kontostand); gs.kontostand -= b; gs.schwarzeKasse += b; gs.risikoRaster = clamp(gs.risikoRaster + 15, 0, 100); return T(`${formatEuro(b)} gesichert.`, `${formatEuro(b)} secured.`); }},
    optionB: { label: T('😇 Nichts tun', '😇 Do nothing'),
      effekt(gs) { const v = Math.floor(gs.kontostand * 0.2); gs.kontostand = Math.max(0, gs.kontostand - v); return T(`Rückforderung ${formatEuro(v)}.`, `Clawback of ${formatEuro(v)}.`); }}
  },
  {
    id: 'shark_07', kategorie: 'loan_shark',
    titel: T('🦈 Schulden-Reset Angebot', '🦈 Debt-Reset Offer'),
    text: T('Alle Schulden weg gegen 20% Schwarzkasse.', 'All debt wiped for 20% of your slush fund.'),
    optionA: { label: T('✅ Deal (-20% Schwarzkasse)', '✅ Deal (-20% slush fund)'),
      effekt(gs) { const z = Math.floor(gs.schwarzeKasse * 0.2); gs.schwarzeKasse -= z; gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return T(`${formatEuro(z)} weg. Risiko -10.`, `${formatEuro(z)} gone. Risk -10.`); }},
    optionB: { label: T('❌ Ablehnen', '❌ Decline'),
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 15, 0, 100); return T('Schulden laufen.', 'The debt keeps running.'); }}
  },
  {
    id: 'shark_08', kategorie: 'loan_shark',
    titel: T('🦈 Zins-Forderung 750 €', '🦈 Interest Demand 750 €'),
    text: T('Kreditgeber fordert 3 Monate Zinsen.', 'The loan shark demands 3 months of interest.'),
    optionA: { label: T('💸 Zahlen (-750 € Bargeld)', '💸 Pay (-750 € cash)'),
      effekt(gs) { const ausL = Math.min(750, gs.losesBargeld); gs.losesBargeld -= ausL; gs.schwarzeKasse = Math.max(0, gs.schwarzeKasse - (750 - ausL)); return T('Bezahlt.', 'Paid.'); }},
    optionB: { label: T('🤬 Bestreiten (Risiko +20)', '🤬 Dispute it (Risk +20)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster + 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); return T('Eskalation. Nachbarn aufmerksam.', 'Escalation. The neighbours are taking notice.'); }}
  },
  {
    id: 'shark_09', kategorie: 'loan_shark',
    titel: T('🦈 Sofortkredit: +1000 €', '🦈 Instant Loan: +1000 €'),
    text: T('1000 € jetzt gegen 1500 € in 4 Wochen.', '1000 € now for 1500 € in 4 weeks.'),
    optionA: { label: T('✅ Annehmen (+1000 € loses Bargeld)', '✅ Accept (+1000 € loose cash)'),
      effekt(gs) { gs.losesBargeld += 1000; gs.risikoProMonat = clamp(gs.risikoProMonat + 5, 0, 100); return T('Geld da. Rückzahlung drückt.', 'Money in hand. The repayment weighs on you.'); }},
    optionB: { label: T('❌ Ablehnen', '❌ Decline'),
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 5, 0, 100); return T('Abgelehnt.', 'Declined.'); }}
  },
  {
    id: 'shark_10', kategorie: 'loan_shark',
    titel: T('🦈 Kreditgeber verhaftet', '🦈 Loan Shark Arrested'),
    text: T('Kreditgeber festgenommen. Unterlagen beschlagnahmt.', 'Loan shark arrested. Documents seized.'),
    optionA: { label: T('😅 Abwarten (Risiko -10)', '😅 Wait it out (Risk -10)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 10, 0, 100); return T('Schulden de facto erloschen.', 'Debt effectively wiped out.'); }},
    optionB: { label: T('🤝 Polizei-Aussage (Risiko -20)', '🤝 Statement to police (Risk -20)'),
      effekt(gs) { gs.risikoRaster = clamp(gs.risikoRaster - 20, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100); return T('Teilimmunität erhalten.', 'Partial immunity granted.'); }}
  },
  // BEZIEHUNGS-EVENTS
  {
    id: 'beziehung_01', kategorie: 'beziehung',
    titel: T('💔 Partnerin enttäuscht', '💔 Partner Disappointed'),
    text: T('Sie fragt, ob du wirklich suchst.', 'She asks whether you are really looking for work.'),
    optionA: { label: T('🤝 Ehrlich sein (Partner +15, E -10)', '🤝 Be honest (Partner +15, Energy -10)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 15, 0, 100); gs.energie = clamp(gs.energie - 10, 0, 100); pruefeEheKrise(); return T('Schwieriges, ehrliches Gespräch.', 'A difficult, honest conversation.'); }},
    optionB: { label: T('🎭 Lügen (Partner -5)', '🎭 Lie (Partner -5)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 5, 0, 100); pruefeEheKrise(); return T('Misstrauen wächst.', 'Distrust grows.'); }}
  },
  {
    id: 'beziehung_02', kategorie: 'beziehung',
    titel: T('🌹 Romantischer Abend', '🌹 Romantic Evening'),
    text: T('Sie schlägt ein gutes Restaurant vor.', 'She suggests a nice restaurant.'),
    optionA: { label: T('🍽️ Einladen (-300 €, Partner +25)', '🍽️ Treat her (-300 €, Partner +25)'),
      effekt(gs) { if (gs.kontostand >= 300 || gs.schwarzeKasse >= 300) { if (gs.schwarzeKasse >= 300) gs.schwarzeKasse -= 300; else gs.kontostand -= 300; gs.happinessPartner = clamp(gs.happinessPartner + 25, 0, 100); return T('Wunderschöner Abend.', 'A wonderful evening.'); } return T('Kein Geld.', 'No money.'); }},
    optionB: { label: T('🍕 Zu Hause (Partner +5)', '🍕 Stay in (Partner +5)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100); return T('Gemütlich.', 'Cozy.'); }}
  },
  {
    id: 'beziehung_03', kategorie: 'beziehung',
    titel: T('😡 Geld-Streit', '😡 Money Fight'),
    text: T('Heftiger Streit über Finanzen.', 'A heated argument over finances.'),
    optionA: { label: T('💬 Offen reden (Partner +10, E -15)', '💬 Talk it out (Partner +10, Energy -15)'),
      effekt(gs) { gs.energie = clamp(gs.energie - 15, 0, 100); gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100); pruefeEheKrise(); return T('Schwieriges Gespräch.', 'A difficult conversation.'); }},
    optionB: { label: T('🚶 Rausgehen (Partner -10)', '🚶 Walk out (Partner -10)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 10, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100); pruefeEheKrise(); return T('Spannung ungelöst.', 'Tension unresolved.'); }}
  },
  {
    id: 'beziehung_05', kategorie: 'beziehung',
    titel: T('🎂 Jahrestag vergessen', '🎂 Forgot the Anniversary'),
    text: T('Sie wartet schweigend.', 'She waits in silence.'),
    optionA: { label: T('🌹 Blumen kaufen (-80 €, Partner +15)', '🌹 Buy flowers (-80 €, Partner +15)'),
      effekt(gs) { if (gs.schwarzeKasse >= 80) gs.schwarzeKasse -= 80; else gs.kontostand = Math.max(0, gs.kontostand - 80); gs.happinessPartner = clamp(gs.happinessPartner + 15, 0, 100); return T('Entschuldigt.', 'Forgiven.'); }},
    optionB: { label: T('😅 Ohne Geschenk (Partner -5)', '😅 No gift (Partner -5)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 5, 0, 100); return T('Halbwegs verziehen.', 'Half forgiven.'); }}
  },
  {
    id: 'beziehung_06', kategorie: 'beziehung',
    titel: T('🏠 Drohung auszuziehen', '🏠 Threat to Move Out'),
    text: T('Zu viel Belastung.', 'Too much strain.'),
    optionA: { label: T('❤️ Paartherapie (-400 €, Partner +30)', '❤️ Couples therapy (-400 €, Partner +30)'),
      effekt(gs) { gs.kontostand = Math.max(0, gs.kontostand - 400); gs.happinessPartner = clamp(gs.happinessPartner + 30, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 15, 0, 100); return T('Teuer aber wirksam.', 'Expensive but effective.'); }},
    optionB: { label: T('😶 Nichts tun (Partner -30)', '😶 Do nothing (Partner -30)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 30, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 20, 0, 100); pruefeEheKrise(); return T('Sie geht zur Schwester.', 'She goes to stay with her sister.'); }}
  },
  {
    id: 'beziehung_07', kategorie: 'beziehung',
    titel: T('🎉 Freunde kommen', '🎉 Friends Drop By'),
    text: T('Spontaner Besuch, wollen feiern.', 'A spontaneous visit, they want to party.'),
    optionA: { label: T('🍺 Party (-150 €, Laune +20)', '🍺 Party (-150 €, Mood +20)'),
      effekt(gs) { if (gs.schwarzeKasse >= 150) gs.schwarzeKasse -= 150; else gs.kontostand = Math.max(0, gs.kontostand - 150); gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100); gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100); return T('Unvergesslicher Abend.', 'An unforgettable evening.'); }},
    optionB: { label: T('🙁 Absagen (Laune -5)', '🙁 Cancel (Mood -5)'),
      effekt(gs) { gs.happinessSpieler = clamp(gs.happinessSpieler - 5, 0, 100); return T('Vernünftig aber schade.', 'Sensible but a shame.'); }}
  },
  {
    id: 'beziehung_08', kategorie: 'beziehung',
    titel: T('💍 Heiratsantrag', '💍 Marriage Proposal'),
    text: T('"Gemeinsam durch alles."', '"Through everything, together."'),
    optionA: { label: T('💍 Ja sagen (Partner +40, E -20)', '💍 Say yes (Partner +40, Energy -20)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 40, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 30, 0, 100); gs.energie = clamp(gs.energie - 20, 0, 100); return T('Ja gesagt. Freude.', 'Said yes. Joy.'); }},
    optionB: { label: T('😰 Noch nicht (Partner -25)', '😰 Not yet (Partner -25)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 25, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler - 10, 0, 100); pruefeEheKrise(); return T('Schwere Stille.', 'A heavy silence.'); }}
  },
  {
    id: 'beziehung_09', kategorie: 'beziehung',
    titel: T('💌 Brief vom Ex', '💌 Letter from the Ex'),
    text: T('"Frisch anfangen?"', '"Start fresh?"'),
    optionA: { label: T('💬 Treffen (Partner -15)', '💬 Meet up (Partner -15)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner - 15, 0, 100); gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100); pruefeEheKrise(); return T('Sie erfährt es.', 'She finds out.'); }},
    optionB: { label: T('🚫 Ablehnen (Partner +5)', '🚫 Decline (Partner +5)'),
      effekt(gs) { gs.happinessPartner = clamp(gs.happinessPartner + 5, 0, 100); return T('Richtige Entscheidung.', 'The right call.'); }}
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

/** Triumphierende Fanfare beim Rubbellos-Gewinn (Blechbläser-Arpeggio) */
function soundFanfare() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // C5 – E5 – G5 – C6, mit kurzem Schmettern (zwei Wellenformen übereinander)
  const noten = [523.3, 659.3, 784.0, 1046.5];
  noten.forEach((f, i) => {
    const t = now + i * 0.12;
    playTone(f, 'sawtooth', t, 0.22, 0.22, 0.01, 0.10);
    playTone(f, 'square',   t, 0.22, 0.10, 0.01, 0.10);
  });
  // Schlussakkord
  const tEnd = now + noten.length * 0.12;
  [523.3, 659.3, 784.0, 1046.5].forEach(f => playTone(f, 'sawtooth', tEnd, 0.45, 0.14, 0.01, 0.25));
}

/** Kurzer, harter „Stempel"-Knall (für den NIETE-Stempel) */
function soundStempel() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.connect(g); g.connect(audioCtx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  osc.start(now); osc.stop(now + 0.18);
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
function randomEventIntervall() { return 90 + Math.random() * 90; }   // 90–180 s (echte Zeit, unabhängig vom Tempo)

// Hat der Spieler überhaupt schon etwas Illegales/Auffälliges getan?
// Behörden-/Ermittlungs-Events (Finanzamt, Staatsanwalt, Prüfungen …) sollen
// NICHT kommen, wenn man gerade erst sauber startet.
function spielerIstKriminell(gs = gameState) {
  return !!(gs.hatSchwarzgearbeitet || (gs.schwarzeKasse || 0) > 0 || (gs.scheinbewerbungen || 0) > 0
    || gs.ernaehrungFake || (gs.kindergeldKinder && gs.kindergeldKinder.length > 0)
    || (gs.suchtStufe || 0) > 0 || (gs.loanSharkSchuld || 0) > 0 || (gs.strafStufe || 0) > 0
    || (gs.risikoRaster || 0) > 20);
}

function waehleEvent() {
  const gs = gameState;
  const kriminell = spielerIstKriminell(gs);
  // Behörden-Events erst zulassen, wenn der Spieler auffällig/kriminell ist
  const erlaubt = e => (!e.bedingung || e.bedingung(gs)) && (e.kategorie !== 'behoerde' || kriminell);
  const behoerden  = eventDatabase.filter(e => e.kategorie === 'behoerde' && erlaubt(e));

  // Loan-Shark-Events NUR wenn Schulden vorhanden; Events mit Bedingung filtern
  let verfuegbar = (gs.loanSharkSchuld > 0
    ? eventDatabase
    : eventDatabase.filter(e => e.kategorie !== 'loan_shark')).filter(erlaubt);

  // Bei hohem Risiko → Behörden-Events bevorzugt
  if (gs.risikoRaster >= 90 && Math.random() < 0.70 && behoerden.length)
    return behoerden[Math.floor(Math.random() * behoerden.length)];

  return verfuegbar[Math.floor(Math.random() * verfuegbar.length)];
}

function triggerEvent(event) {
  logEvent(T(`📨 "${event.titel}"`, `📨 "${event.titel}"`), event.kategorie === 'behoerde' ? 'danger' : 'warn');
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
  const kat = { behoerde: T('🏛️ Behörden','🏛️ Authorities'), loan_shark: T('🦈 Kreditgeber','🦈 Loan Shark'), beziehung: T('💑 Beziehung','💑 Relationship'), alltag: T('🎲 Alltag','🎲 Everyday') }[event.kategorie] || '📨';
  body.innerHTML = `
    <img src="assets/events/${event.id}.jpg" alt=""
         style="display:block;width:100%;height:170px;object-fit:cover;border-radius:10px;border:1px solid var(--border-hi);margin-bottom:10px;"
         onerror="this.style.display='none'">
    <p style="color:var(--text-dim);font-size:0.6rem;margin-bottom:8px;">${kat}</p>
    <p>${event.text}</p>
    <p style="margin-top:10px;color:var(--text-dim);font-size:0.65rem;">${T('Wähle eine Option:','Choose an option:')}</p>
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
  body.innerHTML = `<p style="color:var(--text-dim);font-size:0.6rem;">${T('Ergebnis:','Result:')}</p><p>${resultat}</p>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'action-btn primary'; closeBtn.textContent = T('✅ Weiter', '✅ Continue');
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

  // ---- Schwebende Status-Leiste oben (immer sichtbar) ----
  const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  _set('tb-energie', Math.round(gs.energie));
  _set('tb-gesund',  Math.round(gs.gesundheit));
  _set('tb-laune',   Math.round(gs.happinessSpieler));
  _set('tb-partner', Math.round(gs.happinessPartner));
  _set('tb-risiko',  Math.round(gs.risikoRaster));
  _set('tb-konto',   formatEuro(gs.kontostand));
  _set('tb-schwarz', formatEuro(gs.schwarzeKasse));
  _set('tb-bargeld', formatEuro(gs.losesBargeld));
  // Depot-Wert (live aus dem Depot) & Schulden – Pillen nur zeigen, wenn relevant
  const depotWertLive = (gs.depot || []).reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
  const schulden = gs.loanSharkSchuld || 0;
  _set('tb-depot',    formatEuro(depotWertLive));
  _set('tb-schulden', formatEuro(schulden));
  const _pillShow = (id, an) => { const el = document.getElementById(id); if (el) el.style.display = an ? 'inline-flex' : 'none'; };
  _pillShow('pill-depot',    depotWertLive > 0);
  _pillShow('pill-schulden', schulden > 0);
  _set('tb-staat',   formatEuro(gs.vomStaatGesamt || 0));
  _set('tb-zeit',    T(`M${gs.monat} W${gs.woche} T${gs.tag}`, `M${gs.monat} W${gs.woche} D${gs.tag}`));
  _set('tb-status',  gs.status === 'ALG1' ? T('ALG I', 'Welfare I') : T('ALG II', 'Welfare II'));
  const amtTage = Math.max(0, Math.round(gs.naechsterAmtsBesuch * 7 - (gs.tag - 1)));
  _set('tb-amt',     amtTage + T('T', 'd'));
  const essenTage = gs.lebensmittelTageRest || 0;
  _set('tb-essen',   essenTage > 0 ? essenTage + T('T', 'd') : T('leer', 'empty'));
  // Statische HUD-Labels (in der index.html deutsch) zur Laufzeit übersetzen
  const _setLbl = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
  _setLbl('.tb-staat-label', T('💀 VOM STAAT KASSIERT', '💀 MILKED FROM THE STATE'));
  _setLbl('#hud-vom-staat-label', T('💸 Vom Staat kassiert', '💸 Milked from the state'));

  // ---- Spielzeit (mm:ss / h:mm:ss) – wird bei neuem Spiel zurückgesetzt ----
  const sek = Math.floor(window._spielzeitSek || 0);
  const ss = String(sek % 60).padStart(2, '0');
  const min = Math.floor(sek / 60);
  _set('tb-spielzeit', min >= 60
    ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}:${ss}`
    : `${min}:${ss}`);

  // ---- Warn-Blink bei kritischen Werten ----
  const warnPill = (id, kritisch) => {
    const el = document.getElementById(id);
    const pill = el && el.closest && el.closest('.tb-pill');
    if (pill) pill.classList.toggle('warn', !!kritisch);
  };
  warnPill('tb-energie', gs.energie          <= 20);
  warnPill('tb-gesund',  gs.gesundheit       <= 25);
  warnPill('tb-laune',   gs.happinessSpieler <= 20);
  warnPill('tb-partner', gs.happinessPartner <= 20);
  warnPill('tb-amt',     amtTage             <= 3);
  warnPill('tb-konto',   gs.kontostand       <= 500);
  warnPill('tb-essen',   essenTage           <= 3);

  // ---- Zeit (Monat / Woche / Tag) ----
  const zeitEl = document.getElementById('hud-zeit');
  if (zeitEl) zeitEl.textContent = T(`M${gs.monat}  W${gs.woche}  T${gs.tag}`, `M${gs.monat}  W${gs.woche}  D${gs.tag}`);
  const clock = document.getElementById('header-clock');
  if (clock) clock.textContent = T(`Monat ${gs.monat} · Woche ${gs.woche} · Tag ${gs.tag}`, `Month ${gs.monat} · Week ${gs.woche} · Day ${gs.tag}`);

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
                            : verbleibendeTage <= 5 ? '#e8a84b'  // 5-Tage-Fenster: Termin möglich
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
    const tage = gs.lebensmittelTageRest || 0;
    const lm = gs.lebensmittelDiesenMonat;
    if (tage > 0) {
      lmBar.style.width = Math.min(100, tage / 14 * 100) + '%';
      const farbe = lm === 'gut' ? '#4be87a' : lm === 'billig' ? '#e87a4b' : '#e8b84b';
      const ico   = lm === 'gut' ? '🥗' : lm === 'billig' ? '🍟' : '🥙';
      lmBar.style.background = farbe;
      lmVal.textContent = `${ico} ${tage} Tg`;
      lmVal.style.color = tage <= 3 ? '#e8924b' : farbe;
    } else {
      lmBar.style.width = '0%'; lmBar.style.background = '#e84b4b';
      lmVal.textContent = '⚠️ Leer!'; lmVal.style.color = '#e84b4b';
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
  closeBtn.textContent = T('✕ Schließen (ESC)', '✕ Close (ESC)');
  closeBtn.onclick = () => { if (item.schliessenCallback) item.schliessenCallback(); schliesseModal(); };
  body.appendChild(closeBtn);
  document.getElementById('modal-overlay').classList.add('active');
}

function schliesseModal() {
  modalOffen = false;
  window._modalClosedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  _modalNaechstes();   // ggf. nächstes wartendes Popup zeigen
}

// ================================================================
// SPENDEN-BETTLER  (freiwillige Unterstützung, KEINE Werbung)
// ----------------------------------------------------------------
// WICHTIG (Google-Play-Konformität): Die Spende schaltet NICHTS im Spiel
// frei und verschafft keinen Vorteil. Das Popup ist immer kostenlos
// wegklickbar und kann dauerhaft abgeschaltet werden ("Nicht mehr fragen").
// Dadurch ist KEIN Google Play Billing nötig – ein externer Spendenlink
// (PayPal.me / Ko-fi …) im Browser genügt.
// ================================================================
// Echter Spendenlink (PayPal.me) – freiwillige Unterstützung, schaltet nichts frei.
const SPENDEN_URL = 'https://paypal.me/findichsozial';

function oeffneSpende(betrag) {
  // betrag (z. B. '0.50') ist für später gedacht: paypal.me erlaubt
  // 'paypal.me/NAME/0.50'. Solange der Link ein Platzhalter ist, öffnen wir
  // einfach die Basis-URL. window.open(_blank) öffnet in Capacitor den
  // System-Browser.
  try { window.open(SPENDEN_URL, '_blank'); } catch (e) {}
}

function oeffneSpendenModal() {
  const html =
    `<img src="assets/bettler.png" alt="Bettler" ` +
    `style="width:130px;max-width:48%;display:block;margin:2px auto 12px;image-rendering:pixelated;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6));" ` +
    `onerror="this.style.display='none';var f=document.getElementById('bettler-fallback');if(f)f.style.display='block';">` +
    `<span id="bettler-fallback" style="display:none;font-size:72px;text-align:center;">🧎</span>` +
    `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#d6ceb4;">` +
    `Dieses Spiel ist <b>komplett kostenlos</b> und kommt ganz ohne Werbung aus.<br>` +
    `Es lebt nur von freiwilligen Spenden. Schon <b>50 Cent</b> helfen – ` +
    `aber natürlich freut sich der Bettler über jeden Betrag. ` +
    `Das tut keinem weh und hält das Projekt am Leben. Danke! ❤️</span>`;
  oeffneModal("Haste ma 'n Euro?", html, [
    { label: '❤️  Spenden', primary: true, callback: () => oeffneSpende() },
    { label: 'Nicht mehr fragen', callback: () => { gameState.bettlerAus = true; try { localStorage.setItem('spende_aus', '1'); } catch (e) {} } },
  ]);
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
// ================================================================
// GOLD: Kauf/Verkauf in Tranchen (wie Aktiendepot)
// ================================================================
const GOLD_PREIS = 500;
function goldKaufen(n) {
  const gs = gameState;
  const maxN = Math.floor((gs.losesBargeld + gs.kontostand) / GOLD_PREIS);
  n = Math.min(n, maxN);
  if (n <= 0) { logEvent(T('⚠️ Nicht genug Geld für Gold.', '⚠️ Not enough money for gold.'), 'warn'); return; }
  let rest = n * GOLD_PREIS;
  const ausLose = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= ausLose; rest -= ausLose;
  gs.kontostand -= rest;
  gs.goldBarren += n;
  logEvent(T(`🥇 ${n} Goldbarren gekauft (${formatEuro(n * GOLD_PREIS)}) – im Garten vergraben.`, `🥇 Bought ${n} gold bars (${formatEuro(n * GOLD_PREIS)}) – buried in the garden.`), 'good');
  soundGeld && soundGeld();
  updateHUD();
  oeffneGoldKaufMenu();   // Menü offen halten (wie Depot)
}
function oeffneGoldKaufMenu() {
  const gs = gameState;
  const maxN = Math.floor((gs.losesBargeld + gs.kontostand) / GOLD_PREIS);
  if (maxN <= 0) {
    oeffneModal(T('🥇 Goldbarren kaufen', '🥇 Buy Gold Bars'), T(`Du brauchst mindestens ${formatEuro(GOLD_PREIS)} (Bargeld oder Konto) für einen Barren.`, `You need at least ${formatEuro(GOLD_PREIS)} (cash or account) for one bar.`), []);
    return;
  }
  const tranchen = [1, 5, 10, 25, 50].filter(x => x <= maxN);
  if (!tranchen.includes(maxN)) tranchen.push(maxN);
  const aktionen = tranchen.map(x => ({ label: T(`🥇 ${x} Barren (${formatEuro(x * GOLD_PREIS)})`, `🥇 ${x} bars (${formatEuro(x * GOLD_PREIS)})`), callback: () => goldKaufen(x) }));
  oeffneModal(T('🥇 Goldbarren kaufen', '🥇 Buy Gold Bars'),
    T(`Preis: <strong>${formatEuro(GOLD_PREIS)}</strong>/Barren (Bargeld zuerst, dann Konto). Bezahlbar: max. <strong>${maxN}</strong>. Bereits vergraben: <strong>${gs.goldBarren || 0}</strong>.`,
    `Price: <strong>${formatEuro(GOLD_PREIS)}</strong>/bar (cash first, then account). Affordable: max. <strong>${maxN}</strong>. Already buried: <strong>${gs.goldBarren || 0}</strong>.`),
    aktionen);
}
function goldVerkaufen(n) {
  const gs = gameState;
  n = Math.min(n, gs.goldBarren || 0);
  if (n <= 0) { logEvent(T('⚠️ Kein Gold vorhanden.', '⚠️ No gold available.'), 'warn'); return; }
  const erloes = n * GOLD_PREIS;
  gs.goldBarren -= n;
  gs.losesBargeld += erloes;
  logEvent(T(`🥇 ${n} Goldbarren ausgegraben & verkauft: +${formatEuro(erloes)} loses Bargeld.`, `🥇 Dug up & sold ${n} gold bars: +${formatEuro(erloes)} loose cash.`), 'good');
  soundGeld && soundGeld();
  updateHUD();
  if (gs.goldBarren > 0) oeffneGoldVerkaufMenu();
}
function oeffneGoldVerkaufMenu() {
  const gs = gameState;
  if ((gs.goldBarren || 0) <= 0) { oeffneModal(T('🥇 Gold verkaufen', '🥇 Sell Gold'), T('Du hast kein Gold im Garten vergraben.', 'You have no gold buried in the garden.'), []); return; }
  const tranchen = [1, 5, 10, 25].filter(x => x <= gs.goldBarren);
  const aktionen = tranchen.map(x => ({ label: T(`🥇 ${x} Barren verkaufen (${formatEuro(x * GOLD_PREIS)})`, `🥇 Sell ${x} bars (${formatEuro(x * GOLD_PREIS)})`), callback: () => goldVerkaufen(x) }));
  aktionen.push({ label: T(`🥇 Alle ${gs.goldBarren} verkaufen (${formatEuro(gs.goldBarren * GOLD_PREIS)})`, `🥇 Sell all ${gs.goldBarren} (${formatEuro(gs.goldBarren * GOLD_PREIS)})`), primary: true, callback: () => goldVerkaufen(gs.goldBarren) });
  oeffneModal(T('🥇 Goldbarren verkaufen', '🥇 Sell Gold Bars'), T(`Im Garten vergraben: <strong>${gs.goldBarren} Barren</strong> (${formatEuro(gs.goldBarren * GOLD_PREIS)}).`, `Buried in the garden: <strong>${gs.goldBarren} bars</strong> (${formatEuro(gs.goldBarren * GOLD_PREIS)}).`), aktionen);
}

function interact(ortId) {
  const ort = ORTE_CONFIG.find(o => o.id === ortId);
  if (!ort) return;
  const gs = gameState;

  // Arbeitsamt: erst Wartenummer ziehen / dran sein, bevor das Menü aufgeht.
  if (ortId === 'arbeitsamt') {
    const sz = window._phaserGameRef && window._phaserGameRef.scene.getScene('SpielSzene');
    if (sz && typeof sz.amtInteraktion === 'function' && !sz.amtInteraktion()) return;
  }

  const villaBewohnt = !!(gs.immobilie && gs.immobilie.modus === 'eigen');

  // Villa nur bewohnbar, wenn die Immobilie selbst genutzt wird
  if (ortId === 'villa' && !villaBewohnt) {
    oeffneModal(T('🏖️ Leeres Baugrundstück', '🏖️ Empty Building Plot'),
      T('Hier könnte deine Villa stehen!<br><br>'
      + 'Kaufe bei der <strong>Schattenbank</strong> eine Immobilie und stelle sie auf <strong>Eigennutzung</strong> – dann ziehst du hier ein.',
      'Your villa could stand right here!<br><br>'
      + 'Buy a property at the <strong>Shadow Bank</strong> and set it to <strong>owner-occupied</strong> – then you move in here.'), []);
    return;
  }
  // Nach Einzug in die Villa ist die alte Wohnung verlassen
  if (ortId === 'wohnung' && villaBewohnt) {
    oeffneModal(T('🏠 Hier wohnst du nicht mehr', '🏠 You no longer live here'),
      T('Du bist in deine <strong>Villa</strong> gezogen.<br><br>'
      + 'Dein ganzes Zuhause – Schlafen, Verstecken, Anträge, Sozialbetrug – ist jetzt dort.',
      'You have moved into your <strong>villa</strong>.<br><br>'
      + 'Your entire home – sleeping, stashing, benefit claims, welfare fraud – is now there.'), []);
    return;
  }

  // Wirksame Aktionsliste: in der bewohnten Villa = alle Wohnungs-Features + Luxus
  let quellAktionen = ort.aktionen;
  if (ortId === 'villa' && villaBewohnt) {
    const wohnung = ORTE_CONFIG.find(o => o.id === 'wohnung');
    quellAktionen = wohnung.aktionen.concat(ort.aktionen);
  }

  const aktionen = quellAktionen.map(a => {
    // Dynamische Labels für kontextabhängige Infos
    let label = a.label;
    if (ortId === 'loanshark' && a.id === 'schulden_zahlen') {
      const schulden = gs.loanSharkSchuld || 0;
      label = schulden > 0
        ? T(`💸  Schulden zurückzahlen (aktuell: ${formatEuro(schulden)})`, `💸 Repay debt (currently: ${formatEuro(schulden)})`)
        : T('💸  Schulden zurückzahlen (keine Schulden)', '💸 Repay debt (no debt)');
    }
    if (ortId === 'supermarkt' && a.id === 'geschenk') {
      const bereits = gs.geschenkeSumme || 0;
      label = T(`🎁  Geschenk kaufen (500€ · bereits: ${formatEuro(bereits)} / 1.000€)`, `🎁 Buy a gift (500€ · so far: ${formatEuro(bereits)} / 1,000€)`);
    }
    if (ortId === 'bank' && a.id === 'einzahlen') {
      const limit  = 200;
      const uebrig = limit - (gs.bankEinzahlungDieseWoche || 0);
      label = T(`💳  Bargeld einzahlen → Konto (Limit: ${formatEuro(Math.max(0,uebrig))}/Woche)`, `💳 Deposit cash → account (limit: ${formatEuro(Math.max(0,uebrig))}/week)`);
    }
    // Pfandleiher: Verpfänden ⇄ Auslösen je nach Zustand
    if (ortId === 'pawn' && a.id.startsWith('pfand_')) {
      const itemId = a.id.slice(6);
      const item   = PFAND_ITEMS[itemId];
      if (item) {
        if (gs.verpfaendet[itemId]) {
          const kosten = Math.round(item.wert * PFAND_ZINS);
          label = T(`${item.name} auslösen (${formatEuro(kosten)} · +25% Zins)`, `Redeem ${item.name} (${formatEuro(kosten)} · +25% interest)`);
        } else {
          label = T(`${item.name} verpfänden (+${formatEuro(item.wert)} → Konto, Laune −${item.laune})`, `Pawn ${item.name} (+${formatEuro(item.wert)} → account, Mood −${item.laune})`);
        }
      }
    }
    if (ortId === 'pawn' && a.id === 'gold_verkaufen') {
      const n = gs.goldBarren || 0;
      label = T(`🥇  Gold ausgraben & verkaufen (${n} Barren · ${formatEuro(n * 500)})`, `🥇 Dig up & sell gold (${n} bars · ${formatEuro(n * 500)})`);
    }
    if (ortId === 'villa' && a.id === 'villa_einlieger') {
      label = gs.einliegerVermietet
        ? T(`🚪  Einliegerwohnung vermietet (+${formatEuro(EINLIEGER_MIETE)}/M schwarz) – kündigen`, `🚪 Granny flat rented out (+${formatEuro(EINLIEGER_MIETE)}/mo off the books) – cancel`)
        : T(`🚪  Einliegerwohnung schwarz vermieten (+${formatEuro(EINLIEGER_MIETE)}/M)`, `🚪 Rent out granny flat off the books (+${formatEuro(EINLIEGER_MIETE)}/mo)`);
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
      label = T(`🚀  Einstiegsgeld  ✅ läuft (noch ${gs.einstiegsgeldMonate} Monate · +${EINSTIEGSGELD_BETRAG} €/M)`, `🚀 Start-up grant ✅ active (${gs.einstiegsgeldMonate} months left · +${EINSTIEGSGELD_BETRAG} €/mo)`);
    }
    if (ortId === 'supermarkt' && a.id === 'minijob') {
      label = gs.minijobLohn > 0
        ? T(`💼  Minijob aktiv (${formatEuro(gs.minijobLohn)}/M · ändern/kündigen)`, `💼 Mini-job active (${formatEuro(gs.minijobLohn)}/mo · change/quit)`)
        : T('💼  Minijob annehmen (legales Einkommen mit Freibetrag)', '💼 Take a mini-job (legal income with allowance)');
    }
    if (ortId === 'schattenbank' && a.id === 'unterhalts_tarnung') {
      label = gs.unterhaltsTarnung
        ? T('🌍  Unterhalts-Tarnung AKTIV (abschalten)', '🌍 Support cover-up ACTIVE (turn off)')
        : T('🌍  Unterhalts-Tarnung aktivieren (Auslands-Kindergeld behalten)', '🌍 Activate support cover-up (keep foreign child benefit)');
    }
    if (ortId === 'schattenbank' && a.id === 'immo_kaufen' && gs.immobilie) {
      const rs = gs.immobilie.restSchuld || 0;
      label = T(`🏘️  Immobilie: Wert ${formatEuro(gs.immobilie.wert)}${rs > 0 ? ` · Restschuld ${formatEuro(rs)}` : ' · schuldenfrei'}`, `🏘️ Property: value ${formatEuro(gs.immobilie.wert)}${rs > 0 ? ` · balance ${formatEuro(rs)}` : ' · debt-free'}`);
    }
    if (ortId === 'schattenbank' && a.id === 'immo_modus' && gs.immobilie) {
      label = gs.immobilie.modus === 'eigen'
        ? T('🔑  Modus: Eigennutzung → auf Vermieten umschalten', '🔑 Mode: own use → switch to renting')
        : T('🔑  Modus: Vermietet → auf Eigennutzung umschalten', '🔑 Mode: rented → switch to own use');
    }
    if (ortId === 'schattenbank' && a.id === 'immo_tilgen' && gs.immobilie) {
      const rs = gs.immobilie.restSchuld || 0;
      label = rs > 0 ? T(`🏦  Sofort tilgen (Restschuld ${formatEuro(rs)})`, `🏦 Pay off now (balance ${formatEuro(rs)})`) : T('🏦  Bereits schuldenfrei', '🏦 Already debt-free');
    }
    if (ortId === 'schattenbank' && a.id === 'immo_verkaufen' && gs.immobilie) {
      const netto = Math.max(0, Math.round(gs.immobilie.wert) - (gs.immobilie.restSchuld || 0));
      label = T(`💰  Immobilie verkaufen (netto ${formatEuro(netto)} → Schwarzkasse)`, `💰 Sell property (net ${formatEuro(netto)} → slush fund)`);
    }
    if (ortId === 'schattenbank' && a.id === 'depot_verschleiern') {
      label = gs.depotVerschleiert
        ? T('📈  Depot verschleiert AKTIV (wieder offiziell machen)', '📈 Portfolio hidden ACTIVE (make official again)')
        : T('📈  Depot verschleiern (Amt-unsichtbar, 5%/Monat)', '📈 Hide portfolio (invisible to office, 5%/mo)');
    }
    if ((ortId === 'wohnung' || ortId === 'villa') && a.id === 'anwalt') {
      label = (gs.strafStufe || 0) > 0
        ? T(`⚖️  Anwalt anrufen (Status: ${strafStufeName(gs.strafStufe)})`, `⚖️ Call a lawyer (status: ${strafStufeName(gs.strafStufe)})`)
        : T('⚖️  Anwalt anrufen (keine Probleme)', '⚖️ Call a lawyer (no problems)');
    }
    if ((ortId === 'wohnung' || ortId === 'villa') && a.id === 'auswandern') {
      const v = gesamtVermoegen();
      label = v >= AUSWANDERN_GRENZE
        ? T('✈️  AUSWANDERN – du kannst gewinnen!', '✈️ EMIGRATE – you can win!')
        : T(`✈️  Auswandern (${formatEuro(v)} / ${formatEuro(AUSWANDERN_GRENZE)})`, `✈️ Emigrate (${formatEuro(v)} / ${formatEuro(AUSWANDERN_GRENZE)})`);
    }
    if (ortId === 'arbeitsamt' && a.id === 'sachbearbeiter') {
      label = gs.sachbearbeiterBestochen
        ? T('🤝  Sachbearbeiter geschmiert AKTIV (beenden)', '🤝 Caseworker bribed ACTIVE (stop)')
        : T('🤝  Sachbearbeiter schmieren (150 €/M)', '🤝 Bribe caseworker (150 €/mo)');
    }
    // Kur (jetzt am Arbeitsamt) / Schein-WG / Umzug
    if (a.id === 'kur') {
      label = gs.monat < gs.kurCooldownMonat
        ? T(`🏖️  Kur (erst wieder ab Monat ${gs.kurCooldownMonat})`, `🏖️ Spa cure (again from month ${gs.kurCooldownMonat})`)
        : T('🏖️  Kur beantragen (volle Erholung)', '🏖️ Apply for spa cure (full recovery)');
    }
    if ((ortId === 'wohnung' || ortId === 'villa') && a.id === 'scheinwg') {
      label = gs.scheinWG
        ? T('🏠  Schein-WG AKTIV (abmelden)', '🏠 Fake flatshare ACTIVE (deregister)')
        : T(`🏠  Schein-WG deklarieren (+${SCHEINWG_BETRAG} €/M, riskant)`, `🏠 Declare fake flatshare (+${SCHEINWG_BETRAG} €/mo, risky)`);
    }
    if ((ortId === 'wohnung' || ortId === 'villa') && a.id === 'umzug' && gs.kautionRest > 0) {
      label = T(`📦  Umzug (Kaution-Darlehen läuft: ${formatEuro(gs.kautionRest)})`, `📦 Move (deposit loan running: ${formatEuro(gs.kautionRest)})`);
    }
    // Arbeitsamt: Pauschalen Status
    if (ortId === 'arbeitsamt' && a.id === 'pausch_erstausstattung' && gs.pauschalen.erstausstattung) {
      label = T('🛋️  Erstausstattung Wohnung  ✅ bezogen', '🛋️ Home starter grant ✅ received');
    }
    if (ortId === 'arbeitsamt' && a.id === 'pausch_moebel' && gs.pauschalen.moebel) {
      label = T('🪑  Möbel/Schreibtisch fürs Kind  ✅ bezogen', '🪑 Furniture/desk for the kid ✅ received');
    }
    return { id: a.id, label, callback: () => aktionAusfuehren(ortId, a.id) };
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
    const tage = gs.lebensmittelTageRest || 0;
    const kap = gs.grosserKuehlschrank ? 14 : 7;
    const einkauf = gs.lebensmittelDiesenMonat;
    const qual = einkauf === 'gut' ? 'Bio 🥗' : einkauf === 'normal' ? 'Normal 🥙' : einkauf === 'billig' ? 'Billig 🍟' : '';
    beschreibung += tage > 0
      ? `<br><br>✅ Vorrat: <strong>${tage}/${kap} Tage</strong>${qual ? ` (${qual})` : ''}. Kosten pro Tag – es wird nur bis zur Kapazität (${kap} Tage) aufgefüllt.`
      : `<br><br>⚠️ <strong>Kühlschrank leer!</strong> Kapazität ${kap} Tage, Kosten pro Tag.`;
  }

  // Arbeitsamt: gegliedertes Menü (Pflichttermin · Scheinbewerbung · Anträge · Bestechung)
  if (ortId === 'arbeitsamt') {
    const byId = {}; aktionen.forEach(x => byId[x.id] = x);
    const pick = ids => ids.map(i => byId[i]).filter(Boolean);
    const top = pick(['pflichttermin', 'scheinbewerbung', 'kur']);
    top.push({ label: T('📂  Anträge & Förderungen …', '📂  Applications & Grants …'), callback: () => {
      oeffneModal(T('📂 Anträge & Förderungen', '📂 Applications & Grants'),
        T('Wähle einen Antrag. <br><span style="color:#9aa6b4;font-size:0.62rem;">Ernährungs-Mehrbedarf braucht ein Attest vom Arzt.</span>',
        'Pick an application. <br><span style="color:#9aa6b4;font-size:0.62rem;">The dietary extra benefit needs a doctor’s certificate.</span>'),
        pick(['mb_warmwasser', 'mb_alleinerziehend', 'mb_ernaehrung', 'mb_but',
              'pausch_erstausstattung', 'pausch_moebel', 'pausch_bekleidung', 'einstiegsgeld']));
    }});
    top.push(...pick(['sachbearbeiter']));
    oeffneModal(ort.name, beschreibung, top);
    return;
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
  const tagSek = ECHTZEIT_PRO_WOCHE / 7;
  const sz = window._phaserGameRef && window._phaserGameRef.scene.getScene('SpielSzene');
  // WICHTIG: update() leitet gs.tag aus zeitAkku ab und überschreibt es jeden Frame.
  // Deshalb müssen wir die ECHTE Zeit vorspulen, nicht gs.tag direkt setzen –
  // sonst „verfällt" der Tagessprung sofort wieder. update() zieht dann Tag/Woche/
  // Hunger (tagGewechselt) korrekt nach.
  if (sz && typeof sz.zeitAkku === 'number') {
    sz.zeitAkku += anzahl * tagSek;
  } else {
    for (let i = 0; i < anzahl; i++) { gs.tag++; if (gs.tag > 7) { gs.tag = 1; gs.woche++; } }
  }
  updateHUD();
}

// Kur / Sanatorium (volle Erholung, Cooldown 3 Monate) – jetzt am Arbeitsamt.
function kurBeantragen() {
  const gs = gameState;
  if (gs.monat < gs.kurCooldownMonat) {
    oeffneModal(T('🏖️ Noch keine neue Kur', '🏖️ No new spa cure yet'), T(`Erst ab Monat ${gs.kurCooldownMonat} bekommst du wieder eine Kur bewilligt.`, `Only from month ${gs.kurCooldownMonat} will another spa cure be approved.`), []);
    return;
  }
  const attestKosten = 300;
  oeffneModal(T('🏖️ Kur – nur mit Attest', '🏖️ Spa cure – certificate required'),
    T(`Eine Kur gibt's nur mit ärztlichem Attest. Ein <strong>gefälschtes Attest</strong> kostet <strong>${formatEuro(attestKosten)}</strong> und erhöht das Risiko (+12).<br><br>`, `A spa cure requires a doctor's certificate. A <strong>forged certificate</strong> costs <strong>${formatEuro(attestKosten)}</strong> and raises your Risk (+12).<br><br>`)
    + T('Dafür: 3 Wochen Reha auf Kassenkosten – du kommst topfit zurück (Energie & Gesundheit voll, Laune +20).', 'In return: 3 weeks of rehab on the public dime – you come back in top shape (Energy & Health full, Mood +20).'),
    [{ label: T(`🩺 Gefälschtes Attest besorgen (${formatEuro(attestKosten)})`, `🩺 Get a forged certificate (${formatEuro(attestKosten)})`), danger: true, callback: () => {
        if (gs.kontostand < attestKosten) { logEvent(T('⚠️ Nicht genug Geld fürs Attest.', '⚠️ Not enough money for the certificate.'), 'warn'); return; }
        gs.kontostand      -= attestKosten;
        gs.risikoRaster     = clamp(gs.risikoRaster + 12, 0, 100);
        gs.energie          = 100;
        gs.gesundheit       = 100;
        gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100);
        gs.kurCooldownMonat = gs.monat + 3;
        verbraucheTag(7);
        logEvent(T('🏖️ Kur (gefälschtes Attest): Energie & Gesundheit voll, Laune +20. Risiko +12.', '🏖️ Spa cure (forged certificate): Energy & Health full, Mood +20. Risk +12.'), 'warn');
        oeffneModal(T('🏖️ Ab in die Kur!', '🏖️ Off to the spa!'), T('Drei Wochen Reha auf Kassenkosten – topfit zurück. Das Bürgergeld lief unverändert weiter.', 'Three weeks of rehab on the public dime – back in top shape. Your welfare kept rolling in untouched.'), []);
      }}]);
}

function aktionAusfuehren(ortId, aktionsId) {
  const gs = gameState;

  // ---- ENERGIE-CHECK: Bei 0 Energie nur Schlafen erlaubt ----
  // (In der bewohnten Villa kommt die Schlafen-Aktion von der Wohnung → id 'schlafen';
  //  daher beide Schlaf-IDs erlauben, unabhängig vom Ort.)
  const istSchlafen = aktionsId === 'schlafen' || aktionsId === 'villa_schlafen';
  if (gs.energie <= 0 && !istSchlafen) {
    oeffneModal(T('😴 Völlig erschöpft!', '😴 Completely exhausted!'),
      T('Du hast <strong>0 Energie</strong> und kannst nichts mehr tun.<br><br>', 'You have <strong>0 energy</strong> and cannot do anything.<br><br>') +
      T('Geh nach Hause und schlafe, um wieder handlungsfähig zu sein!', 'Go home and sleep to get back on your feet!'),
      []
    );
    soundAlarm && soundAlarm();
    return;
  }

  // ---- Kur (jetzt am Arbeitsamt) – ortunabhängig behandeln ----
  if (aktionsId === 'kur') { kurBeantragen(); return; }

  // --- WOHNUNG (oder bewohnte Villa) ---
  if (ortId === 'wohnung' || ortId === 'villa') {
    if (aktionsId === 'kaufen_menu') {
      oeffneModal(T('🛒 Kaufen', '🛒 Buy'), T('Anschaffungen für dein Zuhause.', 'Purchases for your home.'), [
        { label: gs.grosserKuehlschrank
            ? T('🧊 Großer Kühlschrank ✅ vorhanden', '🧊 Large fridge ✅ owned')
            : T('🧊 Großer Kühlschrank (1.000 €) – Vorrats-Kapazität 14 statt 7 Tage', '🧊 Large fridge (1,000 €) – stock capacity 14 instead of 7 days'),
          callback: () => aktionAusfuehren(ortId, 'kauf_kuehlschrank') },
      ]);
      return;
    }
    if (aktionsId === 'kauf_kuehlschrank') {
      if (gs.grosserKuehlschrank) { oeffneModal(T('🧊 Schon vorhanden', '🧊 Already owned'), T('Du hast bereits einen großen Kühlschrank.', 'You already have a large fridge.'), []); return; }
      if (gs.kontostand < 1000) { oeffneModal(T('💸 Zu wenig Geld', '💸 Not enough money'), T('Der große Kühlschrank kostet <strong>1.000 €</strong> (vom Konto).', 'The large fridge costs <strong>1,000 €</strong> (from your account).'), []); return; }
      gs.kontostand -= 1000;
      gs.grosserKuehlschrank = true;
      logEvent(T('🧊 Großer Kühlschrank gekauft – Vorrats-Kapazität jetzt 14 statt 7 Tage.', '🧊 Large fridge bought – stock capacity now 14 instead of 7 days.'), 'good');
      oeffneModal(T('🧊 Großer Kühlschrank', '🧊 Large fridge'),
        T('Gekauft! Deine <strong>Vorrats-Kapazität steigt auf 14 Tage</strong> (statt 7) – ' +
        'du kannst auf einmal mehr einkaufen und musst seltener zum Supermarkt.', 'Bought! Your <strong>stock capacity rises to 14 days</strong> (instead of 7) – ' +
        'you can buy more at once and need to visit the supermarket less often.'), []);
      updateHUD();
      return;
    }
    if (aktionsId === 'schlafen') {
      // Basis-Energiegewinn
      let energieGewinn = 25;
      let schlafMeldung = T('💤 Geschlafen. ', '💤 Slept. ');

      // Bonus: Eigene Stimmung hoch → man schläft besser
      if (gs.happinessSpieler > 60) {
        energieGewinn += 10;
        schlafMeldung += T('+10 Bonus (gute Laune). ', '+10 bonus (good mood). ');
      }
      // Malus: Partnerstreit → schlechter Schlaf
      if (gs.happinessPartner < 40) {
        energieGewinn -= 5;
        schlafMeldung += T('-5 Malus (Streit mit Partner). ', '-5 penalty (fight with partner). ');
      }

      gs.energie = clamp(gs.energie + energieGewinn, 0, 100);
      verbraucheTag(1);
      schlafMeldung += T(`Energie +${energieGewinn}. 1 Tag vergangen.`, `Energy +${energieGewinn}. 1 day passed.`);
      logEvent(schlafMeldung, energieGewinn >= 25 ? 'good' : 'warn');
    }
    if (aktionsId === 'verstecken') {
      const b = Math.min(500, gs.kontostand);
      if (b <= 0) { logEvent(T('⚠️ Kein Geld zum Verstecken.', '⚠️ No money to hide.'), 'warn'); return; }
      gs.kontostand -= b; gs.schwarzeKasse += b;
      logEvent(T(`💵 ${formatEuro(b)} versteckt.`, `💵 ${formatEuro(b)} hidden.`), 'good');
    }
    if (aktionsId === 'holen') {
      const b = Math.min(500, gs.schwarzeKasse);
      if (b <= 0) { logEvent(T('⚠️ Schwarze Kasse leer.', '⚠️ Slush fund empty.'), 'warn'); return; }
      gs.schwarzeKasse -= b; gs.kontostand += b;
      logEvent(T(`💵 ${formatEuro(b)} aufs Konto.`, `💵 ${formatEuro(b)} to the account.`), 'good');
    }
    // ---- Kur / Sanatorium: volle Erholung, Cooldown 3 Monate ----
    if (aktionsId === 'kur') {
      if (gs.monat < gs.kurCooldownMonat) {
        oeffneModal(T('🏖️ Noch keine neue Kur', '🏖️ No new spa cure yet'), T(`Erst ab Monat ${gs.kurCooldownMonat} bekommst du wieder eine Kur bewilligt.`, `Only from month ${gs.kurCooldownMonat} will a spa cure be approved again.`), []);
        return;
      }
      const attestKosten = 300;
      oeffneModal(T('🏖️ Kur – nur mit Attest', '🏖️ Spa cure – only with a certificate'),
        T(`Eine Kur gibt's nur mit ärztlichem Attest. Ein <strong>gefälschtes Attest</strong> vom willigen Arzt kostet <strong>${formatEuro(attestKosten)}</strong> und erhöht das Risiko (+12).<br><br>`
        + 'Dafür: 3 Wochen Reha auf Kassenkosten – du kommst topfit zurück (Energie & Gesundheit voll, Laune +20).', `A spa cure is available only with a medical certificate. A <strong>forged certificate</strong> from a willing doctor costs <strong>${formatEuro(attestKosten)}</strong> and raises your risk (+12).<br><br>`
        + 'In return: 3 weeks of rehab at the health fund expense – you come back in top shape (Energy and Health full, Mood +20).'),
        [{ label: T(`🩺 Gefälschtes Attest besorgen (${formatEuro(attestKosten)})`, `🩺 Get a forged certificate (${formatEuro(attestKosten)})`), danger: true, callback: () => {
            if (gs.kontostand < attestKosten) { logEvent(T('⚠️ Nicht genug Geld fürs Attest.', '⚠️ Not enough money for the certificate.'), 'warn'); return; }
            gs.kontostand      -= attestKosten;
            gs.risikoRaster     = clamp(gs.risikoRaster + 12, 0, 100);
            gs.energie          = 100;
            gs.gesundheit       = 100;
            gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100);
            gs.kurCooldownMonat = gs.monat + 3;
            verbraucheTag(7);
            logEvent(T('🏖️ Kur (gefälschtes Attest): Energie & Gesundheit voll, Laune +20. Risiko +12.', '🏖️ Spa cure (forged certificate): Energy and Health full, Mood +20. Risk +12.'), 'warn');
            oeffneModal(T('🏖️ Ab in die Kur!', '🏖️ Off to the spa!'), T('Drei Wochen Reha auf Kassenkosten – topfit zurück. Das Bürgergeld lief unverändert weiter.', 'Three weeks of rehab at the health fund expense – back in top shape. Your welfare kept running unchanged.'), []);
          }}]);
      return;
    }
    // ---- Schein-WG: voller Single-Satz, aber Prüf-Risiko ----
    if (aktionsId === 'scheinwg') {
      if (gs.scheinWG) {
        gs.scheinWG = false;
        logEvent(T('🏠 Schein-WG abgemeldet.', '🏠 Fake flatshare deregistered.'), '');
        return;
      }
      if (gs.frauAusgezogen) {
        oeffneModal(T('🏠 Keine Mitbewohnerin', '🏠 No flatmate'), T('Eine Schein-WG kannst du nur deklarieren, solange eine Partnerin bei dir wohnt.', 'You can only declare a fake flatshare while a partner lives with you.'), []);
        return;
      }
      gs.scheinWG = true;
      oeffneModal(T('🏠 Schein-WG deklariert', '🏠 Fake flatshare declared'),
        T(`Du meldest die Beziehung als reine Wohngemeinschaft – beide behalten den vollen Single-Satz: <strong>+${SCHEINWG_BETRAG} €/Monat</strong>.<br><br>`
        + '⚠️ Risiko: bei der <strong>Jobcenter-Prüfung</strong> kommt der Außendienst zum unangekündigten Hausbesuch!', `You report the relationship as a pure flatshare – both keep the full single rate: <strong>+${SCHEINWG_BETRAG} €/mo</strong>.<br><br>`
        + '⚠️ Risk: during the <strong>Job Center audit</strong> the field service shows up for an unannounced home visit!'), []);
      logEvent(T(`🏠 Schein-WG aktiv: +${SCHEINWG_BETRAG} €/Monat (riskant).`, `🏠 Fake flatshare active: +${SCHEINWG_BETRAG} €/mo (risky).`), 'warn');
      return;
    }
    // ---- Umzug: einmalig Cash, dafür Kaution-Darlehen + schaltet Erstausstattung frei ----
    if (aktionsId === 'umzug') {
      if (gs.kautionRest > 0) {
        oeffneModal(T('📦 Darlehen läuft noch', '📦 Loan still running'), T(`Zahle erst das laufende Kaution-Darlehen (${formatEuro(gs.kautionRest)}) ab, bevor du wieder umziehst.`, `Pay off the running deposit loan (${formatEuro(gs.kautionRest)}) first before you move again.`), []);
        return;
      }
      const pauschale = 450;
      gs.kontostand += pauschale; staatGibt(pauschale);
      gs.kautionRest = 900;
      gs.umzugGemacht = true;
      gs.pauschalen.erstausstattung = false;   // neue Wohnung → Erstausstattung wieder beantragbar
      oeffneModal(T('📦 Umzug!', '📦 Moving!'),
        T(`Umzugs- & Renovierungspauschale: <strong>+${formatEuro(pauschale)}</strong> sofort.<br><br>`
        + `Die Mietkaution (${formatEuro(gs.kautionRest)}) ist ein Darlehen und wird in Raten von ${formatEuro(KAUTION_RATE)}/Monat abgezogen.<br><br>`
        + '💡 Tipp: Jetzt am Arbeitsamt die <strong>Erstausstattung Wohnung</strong> beantragen!', `Moving and renovation allowance: <strong>+${formatEuro(pauschale)}</strong> right away.<br><br>`
        + `The rent deposit (${formatEuro(gs.kautionRest)}) is a loan and is deducted in instalments of ${formatEuro(KAUTION_RATE)}/mo.<br><br>`
        + '💡 Tip: Now apply for the <strong>home starter package</strong> at the Job Center!'), []);
      logEvent(T(`📦 Umzug: +${formatEuro(pauschale)}, Kaution-Darlehen ${formatEuro(gs.kautionRest)}.`, `📦 Moving: +${formatEuro(pauschale)}, deposit loan ${formatEuro(gs.kautionRest)}.`), 'warn');
      return;
    }
    // ---- Anwalt / Strafverteidiger: Strafstufe anfechten ----
    if (aktionsId === 'anwalt') {
      if ((gs.strafStufe || 0) === 0) {
        oeffneModal(T('⚖️ Strafverteidiger', '⚖️ Defense lawyer'), T('Du hast aktuell keine juristischen Probleme. Melde dich, wenn gegen dich ermittelt wird.', 'You currently have no legal problems. Come back when there is an investigation against you.'), []);
        return;
      }
      const gebuehr = 2000 + 1500 * gs.strafStufe;
      oeffneModal(T('⚖️ Strafverteidiger', '⚖️ Defense lawyer'),
        T(`Aktueller Status: <strong>${strafStufeName(gs.strafStufe)}</strong>.<br><br>`
        + `Ein guter Anwalt kann die Stufe um eine senken – Honorar <strong>${formatEuro(gebuehr)}</strong>, Erfolgschance <strong>65 %</strong> (bei Misserfolg ist das Honorar weg).`, `Current status: <strong>${strafStufeName(gs.strafStufe)}</strong>.<br><br>`
        + `A good lawyer can lower the level by one – fee <strong>${formatEuro(gebuehr)}</strong>, success chance <strong>65 %</strong> (if it fails the fee is gone).`),
        [{ label: T(`⚖️ Beauftragen (${formatEuro(gebuehr)})`, `⚖️ Hire (${formatEuro(gebuehr)})`), primary: true, callback: () => {
            if (gs.kontostand < gebuehr) { logEvent(T('⚠️ Nicht genug Geld fürs Anwaltshonorar.', '⚠️ Not enough money for the lawyer fee.'), 'warn'); return; }
            gs.kontostand -= gebuehr;
            if (Math.random() < 0.65) {
              gs.strafStufe = Math.max(0, gs.strafStufe - 1);
              logEvent(T('⚖️ Anwalt erfolgreich – Strafe gemildert.', '⚖️ Lawyer succeeded – penalty reduced.'), 'good');
              oeffneModal(T('⚖️ Erfolg!', '⚖️ Success!'), T(`Dein Anwalt hat ganze Arbeit geleistet.<br><br>Neuer Status: <strong>${strafStufeName(gs.strafStufe)}</strong>.`, `Your lawyer did a thorough job.<br><br>New status: <strong>${strafStufeName(gs.strafStufe)}</strong>.`), []);
            } else {
              logEvent(T('⚖️ Anwalt gescheitert – Honorar futsch.', '⚖️ Lawyer failed – fee gone.'), 'danger');
              oeffneModal(T('⚖️ Entscheidung zu deinen Ungunsten', '⚖️ Decision against you'), T(`Das Gericht hat <strong>gegen dich</strong> entschieden. Das Honorar (${formatEuro(gebuehr)}) ist weg, der Status bleibt unverändert.`, `The court decided <strong>against you</strong>. The fee (${formatEuro(gebuehr)}) is gone, the status stays unchanged.`), []);
            }
            updateHUD();
          }}]);
      return;
    }
    // ---- Auswandern: Sieg ab AUSWANDERN_GRENZE Gesamtvermögen ----
    if (aktionsId === 'auswandern') {
      const v = gesamtVermoegen();
      if (v < AUSWANDERN_GRENZE) {
        oeffneModal(T('✈️ Auswandern', '✈️ Emigrate'),
          T(`Um dich endgültig abzusetzen, brauchst du <strong>${formatEuro(AUSWANDERN_GRENZE)}</strong> Gesamtvermögen (inkl. Gold, Schwarzkasse, Depot, Immobilie).<br><br>`
          + `Aktuell: <strong>${formatEuro(v)}</strong> – es fehlen noch <strong>${formatEuro(AUSWANDERN_GRENZE - v)}</strong>.`, `To disappear for good, you need <strong>${formatEuro(AUSWANDERN_GRENZE)}</strong> total wealth (incl. gold, slush fund, portfolio, property).<br><br>`
          + `Currently: <strong>${formatEuro(v)}</strong> – still missing <strong>${formatEuro(AUSWANDERN_GRENZE - v)}</strong>.`), []);
        return;
      }
      gs.gameOver = true;
      soundGut && soundGut();
      logEvent(T(`🏆 Ausgewandert mit ${formatEuro(v)} – gewonnen!`, `🏆 Emigrated with ${formatEuro(v)} – you won!`), 'good');
      zeigeGewonnen(v);
      return;
    }
    if (aktionsId === 'cheats_menu') { oeffneCheatMenu(); return; }
  }

  // --- ARBEITSAMT ---
  if (ortId === 'arbeitsamt') {
    if (aktionsId === 'pflichttermin') {
      const tageRest = Math.max(0, gs.naechsterAmtsBesuch * 7 - (gs.tag - 1));
      if (!gs.algGesperrt && tageRest > 5) {
        oeffneModal(T('📋 Termin noch nicht fällig', '📋 Appointment not due yet'),
          T(`Dein Pflichttermin ist erst in <strong>${tageRest} Tagen</strong>. `
          + 'Komm in den letzten 5 Tagen vor dem Termin vorbei – dann zählt er und die 14 Tage starten neu.', `Your mandatory appointment is only in <strong>${tageRest} days</strong>. `
          + 'Come in during the last 5 days before the appointment – then it counts and the 14 days restart.'), []);
        return;
      }
      // Termin wahrgenommen → ab HEUTE wieder volle 14 Tage.
      // Die Anzeige rechnet: naechsterAmtsBesuch*7 - (tag-1). Damit dabei
      // exakt 14 herauskommt (egal an welchem Wochentag man kommt), muss der
      // bereits vergangene Wochenanteil (tag-1) eingerechnet werden.
      gs.naechsterAmtsBesuch = 2 + (gs.tag - 1) / 7;
      gs.amtsTermineVerpasst = 0;
      gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100);
      if (gs.algGesperrt) {
        gs.algGesperrt = false;
        logEvent(T('✅ ALG-Sperre aufgehoben! Ab nächstem Monat wieder normale Zahlung. Risiko -5.', '✅ Benefit suspension lifted! Normal payment again from next month. Risk -5.'), 'good');
        oeffneModal(T('✅ Sperre aufgehoben!', '✅ Suspension lifted!'),
          T('Du hast das Amt besucht. Die ALG-Sperre ist aufgehoben.<br><br>'
          + 'Ab nächstem Monat erhältst du wieder normale Zahlungen.', 'You visited the office. The benefit suspension is lifted.<br><br>'
          + 'From next month you receive normal payments again.'), []);
      } else {
        logEvent(T('📋 Pflichttermin erledigt. Risiko -5.', '📋 Mandatory appointment done. Risk -5.'), 'good');
      }
    }
    if (aktionsId === 'scheinbewerbung') {
      gs.scheinbewerbungen++;
      gs.risikoRaster = clamp(gs.risikoRaster - 5, 0, 100);
      logEvent(T(`📝 Scheinbewerbung Nr.${gs.scheinbewerbungen}. Risiko -5.`, `📝 Sham application no.${gs.scheinbewerbungen}. Risk -5.`), 'good');
    }

    // ---- Mehrbedarf: Warmwasser (legal, ohne Bedingung) ----
    if (aktionsId === 'mb_warmwasser') {
      if (gs.mehrbedarf.warmwasser) { logEvent(T('ℹ️ Warmwasser-Mehrbedarf läuft bereits.', 'ℹ️ Hot water extra benefit is already running.'), ''); return; }
      gs.mehrbedarf.warmwasser = true;
      logEvent(T(`🚿 Warmwasser-Mehrbedarf bewilligt: +${MEHRBEDARF_BETRAG.warmwasser} €/Monat.`, `🚿 Hot water extra benefit approved: +${MEHRBEDARF_BETRAG.warmwasser} €/mo.`), 'good');
    }
    // ---- Mehrbedarf: Alleinerziehend (braucht ≥1 Kind) ----
    if (aktionsId === 'mb_alleinerziehend') {
      if (gs.mehrbedarf.alleinerziehend) { logEvent(T('ℹ️ Mehrbedarf Alleinerziehend läuft bereits.', 'ℹ️ Single parent extra benefit is already running.'), ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal(T('👨‍👧 Kein Kind gemeldet', '👨‍👧 No child registered'), T('Den Mehrbedarf für Alleinerziehende gibt es nur mit mindestens einem Kind. Hol dir erst über den Kindergeld-Trick (Wohnung → Sozialbetrug) ein Kind.', 'The single parent extra benefit is only available with at least one child. Get a child first via the child benefit trick (Home → Welfare fraud).'), []);
        return;
      }
      gs.mehrbedarf.alleinerziehend = true;
      logEvent(T(`👨‍👧 Mehrbedarf Alleinerziehend bewilligt: +${MEHRBEDARF_BETRAG.alleinerziehend} €/Monat.`, `👨‍👧 Single parent extra benefit approved: +${MEHRBEDARF_BETRAG.alleinerziehend} €/mo.`), 'good');
    }
    // ---- Bildung & Teilhabe (braucht ≥1 Kind) ----
    if (aktionsId === 'mb_but') {
      if (gs.mehrbedarf.but) { logEvent(T('ℹ️ Bildung & Teilhabe läuft bereits.', 'ℹ️ Education and participation is already running.'), ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal(T('🎒 Kein Kind gemeldet', '🎒 No child registered'), T('Bildung & Teilhabe gibt es nur für gemeldete Kinder.', 'Education and participation is only available for registered children.'), []);
        return;
      }
      gs.mehrbedarf.but = true;
      logEvent(T(`🎒 Bildung & Teilhabe bewilligt: +${MEHRBEDARF_BETRAG.but} €/Monat.`, `🎒 Education and participation approved: +${MEHRBEDARF_BETRAG.but} €/mo.`), 'good');
    }
    // ---- Ernährungs-Mehrbedarf: echtes oder gefälschtes Attest ----
    if (aktionsId === 'mb_ernaehrung') {
      if (gs.mehrbedarf.ernaehrung) { logEvent(T('ℹ️ Ernährungs-Mehrbedarf läuft bereits.', 'ℹ️ Dietary extra benefit is already running.'), ''); return; }
      const aktionen = [];
      if (gs.ernaehrungAttest) {
        aktionen.push({ label: T('🩺 Attest einreichen (legal)', '🩺 Submit certificate (legal)'), primary: true, callback: () => {
          gs.mehrbedarf.ernaehrung = true;
          gs.ernaehrungFake = false;
          gs.ernaehrungAttest = false;   // Attest verbraucht
          logEvent(T(`🥗 Ernährungs-Mehrbedarf (echtes Attest): +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat.`, `🥗 Dietary extra benefit (real certificate): +${MEHRBEDARF_BETRAG.ernaehrung} €/mo.`), 'good');
          updateHUD();
        } });
      }
      aktionen.push({ label: T('🖊️ Attest fälschen (gratis, Prüf-Risiko!)', '🖊️ Forge certificate (free, audit risk!)'), danger: true, callback: () => {
        gs.mehrbedarf.ernaehrung = true;
        gs.ernaehrungFake = true;
        logEvent(T(`🥗 Ernährungs-Mehrbedarf (gefälscht): +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat – riskant!`, `🥗 Dietary extra benefit (forged): +${MEHRBEDARF_BETRAG.ernaehrung} €/mo – risky!`), 'warn');
        updateHUD();
      } });
      const hinweis = gs.ernaehrungAttest
        ? T('Du hast ein gültiges <strong>Attest</strong> dabei – jetzt einreichen.', 'You have a valid <strong>certificate</strong> with you – submit it now.')
        : T('⚠️ Du brauchst zuerst ein <strong>ärztliches Attest</strong>! Hol es bei der <strong>Arztpraxis</strong> – oder fälsche es (riskant).', '⚠️ You first need a <strong>medical certificate</strong>! Get it at the <strong>doctor practice</strong> – or forge it (risky).');
      oeffneModal(T('🥗 Ernährungs-Mehrbedarf', '🥗 Dietary extra benefit'),
        T(`Für +${MEHRBEDARF_BETRAG.ernaehrung} €/Monat (z. B. Zöliakie).<br><br>${hinweis}`, `For +${MEHRBEDARF_BETRAG.ernaehrung} €/mo (e.g. coeliac disease).<br><br>${hinweis}`), aktionen);
      return;
    }
    // ---- Einstiegsgeld / Gründerbonus ----
    if (aktionsId === 'einstiegsgeld') {
      if (gs.einstiegsgeldMonate > 0) { logEvent(T(`ℹ️ Einstiegsgeld läuft noch ${gs.einstiegsgeldMonate} Monate.`, `ℹ️ Start-up grant still runs for ${gs.einstiegsgeldMonate} months.`), ''); return; }
      oeffneModal(T('🚀 Einstiegsgeld (Gründerbonus)', '🚀 Start-up grant (founder bonus)'),
        T(`Gründe eine Selbstständigkeit. Kostet einmalig <strong>${formatEuro(EINSTIEGSGELD_KOSTEN)}</strong> (Steuerberater + Businessplan).<br><br>`
        + `Dann: <strong>+${EINSTIEGSGELD_BETRAG} €/Monat</strong> für ${EINSTIEGSGELD_DAUER} Monate (anrechnungsfrei) + einmaliger Investitions-Zuschuss von <strong>${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}</strong>.`, `Start a self-employed business. Costs a one-time <strong>${formatEuro(EINSTIEGSGELD_KOSTEN)}</strong> (tax advisor + business plan).<br><br>`
        + `Then: <strong>+${EINSTIEGSGELD_BETRAG} €/mo</strong> for ${EINSTIEGSGELD_DAUER} months (not counted against benefits) + a one-time investment grant of <strong>${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}</strong>.`),
        [
          { label: T(`🚀 Gründen (${formatEuro(EINSTIEGSGELD_KOSTEN)})`, `🚀 Found (${formatEuro(EINSTIEGSGELD_KOSTEN)})`), primary: true, callback: () => {
              if (gs.kontostand < EINSTIEGSGELD_KOSTEN) { logEvent(T('⚠️ Nicht genug Geld zum Gründen (800 €).', '⚠️ Not enough money to found (800 €).'), 'warn'); return; }
              gs.kontostand -= EINSTIEGSGELD_KOSTEN;
              gs.kontostand += EINSTIEGSGELD_ZUSCHUSS; staatGibt(EINSTIEGSGELD_ZUSCHUSS);
              gs.einstiegsgeldMonate = EINSTIEGSGELD_DAUER;
              logEvent(T(`🚀 Einstiegsgeld bewilligt! Zuschuss +${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}, dann +${EINSTIEGSGELD_BETRAG} €/M für ${EINSTIEGSGELD_DAUER} Monate.`, `🚀 Start-up grant approved! Grant +${formatEuro(EINSTIEGSGELD_ZUSCHUSS)}, then +${EINSTIEGSGELD_BETRAG} €/mo for ${EINSTIEGSGELD_DAUER} months.`), 'good');
              updateHUD();
            } },
        ]);
      return;
    }
    // ---- Einmalige Pauschalen ----
    if (aktionsId === 'pausch_erstausstattung') {
      if (gs.pauschalen.erstausstattung) { logEvent(T('ℹ️ Erstausstattung wurde bereits bezogen.', 'ℹ️ Home starter package was already claimed.'), ''); return; }
      if (!gs.umzugGemacht) {
        oeffneModal(T('🛋️ Kein Anspruch', '🛋️ No entitlement'), T('Die Wohnungs-Erstausstattung gibt es nur nach einem Umzug / Erstbezug (Wohnung → Umzug).', 'The home starter package is only available after a move / first occupancy (Home → Move).'), []);
        return;
      }
      gs.kontostand += 1200; staatGibt(1200);
      gs.pauschalen.erstausstattung = true;
      logEvent(T('🛋️ Erstausstattung Wohnung bewilligt: +1.200 €.', '🛋️ Home starter package approved: +1,200 €.'), 'good');
    }
    if (aktionsId === 'pausch_moebel') {
      if (gs.pauschalen.moebel) { logEvent(T('ℹ️ Möbel-Zuschuss wurde bereits bezogen.', 'ℹ️ Furniture grant was already claimed.'), ''); return; }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal(T('🪑 Kein Kind gemeldet', '🪑 No child registered'), T('Den Möbel-Zuschuss (Jugendbett/Schreibtisch) gibt es nur fürs Kind.', 'The furniture grant (youth bed/desk) is only available for a child.'), []);
        return;
      }
      const moebelBetrag = 250 * (gs.kindergeldKinder || []).length;
      gs.kontostand += moebelBetrag; staatGibt(moebelBetrag);
      gs.pauschalen.moebel = true;
      logEvent(T(`🪑 Möbel/Schreibtisch (${(gs.kindergeldKinder || []).length} Kind(er)): +${formatEuro(moebelBetrag)}.`, `🪑 Furniture/desk (${(gs.kindergeldKinder || []).length} child(ren)): +${formatEuro(moebelBetrag)}.`), 'good');
    }
    if (aktionsId === 'pausch_bekleidung') {
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal(T('👕 Kein Kind gemeldet', '👕 No child registered'), T('Die Kinder-Bekleidungspauschale gibt es nur fürs Kind.', 'The child clothing allowance is only available for a child.'), []);
        return;
      }
      if (gs.monat < gs.bekleidungCooldownMonat) {
        oeffneModal(T('👕 Noch zu früh', '👕 Too early'), T(`Die Bekleidungspauschale gibt es nur alle 6 Monate – wieder ab Monat ${gs.bekleidungCooldownMonat}.`, `The clothing allowance is only available every 6 months – again from month ${gs.bekleidungCooldownMonat}.`), []);
        return;
      }
      const bekleidungBetrag = 150 * (gs.kindergeldKinder || []).length;
      gs.kontostand += bekleidungBetrag; staatGibt(bekleidungBetrag);
      gs.bekleidungCooldownMonat = gs.monat + 6;
      logEvent(T(`👕 Kinder-Bekleidung (${(gs.kindergeldKinder || []).length} Kind(er)): +${formatEuro(bekleidungBetrag)}.`, `👕 Child clothing (${(gs.kindergeldKinder || []).length} child(ren)): +${formatEuro(bekleidungBetrag)}.`), 'good');
    }
    // ---- Korrupter Sachbearbeiter schmieren ----
    if (aktionsId === 'sachbearbeiter') {
      if (gs.sachbearbeiterBestochen) {
        gs.sachbearbeiterBestochen = false;
        logEvent(T('🤝 Schmiergeld eingestellt.', '🤝 Bribe stopped.'), '');
        return;
      }
      gs.sachbearbeiterBestochen = true;
      oeffneModal(T('🤝 Sachbearbeiter geschmiert', '🤝 Caseworker bribed'),
        T(`Dein Sachbearbeiter drückt künftig beide Augen zu: <strong>halbe Entdeckungschance</strong> bei der Jobcenter-Prüfung.<br><br>`
        + `Kostet <strong>${formatEuro(SACHBEARBEITER_KOSTEN)}/Monat</strong>. Kannst du mal nicht zahlen, ist der Deal sofort geplatzt.`, `Your caseworker will turn a blind eye from now on: <strong>half the detection chance</strong> during the Job Center audit.<br><br>`
        + `Costs <strong>${formatEuro(SACHBEARBEITER_KOSTEN)}/mo</strong>. If you ever fail to pay, the deal collapses immediately.`), []);
      logEvent(T(`🤝 Sachbearbeiter bestochen (${formatEuro(SACHBEARBEITER_KOSTEN)}/Monat).`, `🤝 Caseworker bribed (${formatEuro(SACHBEARBEITER_KOSTEN)}/mo).`), 'warn');
      return;
    }
  }

  // --- BAUSTELLE --- NEU v3: Einnahmen gehen in losesBargeld, nicht schwarzeKasse
  if (ortId === 'baustelle') {
    if (aktionsId === 'schwarzarbeit') {
      gs.losesBargeld += 300;
      gs.risikoRaster  = clamp(gs.risikoRaster + 12, 0, 100);
      gs.energie       = clamp(gs.energie - 20, 0, 100);
      gs.hatSchwarzgearbeitet = true;
      verbraucheTag(1);
      logEvent(T('⛏️ +300 € loses Bargeld. Risiko +12, E -20. 1 Tag vergangen.', '⛏️ +300 € loose cash. Risk +12, E -20. 1 day passed.'), 'warn');
    }
    if (aktionsId === 'halbertag') {
      gs.losesBargeld += 120;
      gs.risikoRaster  = clamp(gs.risikoRaster + 5, 0, 100);
      gs.energie       = clamp(gs.energie - 8, 0, 100);
      gs.hatSchwarzgearbeitet = true;
      // Halber Tag = kein ganzer Tagesverbrauch
      logEvent(T('🔧 +120 € loses Bargeld. Risiko +5, E -8.', '🔧 +120 € loose cash. Risk +5, E -8.'), 'warn');
    }
  }

  // --- BANK ---
  if (ortId === 'bank') {
    if (aktionsId === 'einzahlen') {
      if (gs.losesBargeld <= 0) { logEvent(T('⚠️ Kein loses Bargeld vorhanden.', '⚠️ No loose cash available.'), 'warn'); return; }
      if (!gs.bankEinzahlungDieseWoche) gs.bankEinzahlungDieseWoche = 0;
      const wochenLimit = 200;
      const restLimit = wochenLimit - gs.bankEinzahlungDieseWoche;
      if (restLimit <= 0) {
        oeffneModal(T('⚠️ Wochenlimit erreicht', '⚠️ Weekly limit reached'),
          T(`Max. <strong>200 €/Woche</strong> Bargeld-Einzahlung – sonst werden Behörden misstrauisch.<br><br>
           Bereits diese Woche: <strong>${formatEuro(gs.bankEinzahlungDieseWoche)}</strong>`, `Max. <strong>200 €/week</strong> cash deposit – otherwise the authorities get suspicious.<br><br>
           Already this week: <strong>${formatEuro(gs.bankEinzahlungDieseWoche)}</strong>`), []);
        return;
      }
      const betrag = Math.min(gs.losesBargeld, restLimit);
      const transportRisiko = Math.min(Math.floor(betrag / 100), 5);
      gs.kontostand   += betrag;
      gs.losesBargeld -= betrag;
      gs.bankEinzahlungDieseWoche += betrag;
      gs.risikoRaster  = clamp(gs.risikoRaster + transportRisiko, 0, 100);
      const uebrig = wochenLimit - gs.bankEinzahlungDieseWoche;
      logEvent(T(`💳 ${formatEuro(betrag)} auf Konto. Wochenlimit noch: ${formatEuro(uebrig)}. Risiko +${transportRisiko}.`, `💳 ${formatEuro(betrag)} to the account. Weekly limit left: ${formatEuro(uebrig)}. Risk +${transportRisiko}.`), 'good');
      soundGeld && soundGeld();
    }
    if (aktionsId === 'abheben') {
      const b = Math.min(500, gs.kontostand);
      if (b <= 0) { logEvent(T('⚠️ Konto leer.', '⚠️ Account empty.'), 'warn'); return; }
      gs.kontostand   -= b;
      gs.losesBargeld += b;
      logEvent(T(`💵 ${formatEuro(b)} abgehoben.`, `💵 ${formatEuro(b)} withdrawn.`), 'warn');
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
    if (aktionsId === 'gold_kaufen')    { oeffneGoldKaufMenu();    return; }
    if (aktionsId === 'gold_verkaufen') { oeffneGoldVerkaufMenu(); return; }
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
          logEvent(T(`⚠️ Nicht genug Geld zum Auslösen von ${item.name} (${formatEuro(kosten)}).`, `⚠️ Not enough money to redeem ${item.name} (${formatEuro(kosten)}).`), 'warn'); return;
        }
        let rest = kosten;
        const ausKonto = Math.min(rest, gs.kontostand); gs.kontostand -= ausKonto; rest -= ausKonto;
        gs.losesBargeld -= rest;
        gs.verpfaendet[itemId] = false;
        gs[launeFeld] = clamp(gs[launeFeld] + item.laune, 0, 100);
        logEvent(T(`${item.name} ausgelöst: −${formatEuro(kosten)} (inkl. 25% Zins). Laune +${item.laune}.`, `${item.name} redeemed: −${formatEuro(kosten)} (incl. 25% interest). Mood +${item.laune}.`), 'good');
        soundGeld && soundGeld();
      } else {
        // VERPFÄNDEN: Pfandwert aufs Konto, Laune sinkt
        gs.kontostand += item.wert;
        gs.verpfaendet[itemId] = true;
        gs[launeFeld] = clamp(gs[launeFeld] - item.laune, 0, 100);
        logEvent(T(`${item.name} verpfändet: +${formatEuro(item.wert)} aufs Konto. Laune −${item.laune}.`, `${item.name} pawned: +${formatEuro(item.wert)} to the account. Mood −${item.laune}.`), 'warn');
        soundGeld && soundGeld();
      }
    }
  }

  // --- AMÜSIERBETRIEB ---
  if (ortId === 'amuesier') {
    if (aktionsId === 'amuesieren') {
      const gesamt = gs.kontostand + gs.schwarzeKasse;
      if (gesamt < 200) { logEvent(T('⚠️ Nicht genug Geld.', '⚠️ Not enough money.'), 'warn'); return; }
      if (gs.schwarzeKasse >= 200) gs.schwarzeKasse -= 200;
      else gs.kontostand -= 200;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 30, 0, 100);
      logEvent(T('🍸 Schöner Abend! Laune +30. -200 €.', '🍸 Nice evening! Mood +30. -200 €.'), 'good');
      if (Math.random() < 0.20 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(T(`🍸 Das Nachtleben zieht dich rein… Sucht-Stufe ${gs.suchtStufe}.`, `🍸 Nightlife is pulling you in… Addiction level ${gs.suchtStufe}.`), 'danger');
      }
      if (Math.random() < 0.25) {
        gs.happinessPartner = clamp(gs.happinessPartner - 20, 0, 100);
        setTimeout(() => {
          oeffneModal(T('😬 Ertappt!', '😬 Caught!'), T('Partner hat herausgefunden, wo du warst!<br><br><strong>Partnerlaune -20</strong>', 'Your partner found out where you were!<br><br><strong>Partner -20</strong>'), []);
          logEvent(T('😬 Ertappt! Partnerlaune -20.', '😬 Caught! Partner -20.'), 'danger');
          pruefeEheKrise();
        }, 300);
        return;
      }
    }
  }

  // --- SPORTVEREIN ---
  if (ortId === 'sportverein') {
    if (aktionsId === 'sozial') {
      if (gs.energie < 20) { oeffneModal(T('😴 Zu erschöpft', '😴 Too exhausted'), T('Du hast <strong>zu wenig Energie</strong> für eine soziale Tätigkeit.<br><br>Schlafe zuerst (Wohnung).', 'You have <strong>too little energy</strong> for a social activity.<br><br>Sleep first (Home).'), []); return; }
      gs.energie         = clamp(gs.energie - 20, 0, 100);
      gs.risikoRaster    = clamp(gs.risikoRaster - 23, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      verbraucheTag(1);
      logEvent(T('⚽ Soziale Tätigkeit: E -20, Risiko -23, Laune +10. 1 Tag vergangen.', '⚽ Social activity: E -20, Risk -23, Mood +10. 1 day passed.'), 'good');
    }
    if (aktionsId === 'training') {
      if (gs.energie < 15) { oeffneModal(T('😴 Zu erschöpft', '😴 Too exhausted'), T('Du hast <strong>zu wenig Energie</strong> fürs Training.<br><br>Schlafe zuerst (Wohnung).', 'You have <strong>too little energy</strong> for training.<br><br>Sleep first (Home).'), []); return; }
      gs.energie         = clamp(gs.energie - 15, 0, 100);
      gs.risikoRaster    = clamp(gs.risikoRaster - 15, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler + 5, 0, 100);
      verbraucheTag(1);
      logEvent(T('🏃 Training geleitet: E -15, Risiko -15, Laune +5. 1 Tag vergangen.', '🏃 Training led: E -15, Risk -15, Mood +5. 1 day passed.'), 'good');
    }
    if (aktionsId === 'kampfsport') {
      if (gs.kampfsportGelernt) { oeffneModal(T('🥊 Bereits gelernt', '🥊 Already learned'), T('Du beherrschst Kampfsport schon – deine Chance gegen den Räuber liegt bei <strong>75 %</strong>.', 'You already know martial arts – your chance against the robber is <strong>75 %</strong>.'), []); return; }
      if (gs.kontostand < 300) { oeffneModal(T('💸 Zu wenig Geld', '💸 Not enough money'), T('Der Kampfsport-Kurs kostet <strong>300 €</strong> (vom Konto).', 'The martial arts course costs <strong>300 €</strong> (from your account).'), []); return; }
      gs.kontostand -= 300;
      gs.kampfsportGelernt = true;
      logEvent(T('🥊 Kampfsport gelernt – Chance gegen den Räuber jetzt 75 %.', '🥊 Martial arts learned – chance against the robber now 75 %.'), 'good');
      oeffneModal(T('🥊 Kampfsport gelernt', '🥊 Martial arts learned'), T('Du hast Nahkampf trainiert. Bei einem Überfall gewinnst du jetzt mit <strong>75 %</strong> statt 50 %.', 'You trained close combat. In a mugging you now win with <strong>75 %</strong> instead of 50 %.'), []);
    }
  }

  // --- LOAN SHARK ---
  if (ortId === 'loanshark') {
    if (aktionsId === 'kredit_klein') {
      gs.losesBargeld   += 1000;
      gs.loanSharkSchuld += 1000;
      gs.risikoRaster    = clamp(gs.risikoRaster + 8, 0, 100);   // halbe Aufmerksamkeit (war 15)
      logEvent(T('🦈 Kredit 1.000 € vom Hai. Schulden: ' + formatEuro(gs.loanSharkSchuld) + '. Risiko +8.', '🦈 Loan 1,000 € from the shark. Debt: ' + formatEuro(gs.loanSharkSchuld) + '. Risk +8.'), 'danger');
    }
    if (aktionsId === 'kredit_gross') {
      gs.losesBargeld   += 3000;
      gs.loanSharkSchuld += 3000;
      gs.risikoRaster    = clamp(gs.risikoRaster + 13, 0, 100);  // halbe Aufmerksamkeit (war 25)
      logEvent(T('🦈 Kredit 3.000 € vom Hai. Schulden: ' + formatEuro(gs.loanSharkSchuld) + '. Risiko +13.', '🦈 Loan 3,000 € from the shark. Debt: ' + formatEuro(gs.loanSharkSchuld) + '. Risk +13.'), 'danger');
    }
    if (aktionsId === 'schulden_zahlen') {
      if (gs.loanSharkSchuld <= 0) { logEvent(T('ℹ️ Keine Schulden beim Kredithai.', 'ℹ️ No debt with the loan shark.'), ''); return; }
      const zahlung = Math.min(gs.loanSharkSchuld, gs.kontostand + gs.schwarzeKasse + gs.losesBargeld);
      if (zahlung <= 0) { logEvent(T('⚠️ Kein Geld zum Zurückzahlen.', '⚠️ No money to repay.'), 'warn'); return; }
      // Erst loses Bargeld verwenden, dann Schwarzkasse, dann Konto
      let rest = zahlung;
      const ausLose   = Math.min(rest, gs.losesBargeld);  rest -= ausLose; gs.losesBargeld   -= ausLose;
      const ausSchwarz= Math.min(rest, gs.schwarzeKasse); rest -= ausSchwarz; gs.schwarzeKasse -= ausSchwarz;
      gs.kontostand = Math.max(0, gs.kontostand - rest);
      gs.loanSharkSchuld -= zahlung;
      gs.risikoRaster     = clamp(gs.risikoRaster - 10, 0, 100);
      logEvent(T('💸 ' + formatEuro(zahlung) + ' Schulden zurückgezahlt. Risiko -10.', '💸 ' + formatEuro(zahlung) + ' debt repaid. Risk -10.'), 'good');
    }
  }

  // --- SCHATTENBANK ---
  if (ortId === 'schattenbank') {
    if (aktionsId === 'alles_sichern') {
      if (gs.losesBargeld <= 0) { logEvent(T('⚠️ Kein Bargeld zum Sichern.', '⚠️ No cash to secure.'), 'warn'); return; }
      const betrag = gs.losesBargeld;
      gs.schwarzeKasse  += betrag;
      gs.losesBargeld    = 0;
      gs.schattenbankAktiv = true;
      logEvent(T(`🏴 Schattenbank: ${formatEuro(betrag)} gesichert. 5%/Monat Gebühr.`, `🏴 Shadow bank: ${formatEuro(betrag)} secured. 5%/month fee.`), 'good');
    }
    if (aktionsId === 'sichern_500') {
      const betrag = Math.min(500, gs.losesBargeld);
      if (betrag <= 0) { logEvent(T('⚠️ Kein Bargeld.', '⚠️ No cash.'), 'warn'); return; }
      gs.schwarzeKasse  += betrag;
      gs.losesBargeld   -= betrag;
      gs.schattenbankAktiv = true;
      logEvent(T(`🏴 Schattenbank: ${formatEuro(betrag)} gesichert.`, `🏴 Shadow bank: ${formatEuro(betrag)} secured.`), 'good');
    }
    if (aktionsId === 'sk_abheben') {
      if (gs.schwarzeKasse <= 0) { logEvent(T('⚠️ Schwarzkasse leer.', '⚠️ Slush fund empty.'), 'warn'); return; }
      gs.losesBargeld  += gs.schwarzeKasse;
      gs.schwarzeKasse  = 0;
      gs.schattenbankAktiv = false;
      logEvent(T(`🏴 Schwarzkasse abgehoben → loses Bargeld.`, `🏴 Slush fund withdrawn → loose cash.`), 'warn');
    }
    // ---- Unterhalts-Tarnung: Auslands-Kindergeld behalten statt anrechnen ----
    if (aktionsId === 'unterhalts_tarnung') {
      if (gs.unterhaltsTarnung) {
        gs.unterhaltsTarnung = false;
        logEvent(T('🌍 Unterhalts-Tarnung abgeschaltet. Auslands-Kindergeld wird wieder angerechnet (netto 0).', '🌍 Maintenance cover switched off. Foreign child benefit is counted again (net 0).'), '');
        return;
      }
      if ((gs.kindergeldKinder || []).length < 1) {
        oeffneModal(T('🌍 Keine Auslandskinder', '🌍 No children abroad'), T('Die Unterhalts-Tarnung lohnt sich nur mit Kindergeld für Kinder im Ausland (Wohnung → Sozialbetrug → Kindergeld-Trick).', 'The maintenance cover only pays off with child benefit for children abroad (Home → Welfare fraud → child benefit trick).'), []);
        return;
      }
      gs.unterhaltsTarnung = true;
      oeffneModal(T('🌍 Unterhalts-Tarnung aktiviert', '🌍 Maintenance cover activated'),
        T('Du reichst gefälschte Belege ein, dass du das Kindergeld als Unterhalt ins Ausland überweist.<br><br>'
        + 'Das Amt rechnet es nicht mehr an – du <strong>behältst</strong> das Auslands-Kindergeld.<br><br>'
        + '⚠️ Aber: Bei der <strong>Jobcenter-Prüfung</strong> (alle paar Monate) steigt das Entdeckungsrisiko mit jedem Auslandskind!', 'You submit forged receipts that you transfer the child benefit abroad as maintenance.<br><br>'
        + 'The office no longer counts it – you <strong>keep</strong> the foreign child benefit.<br><br>'
        + '⚠️ But: during the <strong>Job Center audit</strong> (every few months) the detection risk rises with each child abroad!'), []);
      logEvent(T('🌍 Unterhalts-Tarnung aktiv – Auslands-Kindergeld wird behalten (riskant!).', '🌍 Maintenance cover active – foreign child benefit is kept (risky!).'), 'warn');
      return;
    }
    // ---- Immobilie kaufen (40.000 € EK aus Schwarzkasse, Rest in Raten) ----
    if (aktionsId === 'immo_kaufen') {
      if (gs.immobilie) { oeffneModal(T('🏘️ Schon im Besitz', '🏘️ Already owned'), T('Du besitzt bereits eine Immobilie.', 'You already own a property.'), []); return; }
      if (gs.schwarzeKasse < IMMO_EIGENKAPITAL) {
        oeffneModal(T('🏘️ Zu wenig Eigenkapital', '🏘️ Not enough equity'), T(`Für die Anzahlung brauchst du <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong> in der Schwarzkasse.<br><br>Vorhanden: ${formatEuro(gs.schwarzeKasse)}.`, `For the down payment you need <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong> in the slush fund.<br><br>Available: ${formatEuro(gs.schwarzeKasse)}.`), []);
        return;
      }
      gs.schwarzeKasse -= IMMO_EIGENKAPITAL;
      const restSchuld = IMMO_KAUFPREIS - IMMO_EIGENKAPITAL;
      gs.immobilie = { wert: IMMO_KAUFPREIS, miete: IMMO_MIETE, modus: 'eigen', restSchuld };
      gs.kduMascheGestoppt = false;   // frische Immobilie → Masche wieder möglich
      oeffneModal(T('🏘️ Immobilie gekauft!', '🏘️ Property bought!'),
        T(`Über einen Strohmann erworben. Anzahlung: <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong>.<br><br>`
        + `Restschuld <strong>${formatEuro(restSchuld)}</strong> → Rate <strong>${formatEuro(IMMO_RATE)}/Monat</strong> über ${IMMO_LAUFZEIT} Monate (jederzeit sofort tilgbar).<br><br>`
        + `Modus: <strong>Eigennutzung</strong> – im Bürgergeld zahlt das Amt die Miete (${formatEuro(IMMO_MIETE)}/M) in deine Schwarzkasse. Wert +2 %/Monat.<br><br>`
        + '⚠️ Eigennutzung ist Leistungsbetrug → erhöhtes Risiko + Jobcenter-Prüfung.', `Acquired through a straw man. Down payment: <strong>${formatEuro(IMMO_EIGENKAPITAL)}</strong>.<br><br>`
        + `Balance <strong>${formatEuro(restSchuld)}</strong> → instalment <strong>${formatEuro(IMMO_RATE)}/mo</strong> over ${IMMO_LAUFZEIT} months (can be paid off in full any time).<br><br>`
        + `Mode: <strong>Own use</strong> – on welfare the office pays the rent (${formatEuro(IMMO_MIETE)}/mo) into your slush fund. Value +2 %/month.<br><br>`
        + '⚠️ Own use is benefit fraud → increased risk + Job Center audit.'), []);
      logEvent(T(`🏘️ Immobilie gekauft. EK ${formatEuro(IMMO_EIGENKAPITAL)}, Restschuld ${formatEuro(restSchuld)}.`, `🏘️ Property bought. Equity ${formatEuro(IMMO_EIGENKAPITAL)}, balance ${formatEuro(restSchuld)}.`), 'warn');
      return;
    }
    if (aktionsId === 'immo_modus') {
      if (!gs.immobilie) { oeffneModal(T('🏘️ Keine Immobilie', '🏘️ No property'), T('Kaufe zuerst eine Immobilie.', 'Buy a property first.'), []); return; }
      gs.immobilie.modus = gs.immobilie.modus === 'eigen' ? 'vermietet' : 'eigen';
      logEvent(T(`🔑 Immobilie: ${gs.immobilie.modus === 'eigen' ? 'Eigennutzung – Amt zahlt Miete' : 'Vermietet – Mieteinnahmen'}.`, `🔑 Property: ${gs.immobilie.modus === 'eigen' ? 'Own use – office pays rent' : 'Rented out – rental income'}.`), '');
      return;
    }
    if (aktionsId === 'immo_tilgen') {
      if (!gs.immobilie || gs.immobilie.restSchuld <= 0) { oeffneModal(T('🏦 Nichts zu tilgen', '🏦 Nothing to pay off'), T('Es besteht keine Restschuld.', 'There is no remaining balance.'), []); return; }
      const rest = gs.immobilie.restSchuld;
      if (gs.schwarzeKasse + gs.kontostand < rest) {
        oeffneModal(T('🏦 Zu wenig Geld', '🏦 Not enough money'), T(`Zum Abbezahlen der Restschuld brauchst du <strong>${formatEuro(rest)}</strong> (Schwarzkasse + Konto).`, `To pay off the balance you need <strong>${formatEuro(rest)}</strong> (slush fund + account).`), []);
        return;
      }
      let r = rest;
      const ausSK = Math.min(r, gs.schwarzeKasse); gs.schwarzeKasse -= ausSK; r -= ausSK;
      gs.kontostand -= r;
      gs.immobilie.restSchuld = 0;
      oeffneModal(T('🏦 Abbezahlt!', '🏦 Paid off!'), T(`Restschuld von ${formatEuro(rest)} sofort getilgt. Die Immobilie gehört dir schuldenfrei.`, `Balance of ${formatEuro(rest)} paid off immediately. The property is yours free of debt.`), []);
      logEvent(T(`🏦 Immobilie abbezahlt: -${formatEuro(rest)}.`, `🏦 Property paid off: -${formatEuro(rest)}.`), 'good');
      return;
    }
    if (aktionsId === 'immo_verkaufen') {
      if (!gs.immobilie) { oeffneModal(T('🏘️ Keine Immobilie', '🏘️ No property'), T('Du besitzt keine Immobilie.', 'You do not own a property.'), []); return; }
      const erloes = Math.max(0, Math.round(gs.immobilie.wert) - (gs.immobilie.restSchuld || 0));
      gs.schwarzeKasse += erloes;
      const rs = gs.immobilie.restSchuld || 0;
      gs.immobilie = null;
      oeffneModal(T('💰 Immobilie verkauft', '💰 Property sold'), T(`Verkauft. Wert minus Restschuld (${formatEuro(rs)}) = <strong>${formatEuro(erloes)}</strong> → Schwarzkasse.`, `Sold. Value minus balance (${formatEuro(rs)}) = <strong>${formatEuro(erloes)}</strong> → slush fund.`), []);
      logEvent(T(`💰 Immobilie verkauft: +${formatEuro(erloes)} Schwarzkasse.`, `💰 Property sold: +${formatEuro(erloes)} slush fund.`), 'good');
      return;
    }
    // ---- Depot verschleiern (vor dem Amt verstecken) ----
    if (aktionsId === 'depot_verschleiern') {
      if (gs.depotVerschleiert) {
        gs.depotVerschleiert = false;
        oeffneModal(T('📈 Depot wieder offiziell', '📈 Portfolio official again'), T('Dein Depot läuft wieder auf deinen Namen – es zählt damit wieder zur Vermögensprüfung, kostet aber keine Gebühr mehr.', 'Your portfolio runs under your name again – it counts towards the assets check again, but no longer costs a fee.'), []);
        logEvent(T('📈 Depot nicht mehr verschleiert.', '📈 Portfolio no longer concealed.'), '');
        return;
      }
      if ((gs.depot || []).length === 0) {
        oeffneModal(T('📈 Kein Depot', '📈 No portfolio'), T('Du hast keine Wertpapiere, die du verschleiern könntest. Kaufe erst welche bei der Bank.', 'You have no securities to conceal. Buy some at the bank first.'), []);
        return;
      }
      gs.depotVerschleiert = true;
      oeffneModal(T('📈 Depot verschleiert', '📈 Portfolio concealed'),
        T('Deine Wertpapiere laufen jetzt über einen Strohmann der Schattenbank.<br><br>'
        + 'Das Depot zählt <strong>nicht mehr zur Vermögensprüfung</strong> – die Schattenbank nimmt dafür <strong>5 % des Depotwerts pro Monat</strong>.', 'Your securities now run through a straw man of the shadow bank.<br><br>'
        + 'The portfolio <strong>no longer counts towards the assets check</strong> – in return the shadow bank takes <strong>5 % of the portfolio value per month</strong>.'), []);
      logEvent(T('📈 Depot verschleiert (5%/Monat, Amt-unsichtbar).', '📈 Portfolio concealed (5%/month, invisible to the office).'), 'warn');
      return;
    }
  }

  // --- SUPERMARKT ---
  if (ortId === 'supermarkt') {
    // Pro-Tag-Kosten je Qualität; gekauft wird nur bis zur Kapazität (pro rata).
    const proTag = { gut: 57, normal: 36, billig: 18 };
    const typ = aktionsId.startsWith('einkauf_') ? aktionsId.replace('einkauf_', '') : null;
    if (typ && proTag[typ] !== undefined) {
      const kapazitaet = gs.grosserKuehlschrank ? 14 : 7;   // Kühlschrank verdoppelt die Kapazität
      const haben = gs.lebensmittelTageRest || 0;
      const tageKauf = kapazitaet - haben;
      if (tageKauf <= 0) {
        oeffneModal(T('🧊 Vorrat voll', '🧊 Stock full'), T(`Dein Vorrat ist schon voll (<strong>${haben}/${kapazitaet} Tage</strong>). Erst etwas aufbrauchen, dann wieder einkaufen.`, `Your stock is already full (<strong>${haben}/${kapazitaet} days</strong>). Use some up first, then shop again.`), []);
        return;
      }
      const kosten = Math.round(proTag[typ] * tageKauf);
      // Bezahlung: erst loses Bargeld, Rest vom Konto
      if (gs.kontostand + gs.losesBargeld < kosten) {
        oeffneModal(T('💸 Zu wenig Geld', '💸 Not enough money'), T(`Einkauf für <strong>${tageKauf} Tage</strong> kostet <strong>${formatEuro(kosten)}</strong> (Konto + Bargeld reichen nicht).`, `Shopping for <strong>${tageKauf} days</strong> costs <strong>${formatEuro(kosten)}</strong> (account + cash are not enough).`), []);
        return;
      }
      let rest = kosten;
      const ausBar = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= ausBar; rest -= ausBar;
      gs.kontostand -= rest;
      gs.supermarktFaellig = false;
      gs.lebensmittelDiesenMonat = typ;
      gs.lebensmittelTageRest = kapazitaet;   // bis zur Kapazität aufgefüllt
      gs.kuehlschrankWarnung = false;
      const f = tageKauf / 7;   // Boni/Mali pro rata (voller Effekt bei 7-Tage-Kauf)

      if (typ === 'gut') {
        gs.gesundheit       = clamp(gs.gesundheit + Math.round(10 * f), 0, 100);
        gs.happinessSpieler = clamp(gs.happinessSpieler + Math.round(10 * f), 0, 100);
        gs.happinessPartner = clamp(gs.happinessPartner + Math.round(10 * f), 0, 100);
        gs.billigKaeufeInFolge = 0;
        logEvent(T(`🥗 Bio-Einkauf: ${tageKauf} Tage, -${formatEuro(kosten)}. Gesundheit & Laune +.`, `🥗 Organic shopping: ${tageKauf} days, -${formatEuro(kosten)}. Health and Mood +.`), 'good');
      } else if (typ === 'normal') {
        gs.billigKaeufeInFolge = 0;
        logEvent(T(`🥙 Einkauf: ${tageKauf} Tage, -${formatEuro(kosten)}.`, `🥙 Shopping: ${tageKauf} days, -${formatEuro(kosten)}.`), 'good');
      } else if (typ === 'billig') {
        gs.gesundheit = clamp(gs.gesundheit - Math.round(5 * f), 0, 100);
        gs.billigKaeufeInFolge++;
        logEvent(T(`🍟 Billig-Einkauf: ${tageKauf} Tage, -${formatEuro(kosten)}. Gesundheit -.`, `🍟 Cheap shopping: ${tageKauf} days, -${formatEuro(kosten)}. Health -.`), 'warn');
        if (gs.billigKaeufeInFolge >= 2) {
          setTimeout(() => oeffneModal(T('😤 Deine Frau beschwert sich!', '😤 Your wife is complaining!'),
            T('Zwei Monate hintereinander Billig-Essen! Deine Partnerin ist sauer.<br><br>'
            + '<strong>Partnerlaune −15</strong>', 'Two months of cheap food in a row! Your partner is upset.<br><br>'
            + '<strong>Partner −15</strong>'),
            []
          ), 300);
          gs.happinessPartner = clamp(gs.happinessPartner - 15, 0, 100);
          logEvent(T('😤 Frau beschwert sich über Billig-Essen!', '😤 Wife complains about cheap food!'), 'danger');
        }
      }
      soundGeld && soundGeld();
    }

    if (aktionsId === 'geschenk') {
      if (gs.kontostand < 500) { logEvent(T('⚠️ Nicht genug Geld (500€).', '⚠️ Not enough money (500€).'), 'warn'); return; }
      gs.kontostand    -= 500;
      gs.geschenkeSumme += 500;
      logEvent(T(`🎁 Geschenk 500€. Gesamt: ${formatEuro(gs.geschenkeSumme)} / 1.000€.`, `🎁 Gift 500€. Total: ${formatEuro(gs.geschenkeSumme)} / 1,000€.`), 'good');
      if (gs.geschenkeSumme >= 1000 && gs.frauAusgezogen) {
        gs.frauAusgezogen      = false;
        gs.unterhaltProMonat   = 0;
        gs.geschenkeSumme      = 0;
        gs.happinessPartner    = 70;
        gs.eheKriseAktiv       = false;   // Ehe-Krise beendet
        gs.eheKriseSchritt     = 0;
        gs.eheKriseGescheitert = false;
        logEvent(T('💑 Frau ist zurückgekommen! Unterhalt entfällt.', '💑 Wife came back! Maintenance no longer applies.'), 'good');
        oeffneModal(T('💑 Sie ist zurück!', '💑 She is back!'),
          T('Du hast genug Geschenke gemacht (1.000 €).<br><br>'
          + 'Deine Partnerin zieht wieder ein. Partnerlaune: <strong>70</strong>.<br>'
          + 'Der monatliche Unterhalt von 1.000 € entfällt.', 'You gave enough gifts (1,000 €).<br><br>'
          + 'Your partner moves back in. Partner: <strong>70</strong>.<br>'
          + 'The monthly maintenance of 1,000 € no longer applies.'), []);
      }
    }

    // ---- Minijob (legales Einkommen mit Freibetrag) ----
    if (aktionsId === 'minijob') {
      const setze = (lohn) => {
        gs.minijobLohn = lohn;
        if (lohn > 0) {
          const fb = minijobFreibetrag(lohn);
          logEvent(T(`💼 Minijob angenommen: ${formatEuro(lohn)}/Monat brutto. Davon anrechnungsfrei: ${formatEuro(fb)}.`, `💼 Mini-job taken: ${formatEuro(lohn)}/month gross. Of that not counted: ${formatEuro(fb)}.`), 'good');
        } else {
          logEvent(T('💼 Minijob gekündigt.', '💼 Mini-job quit.'), '');
        }
        updateHUD();
      };
      const fb538 = minijobFreibetrag(538);
      const fb250 = minijobFreibetrag(250);
      oeffneModal(T('💼 Minijob (Aushilfe)', '💼 Mini-job (helper)'),
        T('Legales Einkommen – aber das Amt rechnet an. Du behältst nur den <strong>Freibetrag</strong> (erste 100 € + 20 % vom Rest).<br><br>'
        + `Kostet jeden Monat etwas Energie.`, 'Legal income – but the office counts it. You keep only the <strong>allowance</strong> (first 100 € + 20 % of the rest).<br><br>'
        + `Costs a bit of energy each month.`),
        [
          { label: T(`🧹 250 €/Monat (netto +${formatEuro(fb250)})`, `🧹 250 €/month (net +${formatEuro(fb250)})`), callback: () => setze(250) },
          { label: T(`🛒 538 €/Monat (netto +${formatEuro(fb538)})`, `🛒 538 €/month (net +${formatEuro(fb538)})`), primary: true, callback: () => setze(538) },
          { label: T('🚪 Minijob kündigen', '🚪 Quit mini-job'), danger: true, callback: () => setze(0) },
        ]);
      return;
    }

  }

  // --- KIOSK ---
  if (ortId === 'kiosk') {
    // ---- Rubbellos (1 oder 5 auf einmal) ----
    if (aktionsId === 'rubbellos')   { kaufeRubbellose(1); return; }
    if (aktionsId === 'rubbellos_5') { kaufeRubbellose(5); return; }
    // ---- Alkohol & Zigaretten ----
    if (aktionsId === 'genussmittel') {
      if (gs.kontostand < 15) { logEvent(T('⚠️ Kein Geld für Genussmittel.', '⚠️ No money for indulgences.'), 'warn'); return; }
      gs.kontostand      -= 15;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 8, 0, 100);
      gs.gesundheit       = clamp(gs.gesundheit - 3, 0, 100);
      logEvent(T('🍺 Alkohol & Zigaretten: Laune +8, Gesundheit -3.', '🍺 Alcohol and cigarettes: Mood +8, Health -3.'), 'warn');
      if (Math.random() < 0.20 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(T(`🍺 Es wird zur Gewohnheit… Sucht-Stufe ${gs.suchtStufe}.`, `🍺 It is becoming a habit… Addiction level ${gs.suchtStufe}.`), 'danger');
      }
      return;
    }
  }

  // --- PARK / DEALER ---
  if (ortId === 'dealer') {
    if (aktionsId === 'stoff_kaufen') {
      const preis = 80;
      if (gs.losesBargeld < preis) {
        oeffneModal(T('💊 Dealer will Bargeld', '💊 Dealer wants cash'),
          T(`Der Typ im Gebüsch nimmt nur <strong>${formatEuro(preis)}</strong> in bar – keine Karte. `
          + 'Besorg dir loses Bargeld (z. B. Schwarzarbeit auf der Baustelle).', `The guy in the bushes only takes <strong>${formatEuro(preis)}</strong> in cash – no card. `
          + 'Get some loose cash (e.g. off-the-books work at the construction site).'), []);
        return;
      }
      gs.losesBargeld     -= preis;
      gs.happinessSpieler  = clamp(gs.happinessSpieler + 25, 0, 100);
      gs.gesundheit        = clamp(gs.gesundheit - 12, 0, 100);
      gs.happinessPartner  = clamp(gs.happinessPartner - 5, 0, 100);
      gs.risikoRaster      = clamp(gs.risikoRaster + 6, 0, 100);
      logEvent(T('💊 Was beim Dealer geholt: Laune +25, aber Gesundheit -12, Partner -5, Risiko +6.', '💊 Got something from the dealer: Mood +25, but Health -12, Partner -5, Risk +6.'), 'warn');
      if (Math.random() < 0.35 && gs.suchtStufe < 3) {
        gs.suchtStufe++;
        logEvent(T(`💊 Das zieht dich runter… Sucht-Stufe ${gs.suchtStufe}.`, `💊 This is dragging you down… Addiction level ${gs.suchtStufe}.`), 'danger');
      }
      if (gs.gesundheit <= 0) triggerGameOver('gesundheit');
      return;
    }
  }

  // --- ARZTPRAXIS ---
  if (ortId === 'arztpraxis') {
    if (aktionsId === 'arzt_behandlung') {
      if (gs.kontostand + gs.losesBargeld < 500) { logEvent(T('⚠️ Nicht genug Geld für die Behandlung (500€).', '⚠️ Not enough money for the treatment (500€).'), 'warn'); return; }
      let rest = 500; const l = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= l; rest -= l; gs.kontostand -= rest;
      gs.gesundheit  = clamp(gs.gesundheit + 30, 0, 100);
      logEvent(T('🩺 Behandlung: Gesundheit +30 (-500€).', '🩺 Treatment: Health +30 (-500€).'), 'good');
    }
    if (aktionsId === 'arzt_krank1' || aktionsId === 'arzt_krank2') {
      const wochen = aktionsId === 'arzt_krank2' ? 2 : 1;
      const preis  = wochen === 2 ? 100 : 50;
      if ((gs.krankmeldungCooldownWochen || 0) > 0) {
        oeffneModal(T('🤒 Geht gerade nicht', '🤒 Not possible right now'),
          T(`Der Arzt schöpft Verdacht – eine neue Krankmeldung gibt es erst in ` +
          `<strong>${gs.krankmeldungCooldownWochen} Woche(n)</strong> wieder (max. alle 6 Wochen).`, `The doctor is getting suspicious – a new sick note is only available in ` +
          `<strong>${gs.krankmeldungCooldownWochen} week(s)</strong> (max. every 6 weeks).`), []);
        return;
      }
      if (gs.kontostand + gs.losesBargeld < preis) {
        logEvent(T(`⚠️ Nicht genug Geld fürs Bestechen (${preis}€).`, `⚠️ Not enough money for the bribe (${preis}€).`), 'warn'); return;
      }
      let rest = preis;
      const l = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= l; rest -= l;
      gs.kontostand -= rest;
      gs.krankmeldungWochenRest    = wochen;
      gs.krankmeldungCooldownWochen = 6;
      logEvent(T(`🤒 Krankmeldung für ${wochen} Woche(n) erkauft (${preis}€).`, `🤒 Sick note for ${wochen} week(s) bought (${preis}€).`), 'good');
      oeffneModal(T('🤒 Krankgeschrieben', '🤒 On sick leave'),
        T(`Der Arzt lässt sich für <strong>${preis} €</strong> überzeugen.<br><br>` +
        `Du bist <strong>${wochen} Woche(n)</strong> krankgeschrieben:<br>` +
        `• <strong>keine Pflichttermine</strong> beim Arbeitsamt<br>` +
        `• <strong>keine Razzia/Prüfung</strong> in dieser Zeit<br><br>` +
        `Nächste Krankmeldung erst in <strong>6 Wochen</strong> möglich.`, `The doctor is convinced for <strong>${preis} €</strong>.<br><br>` +
        `You are on sick leave for <strong>${wochen} week(s)</strong>:<br>` +
        `• <strong>no mandatory appointments</strong> at the Job Center<br>` +
        `• <strong>no raid/audit</strong> during this time<br><br>` +
        `Next sick note only possible in <strong>6 weeks</strong>.`), []);
    }
    if (aktionsId === 'arzt_attest') {
      if (gs.ernaehrungAttest) { oeffneModal(T('🥗 Attest', '🥗 Certificate'), T('Du hast bereits ein gültiges Ernährungs-Attest. Bring es beim <strong>Arbeitsamt</strong> ein (Anträge → Ernährung).', 'You already have a valid dietary certificate. Submit it at the <strong>Job Center</strong> (Applications → Diet).'), []); return; }
      if (gs.kontostand + gs.losesBargeld < 50) { logEvent(T('⚠️ Nicht genug Geld fürs Attest (50€).', '⚠️ Not enough money for the certificate (50€).'), 'warn'); return; }
      let rest = 50; const l = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= l; rest -= l; gs.kontostand -= rest;
      gs.ernaehrungAttest = true;
      logEvent(T('🥗 Ernährungs-Attest erhalten (50€). Jetzt beim Amt einreichen.', '🥗 Dietary certificate received (50€). Now submit it at the office.'), 'good');
      oeffneModal(T('🥗 Attest ausgestellt', '🥗 Certificate issued'),
        T('Der Arzt stellt dir ein <strong>Ernährungs-Attest</strong> aus (z. B. Zöliakie).<br><br>' +
        'Bring es zum <strong>Arbeitsamt → Anträge → Ernährung</strong>, um den Mehrbedarf zu beantragen.', 'The doctor issues you a <strong>dietary certificate</strong> (e.g. coeliac disease).<br><br>' +
        'Bring it to the <strong>Job Center → Applications → Diet</strong> to apply for the extra benefit.'), []);
      return;
    }
    if (aktionsId === 'arzt_entzug') {
      if ((gs.suchtStufe || 0) === 0) { oeffneModal(T('💉 Entzug', '💉 Rehab'), T('Du hast (noch) keine Sucht. Bleib so!', 'You have no addiction (yet). Keep it that way!'), []); return; }
      if (gs.kontostand + gs.losesBargeld < 800) { logEvent(T('⚠️ Nicht genug Geld für die Therapie (800€).', '⚠️ Not enough money for the therapy (800€).'), 'warn'); return; }
      let rest = 800; const l = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= l; rest -= l; gs.kontostand -= rest;
      gs.suchtStufe  = 0;
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      logEvent(T('💉 Entzug erfolgreich – Sucht überwunden!', '💉 Rehab successful – addiction overcome!'), 'good');
      oeffneModal(T('💉 Clean!', '💉 Clean!'), T('Die Therapie hat angeschlagen. Deine Sucht ist überwunden, Laune +10.', 'The therapy worked. Your addiction is overcome, Mood +10.'), []);
      return;
    }
  }

  // --- VILLA (Luxus-Domizil, nur bei Eigennutzung erreichbar) ---
  if (ortId === 'villa') {
    if (aktionsId === 'villa_schlafen') {
      gs.energie = clamp(gs.energie + 40, 0, 100);
      verbraucheTag(1);
      logEvent(T('🛌 Luxuriös geschlafen: Energie +40. 1 Tag vergangen.', '🛌 Slept in luxury: Energy +40. 1 day passed.'), 'good');
    }
    if (aktionsId === 'villa_pool') {
      gs.happinessSpieler = clamp(gs.happinessSpieler + 20, 0, 100);
      logEvent(T('🏊 Pool & Sauna: Laune +20.', '🏊 Pool and sauna: Mood +20.'), 'good');
    }
    if (aktionsId === 'villa_gaeste') {
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      gs.happinessPartner = clamp(gs.happinessPartner + 10, 0, 100);
      logEvent(T('🍸 Gäste in der Villa empfangen: Laune +10, Partner +10.', '🍸 Received guests at the villa: Mood +10, Partner +10.'), 'good');
    }
    if (aktionsId === 'villa_einlieger') {
      if (gs.einliegerVermietet) {
        gs.einliegerVermietet = false;
        oeffneModal(T('🚪 Einliegerwohnung gekündigt', '🚪 Granny flat lease ended'),
          T('Du vermietest die Einliegerwohnung nicht mehr schwarz. '
          + 'Kein Zusatz-Cash, aber auch kein Risiko mehr aus dieser Masche.', 'You no longer rent out the granny flat off the books. '
          + 'No extra cash, but also no more risk from this scheme.'), []);
        logEvent(T('🚪 Einliegerwohnung-Masche beendet.', '🚪 Granny flat scheme ended.'), '');
      } else {
        gs.einliegerVermietet = true;
        gs.risikoRaster = clamp(gs.risikoRaster + 5, 0, 100);
        oeffneModal(T('🚪 Einliegerwohnung schwarz vermietet', '🚪 Granny flat rented off the books'),
          T('Offiziell bist du in die <strong>Einliegerwohnung</strong> der Villa gezogen – '
          + 'so wirkt die Amt-Miete plausibel. In Wahrheit vermietest du sie für '
          + `<strong>${formatEuro(EINLIEGER_MIETE)}/Monat</strong> in bar weiter und lebst `
          + 'selbst luxuriös in der Villa.<br><br>Die Miete fließt monatlich in die '
          + 'schwarze Kasse. Risiko +5 – fällt bei der Jobcenter-Prüfung auf, wenn du Pech hast.', 'Officially you moved into the villa’s <strong>granny flat</strong> – '
          + 'so the office rent looks plausible. In reality you rent it out for '
          + `<strong>${formatEuro(EINLIEGER_MIETE)}/mo</strong> in cash and live `
          + 'in luxury in the villa yourself.<br><br>The rent flows monthly into the '
          + 'slush fund. Risk +5 – it can be exposed during the Job Center audit if you are unlucky.'), []);
        logEvent(T(`🚪 Einliegerwohnung schwarz vermietet: +${formatEuro(EINLIEGER_MIETE)}/M. Risiko +5.`, `🚪 Granny flat rented off the books: +${formatEuro(EINLIEGER_MIETE)}/mo. Risk +5.`), 'warn');
      }
    }
  }

  // --- KIRCHE ---
  if (ortId === 'kirche') {
    if (aktionsId === 'suendenerlass') {
      if (gs.monat < gs.suendenerlassCooldownMonat) {
        oeffneModal(T('🙏 Noch kein Erlass', '🙏 No absolution yet'), T(`Der Pfarrer gewährt erst ab Monat ${gs.suendenerlassCooldownMonat} wieder einen Sündenerlass (alle 3 Monate).`, `The priest only grants another absolution from month ${gs.suendenerlassCooldownMonat} (every 3 months).`), []);
        return;
      }
      if (gs.kontostand < 150) { logEvent(T('⚠️ Nicht genug Geld für die Spende (150€).', '⚠️ Not enough money for the donation (150€).'), 'warn'); return; }
      gs.kontostand  -= 150;
      gs.risikoRaster = Math.floor(gs.risikoRaster * 0.5);
      gs.suendenerlassCooldownMonat = gs.monat + 3;
      logEvent(T(`🙏 Sündenerlass: Risiko halbiert auf ${gs.risikoRaster}%. -150 €.`, `🙏 Absolution: Risk halved to ${gs.risikoRaster}%. -150 €.`), 'good');
      oeffneModal(T('🙏 Sündenerlass', '🙏 Absolution'), T(`Eine großzügige Spende, ein Vaterunser – der Pfarrer drückt beide Augen zu.<br><br><strong>Risiko halbiert auf ${gs.risikoRaster}%.</strong>`, `A generous donation, an Our Father – the priest turns a blind eye.<br><br><strong>Risk halved to ${gs.risikoRaster}%.</strong>`), []);
      return;
    }
    if (aktionsId === 'beichte') {
      if (gs.monat < gs.beichteCooldownMonat) {
        oeffneModal(T('🕯️ Noch keine Beichte', '🕯️ No confession yet'), T(`Beichten kannst du erst wieder ab Monat ${gs.beichteCooldownMonat} (alle 3 Monate).`, `You can confess again only from month ${gs.beichteCooldownMonat} (every 3 months).`), []);
        return;
      }
      if (gs.energie < 15) { logEvent(T('⚠️ Zu wenig Energie für die Beichte.', '⚠️ Too little energy for the confession.'), 'warn'); return; }
      gs.energie          = clamp(gs.energie - 15, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler + 10, 0, 100);
      gs.beichteCooldownMonat = gs.monat + 3;
      logEvent(T('🕯️ Gebeichtet: Energie -15, Laune +10.', '🕯️ Confessed: Energy -15, Mood +10.'), 'good');
      return;
    }
  }

  // --- KASINO ---
  if (ortId === 'kasino') {
    const betraege = { waschen_100: 100, waschen_500: 500, waschen_1000: 1000 };
    let betrag = betraege[aktionsId];

    if (aktionsId === 'waschen_alles') {
      betrag = gs.losesBargeld;
      if (betrag <= 0) { logEvent(T('⚠️ Kein loses Bargeld zum Setzen.', '⚠️ No loose cash to bet.'), 'warn'); return; }
    }

    if (betrag !== undefined) {
      if (gs.losesBargeld < betrag) {
        logEvent(T(`⚠️ Nicht genug loses Bargeld. Vorhanden: ${formatEuro(gs.losesBargeld)}`, `⚠️ Not enough loose cash. Available: ${formatEuro(gs.losesBargeld)}`), 'warn');
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
        logEvent(T(`🎰 Gewaschen: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (+${pct - 100}% Bonus). Konto +${formatEuro(rueckgabe)}.`, `🎰 Laundered: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (+${pct - 100}% bonus). Account +${formatEuro(rueckgabe)}.`), 'good');
        oeffneModal(T('🎰 Gewaschen!', '🎰 Laundered!'),
          T(`Einsatz: <strong>${formatEuro(betrag)}</strong><br>
           Rückzahlung: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Ergebnis: <strong style="color:var(--accent2);">${diffStr}</strong><br><br>
           Das Geld ist legal auf deinem Bankkonto – als Spielgewinn verbucht.`, `Stake: <strong>${formatEuro(betrag)}</strong><br>
           Payout: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Result: <strong style="color:var(--accent2);">${diffStr}</strong><br><br>
           The money is legally in your bank account – booked as a gambling win.`),
          []
        );
      } else {
        soundNeutral && soundNeutral();
        logEvent(T(`🎰 Gewaschen: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (${pct}%, Provision ${formatEuro(-diff)}). Konto +${formatEuro(rueckgabe)}.`, `🎰 Laundered: ${formatEuro(betrag)} → ${formatEuro(rueckgabe)} (${pct}%, commission ${formatEuro(-diff)}). Account +${formatEuro(rueckgabe)}.`), 'warn');
        oeffneModal(T('🎰 Gewaschen (mit Abzug)', '🎰 Laundered (with deduction)'),
          T(`Einsatz: <strong>${formatEuro(betrag)}</strong><br>
           Rückzahlung: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Kasino-Provision: <strong style="color:var(--danger);">${formatEuro(-diff)}</strong><br><br>
           Das gereinigte Geld ist trotzdem auf deinem Konto – legal.`, `Stake: <strong>${formatEuro(betrag)}</strong><br>
           Payout: <strong>${formatEuro(rueckgabe)}</strong> (${pct}%)<br>
           Casino commission: <strong style="color:var(--danger);">${formatEuro(-diff)}</strong><br><br>
           The laundered money is still in your account – legal.`),
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
  oeffneModal(T('📈 Depot – Wertpapier kaufen', '📈 Portfolio – buy a security'),
    T(`Kontostand: <strong>${formatEuro(gs.kontostand)}</strong><br>
     Kaufe Wertpapiere mit deinem Kontoguthaben. Kursschwankungen werden monatlich berechnet.`, `Account balance: <strong>${formatEuro(gs.kontostand)}</strong><br>
     Buy securities with your account funds. Price swings are calculated monthly.`),
    aktionen
  );
}

/** Kaufdialog für eine spezifische Aktie – unbegrenzte Kauftranchen, Menü bleibt offen */
function oeffneKaufDialog(aktie) {
  const gs = gameState;
  const bestehend = gs.depot.find(p => p.id === aktie.id);
  const kurs = bestehend ? bestehend.aktuellerKurs : aktie.startKurs;

  if (gs.kontostand < kurs) {
    oeffneModal(T('❌ Nicht genug Geld', '❌ Not enough money'),
      T(`Kurs: <strong>${formatEuro(kurs)}</strong> pro Anteil.<br>
       Dein Konto: <strong>${formatEuro(gs.kontostand)}</strong>`, `Price: <strong>${formatEuro(kurs)}</strong> per share.<br>
       Your account: <strong>${formatEuro(gs.kontostand)}</strong>`), []);
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
      ? T(`<br>Im Depot: <strong>${bestehend.anteile} Anteile</strong> (Kaufkurs Ø ${formatEuro(bestehend.kaufkurs)})`, `<br>In portfolio: <strong>${bestehend.anteile} shares</strong> (avg buy price ${formatEuro(bestehend.kaufkurs)})`)
      : '';

    const aktionen = tranchen.map(stueck => {
      const kosten = Math.round(stueck * kurs);
      const kannKaufen = gs.kontostand >= kosten;
      return {
        label: kannKaufen
          ? T(`Kaufe ${stueck} Anteile → ${formatEuro(kosten)}`, `Buy ${stueck} shares → ${formatEuro(kosten)}`)
          : T(`[Zu teuer] ${stueck} Anteile = ${formatEuro(kosten)}`, `[Too expensive] ${stueck} shares = ${formatEuro(kosten)}`),
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
      T(`Kurs: <strong>${formatEuro(kurs)}</strong> · Konto: <strong>${formatEuro(gs.kontostand)}</strong>${pos}<br>
       Typ: ${aktie.typ === 'etf' ? '🛡️ ETF (stabil)' : '🎲 Spekulation (riskant)'} ·
       Rendite: <strong>${Math.round(aktie.renditeMin*100)}%</strong> bis <strong>+${Math.round(aktie.renditeMax*100)}%</strong> pro Monat`, `Price: <strong>${formatEuro(kurs)}</strong> · Account: <strong>${formatEuro(gs.kontostand)}</strong>${pos}<br>
       Type: ${aktie.typ === 'etf' ? '🛡️ ETF (stable)' : '🎲 Speculation (risky)'} ·
       Return: <strong>${Math.round(aktie.renditeMin*100)}%</strong> to <strong>+${Math.round(aktie.renditeMax*100)}%</strong> per month`),
      aktionen
    );
  }
  zeigeKaufMenu();
}

function kaufeAktie(aktie, stueck, kurs) {
  const gs = gameState;
  const kosten = Math.round(stueck * kurs);
  if (gs.kontostand < kosten) {
    logEvent(T('⚠️ Nicht genug Geld für Kauf.', '⚠️ Not enough money to buy.'), 'warn'); return;
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

  logEvent(T(`📈 ${stueck}× ${aktie.name} für ${formatEuro(kosten)} gekauft.`, `📈 Bought ${stueck}× ${aktie.name} for ${formatEuro(kosten)}.`), 'good');
  updateHUD();
}

/** Öffnet Verkaufs-Übersicht mit Teilverkauf */
function oeffneDepotVerkaufMenu() {
  const gs = gameState;
  if (gs.depot.length === 0) {
    oeffneModal(T('📉 Depot leer', '📉 Empty portfolio'), T('Du hast noch keine Wertpapiere.', 'You do not own any securities yet.'), []);
    return;
  }

  const aktionen = gs.depot.map(pos => {
    const wert   = Math.round(pos.anteile * pos.aktuellerKurs);
    const gewinn = wert - Math.round(pos.anteile * pos.kaufkurs);
    const pfeil  = gewinn >= 0 ? '▲' : '▼';
    return {
      label: T(`${pos.name}: ${pos.anteile} Anteile · ${formatEuro(pos.aktuellerKurs)}/Anteil · Ges. ${formatEuro(wert)} · ${pfeil}${formatEuro(Math.abs(gewinn))}`, `${pos.name}: ${pos.anteile} shares · ${formatEuro(pos.aktuellerKurs)}/share · Total ${formatEuro(wert)} · ${pfeil}${formatEuro(Math.abs(gewinn))}`),
      callback: () => oeffneTeilverkaufMenu(pos)
    };
  });

  const gesamtwert = gs.depot.reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
  oeffneModal(
    T('📉 Depot – Position wählen', '📉 Portfolio – choose a position'),
    T(`Gesamtwert Depot: <strong>${formatEuro(Math.round(gesamtwert))}</strong><br>
     Wähle eine Position für Teil- oder Vollverkauf:`, `Total portfolio value: <strong>${formatEuro(Math.round(gesamtwert))}</strong><br>
     Choose a position for partial or full sale:`),
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
    { stueck: maxAnz,                    label: T('100% (Alles)', '100% (Everything)') },
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
      label: T(`${label}: ${stueck} Anteile → ${formatEuro(wert)} (G/V: ${gvStr})`, `${label}: ${stueck} shares → ${formatEuro(wert)} (P/L: ${gvStr})`),
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
    T(`📉 ${pos.name} verkaufen`, `📉 Sell ${pos.name}`),
    T(`Kurs: <strong>${formatEuro(kurs)}</strong> · Bestand: <strong>${maxAnz} Anteile</strong><br>
     Kaufkurs Ø: <strong>${formatEuro(pos.kaufkurs)}</strong> ·
     Latenter G/V: <strong>${pfeil}${formatEuro(Math.abs(Math.round(maxAnz * gewinnPro)))}</strong>`, `Price: <strong>${formatEuro(kurs)}</strong> · Holding: <strong>${maxAnz} shares</strong><br>
     Avg buy price: <strong>${formatEuro(pos.kaufkurs)}</strong> ·
     Unrealised P/L: <strong>${pfeil}${formatEuro(Math.abs(Math.round(maxAnz * gewinnPro)))}</strong>`),
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
  logEvent(T(`📉 ${pos.name}: ${stueck} Anteile verkauft → +${formatEuro(wert)} (${gewinn >= 0 ? '+' : ''}${formatEuro(gewinn)} G/V).`, `📉 ${pos.name}: sold ${stueck} shares → +${formatEuro(wert)} (${gewinn >= 0 ? '+' : ''}${formatEuro(gewinn)} P/L).`),
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
    } else {
      // Verteilte Rendite (Dreieckverteilung, zentrale Tendenz). Auch alte
      // Spielstände mit binärem up/down werden auf die gleichen Grenzen
      // (down..up) abgebildet, damit nichts mehr „alles oder nichts" ist.
      let lo = pos.renditeMin, hi = pos.renditeMax;
      if (typeof lo !== 'number' || typeof hi !== 'number') {
        lo = Math.min(pos.down ?? -0.25, pos.up ?? 0.50);
        hi = Math.max(pos.down ?? -0.25, pos.up ?? 0.50);
      }
      const r = (Math.random() + Math.random()) / 2;   // Dreieckverteilung
      rendite = lo + r * (hi - lo);
    }
    const alterKurs = pos.aktuellerKurs;
    pos.aktuellerKurs = Math.max(0.01, pos.aktuellerKurs * (1 + rendite));
    const pct   = (rendite >= 0 ? '+' : '') + (rendite * 100).toFixed(1);   // "+" bei Gewinn
    const pfeil = rendite >= 0 ? '▲' : '▼';
    meldungen.push(`${pfeil} ${pos.name}: ${pct}% → Kurs ${formatEuro(pos.aktuellerKurs)}`);
    logEvent(T(`📊 ${pos.name} ${pfeil}${pct}%`, `📊 ${pos.name} ${pfeil}${pct}%`), rendite < 0 ? 'danger' : 'good');
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
  const warAlg1 = gs.status === 'ALG1';   // für ALG I → II Umstellungs-Hinweis

  // Hilfsfunktion: nicht zahlbarer Betrag → Zahlungsrückstand
  const fehlt = (betrag, was) => {
    if (betrag <= 0) return;
    gs.zahlungsRueckstand += betrag;
    meldungen.push(T(`❗ ${was} nicht (voll) bezahlt: +${formatEuro(betrag)} Rückstand.`, `❗ ${was} not (fully) paid: +${formatEuro(betrag)} arrears.`));
    logEvent(T(`❗ Rückstand +${formatEuro(betrag)} (${was}).`, `❗ Arrears +${formatEuro(betrag)} (${was}).`), 'danger');
  };

  // ALG1 → ALG2 Wechsel (ALG I läuft 4 Monate)
  if (gs.monat > 4 && gs.status === 'ALG1') {
    gs.status = 'ALG2';
    meldungen.push(T('⚠️ ALG I ausgelaufen – jetzt Bürgergeld!', '⚠️ ALG I expired – now on welfare!'));
    logEvent(T('⚠️ ALG I → Bürgergeld.', '⚠️ ALG I → welfare.'), 'danger');
  }
  if (gs.kontostand <= 0 && gs.status === 'ALG1') {
    gs.status = 'ALG2';
    meldungen.push(T('💸 Konto leer – Bürgergeld-Modus.', '💸 Account empty – welfare mode.'));
    logEvent(T('💸 Konto leer → Bürgergeld.', '💸 Account empty → welfare.'), 'danger');
  }

  // ---- Minijob: anrechenbarer Teil (Freibetrag bleibt frei) ----
  const minijobAnrechenbar = gs.minijobLohn > 0
    ? Math.max(0, gs.minijobLohn - minijobFreibetrag(gs.minijobLohn))
    : 0;

  // ALG-Zahlung (Grundleistung, danach Einkommens-Anrechnung)
  const kinderN = (gs.kindergeldKinder || []).length;
  if (gs.status === 'ALG1') {
    if (gs.algGesperrt) {
      meldungen.push(T('🛑 ALG I gesperrt! Besuche das Arbeitsamt um die Sperre aufzuheben.', '🛑 ALG I suspended! Visit the job centre to lift the suspension.'));
      logEvent(T('🛑 ALG I gesperrt – kein Geld!', '🛑 ALG I suspended – no money!'), 'danger');
    } else {
      // ALG I: 1.440 €/Monat, mit mind. einem Kind 1.608 €/Monat
      const alg1Basis  = kinderN > 0 ? 1608 : 1440;
      const auszahlung = Math.max(0, alg1Basis - minijobAnrechenbar);
      gs.kontostand += auszahlung; staatGibt(auszahlung);
      meldungen.push(T(`✅ ALG I: +${formatEuro(auszahlung)}${kinderN > 0 ? ` (inkl. Kinderzuschlag)` : ''}${minijobAnrechenbar > 0 ? ` (nach Anrechnung ${formatEuro(minijobAnrechenbar)} Minijob)` : ''}`, `✅ ALG I: +${formatEuro(auszahlung)}${kinderN > 0 ? ` (incl. child supplement)` : ''}${minijobAnrechenbar > 0 ? ` (after deducting ${formatEuro(minijobAnrechenbar)} minijob)` : ''}`));
      logEvent(T(`✅ ALG I +${formatEuro(auszahlung)}.`, `✅ ALG I +${formatEuro(auszahlung)}.`), 'good');
    }
  } else {
    // ALG2: Vermögensprüfung – nur alle 3 Monate, zählt Konto + (sichtbares) Depot
    // (Gold im Garten, Schwarzkasse und verschleiertes Depot zählen NICHT)
    const istPruefMonat  = (gs.monat % 3 === 0);
    const depotWert      = (gs.depot || []).reduce((s, p) => s + p.anteile * p.aktuellerKurs, 0);
    const sichtbaresDepot = gs.depotVerschleiert ? 0 : depotWert;
    const pruefVermoegen = gs.kontostand + sichtbaresDepot;
    if (istPruefMonat && pruefVermoegen > ALG2_VERMOEGENS_GRENZE) {
      meldungen.push(T(`🛑 Vermögensprüfung (alle 3 Monate): Konto + sichtbares Depot = ${formatEuro(pruefVermoegen)} > ${formatEuro(ALG2_VERMOEGENS_GRENZE)}. Kein Bürgergeld diesen Monat!`, `🛑 Asset check (every 3 months): account + visible portfolio = ${formatEuro(pruefVermoegen)} > ${formatEuro(ALG2_VERMOEGENS_GRENZE)}. No welfare this month!`));
      logEvent(T('🛑 Vermögensprüfung: zu viel sichtbares Vermögen.', '🛑 Asset check: too much visible wealth.'), 'danger');
    } else {
      // Bürgergeld-Grundleistung + pro Kind 390 € Regelsatz, davon wird das
      // Kindergeld (300 €/Kind) angerechnet → netto +90 €/Kind.
      const kinderRegel = kinderN * 390, kinderKgAbzug = kinderN * 300;
      const kinderNetto = Math.max(0, kinderRegel - kinderKgAbzug);
      const auszahlung = Math.max(0, ALG2_ZAHLUNG - minijobAnrechenbar) + kinderNetto;
      gs.kontostand += auszahlung; staatGibt(auszahlung);
      meldungen.push(T(`✅ Bürgergeld: +${formatEuro(auszahlung)}${kinderN > 0 ? ` (inkl. ${kinderN}× Kind-Regelsatz 390 € − Kindergeld 300 €)` : ''}${minijobAnrechenbar > 0 ? ` (nach Anrechnung ${formatEuro(minijobAnrechenbar)} Minijob)` : ''}`, `✅ Welfare: +${formatEuro(auszahlung)}${kinderN > 0 ? ` (incl. ${kinderN}× child rate 390 € − child benefit 300 €)` : ''}${minijobAnrechenbar > 0 ? ` (after deducting ${formatEuro(minijobAnrechenbar)} minijob)` : ''}`));
      logEvent(T(`✅ Bürgergeld +${formatEuro(auszahlung)}.`, `✅ Welfare +${formatEuro(auszahlung)}.`), 'good');
    }
  }

  // ---- Minijob: Bruttolohn aufs Konto + Energie kostet ----
  if (gs.minijobLohn > 0) {
    gs.kontostand += gs.minijobLohn;
    gs.energie     = clamp(gs.energie - 10, 0, 100);
    const fb = minijobFreibetrag(gs.minijobLohn);
    meldungen.push(T(`💼 Minijob: +${formatEuro(gs.minijobLohn)} (anrechnungsfrei: ${formatEuro(fb)}). Energie -10.`, `💼 Minijob: +${formatEuro(gs.minijobLohn)} (exempt: ${formatEuro(fb)}). Energy -10.`));
    logEvent(T(`💼 Minijob +${formatEuro(gs.minijobLohn)}.`, `💼 Minijob +${formatEuro(gs.minijobLohn)}.`), 'good');
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
      meldungen.push(T(`📑 Mehrbedarfe: +${formatEuro(mbSumme)} (${mbTeile.join(', ')})`, `📑 Extra needs: +${formatEuro(mbSumme)} (${mbTeile.join(', ')})`));
      logEvent(T(`📑 Mehrbedarfe +${formatEuro(mbSumme)}.`, `📑 Extra needs +${formatEuro(mbSumme)}.`), 'good');
    }
  }

  // ---- Einstiegsgeld (Gründerbonus, anrechnungsfrei) ----
  if (gs.einstiegsgeldMonate > 0) {
    gs.kontostand += EINSTIEGSGELD_BETRAG; staatGibt(EINSTIEGSGELD_BETRAG);
    gs.einstiegsgeldMonate--;
    meldungen.push(T(`🚀 Einstiegsgeld: +${formatEuro(EINSTIEGSGELD_BETRAG)} (noch ${gs.einstiegsgeldMonate} Monate)`, `🚀 Start-up grant: +${formatEuro(EINSTIEGSGELD_BETRAG)} (${gs.einstiegsgeldMonate} months left)`));
    logEvent(T(`🚀 Einstiegsgeld +${formatEuro(EINSTIEGSGELD_BETRAG)}.`, `🚀 Start-up grant +${formatEuro(EINSTIEGSGELD_BETRAG)}.`), 'good');
  }

  // ---- Schein-WG: Bonus, solange Partnerin da ist (sonst auto-aus) ----
  if (gs.scheinWG && gs.frauAusgezogen) {
    gs.scheinWG = false;
    meldungen.push(T('🏠 Schein-WG hinfällig – Partnerin ist ausgezogen.', '🏠 Fake flat-share void – your partner has moved out.'));
  } else if (gs.scheinWG) {
    gs.kontostand += SCHEINWG_BETRAG; staatGibt(SCHEINWG_BETRAG);
    meldungen.push(T(`🏠 Schein-WG: +${formatEuro(SCHEINWG_BETRAG)} (voller Single-Satz).`, `🏠 Fake flat-share: +${formatEuro(SCHEINWG_BETRAG)} (full single rate).`));
    logEvent(T(`🏠 Schein-WG +${formatEuro(SCHEINWG_BETRAG)}.`, `🏠 Fake flat-share +${formatEuro(SCHEINWG_BETRAG)}.`), 'warn');
  }

  // ---- Immobilie: Mieteinnahmen / KdU-Masche + Wertsteigerung ----
  if (gs.immobilie) {
    let einnahme = 0;
    if (gs.immobilie.modus === 'eigen') {
      // Amt zahlt KdU an den Strohmann – nur im Bürgergeld-Modus, und nur solange
      // die Masche nicht aufgeflogen ist. Aufgeflogen → Amt zahlt nichts mehr
      // (Villa bleibt aber dein Besitz/Zuhause).
      if (gs.status === 'ALG2' && !gs.kduMascheGestoppt) einnahme = gs.immobilie.miete;
    } else {
      einnahme = gs.immobilie.miete; // echte Mieteinnahmen
    }
    if (einnahme > 0) {
      gs.schwarzeKasse += einnahme;
      if (gs.immobilie.modus === 'eigen') staatGibt(einnahme); // KdU kommt vom Amt
      gs.risikoRaster   = clamp(gs.risikoRaster + 6, 0, 100);
      const quelle = gs.immobilie.modus === 'eigen' ? T('Amt-Miete (KdU-Masche)', 'office rent (housing-cost scam)') : T('Mieteinnahmen', 'rental income');
      meldungen.push(T(`🏘️ Immobilie – ${quelle}: +${formatEuro(einnahme)} Schwarzkasse. Risiko +6.`, `🏘️ Property – ${quelle}: +${formatEuro(einnahme)} slush fund. Risk +6.`));
      logEvent(T(`🏘️ Immobilie +${formatEuro(einnahme)} Schwarzkasse.`, `🏘️ Property +${formatEuro(einnahme)} slush fund.`), 'warn');
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
      meldungen.push(T(`🏘️ Immobilien-Rate: -${formatEuro(zahlbar)} (Restschuld: ${formatEuro(gs.immobilie.restSchuld)}).`, `🏘️ Property installment: -${formatEuro(zahlbar)} (remaining debt: ${formatEuro(gs.immobilie.restSchuld)}).`));
      fehlt(rate - zahlbar, T('Immobilien-Rate', 'property installment'));
    }
    // Wertsteigerung +2 %/Monat
    gs.immobilie.wert = Math.round(gs.immobilie.wert * IMMO_WERT_WACHSTUM);
    meldungen.push(T(`📈 Immobilienwert: ${formatEuro(gs.immobilie.wert)} (+2 %).`, `📈 Property value: ${formatEuro(gs.immobilie.wert)} (+2 %).`));
  }

  // ---- Villa-Trick: Einliegerwohnung schwarz vermietet ----
  // Nur sinnvoll, wenn du selbst in der Villa wohnst (Immobilie auf Eigennutzung).
  if (gs.einliegerVermietet && gs.immobilie && gs.immobilie.modus === 'eigen') {
    gs.schwarzeKasse += EINLIEGER_MIETE;
    gs.risikoRaster   = clamp(gs.risikoRaster + 4, 0, 100);
    meldungen.push(T(`🚪 Einliegerwohnung schwarz vermietet: +${formatEuro(EINLIEGER_MIETE)} Schwarzkasse. Risiko +4.`, `🚪 Granny flat rented under the table: +${formatEuro(EINLIEGER_MIETE)} slush fund. Risk +4.`));
    logEvent(T(`🚪 Einliegerwohnung +${formatEuro(EINLIEGER_MIETE)} Schwarzkasse.`, `🚪 Granny flat +${formatEuro(EINLIEGER_MIETE)} slush fund.`), 'warn');
  } else if (gs.einliegerVermietet) {
    // Villa nicht mehr selbst bewohnt → Masche entfällt automatisch
    gs.einliegerVermietet = false;
  }

  // ---- Mietkaution-Darlehen: Rate vom Konto ----
  if (gs.kautionRest > 0) {
    const rate = Math.min(KAUTION_RATE, gs.kautionRest);
    const zahlbar = Math.min(rate, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    gs.kautionRest -= zahlbar;
    meldungen.push(T(`📦 Kaution-Darlehen: -${formatEuro(zahlbar)} (Rest: ${formatEuro(gs.kautionRest)}).`, `📦 Deposit loan: -${formatEuro(zahlbar)} (remaining: ${formatEuro(gs.kautionRest)}).`));
    fehlt(rate - zahlbar, T('Kaution-Rate', 'deposit installment'));
  }

  // ---- Depot: Monatliche Kursaktualisierung ----
  const depotMeldungen = aktuelisiereDepotKurse();
  if (depotMeldungen && depotMeldungen.length > 0) {
    meldungen.push(T('📊 <strong>Depot-Update:</strong><br>', '📊 <strong>Portfolio update:</strong><br>') + depotMeldungen.join('<br>'));
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
      meldungen.push(T(`🏴 Schattenbank-Depotgebühr: -${formatEuro(fee)} (5% des verschleierten Depots).`, `🏴 Shadow-bank portfolio fee: -${formatEuro(fee)} (5% of the hidden portfolio).`));
      logEvent(T(`🏴 Depotgebühr -${formatEuro(fee)}.`, `🏴 Portfolio fee -${formatEuro(fee)}.`), 'warn');
    }
  }

  // ---- Loan-Shark: Monatliche Zinsen 20% ----
  if (gs.loanSharkSchuld > 0) {
    const zinsen = Math.round(gs.loanSharkSchuld * 0.10);
    gs.loanSharkSchuld += zinsen;
    gs.risikoRaster     = clamp(gs.risikoRaster + 5, 0, 100);
    meldungen.push(T(`🦈 Kredithai-Zinsen: +${formatEuro(zinsen)} → Schulden jetzt ${formatEuro(gs.loanSharkSchuld)}. Risiko +5.`, `🦈 Loan-shark interest: +${formatEuro(zinsen)} → debt now ${formatEuro(gs.loanSharkSchuld)}. Risk +5.`));
    logEvent(T(`🦈 Zinsen +${formatEuro(zinsen)}. Schulden: ${formatEuro(gs.loanSharkSchuld)}.`, `🦈 Interest +${formatEuro(zinsen)}. Debt: ${formatEuro(gs.loanSharkSchuld)}.`), 'danger');
  }

  // ---- Auslands-Kindergeld (Kindergeld-Paradoxon) ----
  // Ohne Tarnung: fließt, wird aber voll als Einkommen angerechnet → netto 0.
  // Mit Unterhalts-Tarnung (Schattenbank): wird behalten – aber Prüf-Risiko!
  if (gs.kindergeldKinder && gs.kindergeldKinder.length > 0) {
    const anzahl  = gs.kindergeldKinder.length;
    const zahlung = anzahl * 300;
    if (gs.unterhaltsTarnung) {
      const tarnGebuehr = Math.round(zahlung * 0.10);   // Schattenbank nimmt 10% der Kindergeld-Summe
      gs.kontostand  += zahlung; staatGibt(zahlung);
      gs.kontostand  -= tarnGebuehr;
      gs.risikoRaster = clamp(gs.risikoRaster + anzahl * 5, 0, 100);
      meldungen.push(T(`👶 Auslands-Kindergeld (getarnt): +${formatEuro(zahlung)}, Tarnungs-Gebühr -${formatEuro(tarnGebuehr)} (10%). Risiko +${anzahl * 5}.`, `👶 Foreign child benefit (disguised): +${formatEuro(zahlung)}, cover-up fee -${formatEuro(tarnGebuehr)} (10%). Risk +${anzahl * 5}.`));
      logEvent(T(`👶 Kindergeld +${formatEuro(zahlung)} (Tarnung -${formatEuro(tarnGebuehr)}).`, `👶 Child benefit +${formatEuro(zahlung)} (cover-up -${formatEuro(tarnGebuehr)}).`), 'warn');
    } else {
      meldungen.push(T(`👶 Auslands-Kindergeld ${formatEuro(zahlung)} fließt, wird aber voll als Einkommen angerechnet → netto 0 €. Tipp: Unterhalts-Tarnung in der Schattenbank.`, `👶 Foreign child benefit ${formatEuro(zahlung)} comes in but is fully counted as income → net 0 €. Tip: alimony cover-up at the shadow bank.`));
      logEvent(T('👶 Kindergeld komplett angerechnet (netto 0).', '👶 Child benefit fully deducted (net 0).'), '');
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
    if (gs.einliegerVermietet) fakeFaktoren += 1;
    if (fakeFaktoren > 0) {
      let chance = Math.min(0.85, 0.15 * fakeFaktoren);
      if (gs.sachbearbeiterBestochen) chance *= 0.5;   // geschmierter Sachbearbeiter
      if (Math.random() < chance) {
        let rueck = 0;
        const gestrichen = [];
        // Rückforderung NUR für den letzten Monat (×1, nicht mehr ×3)
        if (gs.ernaehrungFake) {
          rueck += MEHRBEDARF_BETRAG.ernaehrung;
          gs.mehrbedarf.ernaehrung = false; gs.ernaehrungFake = false;
          gestrichen.push(T('Ernährungs-Mehrbedarf', 'dietary extra need'));
        }
        if (gs.unterhaltsTarnung) {
          rueck += (gs.kindergeldKinder || []).length * 300;
          gs.unterhaltsTarnung = false;
          gestrichen.push(T('Unterhalts-Tarnung', 'alimony cover-up'));
        }
        if (gs.scheinWG) {
          rueck += SCHEINWG_BETRAG;
          gs.scheinWG = false;
          gestrichen.push(T('Schein-WG (Hausbesuch!)', 'fake flat-share (home visit!)'));
        }
        if (gs.immobilie && gs.immobilie.modus === 'eigen' && gs.status === 'ALG2') {
          rueck += gs.immobilie.miete;          // letzte Amts-Miete zurückgefordert
          gs.kduMascheGestoppt = true;          // Amt zahlt ab jetzt keine Miete mehr …
          // … aber die Villa BLEIBT in deinem Besitz/Zuhause (kein Zwangs-Vermieten).
          gestrichen.push(T('KdU-Masche aufgeflogen – Amt zahlt keine Miete mehr (Villa bleibt dein)', 'Housing-cost scam exposed – office stops paying rent (villa stays yours)'));
        }
        // Einliegerwohnungs-Vermietung läuft trotz Prüfung WEITER (separate
        // Vermietung, nicht Teil der KdU-Masche) → wird nicht aufgedeckt/gestoppt.
        gs.kontostand   = Math.max(0, gs.kontostand - rueck);
        staatGibt(-rueck);   // Rückzahlung → "Vom Staat kassiert" sinkt
        gs.risikoRaster = clamp(gs.risikoRaster + 30, 0, 100);
        meldungen.push(T(`🚨 Jobcenter-Prüfung AUFGEFLOGEN! Rückforderung ${formatEuro(rueck)}, Risiko +30. Gestrichen: ${gestrichen.join(', ')}.`, `🚨 Job-centre check BUSTED! Clawback ${formatEuro(rueck)}, risk +30. Cancelled: ${gestrichen.join(', ')}.`));
        logEvent(T(`🚨 Jobcenter-Prüfung aufgeflogen: -${formatEuro(rueck)}, Risiko +30.`, `🚨 Job-centre check busted: -${formatEuro(rueck)}, risk +30.`), 'danger');
        sozialbetrugErwischt();   // strafrechtliche Eskalation (Ermittlung → Bewährung → Knast)
      } else {
        meldungen.push(T('🔍 Jobcenter-Prüfung: diesmal nichts aufgefallen (Glück gehabt).', '🔍 Job-centre check: nothing noticed this time (got lucky).'));
        logEvent(T('🔍 Jobcenter-Prüfung überstanden.', '🔍 Job-centre check survived.'), 'warn');
      }
    }
  }

  // Immobilien-Fake und andere Cheat-Extras → schwarze Kasse
  if (gs.monatlicheExtras > 0) {
    gs.schwarzeKasse += gs.monatlicheExtras;
    meldungen.push(T(`🎭 Sozialbetrug: +${formatEuro(gs.monatlicheExtras)} (Schwarzkasse)`, `🎭 Welfare fraud: +${formatEuro(gs.monatlicheExtras)} (slush fund)`));
    logEvent(T(`🎭 Cheat +${formatEuro(gs.monatlicheExtras)}.`, `🎭 Cheat +${formatEuro(gs.monatlicheExtras)}.`), 'warn');
  }

  // Risiko-Aufschlag durch Cheats
  if (gs.risikoProMonat > 0) {
    gs.risikoRaster = clamp(gs.risikoRaster + gs.risikoProMonat, 0, 100);
    meldungen.push(T(`⚠️ Cheat-Risiko: +${gs.risikoProMonat}%`, `⚠️ Cheat risk: +${gs.risikoProMonat}%`));
    logEvent(T(`⚠️ Cheat-Risiko +${gs.risikoProMonat}.`, `⚠️ Cheat risk +${gs.risikoProMonat}.`), 'danger');
  }

  // ---- Schattenbank-Gebühr: 5% der Schwarzkasse pro Monat ----
  if (gs.schattenbankAktiv && gs.schwarzeKasse > 0) {
    const gebuehr = Math.floor(gs.schwarzeKasse * 0.05);
    gs.schwarzeKasse -= gebuehr;
    meldungen.push(T(`🏴 Schattenbank-Gebühr: -${formatEuro(gebuehr)} (5% der Schwarzkasse).`, `🏴 Shadow-bank fee: -${formatEuro(gebuehr)} (5% of the slush fund).`));
    logEvent(T(`🏴 Schattenbank -${formatEuro(gebuehr)}.`, `🏴 Shadow bank -${formatEuro(gebuehr)}.`), 'warn');
  }

  // Miete
  if (gs.status === 'ALG1') {
    gs.kontostand -= MIETE;
    meldungen.push(T(`🏠 Miete: -${formatEuro(MIETE)} (selbst zahlen, ALG I)`, `🏠 Rent: -${formatEuro(MIETE)} (paid yourself, ALG I)`));
    logEvent(T(`🏠 Miete -${formatEuro(MIETE)}.`, `🏠 Rent -${formatEuro(MIETE)}.`), 'warn');
    if (gs.kontostand < 0) {
      gs.kontostand = 0; gs.status = 'ALG2';
      meldungen.push(T('❌ Konto überzogen → Bürgergeld-Notfall!', '❌ Account overdrawn → welfare emergency!'));
      logEvent(T('❌ Konto überzogen → Bürgergeld.', '❌ Account overdrawn → welfare.'), 'danger');
    }
  } else {
    // Staat zahlt die Miete = geldwerter Vorteil -> zählt mit.
    // Ausnahme: bei der Immobilien-KdU-Masche (Eigennutzung) wird die
    // Amt-Miete bereits im Immobilien-Block gezählt -> keine Doppelzählung.
    if (!(gs.immobilie && gs.immobilie.modus === 'eigen')) {
      staatGibt(MIETE);
      meldungen.push(T(`🏠 Miete vom Staat übernommen: +${formatEuro(MIETE)} (gespart).`, `🏠 Rent covered by the state: +${formatEuro(MIETE)} (saved).`));
      logEvent(T(`🏠 Miete Staat +${formatEuro(MIETE)}.`, `🏠 Rent from state +${formatEuro(MIETE)}.`), 'good');
    } else {
      meldungen.push(T('🏠 Wohnkosten laufen über die Immobilien-Masche.', '🏠 Housing costs run through the property scam.'));
    }
  }

  // Krankenversicherung vom Staat übernommen (geldwerter Vorteil, kein Bargeld)
  staatGibt(KRANKENKASSE_BEITRAG);
  meldungen.push(T(`🏥 Krankenkasse vom Staat: +${formatEuro(KRANKENKASSE_BEITRAG)} (Beitrag übernommen).`, `🏥 Health insurance from the state: +${formatEuro(KRANKENKASSE_BEITRAG)} (contribution covered).`));

  // Laufende Lebenshaltung (Strom, Internet, Handy) – selbst zahlen.
  // Bei ALG2 übernimmt das Jobcenter den Strom (100 €) → günstiger + zählt zum Staat.
  {
    const stromVomAmt = (gs.status === 'ALG2') ? 100 : 0;
    if (stromVomAmt) { staatGibt(stromVomAmt); }
    const eigeneNK = NEBENKOSTEN - stromVomAmt;
    const zahlbar = Math.min(eigeneNK, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    meldungen.push(stromVomAmt
      ? T(`💡 Nebenkosten: -${formatEuro(zahlbar)} (Strom vom Amt übernommen, +${formatEuro(stromVomAmt)}).`, `💡 Utilities: -${formatEuro(zahlbar)} (electricity covered by the office, +${formatEuro(stromVomAmt)}).`)
      : T(`💡 Nebenkosten: -${formatEuro(zahlbar)} (Strom, Internet, Handy).`, `💡 Utilities: -${formatEuro(zahlbar)} (electricity, internet, phone).`));
    fehlt(eigeneNK - zahlbar, T('Nebenkosten', 'utilities'));
  }

  // ---- Schmiergeld für den Sachbearbeiter ----
  if (gs.sachbearbeiterBestochen) {
    if (gs.kontostand >= SACHBEARBEITER_KOSTEN) {
      gs.kontostand -= SACHBEARBEITER_KOSTEN;
      meldungen.push(T(`🤝 Sachbearbeiter-Schmiergeld: -${formatEuro(SACHBEARBEITER_KOSTEN)}.`, `🤝 Caseworker bribe: -${formatEuro(SACHBEARBEITER_KOSTEN)}.`));
    } else {
      gs.sachbearbeiterBestochen = false;
      meldungen.push(T('🤝 Schmiergeld nicht gezahlt – der Sachbearbeiter deckt dich nicht mehr!', '🤝 Bribe not paid – the caseworker no longer covers for you!'));
      logEvent(T('🤝 Schmiergeld geplatzt.', '🤝 Bribe fell through.'), 'warn');
    }
  }

  // ---- Sucht: monatliche Folgen ----
  if (gs.suchtStufe > 0) {
    const kosten = gs.suchtStufe * 120;
    const zahlbar = Math.min(kosten, Math.max(0, gs.kontostand));
    gs.kontostand      -= zahlbar;
    gs.gesundheit       = clamp(gs.gesundheit - 4 * gs.suchtStufe, 0, 100);
    gs.happinessSpieler = clamp(gs.happinessSpieler - 3 * gs.suchtStufe, 0, 100);
    meldungen.push(T(`🍺 Sucht (Stufe ${gs.suchtStufe}): -${formatEuro(zahlbar)}, Gesundheit -${4*gs.suchtStufe}, Laune -${3*gs.suchtStufe}. Entzug in der Arztpraxis!`, `🍺 Addiction (level ${gs.suchtStufe}): -${formatEuro(zahlbar)}, Health -${4*gs.suchtStufe}, Mood -${3*gs.suchtStufe}. Detox at the doctor’s office!`));
    logEvent(T(`🍺 Sucht Stufe ${gs.suchtStufe}: -${formatEuro(zahlbar)}.`, `🍺 Addiction level ${gs.suchtStufe}: -${formatEuro(zahlbar)}.`), 'danger');
  }

  // Natürlicher Verfall
  gs.energie          = clamp(gs.energie - 5, 0, 100);
  gs.happinessSpieler = clamp(gs.happinessSpieler - 3, 0, 100);
  // Partnerlaune nur verfall wenn noch zusammen
  if (!gs.frauAusgezogen) {
    gs.happinessPartner = clamp(gs.happinessPartner - 2, 0, 100);
  }

  // ---- Lebensmittel: rollender Vorrat (kein Monats-Stichtag mehr) ----
  // Verbrauch/Hunger laufen tagesweise in tagGewechselt(); hier nur Hinweis.
  if ((gs.lebensmittelTageRest || 0) <= 0) {
    meldungen.push(T('⚠️ Kühlschrank ist leer – einkaufen gehen!', '⚠️ Fridge is empty – go shopping!'));
  }

  // ---- Frau ausgezogen – Prüfung ----
  if (!gs.frauAusgezogen && gs.happinessPartner < 20) {
    gs.frauAusgezogen    = true;
    gs.unterhaltProMonat = 1000;
    meldungen.push(T('💔 Deine Partnerin ist ausgezogen! Unterhalt: 1.000 €/Monat. Kaufe Geschenke für 1.000 € für ihre Rückkehr.', '💔 Your partner has moved out! Alimony: 1,000 €/month. Buy gifts worth 1,000 € for her return.'));
    logEvent(T('💔 Frau ausgezogen! Unterhalt 1.000€/M.', '💔 Wife moved out! Alimony 1,000€/mo.'), 'danger');
    soundAlarm && soundAlarm();
  }
  // ---- Unterhalt abziehen ----
  if (gs.frauAusgezogen && gs.unterhaltProMonat > 0) {
    const zahlbar = Math.min(gs.unterhaltProMonat, Math.max(0, gs.kontostand));
    gs.kontostand -= zahlbar;
    meldungen.push(T(`💸 Unterhalt: -${formatEuro(zahlbar)}`, `💸 Alimony: -${formatEuro(zahlbar)}`));
    logEvent(T(`💸 Unterhalt -${formatEuro(zahlbar)}.`, `💸 Alimony -${formatEuro(zahlbar)}.`), 'danger');
    fehlt(gs.unterhaltProMonat - zahlbar, T('Unterhalt', 'alimony'));
  }

  // ---- Gesundheit – Krankenhaus bei < 20 ----
  if (gs.gesundheit < 20 && gs.gesundheit > 0) {
    const behandlung = 20000;
    if (gs.kontostand >= behandlung) {
      gs.kontostand -= behandlung;
      gs.gesundheit  = clamp(gs.gesundheit + 20, 0, 100);
      meldungen.push(T(`🏥 Krankenhaus: -${formatEuro(behandlung)}, Gesundheit +20.`, `🏥 Hospital: -${formatEuro(behandlung)}, Health +20.`));
      logEvent(T('🏥 Krankenhausaufenthalt! -20.000€, Gesundheit +20.', '🏥 Hospital stay! -20,000€, Health +20.'), 'danger');
    } else {
      meldungen.push(T('🏥 Krankenhaus nötig aber kein Geld! Gesundheit kritisch!', '🏥 Hospital needed but no money! Health critical!'));
      logEvent(T('🏥 KEIN GELD FÜR KRANKENHAUS! Gesundheit kritisch!', '🏥 NO MONEY FOR HOSPITAL! Health critical!'), 'danger');
    }
  }
  // Game Over bei Gesundheit 0
  if (gs.gesundheit <= 0) {
    triggerGameOver('gesundheit');
    return;
  }

  // ---- Arbeitsamt-Sperre aufheben wenn Besuch gemacht ----
  if (gs.algGesperrt) {
    meldungen.push(T('🛑 ALG gesperrt wegen verpasster Termine! Bitte Arbeitsamt besuchen.', '🛑 Benefits suspended due to missed appointments! Please visit the job centre.'));
    logEvent(T('🛑 ALG gesperrt – Arbeitsamt aufsuchen!', '🛑 Benefits suspended – visit the job centre!'), 'danger');
  }

  // ---- Loan-Shark Mahnung-System ----
  if (gs.loanSharkSchuld > 0) {
    gs.loanSharkMahnungStufe = (gs.loanSharkMahnungStufe || 0) + 1;
    // Rückzahlungszeit verdoppelt: Konsequenzen erst bei Stufe 2 / 4 / 6
    if (gs.loanSharkMahnungStufe === 2) {
      meldungen.push(T('🦈 Kredithai-Mahnung: Zahle deine Schulden!', '🦈 Loan-shark reminder: Pay your debts!'));
      logEvent(T('🦈 MAHNUNG vom Kredithai!', '🦈 REMINDER from the loan shark!'), 'danger');
      setTimeout(() => oeffneModal(T('🦈 Mahnung vom Kredithai', '🦈 Reminder from the loan shark'),
        T(`Du schuldest <strong>${formatEuro(gs.loanSharkSchuld)}</strong>.<br><br>`
        + 'Zahle bald, sonst kommen Eintreiber!',
          `You owe <strong>${formatEuro(gs.loanSharkSchuld)}</strong>.<br><br>`
        + 'Pay soon or the collectors will come!'), []), 400);
    } else if (gs.loanSharkMahnungStufe === 4) {
      gs.gesundheit = clamp(gs.gesundheit - 5, 0, 100);
      meldungen.push(T('🦈 Erster Besuch der Eintreiber: Gesundheit -5!', '🦈 First visit from the collectors: Health -5!'));
      logEvent(T('🦈 Eintreiber! Gesundheit -5.', '🦈 Collectors! Health -5.'), 'danger');
      soundAlarm && soundAlarm();
      setTimeout(() => oeffneModal(T('🦈 Eintreiber – erster Besuch!', '🦈 Collectors – first visit!'),
        T('Zwei Männer haben dich aufgesucht. Eine Warnung.<br><br>'
        + '<strong>Gesundheit −5</strong><br><br>'
        + `Schulden: ${formatEuro(gs.loanSharkSchuld)}`,
          'Two men paid you a visit. A warning.<br><br>'
        + '<strong>Health −5</strong><br><br>'
        + `Debt: ${formatEuro(gs.loanSharkSchuld)}`), []), 400);
    } else if (gs.loanSharkMahnungStufe >= 6) {
      gs.gesundheit = clamp(gs.gesundheit - 15, 0, 100);
      meldungen.push(T('🦈 Zweiter Besuch! Schlimme Verletzungen: Gesundheit -15!', '🦈 Second visit! Serious injuries: Health -15!'));
      logEvent(T('🦈 Zweiter Besuch! Gesundheit -15!', '🦈 Second visit! Health -15!'), 'danger');
      soundAlarm && soundAlarm();
      setTimeout(() => oeffneModal(T('🦈 Eintreiber – zweiter Besuch!', '🦈 Collectors – second visit!'),
        T('Sie haben es ernst gemeint. Du liegst verletzt am Boden.<br><br>'
        + '<strong>Gesundheit −15</strong><br><br>'
        + 'Zahle sofort oder das nächste Mal wird es schlimmer.',
          'They meant it. You are lying injured on the ground.<br><br>'
        + '<strong>Health −15</strong><br><br>'
        + 'Pay now or next time it gets worse.'), []), 400);
      gs.loanSharkMahnungStufe = 0; // Reset
    }
  } else {
    gs.loanSharkMahnungStufe = 0; // Schulden bezahlt → Reset
  }

  // Loses Bargeld beim Transport penalisieren (noch nicht gesichertes Geld ist Risiko)
  if (gs.losesBargeld > 0) {
    gs.risikoRaster = clamp(gs.risikoRaster + Math.floor(gs.losesBargeld / 200), 0, 100);
    meldungen.push(T(`⚠️ Loses Bargeld ${formatEuro(gs.losesBargeld)} erhöht Risiko! Zur Bank/Pfandleiher!`, `⚠️ Loose cash ${formatEuro(gs.losesBargeld)} raises risk! Off to the bank/pawnshop!`));
  }

  // ---- Rückstand mit übrigem Konto-Guthaben tilgen ----
  if (gs.zahlungsRueckstand > 0 && gs.kontostand > 0) {
    const tilg = Math.min(gs.zahlungsRueckstand, gs.kontostand);
    gs.kontostand        -= tilg;
    gs.zahlungsRueckstand -= tilg;
    if (tilg > 0) meldungen.push(T(`📉 Rückstand getilgt: -${formatEuro(tilg)} (offen: ${formatEuro(gs.zahlungsRueckstand)}).`, `📉 Arrears paid down: -${formatEuro(tilg)} (outstanding: ${formatEuro(gs.zahlungsRueckstand)}).`));
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
    meldungen.push(T(`⚠️ <strong>Offener Rückstand: ${formatEuro(leihBetrag)}</strong> – Rückstand seit ${gs.rueckstandMonate} Monat(en). Bei 3 Monaten ohne Begleichung droht <strong>Game Over</strong> (noch ${verbleibend}).`, `⚠️ <strong>Outstanding arrears: ${formatEuro(leihBetrag)}</strong> – in arrears for ${gs.rueckstandMonate} month(s). After 3 months without payment you face <strong>Game Over</strong> (${verbleibend} left).`));
    summaryAktionen.push({
      label: T(`🦈 ${formatEuro(leihBetrag)} beim Kredithai leihen (Zins 10%/M, Risiko +15)`, `🦈 Borrow ${formatEuro(leihBetrag)} from the loan shark (interest 10%/mo, risk +15)`),
      danger: true,
      callback: () => {
        gs.loanSharkSchuld   += leihBetrag;
        gs.zahlungsRueckstand = 0;
        gs.rueckstandMonate   = 0;
        gs.risikoRaster       = clamp(gs.risikoRaster + 15, 0, 100);
        logEvent(T(`🦈 Rückstand (${formatEuro(leihBetrag)}) mit Kredithai-Kredit beglichen. Schulden jetzt ${formatEuro(gs.loanSharkSchuld)}.`, `🦈 Arrears (${formatEuro(leihBetrag)}) settled with a loan-shark loan. Debt now ${formatEuro(gs.loanSharkSchuld)}.`), 'danger');
        soundShark && soundShark();
        updateHUD();
      }
    });
  }
  // ---- ALG I → Bürgergeld (ALG II): prominenter Umstellungs-Hinweis oben ----
  if (warAlg1 && gs.status === 'ALG2') {
    const kinderHat = (gs.kindergeldKinder || []).length > 0;
    const alg1Betrag = kinderHat ? '1.608 €' : '1.440 €';
    meldungen.unshift(T(
      '🔴 <strong>Umstellung auf Bürgergeld (ALG II)</strong><br>' +
      'Dein ALG I ist beendet. Ab jetzt gelten neue Konditionen:<br>' +
      `• Leistung: <strong>${alg1Betrag}</strong> → <strong>563 €</strong>/Monat${kinderHat ? ' (+90 €/Kind: 390 € Regelsatz − 300 € Kindergeld)' : ''}<br>` +
      '• Miete: <strong>650 € selbst</strong> → <strong>0 € (Amt zahlt die Miete)</strong><br>' +
      '• NEU: <strong>Vermögensgrenze 50.000 €</strong> – Konto + sichtbares Depot, Prüfung alle 3 Monate. Darüber gibt es in dem Monat kein Geld.<br>' +
      '• Tipp: Vermögen verstecken (Schwarzkasse, Gold, verschleiertes Depot) zählt nicht mit.',
      '🔴 <strong>Switched to welfare (ALG II)</strong><br>' +
      'Your ALG I has ended. New conditions from now on:<br>' +
      `• Benefit: <strong>${kinderHat ? '1,608 €' : '1,440 €'}</strong> → <strong>563 €</strong>/month${kinderHat ? ' (+90 €/child: 390 € rate − 300 € child benefit)' : ''}<br>` +
      '• Rent: <strong>650 € yourself</strong> → <strong>0 € (office pays the rent)</strong><br>' +
      '• NEW: <strong>asset limit 50,000 €</strong> – account + visible portfolio, checked every 3 months. Above it, no money that month.<br>' +
      '• Tip: hidden wealth (slush fund, gold, disguised portfolio) does not count.'
    ));
  }
  oeffneModal(T(`📅 Monatsabschluss – Monat ${gs.monat}`, `📅 Month-end report – Month ${gs.monat}`), meldungen.join('<br><br>'), summaryAktionen);
  pruefeGameOverBedingungen();
}

/** Prüft ob Bankrott-Game-Over eingetreten ist */
function pruefeGameOverBedingungen() {
  const gs = gameState;
  if (gs.gameOver) return;

  // ---- Millionär? Noch KEIN Sieg – erst Auswandern gewinnt das Spiel ----
  const depotWert   = (gs.depot || []).reduce((s,p) => s + p.anteile * p.aktuellerKurs, 0);
  const gesamtLegal = gs.kontostand + depotWert;
  if (gesamtLegal >= 1000000 && !gs.millionHinweis) {
    gs.millionHinweis = true;
    soundGut && soundGut();
    oeffneModal(T('💰 Du bist Millionär!', '💰 You are a millionaire!'),
      T('Kontostand + Depot liegen über <strong>1.000.000 €</strong>! 🎉<br><br>', 'Your account + portfolio top <strong>1,000,000 €</strong>! 🎉<br><br>') +
      T('Aber so richtig <strong>gewonnen</strong> hast du erst, wenn du dich ins Ausland absetzt. ', 'But you have only truly <strong>won</strong> once you skip the country. ') +
      T('Geh in deine <strong>Wohnung/Villa → „Ins Ausland absetzen"</strong>.', 'Head to your <strong>flat/villa → „Skip the country"</strong>.'), []);
    logEvent(T('💰 Millionär! Jetzt auswandern, um zu gewinnen.', '💰 Millionaire! Now emigrate to win.'), 'good');
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
      logEvent(T('🏥 Notfall-Krankenhaus! -20.000€, Gesundheit +20.', '🏥 Emergency hospital! -20,000€, Health +20.'), 'danger');
      soundAlarm && soundAlarm();
      oeffneModal(T('🏥 Notfall!', '🏥 Emergency!'),
        T('Deine Gesundheit ist kritisch!<br><br>', 'Your Health is critical!<br><br>')
        + T('<strong>-20.000 €</strong> Krankenhausrechnung.<br>', '<strong>-20,000 €</strong> hospital bill.<br>')
        + T('<strong>Gesundheit +20</strong>', '<strong>Health +20</strong>'), []);
    } else {
      logEvent(T('🏥 Gesundheit kritisch! Kein Geld für Krankenhaus!', '🏥 Health critical! No money for the hospital!'), 'danger');
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
  bank:        { file: 'assets/buildings/bank.png',           breite: 2.28, ankerY: 0.86, dy: 0.10 },
  arbeitsamt:  { file: 'assets/buildings/arbeitsamt.png',     breite: 2.83, ankerY: 0.92, dy: 0.18 },
  baustelle:   { file: 'assets/buildings/baustelle.png',      breite: 3.81, ankerY: 0.86, dy: 0.10, dx: 0.25 },
  pawn:        { file: 'assets/buildings/pfandleiher.png',    breite: 1.31, ankerY: 0.86, dy: 0.10 },
  amuesier:    { file: 'assets/buildings/amuesierbetrieb.png', breite: 1.75, ankerY: 0.86, dy: 0.10 },
  kasino:      { file: 'assets/buildings/casino_nacht.png',   breite: 2.28, ankerY: 0.86, dy: 0.08 },
  supermarkt:  { file: 'assets/buildings/supermarkt.png',     breite: 1.55, ankerY: 0.88, dy: 0.06 },
  wohnung:     { file: 'assets/buildings/wohnung.png',        breite: 2.05, ankerY: 0.78, dy: 0.04 },
  kiosk:       { file: 'assets/buildings/kiosk.png',          breite: 1.95, ankerY: 0.80, dy: 0.04 },
  sportverein: { file: 'assets/buildings/sportverein.png',    breite: 2.50, ankerY: 0.82, dy: 0.04 },
  schattenbank:{ file: 'assets/buildings/schattenbank.png',   breite: 2.05, ankerY: 0.78, dy: 0.04 },
  loanshark:   { file: 'assets/buildings/loanshark.png',      breite: 2.05, ankerY: 0.78, dy: 0.04 },
  arztpraxis:  { file: 'assets/buildings/arztpraxis.png',     breite: 2.05, ankerY: 0.78, dy: 0.04 },
  kirche:      { file: 'assets/buildings/kirche.png',         breite: 2.20, ankerY: 0.80, dy: 0.04 },
  villa:       { file: 'assets/buildings/villa.png',          breite: 2.35, ankerY: 0.78, dy: 0.04 },
};

// Iso-Tiefenlinie pro Gebäude als Anteil der Sprite-Höhe. Standard 0.85 (= Boden-
// frontlinie bei normalen Gebäuden). Gebäude mit großem VORPLATZ, bei denen der
// Aufbau weit HINTEN steht (z. B. Arbeitsamt-Turm: Aufbau bis ~52 % Höhe, dann
// Vorplatz), brauchen eine HÖHERE Linie (kleinerer Wert) – sonst schaltet „hinter"
// schon auf dem Vorplatz ein statt erst an der Aufbau-Ecke. Belegt per Sprite-Analyse.
const GEB_TIEFE_FRAKTION = { arbeitsamt: 0.53 };

// Gebäude, deren Sprite in Aufbau + flachen Sockel gesplittet wurde (aus der
// Magenta/Grün-Markierung, Dateien in assets/buildings/split/). Der Sockel wird
// UNTER dem Spieler gezeichnet (kann ihn nie verdecken), der Aufbau (inkl. grüner
// Hecken) auf Gebäude-Tiefe (verdeckt korrekt). 'dealer' = Park.
const GEB_MIT_SOCKEL = new Set(['villa','kiosk','wohnung','bank','supermarkt','kirche',
  'sportverein','arbeitsamt','kasino','loanshark','schattenbank','pawn','arztpraxis','baustelle']);
const SOCKEL_TIEFE = -10;   // über Stadtboden(-25)/Umgebung(-20), immer unter Figuren

// ================================================================
// HAUPTAUFRUF
// ================================================================
function zeichneAlleGebaeude(scene, tileW, tileH, offsetX, offsetY) {
  const COLS = 48, ROWS = 48;
  const feldW = (COLS + ROWS) * tileW / 2;   // 1920
  const feldH = (COLS + ROWS) * tileH / 2;   // 960

  // ---- Boden + Straßennetz: Bild bevorzugen, sonst gezeichnet ----
  if (scene.textures.exists('stadtboden')) {
    const cx = offsetX, cy = offsetY + feldH / 2;   // Diamant-Mittelpunkt (Welt)
    const tex = scene.textures.exists('stadtboden_trim') ? 'stadtboden_trim' : 'stadtboden';

    if (scene.textures.exists('umgebung')) {
      // ---- Gemalte Umgebung als EIN Bild (3200×2000) ----
      // Referenz aus der Gitter-Vorlage: Leinwand 3200×2000, obere Diamant-Spitze
      // bei (1600,520), Diamant-Breite 1920 = feldW → Skalierung 1:1. Der spielbare
      // Diamant ist im Bild zentriert (Bildmitte = Diamant-Mitte), daher Origin
      // 0.5/0.5 auf (cx,cy). Mitte ist transparent → der zentrale Boden + die
      // Gebäude-Sprites bleiben sichtbar.
      const UMG_W = 3200, UMG_H = 2000;        // native Bildgröße
      const sc = feldW / 1920;                  // 1920 px = Diamant-Breite im Bild
      // Zentraler (spielbarer) Diamant-Boden ZUERST/DARUNTER bei EXAKT 1.0 (volle
      // stadtboden, nicht beschnitten) → Straßen liegen exakt auf dem Gitter, genau
      // wie im Layout-Editor. Nötig, damit grid-platzierte Objekte (Park/Dealer)
      // bündig zu den Gehsteigen sitzen. Der Rand wird ohnehin von der gemalten
      // Umgebung (liegt darüber, überlappt nach innen) verdeckt → keine Naht.
      scene.add.image(cx, cy, 'stadtboden')
        .setOrigin(0.5, 0.5).setDisplaySize(feldW, feldH)
        .setDepth(-25);
      // Gemalte Umgebung DARÜBER (transparentes Loch in der Mitte). Ihre nach
      // innen reichende Straßen-Kante deckt den Übergang ab → keine Naht.
      scene.add.image(cx, cy, 'umgebung')
        .setOrigin(0.5, 0.5).setDisplaySize(UMG_W * sc, UMG_H * sc)
        .setDepth(-20);
      // Vordere Häuser nochmal ÜBER dem Spieler (gleiche Position) → unten läuft
      // der Spieler hinter den Häusern statt drüber. Tiefe > jeder Spieler/Geb.
      if (scene.textures.exists('umgebung_front')) {
        scene.add.image(cx, cy, 'umgebung_front')
          .setOrigin(0.5, 0.5).setDisplaySize(UMG_W * sc, UMG_H * sc)
          .setDepth(9000);
      }
    } else {
      // ---- Fallback: zentralen Boden in alle Richtungen kacheln (alt) ----
      const Ax = feldW / 2, Ay = feldH / 2;
      const Bx = -feldW / 2, By = feldH / 2;
      const R = 3;
      const OS_MITTE = 1.012, OS_RING = 1.085;
      for (let i = -R; i <= R; i++) {
        for (let j = -R; j <= R; j++) {
          const mitte = (i === 0 && j === 0);
          const bx = cx + i * Ax + j * Bx;
          const by = cy + i * Ay + j * By;
          const os = mitte ? OS_MITTE : OS_RING;
          scene.add.image(bx, by, tex)
            .setOrigin(0.5, 0.5).setDisplaySize(feldW * os, feldH * os)
            .setDepth(mitte ? -19 : -20);
        }
      }
    }
  } else {
    const gBoden = scene.add.graphics().setDepth(0);
    zeichneStadtboden(gBoden, tileW, tileH, offsetX, offsetY, COLS, ROWS);
    const gDeko = scene.add.graphics().setDepth(0);
    zeichneStrassendeko(gDeko, tileW, tileH, offsetX, offsetY);
    const gFuell = scene.add.graphics().setDepth(0);
    zeichneFuellgebaeude(gFuell, tileW, tileH, offsetX, offsetY);
  }

  // ---- Manuelles Layout aus dem Editor (layout/layout.json) ----
  const layout = (scene.cache && scene.cache.json && scene.cache.json.exists('layout'))
    ? scene.cache.json.get('layout') : null;
  if (layout && Array.isArray(layout.objects) && layout.objects.length) {
    wendeLayoutAn(scene, layout, tileW, tileH, offsetX, offsetY, feldW, feldH);
    return;
  }

  const sortiertOrte = [...ORTE_CONFIG].sort((a, b) => (a.col+a.row) - (b.col+b.row));
  sortiertOrte.forEach(ort => {
    const pos = isoToScreen(ort.col+0.5, ort.row+0.5, tileW, tileH, offsetX, offsetY);

    // ---- Bild-Gebäude (PNG) bevorzugen, falls vorhanden ----
    // Villa nur als Sprite zeigen, wenn sie tatsächlich bewohnt ist – sonst
    // bleibt das leere Baugrundstück (gezeichnet) stehen.
    const villaUnbewohnt = ort.id === 'villa' &&
      !(gameState.immobilie && gameState.immobilie.modus === 'eigen');
    const sprite = villaUnbewohnt ? null : BUILDING_SPRITES[ort.id];
    if (sprite && scene.textures.exists('geb_' + ort.id)) {
      const img = scene.add.image(pos.x + tileW * (sprite.dx || 0), pos.y + tileH * (sprite.dy || 0), 'geb_' + ort.id);
      img.setOrigin(sprite.ankerX ?? 0.5, sprite.ankerY ?? 0.85);
      const src   = scene.textures.get('geb_' + ort.id).getSourceImage();
      const dispW = tileW * (sprite.breite ?? 1.5);
      img.setDisplaySize(dispW, dispW * src.height / src.width);

      const labelY = pos.y + tileH * 0.52;
      scene.add.text(pos.x, labelY, ort.name, {
        fontSize: '15px', fontStyle: 'bold', fontFamily: '"Share Tech Mono", "Courier New", monospace', resolution: 2,
        color: '#ffe9b0', stroke: '#000000', strokeThickness: 5,
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
      case 'kirche':       baueKirche(g,       pos.x, pos.y, tileW, tileH); break;
      case 'dealer':       bauePark(g,         pos.x, pos.y, tileW, tileH); break;
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

// Zeichnet eine Gebäude-Textur als SENKRECHTE Streifen, jeder mit der Iso-Tiefe
// seines Boden-Kontaktpunkts (aus layout/geb_streifen.json). So sortiert jede
// Spalte korrekt: an der schrägen Vorderkante steht der Spieler vorne-links/rechts
// SICHTBAR davor; das Dach-Problem (waagerechte Streifen) tritt nicht auf, weil
// jeder Streifen voll hoch ist und nach seinem Fußpunkt sortiert. Liefert die Streifen.
function zeichneAufbauStreifen(scene, key, x, y, w, h, id) {
  const tex = scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null;
  const info = (scene.cache.json && scene.cache.json.exists('geb_streifen'))
    ? scene.cache.json.get('geb_streifen')[id] : null;
  if (!tex || !info) {   // Fallback: ein Bild, Tiefe an der Standlinie
    return [scene.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h).setDepth(y + h * 0.85)];
  }
  const srcW = tex.width, srcH = tex.height, n = info.n, dep = info.depth;
  const scX = w / srcW, scY = h / srcH, strips = [];
  for (let i = 0; i < n; i++) {
    const sx0 = Math.floor(i * srcW / n), sx1 = Math.max(sx0 + 1, Math.floor((i + 1) * srcW / n));
    const s = scene.add.image(x, y, key).setOrigin(0, 0).setScale(scX, scY);
    s.setCrop(sx0, 0, sx1 - sx0, srcH);
    s.setDepth(y + (dep[i] || 0.85) * h);   // Fußpunkt-Tiefe dieser Spalte
    strips.push(s);
  }
  return strips;
}

// ================================================================
// Manuelles Layout anwenden (aus dem Browser-Editor / layout.json).
//   Jedes Objekt hat fx,fy,fw,fh relativ zum zentralen Feld (feldW×feldH).
//   - Gebäude werden absolut platziert UND ihr Trigger (col/row) nachgezogen.
//   - Props werden nur gezeichnet.
//   - Der Park/Dealer ist nicht im Layout → bleibt an seiner ORTE-Position.
// ================================================================
function wendeLayoutAn(scene, layout, tileW, tileH, offsetX, offsetY, feldW, feldH) {
  const fieldLeft = offsetX - feldW / 2, fieldTop = offsetY;
  const orte = {}; ORTE_CONFIG.forEach(o => orte[o.id] = o);
  scene.gebaeudeSprites = {};   // id → Bild (für Highlight-Glow)

  // 1) Trigger-Position (col/row) jedes Gebäudes aus dem Layout neu berechnen
  layout.objects.forEach(o => {
    if (o.type !== 'building' || !orte[o.id]) return;
    const bx = fieldLeft + (o.fx + o.fw / 2) * feldW;   // Bodenpunkt = untere Mitte
    const by = fieldTop  + (o.fy + o.fh * 0.85) * feldH;
    const dc = (bx - offsetX) / (tileW / 2);            // col - row
    const sr = (by - offsetY) / (tileH / 2) - 1;        // col + row
    orte[o.id].col = clamp(Math.round((sr + dc) / 2), 0, 47);
    orte[o.id].row = clamp(Math.round((sr - dc) / 2), 0, 47);
  });

  // 2) Objekte zeichnen (nach Boden-Y sortiert → hinten zuerst)
  const objs = [...layout.objects].sort((a, b) => (a.fy + a.fh) - (b.fy + b.fh));
  objs.forEach(o => {
    const key = o.type === 'building' ? ('geb_' + o.id) : o.id;
    if (!scene.textures.exists(key)) return;
    const x = fieldLeft + o.fx * feldW, y = fieldTop + o.fy * feldH;
    const w = o.fw * feldW, h = o.fh * feldH;
    // Flacher Sockel (falls gesplittet) UNTER dem Spieler → verdeckt nie.
    let sockelImg = null;
    if (scene.textures.exists('sok_' + o.id)) {
      sockelImg = scene.add.image(x, y, 'sok_' + o.id).setOrigin(0, 0).setDisplaySize(w, h).setDepth(SOCKEL_TIEFE);
    }
    // Aufbau als SENKRECHTE Streifen (pro Spalte Boden-Kontakt-Tiefe) → korrekte
    // Sortierung auch an der schrägen Vorderkante (links/rechts) und beim Dach.
    const strips = zeichneAufbauStreifen(scene, key, x, y, w, h, o.id);
    if (o.type === 'building' && orte[o.id] && strips.length) {
      const klick = () => { if (!scene._menuAktiv && !modalOffen) scene.klickAufOrt(o.id); };
      // Aufbau klickbar (pixelPerfect nutzt die volle Textur = ganze Aufbaufläche)
      strips[0].setInteractive({ pixelPerfect: true });
      strips[0].on('pointerdown', klick);
      // Sockel/Vorfläche ebenfalls klickbar → ganzes Grundstück anklickbar
      // (z. B. Sportverein-Feld). Eigene Textur, überlappt den Aufbau nicht → kein Doppel-Feuern.
      if (sockelImg) { sockelImg.setInteractive({ pixelPerfect: true }); sockelImg.on('pointerdown', klick); }
      // Highlight-Gruppe = Aufbau-Streifen + Sockel → ganzes Grundstück leuchtet auf
      scene.gebaeudeSprites[o.id] = sockelImg ? strips.concat(sockelImg) : strips;
    }
    // Sportplatz/-verein ist ein ganzes Grundstück → Kern nicht betretbar machen
    // (eng gefasst, damit die angrenzenden Straßen begehbar bleiben)
    if (o.id === 'sportverein') {
      scene._sperrTiles = scene._sperrTiles || [];
      for (let u = 0.35; u <= 0.65; u += 0.15)
        for (let v = 0.62; v <= 0.82; v += 0.1) {
          const t = scene.screenZuTile(x + u * w, y + v * h);
          if (t) scene._sperrTiles.push(t.col + ',' + t.row);
        }
    }
    if (o.type === 'building' && orte[o.id]) {
      scene.add.text(x + w / 2, y + h, orte[o.id].name, {
        fontSize: '15px', fontStyle: 'bold', fontFamily: '"Share Tech Mono", "Courier New", monospace', resolution: 2,
        color: '#ffe9b0', stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5, 1).setDepth(y + h + 0.3);   // Label vor den Aufbau-Streifen
    }
  });

  // 3) Park/Dealer (nicht im Layout) an seiner festen ORTE-Position zeichnen
  const dealer = orte['dealer'];
  if (dealer) {
    const pos = isoToScreen(dealer.col + 0.5, dealer.row + 0.5, tileW, tileH, offsetX, offsetY);
    // ===== Park + Dealer – Werte aus dem Layout-Editor (layout/editor.html) =====
    // Diese Konstanten kannst du direkt aus dem Editor-Export übernehmen.
    const PARK_KACHELN = 7.08;       // Park-Breite in Kacheln (=2.36 alt ×3 feines Raster; Weltgröße unverändert)
    const PARK_DX = 110.2, PARK_DY = -38.9;     // Park-Versatz vom Kachel-Mittelpunkt (px)
    const DEALER_SCALE = 0.293;                 // Dealer-Größe
    const DEALER_DX = 84.0, DEALER_DY = -35.5;  // Dealer-Versatz (px)
    // Park-Grafik (Boden-Diamant im Bild = 1320 px breit) skaliert.
    if (scene.textures.exists('park')) {
      const sc = (tileW * PARK_KACHELN) / 1320;
      // Park-Sockel (Innenfläche) UNTER dem Spieler → verdeckt nie; Randbäume/Hecken
      // sind im Aufbau ('park') und verdecken weiterhin korrekt.
      if (scene.textures.exists('sok_dealer')) {
        scene.add.image(pos.x + PARK_DX, pos.y + PARK_DY, 'sok_dealer')
          .setOrigin(0.4992, 0.5616).setDisplaySize(1322 * sc, 755 * sc).setDepth(SOCKEL_TIEFE);
      }
      const parkImg = scene.add.image(pos.x + PARK_DX, pos.y + PARK_DY, 'park')
        .setOrigin(0.4992, 0.5616).setDisplaySize(1322 * sc, 755 * sc)
        .setDepth(pos.y - 0.5);   // Boden-Deko (knapp hinter dem Dealer)
      // Park soll wie ein Gebäude aufleuchten, wenn man in der Nähe ist
      scene.gebaeudeSprites['dealer'] = parkImg;
      // Park nicht betretbar: nur den Kern unter der Park-Grafik sperren
      // (eng gefasst, damit die angrenzenden Straßen begehbar bleiben)
      scene._sperrTiles = scene._sperrTiles || [];
      const pW = 1322 * sc, pH = 755 * sc;
      const pL = (pos.x + PARK_DX) - 0.4992 * pW, pT = (pos.y + PARK_DY) - 0.5616 * pH;
      for (let u = 0.35; u <= 0.65; u += 0.15)
        for (let v = 0.5; v <= 0.78; v += 0.12) {
          const t = scene.screenZuTile(pL + u * pW, pT + v * pH);
          if (t) scene._sperrTiles.push(t.col + ',' + t.row);
        }
    } else {
      bauePark(scene.add.graphics().setDepth(pos.y), pos.x, pos.y, tileW, tileH);
    }
    // Animierter Dealer (Sprite, 7 Frames) – steht vorne im Park
    if (scene.textures.exists('dealer')) {
      if (!scene.anims.exists('dealer_anim')) {
        scene.anims.create({ key: 'dealer_anim',
          frames: scene.anims.generateFrameNumbers('dealer', { start: 0, end: 6 }),
          frameRate: 1.5, repeat: -1 });   // 1/4 der vorherigen Geschwindigkeit
      }
      scene.dealerSprite = scene.add.sprite(pos.x + DEALER_DX, pos.y + tileH * 0.45 + DEALER_DY, 'dealer')
        .setOrigin(0.5, 1).setScale(DEALER_SCALE).setDepth(pos.y + 2);
      scene.dealerSprite.play('dealer_anim');
    }
    // anklickbare Zone über dem Park (größer)
    scene.add.zone(pos.x, pos.y - tileH * 1.2, tileW * 6.6, tileH * 7.8)
      .setInteractive()
      .on('pointerdown', () => { if (!scene._menuAktiv && !modalOffen) scene.klickAufOrt('dealer'); });
    // Label direkt unter die (versetzte) Park-Grafik setzen: x = Park-Mitte,
    // y = unter der unteren Spitze des Park-Boden-Diamanten.
    const parkLabelX = pos.x + PARK_DX;
    const parkLabelY = pos.y + PARK_DY + (tileW * PARK_KACHELN) / 4 + 4;
    scene.add.text(parkLabelX, parkLabelY, dealer.name, {
      fontSize: '15px', fontStyle: 'bold', fontFamily: '"Share Tech Mono", "Courier New", monospace', resolution: 2,
      color: '#ffe9b0', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(pos.y + 2.3);
  }
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


// ---- Kirche – heller Bau mit Turm & Kreuz ----
function baueKirche(g, cx, cy, tw, th) {
  const hoehe = th * 1.3;
  zeichneKlinkerhaus(g, cx, cy, tw * 0.85, th * 0.85, {
    klinkerFarbe: 0xdcd4c4, dachFarbe: 0x7a6a4a,
    hoehe, dachart: 'sattel', etagen: 2,
    fensterFarbe: 0xffcf7a, tuerFarbe: 0x5a3a1a,
    schild: null, seed: 909
  });
  // Kirchturm links
  const txx = cx - tw * 0.34;
  g.fillStyle(0xcfc7b6, 1); g.fillRect(txx - tw * 0.07, cy - hoehe * 1.55, tw * 0.14, hoehe * 1.55);
  g.fillStyle(0x8a7a5a, 1); // Spitzdach
  g.fillTriangle(txx - tw * 0.09, cy - hoehe * 1.55, txx + tw * 0.09, cy - hoehe * 1.55, txx, cy - hoehe * 1.95);
  // Kreuz auf dem Turm
  g.fillStyle(0xffd700, 1);
  g.fillRect(txx - 1.5, cy - hoehe * 2.12, 3, 16);
  g.fillRect(txx - 6, cy - hoehe * 2.06, 12, 3);
}

// ---- Park mit zwielichtigem Dealer ----
function bauePark(g, cx, cy, tw, th) {
  // Nur die Rasenfläche (Iso-Raute) – alle Props (Baum, Bank, Weg) entfernt,
  // wird später neu gestaltet.
  isoFill(g, cx, cy, tw * 0.95, th * 0.95, 0x3a6a2a, 1);
  // Hinweis: Die Dealer-Figur wird NICHT hier statisch gezeichnet, sondern
  // pro Frame animiert in animiereDealer() (dealerGfx).
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
    this.load.image('titelbild', 'startbg_titel.png');   // Titel ohne Menü (Buttons darunter)
  }

  create() {
    // HUD ausblenden -> Startbildschirm = reines Vollbild-Titelbild
    this._menuAktiv = false;   // Rückkehr aus dem Spiel: Buttons wieder aktiv
    // evtl. offenes Modal/Overlay sicher schließen (z. B. Game-Over) → Startmenü klickbar
    try {
      modalOffen = false; modalQueue = [];
      const _ov = document.getElementById('modal-overlay');
      if (_ov) _ov.classList.remove('active');
    } catch (e) {}
    setHudSichtbar(false);
    document.body.classList.remove('im-spiel');   // Topbar/Zahnrad im Startscreen aus
    const _c = document.getElementById('game-container');
    if (_c) this.scale.resize(_c.clientWidth, _c.clientHeight);
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- Startmusik ----
    // Erst JEDE laufende Musik stoppen (Spielmusik + evtl. alte Startmusik-Instanz),
    // sonst spielen zwei Tracks gleichzeitig.
    ['_startMusik', '_spielMusik'].forEach(k => {
      if (window[k]) { try { window[k].pause(); window[k].currentTime = 0; } catch (e) {} }
    });
    window._aktiveMusik = 'start';
    window._startMusik = new Audio('Pixel_Parade_1.mp3');
    window._startMusik.loop   = true;
    window._startMusik.volume = 0.45;
    // Listener als Rückfall, falls der Browser Autoplay (noch) blockt.
    const _startAudio = () => {
      window._startMusik.play().catch(e => console.warn('Start-Audio:', e));
      document.removeEventListener('click',       _startAudio);
      document.removeEventListener('keydown',     _startAudio);
      document.removeEventListener('pointerdown', _startAudio);
    };
    const _autoplayVersuch = () => {
      // Sofort versuchen abzuspielen. Klappt, sobald der Browser es erlaubt
      // (z.B. nachdem die Seite schon einmal benutzt wurde -> Media Engagement).
      const p = window._startMusik.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          // Erfolg -> keine Interaktion nötig
          document.removeEventListener('click',       _startAudio);
          document.removeEventListener('keydown',     _startAudio);
          document.removeEventListener('pointerdown', _startAudio);
        }).catch(() => {
          // Autoplay blockiert -> auf erste Interaktion warten
          document.addEventListener('click',       _startAudio, { once: false });
          document.addEventListener('keydown',     _startAudio, { once: false });
          document.addEventListener('pointerdown', _startAudio, { once: false });
        });
      }
    };
    _autoplayVersuch();
    // Falls die Datei noch nicht ladebereit ist, beim Ladeende erneut versuchen.
    window._startMusik.addEventListener('canplaythrough', () => {
      if (window._startMusik.paused) _autoplayVersuch();
    }, { once: true });

    // relY = vertikale Mitte des jeweiligen Buttons im Hintergrundbild
    // (an startbg.png exakt ausgemessen, 1264×843).
    this._menuItems = [
      { icon: '👑', label: T('NEUES SPIEL', 'NEW GAME'),      relY: 0.548, aktion: () => this._neuesSpiel()    },
      { icon: '📁', label: T('SPIEL LADEN', 'LOAD GAME'),     relY: 0.611, aktion: () => this._spielLaden()    },
      { icon: 'ℹ️', label: T('INFO & ANLEITUNG', 'INFO & GUIDE'), relY: 0.679, aktion: () => oeffneInfo('story') },
      { icon: '🏆', label: T('BESTENLISTE', 'HIGHSCORES'),    relY: 0.747, aktion: () => this._bestenliste()   },
      { icon: '🚪', label: T('BEENDEN', 'QUIT'),              relY: 0.810, aktion: () => this._beenden()        },
    ];

    this._startObjekte = [];   // alle aufgebauten Objekte (zum Neuaufbau bei Resize)
    this._menuButtons  = [];

    // Layout aufbauen – und bei jeder Größenänderung des Canvas neu aufbauen,
    // damit Klickflächen und Hintergrundbild immer exakt deckungsgleich sind.
    this._layoutStartMenu();
    this.scale.on('resize', this._layoutStartMenu, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._layoutStartMenu, this));

    this.input.keyboard.once('keydown-ENTER', () => this._neuesSpiel());
    this.input.keyboard.once('keydown-SPACE', () => this._neuesSpiel());

    // Pflicht-Disclaimer beim ersten Start (bis bestätigt)
    try {
      if (localStorage.getItem('disclaimer_ok') !== '1') setTimeout(() => zeigeDisclaimer(), 600);
    } catch (e) {}
  }

  _layoutStartMenu() {
    // Vorherige Objekte entfernen (Resize -> sauberer Neuaufbau)
    if (this._startObjekte) this._startObjekte.forEach(o => { try { o.destroy(); } catch (e) {} });
    this._startObjekte = [];
    this._menuButtons  = [];

    const W = this.scale.width;
    const H = this.scale.height;

    // Fußzeile: Copyright + Datenschutz (beide Layouts), zentriert. Tippen öffnet
    // die mitgelieferte privacy.html (offline). Copyright ist Pflicht/üblich.
    const foot = this.add.text(W / 2, H - 8, '© 2026 Andreas Lang   ·   v' + APP_VERSION + '   ·   ' + T('Datenschutz', 'Privacy'), {
      fontFamily: '"Courier New", monospace', fontSize: '13px',
      color: '#9fb0d8', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(9999).setInteractive({ useHandCursor: true });
    foot.on('pointerover', () => foot.setColor('#ffd700'));
    foot.on('pointerout',  () => foot.setColor('#9fb0d8'));
    foot.on('pointerdown', () => { try { window.location.assign('privacy.html'); } catch (e) {} });
    this._startObjekte.push(foot);

    // Sprachumschalter (oben rechts) – zeigt die jeweils ANDERE Sprache an.
    const langTxt = this.add.text(W - 10, 8, SPRACHE === 'en' ? '🇩🇪 Deutsch' : '🇬🇧 English', {
      fontFamily: '"Courier New", monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#ffe9b0', backgroundColor: 'rgba(10,14,26,0.7)', padding: { x: 8, y: 5 },
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10000).setInteractive({ useHandCursor: true });
    langTxt.on('pointerdown', () => setSprache(SPRACHE === 'en' ? 'de' : 'en'));
    this._startObjekte.push(langTxt);

    // ===== HOCHFORMAT: Titel-Banner (ohne Menü) oben + große Buttons darunter =====
    // (Drehung ist gesperrt → immer Hochformat. Titelbild = 'titelbild' ohne Menü,
    //  damit das Menü nicht doppelt erscheint.)
    if (H > W * 1.05 && (this.textures.exists('titelbild') || this.textures.exists('startbg'))) {
      const bgFill = this.add.graphics().setDepth(0);
      bgFill.fillStyle(0x080b14, 1); bgFill.fillRect(0, 0, W, H);
      this._startObjekte.push(bgFill);

      const titelKey = this.textures.exists('titelbild') ? 'titelbild' : 'startbg';
      const bg = this.add.image(W / 2, 8, titelKey).setOrigin(0.5, 0).setDepth(1);
      let s = W / bg.width;   // volle Breite ausfüllen
      if (bg.height * s > H * 0.5) s = (H * 0.5) / bg.height;   // Titel max. 50% Höhe
      bg.setScale(s);
      this._startObjekte.push(bg);

      const items = this._menuItems;
      const n = items.length;
      const top = 8 + bg.height * s + Math.min(28, H * 0.03);
      const gap = 12;
      const bh = Math.max(44, Math.min(66, (H - top - 24 - gap * (n - 1)) / n));
      const bw = Math.min(W * 0.88, 460);
      items.forEach((item, i) => {
        const bx = W / 2, by = top + i * (bh + gap) + bh / 2;
        const first = i === 0;
        const g = this.add.graphics().setDepth(2);
        const draw = (hover) => {
          g.clear();
          g.fillStyle(first ? 0x3a2a00 : 0x141a2e, hover ? 1 : 0.95);
          g.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
          g.lineStyle(2, first ? 0xffd700 : 0x3a4e7a, 1);
          g.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
        };
        draw(false);
        const txt = this.add.text(bx, by, `${item.icon}  ${item.label}`, {
          fontFamily: '"Courier New", monospace', fontSize: Math.max(16, Math.floor(bh * 0.34)) + 'px',
          fontStyle: 'bold', color: first ? '#ffd700' : '#e8eeff', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(3);
        const zone = this.add.zone(bx, by, bw, bh).setDepth(4).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          if (this._menuAktiv || modalOffen) return;
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - (window._modalClosedAt || 0) < 400) return;   // direkt nach Modal-Schließen nicht durchklicken
          item.aktion();
        });
        this._startObjekte.push(g, txt, zone);
        this._menuButtons.push({ bg: g, txt, zone });
      });
      return;
    }

    // ---- Hintergrundbild: vollflächig skaliert (Querformat/Desktop) ----
    let bgRect = null;   // {left, top, w, h} des angezeigten Bildes
    if (this.textures.exists('startbg')) {
      const bg = this.add.image(W/2, H/2, 'startbg');
      const scale = Math.max(W / bg.width, H / bg.height);
      bg.setScale(scale).setDepth(0);
      this._startObjekte.push(bg);
      const dw = bg.width * scale, dh = bg.height * scale;
      bgRect = { left: W/2 - dw/2, top: H/2 - dh/2, w: dw, h: dh };
    } else {
      // Fallback: dunkler Hintergrund wenn Datei fehlt
      const bgFallback = this.add.graphics().setDepth(0);
      bgFallback.fillGradientStyle(0x050810, 0x050810, 0x0a1428, 0x0a1428, 1);
      bgFallback.fillRect(0, 0, W, H);
      const skyGfx = this.add.graphics().setDepth(1);
      this._zeichneSkylineFallback(skyGfx, W, H);
      this._startObjekte.push(bgFallback, skyGfx);
    }

    const MENU_ITEMS = this._menuItems;

    if (bgRect) {
      // ---- Das Menü ist bereits IM Bild gezeichnet ----
      // Wir legen nur unsichtbare Klickflächen exakt darüber.
      const cx = 0.139, zw = 0.215, zh = 0.060;   // an startbg.png ausgemessen (Button-Mitte/-Breite/-Höhe)
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
        zone.on('pointerdown', () => {
          if (this._menuAktiv || modalOffen) return;
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - (window._modalClosedAt || 0) < 400) return;   // direkt nach Modal-Schließen nicht durchklicken
          item.aktion();
        });
        this._startObjekte.push(hl, zone);
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
        zone.on('pointerdown', () => {
          if (this._menuAktiv || modalOffen) return;
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - (window._modalClosedAt || 0) < 400) return;   // direkt nach Modal-Schließen nicht durchklicken
          item.aktion();
        });
        this._startObjekte.push(bg2, txt, zone);
        this._menuButtons.push({ bg: bg2, txt, zone });
      });
    }
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
    if (this._menuAktiv) return;
    this._menuAktiv = true;
    initAudio();
    // Schwierigkeit = Startkontostand
    oeffneModal(T('🎮 Schwierigkeit wählen', '🎮 Choose difficulty'),
      T('Wie hart soll dein Start ins Sozialbetrüger-Leben werden?<br>', 'How rough should your start in the welfare-fraud life be?<br>') +
      T('(bestimmt deinen <strong>Startkontostand</strong>)', '(sets your <strong>starting account balance</strong>)'),
      [
        { label: T('😊 Einfach – 40.000 € Start', '😊 Easy – 40,000 € start'), primary: true, callback: () => this._starteSpiel(40000) },
        { label: T('😐 Mittel – 10.000 € Start', '😐 Medium – 10,000 € start'),                callback: () => this._starteSpiel(10000) },
        { label: T('😈 Hart – 1.000 € Start', '😈 Hard – 1,000 € start'),     danger: true, callback: () => this._starteSpiel(1000)  },
      ],
      () => { this._menuAktiv = false; }   // abgebrochen → Startmenü wieder bedienbar
    );
  }

  _starteSpiel(startKonto) {
    this._musikStoppen();
    initAudio();
    try { localStorage.removeItem('spende_aus'); } catch (e) {}   // Bettler bei neuem Spiel zurückholen
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      Object.assign(gameState, {
        kontostand: startKonto, schwarzeKasse: 0, losesBargeld: 0, hatSchwarzgearbeitet: false,
        energie: 80, happinessSpieler: 70, happinessPartner: 70,
        gesundheit: 80, risikoRaster: 10, status: 'ALG1',
        monat: 1, woche: 1, tag: 1,
        naechsterAmtsBesuch: 2, amtsTermineVerpasst: 0, algGesperrt: false,
        krankmeldungWochenRest: 0, krankmeldungCooldownWochen: 0, kampfsportGelernt: false, anzeigeCooldownMonat: 0, bettlerAus: false, millionHinweis: false,
        eheKriseAktiv: false, eheKriseSchritt: 0, frauAusgezogen: false,
        unterhaltProMonat: 0, geschenkeSumme: 0,
        loanSharkSchuld: 0, loanSharkMahnungStufe: 0,
        depot: [], goldBarren: 0,
        kindergeldKinder: [], kindergeldAktiv: false,
        monatlicheExtras: 0, risikoProMonat: 0,
        lebensmittelDiesenMonat: null, lebensmittelTageRest: 0, grosserKuehlschrank: false, billigKaeufeInFolge: 0,
        supermarktFaellig: false, kuehlschrankWarnung: false, schattenbankAktiv: false,
        bankEinzahlungDieseWoche: 0, gameOver: false,
        // ---- neue Bürokratie-/Immobilien-Features zurücksetzen ----
        verpfaendet: {},
        mehrbedarf: { warmwasser: false, alleinerziehend: false, ernaehrung: false, but: false },
        ernaehrungFake: false, ernaehrungAttest: false, einstiegsgeldMonate: 0, minijobLohn: 0,
        unterhaltsTarnung: false, kurCooldownMonat: 0, scheinWG: false,
        kautionRest: 0, umzugGemacht: false,
        pauschalen: { erstausstattung: false, moebel: false },
        bekleidungCooldownMonat: 0, immobilie: null, einliegerVermietet: false,
        zahlungsRueckstand: 0, rueckstandMonate: 0,
        depotVerschleiert: false, vomStaatGesamt: 0, strafStufe: 0,
        sachbearbeiterBestochen: false, suchtStufe: 0, kleeblatt: false,
        suendenerlassCooldownMonat: 0, beichteCooldownMonat: 0,
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
          T(`Slot ${e.slot}  ·  M${e.monat} W${e.woche}`, `Slot ${e.slot}  ·  M${e.monat} W${e.woche}`),
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
    // Feines Logik-Raster: 48×48 statt 16×16 (3× pro Achse = 9× Felder). Die
    // Spielfläche bleibt EXAKT gleich groß (feldW=1920, feldH=960), nur die
    // Kacheln sind 1/3 so groß (40×20) → präzise Kollision/Standflächen.
    this.tileW   = 40;
    this.tileH   = 20;
    // offsetX/Y werden in create() dynamisch berechnet (Zentrierung)
    this.offsetX = 400;
    this.offsetY = 120;

    this.spielerCol  = 12;  // Startposition auf Kreuzung (Straße) – 4×3 im feinen Raster
    this.spielerRow  = 12;

    // Laufanimation
    this.walkFrame   = 0;
    this.walkTimer   = 0;
    this.WALK_FPS    = 0.11;
    this.istAufMove  = false;
    this._idleTimeout = null;

    this.inputCooldown    = 0;
    this.ortRects         = [];
    this.zeitAkku         = 0;
    this.zeitTempo        = 1;   // Zeitraffer 1× / 2× / 4×
    window._spielzeitSek  = 0;   // Spielzeit-Zähler bei (Neu-)Start zurücksetzen
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
    // Boden + Straßennetz (eine große Iso-Grafik, wird auch außen herum gekachelt)
    this.load.image('stadtboden', 'assets/buildings/stadtboden.png');
    // Gemalte Umgebung (ein Bild, 3200×2000, Mitte transparent) → ersetzt die
    // früheren Deko-Stadtblöcke/Ring-Kacheln. Liegt hinter dem Spieldiamanten.
    this.load.image('umgebung', 'assets/umgebung.png');
    // Vordere Häuser der Umgebung als Maske → werden ÜBER dem Spieler gezeichnet,
    // damit er unten hinter den Häusern verschwindet (nicht auf den Dächern läuft).
    this.load.image('umgebung_front', 'assets/umgebung_front.png');
    // Park-Grafik + animierter Dealer (7 Frames)
    this.load.image('park', 'assets/buildings/split/dealer_aufbau.png');   // Park-Aufbau (Randbäume/Hecken)
    this.load.image('sok_dealer', 'assets/buildings/split/dealer_sockel.png'); // Park-Sockel (Innenfläche, unter Spieler)
    this.load.spritesheet('dealer', 'assets/dealer.png', { frameWidth: 96, frameHeight: 141 });
    // Räuber-Walkcycle (16 Frames, kopf-zentriert)
    this.load.spritesheet('raeuber', 'assets/raeuber.png', { frameWidth: 104, frameHeight: 151 });
    // Nebel-Overlay (zeigt die Grenze des bespielbaren Bereichs)
    this.load.image('fog', 'assets/fog.png');
    // Bild-Gebäude laden (siehe BUILDING_SPRITES)
    for (const id in BUILDING_SPRITES) {
      if (GEB_MIT_SOCKEL.has(id)) {
        // Aufbau (ohne Sockel) als Gebäude-Textur + separater Sockel
        this.load.image('geb_' + id, 'assets/buildings/split/' + id + '_aufbau.png');
        this.load.image('sok_' + id, 'assets/buildings/split/' + id + '_sockel.png');
      } else {
        this.load.image('geb_' + id, BUILDING_SPRITES[id].file);
      }
    }
    // (Natur-Props werden derzeit nicht verwendet → nicht laden; sie liegen für den
    //  Layout-Editor weiterhin in assets/props/, sind aber nicht im App-Build.)
    // Manuelles Layout (aus dem Editor) – fehlt es, fällt alles auf Standard zurück
    this.load.json('layout', 'layout/layout.json');
    this.load.json('collision', 'layout/collision.json');   // pixelgenaue Standflächen
    this.load.json('geb_streifen', 'layout/geb_streifen.json'); // Senkrecht-Streifen-Tiefen pro Gebäude
    // Bettler-Animationen (4 Frames Stehen/Betteln, 8 Frames Gehen im Profil)
    this.load.spritesheet('bettler_stand', 'assets/bettler_stand.png', { frameWidth: 96,  frameHeight: 176 });
    this.load.spritesheet('bettler_walk',  'assets/bettler_walk.png',  { frameWidth: 108, frameHeight: 171 });
    // Spieler-Animationen (7 Frames Front-Walk, 8 Frames Seitenprofil)
    this.load.spritesheet('spieler_front', 'assets/spieler_front.png', { frameWidth: 75,  frameHeight: 159 });
    this.load.spritesheet('spieler_side',  'assets/spieler_side.png',  { frameWidth: 108, frameHeight: 171 });
    this.load.on('loaderror', () => {});   // fehlende Datei still ignorieren
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
    const COLS = 48, ROWS = 48;
    const karteBreite = (COLS + ROWS) * this.tileW / 2;
    const karteHoehe  = (COLS + ROWS) * this.tileH / 2;
    // Karte horizontal und vertikal zentrieren
    this.offsetX = W / 2 - (COLS - ROWS) * this.tileW / 4;
    this.offsetY = Math.max(40, (H - karteHoehe) / 2 + 20);

    document.body.classList.add('im-spiel');   // Topbar/Zahnrad nur im Spiel zeigen
    this.zeitTempo = 1;
    try { if (typeof setTempo === 'function') setTempo(1); } catch (e) {}   // Tempo-Anzeige zurücksetzen

    // Stadtgrafik (einmalig)
    zeichneAlleGebaeude(this, this.tileW, this.tileH, this.offsetX, this.offsetY);

    // Kollisions-Daten – angepasst an pos.x+0.5-Offset
    ORTE_CONFIG.forEach(o => this.ortRects.push({ id: o.id, col: o.col, row: o.row }));

    // Begehbarkeit: alle Felder außer Gebäude-Standflächen.
    this.blockierteFelder = new Set();
    if (this.cache && this.cache.json && this.cache.json.exists('collision')) {
      // Pixelgenaue Standflächen (offline aus den PNGs berechnet) – exakt.
      this.cache.json.get('collision').forEach(s => this.blockierteFelder.add(s));
    } else {
      // Fallback: grobe Schätzung aus dem Layout-Rechteck (nur Standlinien-Mitte,
      // damit die Straßenlücken zwischen Nachbargebäuden frei bleiben).
      ORTE_CONFIG.forEach(o => this.blockierteFelder.add(o.col + ',' + o.row));
      const _layout = (this.cache && this.cache.json && this.cache.json.exists('layout'))
        ? this.cache.json.get('layout') : null;
      const _fW = (48 + 48) * this.tileW / 2, _fH = (48 + 48) * this.tileH / 2;
      const _left = this.offsetX - _fW / 2, _top = this.offsetY;
      if (_layout && Array.isArray(_layout.objects)) {
        _layout.objects.filter(o => o.type === 'building').forEach(o => {
          for (let u = 0.35; u <= 0.65; u += 0.15) {
            for (let v = 0.58; v <= 0.86; v += 0.14) {
              const t = this.screenZuTile(_left + (o.fx + u * o.fw) * _fW, _top + (o.fy + v * o.fh) * _fH);
              if (t) this.blockierteFelder.add(t.col + ',' + t.row);
            }
          }
        });
      }
    }
    // Zusätzliche Sperrflächen aus dem Layout (Park, Sportplatz) – nicht betretbar
    if (this._sperrTiles) this._sperrTiles.forEach(s => this.blockierteFelder.add(s));

    // Sicherheit: Startfeld des Spielers immer begehbar lassen
    this.blockierteFelder.delete(this.spielerCol + ',' + this.spielerRow);
    this.pfad = [];          // aktueller Lauf-Pfad (Point-and-Click)
    this.pfadZielOrt = null;  // Gebäude, mit dem nach Ankunft interagiert wird

    // ---- Klick-Steuerung: auf Boden klicken → exakt dorthin laufen ----
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (this._menuAktiv || modalOffen) return;
      if (this.input.pointer2 && this.input.pointer2.isDown) return;   // Zwei-Finger-Pinch → nicht laufen
      if (currentlyOver && currentlyOver.length) return;   // Gebäude geklickt → eigener Handler
      this.geheZuWelt(pointer.worldX, pointer.worldY);
    });

    // NPCs (unter den Gebäuden – laufen auf den Straßen)
    this.npcGfx = this.add.graphics().setDepth(-5);
    this.initNPCs();

    // Animierter Dealer im Park (Tiefe wird in animiereDealer nach Boden-Y gesetzt)
    this.dealerGfx  = this.add.graphics();
    this.dealerAnimT = 0;

    // Startposition: direkt vor der eigenen Wohnung (erste begehbare Nachbarkachel)
    const _woh = ORTE_CONFIG.find(o => o.id === 'wohnung');
    if (_woh) {
      const kandidaten = [[3, 3], [0, 3], [3, 0], [-3, 3], [3, -3], [0, 6], [6, 0], [-3, 0], [0, -3]];
      for (const [dc, dr] of kandidaten) {
        const c = _woh.col + dc, r = _woh.row + dr;
        if (this.begehbar(c, r)) { this.spielerCol = c; this.spielerRow = r; break; }
      }
    }
    // Spieler – kontinuierliche Weltposition (flüssige Bewegung)
    const startPos = isoToScreen(this.spielerCol + 0.5, this.spielerRow + 0.5,
                                 this.tileW, this.tileH, this.offsetX, this.offsetY);
    this.spielerX = startPos.x;   // Welt-Koordinaten der Füße
    this.spielerY = startPos.y;
    this.pfad = [];               // Lauf-Wegpunkte (Welt {x,y})
    this.pfadZielOrt = null;      // bei Ankunft zu öffnendes Gebäude (nur bei Doppelklick)
    this._walkAcc = 0;
    this.SPEED = 139;             // Lauftempo in px/Sekunde
    // Spieler-Sprites: Front-Walk (7 Frames) + Seitenprofil (8 Frames)
    if (this.textures.exists('spieler_front') && !this.anims.exists('spieler_front')) {
      this.anims.create({ key: 'spieler_front',
        frames: this.anims.generateFrameNumbers('spieler_front', { start: 0, end: 6 }),
        frameRate: 10, repeat: -1 });
    }
    if (this.textures.exists('spieler_side') && !this.anims.exists('spieler_side')) {
      this.anims.create({ key: 'spieler_side',
        frames: this.anims.generateFrameNumbers('spieler_side', { start: 0, end: 7 }),
        frameRate: 11, repeat: -1 });
    }
    this.spielerSprite = this.add.sprite(this.spielerX, this.spielerY,
      this.textures.exists('spieler_front') ? 'spieler_front' : undefined)
      .setOrigin(0.5, 1);   // Füße = Position; Höhe wird in zeichneSpieler einheitlich gesetzt
    this._spielerDX = 0; this._spielerDY = 1;   // letzte Laufrichtung (default: nach unten)
    this.highlightGfx = this.add.graphics().setDepth(90000);   // Interaktions-Ring immer sichtbar
    this.zeichneSpieler(false);

    // ---- Kamera folgt dem Spieler (Stadt scrollt mit) ----
    this.camTarget = this.add.zone(this.spielerX, this.spielerY, 1, 1);  // unsichtbares Folgeziel
    const fW = (48 + 48) * this.tileW / 2, fH = (48 + 48) * this.tileH / 2;
    // Grenzen großzügig im gekachelten Stadtbereich → nie schwarzer Rand
    this.cameras.main.setBounds(
      this.offsetX - fW / 2 - 1.5 * fW, this.offsetY - 1.5 * fH,
      fW + 3 * fW, fH + 3 * fH
    );
    // lerp 1 = die Kamera sitzt exakt auf dem Spieler (kein Nachziehen/Nachzittern,
    // wenn er stehen bleibt). roundPixels true = Scroll auf ganze Pixel gerundet
    // → Gebäude „vibrieren" beim Laufen nicht mehr.
    this.cameras.main.startFollow(this.camTarget, true, 1, 1);
    this.cameras.main.centerOn(this.spielerX, this.spielerY);
    // Sicherheitshalber nach Layout/Resize nochmal exakt auf den Spieler zentrieren
    this.time.delayedCall(60,  () => this.cameras.main.centerOn(this.spielerX, this.spielerY));
    this.time.delayedCall(300, () => this.cameras.main.centerOn(this.spielerX, this.spielerY));

    // ---- Zoom: adaptiver Startwert, rein bis ZOOM_MAX, raus bis _zoomMin ----
    // Untergrenze geräteabhängig: kleine Displays (Handy) dürfen weiter rauszoomen
    // (mehr Übersicht), große (Tablet) bleiben bei ~0,7 (sonst sieht man ins Leere).
    const ZOOM_MAX = 1.8;
    this._zoomMin = Phaser.Math.Clamp(this.scale.width / 1700, 0.45, 0.7);
    this._zoom = Phaser.Math.Clamp(this.scale.width / 500, this._zoomMin, 1.0);   // Startwert adaptiv
    this._applyZoom = () => {
      this.cameras.main.setZoom(this._zoom);
      this.cameras.main.setRoundPixels(true);
    };
    this._zoomUm = (faktor) => {
      this._zoom = Phaser.Math.Clamp(this._zoom * faktor, this._zoomMin, ZOOM_MAX);
      this._applyZoom();
      this.cameras.main.centerOn(this.spielerX, this.spielerY);
    };
    this._setzeZoom = this._applyZoom;   // bei Resize aktuellen Zoom beibehalten
    this._applyZoom();
    this.scale.on('resize', this._applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._applyZoom, this));

    // HTML +/- Buttons (unten rechts) → in die Szene
    window._zoomGame = (faktor) => this._zoomUm(faktor);
    this.events.once('shutdown', () => { window._zoomGame = null; });

    // Mausrad (Desktop)
    this.input.on('wheel', (pointer, over, dx, dy) => {
      if (modalOffen || this._menuAktiv) return;
      this._zoomUm(dy > 0 ? 0.9 : 1.1);
    });

    // Pinch (zwei Finger) – zweiten Zeiger aktivieren
    this.input.addPointer(1);
    this._pinchDist = 0;
    this.input.on('pointermove', () => {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1 && p2 && p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this._pinchDist > 0 && Math.abs(d - this._pinchDist) > 1.5) {
          this._zoomUm(d / this._pinchDist);
        }
        this._pinchDist = d;
      } else {
        this._pinchDist = 0;
      }
    });

    // ---- Nebel: zeigt die Grenze des bespielbaren Bereichs ----
    // Über dem zentralen Diamanten transparent, nach außen zunehmend neblig
    // (Häuser bleiben schemenhaft sichtbar) → erklärt, warum man nicht weiter kann.
    if (this.textures.exists('fog')) {
      this.add.image(this.offsetX, this.offsetY + fH / 2, 'fog')
        .setOrigin(0.5, 0.5).setDisplaySize(5200, 3300).setDepth(50000);
    }

    // Regen (über allem) – am Bildschirm fixiert, scrollt NICHT mit
    this.regenGfx = this.add.graphics().setDepth(99999).setScrollFactor(0);
    this.initRegen(W, H);

    // ---- Spenden-Bettler ----
    // Läuft von Anfang an zufällig durch die Stadt (Wander-Modus). Kommt er dem
    // Spieler nahe, bleibt er stehen, bettelt (Front-Pose) und zeigt eine
    // Sprechblase. Nach 10 Minuten wird er aufdringlich (Angriff → verfolgt den
    // Spieler, beim Kontakt kommt das Popup). Doppelklick öffnet das Menü.
    if (this.textures.exists('bettler_walk') && !this.anims.exists('bettler_walk')) {
      this.anims.create({ key: 'bettler_walk',
        frames: this.anims.generateFrameNumbers('bettler_walk', { start: 0, end: 7 }),
        frameRate: 11, repeat: -1 });
    }
    if (this.textures.exists('bettler_stand') && !this.anims.exists('bettler_stand')) {
      this.anims.create({ key: 'bettler_stand',
        frames: this.anims.generateFrameNumbers('bettler_stand', { start: 0, end: 3 }),
        frameRate: 4, repeat: -1 });
    }
    this.bettlerSprite = this.add.sprite(-9999, -9999, 'bettler_stand')
      .setOrigin(0.5, 1).setScale(BETTLER_H / 176).setVisible(false);   // Höhe wird je Pose einheitlich gesetzt
    this.bettlerBubble = this.add.text(0, 0, T("Haste mal 'n Euro?", "Got a spare quid?"), {
      fontFamily: '"Share Tech Mono", "Courier New", monospace', fontSize: '18px', fontStyle: 'bold',
      color: '#1a1a1a', backgroundColor: '#f5f0d8', padding: { x: 9, y: 6 },
      // hohe Auflösung → auch bei rausgezoomter Kamera scharf/lesbar
      resolution: Math.max(2, Math.min(window.devicePixelRatio || 2, 3)),
    }).setOrigin(0.5, 1).setDepth(95000).setVisible(false);
    this.bettlerZone   = this.add.zone(-9999, -9999, 40, 60).setDepth(96000).setInteractive();
    this.bettlerZone.on('pointerdown', () => this.klickBettler());
    this._bettlerExists = false;
    this._bettlerMode   = 'wander';   // 'wander' | 'attack'
    this._bettlerX = 0; this._bettlerY = 0;
    this._bettlerZielX = 0; this._bettlerZielY = 0;
    this._bettlerTapZeit = 0;
    this.initBettler();
    // Alle 10 Minuten Spielzeit wird er aufdringlich (Angriff).
    this._spendeTimer = this.time.addEvent({
      delay: 10 * 60 * 1000, loop: true,
      callback: () => this.spawnBettler(),
    });

    // ---- Räuber-NPC ----
    // Treibt sich NUR im Viertel rund um Schattenbank & Arztpraxis herum.
    // Taucht statistisch auf, verfolgt den Spieler in seinem Revier und überfällt
    // ihn bei Kontakt (Kooperieren = Bargeld weg; Kämpfen = 50/50). Man kann ihm
    // entkommen, indem man das Viertel verlässt.
    this.raeuberGfx = this.add.graphics();
    // Animierter Räuber-Sprite (16-Frame-Walkcycle, läuft nach rechts → für Links
    // gespiegelt). Ersetzt den früher gezeichneten Räuber.
    if (this.textures.exists('raeuber')) {
      if (!this.anims.exists('raeuber_walk')) {
        this.anims.create({ key: 'raeuber_walk',
          frames: this.anims.generateFrameNumbers('raeuber', { start: 0, end: 15 }),
          frameRate: 14, repeat: -1 });
      }
      this.raeuberSprite = this.add.sprite(-9999, -9999, 'raeuber').setOrigin(0.5, 1).setVisible(false);
    }
    // Sprechblase über dem Räuber – schwarz auf hell, wie beim Bettler
    this.raeuberBubble = this.add.text(0, 0, T('Geld oder Leben!', 'Your money or your life!'), {
      fontFamily: '"Share Tech Mono", "Courier New", monospace', fontSize: '18px', fontStyle: 'bold',
      color: '#1a1a1a', backgroundColor: '#f5f0d8', padding: { x: 9, y: 6 },
      resolution: Math.max(2, Math.min(window.devicePixelRatio || 2, 3)),
    }).setOrigin(0.5, 1).setDepth(95000).setVisible(false);
    this._raeuberExists = false;
    this._raeuberX = 0; this._raeuberY = 0;
    this._raeuberDX = 1;            // Laufrichtung (für Spiegelung)
    this._raeuberFrame = 0; this._raeuberWalkT = 0;
    this._raeuberLebt = 0;          // verbleibende Lebensdauer (s), dann zieht er ab
    this._raeuberCooldown = 0;      // Sperre nach einem Überfall (s)
    this._raeuberFreilauf = false;  // Test: ohne Revier-Beschränkung überall
    this.initRaeuberRevier();
    this._raeuberTimer = this.time.addEvent({
      delay: 12000, loop: true,     // alle 12 s eine Chance, dass er auftaucht
      callback: () => this.vielleichtRaeuber(),
    });

    // ---- Arbeitsamt: Wartenummer-System + grünes LED-Schild ----
    this._amtAktuell = Phaser.Math.Between(20, 60);   // aktuell aufgerufene Nummer
    this._amtNummer  = null;                          // gezogene Nummer des Spielers
    this._amtFenster = 0;                             // Rest des Zugangsfensters (s)
    this._amtTimer   = 25 + Math.random() * 10;       // bis zum nächsten Aufruf (~0,5 min)
    const amtOrt = ORTE_CONFIG.find(o => o.id === 'arbeitsamt');
    if (amtOrt) {
      const p = isoToScreen(amtOrt.col + 0.5, amtOrt.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      const sx = p.x, sy = p.y - this.tileH * 6.6;    // über dem Eingang (×3 feines Raster = 132 px wie zuvor)
      this.amtLedBg = this.add.rectangle(sx, sy, 74, 30, 0x0a0f08).setStrokeStyle(2, 0x214a21).setDepth(80000);
      this.amtLedText = this.add.text(sx, sy, 'Nr ' + this._amtNr(this._amtAktuell), {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '18px', fontStyle: 'bold', color: '#39ff14',
        resolution: Math.max(2, Math.min(window.devicePixelRatio || 2, 3)),
      }).setOrigin(0.5).setDepth(80001);
      this.amtLedText.setShadow(0, 0, '#1aff00', 8, false, true);
    }

    // Steuerung
    this.cursors       = this.input.keyboard.createCursorKeys();
    this.interactKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.interactEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

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
      window._aktiveMusik = 'spiel';
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
    try {
    const dt = delta / 1000;
    // Zeitraffer: 1× / 2× / 4× beschleunigt nur den Spiel-Kalender & periodische
    // Ereignisse (nicht Steuerung/Animation).
    const dtZeit = dt * (this.zeitTempo || 1);
    window._spielzeitSek = (window._spielzeitSek || 0) + dt;   // reale Spielzeit (mit Tempo NICHT skaliert)
    // Geklemmter dt für die Bewegung: verhindert „Sprints" nach Frame-Aussetzern
    // (Performance-Spikes) → konstantes Lauftempo statt erst schnell, dann langsam.
    const dtMove = Math.min(delta, 40) / 1000;

    // Regen + NPCs immer animieren
    this.animiereRegen(dt, this.scale.width, this.scale.height);
    this.npcTick += dt;
    if (this.npcTick >= 0.09) { this.npcTick = 0; this.animiereNPCs(); }
    this.dealerAnimT += dt;
    this.animiereDealer();

    // Bettler (läuft auch, während andere Spiellogik gerade pausiert)
    if (!modalOffen && !this._menuAktiv) this.updateBettler(dtMove);
    // Räuber
    if (this._raeuberCooldown > 0) this._raeuberCooldown -= dt;
    if (!modalOffen && !this._menuAktiv) this.updateRaeuber(dtMove, dt);
    // Arbeitsamt-Warteschlange läuft in Echtzeit weiter (auch bei offenem Popup)
    this.tickAmt(dtZeit);

    if (modalOffen) return;

    // Spielzeit
    this.zeitAkku += dtZeit;
    // Tag-Fortschritt: 7 Tage pro Woche = alle ECHTZEIT_PRO_WOCHE/7 Sekunden 1 Tag
    const tagSek = ECHTZEIT_PRO_WOCHE / 7;
    const neuTag = Math.floor(this.zeitAkku / tagSek) + 1;
    if (neuTag !== gameState.tag && neuTag <= 7) {
      gameState.tag = neuTag;
      this.tagGewechselt(neuTag);
    }
    if (this.zeitAkku >= ECHTZEIT_PRO_WOCHE) {
      this.zeitAkku -= ECHTZEIT_PRO_WOCHE;
      this.spielwocheVorbei();
    }

    // Events
    this.eventTimer -= dt;   // echte Zeit → Events werden vom Zeitraffer NICHT beschleunigt
    if (this.eventTimer <= 0) {
      this.eventTimer = randomEventIntervall();
      triggerEvent(waehleEvent());
      return;
    }

    tickRazziaTimer(dtZeit);
    tickAutoSave(dtZeit);  // Auto-Save alle 2 Minuten

    // Regen-Toggle
    this.regenTimer -= dtZeit;
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

    // ---- Bewegung: flüssig & frei auf der begehbaren Fläche ----
    let moved = false;
    const _vorherX = this.spielerX, _vorherY = this.spielerY;   // für Laufrichtung

    // Tastatur: kontinuierlich, solange gedrückt (Bildschirmrichtungen)
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown)  vx -= 1;
    if (this.cursors.right.isDown) vx += 1;
    if (this.cursors.up.isDown)    vy -= 1;
    if (this.cursors.down.isDown)  vy += 1;
    if (vx || vy) {
      this.pfad = []; this.pfadZielOrt = null;   // Tastatur bricht Klick-Pfad ab
      const len = Math.hypot(vx, vy);
      const sx = (vx / len) * this.SPEED * dtMove;
      const sy = (vy / len) * this.SPEED * dtMove;
      if      (this.weltBegehbar(this.spielerX + sx, this.spielerY + sy)) { this.spielerX += sx; this.spielerY += sy; moved = true; }
      else if (this.weltBegehbar(this.spielerX + sx, this.spielerY))      { this.spielerX += sx; moved = true; }
      else if (this.weltBegehbar(this.spielerX, this.spielerY + sy))      { this.spielerY += sy; moved = true; }
    } else if (this.pfad.length) {
      // Klick-Pfad: flüssig zum nächsten Wegpunkt (mehrere pro Frame möglich)
      let rest = this.SPEED * dtMove;
      while (rest > 0 && this.pfad.length) {
        const ziel = this.pfad[0];
        const dx = ziel.x - this.spielerX, dy = ziel.y - this.spielerY;
        const dist = Math.hypot(dx, dy);
        if (dist <= rest) { this.spielerX = ziel.x; this.spielerY = ziel.y; this.pfad.shift(); rest -= dist; }
        else { this.spielerX += (dx / dist) * rest; this.spielerY += (dy / dist) * rest; rest = 0; }
      }
      moved = true;
      if (this.pfad.length === 0 && this.pfadZielOrt) {   // nur bei Doppelklick gesetzt
        const ortId = this.pfadZielOrt; this.pfadZielOrt = null;
        this.cameras.main.centerOn(this.spielerX, this.spielerY);   // Kamera fixieren → kein Nachziehen hinterm Menü
        interact(ortId);
      }
    }

    if (moved) {
      this.istAufMove = true;
      const ddx = this.spielerX - _vorherX, ddy = this.spielerY - _vorherY;
      if (ddx || ddy) { this._spielerDX = ddx; this._spielerDY = ddy; }   // Laufrichtung merken
      this.aktualisiereTile();
      this.zeichneSpieler(true);
      this.aktualisiereHighlight();
    } else if (this.istAufMove) {
      this.istAufMove = false;
      this.zeichneSpieler(false);
    }

    // Interagieren (E / Enter)
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        Phaser.Input.Keyboard.JustDown(this.interactEnter)) {
      this.versucheInteraktion();
    }
    } catch (e) {
      // Eine einzelne fehlerhafte Frame darf das Spiel NICHT dauerhaft einfrieren.
      if (!this._updateFehlerGemeldet) { this._updateFehlerGemeldet = true; console.error('[update]', e); }
    }
  }

  // ------------------------------------------------------------------
  // SPIELER MIT LAUFANIMATION
  // ------------------------------------------------------------------
  zeichneSpieler(laufen) {
    // Spieler-Position für Savegame exportieren
    window._spielerPosExport = { col: this.spielerCol, row: this.spielerRow };

    const s = this.spielerSprite;
    if (s) s.setPosition(this.spielerX, this.spielerY).setDepth(this.spielerY);
    // Kamera-Folgeziel mitführen – auf Bildschirm-Pixel-Raster snappen (zoom-fest),
    // damit Gebäude bei gebrochenem Zoom nicht ruckeln/vibrieren.
    if (this.camTarget) {
      const cz = this.cameras.main.zoom || 1;
      this.camTarget.setPosition(Math.round(this.spielerX * cz) / cz, Math.round(this.spielerY * cz) / cz);
    }
    if (!s) return;

    if (!laufen) {
      // Stehen: ruhige Front-Pose, Animation anhalten
      s.anims.stop();
      if (this.textures.exists('spieler_front')) s.setTexture('spieler_front', 0);
      s.setFlipX(false);
    } else {
      // Laufrichtung bestimmt Ansicht: horizontal → Seitenprofil (gespiegelt),
      // vertikal → Frontansicht.
      const dx = this._spielerDX || 0, dy = this._spielerDY || 0;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (this.anims.exists('spieler_side')) s.play('spieler_side', true);
        s.setFlipX(dx < 0);                    // Sheet zeigt nach rechts
      } else {
        if (this.anims.exists('spieler_front')) s.play('spieler_front', true);
        s.setFlipX(false);
      }
    }
    // Einheitliche Anzeigehöhe – die Front- und Seiten-Sheets sind unterschiedlich
    // hoch; fixe Skalierung ließ den Spieler beim Vorwärtslaufen schrumpfen.
    if (s.height) s.setScale(SPIELER_H / s.height);
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
    // Deko-NPCs (kleine bunte Figuren) entfernt – nicht mehr gebraucht.
    this.npcs = [];
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

  // Animierter Dealer im Park (Ort 'dealer' bei col/row 14/14).
  // Nervöses Loitern: Kopf glanzt nach „Cops", leichtes Wippen, ab und zu Deal-Funkeln.
  animiereDealer() {
    // Dealer ist jetzt ein Sprite (dealer.png) → gezeichnete Variante deaktiviert.
    if (this.dealerSprite) { if (this.dealerGfx) this.dealerGfx.clear(); return; }
    if (!this.dealerGfx) return;
    const ort = ORTE_CONFIG.find(o => o.id === 'dealer');
    if (!ort) { this.dealerGfx.clear(); return; }
    const { tileW: tw, tileH: th } = this;
    const base = isoToScreen(ort.col + 0.5, ort.row + 0.5, tw, th, this.offsetX, this.offsetY);
    this.dealerGfx.setDepth(base.y + 0.2);   // Iso-Tiefe wie Gebäude/Spieler
    const dxp = base.x - tw * 0.05, dyp = base.y - th * 0.04;
    const t = this.dealerAnimT;
    const glance = Math.sin(t * 1.7) * 2.4;          // Kopf links/rechts (nervös)
    const sway   = Math.sin(t * 0.9) * 1.1;          // Körper-Wippen
    const g = this.dealerGfx;
    g.clear();
    // Schatten
    g.fillStyle(0x000000, 0.20); g.fillEllipse(dxp + sway, dyp + 2, 16, 5);
    // Mantel
    g.fillStyle(0x16161e, 1); g.fillRect(dxp - 5 + sway, dyp - th * 0.38, 10, th * 0.38);
    // Kapuze (mit Glance)
    g.fillStyle(0x101016, 1);
    g.fillTriangle(dxp - 7 + sway, dyp - th * 0.30, dxp + 7 + sway, dyp - th * 0.30,
                   dxp + glance + sway, dyp - th * 0.54);
    // Gesicht im Dunkel
    g.fillStyle(0x2a2a33, 1); g.fillCircle(dxp + glance + sway, dyp - th * 0.40, 4.5);
    // gelegentliches „Deal"-Funkeln in der Hand
    if (Math.sin(t * 0.6) > 0.93) {
      g.fillStyle(0xffe87a, 0.85); g.fillCircle(dxp + 8 + sway, dyp - th * 0.20, 1.8);
    }
  }

  // ----------------------------------------------------------------
  // HILFSMETHODEN
  // ----------------------------------------------------------------
  // Wird bei jedem Tageswechsel aufgerufen – Lebensmittel-Vorrat & Hunger.
  tagGewechselt(tag) {
    const gs = gameState;
    if (gs.gameOver) return;
    // Vorrat verbraucht sich täglich
    if (gs.lebensmittelTageRest > 0) {
      gs.lebensmittelTageRest--;
      if (gs.lebensmittelTageRest === 0) gs.lebensmittelDiesenMonat = null;   // Vorrat aufgebraucht
    }
    // Kühlschrank leer → Hunger
    if (gs.lebensmittelTageRest <= 0) {
      if (!gs.kuehlschrankWarnung) {
        gs.kuehlschrankWarnung = true;
        gs.supermarktFaellig = true;
        oeffneModal(T('🧊 Kühlschrank ist leer!', '🧊 The fridge is empty!'),
          T('Dein Lebensmittel-Vorrat ist <strong>aufgebraucht</strong>.<br><br>', 'Your food supply is <strong>used up</strong>.<br><br>') +
          T('Ohne Essen verlierst du jetzt <strong>jeden Tag −5 Gesundheit, −3 Energie</strong> und Laune. ', 'With no food you now lose <strong>−5 Health, −3 Energy</strong> and Mood every day. ') +
          T('Geh zum <strong>Supermarkt</strong> – ein Einkauf reicht ca. <strong>2 Wochen</strong>!', 'Head to the <strong>supermarket</strong> – one shop lasts about <strong>2 weeks</strong>!'), []);
        logEvent(T('🧊 Kühlschrank leer! Ab zum Supermarkt.', '🧊 Fridge empty! Off to the supermarket.'), 'warn');
      }
      gs.gesundheit       = clamp(gs.gesundheit - 5, 0, 100);
      gs.energie          = clamp(gs.energie - 3, 0, 100);
      gs.happinessSpieler = clamp(gs.happinessSpieler - 3, 0, 100);
      logEvent(T('🍽️ Leerer Kühlschrank: −5 Gesundheit, −3 Energie.', '🍽️ Empty fridge: −5 Health, −3 Energy.'), 'danger');
      if (gs.gesundheit <= 0) { updateHUD(); triggerGameOver('gesundheit'); return; }
    }
    updateHUD();
  }

  spielwocheVorbei() {
    gameState.woche++; this.wochenSeitMonat++;
    gameState.tag = 1;  // Woche beginnt immer mit Tag 1
    gameState.energie = clamp(gameState.energie - 3, 0, 100);
    gameState.bankEinzahlungDieseWoche = 0;  // Wochenlimit Bank reset
    // (Lebensmittel-Konsequenzen laufen tagesweise in tagGewechselt())

    // Pflichttermin nur prüfen, wenn man NICHT krankgeschrieben ist
    if ((gameState.krankmeldungWochenRest || 0) > 0) {
      logEvent(T('🤒 Krankgeschrieben – kein Pflichttermin nötig.', '🤒 On sick leave – no mandatory appointment needed.'), 'good');
    } else {
    gameState.naechsterAmtsBesuch--;
    if (gameState.naechsterAmtsBesuch <= 0) {
      gameState.risikoRaster = clamp(gameState.risikoRaster + 15, 0, 100);
      gameState.naechsterAmtsBesuch = 2;
      gameState.amtsTermineVerpasst = (gameState.amtsTermineVerpasst || 0) + 1;
      logEvent(T(`⚠️ Pflichttermin verpasst! (${gameState.amtsTermineVerpasst}x) Risiko +15.`, `⚠️ Mandatory appointment missed! (${gameState.amtsTermineVerpasst}x) Risk +15.`), 'danger');
      if (gameState.amtsTermineVerpasst >= 3) {
        gameState.algGesperrt = true;
        oeffneModal(T('🛑 ALG gesperrt!', '🛑 Benefits suspended!'),
          T(`Du hast <strong>3 Pflichttermine</strong> verpasst!<br><br>`
          + 'Das ALG wird einbehalten bis du persönlich erscheinst.<br>'
          + 'Besuche das <strong>Arbeitsamt</strong>, um die Sperre aufzuheben.',
            `You have missed <strong>3 mandatory appointments</strong>!<br><br>`
          + 'Your benefits are withheld until you show up in person.<br>'
          + 'Visit the <strong>job centre</strong> to lift the suspension.'),
          []);
        logEvent(T('🛑 ALG gesperrt nach 3 verpassten Terminen!', '🛑 Benefits suspended after 3 missed appointments!'), 'danger');
        soundAlarm && soundAlarm();
      } else {
        oeffneModal(T('⚠️ Pflichttermin verpasst!', '⚠️ Mandatory appointment missed!'),
          T(`Kein Amt-Besuch! (${gameState.amtsTermineVerpasst}/3)<br><br><strong>Risiko +15</strong><br>Bei 3 Fehlterminen wird das ALG gesperrt!`, `No office visit! (${gameState.amtsTermineVerpasst}/3)<br><br><strong>Risk +15</strong><br>After 3 missed appointments your benefits are suspended!`), []);
      }
    }
    }   // Ende: Pflichttermin nur ohne Krankmeldung

    // Krankmeldung/Cooldown am Wochenende runterzählen (nach der Termin-Prüfung)
    if ((gameState.krankmeldungWochenRest || 0) > 0) gameState.krankmeldungWochenRest--;
    if ((gameState.krankmeldungCooldownWochen || 0) > 0) gameState.krankmeldungCooldownWochen--;

    if (this.wochenSeitMonat >= WOCHEN_PRO_MONAT) {
      this.wochenSeitMonat = 0; monatsAbschluss();
    }
    updateHUD(); pruefeRisiko();
  }

  // Lauf-Schritt-Animation (gemeinsam für Tastatur und Klick-Pfad)
  _schrittAnim() {
    this.inputCooldown = 130;
    this.istAufMove    = true;
    this.walkFrame     = (this.walkFrame + 1) % 4;
    this.walkTimer     = this.WALK_FPS;
    this.zeichneSpieler(true);
    this.aktualisiereHighlight();
    clearTimeout(this._idleTimeout);
    this._idleTimeout = setTimeout(() => { this.istAufMove = false; this.zeichneSpieler(false); }, 350);
  }

  // Begehbar = im Feld und kein Gebäude-Feld (Straße/Bürgersteig/Lücken frei)
  begehbar(c, r) {
    // Spieldiamant 0..15 + voller Laufweg-Ring (−1..16) rundherum.
    return c >= GEH_MIN && c <= GEH_MAX && r >= GEH_MIN && r <= GEH_MAX && !this.blockierteFelder.has(c + ',' + r);
  }

  // Bildschirm-/Weltkoordinate → Kachel (col,row)
  screenZuTile(X, Y) {
    const dcr = (X - this.offsetX) / (this.tileW / 2);     // c - r
    const scr = (Y - this.offsetY) / (this.tileH / 2) - 1; // c + r
    const c = Math.round((scr + dcr) / 2);
    const r = Math.round((scr - dcr) / 2);
    if (c < GEH_MIN || c > GEH_MAX || r < GEH_MIN || r > GEH_MAX) return null;
    return { col: c, row: r };
  }

  // Breitensuche über begehbare Felder. istZiel(c,r) → bool. Liefert Pfad
  // (Liste von {col,row} ohne Start) oder null.
  bfs(startC, startR, istZiel) {
    const key = (c, r) => c + ',' + r;
    const q = [{ col: startC, row: startR }];
    const prev = { [key(startC, startR)]: null };
    let ziel = null;
    while (q.length) {
      const cur = q.shift();
      if (istZiel(cur.col, cur.row) && !(cur.col === startC && cur.row === startR)) { ziel = cur; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.col + dx, nr = cur.row + dy;
        if (nc < GEH_MIN || nc > GEH_MAX || nr < GEH_MIN || nr > GEH_MAX) continue;
        const k = key(nc, nr);
        if (k in prev) continue;
        if (!this.begehbar(nc, nr)) continue;
        prev[k] = { col: cur.col, row: cur.row };
        q.push({ col: nc, row: nr });
      }
    }
    if (!ziel) return null;
    const pfad = []; let c = ziel;
    while (c && !(c.col === startC && c.row === startR)) { pfad.unshift(c); c = prev[key(c.col, c.row)]; }
    return pfad;
  }

  // Welt-Koordinate begehbar?
  weltBegehbar(x, y) {
    const t = this.screenZuTile(x, y);
    return !!t && this.begehbar(t.col, t.row);
  }

  // Um ein Hindernis herum: senkrecht zur Zielrichtung ausweichen (NPC läuft
  // nicht durch Gebäude). Liefert neue Position oder null (rundum blockiert).
  _ausweichen(x, y, dx, dy, step) {
    const d = Math.hypot(dx, dy) || 1;
    const px = -dy / d, py = dx / d;
    for (const s of [1, -1]) {
      const nx = x + px * s * step, ny = y + py * s * step;
      if (this.weltBegehbar(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  // ---- Spenden-Bettler: spawnen, verfolgen, erwischen ----
  // Lässt einen Bettler weit weg vom Spieler erscheinen, der ihn dann verfolgt.
  // Bettler an einem zufälligen, begehbaren Punkt ins Leben rufen (Wander-Modus).
  initBettler() {
    // Auch nach "Nicht mehr fragen" darf er wandern (nur kein aufdringliches
    // Betteln mehr) → kein bettlerDeaktiviert-Abbruch beim Spawn.
    if (this._bettlerExists || gameState.gameOver) return;
    let best = null, bestD = -1;
    for (let i = 0; i < 40; i++) {
      const c = Phaser.Math.Between(0, 47), r = Phaser.Math.Between(0, 47);
      if (!this.begehbar(c, r)) continue;
      const p = isoToScreen(c + 0.5, r + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.spielerX, this.spielerY);
      if (d > bestD) { bestD = d; best = p; }   // möglichst weit weg starten
    }
    if (!best) return;
    this._bettlerX = best.x; this._bettlerY = best.y;
    this._bettlerExists = true;
    this._bettlerMode = 'wander';
    this.neuesWanderZiel();
    if (this.bettlerSprite) {
      this.bettlerSprite.setPosition(this._bettlerX, this._bettlerY).setDepth(this._bettlerY).setVisible(true);
      if (this.anims.exists('bettler_walk')) this.bettlerSprite.play('bettler_walk', true);
    }
  }

  // 10-Min-Timer / Test-Knopf: Bettler wird aufdringlich und greift an.
  spawnBettler() {
    if (bettlerDeaktiviert()) return;
    if (gameState.gameOver) return;
    if (!this._bettlerExists) this.initBettler();
    if (!this._bettlerExists) return;
    this._bettlerMode = 'attack';
    this._bettlerPfad = null; this._bettlerRepath = 0;   // frischen Pfad zum Spieler erzwingen
    logEvent(T('🧎 Der Bettler wird aufdringlich und stürzt sich auf dich!', '🧎 The beggar gets pushy and lunges at you!'), 'warn');
  }

  // Neues, zufälliges Wanderziel (begehbare Kachel) wählen.
  neuesWanderZiel() {
    this._bettlerPfad = null; this._bettlerRepath = 0;   // Pfad zum neuen Ziel neu berechnen
    for (let i = 0; i < 40; i++) {
      const c = Phaser.Math.Between(0, 47), r = Phaser.Math.Between(0, 47);
      if (!this.begehbar(c, r)) continue;
      const p = isoToScreen(c + 0.5, r + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      this._bettlerZielX = p.x; this._bettlerZielY = p.y; return;
    }
  }

  // Bettler einen Schritt Richtung (zx,zy) bewegen. true = bewegt, false = blockiert.
  _bettlerSchritt(zx, zy, speed, dt) {
    const dx = zx - this._bettlerX, dy = zy - this._bettlerY;
    const d = Math.hypot(dx, dy) || 1;
    const sx = (dx / d) * speed * dt, sy = (dy / d) * speed * dt;
    if      (this.weltBegehbar(this._bettlerX + sx, this._bettlerY + sy)) { this._bettlerX += sx; this._bettlerY += sy; return true; }
    else if (this.weltBegehbar(this._bettlerX + sx, this._bettlerY))      { this._bettlerX += sx; return true; }
    else if (this.weltBegehbar(this._bettlerX, this._bettlerY + sy))      { this._bettlerY += sy; return true; }
    return false;
  }

  // Klick auf den Bettler: Doppelklick öffnet das Spenden-Menü.
  klickBettler() {
    const now = this.time.now;
    if (now - this._bettlerTapZeit < 350) {     // Doppelklick erkannt
      this._bettlerTapZeit = 0;
      if (!modalOffen && !this._menuAktiv) oeffneSpendenModal();
    } else {
      this._bettlerTapZeit = now;
    }
  }

  // Bettler entfernen (z. B. nach "Nicht mehr fragen").
  despawnBettler() {
    this._bettlerExists = false;
    if (this.bettlerSprite) this.bettlerSprite.setVisible(false).setPosition(-9999, -9999);
    this.bettlerBubble.setVisible(false);
    this.bettlerZone.setPosition(-9999, -9999);
  }

  // Pro Frame: Bettler bewegen (wandern oder angreifen), Sprechblase, Klickzone.
  updateBettler(dt) {
    if (!this._bettlerExists) return;
    // Weggeschickt ("Nicht mehr fragen") → NICHT verschwinden, nur nicht mehr
    // aufdringlich werden: er wandert einfach weiter herum.
    if (bettlerDeaktiviert() && this._bettlerMode === 'attack') {
      this._bettlerMode = 'wander'; this.neuesWanderZiel(); this.bettlerBubble.setVisible(false);
    }

    const dx = this.spielerX - this._bettlerX, dy = this.spielerY - this._bettlerY;
    const dist = Math.hypot(dx, dy);
    let geht = true;             // läuft er (walk) oder bettelt er stehend (stand)?
    let blickRichtung = 0;       // -1 nach links, +1 nach rechts, 0 = Front

    if (this._bettlerMode === 'attack') {
      if (dist < 26) {                          // erwischt → Popup, danach wieder wandern
        this._bettlerMode = 'wander';
        this.neuesWanderZiel();
        this.bettlerBubble.setVisible(false);
        this.zeigeBettler();
      } else {
        // Pathfinding zum Spieler (läuft um Gebäude herum, nicht hindurch)
        const vx = this._bettlerX;
        this._bettlerRepath = (this._bettlerRepath || 0) - dt;
        if (this._bettlerRepath <= 0 || !this._bettlerPfad || !this._bettlerPfad.length) {
          this._bettlerPfad = this.npcPfad(this._bettlerX, this._bettlerY, this.spielerX, this.spielerY) || [];
          this._bettlerRepath = 0.35;
        }
        if (this._bettlerPfad.length) {
          const np = this.folgePfad(this._bettlerX, this._bettlerY, this._bettlerPfad, 105, dt);
          this._bettlerX = np.x; this._bettlerY = np.y;
        } else if (!this._bettlerSchritt(this.spielerX, this.spielerY, 105, dt)) {
          const a = this._ausweichen(this._bettlerX, this._bettlerY, dx, dy, 105 * dt);
          if (a) { this._bettlerX = a.x; this._bettlerY = a.y; }
        }
        const mvx = this._bettlerX - vx;
        blickRichtung = mvx < -0.01 ? -1 : (mvx > 0.01 ? 1 : (dx < 0 ? -1 : 1));
      }
    } else {                                     // wander
      if (dist < 135) {
        // nah am Spieler → stehenbleiben und betteln (Front-Pose + Sprechblase)
        geht = false;
      } else {
        const vx = this._bettlerX;
        const zd = Math.hypot(this._bettlerZielX - this._bettlerX, this._bettlerZielY - this._bettlerY);
        if (zd < 18) { this.neuesWanderZiel(); }   // Ziel erreicht → neues
        // Pathfinding zum Wanderziel (läuft um Gebäude herum statt hängenzubleiben)
        this._bettlerRepath = (this._bettlerRepath || 0) - dt;
        if (this._bettlerRepath <= 0 || !this._bettlerPfad || !this._bettlerPfad.length) {
          this._bettlerPfad = this.npcPfad(this._bettlerX, this._bettlerY, this._bettlerZielX, this._bettlerZielY) || [];
          this._bettlerRepath = 0.5;
          if (!this._bettlerPfad.length) this.neuesWanderZiel();   // unerreichbar → neues Ziel
        }
        if (this._bettlerPfad.length) {
          const np = this.folgePfad(this._bettlerX, this._bettlerY, this._bettlerPfad, 52, dt);
          this._bettlerX = np.x; this._bettlerY = np.y;
        }
        const mvx = this._bettlerX - vx;
        blickRichtung = mvx < -0.01 ? -1 : 1;
      }
    }

    // Sprechblase, wenn er (im Wander-Modus) nah genug ist
    const bubbleAn = this._bettlerMode === 'wander' && dist < 135;
    this.bettlerBubble.setVisible(bubbleAn);
    if (bubbleAn) this.bettlerBubble.setPosition(this._bettlerX, this._bettlerY - BETTLER_H - 8);
    // Klickzone mitführen (über dem Bettler-Körper)
    this.bettlerZone.setPosition(this._bettlerX, this._bettlerY - 26);

    // Sprite positionieren + passende Animation/Blickrichtung
    const s = this.bettlerSprite;
    if (s) {
      s.setPosition(this._bettlerX, this._bettlerY).setDepth(this._bettlerY).setVisible(true);
      if (geht) {
        if (this.anims.exists('bettler_walk')) s.play('bettler_walk', true);
        s.setFlipX(blickRichtung < 0);          // Sheet zeigt nach rechts → spiegeln für links
      } else {
        if (this.anims.exists('bettler_stand')) s.play('bettler_stand', true);
        s.setFlipX(false);                       // bettelnd nach vorn
      }
      if (s.height) s.setScale(BETTLER_H / s.height);   // einheitliche Höhe (Stehen/Gehen)
    }
  }

  // Popup zeigen – aber nur, wenn der Spieler nicht gerade in einem Menü/Popup
  // steckt und es nicht dauerhaft abgeschaltet wurde.
  zeigeBettler() {
    if (bettlerDeaktiviert()) return;
    if (modalOffen || this._menuAktiv || gameState.gameOver) {
      this.time.delayedCall(2000, () => this.zeigeBettler());   // gleich erneut versuchen
      return;
    }
    oeffneSpendenModal();
  }

  // ============================================================
  //  RÄUBER  (nur im Viertel um Schattenbank & Arztpraxis)
  // ============================================================
  // Revier aus den beiden Gebäudepositionen berechnen (Mittelpunkt + Radius).
  initRaeuberRevier() {
    const find = id => ORTE_CONFIG.find(o => o.id === id);
    const a = find('schattenbank'), b = find('arztpraxis');
    if (!a || !b) { this._revier = null; return; }
    const pa = isoToScreen(a.col + 0.5, a.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
    const pb = isoToScreen(b.col + 0.5, b.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
    // Nordgrenze = Straße unterhalb von Kirche & Bank → Räuber darf nie weiter hoch
    const k = find('kirche'), bk = find('bank');
    let minY = -Infinity;
    [k, bk].forEach(o => {
      if (!o) return;
      const p = isoToScreen(o.col + 0.5, o.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      minY = Math.max(minY, p.y + this.tileH * 3.0);   // eine (alte) Reihe unter dem Gebäude (×3 feines Raster)
    });
    this._revier = {
      cx: (pa.x + pb.x) / 2, cy: (pa.y + pb.y) / 2,
      // Radius gedeckelt → bleibt ein Viertel, nicht die halbe Karte
      // Radius muss BEIDE definierenden Gebäude (Schattenbank/Arztpraxis) abdecken
      // (je ~385 px vom Mittelpunkt) + etwas Roam-Rand → Cap 460 statt 300.
      r: Math.min(Phaser.Math.Distance.Between(pa.x, pa.y, pb.x, pb.y) / 2 + 120, 460),
      minY: isFinite(minY) ? minY : -Infinity,
    };
  }

  imRevier(x, y) {
    const z = this._revier;
    if (!z) return false;
    if (y < z.minY) return false;   // nördlich der Straße unter Kirche/Bank: tabu
    return Phaser.Math.Distance.Between(x, y, z.cx, z.cy) <= z.r;
  }

  // Statistische Chance, dass der Räuber auftaucht – nur wenn der Spieler im
  // Revier ist, er nicht schon da ist und keine Sperre läuft.
  vielleichtRaeuber() {
    if (this._raeuberExists || gameState.gameOver) return;
    if (this._raeuberCooldown > 0 || !this._revier) return;
    if (!this.imRevier(this.spielerX, this.spielerY)) return;
    if (Math.random() > 0.45) return;            // ~45 % pro Prüfung
    this.spawnRaeuber();
  }

  // Räuber im Revier (etwas entfernt vom Spieler) erscheinen lassen.
  spawnRaeuber() {
    if (this._raeuberExists || !this._revier) return;
    let best = null, bestD = 1e9;
    for (let i = 0; i < 80; i++) {
      const c = Phaser.Math.Between(0, 47), r = Phaser.Math.Between(0, 47);
      if (!this.begehbar(c, r)) continue;
      const p = isoToScreen(c + 0.5, r + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      if (!this.imRevier(p.x, p.y)) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.spielerX, this.spielerY);
      if (d > 140 && d < bestD) { bestD = d; best = p; }   // nicht direkt auf dem Spieler
    }
    if (!best) return;
    this._raeuberX = best.x; this._raeuberY = best.y;
    this._raeuberExists = true;
    this._raeuberLebt = 55;            // bleibt ~55 s, dann zieht er ab
    this._raeuberFrame = 0; this._raeuberWalkT = 0;
    logEvent(T('🔫 Im Schatten-Viertel lungert ein Räuber herum …', '🔫 A robber is lurking in the shady district …'), 'warn');
  }

  despawnRaeuber() {
    this._raeuberExists = false;
    this._raeuberFreilauf = false;
    this.raeuberGfx.clear();
    if (this.raeuberSprite) this.raeuberSprite.setVisible(false).setPosition(-9999, -9999);
    if (this.raeuberBubble) this.raeuberBubble.setVisible(false);
  }

  // Test (Zahnrad): Räuber sofort neben dem Spieler erscheinen lassen – überall.
  spawnRaeuberTest() {
    if (this._raeuberExists) return;
    this._raeuberCooldown = 0;
    const ang = Math.random() * Math.PI * 2;
    this._raeuberX = this.spielerX + Math.cos(ang) * 120;
    this._raeuberY = this.spielerY + Math.sin(ang) * 120;
    this._raeuberExists = true;
    this._raeuberFreilauf = true;
    this._raeuberLebt = 55;
    this._raeuberFrame = 0; this._raeuberWalkT = 0;
    logEvent(T('🔫 (Test) Ein Räuber taucht auf …', '🔫 (Test) A robber shows up …'), 'warn');
  }

  updateRaeuber(dt, dtReal) {
    if (!this._raeuberExists) return;
    this._raeuberLebt -= dtReal;
    if (this._raeuberLebt <= 0) {                // gibt auf und verschwindet
      this.despawnRaeuber();
      logEvent(T('Der Räuber ist abgezogen.', 'The robber has cleared off.'), '');
      return;
    }
    const dx = this.spielerX - this._raeuberX, dy = this.spielerY - this._raeuberY;
    const dist = Math.hypot(dx, dy);

    // Hat den Spieler erreicht → stehen bleiben (nicht weiter/überlaufen).
    this._raeuberSteht = dist < 40;
    // Überfall, sobald er den Spieler ERREICHT hat (steht) – nicht erst bei
    // engerem Abstand, sonst bleibt er davor stehen ohne anzugreifen.
    if (this._raeuberSteht && this._raeuberCooldown <= 0 && gameState.losesBargeld >= 20) {
      this.ueberfall(); return;
    }
    // Erreicht, aber nichts zu holen (zu wenig Bargeld oder Sperre nach Überfall)
    // → kurz stehen bleiben, dann abziehen (statt den Spieler endlos zu verfolgen).
    if (this._raeuberSteht && (this._raeuberCooldown > 0 || gameState.losesBargeld < 20)) {
      this._raeuberAufgeben = (this._raeuberAufgeben || 0) + dt;
      if (this._raeuberAufgeben > 2.5) {
        this._raeuberAufgeben = 0;
        this.despawnRaeuber();
        logEvent(T('Der Räuber lässt von dir ab.', 'The robber gives up on you.'), '');
        return;
      }
    } else {
      this._raeuberAufgeben = 0;
    }

    // Spieler per Pathfinding verfolgen – aber nur, solange er im Revier ist und
    // ihn noch nicht erreicht hat (verlässt der Spieler das Viertel, gibt der
    // Räuber die Jagd auf → entkommen).
    if (!this._raeuberSteht && (this._raeuberFreilauf || this.imRevier(this.spielerX, this.spielerY))) {
      this._raeuberRepath = (this._raeuberRepath || 0) - dt;
      if (this._raeuberRepath <= 0 || !this._raeuberPfad || !this._raeuberPfad.length) {
        this._raeuberPfad = this.npcPfad(this._raeuberX, this._raeuberY, this.spielerX, this.spielerY) || [];
        this._raeuberRepath = 0.4;
      }
      if (this._raeuberPfad.length) {
        const np = this.folgePfad(this._raeuberX, this._raeuberY, this._raeuberPfad, 80, dt);
        // Nur bewegen, wenn Ziel im Revier UND begehbar (nie durch Gebäude laufen).
        if ((this._raeuberFreilauf || this.imRevier(np.x, np.y)) && this.weltBegehbar(np.x, np.y)) {
          if (Math.abs(np.x - this._raeuberX) > 0.05) this._raeuberDX = np.x - this._raeuberX;
          this._raeuberX = np.x; this._raeuberY = np.y;
        } else {
          this._raeuberPfad = [];   // blockiert/außer Revier → neu planen
        }
      }
    } else if (!this._raeuberSteht && !this._raeuberFreilauf && this._revier
               && !this.imRevier(this.spielerX, this.spielerY)) {
      // Spieler hat das Schatten-Viertel verlassen → der Räuber gibt die
      // Verfolgung auf und verschwindet (statt am Rand „auf der Stelle" zu laufen).
      this.despawnRaeuber();
      logEvent(T('Der Räuber gibt die Verfolgung auf.', 'The robber breaks off the chase.'), '');
      return;
    } else {
      this._raeuberPfad = [];   // erreicht/wartet → nicht verfolgen
    }
    // Läuft er tatsächlich? (sonst Laufanimation aus → kein „Laufen auf der Stelle")
    this._raeuberBewegt = Math.hypot(
      this._raeuberX - (this._raeuberPrevX ?? this._raeuberX),
      this._raeuberY - (this._raeuberPrevY ?? this._raeuberY)) > 0.3;
    this._raeuberPrevX = this._raeuberX; this._raeuberPrevY = this._raeuberY;
    // Sprechblase „Geld oder Leben!" wenn er sich nähert
    if (this.raeuberBubble) {
      const nah = dist < 150;
      this.raeuberBubble.setVisible(nah);
      if (nah) this.raeuberBubble.setPosition(this._raeuberX, this._raeuberY - RAEUBER_H - 8);
    }
    this._raeuberWalkT += dt;
    if (this._raeuberWalkT > 0.12) { this._raeuberWalkT = 0; this._raeuberFrame = (this._raeuberFrame + 1) % 4; }
    this.drawRaeuber(this._raeuberX, this._raeuberY);
  }

  // Der Überfall: Popup mit Kooperieren / Kämpfen.
  ueberfall() {
    this._raeuberCooldown = 999;        // während des Popups keine Mehrfach-Auslösung
    const bar = gameState.losesBargeld;
    const html = T(
      `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8cfa0;">` +
      `„<b>Geld oder Leben!</b>" Ein maskierter Räuber stellt dich im Schatten-Viertel.<br>` +
      `Du hast <b>${formatEuro(bar)}</b> loses Bargeld dabei.</span>`,
      `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8cfa0;">` +
      `„<b>Your money or your life!</b>" A masked robber corners you in the shady district.<br>` +
      `You are carrying <b>${formatEuro(bar)}</b> in loose cash.</span>`);
    oeffneModal(T('🔫 Überfall!', '🔫 Mugging!'), html, [
      { label: T('🙌 Kooperieren – Bargeld abgeben', '🙌 Cooperate – hand over the cash'), danger: true, callback: () => {
        gameState.losesBargeld = 0;
        logEvent(T(`🔫 Ausgeraubt! ${formatEuro(bar)} Bargeld weg.`, `🔫 Robbed! ${formatEuro(bar)} loose cash gone.`), 'bad');
        this._raeuberNachspiel();
        oeffneModal(T('💸 Ausgeraubt', '💸 Robbed'),
          T(`<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8cfa0;">` +
          `Du hast brav <b>${formatEuro(bar)}</b> Bargeld herausgerückt.<br>` +
          `Der Räuber zählt grinsend deine Scheine und verschwindet in der Gasse.</span>`,
          `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8cfa0;">` +
          `You meekly handed over <b>${formatEuro(bar)}</b> in cash.<br>` +
          `The robber counts your notes with a grin and vanishes down the alley.</span>`), []);
      } },
      { label: gameState.kampfsportGelernt ? T('🥊 Kämpfen (75 %)', '🥊 Fight (75 %)') : T('🥊 Kämpfen (50/50)', '🥊 Fight (50/50)'), primary: true, callback: () => {
        if (Math.random() < (gameState.kampfsportGelernt ? 0.75 : 0.5)) {
          logEvent(T('🥊 Du hast den Räuber verjagt – Bargeld gerettet!', '🥊 You drove the robber off – cash saved!'), 'good');
          this._raeuberNachspiel();
          oeffneModal(T('🥊 Gewonnen!', '🥊 You won!'),
            T(`<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#bfe8a0;">` +
            `Du hast gewonnen und dem Räuber mal gezeigt, dass er sich nicht mit jedem ` +
            `dahergelaufenen Arbeitslosen anlegen sollte!<br>Dein Bargeld bleibt bei dir. 💪</span>`,
            `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#bfe8a0;">` +
            `You won and showed the robber not to mess with just any ` +
            `wandering jobless bloke!<br>Your cash stays with you. 💪</span>`), []);
        } else {
          gameState.gesundheit = clamp(gameState.gesundheit - 10, 0, 100);
          logEvent(T(`🥊 Verloren! ${formatEuro(bar)} Bargeld weg, −10 Gesundheit.`, `🥊 Lost! ${formatEuro(bar)} loose cash gone, −10 Health.`), 'bad');
          if (gameState.gesundheit <= 0) {
            gameState.losesBargeld = 0;
            updateHUD(); this.despawnRaeuber(); triggerGameOver('gesundheit'); return;
          }
          gameState.losesBargeld = 0;
          this._raeuberNachspiel();
          oeffneModal(T('🤕 Verloren', '🤕 You lost'),
            T(`<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8a0a0;">` +
            `Du hast verloren, wurdest zusammengeschlagen und hast all dein Bargeld ` +
            `(<b>${formatEuro(bar)}</b>) verloren.<br>−10 Gesundheit.</span>`,
            `<span style="display:block;text-align:center;font-size:13px;line-height:1.55;color:#e8a0a0;">` +
            `You lost, got beaten up and lost all your cash ` +
            `(<b>${formatEuro(bar)}</b>).<br>−10 Health.</span>`), []);
        }
      } },
    ]);
  }

  // Nach dem Überfall: Räuber verschwindet, Sperre + HUD aktualisieren.
  _raeuberNachspiel() {
    this.despawnRaeuber();
    this._raeuberCooldown = 120;        // ~2 Min Ruhe bis zum nächsten Überfall
    updateHUD();
  }

  // Maskierter Räuber (dunkle Kapuze, Messer) – im Spielstil gezeichnet.
  drawRaeuber(px, py) {
    const g = this.raeuberGfx;
    g.clear();
    g.setDepth(py - 0.1);
    // kleiner Bodenschatten
    g.fillStyle(0x000000, 0.28); g.fillEllipse(px + 1, py - 1, 26, 9);
    if (this.raeuberSprite) {
      const s = this.raeuberSprite;
      s.setVisible(true).setPosition(px, py).setDepth(py);
      if (s.height) s.setScale(RAEUBER_H / s.height);
      // Sheet läuft nach rechts → bei Links-Lauf spiegeln
      if (this._raeuberDX < -0.05) s.setFlipX(true);
      else if (this._raeuberDX > 0.05) s.setFlipX(false);
      // Steht er (Spieler erreicht) oder bewegt er sich nicht → Animation anhalten;
      // nur bei tatsächlicher Bewegung laufen (kein „Laufen auf der Stelle").
      if (this._raeuberSteht || !this._raeuberBewegt) { s.anims.stop(); s.setFrame(0); }
      else if (this.anims.exists('raeuber_walk')) s.play('raeuber_walk', true);
    }
  }

  // ============================================================
  //  ARBEITSAMT-WARTENUMMER  (Nummer ziehen, LED-Schild, Schlange)
  // ============================================================
  _amtNr(n) { return String(Math.max(0, Math.floor(n))).padStart(3, '0'); }

  amtLedUpdate() {
    if (!this.amtLedText) return;
    // Wird die Nummer des Spielers gerade aufgerufen → in Rot blinken lassen.
    if (this._amtFenster > 0 && this._amtNummer != null) {
      this.amtLedText.setText('Nr ' + this._amtNr(this._amtNummer)).setColor('#ff5050');
      this.amtLedText.setShadow(0, 0, '#ff2020', 8, false, true);
    } else {
      this.amtLedText.setText('Nr ' + this._amtNr(this._amtAktuell)).setColor('#39ff14');
      this.amtLedText.setShadow(0, 0, '#1aff00', 8, false, true);
    }
  }

  // Läuft in Echtzeit (auch wenn der Spieler woanders ist): Büro ruft Nummern auf.
  tickAmt(dt) {
    if (this._amtAktuell == null) return;
    this._amtTimer -= dt;
    if (this._amtTimer <= 0) {
      this._amtAktuell++;
      this._amtTimer = 25 + Math.random() * 10;     // ~0,5 min pro Termin
      // Spieler an der Reihe?
      if (this._amtNummer != null && this._amtFenster <= 0 && this._amtAktuell >= this._amtNummer) {
        this._amtFenster = 90;                       // 1,5 min Zugangsfenster
        logEvent(T('🔔 Deine Nummer ' + this._amtNr(this._amtNummer) + ' wird aufgerufen! Schnell zum Amt (1,5 Min).', '🔔 Your number ' + this._amtNr(this._amtNummer) + ' is being called! Hurry to the office (1.5 min).'), 'warn');
      }
      this.amtLedUpdate();
    }
    if (this._amtFenster > 0) {
      this._amtFenster -= dt;
      if (this._amtFenster <= 0) {                    // nicht rechtzeitig da gewesen
        if (this._amtNummer != null) logEvent(T('⌛ Wartenummer verfallen – du warst nicht rechtzeitig am Amt.', '⌛ Ticket number expired – you were not at the office in time.'), 'bad');
        this._amtNummer = null;
        this.amtLedUpdate();
      }
    }
  }

  // Wird aus interact('arbeitsamt') aufgerufen. true = Menü darf öffnen.
  amtInteraktion() {
    if (this._amtFenster > 0) {            // dein Termin läuft → Zugang (Nummer verbraucht)
      this._amtFenster = 0; this._amtNummer = null; this.amtLedUpdate();
      return true;
    }
    if (this._amtNummer != null) { this.amtWartePopup(); return false; }
    this.amtZiehPopup(); return false;
  }

  amtZiehPopup() {
    oeffneModal(T('🎫 Wartenummer ziehen', '🎫 Take a ticket number'),
      T('Beim Amt zieht man erst eine Nummer.<br>Aktuell aufgerufen: <b>Nr. ' + this._amtNr(this._amtAktuell) + '</b>.<br>', 'At the office you take a ticket first.<br>Currently serving: <b>No. ' + this._amtNr(this._amtAktuell) + '</b>.<br>') +
      T('Erst wenn deine Nummer dran ist, kommst du zu den Anträgen & Terminen.', 'Only when your number is up do you get to the applications & appointments.'),
      [
        { label: T('🎫 Nummer ziehen', '🎫 Take a number'), primary: true, callback: () => this.amtZiehen() },
        { label: T('💶 Vordrängeln (100 €)', '💶 Cut the line (100 €)'), callback: () => this.amtBestechen() },
      ]);
  }

  amtZiehen() {
    const vor = Phaser.Math.Between(0, 3);            // 0–3 Leute vor dir
    this._amtNummer = this._amtAktuell + vor + 1;
    this._amtFenster = 0;
    this.amtLedUpdate();
    logEvent(T('🎫 Nummer ' + this._amtNr(this._amtNummer) + ' gezogen – ' + vor + ' vor dir. Warte auf den Aufruf am LED-Schild.', '🎫 Number ' + this._amtNr(this._amtNummer) + ' taken – ' + vor + ' ahead of you. Wait for the call on the LED board.'), '');
  }

  amtWartePopup() {
    const vor = Math.max(0, this._amtNummer - this._amtAktuell);
    oeffneModal(T('⏳ Du wartest auf deinen Aufruf', '⏳ You are waiting to be called'),
      T('Deine Nummer: <b>Nr. ' + this._amtNr(this._amtNummer) + '</b><br>', 'Your number: <b>No. ' + this._amtNr(this._amtNummer) + '</b><br>') +
      T('Aktuell aufgerufen: <b>Nr. ' + this._amtNr(this._amtAktuell) + '</b><br>', 'Currently serving: <b>No. ' + this._amtNr(this._amtAktuell) + '</b><br>') +
      T('Noch <b>' + vor + '</b> vor dir. Behalte das grüne LED-Schild im Auge.', 'Still <b>' + vor + '</b> ahead of you. Keep an eye on the green LED board.'),
      [ { label: T('💶 Vordrängeln (100 €)', '💶 Cut the line (100 €)'), callback: () => this.amtBestechen() } ]);
  }

  amtBestechen() {
    const gs = gameState;
    if (gs.losesBargeld + gs.kontostand < 100) { logEvent(T('💶 Keine 100 € fürs Vordrängeln.', '💶 No 100 € to cut the line.'), 'bad'); return; }
    let rest = 100;
    const l = Math.min(rest, gs.losesBargeld); gs.losesBargeld -= l; rest -= l;
    gs.kontostand -= rest;
    this._amtFenster = 90;                            // sofort Zugang
    updateHUD();
    logEvent(T('💶 100 € gesteckt – du gehst an der Schlange vorbei.', '💶 Slipped 100 € – you walk straight past the queue.'), 'warn');
    interact('arbeitsamt');                           // öffnet jetzt das Amt-Menü
  }

  // spielerCol/Row aus der kontinuierlichen Position ableiten (für Interaktion)
  aktualisiereTile() {
    const t = this.screenZuTile(this.spielerX, this.spielerY);
    if (t) { this.spielerCol = t.col; this.spielerRow = t.row; }
  }

  // Sichtlinie zwischen zwei Weltpunkten komplett begehbar?
  hatSicht(x1, y1, x2, y2) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 10));
    for (let i = 0; i <= n; i++) {
      if (!this.weltBegehbar(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)) return false;
    }
    return true;
  }

  // Wegpunkte glätten (String-Pulling) → natürliche Diagonalen statt Gitterlinien
  vereinfachePfad(pts) {
    const alle = [{ x: this.spielerX, y: this.spielerY }, ...pts];
    const out = []; let i = 0;
    while (i < alle.length - 1) {
      let j = alle.length - 1;
      while (j > i + 1 && !this.hatSicht(alle[i].x, alle[i].y, alle[j].x, alle[j].y)) j--;
      out.push(alle[j]); i = j;
    }
    return out;
  }

  // ---- NPC-Pathfinding (BFS über begehbare Felder, wie der Spieler-Klickweg) ----
  // Geglätteter Welt-Wegpfad von (fromX,fromY) zu (toX,toY) – oder null.
  npcPfad(fromX, fromY, toX, toY) {
    const start = this.screenZuTile(fromX, fromY);
    const ziel  = this.screenZuTile(toX, toY);
    if (!start || !ziel) return null;
    const tp = this.bfs(start.col, start.row, (c, r) => c === ziel.col && r === ziel.row);
    if (!tp) return null;
    let pts = tp.map(t => {
      const p = isoToScreen(t.col + 0.5, t.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      return { x: p.x, y: p.y };
    });
    if (pts.length) pts[pts.length - 1] = { x: toX, y: toY };
    // String-Pulling relativ zur NPC-Startposition (vereinfachePfad nimmt den Spieler)
    const alle = [{ x: fromX, y: fromY }, ...pts];
    const out = []; let i = 0;
    while (i < alle.length - 1) {
      let j = alle.length - 1;
      while (j > i + 1 && !this.hatSicht(alle[i].x, alle[i].y, alle[j].x, alle[j].y)) j--;
      out.push(alle[j]); i = j;
    }
    return out;
  }

  // Eine Figur ein Stück entlang ihres Pfades bewegen (verbrauchte Wegpunkte raus).
  folgePfad(x, y, pfad, speed, dt) {
    let rest = speed * dt;
    while (rest > 0 && pfad.length) {
      const z = pfad[0];
      const dx = z.x - x, dy = z.y - y, d = Math.hypot(dx, dy);
      if (d <= rest) { x = z.x; y = z.y; pfad.shift(); rest -= d; }
      else { x += (dx / d) * rest; y += (dy / d) * rest; rest = 0; }
    }
    return { x, y };
  }

  // Nächstes begehbares Feld zu einem Weltpunkt (spiralförmige Suche). Liefert
  // {col,row} oder null. Damit muss man nicht exakt auf den Laufweg klicken.
  naechstesBegehbarFeld(x, y) {
    const dcr = (x - this.offsetX) / (this.tileW / 2);
    const scr = (y - this.offsetY) / (this.tileH / 2) - 1;
    const c0 = Math.round((scr + dcr) / 2), r0 = Math.round((scr - dcr) / 2);
    if (this.begehbar(c0, r0)) return { col: c0, row: r0 };
    let best = null, bestD = Infinity;
    for (let rad = 1; rad <= 12 && !best; rad++) {       // bis ~4 alte Kacheln nach außen
      for (let dc = -rad; dc <= rad; dc++)
        for (let dr = -rad; dr <= rad; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;  // nur Ring
          const c = c0 + dc, r = r0 + dr;
          if (!this.begehbar(c, r)) continue;
          const p = isoToScreen(c + 0.5, r + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestD = d; best = { col: c, row: r }; }
        }
    }
    return best;
  }

  // Klick auf Boden → dorthin laufen. Klickt man daneben (Gebäude/Sperre/außerhalb),
  // wird automatisch das NÄCHSTGELEGENE begehbare Feld angesteuert (nicht mehr fummelig).
  geheZuWelt(x, y) {
    let ziel = this.screenZuTile(x, y);
    let zx = x, zy = y;
    if (!ziel || !this.begehbar(ziel.col, ziel.row)) {
      ziel = this.naechstesBegehbarFeld(x, y);
      if (!ziel) return;
      const p = isoToScreen(ziel.col + 0.5, ziel.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY);
      zx = p.x; zy = p.y;   // exaktes Ziel = Mitte des nächsten begehbaren Feldes
    }
    const start = this.screenZuTile(this.spielerX, this.spielerY) || { col: this.spielerCol, row: this.spielerRow };
    const tp = this.bfs(start.col, start.row, (c, r) => c === ziel.col && r === ziel.row);
    if (!tp) return;
    let pts = tp.map(t => { const p = isoToScreen(t.col + 0.5, t.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY); return { x: p.x, y: p.y }; });
    if (pts.length) pts[pts.length - 1] = { x: zx, y: zy };   // exakter Zielpunkt
    else pts = [{ x: zx, y: zy }];
    this.pfad = this.vereinfachePfad(pts);
    this.pfadZielOrt = null;
  }

  // Anlauf-Feld VOR (südlich) dem Gebäude finden – ein begehbares Straßenfeld,
  // auf dem der Spieler SICHTBAR steht (nicht hinter/seitlich/unter der Grafik).
  // "südlich/vorne" = größere (col+row) als das Gebäude. Liefert BFS-Pfad dorthin
  // (leer = schon davor) oder null (unerreichbar). Fallback: Feld in Reichweite 1.
  _anlaufPfad(ort) {
    const start = this.screenZuTile(this.spielerX, this.spielerY) || { col: this.spielerCol, row: this.spielerRow };
    const istVorne = (c, r) => {
      const s = (c - ort.col) + (r - ort.row);          // >0 = südlich = vor dem Gebäude
      return s >= 1 && s <= 9 && Math.abs(c - ort.col) <= 6 && Math.abs(r - ort.row) <= 6;
    };
    if (istVorne(start.col, start.row)) return [];        // steht schon sichtbar davor
    let tp = this.bfs(start.col, start.row, istVorne);
    if (!tp) tp = this.bfs(start.col, start.row,          // Fallback: irgendein Nachbarfeld
      (c, r) => Math.max(Math.abs(c - ort.col), Math.abs(r - ort.row)) <= 1);
    return tp;   // null wenn unerreichbar, sonst Pfad (evtl. leer)
  }

  // Klick auf Gebäude → davorlaufen. Einfachklick = nur hin; Doppelklick = hin + Menü.
  klickAufOrt(id) {
    const ort = ORTE_CONFIG.find(o => o.id === id);
    if (!ort) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const doppel = this._letzterOrtKlick && this._letzterOrtKlick.id === id &&
                   (now - this._letzterOrtKlick.t) < 350;
    this._letzterOrtKlick = { id, t: now };

    const tp = this._anlaufPfad(ort);
    if (tp == null) { if (doppel) interact(id); return; }   // unerreichbar → trotzdem öffnen
    if (tp.length === 0) {                                   // schon sichtbar davor
      this.pfad = [];
      if (doppel) { this.cameras.main.centerOn(this.spielerX, this.spielerY); interact(id); }
      return;
    }
    const pts = tp.map(t => { const p = isoToScreen(t.col + 0.5, t.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY); return { x: p.x, y: p.y }; });
    this.pfad = this.vereinfachePfad(pts);
    this.pfadZielOrt = doppel ? id : null;   // nur Doppelklick öffnet bei Ankunft
  }

  // Spieler zu einem Gebäude schicken und bei Ankunft das Menü öffnen
  // (z. B. Schwarzarbeit aus dem Sozialbetrug-Menü → läuft zur Baustelle).
  geheZuGebaeude(id) {
    const ort = ORTE_CONFIG.find(o => o.id === id);
    if (!ort) return;
    const tp = this._anlaufPfad(ort);
    if (tp == null) { interact(id); return; }
    if (tp.length === 0) { this.pfad = []; interact(id); return; }
    const pts = tp.map(t => { const p = isoToScreen(t.col + 0.5, t.row + 0.5, this.tileW, this.tileH, this.offsetX, this.offsetY); return { x: p.x, y: p.y }; });
    this.pfad = this.vereinfachePfad(pts);
    this.pfadZielOrt = id;     // bei Ankunft Menü öffnen
  }

  // Nächstgelegenes Gebäude in Reichweite (Chebyshev ≤ 2) – Gebäude liegen
  // bis zu 2 Felder neben der Straße, daher größere Reichweite + "nächstes".
  nahesGebaeude() {
    let best = null, bestD = 99;
    this.ortRects.forEach(o => {
      const d = Math.max(Math.abs(o.col - this.spielerCol), Math.abs(o.row - this.spielerRow));
      if (d <= 6 && d < bestD) { bestD = d; best = o; }
    });
    return best;
  }

  aktualisiereHighlight() {
    const nah = this.nahesGebaeude();
    const id = nah ? nah.id : null;
    // Aktives Gebäude wird gelb getönt (seam-frei – ein Glow pro Streifen würde
    // Trennlinien zeigen). gebaeudeSprites[id] ist ein Streifen-Array oder (Park)
    // ein Einzel-Sprite. Wechselt nur bei Bedarf.
    if (id !== this._tintId) {
      const toenen = (g, on) => {
        if (!g) return;
        const arr = Array.isArray(g) ? g : [g];
        arr.forEach(s => { if (s && s.setTint) { on ? s.setTint(0xffe87a) : s.clearTint(); } });
      };
      if (this._tintId && this.gebaeudeSprites) toenen(this.gebaeudeSprites[this._tintId], false);
      if (id && this.gebaeudeSprites) toenen(this.gebaeudeSprites[id], true);
      this._tintId = id;
    }
    if (this.highlightGfx) this.highlightGfx.clear();
  }

  versucheInteraktion() {
    const nah = this.nahesGebaeude();
    if (nah) {
      this.pfad = []; this.pfadZielOrt = null;
      this.cameras.main.centerOn(this.spielerX, this.spielerY);   // Kamera fixieren → ruhiger Hintergrund
      interact(nah.id);
    } else logEvent(T('ℹ️ Näher an ein Gebäude gehen (E).', 'ℹ️ Get closer to a building (E).'), '');
  }

  /** Überspringt die aktuelle Woche sofort (SPACE-Taste) */
  skipWoche() {
    // Während des Überspringens wird "geschlafen" → Energie voll erholt
    gameState.energie = 100;
    // Restzeit der Woche sofort ablaufen lassen
    this.zeitAkku = ECHTZEIT_PRO_WOCHE;
    logEvent(T('⏩ Woche übersprungen – ausgeschlafen, Energie voll.', '⏩ Week skipped – well rested, Energy full.'), '');
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
    const COLS = 48, ROWS = 48;
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
      logEvent(T(`💾 Gespeichert: ${name}.`, `💾 Saved: ${name}.`), 'good');
      soundGut && soundGut();
      // Kurze Bestätigung im Modal
      oeffneModal(T('💾 Gespeichert', '💾 Saved'),
        T(`Spielstand in <strong>${name}</strong> gesichert.<br>
         Monat ${gameState.monat}, Woche ${gameState.woche} · ${formatEuro(gameState.kontostand)} auf Konto`,
          `Save stored in <strong>${name}</strong>.<br>
         Month ${gameState.monat}, Week ${gameState.woche} · ${formatEuro(gameState.kontostand)} in account`),
        []
      );
    }
  } catch (e) {
    logEvent(T('⚠️ Speichern fehlgeschlagen: ', '⚠️ Save failed: ') + e.message, 'danger');
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
      oeffneModal(T('❌ Slot leer', '❌ Empty slot'), T('Dieser Speicherplatz enthält keinen Spielstand.', 'This slot contains no save.'), []);
      return;
    }
    const snapshot = JSON.parse(raw);

    if (snapshot.version !== SAVE_VERSION) {
      oeffneModal(T('⚠️ Veralteter Spielstand', '⚠️ Outdated save'),
        T(`Dieser Spielstand wurde mit Version ${snapshot.version} gespeichert.<br>
         Aktuelle Version: ${SAVE_VERSION}.<br>
         Er kann nicht geladen werden.`,
          `This save was created with version ${snapshot.version}.<br>
         Current version: ${SAVE_VERSION}.<br>
         It cannot be loaded.`), []);
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
    if (gameState.lebensmittelTageRest === undefined) gameState.lebensmittelTageRest = 0;
    if (gameState.grosserKuehlschrank === undefined) gameState.grosserKuehlschrank = false;
    if (gameState.kuehlschrankWarnung  === undefined) gameState.kuehlschrankWarnung  = false;
    if (gameState.krankmeldungWochenRest === undefined) gameState.krankmeldungWochenRest = 0;
    if (gameState.krankmeldungCooldownWochen === undefined) gameState.krankmeldungCooldownWochen = 0;
    if (gameState.ernaehrungAttest === undefined) gameState.ernaehrungAttest = false;
    if (gameState.kampfsportGelernt === undefined) gameState.kampfsportGelernt = false;
    if (gameState.anzeigeCooldownMonat === undefined) gameState.anzeigeCooldownMonat = 0;
    if (gameState.bettlerAus === undefined) gameState.bettlerAus = false;
    if (gameState.millionHinweis === undefined) gameState.millionHinweis = false;
    if (gameState.billigKaeufeInFolge === undefined) gameState.billigKaeufeInFolge = 0;
    if (gameState.amtsTermineVerpasst === undefined) gameState.amtsTermineVerpasst = 0;
    if (gameState.algGesperrt         === undefined) gameState.algGesperrt         = false;
    if (gameState.loanSharkMahnungStufe === undefined) gameState.loanSharkMahnungStufe = 0;
    if (gameState.razziaChanceAktuell === undefined) gameState.razziaChanceAktuell = 0;
    if (gameState.tag             === undefined) gameState.tag             = 1;

    gameState.gameOver = false; // Sicherheitshalber zurücksetzen

    updateHUD();
    logEvent(T(`📂 Geladen: Slot ${slot === AUTO_SAVE_SLOT ? 'Auto' : slot} · M${gameState.monat} W${gameState.woche}.`, `📂 Loaded: Slot ${slot === AUTO_SAVE_SLOT ? 'Auto' : slot} · M${gameState.monat} W${gameState.woche}.`), 'good');
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
    oeffneModal(T('❌ Ladefehler', '❌ Load error'), T('Spielstand konnte nicht geladen werden:<br>', 'Save could not be loaded:<br>') + e.message, []);
  }
}

// ----------------------------------------------------------------
// loescheSpiel(slot)
// ----------------------------------------------------------------
function loescheSpiel(slot) {
  localStorage.removeItem(SAVE_PREFIX + slot);
  logEvent(T(`🗑️ Slot ${slot} gelöscht.`, `🗑️ Slot ${slot} deleted.`), 'warn');
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
      ? T(`Slot ${slot}: M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)} · ${info.datum}`, `Slot ${slot}: M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)} · ${info.datum}`)
      : T(`Slot ${slot}: [leer]`, `Slot ${slot}: [empty]`);
    return {
      label,
      callback: () => saveSpiel(slot)
    };
  });

  oeffneModal(
    T('💾 Spiel speichern', '💾 Save game'),
    T(`Wähle einen Speicherplatz.<br>
     <span style="color:var(--text-dim); font-size:0.62rem;">Auto-Save läuft automatisch alle 2 Minuten.</span>`,
      `Choose a save slot.<br>
     <span style="color:var(--text-dim); font-size:0.62rem;">Auto-Save runs automatically every 2 minutes.</span>`),
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
        label: T(`${label}: [leer]`, `${label}: [empty]`),
        callback: () => oeffneModal(T('❌ Slot leer', '❌ Empty slot'), T('Kein Spielstand vorhanden.', 'No save here.'), [])
      };
    }
    return {
      label: `${label}: M${info.monat} W${info.woche} T${info.tag} · ${info.status} · ${formatEuro(info.kontostand)}<br>
              <span style="font-size:0.58rem; color:var(--text-dim);">📅 ${info.datum}</span>`,
      callback: () => {
        // Bestätigung vor dem Laden (überschreibt aktuellen Fortschritt)
        oeffneModal(
          T(`📂 ${label} laden?`, `📂 Load ${label}?`),
          T(`M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)}<br><br>
           ⚠️ Der aktuelle Spielstand geht verloren!`,
            `M${info.monat} W${info.woche} · ${info.status} · ${formatEuro(info.kontostand)}<br><br>
           ⚠️ The current save will be lost!`),
          [
            { label: T('✅ Laden', '✅ Load'), primary: true, callback: () => ladeSpiel(slot) },
            { label: T('❌ Abbrechen', '❌ Cancel'), callback: () => {} }
          ]
        );
      }
    };
  });

  oeffneModal(T('📂 Spiel laden', '📂 Load game'), T('Wähle einen Spielstand zum Laden:', 'Choose a save to load:'), aktionen);
}

// ================================================================
// ABSCHNITT 19: SPIELSTART  (StartSzene übernimmt den Titelscreen)
// ================================================================
// Kein Modal mehr nötig – StartSzene zeigt den Titelscreen.
// Audio-Init passiert beim ersten Klick auf den Startbutton.
// Phaser wird in window.onload weiter oben (Abschnitt 18) gestartet.
// Kein zweiter load-Listener nötig.
