// Gate3 measurement (Spike): synthetic fixture, controlled baseline (NOT device shots;
// device screenshots deferred to V1.1 — see SPIKE-REPORT).
// - 4 components: color exact after normalizeForCompare (sRGB, 0 tolerance).
// - Geometric bbox vs hand-computed expectation @1024x768 and @1920x1080.
//   Pass bar: |actual - expected| <= max(2px, 1% of container dimension).
// - Text: soft gate only (horizontal-center drift <= 5% width, vertical excluded).
import { describe, it, expect } from "vitest";
import { parseTheme, deriveSemantic, normalizeForCompare } from "@grub-theme/core";
import { computeGeometry, textCenterDriftPx } from "../src/preview/renderer.js";

const SYNTHETIC = `title-text: "Gate3"
desktop-color: "#000000"
+ boot_menu {
  left = 20%
  top = 25%
  width = 60%
  height = 50%
  item_color = "#ffffff"
  selected_item_color = "#ff9248"
}
+ label {
  left = 100
  top = 50
  width = 200
  height = 30
  text = "Hello"
  color = "cornflowerblue"
}
+ image {
  left = 10%
  top = 100%-50
  width = 480
  height = 42
  file = "info.png"
}
+ progress_bar {
  left = 32%
  top = 82%
  width = 36%
  height = 20
  id = "__timeout__"
  fg_color = "128, 128, 255"
  bg_color = "#111111"
}
`;

const tol = (total: number) => Math.max(2, total * 0.01);
const close = (a: number, e: number, total: number) => Math.abs(a - e) <= tol(total);

// Hand-computed expectations (see REPORT table for derivation).
const EXPECTED: Record<string, Record<string, { x: number; y: number; w: number; h: number }>> = {
  "1024x768": {
    boot_menu: { x: 204.8, y: 192, w: 614.4, h: 384 },
    label: { x: 100, y: 50, w: 200, h: 30 },
    image: { x: 102.4, y: 718, w: 480, h: 42 },
    progress: { x: 327.68, y: 629.76, w: 368.64, h: 20 },
  },
  "1920x1080": {
    boot_menu: { x: 384, y: 270, w: 1152, h: 540 },
    label: { x: 100, y: 50, w: 200, h: 30 },
    image: { x: 192, y: 1030, w: 480, h: 42 },
    progress: { x: 614.4, y: 885.6, w: 691.2, h: 20 },
  },
};

describe("Gate3 colors exact", () => {
  it("four component colors normalize exactly", () => {
    expect(normalizeForCompare("#ff9248")).toEqual([255, 146, 72]);
    expect(normalizeForCompare("cornflowerblue")).toEqual([100, 149, 237]);
    expect(normalizeForCompare("128, 128, 255")).toEqual([128, 128, 255]);
    expect(normalizeForCompare("#111111")).toEqual([17, 17, 17]);
    expect(normalizeForCompare("#ffffff")).toEqual([255, 255, 255]);
  });
});

describe.each(["1024x768", "1920x1080"] as const)("Gate3 geometry @%s", (res) => {
  const [W, H] = res.split("x").map(Number);
  const sem = deriveSemantic(parseTheme(SYNTHETIC));
  const g = computeGeometry(sem, W, H);
  const exp = EXPECTED[res];

  it("boot_menu bbox", () => {
    const b = g.boot_menu;
    // NOTE: float64 artifacts (e.g. 885.5999999999999) are expected; the gate is
    // the tolerance band, not bit-exactness. Diff must be << 2px/1%.
    expect(close(b.x, exp.boot_menu.x, W)).toBe(true);
    expect(close(b.y, exp.boot_menu.y, H)).toBe(true);
    expect(close(b.w, exp.boot_menu.w, W)).toBe(true);
    expect(close(b.h, exp.boot_menu.h, H)).toBe(true);
    expect(Math.abs(b.x - exp.boot_menu.x)).toBeLessThan(1e-9);
  });
  it("label bbox (px-exact, incl. cornflowerblue color passthrough)", () => {
    const key = Object.keys(g).find((k) => k.startsWith("label:"))!;
    const b = g[key];
    expect([b.x, b.y, b.w, b.h]).toEqual([exp.label.x, exp.label.y, exp.label.w, exp.label.h]);
    expect(b.color).toBe("cornflowerblue");
  });
  it("image bbox (pct-minus-px: 100%-50)", () => {
    const key = Object.keys(g).find((k) => k.startsWith("image:"))!;
    const b = g[key];
    expect(close(b.x, exp.image.x, W)).toBe(true);
    expect(close(b.y, exp.image.y, H)).toBe(true);
    expect(close(b.w, exp.image.w, W)).toBe(true);
    expect(close(b.h, exp.image.h, H)).toBe(true);
  });
  it("progress bbox", () => {
    const key = Object.keys(g).find((k) => k.startsWith("progress:"))!;
    const b = g[key];
    expect(close(b.x, exp.progress.x, W)).toBe(true);
    expect(close(b.y, exp.progress.y, H)).toBe(true);
    expect(close(b.w, exp.progress.w, W)).toBe(true);
    expect(close(b.h, exp.progress.h, H)).toBe(true);
    expect(b.color).toBe("128, 128, 255");
  });
  it("text soft gate: horizontal-center drift budget = 5% width", () => {
    expect(textCenterDriftPx(exp.label.w)).toBeCloseTo(exp.label.w * 0.05);
  });
});
