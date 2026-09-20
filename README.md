# itsleartist — Logo-Konfigurator

Web-App, mit der Kunden ein Pferde-Logo selbst einfärben: Fell, Mähne, Augen,
Licht und Hintergrund frei wählbar, live im Browser.

## Wie das Umfärben funktioniert

Die gezeichneten Ebenen aus Procreate werden nicht ersetzt, sondern **live
eingefärbt**. Der Browser beherrscht dieselben Blendmodi wie Procreate
(Multiply, Overlay, Color Dodge, Hinzufügen), der Ebenenstapel wird also
1:1 nachgebaut.

Der Kniff steckt in der Vorverarbeitung: Jede einfärbbare Ebene wird einmalig
analysiert und ihre gemalte Struktur — Tupfen, Verläufe, Blesse — auf den
vollen Helligkeitsbereich **normalisiert**. Eine fast schwarze Fellebene hat
intern vielleicht nur Helligkeiten von 8 bis 40; gestreckt auf 0 bis 100
bleibt jedes gemalte Detail erhalten und lässt sich anschließend in jede
beliebige Zielhelligkeit legen. Erst dadurch wird aus einem gezeichneten
Rappen auch ein helles Palomino.

Ohne diesen Schritt bliebe Schwarz schwarz: Ein einfaches Übertönen kann eine
dunkle Ebene nicht aufhellen.

Keine KI im Spiel. Das Ergebnis ist deterministisch, sofort da und exakt die
gezeichnete Linie der Künstlerin.

## Prototyp starten

```bash
node prototype/server.js
```

Dann http://localhost:5178 öffnen.

- `prototype/index.html` — Konfigurator-Oberfläche
- `prototype/sheet.html` — Vergleichstafel mit neun Farbvarianten
- `prototype/recolor.js` — die Umfärb-Engine

## Dokumente

- [EBENEN.md](EBENEN.md) — wie Motive aus Procreate exportiert werden

## Stand

Prototyp validiert das Umfärben mit echten Ebenen. Offen: Motivauswahl,
Augenfarbe als eigene Ebene, Bestell-/Zahlungsablauf.
