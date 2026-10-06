// PR4: color format-family write-back + font compound parsing.
import { describe, it, expect } from "vitest";
import {
  colorFamilyOf, spellColor, convertColorInput, splitFont, joinFont, isValidFontSize,
} from "../src/colorfmt.js";

describe("colorFamilyOf", () => {
  it.each([
    ["#fff", "hex3"], ["#fff8", "hex4"], ["#ff9248", "hex6"], ["#ff9248cc", "hex8"],
    ["128, 128, 255", "rgb"], ["red", "named"], ["CornflowerBlue", "named"],
    ["rgba(0,0,0,0.5)", "other"], ["garbage!!", "other"],
  ])("%s -> %s", (input, fam) => {
    expect(colorFamilyOf(input)).toBe(fam);
  });
});

describe("convertColorInput preserves the original family", () => {
  it("hex6 in, hex6-stored out (no change flag)", () => {
    const r = convertColorInput("#00ff00", "#ffffff");
    expect(r).toMatchObject({ ok: true, written: "#00ff00", formatChanged: false });
  });
  it("hex3 stored stays hex3", () => {
    const r = convertColorInput("#00ff00", "#fff");
    expect(r).toMatchObject({ ok: true, written: "#0f0", formatChanged: true });
  });
  it("named stored -> nearest named (picker hex becomes a name)", () => {
    const r = convertColorInput("#ff0000", "blue");
    expect(r).toMatchObject({ ok: true, written: "red", formatChanged: true });
  });
  it("named in, named stored (no change flag)", () => {
    const r = convertColorInput("red", "blue");
    expect(r).toMatchObject({ ok: true, written: "red", formatChanged: false });
  });
  it("rgb stored stays rgb", () => {
    const r = convertColorInput("#ff0000", "0, 0, 0");
    expect(r).toMatchObject({ ok: true, written: "255, 0, 0", formatChanged: true });
  });
  it("rgba into native family: hex approximation + MUST-warn flag", () => {
    const r = convertColorInput("rgba(0,0,0,0.5)", "#ffffff");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.written).toBe("#000000");
      expect(r.formatChanged).toBe(true);
    }
  });
  it("transparent into native family: approximation + flag", () => {
    const r = convertColorInput("transparent", "#ffffff");
    expect(r.ok && r.formatChanged).toBe(true);
  });
  it("unparseable input rejected, no write", () => {
    expect(convertColorInput("not a color", "#ffffff")).toEqual({ ok: false, reason: "unparseable" });
  });
});

describe("spellColor", () => {
  it("round-trips each family", () => {
    expect(spellColor(255, 146, 72, 255, "hex6")).toBe("#ff9248");
    expect(spellColor(255, 255, 255, 255, "hex3")).toBe("#fff");
    expect(spellColor(10, 20, 30, 255, "rgb")).toBe("10, 20, 30");
    expect(spellColor(0, 0, 0, 128, "hex8")).toBe("#00000080");
  });
});

describe("font compound", () => {
  it.each([
    ["DejaVu Sans Regular 16", "DejaVu Sans Regular", "16"],
    ["Terminus Regular 14", "Terminus Regular", "14"],
    ["Sans", "Sans", ""],
    ["  Extra   Bold   24  ", "Extra Bold", "24"],
  ])("%s -> name=%s size=%s", (input, name, size) => {
    expect(splitFont(input)).toEqual({ name, size });
  });
  it("join/isValidFontSize", () => {
    expect(joinFont("DejaVu Sans", "16")).toBe("DejaVu Sans 16");
    expect(joinFont("DejaVu Sans", "")).toBe("DejaVu Sans");
    expect(isValidFontSize("16")).toBe(true);
    expect(isValidFontSize("16px")).toBe(false);
    expect(isValidFontSize("")).toBe(true);
  });
});
