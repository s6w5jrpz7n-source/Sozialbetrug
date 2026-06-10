# 🎨 Stil-Vorlage & Checkliste – Sozialbetrug

Damit neue Gebäude-/Figuren-Texturen **ohne Nacharbeit** ins Spiel passen.
Erst lesen, dann zeichnen. 🙂

---

## 1. Grund-Perspektive

- **Isometrisch im Verhältnis 2:1** (eine Boden-Kachel ist 120 px breit × 60 px hoch → die Raute ist doppelt so breit wie hoch).
- Senkrechte Wände stehen **gerade nach oben**, Bodenflächen folgen dem 2:1-Winkel.
- **Eine einzige Lichtrichtung für ALLES** – Empfehlung: **Licht von oben-links** (Schatten fallen nach unten-rechts). Wichtig ist nur: bei jedem Gebäude gleich.

## 2. Format & Hintergrund

- **PNG mit Transparenz** (PNG-32, echter Alpha-Kanal). Kein weißer/farbiger Hintergrund.
- Falls dein Tool nur mit Hintergrund exportiert: einfarbig (z. B. reines Magenta `#FF00FF`) – ich stelle es frei.
- **Kein** Schlagschatten auf eigener Ebene nötig; kleinen Bodenschatten direkt unter dem Gebäude ins Bild malen ist ok.
- Dünner **dunkler Outline (1 px)** um die Silhouette sieht gut aus (ich kann ihn sonst auch automatisch ergänzen).

## 3. Wie groß zeichnen? (das Wichtigste)

Jedes Gebäude wird im Spiel in **genau die unten angegebene Box** gezeichnet – das Bild
wird auf diese Größe **gestreckt**. Deshalb:

> **Zeichne jedes Gebäude auf einer Leinwand mit EXAKT der angegebenen Pixelgröße.**
> Dann wird nichts verzerrt.

- **Pixel-Art:** nimm die **1×**-Größe (pixelgenau, schärfster Look).
- **Gemalt / hochauflösend:** nimm die **2×**-Größe – ich rechne sie für die Engine runter.

| Gebäude       | Datei                  | 1× (B×H) | 2× (B×H) |
|---------------|------------------------|----------|----------|
| wohnung       | wohnung.png            | 287×244  | 574×488  |
| arbeitsamt    | arbeitsamt.png         | 395×401  | 790×802  |
| sportverein   | sportverein.png        | 271×143  | 542×286  |
| supermarkt    | supermarkt.png         | 236×235  | 472×470  |
| bank          | bank.png               | 332×219  | 664×438  |
| pawn          | pfandleiher.png        | 138×91   | 276×182  |
| kasino        | casino_nacht.png       | 302×197  | 604×394  |
| schattenbank  | schattenbank.png       | 291×248  | 582×496  |
| baustelle     | baustelle.png          | 333×218  | 666×436  |
| amuesier      | amuesierbetrieb.png    | 223×147  | 446×294  |
| loanshark     | loanshark.png          | 275×234  | 550×468  |
| arztpraxis    | arztpraxis.png         | 290×247  | 580×494  |
| kiosk         | kiosk.png              | 161×130  | 322×260  |
| kirche        | kirche.png             | 279×274  | 558×548  |
| villa         | villa.png              | 333×243  | 666×486  |

*(Die Maße kommen direkt aus `layout/layout.json`. Verschiebst/skalierst du ein
Gebäude im Editor neu, ändern sich diese Zahlen – dann gebe ich dir die neue Tabelle.)*

## 4. Wo sitzt das Gebäude in der Box?

- Das Gebäude soll die Box **gut ausfüllen** (wie die aktuellen Sprites), nur ein
  schmaler transparenter Rand (≈ 2–4 px) ringsum.
- **Boden-/Standlinie** (wo das Haus die Straße berührt) bei **ca. 60 % der Höhe**
  von oben. Darüber: Dach/Fassade. Darunter: Vorplatz/Gehsteig/Schatten.
  → Daran hängt die Tiefensortierung (Spieler läuft korrekt davor/dahinter).
- Halte das **gleiche Boden-Niveau** wie bei den jetzigen Gebäuden bei, dann passt
  alles ohne Neujustierung. (Wenn nicht, justiere ich pro Gebäude eine Zahl.)

## 5. Stil-Konsistenz (Checkliste)

- [ ] Gleiche Lichtrichtung (oben-links) bei allen.
- [ ] Gleiche 2:1-Iso-Perspektive.
- [ ] Gleiche Linienstärke / Outline-Dicke.
- [ ] Gleiche Farbsättigung & gleicher Kontrast-Level (nicht ein Haus knallbunt, das nächste blass).
- [ ] Gleiche „Pixeldichte" (bei Pixel-Art: gleiche Pixelgröße – nicht mischen).
- [ ] Transparenter Hintergrund, sauberer Rand.
- [ ] Dateiname **exakt** wie in der Tabelle, Ordner `assets/buildings/`.

## 6. Figuren (Spieler / NPCs)

- Schon im Spiel: Spieler & Bettler als Sprite-Sheets (Front-Walk + Seitenprofil).
- Neue Animationen am besten als **Einzelframes gleicher Größe** liefern (eine Datei
  pro Animation, gleichmäßige Abstände) – ich setze sie zusammen, richte sie am
  Kopf-Mittelpunkt aus, entrande sie und lege den Outline an.
- Richtung: Seitenprofil zeigt **nach rechts** (Links-Lauf wird automatisch gespiegelt).
- Noch offen / neu zu gestalten: **Park + Dealer**, **Räuber**.

## 7. Was ICH danach mache (kein Aufwand für dich)

- PNGs ggf. **freistellen, entranden, Outline ergänzen, runterskalieren**.
- **`collision.json` neu berechnen** (Kollision = Alpha-Form der Gebäude) –
  immer nötig, wenn sich PNG-Form oder Layout-Position ändert.
- Einbinden, testen, Build aktualisieren.

---

**Kurzfassung:** Gleicher Stil + gleiche Lichtrichtung, **exakte Box-Größe** aus der
Tabelle, Standlinie bei ~60 %, transparenter PNG, Dateiname wie gehabt. Den Rest
(Freistellen, Kollision, Einbau) übernehme ich.
