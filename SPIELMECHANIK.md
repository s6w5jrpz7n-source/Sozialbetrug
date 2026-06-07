# SPEZIFIKATION — „Sozialbetrug: Arbeitslos zum Millionär"

> Vollständige Spielmechanik als KI-lesbare Spezifikation.
> Stand entspricht dem Code in `script.js` / `index.html`.

## 1. Konzept & Ziel
Satirische Wirtschaftssimulation. Der Spieler ist arbeitslos und versucht,
durch eine Mischung aus **legalen Sozialleistungen**, **bürokratischen
Grauzonen** und **illegalem Schwarzgeld** reich zu werden — ohne erwischt zu
werden. **Sieg:** 1.000.000 € Gesamtvermögen erreichen (und auswandern).
**Niederlage:** Tod, Bankrott, Gefängnis oder Zahlungsunfähigkeit.

## 2. Kern-Ressourcen (Meter, 0–100)
| Meter | Start | Bedeutung |
|---|---|---|
| energie | 80 | Aktionen kosten Energie; bei 0 nur noch Schlafen möglich |
| happinessSpieler | 70 | Eigene Laune |
| happinessPartner | 70 | Partnerlaune; <20 zieht die Partnerin aus (Unterhalt 1.000 €/M) |
| gesundheit | 80 | <20 Krankenhaus-Zwang, =0 Tod (Game Over) |
| risikoRaster | 10 | Entdeckungsrisiko (0–100); ab 70 Razzia-Gefahr |

## 3. Geldarten (zentral!)
| Art | Sichtbar bei Razzia | Zählt zur Vermögensprüfung | Gebühr |
|---|---|---|---|
| kontostand (Start 50.000 €) | nein | **ja** | – |
| losesBargeld (Bargeld) | **ja** | nein | – |
| schwarzeKasse | ja | nein | 5 %/Monat (Schattenbank) |
| goldBarren (×500 €, „im Garten vergraben") | nein | nein | – |
| depot (Wertpapiere) | nein | **ja** (außer verschleiert) | 5 %/Monat wenn verschleiert |
| immobilie | nein | nein | Rate/Instandhaltung |

## 4. Zeit & Status
- 1 Spielwoche = 60 Echtzeit-Sekunden; 4 Wochen = 1 Monat. Tag 1–7/Woche.
- „Woche überspringen" (Button/SPACE) lässt die Restwoche sofort ablaufen und
  setzt die Energie auf 100 (man hat in der Zeit geschlafen).
- status: **ALG1** (Monate 1–12, 1.200 €/M, KEINE Vermögensprüfung) → ab
  Monat 13 **ALG2/Bürgergeld** (563 €/M, Vermögensprüfung alle 3 Monate).
  Wechsel auch früher, wenn Konto ≤ 0.

## 5. Monatsabrechnung (monatsAbschluss — der wichtigste Loop, in Reihenfolge)
1. Game-Over-Check: Zahlungsrückstand ≥ 3 Monate offen → Game Over.
2. ALG-Zahlung: ALG1 1.200 € / ALG2 563 €, minus Minijob-Anrechnung.
   ALG2: bei Prüfmonat (monat%3==0) und Konto + sichtbares Depot > 50.000 €
   → keine Zahlung.
3. Minijob: Bruttolohn aufs Konto, −10 Energie.
4. Mehrbedarfe (Summe aktiver) aufs Konto.
5. Einstiegsgeld +338 € (falls Restmonate).
6. Schein-WG +200 € (falls aktiv & Partnerin da).
7. Kaution-Rate −150 € (falls Umzug-Darlehen offen).
8. Immobilie: Mieteinnahme/KdU +1.250 € → Schwarzkasse (Risiko +6);
   Rate −2.500 €; Wert ×1,02.
9. Depot: Kurse aktualisieren; wenn verschleiert −5 % Gebühr.
10. Kredithai-Zinsen +10 %, Risiko +5.
11. Auslands-Kindergeld (+300 €/Kind, nur behalten wenn Unterhalts-Tarnung
    aktiv, sonst netto 0).
12. Jobcenter-Prüfung (monat%3==1): siehe §9.
13. Sachbearbeiter-Schmiergeld −150 € (sonst Deal platzt).
14. Schattenbank-Gebühr −5 % der Schwarzkasse.
15. Miete: ALG1 −650 € (selbst); ALG2 vom Staat übernommen (zählt zum Counter).
16. Krankenkasse +120 € (Counter, beide Phasen).
17. Nebenkosten −200 € (selbst).
18. Sucht-Folgen (siehe §12).
19. Verfall: Energie −5, Laune −3, Partner −2.
20. Lebensmittel-Effekte (Billig-Essen: Gesundheit/Laune −).
21. Frau-Auszug-Check, Unterhalt −1.000 € (falls ausgezogen).
22. Krankenhaus falls Gesundheit < 20.
23. Kredithai-Mahnung (Stufe 2/4/6 → Gesundheit −5/−15).
24. Rückstand aus Restkonto tilgen; Monatszähler.
25. Monatsbericht-Modal (mit automatischem Kredithai-Angebot bei Rückstand).

Nicht zahlbare Pflichten (Immo-Rate, Kaution, Unterhalt, Nebenkosten) →
zahlungsRueckstand. 3 Monate offen = Game Over. Bei Rückstand bietet der
Monatsbericht an, den Betrag beim Kredithai zu leihen.

## 6. Gebäude & Aktionen
- **Wohnung:** Schlafen (E+25); 500 € Konto↔Schwarzkasse; Kur (Energie+Gesundheit
  voll + Laune+20, Cooldown 3 Mon., **nur über gefälschtes Attest: 300 €, Risiko +12** —
  NICHT mehr an Gesundheit/Energie gekoppelt); Schein-WG; Umzug (+450 € einmalig,
  dann −150 €/M Kaution, schaltet Erstausstattung frei); Anwalt; Auswandern
  (Sieg); Cheats.
- **Arbeitsamt:** Pflichttermin (R−5, sonst Sperre). Wahrnehmen ist nur im
  Fälligkeitsfenster sinnvoll: Liegt der Termin noch >5 Tage in der Zukunft,
  bleibt er ungenutzt; geht man innerhalb der letzten 5 Tage hin, startet die
  14-Tage-Frist neu. Scheinbewerbung (R−5);
  Mehrbedarfe (Warmwasser +15, Alleinerziehend +70 [Kind], Ernährung +110
  [Attest echt/gefälscht], BuT +40 [Kind]); Einstiegsgeld (800 € → +2.000 €
  + 338 €/M × 6); Pauschalen (Erstausstattung +1.200 nach Umzug, Möbel +250,
  Bekleidung +150/6 Mon.); Sachbearbeiter schmieren (150 €/M → halbe Prüf-Chance).
- **Baustelle:** Schwarzarbeit ganzer Tag (+300 loses Bargeld, R+12, E−20, 1 Tag)
  / halber Tag (+120, R+5, E−8).
- **Bank:** Bargeld einzahlen → Konto (max 200 €/Woche, Transport-Risiko);
  500 € abheben; Aktiendepot kaufen/verkaufen.
- **Pfandleiher:** Gold kaufen & verkaufen in Tranchen (1 Barren = 500 €,
  Stückelung 1/5/10/25/50/max bzw. 1/5/10/25/alle, Konto↔Garten — wie das
  Aktiendepot, Menü öffnet nach jeder Aktion erneut); Gegenstände verpfänden
  (Geld aufs Konto, Laune −): Handy 240 / Schmuck 500 / Fernseher 440 /
  Konsole 360 / Auto 2.400 €; Auslösen = Wert × 1,25.
- **Amüsierbetrieb:** Abend (−200 €, Laune +30; 25 % „ertappt" Partner −20;
  20 % Sucht +).
- **Sportverein:** Soziale Tätigkeit (E−20, R−23, Laune+10, 1 Tag) / Training
  (E−15, R−15, Laune+5, 1 Tag). HAUPT-RISIKOSENKER.
- **Supermarkt:** Lebensmittel Bio 800 (Ges+10,Laune+10) / Normal 500 / Billig
  250 (Ges−5,Laune−10/M; 2× Folge → Partner−15); Geschenk 500 € (ab 5.000 €
  kehrt Frau zurück); Minijob.
- **Kiosk:** Rubbellos 5 € (Gewinnstaffel bis 50.000 € Jackpot, 1:1000);
  Alkohol/Zigaretten 15 € (Laune+8, Ges−3, Sucht-Risiko).
- **Arztpraxis:** Behandlung (Ges+30, −500 €); Krankschreibung (R−8, E+10);
  Entzug (Sucht heilen, −800 €).
- **Villa (10/14):** Eigenes begehbares Luxus-Gebäude (steht erst nach dem Kauf
  der Immobilie sichtbar da). Nur bewohnbar, wenn eine Immobilie vorhanden ist
  UND auf Eigennutzung steht – sonst leeres Baugrundstück. Bei Einzug (Immobilie
  + Eigennutzung) ZIEHEN ALLE WOHNUNGS-FEATURES IN DIE VILLA UM (Schlafen, Kasse,
  Kur, Schein-WG, Anwalt, Auswandern, … über das Villa-Menü erreichbar); die alte
  Wohnung verweist nur noch auf die Villa. Eigene Villa-Aktionen zusätzlich:
  Luxus-Schlafen (E+40, 1 Tag), Pool & Sauna (Laune+20), Gäste empfangen
  (Laune+10, Partner+10). **Einliegerwohnung schwarz vermieten** (Trick): Das
  Amt glaubt, du seist in die kleine Einliegerwohnung eingezogen (macht die
  Amt-Miete plausibel) – tatsächlich vermietest du sie für 650 €/M in die
  schwarze Kasse und lebst in der Villa. Toggle, Risiko +5 beim Aktivieren,
  +4/M laufend, +1 Prüf-Faktor; fliegt auf → Rückforderung 650 € × 3.
- **Kirche (6/14):** Sündenerlass (150 € = 50 % der Wohnungs-Bestechung, halbiert
  das Risiko, nur 1× alle 3 Monate); Beichte (−15 Energie → +10 Laune, 1× alle
  3 Monate).
- **Kasino:** Mit Bargeld spielen (verliert/gewinnt loses Bargeld, NICHT mehr aus
  der Schwarzkasse), Einsatz 100/500/1.000/alles: Auszahlung 50–120 % (Ø 85 %).
- **Schattenbank:** Bargeld → Schwarzkasse (5 %/M); Schwarzkasse abheben;
  Unterhalts-Tarnung; Immobilie (kaufen 40.000 € EK + 24× 2.500 €, Modus
  Eigennutzung↔Vermieten, sofort tilgen, verkaufen = Wert − Restschuld);
  Depot verschleiern.
- **Kredithai:** Kredit 1.000 € (R+15) / 3.000 € (R+25), Schuld wächst
  10 %/Monat; zurückzahlen (R−10); Schuldenerlass verhandeln (R+20, 50/50:
  −50 % oder +30 %). Nichtzahlung → Eintreiber (Mahnstufe 2/4/6 → Ges −5/−15).

## 7. Aktiendepot (aktuelisiereDepotKurse, monatlich)
| Papier | Modell |
|---|---|
| MSCI World | fix +8 %/M (kein Verlust) |
| KryptoXX | statistisch verteilt −25 % … +50 % (Dreieck, Mitte ~+12 %) |
| Risiko-Firma AG | statistisch verteilt −50 % … +100 % (Dreieck, Mitte ~+25 %) |
| Immo-Fonds | gleichverteilt +2 % … +8 % |

Risikopapiere liefern keinen festen Binär-Ausgang mehr (vorher −50 %/+100 %),
sondern eine kontinuierlich um die Mitte gehäufte Dreiecksverteilung
(r = (rand + rand) / 2).

Depot zählt zur Vermögensprüfung — außer verschleiert (dann −5 %/M Gebühr,
Amt-unsichtbar).

## 8. Legale Bonus-Systeme
- Minijob-Freibetrag: Bürgergeld wird um den anrechenbaren Teil gekürzt.
  Freibetrag = erste 100 € frei + 20 % von 100–520 € (+30 % von 520–1000).
  Wählbar: 250 € oder 538 €/Monat (Minijob-Grenze 2026). Beispiel 538 €-Job
  → netto ca. +189 €.
- Mehrbedarfe / Einstiegsgeld / Pauschalen: wie §6, monatlich bzw. einmalig.

## 9. Grauzonen-Maschen (erhöhen fakeFaktoren der Prüfung)
- Schein-WG (+200 €/M), Unterhalts-Tarnung (Auslands-Kindergeld behalten, +1
  Faktor je Kind), Ernährungs-Attest gefälscht (+110 €/M), Immobilien-KdU-
  Eigennutzung (Amt-Miete in Schwarzkasse), Einliegerwohnung schwarz vermietet
  (+650 €/M in Schwarzkasse, nur in der bewohnten Villa).
- Jobcenter-Prüfung (monat%3==1): Chance = min(0,85; 0,15 × fakeFaktoren),
  halbiert bei geschmiertem Sachbearbeiter. Bei Auffliegen: Rückforderung
  (3 Monatsbeträge je Masche) + Risiko +30 + Maschen gestrichen + strafrecht-
  liche Eskalation (§11).

## 10. Razzia (akut, tickRazziaTimer) + Anonyme Anzeige
- Läuft nur bei risikoRaster > 70, alle 60 s, Chance = min(0,40; risiko^1,5/25000).
- Optionen: Bestechung (−300 €), Ausrede (50 % Erfolg), Kapitulation.
  Misserfolg/Kapitulation → strafrechtliche Eskalation (§11).
- Anonyme Anzeige (Zufallsevent): Schweigegeld 1.500 € oder Sonderprüfung
  riskieren (60 % Auffliegen bei aktiven Maschen).
- Zufalls-Events (eventDatabase) in 4 Kategorien: behoerde, loan_shark (nur bei
  Schulden), beziehung, alltag. „alltag" = kurze, witzige Mini-Effekt-Popups
  (Pfandflaschen, Spielhalle→Sucht, Schwarzfahren, Kleeblatt = nächste
  Razzia-Chance −50 %, Oma schickt Geld, Erkältung, …).
- Kleeblatt-Flag (gs.kleeblatt) halbiert einmalig die nächste Razzia-Chance.
- Modal-Warteschlange: Popups überschreiben sich nicht, sondern erscheinen
  nacheinander (wichtig beim Wochen-Skip: Events + Monatsbericht).

## 11. Strafsystem (strafStufe, gestuft)
Jeder ernste Bust (Razzia oder Jobcenter-Prüfung) eskaliert + zeigt einen großen
„SOZIALBETRUG"-Stempel (Stufen 1–3):
1. Ermittlung (Verwarnung)
2. Anklage: Geldstrafe = max(2.000 €, 10 % vom „Vom Staat kassiert") + Bewährung
3. Gefängnis: 3 Monate weg (Monat +3), loses Bargeld + Schwarzkasse konfisziert,
   Gesundheit −20, Partner −30, Risiko=20, alle Maschen aus
4. Game Over (Wiederholungstäter)
- Anwalt (Wohnung): senkt Stufe um 1 für Honorar (2.000 + 1.500 €/Stufe),
  65 % Erfolg.

## 12. Sucht (suchtStufe 0–3)
Steigt durch Amüsierbetrieb/Alkohol/Glücksspiel. Monatlich: −120 €/Stufe,
Gesundheit −4/Stufe, Laune −3/Stufe. Heilung nur durch Entzug in der Arztpraxis.

## 13. Familie
- Partnerlaune <20 → Partnerin zieht aus (Unterhalt 1.000 €/M; Rückkehr bei
  5.000 € Geschenke). KEIN Sorgerechtsstreit/Game-Over mehr (entfernt – ohne
  Kind im Haushalt sinnlos).
- Kindergeld-Afrika-Cheat: bis 4 Kinder à 300 €/M (nur behalten mit Unterhalts-
  Tarnung). Kinder schalten Alleinerziehend/BuT/Pauschalen frei.

## 14. Cheats (Wohnung → Cheat-Menü)
Scheinbewerbung (R−5); Krankmeldung (+100 €, R+15); Schwarzarbeit (+200 loses,
R+20); Kindergeld-Trick (Afrika-Reise); Immobilien-Fake (+500 €/M Schwarzkasse,
R+40/M); Spende (10 % vom Konto, min. 1.000 € → Risiko halbiert).

## 15. „Vom Staat kassiert"-Counter
Summiert alle echten Staatsleistungen, die beim Spieler landen: ALG1/Bürgergeld,
übernommene Miete (ALG2), Krankenkasse, Mehrbedarfe, Einstiegsgeld+Zuschuss,
Schein-WG, Pauschalen, Umzug, Auslands-Kindergeld (getarnt), Immobilien-KdU.
(Nicht: Mieteinnahmen vom Mieter, Spekulationsgewinne.)

## 16. Sieg / Niederlage
- Sieg: „Auswandern" ab 1.000.000 € Gesamtvermögen (Konto + Schwarzkasse +
  Bargeld + Gold + Depot + Immobilie − Schulden − Rückstand); zusätzlich
  Auto-Sieg bei 1 Mio. Konto+Depot.
- Game Over: Gesundheit 0 (Tod); Bankrott; Razzia/Gefängnis (Wiederholung);
  Zahlungsunfähig (Rückstand 3 Monate).

## 17. Konstanten (Referenz)
```
ALG1 1200 | ALG2 563 | Miete 650 | Krankenkasse 120 | Nebenkosten 200
Vermoegensgrenze 50000 (alle 3 Monate, Konto+sichtbares Depot)
Razzia: ab Risiko 70, alle 60s, Chance min(0.40, risiko^1.5/25000)
Immobilie: Preis 100000, EK 40000, Rate 2500x24, Miete 1250/M, Wert +2%/M
Einstiegsgeld 800 -> +2000 +338/M x6 | Schein-WG 200/M | Sachbearbeiter 150/M
Mehrbedarf: Warmwasser15 Alleinerz70 Ernaehrung110 BuT40
Pfand-Ausloese-Zins x1.25 | Kasino 50-120% (mit Bargeld) | Schattenbank/SK-Gebuehr 5%/M
Gold-Barren 500 EUR (Tranchen) | Kirche: Suendenerlass 150 EUR & Beichte, je 1x/3M
Kredithai-Zins 10%/M | Sucht: 120 EUR/Stufe, Ges-4/Laune-3 pro Stufe
Start: Konto 50000, Energie 80, Laune 70/70, Gesundheit 80, Risiko 10, ALG1
```

## 18. Technik
- HTML5 / Phaser 3 (CDN), reines JS in `script.js`, UI/HUD in `index.html`.
- Isometrische 16×16-Kachelkarte, statisch zentriert (keine Kamera-Verfolgung).
- Spiel-Logik ist UI-unabhängig: alle Aktionen laufen über `interact(ortId)`
  → Modal mit Buttons → `aktionAusfuehren(ortId, aktionsId)`.
- Speichern: ganzer `gameState` als JSON in localStorage (Deep-Copy).
