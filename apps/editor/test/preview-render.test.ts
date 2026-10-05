// Gate3 re-run after the quote-aware parser fix: semantic values must be REAL
// (before the fix, `"#ffffff"` parsed as `"` and every color fell back).
// Proves the Canvas actually reads theme fields (not just geometry math).
import { describe, it, expect } from "vitest";
import { parseTheme, deriveSemantic, applyPatch } from "@grub-theme/core";
import { drawPreview, setupCanvas, computeGeometry } from "../src/preview/renderer.js";
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

describe("preview is live simulation, not a static mock", () => {
  const SYN = `+ boot_menu {\n  left = 20%\n  top = 25%\n  width = 60%\n  height = 50%\n  item_color = "#ffffff"\n  selected_item_color = "#ff9248"\n}\n+ label {\n  left = 100\n  top = 50\n  width = 200\n  height = 30\n  text = "Hello"\n  color = "#ffffff"\n}\n+ progress_bar {\n  left = 0\n  top = 0\n  width = 100\n  height = 20\n  fg_color = "#ffffff"\n}\n`;
  function renderAfter(key: string, value: string) {
    const root = parseTheme(SYN);
    const boot = (root.children as any[]).find((n: any) => n.kind === "component");
    const dirty = applyPatch(root, { nodeId: boot.nodeId, key, value, op: "set", source: "form" });
    void dirty;
    const { canvas, calls } = mockCanvas(1024, 768);
    const sem = deriveSemantic(root);
    drawPreview(canvas, sem, "#000000");
    return { sem, calls };
  }

  it("boot_menu.left moves the rendered panel", () => {
    const before = computeGeometry(deriveSemantic(parseTheme(SYN)), 1024, 768).boot_menu;
    const { sem } = renderAfter("left", "30%");
    const after = computeGeometry(sem, 1024, 768).boot_menu;
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.x).toBeCloseTo(307.2, 5);
  });
  it("selected_item_color re-strokes the panel", () => {
    const { calls } = renderAfter("selected_item_color", "#00ff00");
    expect(calls.filter((c) => c.op === "strokeRect")[0].style).toBe("rgb(0,255,0)");
  });
  it("label.text re-renders the string", () => {
    const root = parseTheme(SYN);
    const label = (root.children as any[]).find((n: any) => n.kind === "component" && n.name === "label");
    applyPatch(root, { nodeId: label.nodeId, key: "text", value: "World", op: "set", source: "form" });
    const { canvas, calls } = mockCanvas(1024, 768);
    drawPreview(canvas, deriveSemantic(root), "#000000");
    expect(calls.some((c) => c.op === "fillText" && c.text === "World")).toBe(true);
  });
  it("progress fg_color re-fills the bar", () => {
    const root = parseTheme(SYN);
    const bar = (root.children as any[]).find((n: any) => n.kind === "component" && n.name === "progress_bar");
    applyPatch(root, { nodeId: bar.nodeId, key: "fg_color", value: "#ff0000", op: "set", source: "form" });
    const { canvas, calls } = mockCanvas(1024, 768);
    drawPreview(canvas, deriveSemantic(root), "#000000");
    expect(calls.filter((c) => c.op === "fillRect").some((c) => c.style === "rgb(255,0,0)")).toBe(true);
  });
});
