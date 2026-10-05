// Semantic value equality for the applyFormPatch short-circuit.
// Compares by MEANING, not raw spelling:
//   - identical after trim                             -> equal
//   - identical after removing all whitespace          -> equal ("10%" vs "10 %")
//   - both parse as colors and normalize equally       -> equal ("#FFF" vs "#ffffff")
// Anything else (e.g. "red" vs "#ff0000" — same sRGB but different GRUB
// spelling) is UNEQUAL: serializer would have to rewrite the spelling, which
// is itself a change worth recording in history.
import { normalizeColorRGBA } from "./colors.js";

export function valuesEqual(a: string, b: string): boolean {
  if (a.trim() === b.trim()) return true;
  const nospace = (s: string) => s.replace(/\s+/g, "");
  if (nospace(a) === nospace(b)) return true;
  const ca = normalizeColorRGBA(a);
  const cb = normalizeColorRGBA(b);
  if (ca && cb) {
    return ca[0] === cb[0] && ca[1] === cb[1] && ca[2] === cb[2] && ca[3] === cb[3];
  }
  return false;
}
