// PR4: format-family-preserving color write-back + font compound parsing.
// Families are detected by SPELLING, never by value.
import { normalizeColorRGBA, isSvgName, nearestNamed } from "./colors.js";

export type ColorFamily = "hex3" | "hex4" | "hex6" | "hex8" | "rgb" | "named" | "other";

export function colorFamilyOf(value: string): ColorFamily {
  const s = value.trim();
  const l = s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return "hex3";
  if (/^#[0-9a-fA-F]{4}$/.test(s)) return "hex4";
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return "hex6";
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return "hex8";
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(s)) return "rgb";
  if (isSvgName(s) || l === "transparent") return "named";
  if (normalizeColorRGBA(s)) return "other";
  return "other";
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const hex1 = (n: number) => Math.round(Math.max(0, Math.min(255, n)) / 17).toString(16);

/** Spell [r,g,b,a] in the requested family. Alpha survives only in hex4/hex8. */
export function spellColor(r: number, g: number, b: number, a: number, family: ColorFamily): string {
  switch (family) {
    case "hex3": return `#${hex1(r)}${hex1(g)}${hex1(b)}`;
    case "hex4": return `#${hex1(r)}${hex1(g)}${hex1(b)}${hex1(a)}`;
    case "hex6": return `#${hex(r)}${hex(g)}${hex(b)}`;
    case "hex8": return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
    case "rgb": return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
    case "named": return nearestNamed(Math.round(r), Math.round(g), Math.round(b));
    case "other": return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
}

export type ColorConvert =
  | { ok: true; written: string; formatChanged: boolean; fromFamily: ColorFamily; toFamily: ColorFamily }
  | { ok: false; reason: "unparseable" };

/**
 * Convert a free-form user color into the ORIGINAL value's spelling family.
 * - Same family in/out            -> formatChanged: false.
 * - Simulation-only input (rgba()/transparent/alpha hex) into a native
 *   family -> hex approximation + formatChanged: true (caller must warn, never silent).
 * - Unparseable input             -> { ok: false } (caller rejects, no write).
 */
export function convertColorInput(input: string, original: string): ColorConvert {
  const rgba = normalizeColorRGBA(input);
  if (!rgba) return { ok: false, reason: "unparseable" };
  const [r, g, b, a] = rgba;
  const fromFamily = colorFamilyOf(original);
  const inFamily = colorFamilyOf(input);
  const written = spellColor(r, g, b, a, fromFamily === "other" ? "hex6" : fromFamily);
  const changed =
    inFamily !== fromFamily ||
    (a !== 255 && (fromFamily === "hex3" || fromFamily === "hex6" || fromFamily === "rgb" || fromFamily === "named"));
  return { ok: true, written, formatChanged: changed, fromFamily, toFamily: fromFamily };
}

// --- font compound "Name Size" ---

export interface FontParts {
  name: string;
  size: string; // "" when absent
}

/** Split on the LAST space: trailing numeric token is the size. */
export function splitFont(value: string): FontParts {
  const t = value.trim().replace(/\s+/g, " ");
  const i = t.lastIndexOf(" ");
  if (i > 0 && /^\d+$/.test(t.slice(i + 1))) {
    return { name: t.slice(0, i), size: t.slice(i + 1) };
  }
  return { name: t, size: "" };
}

export function joinFont(name: string, size: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  const s = size.trim();
  if (!n) return s;
  if (!s) return n;
  return `${n} ${s}`;
}

/** Size, when present, must be a plain integer (GRUB pf2 size). */
export function isValidFontSize(size: string): boolean {
  return size === "" || /^\d+$/.test(size);
}
