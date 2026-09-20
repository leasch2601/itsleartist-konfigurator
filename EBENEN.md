# Ebenen-Spezifikation für den Konfigurator

So exportierst du ein Motiv aus Procreate, damit es der Konfigurator direkt
verarbeiten kann. Ein neues Pferd ist dann nur noch ein Ordner mit PNGs.

## Export aus Procreate

1. Hintergrundebene **ausblenden** (der Konfigurator baut den Hintergrund selbst)
2. Keine Ebenen zusammenfassen, keine Gruppen flach rechnen
3. *Aktionen (Schraubenschlüssel) → Teilen → Ebenen teilen → **PNG-Dateien***
4. Alle Ebenen eines Motivs müssen aus **derselben Leinwand** kommen

Wichtig: Es müssen echte transparente PNGs sein. Ein PNG mit weißem
Hintergrund statt Transparenz funktioniert nicht.

## Benennung

Die Zahl bestimmt die Stapelreihenfolge (klein = unten), das Kürzel den
Blendmodus. Der Konfigurator liest beides automatisch aus dem Dateinamen.

| Datei                    | Rolle                | Blendmodus   | Kunde färbt |
|--------------------------|----------------------|--------------|-------------|
| `10_fell.png`            | Fellfarbe            | Normal       | ja          |
| `20_maehne.png`          | Mähnenfarbe          | Normal       | ja          |
| `30_auge.png`            | Augenfarbe           | Normal       | ja          |
| `40_schatten_multiply.png` | Schattierung 1     | Multiply     | nein        |
| `41_schatten_multiply.png` | Schattierung 2     | Multiply     | nein        |
| `50_overlay.png`         | Overlay              | Overlay      | nein        |
| `60_dodge.png`           | Colour Dodge         | Color Dodge  | nein        |
| `70_highlight_add.png`   | Highlights           | Hinzufügen   | ja (Licht)  |
| `80_augenreflex.png`     | Reflektion im Auge   | Normal       | nein        |

Optional zusätzlich, falls du es trennen möchtest:

| Datei                 | Rolle                       | Kunde färbt |
|-----------------------|-----------------------------|-------------|
| `11_abzeichen.png`    | Blesse, Socken, Maulpartie  | ja          |
| `12_tupfen.png`       | Tupfen / Schecken-Muster    | ja          |

## Warum das Trennen von Tupfen und Abzeichen etwas bringt

Liegen Tupfen und Blesse in derselben Datei wie das Fell, färben sie sich
zwangsläufig **mit** — bei einem korallenroten Pferd werden die Tupfen
dunkelrot, bei einem mintgrünen dunkelgrün. Das sieht stimmig aus, aber der
Kunde kann sie nicht eigenständig wählen.

Als eigene Ebene bekommt der Kunde einen zweiten Farbregler: weißes Pferd
mit schwarzen Tupfen, schwarzes Pferd mit weißen Tupfen, alles frei.

Das ist ein Zusatz, keine Voraussetzung — der Konfigurator funktioniert auch
mit deinen bestehenden zusammengelegten Ebenen.

## Motivordner

```
motive/
  appaloosa-portrait/
    motiv.json          ← Name, Vorschaubild, Ebenenliste
    10_fell.png
    20_maehne.png
    ...
  friese-profil/
    ...
```

## Motiv einlesen

Nach dem Ablegen der PNGs einmal den Scanner laufen lassen:

```bash
node prototype/tools/scan-motive.js
```

Er liest die Ordner aus, erkennt Reihenfolge, Blendmodus und Farbregler am
Dateinamen und schreibt `motive/index.json`. Du musst nie eine
Konfigurationsdatei von Hand bearbeiten.

Dateien, die nicht ins Schema passen, werden **gemeldet** statt still
übergangen — wenn eine Ebene fehlt, siehst du es sofort.

Beim Blendmodus sind beide Schreibweisen erlaubt: `60_dodge.png` genauso wie
`60_glanz_dodge.png`. Die zweite Form ist zu bevorzugen, wenn mehrere Ebenen
denselben Modus nutzen, damit die Namen in der Oberfläche unterscheidbar
bleiben.

Optional: `_vorschau.png` im Motivordner wird als Vorschaubild für die
Motivauswahl und als Vergleichsbild verwendet.
