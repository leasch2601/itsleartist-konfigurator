#!/usr/bin/env node
/**
 * Liest den motive/-Ordner aus und baut daraus die index.json.
 *
 * Damit muss Lea nie eine Konfigurationsdatei anfassen: Ebenen exportieren,
 * nach Schema benennen, in einen Ordner legen, dieses Skript laufen lassen.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'motive');

// Dateiname-Endung -> Blendmodus im Canvas
const BLEND = {
  multiply: 'multiply',
  overlay: 'overlay',
  dodge: 'color-dodge',
  add: 'lighter',
  screen: 'screen',
};

// Ebenen-Schluesselwort -> Farbregler, den der Kunde dafuer bekommt
const TINT = {
  fell: { slot: 'fell', label: 'Fell' },
  tupfen: { slot: 'tupfen', label: 'Tupfen' },
  abzeichen: { slot: 'abzeichen', label: 'Abzeichen' },
  maehne: { slot: 'maehne', label: 'Mähne' },
  mahne: { slot: 'maehne', label: 'Mähne' },
  auge: { slot: 'auge', label: 'Augen' },
  highlight: { slot: 'licht', label: 'Licht' },
};

const BARE_LABEL = {
  multiply: "Schattierung", overlay: "Overlay",
  dodge: "Colour Dodge", add: "Highlights", screen: "Screen",
};

function parseLayer(file) {
  const m = /^(\d+)_([a-z0-9]+)(?:_([a-z]+))?\.png$/i.exec(file);
  if (!m) return null;
  const [, order, key, suffix] = m;
  const lower = key.toLowerCase();
  const tint = TINT[lower];

  // Kurzform zulassen: "60_dodge.png" ohne Namensteil meint den Blendmodus
  // selbst. Sonst laege die Ebene stumm als "normal" im Stapel.
  const bare = !suffix && !tint && BLEND[lower] ? lower : null;
  return {
    file,
    order: Number(order),
    blend: BLEND[(suffix || bare || '').toLowerCase()] || 'source-over',
    role: tint ? 'tint' : 'fixed',
    slot: tint ? tint.slot : undefined,
    label: tint ? tint.label : bare ? BARE_LABEL[bare] : prettify(key),
  };
}

const prettify = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function scanMotif(dir) {
  const files = fs.readdirSync(path.join(ROOT, dir));
  const layers = files
    .map(parseLayer)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (!layers.length) return null;

  const skipped = files.filter(
    (f) => f.endsWith('.png') && !f.startsWith('_') && !parseLayer(f)
  );

  return {
    slug: dir,
    name: prettify(dir.replace(/-/g, ' ')),
    preview: files.includes('_vorschau.png') ? '_vorschau.png' : null,
    layers,
    skipped,
  };
}

const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const motive = [];
for (const dir of dirs) {
  const motif = scanMotif(dir);
  if (!motif) {
    console.warn(`  ! ${dir}: keine gueltig benannten Ebenen gefunden`);
    continue;
  }
  if (motif.skipped.length) {
    console.warn(`  ! ${dir}: ignoriert (Namensschema passt nicht): ${motif.skipped.join(', ')}`);
  }
  delete motif.skipped;
  motive.push(motif);
  const slots = [...new Set(motif.layers.filter((l) => l.slot).map((l) => l.slot))];
  console.log(`  + ${dir}: ${motif.layers.length} Ebenen, Farbregler: ${slots.join(', ') || 'keine'}`);
}

fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify({ motive }, null, 2));
console.log(`\n${motive.length} Motiv(e) in motive/index.json geschrieben.`);
