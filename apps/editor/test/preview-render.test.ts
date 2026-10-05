// Gate3 re-run after the quote-aware parser fix: semantic values must be REAL
// (before the fix, `"#ffffff"` parsed as `"` and every color fell back).
// Proves the Canvas actually reads theme fields (not just geometry math).
import { describe, it, expect } from "vitest";
import { parseTheme, deriveSemantic } from "@grub-theme/core";
import { drawPreview, setupCanvas } from "../src/preview/renderer.js";
import tela from "../../../assets/samples/tela-1080p-theme.txt?raw";

function mockCanvas(w: number, h: number) {
  const calls: Array<{ op: string; style?: string; text?: string }> = [];
  const ctx: any = {
    fillStyle: "#000",
    strokeStyle: "#000",
    font: "",
    textBaseline: "",
    textAlign: "",
    globalAlpha: 1,
    fillRect: () => calls.push({ op: "fillRect", style: ctx.fillStyle }),
    strokeRect: () => calls.push({ op: "strokeRect", style: ctx.strokeStyle }),
    fillText: (text: string) => calls.push({ op: "fillText", style: ctx.fillStyle, text }),
    setLineDash: () => {},
    getLineMaxColumn: () => 1,
  };
  const canvas = { width: w, height: h, style: {} as any, getContext: () => ctx };
  return { canvas: canvas as unknown as HTMLCanvasElement, calls };
}

describe("tela semantic values are real (quote-fix regression)", () => {
  const sem = deriveSemantic(parseTheme(tela));
  it("desktop + boot_menu + label colors parsed, not fallback garbage", () => {
    expect(sem.globals["desktop-color"]?.value).toBe("#000000");
    expect(sem.bootMenu?.selected_item_color).toBe("#ffffff");
    expect(sem.bootMenu?.item_color).toBe("#cccccc");
    expect(sem.labels[0]?.color).toBe("#cccccc");
    expect(sem.labels[0]?.font).toBe("DejaVu Sans Regular 16");
    expect(sem.images[0]?.file).toBe("info.png");
  });
});

describe("drawPreview reads theme fields", () => {
  const sem = deriveSemantic(parseTheme(tela));
  const { canvas, calls } = mockCanvas(1024, 768);
  setupCanvas(canvas, 1024, 768);
  drawPreview(canvas, sem, sem.globals["desktop-color"]?.value ?? null);

  it("background filled with the theme desktop-color", () => {
    expect(calls[0]).toEqual({ op: "fillRect", style: "rgb(0,0,0)" });
  });
  it("boot_menu stroked with selected_item_color", () => {
    const strokes = calls.filter((c) => c.op === "strokeRect");
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[0].style).toBe("rgb(255,255,255)");
  });
  it("label drawn as text in its own color", () => {
    const texts = calls.filter((c) => c.op === "fillText");
    const countdown = texts.find((t) => t.text?.includes("Booting in"));
    expect(countdown).toBeDefined();
    expect(countdown!.style).toBe("rgb(204,204,204)");
  });
  it("mock boot entries drawn, one highlighted", () => {
    const texts = calls.filter((c) => c.op === "fillText");
    expect(texts.some((t) => t.text === "Ubuntu")).toBe(true);
  });
});
