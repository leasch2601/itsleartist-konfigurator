import { buildStructureMap, applyColor } from './recolor.js';

const SIZE = 1000;

// Standardfarbe und Reihenfolge der Regler je Ebenen-Rolle.
// Angezeigt wird nur, was das gewaehlte Motiv auch wirklich mitbringt.
const SLOTS = {
  fell:      { label: 'Fell',            default: '#8a6242', order: 1, contrast: true },
  tupfen:    { label: 'Tupfen',          default: '#3a2f2a', order: 2, contrast: true },
  abzeichen: { label: 'Abzeichen',       default: '#f0e6dc', order: 3, contrast: true },
  maehne:    { label: 'Mähne',           default: '#2b2229', order: 4, contrast: true },
  auge:      { label: 'Augen',           default: '#4a7ba8', order: 5, contrast: false },
  licht:     { label: 'Licht / Highlights', default: '#ffe9c4', order: 6, amount: true },
};

const PRESETS = [
  { name: 'Rappe',     fell: '#2f2b34', maehne: '#15131a', licht: '#b9c6e0' },
  { name: 'Fuchs',     fell: '#a4562a', maehne: '#7a3c18', licht: '#ffd9a0' },
  { name: 'Falbe',     fell: '#c49a5e', maehne: '#3a2c1e', licht: '#ffe9bd' },
  { name: 'Schimmel',  fell: '#ded9d6', maehne: '#f1ece8', licht: '#ffffff' },
  { name: 'Palomino',  fell: '#d8a866', maehne: '#f4ead6', licht: '#fff3d6' },
  { name: 'Blue Roan', fell: '#6e7d94', maehne: '#1e2129', licht: '#cfe0f5' },
  { name: 'Nebel',     fell: '#8b7bb5', maehne: '#2e2545', licht: '#e6d4ff' },
  { name: 'Koralle',   fell: '#d76a68', maehne: '#4a1f2c', licht: '#ffd0c4' },
  { name: 'Mint',      fell: '#79b8a4', maehne: '#1f3a35', licht: '#d9fff2' },
];

const state = {
  colors: {},
  contrast: {},
  lichtAmount: 0.7,
  bg1: '#2e2740', bg2: '#0d0b14', bgType: 'radial',
};

const out = document.getElementById('out');
const ctx = out.getContext('2d');
const statusEl = document.getElementById('status');

let catalogue = [];
let motif = null;          // aktuell gewaehltes Motiv
let prepared = [];         // vorbereitete Ebenen des aktuellen Motivs

const newCanvas = () => {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
};

const loadImage = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(src));
    img.src = src;
  });

async function prepareLayer(def, base) {
  const img = await loadImage(`${base}/${def.file}`);
  const canvas = newCanvas();
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, SIZE, SIZE);

  const entry = { def, canvas, on: true, native: `${img.naturalWidth}×${img.naturalHeight}` };
  if (def.role === 'tint') {
    entry.map = buildStructureMap(cx.getImageData(0, 0, SIZE, SIZE));
    entry.target = newCanvas();
    entry.targetCtx = entry.target.getContext('2d');
    entry.buffer = new ImageData(SIZE, SIZE);
  }
  return entry;
}

async function selectMotif(m) {
  motif = m;
  statusEl.className = '';
  statusEl.textContent = `Lade „${m.name}“ …`;

  const base = `motive/${m.slug}`;
  const results = await Promise.allSettled(m.layers.map((d) => prepareLayer(d, base)));
  prepared = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? m.layers[i].file : null))
    .filter(Boolean);

  const ref = document.getElementById('reference');
  if (m.preview) ref.src = `${base}/${m.preview}`;
  else ref.removeAttribute('src');
  document.getElementById('btnCompare').hidden = !m.preview;

  for (const slot of activeSlots()) {
    if (state.colors[slot] === undefined) state.colors[slot] = SLOTS[slot].default;
    if (state.contrast[slot] === undefined) state.contrast[slot] = 0.85;
  }

  buildColorFields();
  buildLayerList();
  buildMotifList();
  render();

  const sizes = [...new Set(prepared.map((e) => e.native))];
  statusEl.className = failed.length ? 'err' : '';
  statusEl.textContent =
    `„${m.name}“ · ${prepared.length}/${m.layers.length} Ebenen · Quellgrößen: ${sizes.join(', ')}` +
    (failed.length ? ` · FEHLT: ${failed.join(', ')}` : '');
}

const activeSlots = () =>
  [...new Set(prepared.filter((e) => e.def.slot).map((e) => e.def.slot))]
    .sort((a, b) => SLOTS[a].order - SLOTS[b].order);

function paintBackground() {
  const g = state.bgType === 'radial'
    ? ctx.createRadialGradient(SIZE * .5, SIZE * .42, SIZE * .05, SIZE * .5, SIZE * .5, SIZE * .75)
    : ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, state.bg1);
  g.addColorStop(1, state.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function render() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, SIZE, SIZE);
  paintBackground();

  for (const e of prepared) {
    if (!e.on) continue;
    ctx.globalCompositeOperation = e.def.blend;

    if (e.def.role === 'tint') {
      const slot = e.def.slot;
      applyColor(e.map, state.colors[slot], state.contrast[slot] ?? 0.85, e.buffer);
      e.targetCtx.putImageData(e.buffer, 0, 0);
      ctx.globalAlpha = slot === 'licht' ? state.lichtAmount : 1;
      ctx.drawImage(e.target, 0, 0);
    } else {
      ctx.globalAlpha = 1;
      ctx.drawImage(e.canvas, 0, 0);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

let queued = false;
function scheduleRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

function buildColorFields() {
  const host = document.getElementById('colorFields');
  host.innerHTML = '';
  for (const slot of activeSlots()) {
    const cfg = SLOTS[slot];
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.textContent = cfg.label;

    const row = document.createElement('div');
    row.className = 'row';

    const color = document.createElement('input');
    color.type = 'color';
    color.value = state.colors[slot];
    color.dataset.slot = slot;
    color.oninput = () => { state.colors[slot] = color.value; scheduleRender(); };
    row.appendChild(color);

    if (cfg.contrast || cfg.amount) {
      const range = document.createElement('input');
      range.type = 'range';
      range.min = 0;
      range.max = cfg.amount ? 100 : 150;
      range.value = cfg.amount ? state.lichtAmount * 100 : state.contrast[slot] * 100;
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = range.value;
      range.oninput = () => {
        val.textContent = range.value;
        if (cfg.amount) state.lichtAmount = range.value / 100;
        else state.contrast[slot] = range.value / 100;
        scheduleRender();
      };
      row.append(range, val);
    }

    field.append(label, row);
    host.appendChild(field);
  }
}

function applyPreset(p) {
  for (const slot of activeSlots()) {
    if (p[slot]) state.colors[slot] = p[slot];
  }
  buildColorFields();
  scheduleRender();
}

function buildPresets() {
  const host = document.getElementById('presets');
  host.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset';
    b.innerHTML = `<div class="swatch" style="background:linear-gradient(135deg,${p.fell},${p.maehne})"></div>${p.name}`;
    b.onclick = () => applyPreset(p);
    host.appendChild(b);
  }
}

function buildMotifList() {
  const panel = document.getElementById('motifPanel');
  panel.hidden = catalogue.length < 2;
  if (panel.hidden) return;
  const host = document.getElementById('motifs');
  host.innerHTML = '';
  for (const m of catalogue) {
    const b = document.createElement('button');
    b.className = 'motif' + (motif && m.slug === motif.slug ? ' on' : '');
    const thumb = m.preview ? `<img src="motive/${m.slug}/${m.preview}" alt="">` : '';
    b.innerHTML = thumb + m.name;
    b.onclick = () => selectMotif(m);
    host.appendChild(b);
  }
}

function buildLayerList() {
  const host = document.getElementById('layers');
  host.innerHTML = '';
  for (const e of prepared) {
    const row = document.createElement('label');
    row.className = 'layer';
    const mode = e.def.role === 'tint' ? 'einfärbbar' : e.def.blend.replace('source-over', 'normal');
    row.innerHTML = `<input type="checkbox" ${e.on ? 'checked' : ''}>
      <span class="nm">${e.def.label}</span>
      <span class="mode">${mode} · ${e.native}</span>`;
    row.querySelector('input').onchange = (ev) => { e.on = ev.target.checked; scheduleRender(); };
    host.appendChild(row);
  }
}

function bindControls() {
  document.getElementById('bg1').oninput = (e) => { state.bg1 = e.target.value; scheduleRender(); };
  document.getElementById('bg2').oninput = (e) => { state.bg2 = e.target.value; scheduleRender(); };
  document.getElementById('btnBgType').onclick = (e) => {
    state.bgType = state.bgType === 'radial' ? 'linear' : 'radial';
    e.target.textContent = state.bgType === 'radial' ? 'Radial' : 'Linear';
    scheduleRender();
  };
  document.getElementById('btnCompare').onclick = (e) => {
    const on = document.getElementById('stage').classList.toggle('compare');
    e.target.classList.toggle('on', on);
  };
  document.getElementById('btnRandom').onclick = () => {
    const rnd = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    for (const slot of activeSlots()) state.colors[slot] = rnd();
    buildColorFields();
    scheduleRender();
  };
  document.getElementById('btnDownload').onclick = () => {
    const a = document.createElement('a');
    a.download = `leartist-${motif ? motif.slug : 'logo'}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };
}

(async function init() {
  bindControls();
  buildPresets();
  try {
    const res = await fetch('motive/index.json');
    if (!res.ok) throw new Error('motive/index.json nicht gefunden');
    catalogue = (await res.json()).motive;
  } catch (err) {
    statusEl.className = 'err';
    statusEl.textContent = `${err.message} — bitte "node tools/scan-motive.js" ausführen.`;
    return;
  }
  if (!catalogue.length) {
    statusEl.className = 'err';
    statusEl.textContent = 'Keine Motive gefunden. Ebenen nach Schema benennen (siehe EBENEN.md).';
    return;
  }
  await selectMotif(catalogue[0]);
})();
