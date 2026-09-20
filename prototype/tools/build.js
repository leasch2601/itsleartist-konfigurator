#!/usr/bin/env node
/**
 * Baut den Ordner dist/ fuer die Veroeffentlichung.
 *
 * Die Ebenen liegen im Projekt in voller Aufloesung (2000 px) - das ist das
 * Archiv. Die Leinwand im Browser rechnet aber mit 1000 px, die doppelte
 * Aufloesung waere reine Ladezeit. Beim Bauen werden sie deshalb halbiert,
 * was rund zwei Drittel des Gewichts spart und auf dem Handy den Unterschied
 * zwischen "laedt sofort" und "laedt gefuehlt nie" ausmacht.
 *
 * Das Ergebnis wird mit eingecheckt, weil Netlify auf Linux laeuft und das
 * hier benutzte sips nur auf macOS existiert.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CANVAS = 1000;

const COPY = ['index.html', 'app.js', 'recolor.js'];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'motive'), { recursive: true });

for (const f of COPY) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
fs.copyFileSync(path.join(ROOT, 'motive', 'index.json'), path.join(DIST, 'motive', 'index.json'));

let before = 0, after = 0, count = 0;
for (const dir of fs.readdirSync(path.join(ROOT, 'motive'), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const src = path.join(ROOT, 'motive', dir.name);
  const dst = path.join(DIST, 'motive', dir.name);
  fs.mkdirSync(dst, { recursive: true });

  for (const file of fs.readdirSync(src)) {
    if (!file.toLowerCase().endsWith('.png')) continue;
    const from = path.join(src, file), to = path.join(dst, file);
    execFileSync('sips', ['-Z', String(CANVAS), from, '--out', to], { stdio: 'ignore' });
    before += fs.statSync(from).size;
    after += fs.statSync(to).size;
    count++;
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`${count} Ebenen auf ${CANVAS} px verkleinert`);
console.log(`${mb(before)} → ${mb(after)}  (${Math.round(100 - (after * 100) / before)} % gespart)`);
console.log(`dist/ bereit zum Veroeffentlichen.`);
