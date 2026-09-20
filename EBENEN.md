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

Sie liegt auf **Multiply** und bekommt ihre Farbe **automatisch aus der
Fellfarbe**: je heller das Pferd, desto heller die Kontur. Sonst läge bei
einem Schimmel eine fast schwarze Linie auf fast weissem Fell, was viel zu
hart wirkt. Der Regler "Kontrast" bestimmt den Abstand zwischen beiden.

Der Augenglanz liegt als einzige Ebene noch **über** der Outline — sonst
würde die Multiplikation ihn wegdunkeln.

## Fellmuster als Variante

Der Regelfall ist ein **flächig einfarbiges** Fell. Muster wie Appaloosa sind
die Ausnahme und werden als Variante derselben Ebene abgelegt:

```
10_fell.png              ← einfarbig, die Standardfassung
10_fell~appaloosa.png    ← Variante mit Tupfen
10_fell~schecke.png      ← weitere Variante
```

Der Konfigurator baut daraus automatisch eine Umschaltung „Einfarbig /
Appaloosa / Schecke". Beide Fassungen werden anschließend ganz normal
eingefärbt, das Muster wandert also in jeder Wunschfarbe mit.

Wichtig für die Variante: Sie muss **deckungsgleich** mit der Grundebene sein,
also dieselbe Silhouette haben. Nur der Inhalt darf sich unterscheiden.

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
