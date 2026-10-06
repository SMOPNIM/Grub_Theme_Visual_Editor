// PR4: color write-back families + font compound + highlight-only linkage.
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, selectCst, selectSemantic } from "../src/store/themeStore.js";
import { drawPreview } from "../src/preview/renderer.js";

const SAMPLE = [
  'title-text: "T"',
  "+ boot_menu {",
  "  left = 20%",
  "  top = 25%",
  "  width = 60%",
  "  height = 50%",
  '  item_color = "#ffffff"',
  '  selected_item_color = "red"',
  '  item_font = "DejaVu Sans Regular 16"',
  "}",
  "",
].join("\n");

const temporal = () => (useThemeStore as any).temporal.getState();
beforeEach(() => {
  useThemeStore.getState().loadSample(SAMPLE);
  temporal().clear();
});

function mockCanvas() {
  const calls: Array<{ op: string; style?: string; text?: string }> = [];
  const ctx: any = {
    fillStyle: "#000", strokeStyle: "#000", font: "", textBaseline: "",
    textAlign: "", globalAlpha: 1,
    fillRect: () => calls.push({ op: "fillRect", style: ctx.fillStyle }),
    strokeRect: () => calls.push({ op: "strokeRect", style: ctx.strokeStyle }),
    fillText: (text: string) => calls.push({ op: "fillText", style: ctx.fillStyle, text }),
    setLineDash: () => {},
  };
  return { canvas: { width: 1024, height: 768, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement, calls };
}

describe("applyColorPatch", () => {
  it("hex into named original: nearest name + formatChanged warn", () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    const r = st().applyColorPatch(sem.bootMenu!.nodeId, "selected_item_color", "#00ff00");
    expect(r.status).toBe("applied");
    expect(r.written).toBe("lime");
    expect(r.formatChanged).toBe(true);
    expect(st().text).toContain('selected_item_color = "lime"');
  });
  it("same color any spelling: skipped-equal (red vs #ff0000)", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    const r = st().applyColorPatch(sem.bootMenu!.nodeId, "selected_item_color", "#ff0000");
    expect(r.status).toBe("skipped-equal");
    expect(st().version).toBe(v0);
    expect(temporal().pastStates.length).toBe(0);
  });
  it("rgba into hex original: approximation + MUST-warn flag", () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    const r = st().applyColorPatch(sem.bootMenu!.nodeId, "item_color", "rgba(0,0,0,0.5)");
    expect(r.status).toBe("applied");
    expect(r.written).toBe("#000000");
    expect(r.formatChanged).toBe(true);
  });
  it("unparseable rejected, nothing written", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    const r = st().applyColorPatch(sem.bootMenu!.nodeId, "item_color", "blurple");
    expect(r.status).toBe("invalid");
    expect(st().version).toBe(v0);
    expect(st().text).toContain('item_color = "#ffffff"');
  });
  it("missing node: skipped-missing", () => {
    expect(useThemeStore.getState().applyColorPatch("n9999", "item_color", "red").status).toBe("skipped-missing");
  });
});

describe("highlight-only linkage", () => {
  it("selected change recolors highlight row + panel, normal rows keep item color", () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    st().applyColorPatch(sem.bootMenu!.nodeId, "selected_item_color", "#00ff00");
    const sem2 = selectSemantic(selectCst(st().text));
    const { canvas, calls } = mockCanvas();
    drawPreview(canvas, sem2, "#000000");
    const texts = calls.filter((c) => c.op === "fillText");
    // Normal rows still item white; highlighted row follows selected green.
    expect(texts.some((t) => t.style === "rgb(255,255,255)")).toBe(true);
    expect(texts.some((t) => t.style === "rgb(0,255,0)")).toBe(true);
    const strokes = calls.filter((c) => c.op === "strokeRect");
    expect(strokes[0].style).toBe("rgb(0,255,0)");
  });
});
