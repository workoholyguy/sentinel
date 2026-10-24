// A dithered mountain range for the footer, drawn on a coarse pixel grid. Pure functions so the
// terrain and the hover lookup are testable without a canvas.

/** Light → dark. Every pixel is one of these; the dither does the in-between tones. */
export const PALETTE = ["#f3f6fb", "#dce7f5", "#c2d5ec", "#9fb9de", "#7896c8", "#5577ad", "#3a5a8c", "#253f6a", "#172a4b"];

interface Layer {
  /** coarse ridgeline as (x, y) in 0..1 of the footer, art-directed like the reference */
  ridge: Array<[number, number]>;
  /** darkness right under the ridge, and the misty floor it fades to further down */
  top: number;
  floor: number;
  /** how quickly it fades into mist (fraction of the height) */
  fall: number;
  seed: number;
}

// Back (hazy, light) to front (dark navy).
export const LAYERS: Layer[] = [
  {
    ridge: [[0, 0.21], [0.08, 0.18], [0.18, 0.22], [0.25, 0.2], [0.36, 0.17], [0.48, 0.2], [0.58, 0.19], [0.66, 0.21], [0.72, 0.17], [0.78, 0.18], [0.86, 0.24], [0.93, 0.27], [1, 0.26]],
    top: 0.16,
    floor: 0.05,
    fall: 0.3,
    seed: 11,
  },
  {
    ridge: [[0, 0.17], [0.04, 0.155], [0.1, 0.22], [0.16, 0.25], [0.24, 0.33], [0.31, 0.36], [0.4, 0.34], [0.46, 0.31], [0.52, 0.35], [0.6, 0.33], [0.66, 0.28], [0.7, 0.25], [0.78, 0.18], [0.84, 0.27], [0.9, 0.31], [0.95, 0.27], [1, 0.3]],
    top: 0.3,
    floor: 0.09,
    fall: 0.2,
    seed: 23,
  },
  {
    ridge: [[0, 0.25], [0.07, 0.31], [0.14, 0.28], [0.22, 0.35], [0.3, 0.41], [0.38, 0.37], [0.46, 0.43], [0.54, 0.47], [0.62, 0.41], [0.68, 0.38], [0.74, 0.35], [0.8, 0.45], [0.86, 0.49], [0.94, 0.43], [1, 0.41]],
    top: 0.4,
    floor: 0.08,
    fall: 0.13,
    seed: 37,
  },
  {
    ridge: [[0, 0.21], [0.06, 0.27], [0.14, 0.37], [0.22, 0.43], [0.29, 0.41], [0.34, 0.405], [0.4, 0.46], [0.46, 0.56], [0.52, 0.62], [0.58, 0.6], [0.66, 0.49], [0.72, 0.37], [0.76, 0.365], [0.82, 0.49], [0.88, 0.48], [0.95, 0.41], [1, 0.37]],
    top: 0.64,
    floor: 0.12,
    fall: 0.11,
    seed: 41,
  },
  {
    ridge: [[0, 0.45], [0.06, 0.51], [0.12, 0.61], [0.2, 0.64], [0.28, 0.67], [0.36, 0.71], [0.42, 0.75], [0.5, 0.73], [0.56, 0.69], [0.62, 0.67], [0.7, 0.69], [0.76, 0.71], [0.84, 0.65], [0.9, 0.57], [0.96, 0.46], [1, 0.27]],
    top: 0.76,
    floor: 0.3,
    fall: 0.17,
    seed: 53,
  },
  {
    ridge: [[0, 0.46], [0.05, 0.53], [0.11, 0.63], [0.18, 0.69], [0.26, 0.75], [0.36, 0.81], [0.44, 0.83], [0.52, 0.75], [0.58, 0.67], [0.63, 0.73], [0.7, 0.81], [0.78, 0.81], [0.86, 0.73], [0.92, 0.63], [1, 0.57]],
    top: 0.93,
    floor: 0.54,
    fall: 0.3,
    seed: 67,
  },
];

/** mulberry32: small, fast, deterministic */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Piecewise-linear noise: straight slopes and sharp peaks, like real ridgelines at a distance. */
function jagged(seed: number, points: number) {
  const r = rng(seed);
  const pts = Array.from({ length: points + 1 }, () => r() - 0.5);
  return (u: number) => {
    const p = Math.min(points - 1e-9, Math.max(0, u * points));
    const i = Math.floor(p);
    const f = p - i;
    return pts[i] * (1 - f) + pts[i + 1] * f;
  };
}

function interpolate(ridge: Array<[number, number]>, u: number) {
  let k = 1;
  while (k < ridge.length - 1 && ridge[k][0] < u) k++;
  const [x0, y0] = ridge[k - 1];
  const [x1, y1] = ridge[k];
  const f = x1 === x0 ? 0 : (u - x0) / (x1 - x0);
  return y0 + (y1 - y0) * Math.min(1, Math.max(0, f));
}

/** Smooth 2D value noise in 0..1, for mist and mottling. */
function valueNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * fx;
    const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

export interface Terrain {
  gw: number;
  gh: number;
  /** per layer, the ridge's y (grid rows from the top) in every column */
  ridges: Float32Array[];
  /** the same ridges without the fine jaggedness, for light and shadow on the big faces */
  shapes: Float32Array[];
}

/** `inset` (0..1) pushes the whole range down to leave room for text along the top. */
export function buildTerrain(gw: number, gh: number, inset = 0): Terrain {
  const shapes: Float32Array[] = [];
  const ridges = LAYERS.map((layer) => {
    const coarse = jagged(layer.seed, 40);
    const fine = jagged(layer.seed + 1, 170);
    const out = new Float32Array(gw);
    const shape = new Float32Array(gw);
    for (let x = 0; x < gw; x++) {
      const u = gw > 1 ? x / (gw - 1) : 0;
      const y = interpolate(layer.ridge, u) + coarse(u) * 0.012;
      const place = (v: number) => (inset + v * (1 - inset)) * gh;
      shape[x] = place(y);
      out[x] = place(y + fine(u) * 0.0035);
    }
    shapes.push(shape);
    return out;
  });
  return { gw, gh, ridges, shapes };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Palette index for every grid cell, row by row. */
export function renderIndices({ gw, gh, ridges, shapes }: Terrain): Uint8Array {
  const out = new Uint8Array(gw * gh);
  const mist = valueNoise(5);
  const grain = valueNoise(9);
  const last = PALETTE.length - 1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let layer = -1;
      for (let i = ridges.length - 1; i >= 0; i--) {
        if (y >= ridges[i][x]) {
          layer = i;
          break;
        }
      }
      let v: number;
      if (layer < 0) {
        // sky: almost white, with a sparse speckle that thickens toward the peaks
        v = 0.006 + (y / gh) * 0.03 + (mist(x / 26, y / 18) - 0.5) * 0.03;
      } else {
        const L = LAYERS[layer];
        const r = ridges[layer];
        const dy = (y - r[x]) / gh;
        v = L.floor + (L.top - L.floor) * Math.exp(-dy / L.fall);
        // faces turned away from the light (ridge falling to the right) are darker, down the whole column;
        // measured on the smooth shape so only the big faces cast bands, not every jag
        const sh = shapes[layer];
        const span = Math.max(3, Math.round(gw / 120));
        const slope = (sh[Math.min(gw - 1, x + span)] - sh[Math.max(0, x - span)]) / (2 * span);
        v += Math.max(-0.08, Math.min(0.13, slope * 0.3)) * Math.exp(-dy / (L.fall * 2.2));
        // drifting mist and fine mottling
        v += (mist(x / 38, y / 22 + layer * 7) - 0.5) * 0.16;
        v += (grain(x / 3.5, y / 3.5) - 0.5) * 0.06;
      }
      const p = Math.max(0, Math.min(1, v)) * last;
      const base = Math.floor(p);
      const threshold = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      out[y * gw + x] = Math.min(last, base + (p - base > threshold ? 1 : 0));
    }
  }
  return out;
}

/**
 * The visible ridge nearest to a point: a layer's ridge only counts where no nearer layer covers it.
 * Returns the ridge row, or null if nothing is visible in that column.
 */
export function ridgeNear({ gw, ridges }: Terrain, gx: number, gy: number): { layer: number; y: number } | null {
  const x = Math.max(0, Math.min(gw - 1, Math.round(gx)));
  let best: { layer: number; y: number } | null = null;
  let coverAbove = Infinity; // the highest ridge in front of the current layer
  for (let i = ridges.length - 1; i >= 0; i--) {
    const y = ridges[i][x];
    if (y < coverAbove) {
      if (!best || Math.abs(y - gy) < Math.abs(best.y - gy)) best = { layer: i, y };
      coverAbove = y;
    }
  }
  return best;
}

/** Metres for a point on screen: higher on screen is higher up the mountain. */
export function elevationAt(gy: number, gh: number): number {
  return Math.round(420 + (1 - gy / gh) * 2900);
}

export function formatMetres(m: number): string {
  return `${m.toLocaleString("en-US")} m`;
}
