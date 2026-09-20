# Ebenen-Spezifikation für den Konfigurator

So exportierst du ein Motiv aus Procreate, damit es der Konfigurator direkt
verarbeiten kann. Ein neues Pferd ist dann nur noch ein Ordner mit PNGs.

## Export aus Procreate

1. Hintergrundebene **ausblenden** (der Konfigurator baut den Hintergrund selbst)
2. Keine Ebenen zusammenfassen, keine Gruppen flach rechnen
3. *Aktionen (Schraubenschlüssel) → Teilen → Ebenen teilen → **PNG-Dateien***
4. Alle Ebenen eines Motivs müssen aus **derselben Leinwand** kommen

Es müssen echte transparente PNGs sein. Ein PNG mit weißem Hintergrund statt
Transparenz funktioniert nicht.

## Benennung

```
NN_rolle[~variante][_blendmodus].png
```

Die Zahl bestimmt die Stapelreihenfolge (klein = unten), die Rolle entscheidet
über den Farbregler, der Blendmodus steht als Endung dahinter.

| Datei                        | Rolle              | Blendmodus  | Kunde färbt |
|------------------------------|--------------------|-------------|-------------|
| `10_fell.png`                | Fellfarbe          | Normal      | ja          |
| `20_maehne.png`              | Mähnenfarbe        | Normal      | ja          |
| `30_auge.png`                | Iris / Augenfarbe  | Normal      | ja          |
| `40_schatten_multiply.png`   | Schattierung 1     | Multiply    | nein        |
| `41_schatten_multiply.png`   | Schattierung 2     | Multiply    | nein        |
| `50_detail_overlay.png`      | Overlay            | Overlay     | nein        |
| `60_glanz_dodge.png`         | Colour Dodge       | Color Dodge | nein        |
| `70_highlight_add.png`       | Highlights         | Hinzufügen  | ja (Licht)  |
| `90_outline_multiply.png`    | **Outline**        | Multiply    | abgeleitet  |
| `95_augenreflex_screen.png`  | Reflex im Auge     | Screen      | nein        |

Optional, wenn du es trennen möchtest:

| Datei                 | Rolle                       | Kunde färbt |
|-----------------------|-----------------------------|-------------|
| `11_abzeichen.png`    | Blesse, Socken, Maulpartie  | ja          |
| `12_tupfen.png`       | Tupfen als eigene Ebene     | ja          |

### Die Outline gehört ganz nach oben

Sie trägt die gesamte Zeichnung: Augenlid, Nüstern, Muskelkanten,
Mähnensträhnen. Ohne sie wirkt das Logo wie ein weichgezeichneter Farbfleck.
Deshalb bekommt sie eine hohe Nummer und liegt über allem anderen.

Sie liegt auf **Multiply** und bekommt ihre Farbe **automatisch aus den
Ebenen, über denen sie jeweils liegt**:

- über dem Fell folgt sie der Fellfarbe
- über der Mähne der Mähnenfarbe — sonst läge bei einem Palomino eine dunkle
  Kontur auf einer fast weissen Mähne
- über dem Auge bleibt sie bewusst dunkel, egal wie hell das Pferd ist, sonst
  verliert der Blick bei einem Schimmel seine Zeichnung

Der Regler "Kontrast" bestimmt den Abstand zwischen Fläche und Kontur.

Der Augenglanz liegt als einzige Ebene noch **über** der Outline — sonst
würde die Multiplikation ihn wegdunkeln.

## Fellmuster als Zusatzebenen

Der Regelfall ist ein **flächig einfarbiges** Fell. Muster wie Tupfen, Äpfel
oder Sprenkel kommen als eigene, zuschaltbare Ebenen darüber:

```
11_extra-tupfen_overlay.png      ← Tupfen und Äpfel
12_extra-sprenkel_multiply.png   ← feine Sprenkel
13_extra-stichelhaar_overlay.png ← weitere Muster
```

Alles mit dem Präfix `extra-` wird zu einem Schalter im Konfigurator, den der
Kunde umlegen kann — mit eigenem Farbwähler und einem Regler für die Stärke.
Diese Ebenen starten **ausgeschaltet**.

Der Blendmodus entscheidet, wie du sie malst:

- **Overlay** für Muster mit hellen *und* dunklen Anteilen. Mittleres Grau ist
  neutral, Helleres hellt auf, Dunkleres dunkelt ab. Ideal für Äpfel und Tupfen.
- **Multiply** für rein dunkle Muster. Weiss ist neutral. Ideal für Sprenkel
  und Stichelhaar.

### Wie Muster eingefärbt werden

Anders als beim Fell wird beim Muster die **Helligkeit nicht verschoben**, nur
die Farbigkeit. Das ist notwendig, weil jeder Blendmodus einen neutralen Wert
hat, bei dem die Ebene nichts tut — Weiss bei Multiply, mittleres Grau bei
Overlay. Würde man diesen Wert mitfärben, legte sich die gewählte Farbe als
Schleier über das ganze Pferd statt nur auf die Tupfen.

Die Sättigung wächst deshalb mit dem Abstand zum neutralen Wert: Neutrale
Flächen bleiben neutral, nur die gezeichneten Marken nehmen die Farbe an. Eine
graue Wahl ergibt exakt dein Original.

Praktisch heisst das: Male Muster ruhig in Grautönen. Die Farbe kommt später.

## Wie stark darf die Ebene durchgemalt sein?

Der Konfigurator misst selbst, wie viel Zeichnung in einer Ebene steckt, und
richtet sich danach:

- **Flächig einfarbig** (z. B. dein Rappe: nur Schwarz mit leichten Verläufen)
  wird schonend behandelt. Würde man so eine Ebene voll aufspreizen, wären die
  einzigen Unterschiede Pinselrauschen — daraus würden sichtbare Flecken.
- **Durchgemalt** (Tupfen, kräftige Verläufe) wird voll ausgenutzt, damit die
  Zeichnung in jeder Zielfarbe erhalten bleibt.

Du musst dafür nichts tun. Male so, wie du es gewohnt bist.

## Motiv einlesen

Nach dem Ablegen der PNGs einmal den Scanner laufen lassen:

```bash
node prototype/tools/scan-motive.js
```

Er erkennt Reihenfolge, Blendmodus, Farbregler und Varianten am Dateinamen und
schreibt `motive/index.json`. Du musst nie eine Konfigurationsdatei von Hand
bearbeiten. Dateien, die nicht ins Schema passen, werden **gemeldet** statt
still übergangen — wenn eine Ebene fehlt, siehst du es sofort.

Beide Schreibweisen für den Blendmodus sind erlaubt: `60_dodge.png` genauso wie
`60_glanz_dodge.png`. Die zweite Form ist zu bevorzugen, wenn mehrere Ebenen
denselben Modus nutzen, damit die Namen in der Oberfläche unterscheidbar
bleiben.

Optional: `_vorschau.png` im Motivordner dient als Vorschaubild der
Motivauswahl und als Vergleichsbild im Konfigurator.

## Ordnerstruktur

```
motive/
  portrait-locken/
    10_fell.png
    10_fell~appaloosa.png
    20_maehne.png
    …
    90_outline.png
    _vorschau.png
  friese-profil/
    …
  index.json          ← wird vom Scanner erzeugt
```
