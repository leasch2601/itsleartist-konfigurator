import { buildStructureMap, applyColor, applyColorRegions, rgbToHsl, hslToRgb, hexToRgb } from './recolor.js';

const SIZE = 1000;

// Reihenfolge, Standardfarbe und Regler je Ebenen-Rolle.
// `auto` bedeutet: kein eigener Farbwaehler, die Farbe folgt anderen Ebenen.
const SLOTS = {
  fell:      { label: 'Fell',      default: '#9c6b4a', order: 1, slider: 'zeichnung' },
  tupfen:    { label: 'Tupfen',    default: '#3a2f2a', order: 2, slider: 'zeichnung' },
  abzeichen: { label: 'Abzeichen', default: '#f0e6dc', order: 3, slider: 'zeichnung' },
  // Die Maehne soll standardmaessig durchgefaerbt sein, nicht mit dem
  // gemalten Hell-Dunkel-Verlauf. Wer ihn will, zieht den Regler auf.
  maehne:    { label: 'Mähne',     default: '#2e2529', order: 4, slider: 'zeichnung', sliderDef: 0 },
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
  { name: 'Rappe',         fell: '#34303a', maehne: '#15131a', licht: '#b9c6e0', auge: '#4a3b2e' },
  { name: 'Brauner',       fell: '#5c3a20', maehne: '#1a1512', licht: '#e8c9a0', auge: '#4a3728' },
  { name: 'Fuchs',         fell: '#a05a2c', maehne: '#8a4a24', licht: '#ffd9a0', auge: '#5c432c' },
  { name: 'Dunkelfuchs',   fell: '#5e3722', maehne: '#4a2a19', licht: '#d9a878', auge: '#4a3728' },
  { name: 'Falbe',         fell: '#c19a62', maehne: '#3a2c1e', licht: '#ffe9bd', auge: '#4a3b2e' },
  { name: 'Palomino',      fell: '#d2a263', maehne: '#f0e4cd', licht: '#fff3d6', auge: '#5c432c' },
  { name: 'Schimmel',      fell: '#d8d2ce', maehne: '#eae4df', licht: '#ffffff', auge: '#4a3b2e' },
  { name: 'Apfelschimmel', fell: '#bdb7b3', maehne: '#d6d0cb', licht: '#fbf8f5', auge: '#4a3b2e', extras: ['tupfen'] },
  { name: 'Blue Roan',     fell: '#6e7684', maehne: '#22242b', licht: '#cfe0f5', auge: '#4a3b2e' },
];

const DEFAULTS = { bg1: '#f3e7e6', bg2: '#d9c6c2', bgStyle: 'radial', bgSeed: 7 };

const state = { colors: {}, sliders: {}, extras: {}, ...DEFAULTS };

const out = document.getElementById('out');
const ctx = out.getContext('2d');
const statusEl = document.getElementById('status');

let catalogue = [];
let motif = null;
let prepared = [];

/* ---------------- Hintergrund ---------------- */

// Fester Zufall: derselbe Startwert liefert immer dasselbe Muster, sonst
// wuerde der Hintergrund bei jedem Neuzeichnen flackern.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BG_STYLES = [
  { id: 'flat',     label: 'Einfarbig', random: false },
  { id: 'linear',   label: 'Verlauf',   random: false },
  { id: 'diagonal', label: 'Diagonal',  random: false },
  { id: 'radial',   label: 'Radial',    random: false },
  { id: 'vignette', label: 'Vignette',  random: false },
  { id: 'wolken',   label: 'Wolken',    random: true  },
  { id: 'aquarell', label: 'Aquarell',  random: true  },
  { id: 'streifen', label: 'Streifen',  random: false },
  { id: 'punkte',   label: 'Punkte',    random: true  },
];

const BG_PAINTERS = {
  flat(c, S, a) { c.fillStyle = a; c.fillRect(0, 0, S, S); },

  linear(c, S, a, b) {
    const g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  },

  diagonal(c, S, a, b) {
    const g = c.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  },

  radial(c, S, a, b) {
    const g = c.createRadialGradient(S * .5, S * .42, S * .05, S * .5, S * .5, S * .78);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  },

  vignette(c, S, a, b) {
    c.fillStyle = a; c.fillRect(0, 0, S, S);
    const g = c.createRadialGradient(S * .5, S * .5, S * .28, S * .5, S * .5, S * .72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  },

  // Unregelmaessige, weiche Flecken - wirkt handgemalt statt technisch
  wolken(c, S, a, b, rand) {
    c.fillStyle = a; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const x = rand() * S, y = rand() * S;
      const r = S * (0.18 + rand() * 0.34);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, b); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.20 + rand() * 0.30;
      c.fillStyle = g; c.fillRect(0, 0, S, S);
    }
    c.globalAlpha = 1;
  },

  // Ineinanderlaufende Lasuren, wie eine Aquarellwaesche
  aquarell(c, S, a, b, rand) {
    c.fillStyle = a; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      const x = rand() * S, y = rand() * S;
      const rx = S * (0.10 + rand() * 0.28), ry = rx * (0.55 + rand() * 0.8);
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, b); g.addColorStop(0.65, b); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.07 + rand() * 0.10;
      c.save();
      c.translate(x, y); c.rotate(rand() * Math.PI); c.scale(1, ry / rx); c.translate(-x, -y);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rx, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  },

  // Angelehnt an die Streifen auf leartist.netlify.app
  streifen(c, S, a, b) {
    c.fillStyle = a; c.fillRect(0, 0, S, S);
    c.fillStyle = b;
    const n = 14, w = S / (n * 2);
    for (let i = 0; i < n; i++) c.fillRect(i * 2 * w + w * 0.5, 0, w, S);
  },

  punkte(c, S, a, b, rand) {
    c.fillStyle = a; c.fillRect(0, 0, S, S);
    c.fillStyle = b;
    const step = S / 13;
    for (let y = step * 0.5; y < S; y += step) {
      for (let x = step * 0.5; x < S; x += step) {
        const r = step * (0.10 + rand() * 0.16);
        c.globalAlpha = 0.35 + rand() * 0.45;
        c.beginPath();
        c.arc(x + (rand() - 0.5) * step * 0.35, y + (rand() - 0.5) * step * 0.35, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  },
};

function paintBackground() {
  const painter = BG_PAINTERS[state.bgStyle] || BG_PAINTERS.radial;
  painter(ctx, SIZE, state.bg1, state.bg2, seeded(state.bgSeed));
}

/* ---------------- Ebenen laden ---------------- */

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

/** Dunklere Fassung einer Farbe - Grundlage aller abgeleiteten Konturfarben. */
function darken(hex, k) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return toHex(hslToRgb(h, Math.min(1, s * 0.85), Math.min(0.92, Math.max(0.03, l * k))));
}

async function prepareLayer(def, base, file) {
  const img = await loadImage(`${base}/${file || def.file}`);
  const canvas = newCanvas();
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, SIZE, SIZE);

  const entry = {
    def, canvas,
    on: !def.optional,          // Zusatzmuster starten ausgeschaltet
    strength: 1,
    native: `${img.naturalWidth}×${img.naturalHeight}`,
  };
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

const bySlot = (slot) => prepared.find((e) => e.def.slot === slot);

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
    if (cfg.slider && state.sliders[slot] === undefined) {
      state.sliders[slot] = (cfg.sliderDef ?? SLIDER[cfg.slider].def) / 100;
    }
  }

  buildColorFields();
  buildExtras();
  buildLayerList();
  buildMotifList();
  render();

  const sizes = [...new Set(prepared.map((e) => e.native))];
  statusEl.className = failed.length ? 'err' : '';
  statusEl.textContent =
    `„${m.name}“ · ${prepared.length}/${m.layers.length} Ebenen · ${sizes.join(', ')}` +
    (failed.length ? ` · FEHLT: ${failed.join(', ')}` : '');
}

/* ---------------- Zeichnen ---------------- */

function render() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, SIZE, SIZE);
  paintBackground();

  const k = state.sliders.outline ?? 0.42;
  const maneEntry = bySlot('maehne');
  const eyeEntry = bySlot('auge');

  for (const e of prepared) {
    if (!e.on) continue;
    ctx.globalCompositeOperation = e.def.blend;
    ctx.globalAlpha = 1;

    if (e.def.role === 'extra') {
      ctx.globalAlpha = e.strength;
      ctx.drawImage(e.canvas, 0, 0);
      continue;
    }

    if (e.def.role !== 'tint') { ctx.drawImage(e.canvas, 0, 0); continue; }

    const slot = e.def.slot;
    const cfg = SLOTS[slot];

    if (slot === 'outline') {
      // Die Kontur folgt dem, worueber sie liegt: dem Fell, der Maehne - und
      // ueber dem Auge bleibt sie bewusst dunkel, damit der Blick Zeichnung
      // behaelt, auch wenn das Pferd fast weiss ist.
      const regions = [];
      if (maneEntry?.on && maneEntry.map) {
        regions.push({ mask: maneEntry.map.alpha, hex: darken(state.colors.maehne, k) });
      }
      if (eyeEntry?.on && eyeEntry.map) {
        regions.push({ mask: eyeEntry.map.alpha, hex: darken(state.colors.auge, Math.min(k, 0.5)) });
      }
      applyColorRegions(e.map, darken(state.colors.fell, k), regions, 0.35, e.buffer);
    } else {
      const contrast = cfg.slider === 'zeichnung' ? state.sliders[slot] : 0.85;
      applyColor(e.map, state.colors[slot], contrast, e.buffer);
    }

    e.targetCtx.putImageData(e.buffer, 0, 0);
    ctx.globalAlpha = cfg.slider === 'staerke' ? state.sliders[slot] : 1;
    ctx.drawImage(e.target, 0, 0);
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

const colorFor = (slot) =>
  SLOTS[slot].auto ? darken(state.colors[SLOTS[slot].auto], state.sliders[slot]) : state.colors[slot];

function buildColorFields() {
  const host = document.getElementById('colorFields');
  host.innerHTML = '';

  for (const slot of activeSlots()) {
    const cfg = SLOTS[slot];
    const field = document.createElement('div');
    field.className = 'field';
    field.dataset.slot = slot;

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

    if (cfg.auto) {
      const dot = document.createElement('span');
      dot.className = 'swatch-auto';
      dot.title = `folgt Fell, Mähne und Augen`;
      row.appendChild(dot);
    } else {
      const colorInput = document.createElement('input');
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
    host.appendChild(field);
  }
  refreshReadouts();
}

function refreshReadouts() {
  for (const field of document.querySelectorAll('#colorFields .field')) {
    const slot = field.dataset.slot;
    const cfg = SLOTS[slot];
    const hex = colorFor(slot);
    field.querySelector('.read').textContent = cfg.slider
      ? `${hex.toUpperCase()} · ${SLIDER[cfg.slider].label} ${Math.round(state.sliders[slot] * 100)}%`
      : hex.toUpperCase();
    const dot = field.querySelector('.swatch-auto');
    if (dot) dot.style.background = hex;
    const input = field.querySelector('input[type=color]');
    if (input && input.value.toLowerCase() !== hex.toLowerCase()) input.value = hex;
  }
}

function buildExtras() {
  const panel = document.getElementById('extraPanel');
  const extras = prepared.filter((e) => e.def.role === 'extra');
  panel.hidden = !extras.length;
  if (!extras.length) return;

  const host = document.getElementById('extras');
  host.innerHTML = '';
  for (const e of extras) {
    const field = document.createElement('div');
    field.className = 'field';

    const head = document.createElement('label');
    head.className = 'field-head extra-head';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = e.on;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = e.def.label;
    const read = document.createElement('span');
    read.className = 'read';
    read.textContent = `${Math.round(e.strength * 100)}%`;
    head.append(cb, name, read);

    const range = document.createElement('input');
    range.type = 'range';
    range.min = 0; range.max = 100;
    range.value = Math.round(e.strength * 100);
    range.disabled = !e.on;
    range.oninput = () => {
      e.strength = range.value / 100;
      read.textContent = `${range.value}%`;
      scheduleRender();
    };
    cb.onchange = () => {
      e.on = cb.checked;
      range.disabled = !e.on;
      state.extras[e.def.label] = e.on;
      buildLayerList();
      scheduleRender();
    };

    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(range);

    field.append(head, row);
    host.appendChild(field);
  }
}

function applyPreset(p) {
  for (const slot of activeSlots()) if (!SLOTS[slot].auto && p[slot]) state.colors[slot] = p[slot];
  // Vorlagen duerfen Zusatzmuster mitbringen - ein Apfelschimmel ohne Äpfel
  // waere schliesslich nur ein Schimmel.
  for (const e of prepared.filter((x) => x.def.role === 'extra')) {
    const key = e.def.file.match(/extra-([a-z0-9-]+)/i)?.[1];
    e.on = Boolean(p.extras && key && p.extras.includes(key));
  }
  refreshReadouts();
  buildExtras();
  buildLayerList();
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

function buildBgStyles() {
  const host = document.getElementById('bgStyles');
  host.innerHTML = '';
  for (const t of BG_STYLES) {
    const b = document.createElement('button');
    b.className = 'tile' + (state.bgStyle === t.id ? ' on' : '');
    const prev = document.createElement('canvas');
    prev.width = prev.height = 72;
    prev.className = 'swatch';
    const pc = prev.getContext('2d');
    (BG_PAINTERS[t.id])(pc, 72, state.bg1, state.bg2, seeded(state.bgSeed));
    b.appendChild(prev);
    b.appendChild(document.createTextNode(t.label));
    b.onclick = () => {
      state.bgStyle = t.id;
      buildBgStyles();
      document.getElementById('btnSeed').hidden = !BG_STYLES.find((x) => x.id === t.id).random;
      scheduleRender();
    };
    host.appendChild(b);
  }
  document.getElementById('btnSeed').hidden = !BG_STYLES.find((x) => x.id === state.bgStyle).random;
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
    const mode = e.def.role === 'extra' ? 'zusatz · ' + e.def.blend
      : e.def.role === 'tint' ? (SLOTS[e.def.slot]?.auto ? 'abgeleitet · ' + e.def.blend : 'einfärbbar')
      : e.def.blend.replace('source-over', 'normal');
    row.innerHTML = `<input type="checkbox" ${e.on ? 'checked' : ''}>
      <span class="nm">${e.def.label}</span>
      <span class="mode">${mode}</span>`;
    row.querySelector('input').onchange = (ev) => {
      e.on = ev.target.checked;
      buildExtras();
      scheduleRender();
    };
    host.appendChild(row);
  }
}

function bindControls() {
  const bgInput = (id, key) => {
    document.getElementById(id).oninput = (e) => {
      state[key] = e.target.value;
      buildBgStyles();
      scheduleRender();
    };
  };
  bgInput('bg1', 'bg1');
  bgInput('bg2', 'bg2');

  document.getElementById('btnSeed').onclick = () => {
    state.bgSeed = (Math.random() * 1e9) | 0;
    buildBgStyles();
    scheduleRender();
  };
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
      if (cfg.slider) state.sliders[slot] = (cfg.sliderDef ?? SLIDER[cfg.slider].def) / 100;
    }
    for (const e of prepared) e.on = !e.def.optional;
    Object.assign(state, DEFAULTS);
    document.getElementById('bg1').value = DEFAULTS.bg1;
    document.getElementById('bg2').value = DEFAULTS.bg2;
    buildBgStyles();
    buildColorFields();
    buildExtras();
    buildLayerList();
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
  buildBgStyles();
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
