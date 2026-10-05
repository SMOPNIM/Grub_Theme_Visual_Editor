import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTheme } from "../src/parser.js";
import { serializeTheme } from "../src/serializer.js";
import { applyPatch } from "../src/patch.js";
import { deriveSemantic } from "../src/semantic.js";

const samplesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets", "samples");
const REAL = ["tela-1080p-theme.txt", "tela-4k-theme.txt", "archlinux-theme.txt"];

// Gate2-A: byte-identity via Buffer.equals (BOM + mixed CRLF safe)
describe("Gate2-A real fixtures byte-identical", () => {
  for (const f of REAL) {
    it(f, () => {
      const buf: Buffer = readFileSync(join(samplesDir, f));
      const root = parseTheme(buf.toString("utf8"));
      const out = serializeTheme(root, new Set());
      expect(Buffer.from(out, "utf8").equals(buf)).toBe(true);
    });
  }
});

// Gate2-B: single-field edit => diff hunk covers target line ±1 context only.
// Cases: (1) existing scalar, (2) missing scalar insert (counts as +1 line),
// (3) color format change, (4) path with spaces, (5) nested component field.
describe("Gate2-B single-field diff", () => {
  const src = `title-text: "Welcome"\n+ boot_menu {\n  left = 20%\n  item_color = "#ffffff"\n}\n`;

  function changedLines(a: string, b: string): number[] {
    const al = a.split("\n");
    const bl = b.split("\n");
    const idx: number[] = [];
    const n = Math.max(al.length, bl.length);
    for (let i = 0; i < n; i++) if (al[i] !== bl[i]) idx.push(i);
    return idx;
  }

  it("1. existing scalar: one line changes", () => {
    const root = parseTheme(src);
    const sem = deriveSemantic(root);
    const dirty = applyPatch(root, { nodeId: sem.bootMenu!.nodeId, key: "left", value: "30%", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    const diff = changedLines(src, out);
    expect(diff.length).toBe(1);
    expect(out.split("\n")[diff[0]]).toMatch(/left = 30%/);
  });

  it("3. color format change: single line", () => {
    const root = parseTheme(src);
    const sem = deriveSemantic(root);
    const dirty = applyPatch(root, { nodeId: sem.bootMenu!.nodeId, key: "item_color", value: "128, 128, 255", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    expect(changedLines(src, out).length).toBe(1);
  });

  it("4. path with spaces gets quoted on rebuild", () => {
    const s2 = `desktop-image: "background.png"\n`;
    const root = parseTheme(s2);
    const sem = deriveSemantic(root);
    const id = sem.globals["desktop-image"].nodeId;
    const dirty = applyPatch(root, { nodeId: id, key: "desktop-image", value: "my bg.png", op: "set", source: "form" });
    const out = serializeTheme(root, dirty);
    expect(changedLines(s2, out).length).toBe(1);
    expect(out).toContain(`"my bg.png"`);
  });

  it("BOM preserved", () => {
    const withBom = "﻿title-text: \"A\"\n";
    const root = parseTheme(withBom);
    expect(serializeTheme(root, new Set())).toBe(withBom);
  });

  it("mixed CRLF/LF byte-identical", () => {
    const mixed = "title-text: \"A\"\r\ndesktop-color: \"#000\"\n";
    const root = parseTheme(mixed);
    expect(serializeTheme(root, new Set())).toBe(mixed);
  });
});
