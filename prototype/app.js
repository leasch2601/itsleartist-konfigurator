import { buildStructureMap, applyColor, rgbToHsl, hslToRgb, hexToRgb } from './recolor.js';

const SIZE = 1000;

// Reihenfolge, Standardfarbe und Regler je Ebenen-Rolle.
// Angezeigt wird nur, was das gewaehlte Motiv tatsaechlich mitbringt.
// `auto` bedeutet: keine eigene Farbwahl, die Farbe folgt einer anderen Ebene.
const SLOTS = {
  fell:      { label: 'Fell',      default: '#9c6b4a', order: 1, slider: 'zeichnung' },
  tupfen:    { label: 'Tupfen',    default: '#3a2f2a', order: 2, slider: 'zeichnung' },
  abzeichen: { label: 'Abzeichen', default: '#f0e6dc', order: 3, slider: 'zeichnung' },
  maehne:    { label: 'Mähne',     default: '#2e2529', order: 4, slider: 'zeichnung' },
  auge:      { label: 'Augen',     default: '#5c7f9e', order: 5, slider: null },
  licht:     { label: 'Licht',     default: '#ffeedb', order: 6, slider: 'staerke' },
  outline:   { label: 'Outline',   order: 7, slider: 'kontur', auto: 'fell' },
};

const SLIDER = {
  zeichnung: { label: 'Zeichnung', min: 0,  max: 150, def: 85 },
  staerke:   { label: 'Stärke',    min: 0,  max: 100, def: 70 },
  kontur:    { label: 'Kontrast',  min: 10, max: 100, def: 42 },
};

const PRESETS = [
  { name: 'Rappe',       fell: '#34303a', maehne: '#15131a', licht: '#b9c6e0', auge: '#4a3b2e' },
  { name: 'Brauner',     fell: '#5c3a20', maehne: '#1a1512', licht: '#e8c9a0', auge: '#4a3728' },
  { name: 'Fuchs',       fell: '#a05a2c', maehne: '#8a4a24', licht: '#ffd9a0', auge: '#5c432c' },
  { name: 'Dunkelfuchs', fell: '#5e3722', maehne: '#4a2a19', licht: '#d9a878', auge: '#4a3728' },
  { name: 'Falbe',       fell: '#c19a62', maehne: '#3a2c1e', licht: '#ffe9bd', auge: '#4a3b2e' },
  { name: 'Palomino',    fell: '#d2a263', maehne: '#f0e4cd', licht: '#fff3d6', auge: '#5c432c' },
  { name: 'Schimmel',    fell: '#d8d2ce', maehne: '#eae4df', licht: '#ffffff', auge: '#4a3b2e' },
  { name: 'Blue Roan',   fell: '#6e7684', maehne: '#22242b', licht: '#cfe0f5', auge: '#4a3b2e' },
  { name: 'Rotschimmel', fell: '#b4897e', maehne: '#7d4f45', licht: '#ffe0d4', auge: '#5c432c' },
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

const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

/**
 * Farbe einer abgeleiteten Ebene. Die Outline soll bei einem Schimmel nicht
 * fast schwarz auf fast weiss liegen, sondern dem Fell folgen: Je heller das
 * Pferd, desto heller die Kontur. Der Regler bestimmt den Abstand dazwischen.
 */
function derivedColor(slot) {
  const cfg = SLOTS[slot];
  const source = state.colors[cfg.auto] || SLOTS[cfg.auto].default;
  const [h, s, l] = rgbToHsl(...hexToRgb(source));
  const k = state.sliders[slot];
  return toHex(hslToRgb(h, Math.min(1, s * 0.85), Math.min(0.92, Math.max(0.03, l * k))));
}

const colorFor = (slot) => (SLOTS[slot].auto ? derivedColor(slot) : state.colors[slot]);

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
    const cfg = SLOTS[slot];
    if (!cfg.auto && state.colors[slot] === undefined) state.colors[slot] = cfg.default;
    if (cfg.slider && state.sliders[slot] === undefined) state.sliders[slot] = SLIDER[cfg.slider].def / 100;
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

const variantLayer = () => prepared.find((e) => e.def.variants && e.def.variants.length);

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
  statusEl.textContent = variantName ? `Fellmuster: ${cap(variantName)}` : 'Fellmuster: einfarbig';
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
      const cfg = SLOTS[slot];
      const sl = cfg.slider;
      // Die Kontur soll gleichmaessig in ihrem Ton liegen, nicht in sich
      // durchgezeichnet sein - daher fester, niedriger Kontrastwert.
      const contrast = cfg.auto ? 0.35 : (sl === 'zeichnung' ? state.sliders[slot] : 0.85);
      applyColor(e.map, colorFor(slot), contrast, e.buffer);
      e.targetCtx.putImageData(e.buffer, 0, 0);
      ctx.globalAlpha = sl === 'staerke' ? state.sliders[slot] : 1;
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

  for (const slot of activeSlots()) {
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
    let colorInput = null;

    if (cfg.auto) {
      // Kein Farbwaehler: nur eine Anzeige der abgeleiteten Farbe
      const dot = document.createElement('span');
      dot.className = 'swatch-auto';
      dot.title = `folgt der Farbe „${SLOTS[cfg.auto].label}“`;
      row.appendChild(dot);
      field.dataset.auto = slot;
    } else {
      colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = state.colors[slot];
      colorInput.oninput = () => {
        state.colors[slot] = colorInput.value;
        refreshReadouts();
        scheduleRender();
      };
      row.appendChild(colorInput);
    }

    if (cfg.slider) {
      const s = SLIDER[cfg.slider];
      const range = document.createElement('input');
      range.type = 'range';
      range.min = s.min; range.max = s.max;
      range.value = Math.round(state.sliders[slot] * 100);
      range.oninput = () => {
        state.sliders[slot] = range.value / 100;
        refreshReadouts();
        scheduleRender();
      };
      row.appendChild(range);
    }

    field.append(head, row);
    field.dataset.slot = slot;
    host.appendChild(field);
  }

  refreshReadouts();
}

function refreshReadouts() {
  for (const field of document.querySelectorAll('#colorFields .field')) {
    const slot = field.dataset.slot;
    const cfg = SLOTS[slot];
    const hex = colorFor(slot);
    field.querySelector('.read').textContent = readout(slot, hex);
    const dot = field.querySelector('.swatch-auto');
    if (dot) dot.style.background = hex;
    const input = field.querySelector('input[type=color]');
    if (input && input.value.toLowerCase() !== hex.toLowerCase()) input.value = hex;
  }
}

function readout(slot, hex) {
  const cfg = SLOTS[slot];
  if (!cfg.slider) return hex.toUpperCase();
  const s = SLIDER[cfg.slider];
  return `${hex.toUpperCase()} · ${s.label} ${Math.round(state.sliders[slot] * 100)}%`;
}

function applyPreset(p) {
  for (const slot of activeSlots()) if (!SLOTS[slot].auto && p[slot]) state.colors[slot] = p[slot];
  refreshReadouts();
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
    const mode = e.def.role === 'tint'
      ? (SLOTS[e.def.slot]?.auto ? 'abgeleitet · ' + e.def.blend : 'einfärbbar')
      : e.def.blend.replace('source-over', 'normal');
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
    for (const slot of activeSlots()) if (!SLOTS[slot].auto) state.colors[slot] = rnd();
    refreshReadouts();
    scheduleRender();
  };
  document.getElementById('btnReset').onclick = () => {
    for (const slot of activeSlots()) {
      const cfg = SLOTS[slot];
      if (!cfg.auto) state.colors[slot] = cfg.default;
      if (cfg.slider) state.sliders[slot] = SLIDER[cfg.slider].def / 100;
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
