// Color normalization: #RGB/#RGBA/#RRGGBB/#RRGGBBAA, "r,g,b", rgba(), SVG names, transparent
// -> [r,g,b,a] (a defaults 255). Compare RGB exact, sRGB 0 tolerance (Gate3).

const SVG: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0],
  lime: [0, 255, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
  cyan: [0, 255, 255], aqua: [0, 255, 255], magenta: [255, 0, 255],
  fuchsia: [255, 0, 255], silver: [192, 192, 192], gray: [128, 128, 128],
  grey: [128, 128, 128], maroon: [128, 0, 0], olive: [128, 128, 0],
  green: [0, 128, 0], purple: [128, 0, 128], teal: [0, 128, 128],
  navy: [0, 0, 128], orange: [255, 165, 0], pink: [255, 192, 203],
  brown: [165, 42, 42], gold: [255, 215, 0], violet: [238, 130, 238],
  indigo: [75, 0, 130], salmon: [250, 128, 114], khaki: [240, 230, 140],
  plum: [221, 160, 221], orchid: [218, 112, 214], tan: [210, 180, 140],
  beige: [245, 245, 220], ivory: [255, 255, 240], snow: [255, 250, 250],
  honeydew: [240, 255, 240], azure: [240, 255, 255], lavender: [230, 230, 250],
  cornflowerblue: [100, 149, 237], steelblue: [70, 130, 180],
  skyblue: [135, 206, 235], seagreen: [46, 139, 87], forestgreen: [34, 139, 34],
  darkred: [139, 0, 0], darkblue: [0, 0, 139], darkgreen: [0, 100, 0],
  darkgray: [169, 169, 169], darkgrey: [169, 169, 169],
  lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
  transparent: [0, 0, 0],
};

export function isSvgName(s: string): boolean {
  const l = s.trim().toLowerCase();
  return l !== "transparent" && l in SVG;
}

/** Nearest SVG name by euclidean RGB distance (transparent excluded). */
export function nearestNamed(r: number, g: number, b: number): string {
  let best = "black";
  let bestD = Infinity;
  for (const [name, c] of Object.entries(SVG)) {
    if (name === "transparent") continue;
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export function normalizeColor(input: string): [number, number, number] | null {
  const rgba = normalizeColorRGBA(input);
  return rgba ? [rgba[0], rgba[1], rgba[2]] : null;
}

/**
 * Dual channel (review §4):
 * - normalizeForCompare(): simulation + Gate3 exact-compare; accepts GRUB-native
 *   AND simulation-only extensions (rgba(), #RGBA/#RRGGBBAA, transparent).
 * - normalizeForSerialize(): GRUB-native only (#RGB/#RRGGBB, "r,g,b", svg names).
 *   Returns null for simulation-only values so the exporter warns instead of
 *   writing a format GRUB may not accept.
 */
export function normalizeForCompare(input: string): [number, number, number] | null {
  return normalizeColor(input);
}

export function normalizeForSerialize(input: string): string | null {
  const s = input.trim();
  const l = s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(s)) return s;
  if (SVG[l] && l !== "transparent") return l;
  return null;
}
export function normalizeColorRGBA(input: string): [number, number, number, number] | null {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return [0, 0, 0, 0];
  let m = s.match(/^#([0-9a-f]{3,4})$/);
  if (m) {
    const d = m[1].split("").map((c) => parseInt(c + c, 16));
    return d.length === 4 ? [d[0], d[1], d[2], d[3]] : [d[0], d[1], d[2], 255];
  }
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) {
    const rgb: [number, number, number] = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    return m[2] ? [...rgb, parseInt(m[2], 16)] : [...rgb, 255];
  }
  m = s.match(/^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})(?:\s*[,\/]\s*([\d.]+))?\s*\)$/);
  if (m) {
    let a = 255;
    if (m[4] !== undefined) {
      const f = parseFloat(m[4]);
      a = f <= 1 ? Math.round(f * 255) : Math.round(f);
    }
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  m = s.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), 255];
  if (SVG[s]) return [...SVG[s], s === "transparent" ? 0 : 255];
  return null;
}

// Layout: "20%" | "100%-50" (GRUB pct-minus-px) | "300" | "300px" -> px given container.
// Spike: also accepts "50%-240" forms seen in tela (image left/top).
export function toPx(v: string | undefined, total: number, fallback: number): number {
  if (!v) return fallback;
  const t = v.trim();
  let m = t.match(/^(\d+(?:\.\d+)?)%\s*-\s*(\d+(?:\.\d+)?)(px)?$/);
  if (m) {
    const pct = parseFloat(m[1]);
    const sub = parseFloat(m[2]);
    return Number.isFinite(pct) && Number.isFinite(sub) ? (pct / 100) * total - sub : fallback;
  }
  if (t.endsWith("%")) {
    const n = parseFloat(t.slice(0, -1));
    return Number.isFinite(n) ? (n / 100) * total : fallback;
  }
  const n = parseFloat(t.replace(/px$/, ""));
  return Number.isFinite(n) ? n : fallback;
}
