// Color normalization: #RGB/#RGBA/#RRGGBB/#RRGGBBAA, "r,g,b", rgba(), SVG names, transparent
// -> [r,g,b,a] (a defaults 255). Compare RGB exact, sRGB 0 tolerance (Gate3).

const SVG: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0],
  cornflowerblue: [100, 149, 237], transparent: [0, 0, 0],
  gray: [128, 128, 128], grey: [128, 128, 128], blue: [0, 0, 255],
  green: [0, 128, 0], yellow: [255, 255, 0],
};

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
