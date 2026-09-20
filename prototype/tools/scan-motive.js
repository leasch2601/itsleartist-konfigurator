#!/usr/bin/env node
/**
 * Liest den motive/-Ordner aus und baut daraus die index.json.
 *
 * Lea muss nie eine Konfigurationsdatei anfassen: Ebenen exportieren,
 * nach Schema benennen, in einen Ordner legen, dieses Skript laufen lassen.
 *
 * Dateiname:  NN_rolle[~variante][_blendmodus].png
 *   NN         Stapelreihenfolge, klein liegt unten
 *   rolle      bestimmt, ob und welchen Farbregler der Kunde bekommt
 *   ~variante  optionale Alternativfassung derselben Ebene (z.B. ~appaloosa)
 *   blendmodus multiply | overlay | dodge | add | screen
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'motive');

const BLEND = {
  multiply: 'multiply',
  overlay: 'overlay',
  dodge: 'color-dodge',
  add: 'lighter',
  screen: 'screen',
};

// Ebenen-Schluesselwort -> Farbregler, den der Kunde dafuer bekommt
const TINT = {
  fell: 'fell',
  tupfen: 'tupfen',
  abzeichen: 'abzeichen',
  maehne: 'maehne',
  mahne: 'maehne',
  auge: 'auge',
  highlight: 'licht',
};

const LABEL = {
  fell: 'Fell', tupfen: 'Tupfen', abzeichen: 'Abzeichen', maehne: 'Mähne',
  auge: 'Augen', highlight: 'Highlights', outline: 'Outline',
  augenreflex: 'Augenglanz', schatten: 'Schattierung', detail: 'Details',
  glanz: 'Glanz', multiply: 'Schattierung', overlay: 'Overlay',
  dodge: 'Colour Dodge', add: 'Highlights', screen: 'Screen',
};

const prettify = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function parseLayer(file) {
  const m = /^(\d+)_([a-z0-9]+)(?:~([a-z0-9-]+))?(?:_([a-z]+))?\.png$/i.exec(file);
  if (!m) return null;
  const [, order, rawKey, variant, suffix] = m;
  const key = rawKey.toLowerCase();
  const slot = TINT[key];

  // Kurzform zulassen: "60_dodge.png" ohne Rollennamen meint den Blendmodus
  // selbst. Ohne das laege die Ebene stumm als "normal" im Stapel.
  const bare = !suffix && !slot && BLEND[key] ? key : null;

  return {
    file,
    order: Number(order),
    key,
    variant: variant ? variant.toLowerCase() : null,
    blend: BLEND[(suffix || bare || '').toLowerCase()] || 'source-over',
    role: slot ? 'tint' : 'fixed',
    slot: slot || undefined,
    label: LABEL[key] || prettify(key),
  };
}

function scanMotif(dir) {
  const files = fs.readdirSync(path.join(ROOT, dir));
  const parsed = files.map(parseLayer).filter(Boolean);
  if (!parsed.length) return null;

  // Varianten an ihre Grundebene haengen, statt sie als eigene Ebene zu stapeln
  const byKey = new Map();
  for (const l of parsed.filter((l) => !l.variant)) byKey.set(l.order + '_' + l.key, l);

  for (const v of parsed.filter((l) => l.variant)) {
    const base = byKey.get(v.order + '_' + v.key);
    if (!base) {
      console.warn(`  ! ${dir}: ${v.file} hat keine Grundebene ${v.order}_${v.key}.png`);
      continue;
    }
    (base.variants ||= []).push({ name: v.variant, file: v.file });
  }

  const layers = [...byKey.values()].sort((a, b) => a.order - b.order);
  for (const l of layers) delete l.key;

  const skipped = files.filter(
    (f) => f.toLowerCase().endsWith('.png') && !f.startsWith('_') && !parseLayer(f)
  );

  return {
    slug: dir,
    name: prettify(dir.replace(/-/g, ' ')),
    preview: files.includes('_vorschau.png') ? '_vorschau.png' : null,
    layers,
    skipped,
  };
}

const dirs = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const motive = [];
for (const dir of dirs) {
  const motif = scanMotif(dir);
  if (!motif) { console.warn(`  ! ${dir}: keine gueltig benannten Ebenen gefunden`); continue; }
  if (motif.skipped.length) {
    console.warn(`  ! ${dir}: ignoriert (Namensschema passt nicht): ${motif.skipped.join(', ')}`);
  }
  delete motif.skipped;
  motive.push(motif);

  const slots = [...new Set(motif.layers.filter((l) => l.slot).map((l) => l.slot))];
  const varis = motif.layers.filter((l) => l.variants).map((l) => `${l.label}: ${l.variants.map(v => v.name).join('/')}`);
  console.log(`  + ${dir}: ${motif.layers.length} Ebenen · Farbregler: ${slots.join(', ') || 'keine'}` +
              (varis.length ? ` · Varianten: ${varis.join('; ')}` : ''));
}

fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify({ motive }, null, 2));
console.log(`\n${motive.length} Motiv(e) in motive/index.json geschrieben.`);
