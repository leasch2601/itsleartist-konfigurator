import { buildStructureMap, applyColor } from './recolor.js';

const SIZE = 1000;

// Reihenfolge, Standardfarbe und Regler je Ebenen-Rolle.
// Angezeigt wird nur, was das gewaehlte Motiv tatsaechlich mitbringt.
const SLOTS = {
  fell:      { label: 'Fell',      default: '#9c6b4a', order: 1, slider: 'zeichnung' },
  tupfen:    { label: 'Tupfen',    default: '#3a2f2a', order: 2, slider: 'zeichnung' },
  abzeichen: { label: 'Abzeichen', default: '#f0e6dc', order: 3, slider: 'zeichnung' },
  maehne:    { label: 'Mähne',     default: '#2e2529', order: 4, slider: 'zeichnung' },
  auge:      { label: 'Augen',     default: '#6d8aa8', order: 5, slider: null },
  licht:     { label: 'Licht',     default: '#ffeedb', order: 6, slider: 'staerke' },
};

const SLIDER = {
  zeichnung: { label: 'Zeichnung', min: 0, max: 150, def: 85 },
  staerke:   { label: 'Stärke',    min: 0, max: 100, def: 70 },
};

const PRESETS = [
  { name: 'Rappe',     fell: '#2f2b34', maehne: '#15131a', licht: '#b9c6e0', auge: '#6b5a48' },
  { name: 'Fuchs',     fell: '#9c5a2e', maehne: '#6f3618', licht: '#ffd9a0', auge: '#7a5636' },
  { name: 'Falbe',     fell: '#c49a5e', maehne: '#3a2c1e', licht: '#ffe9bd', auge: '#6b5a48' },
  { name: 'Schimmel',  fell: '#ded9d6', maehne: '#f1ece8', licht: '#ffffff', auge: '#5f7f9e' },
  { name: 'Palomino',  fell: '#d8a866', maehne: '#f4ead6', licht: '#fff3d6', auge: '#7a5636' },
  { name: 'Blue Roan', fell: '#6e7d94', maehne: '#1e2129', licht: '#cfe0f5', auge: '#4a6076' },
  { name: 'Altrosa',   fell: '#c99a98', maehne: '#6b4448', licht: '#ffe4e0', auge: '#7d5f62' },
  { name: 'Nebel',     fell: '#8b7bb5', maehne: '#2e2545', licht: '#e6d4ff', auge: '#5f5183' },
  { name: 'Mint',      fell: '#79b8a4', maehne: '#1f3a35', licht: '#d9fff2', auge: '#3f6b5e' },
];

const BG_TYPES = [
  { id: 'radial', label: 'Radial' },
  { id: 'linear', label: 'Verlauf' },
  { id: 'flat',   label: 'Einfarbig' },
];

const DEFAULTS = { bg1: '#f3e7e6', bg2: '#d9c6c2', bgType: 'radial' };

const state = { colors: {}, sliders: {}, ...DEFAULTS };

const out = document.getElementById('out');
const ctx = out.getContext('2d');
const statusEl = document.getElementById('status');

let catalogue = [];
let motif = null;
let prepared = [];

const newCanvas = () => {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
};

const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error(src));
  img.src = src;
});

async function prepareLayer(def, base, file) {
  const img = await loadImage(`${base}/${file || def.file}`);
  const canvas = newCanvas();
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, SIZE, SIZE);

  const entry = { def, canvas, on: true, native: `${img.naturalWidth}×${img.naturalHeight}`, variant: null };
  if (def.role === 'tint') {
    entry.map = buildStructureMap(cx.getImageData(0, 0, SIZE, SIZE));
    entry.target = newCanvas();
    entry.targetCtx = entry.target.getContext('2d');
    entry.buffer = new ImageData(SIZE, SIZE);
  }
  return entry;
}

const activeSlots = () =>
  [...new Set(prepared.filter((e) => e.def.slot).map((e) => e.def.slot))]
    .sort((a, b) => SLOTS[a].order - SLOTS[b].order);

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
  if (m.preview) { ref.src = `${base}/${m.preview}`; ref.hidden = false; }
  else { ref.removeAttribute('src'); ref.hidden = true; }
  document.getElementById('btnCompare').hidden = !m.preview;

  for (const slot of activeSlots()) {
    if (state.colors[slot] === undefined) state.colors[slot] = SLOTS[slot].default;
    const sl = SLOTS[slot].slider;
    if (sl && state.sliders[slot] === undefined) state.sliders[slot] = SLIDER[sl].def / 100;
  }

  buildVariants();
  buildColorFields();
  buildLayerList();
  buildMotifList();
  render();

  const sizes = [...new Set(prepared.map((e) => e.native))];
  statusEl.className = failed.length ? 'err' : '';
  statusEl.textContent =
    `„${m.name}“ · ${prepared.length}/${m.layers.length} Ebenen · ${sizes.join(', ')}` +
    (failed.length ? ` · FEHLT: ${failed.join(', ')}` : '');
}

/* ---------------- Fellmuster-Varianten ---------------- */

function variantLayer() {
  return prepared.find((e) => e.def.variants && e.def.variants.length);
}

async function setVariant(entry, variantName) {
  const base = `motive/${motif.slug}`;
  const v = variantName ? entry.def.variants.find((x) => x.name === variantName) : null;
  const idx = prepared.indexOf(entry);
  statusEl.textContent = 'Wechsle Fellmuster …';
  const fresh = await prepareLayer(entry.def, base, v ? v.file : entry.def.file);
  fresh.on = entry.on;
  fresh.variant = variantName || null;
  prepared[idx] = fresh;
  buildVariants();
  buildLayerList();
  render();
  statusEl.textContent = variantName ? `Fellmuster: ${variantName}` : 'Fellmuster: einfarbig';
}

function buildVariants() {
  const panel = document.getElementById('variantPanel');
  const entry = variantLayer();
  panel.hidden = !entry;
  if (!entry) return;

  const host = document.getElementById('variants');
  host.innerHTML = '';
  const options = [{ name: null, label: 'Einfarbig' },
                   ...entry.def.variants.map((v) => ({ name: v.name, label: cap(v.name) }))];
  for (const o of options) {
    const b = document.createElement('button');
    b.textContent = o.label;
    b.className = entry.variant === o.name ? 'on' : '';
    b.onclick = () => { if (entry.variant !== o.name) setVariant(entry, o.name); };
    host.appendChild(b);
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- Zeichnen ---------------- */

function paintBackground() {
  if (state.bgType === 'flat') {
    ctx.fillStyle = state.bg1;
    ctx.fillRect(0, 0, SIZE, SIZE);
    return;
  }
  const g = state.bgType === 'radial'
    ? ctx.createRadialGradient(SIZE * .5, SIZE * .42, SIZE * .05, SIZE * .5, SIZE * .5, SIZE * .78)
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
      const sl = SLOTS[slot].slider;
      const amount = sl ? state.sliders[slot] : 1;
      applyColor(e.map, state.colors[slot], sl === 'zeichnung' ? amount : 0.85, e.buffer);
      e.targetCtx.putImageData(e.buffer, 0, 0);
      ctx.globalAlpha = sl === 'staerke' ? amount : 1;
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
const scheduleRender = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
};

/* ---------------- Bedienelemente ---------------- */

function buildColorFields() {
  const host = document.getElementById('colorFields');
  host.innerHTML = '';
  const slots = activeSlots();

  for (const slot of slots) {
    const cfg = SLOTS[slot];
    const field = document.createElement('div');
    field.className = 'field';

    const head = document.createElement('div');
    head.className = 'field-head';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = cfg.label;
    const read = document.createElement('span');
    read.className = 'read';
    head.append(name, read);

    const row = document.createElement('div');
    row.className = 'row';

    const color = document.createElement('input');
    color.type = 'color';
    color.value = state.colors[slot];
    color.oninput = () => { state.colors[slot] = color.value; read.textContent = readout(slot, color.value); scheduleRender(); };
    row.appendChild(color);

    if (cfg.slider) {
      const s = SLIDER[cfg.slider];
      const range = document.createElement('input');
      range.type = 'range';
      range.min = s.min; range.max = s.max;
      range.value = Math.round(state.sliders[slot] * 100);
      range.oninput = () => {
        state.sliders[slot] = range.value / 100;
        read.textContent = readout(slot, color.value);
        scheduleRender();
      };
      row.appendChild(range);
    }

    read.textContent = readout(slot, color.value);
    field.append(head, row);
    host.appendChild(field);
  }

  if (!slots.includes('auge')) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Die Augenfarbe erscheint hier automatisch, sobald die Ebene 30_auge.png im Motivordner liegt. In den gelieferten Ebenen war nur der Augenglanz enthalten, keine färbbare Iris.';
    host.appendChild(note);
  }
}

function readout(slot, hex) {
  const cfg = SLOTS[slot];
  if (!cfg.slider) return hex.toUpperCase();
  const s = SLIDER[cfg.slider];
  return `${hex.toUpperCase()} · ${s.label} ${Math.round(state.sliders[slot] * 100)}%`;
}

function applyPreset(p) {
  for (const slot of activeSlots()) if (p[slot]) state.colors[slot] = p[slot];
  buildColorFields();
  scheduleRender();
}

function buildPresets() {
  const host = document.getElementById('presets');
  host.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'tile';
    b.innerHTML = `<div class="swatch" style="background:linear-gradient(135deg,${p.fell} 0 55%,${p.maehne} 55% 100%)"></div>${p.name}`;
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
    b.className = 'tile' + (motif && m.slug === motif.slug ? ' on' : '');
    b.innerHTML = (m.preview ? `<img src="motive/${m.slug}/${m.preview}" alt="">` : '') + m.name;
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
      <span class="nm">${e.def.label}${e.variant ? ' · ' + cap(e.variant) : ''}</span>
      <span class="mode">${mode}</span>`;
    row.querySelector('input').onchange = (ev) => { e.on = ev.target.checked; scheduleRender(); };
    host.appendChild(row);
  }
}

function buildBgTypes() {
  const host = document.getElementById('bgType');
  host.innerHTML = '';
  for (const t of BG_TYPES) {
    const b = document.createElement('button');
    b.textContent = t.label;
    b.className = state.bgType === t.id ? 'on' : '';
    b.onclick = () => { state.bgType = t.id; buildBgTypes(); scheduleRender(); };
    host.appendChild(b);
  }
}

function bindControls() {
  document.getElementById('bg1').oninput = (e) => { state.bg1 = e.target.value; scheduleRender(); };
  document.getElementById('bg2').oninput = (e) => { state.bg2 = e.target.value; scheduleRender(); };

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
  document.getElementById('btnReset').onclick = () => {
    for (const slot of activeSlots()) {
      state.colors[slot] = SLOTS[slot].default;
      const sl = SLOTS[slot].slider;
      if (sl) state.sliders[slot] = SLIDER[sl].def / 100;
    }
    Object.assign(state, DEFAULTS);
    document.getElementById('bg1').value = DEFAULTS.bg1;
    document.getElementById('bg2').value = DEFAULTS.bg2;
    buildBgTypes();
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
  buildBgTypes();
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
