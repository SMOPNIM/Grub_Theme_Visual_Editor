// Regression: equality short-circuit, sep-spacing preservation, raw replay.
// 1. Same semantic value  -> no version bump, no history entry.
// 2. Same raw, different normalized meaning -> commits (short-circuit is semantic).
// 3. Unmodified nodes (incl. `key= "v"` no-space-= and tab indent) replay byte-identical,
//    and EDITING such a line preserves its original separator gaps.
import { describe, it, expect } from "vitest";
import { parseTheme } from "../src/parser.js";
import { serializeTheme } from "../src/serializer.js";
import { applyPatch } from "../src/patch.js";
import { valuesEqual } from "../src/compare.js";
import { scanMissingAssets } from "../src/semantic.js";

describe("font-key regex /(^|[-_])font$/", () => {
  const src = [
    'terminal-font: "Terminus 14"',
    'title-font: "Sans 12"',
    '+ boot_menu {',
    '  item_font = "DejaVu 16"',
    '  font = "Sans 12"',
    "}",
  ].join("\n");
  it("four positives detected", () => {
    const missing = scanMissingAssets(parseTheme(src), new Set());
    const keys = missing.map((m) => m.split(":")[0]).sort();
    expect(keys).toEqual(["font", "item_font", "terminal-font", "title-font"]);
  });
  it("two negatives ignored", () => {
    const src2 = 'myfont: "X"\nitem_font_extra: "Y"\n';
    expect(scanMissingAssets(parseTheme(src2), new Set())).toEqual([]);
  });
});

describe("valuesEqual", () => {
  it("identical / whitespace-insensitive", () => {
    expect(valuesEqual("20%", "20%")).toBe(true);
    expect(valuesEqual("10%", "10 %")).toBe(true);
    expect(valuesEqual("  30%  ", "30%")).toBe(true);
  });
  it("color spellings normalizing equally", () => {
    expect(valuesEqual("#FFF", "#ffffff")).toBe(true);
    expect(valuesEqual("128,128,255", "128, 128, 255")).toBe(true);
  });
  it("different meanings stay different", () => {
    expect(valuesEqual("20%", "30%")).toBe(false);
    expect(valuesEqual("#ffffff", "#000000")).toBe(false);
  });
  it("same normalized color, different spelling: EQUAL (display pulled back by RHF sync)", () => {
    // Skip + pull the field back to the stored spelling instead of rewriting it.
    expect(valuesEqual("red", "#ff0000")).toBe(true);
    expect(valuesEqual("WHITE", "#ffffff")).toBe(true);
  });
});

describe("separator gaps preserved", () => {
  const src = "+ boot_menu {\n\tleft = 30%\n\tselected_item_pixmap_style= \"select_bkg_*.png\"\n}\n";
  it("unmodified nodes replay byte-identical", () => {
    expect(serializeTheme(parseTheme(src), new Set())).toBe(src);
  });
  it("editing one line keeps its own gaps and leaves others byte-identical", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    const before = serializeTheme(root, new Set());
    const dirty = applyPatch(root, { nodeId: boot.nodeId, key: "left", value: "40%", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    const dl = out.split("\n").filter((l, i) => l !== before.split("\n")[i]);
    expect(dl.length).toBe(1);
    expect(out).toContain("\tleft = 40%\n");
    expect(out).toContain('\tselected_item_pixmap_style= "select_bkg_*.png"\n');
  });
  it("editing a no-space-= line preserves its gaps", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    const dirty = applyPatch(root, { nodeId: boot.nodeId, key: "selected_item_pixmap_style", value: "other_*.png", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    expect(out).toContain('\tselected_item_pixmap_style= "other_*.png"\n');
  });
});
