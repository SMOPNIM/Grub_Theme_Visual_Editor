// PR3: toPx expression coverage + verbatim write-back (never normalized to px).
import { describe, it, expect } from "vitest";
import { toPx } from "../src/colors.js";
import { parseTheme } from "../src/parser.js";
import { serializeTheme } from "../src/serializer.js";
import { applyPatch } from "../src/patch.js";

describe("toPx expressions (PR3, W=1024/H=768)", () => {
  const cases: Array<[string | undefined, number, number, number]> = [
    ["50%", 1024, -1, 512], // pct of width
    ["25%", 768, -1, 192], // pct of height
    ["100%-50", 1024, -1, 974], // GRUB pct-minus-px
    ["50%-240", 1024, -1, 272], // tela image form
    ["300px", 1024, -1, 300], // explicit px
    ["300", 1024, -1, 300], // bare number
    ["+50", 1024, -1, 50], // signed number
    ["-50", 1024, -1, -50],
  ];
  for (const [input, total, fb, expected] of cases) {
    it(JSON.stringify(input), () => {
      expect(toPx(input, total, fb)).toBeCloseTo(expected, 9);
    });
  }
  it("garbage and empty fall back", () => {
    expect(toPx("abc", 1024, 7)).toBe(7);
    expect(toPx(undefined, 1024, 7)).toBe(7);
    expect(toPx("", 1024, 7)).toBe(7);
  });
});

describe("expression values serialize verbatim (no px normalization)", () => {
  const src = "+ boot_menu {\n  left = 20%\n  top = 100%-35\n  width = 40%\n}\n";
  it("editing another field keeps the expression spelling", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    const dirty = applyPatch(root, { nodeId: boot.nodeId, key: "left", value: "50%", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    expect(out).toContain("left = 50%\n");
    expect(out).toContain("top = 100%-35\n");
  });
  it("writing an expression keeps it verbatim", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    const dirty = applyPatch(root, { nodeId: boot.nodeId, key: "width", value: "100%-240", op: "set", source: "form" });
    expect(serializeTheme(root, dirty)).toContain("width = 100%-240\n");
  });
});

describe("remove op (empty field = GRUB default)", () => {
  const src = "+ boot_menu {\n  left = 20%\n  top = 30%\n}\n";
  it("removes the property line, others byte-identical", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    applyPatch(root, { nodeId: boot.nodeId, key: "top", value: "", op: "remove", source: "form" });
    const out = serializeTheme(root, new Set());
    expect(out).toBe("+ boot_menu {\n  left = 20%\n}\n");
  });
  it("removing a missing key is a no-op", () => {
    const root = parseTheme(src);
    const boot = root.children.find((n: any) => n.kind === "component") as any;
    applyPatch(root, { nodeId: boot.nodeId, key: "width", value: "", op: "remove", source: "form" });
    expect(serializeTheme(root, new Set())).toBe(src);
  });
});
