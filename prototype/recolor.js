// Recolor-Engine: färbt eine gezeichnete Ebene in eine beliebige Zielfarbe um,
// ohne die gemalte Struktur (Tupfen, Verläufe, Blesse) zu verlieren.

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue(p, q, h + 1 / 3) * 255),
    Math.round(hue(p, q, h) * 255),
    Math.round(hue(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Analysiert eine gezeichnete Ebene einmalig und baut daraus eine
 * "Strukturkarte": pro Pixel die relative Helligkeit (0..1) plus Alpha.
 *
 * Der entscheidende Schritt ist die Normalisierung auf Perzentile: eine
 * fast schwarze Ebene (Rappe) hat intern nur Helligkeiten von z.B. 8..40.
 * Gestreckt auf 0..1 bleibt die gemalte Struktur erhalten und laesst sich
 * anschliessend in JEDE Zielhelligkeit legen - auch in ein helles Palomino.
 */
// Wie stark die Helligkeitsspanne einer Ebene hoechstens gedehnt werden darf.
const MAX_GAIN = 5;
// Ab dieser Spanne gilt eine Ebene als voll durchgemalt (statt flaechig).
const FULL_STRUCTURE = 0.25;

export function buildStructureMap(imageData) {
  const { data, width, height } = imageData;
  const n = width * height;
  const lum = new Float32Array(n);
  const alpha = new Uint8ClampedArray(n);
  const sat = new Float32Array(n);

  const histogram = new Float64Array(256);
  let visibleWeight = 0;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3];
    alpha[i] = a;
    if (a === 0) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lum[i] = L;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
    const w = a / 255;
    histogram[Math.min(255, Math.round(L * 255))] += w;
    visibleWeight += w;
  }

  // Robuste Spannweite ueber Perzentile, damit einzelne Ausreisser
  // (ein schwarzes Auge, ein weisser Glanzpunkt) die Streckung nicht kippen.
  const lo = percentile(histogram, visibleWeight, 0.02);
  const hi = percentile(histogram, visibleWeight, 0.98);
  const rawSpan = hi - lo;

  // Flaechig gemalte Ebenen duerfen NICHT auf den vollen Bereich gestreckt
  // werden: Bei einer fast einfarbigen Flaeche waeren die einzigen Unterschiede
  // Pinselrauschen, und das Strecken macht daraus sichtbare Flecken.
  // Der Gewinn wird gedeckelt, und zusaetzlich merkt sich die Karte, wie viel
  // echte Struktur ueberhaupt vorhanden war.
  const span = Math.max(rawSpan, 1 / MAX_GAIN);
  const structure = Math.min(1, rawSpan / FULL_STRUCTURE);

  let meanNorm = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] === 0) continue;
    const t = Math.min(1, Math.max(0, (lum[i] - lo) / span));
    lum[i] = t;
    meanNorm += t * (alpha[i] / 255);
  }
  meanNorm = visibleWeight > 0 ? meanNorm / visibleWeight : 0.5;

  return { lum, alpha, sat, width, height, meanNorm, structure, sourceRange: [lo, hi] };
}

function percentile(histogram, total, p) {
  if (total <= 0) return 0;
  const target = total * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += histogram[i];
    if (acc >= target) return i / 255;
  }
  return 1;
}

/**
 * Legt eine Zielfarbe auf die Strukturkarte.
 * contrast: wie stark die gemalte Struktur durchschlaegt (0 = flach, 1 = voll)
 */
export function applyColor(map, hexColor, contrast = 0.85, out) {
  const { lum, alpha, width, height, meanNorm, structure } = map;
  const n = width * height;
  const result = out || new ImageData(width, height);
  const data = result.data;

  const [r0, g0, b0] = hexToRgb(hexColor);
  const [h, s, targetL] = rgbToHsl(r0, g0, b0);

  // Der gewaehlte Farbton soll die *mittlere* Helligkeit der Ebene sein.
  // Heller und dunkler wird von dort aus symmetrisch aufgespannt, aber am
  // Rand gestaucht, damit nichts in reines Schwarz/Weiss ausbricht.
  const headroomUp = 1 - targetL;
  const headroomDown = targetL;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = alpha[i];
    if (a === 0) { data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0; continue; }

    const d = (lum[i] - meanNorm) * contrast * structure;
    const L = d >= 0
      ? targetL + d * headroomUp * 1.6
      : targetL + d * headroomDown * 1.6;

    const [r, g, b] = hslToRgb(h, s, Math.min(1, Math.max(0, L)));
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
  }
  return result;
}

export function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Wie applyColor, aber mit ortsabhaengiger Zielfarbe.
 *
 * Die Outline zeichnet alles: Fell, Maehne und Auge. Eine einzige abgeleitete
 * Farbe reicht dafuer nicht. Bei einem Palomino ist die Maehne heller als das
 * Fell, dort muss auch die Kontur heller werden. Und ueber dem Auge darf sie
 * gar nicht mit aufhellen, sonst verliert der Blick bei einem Schimmel seine
 * Zeichnung.
 *
 * regions: [{ mask: Uint8ClampedArray (Deckkraft der Region), hex }]
 * Spaetere Eintraege ueberschreiben fruehere, gewichtet nach ihrer Deckkraft.
 */
export function applyColorRegions(map, baseHex, regions, contrast = 0.35, out) {
  const { lum, alpha, width, height, meanNorm, structure } = map;
  const n = width * height;
  const result = out || new ImageData(width, height);
  const data = result.data;

  const base = hexToRgb(baseHex);
  const prepared = regions
    .filter((r) => r && r.mask && r.hex)
    .map((r) => ({ mask: r.mask, rgb: hexToRgb(r.hex) }));

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = alpha[i];
    if (a === 0) { data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0; continue; }

    let tr = base[0], tg = base[1], tb = base[2];
    for (let k = 0; k < prepared.length; k++) {
      const w = prepared[k].mask[i] / 255;
      if (w <= 0) continue;
      const c = prepared[k].rgb;
      tr += (c[0] - tr) * w;
      tg += (c[1] - tg) * w;
      tb += (c[2] - tb) * w;
    }

    const [h, s, targetL] = rgbToHsl(tr, tg, tb);
    const d = (lum[i] - meanNorm) * contrast * structure;
    const L = d >= 0
      ? targetL + d * (1 - targetL) * 1.6
      : targetL + d * targetL * 1.6;

    const [r, g, b] = hslToRgb(h, s, Math.min(1, Math.max(0, L)));
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
  }
  return result;
}

/** Deckkraft-Maske einer vorbereiteten Ebene, zum Abgrenzen von Regionen. */
export function alphaMask(map) {
  return map.alpha;
}
