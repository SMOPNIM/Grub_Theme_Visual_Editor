// PR1 vertical slice: import -> edit left -> export zip.
// Headless (no Playwright): exercises store + exporter, asserts zip bytes.
import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { useThemeStore, selectCst, selectSemantic, defaultThemeName } from "../src/store/themeStore.js";
import { buildExportZip } from "../src/export/exporter.js";
import tela from "../../../assets/samples/tela-1080p-theme.txt?raw";

const temporal = () => (useThemeStore as any).temporal.getState();

beforeEach(() => {
  useThemeStore.getState().importFile("tela-1080p-theme.txt", tela);
  temporal().clear();
});

describe("PR1 loop", () => {
  it("import names the theme from the filename (empty title-text)", () => {
    expect(useThemeStore.getState().themeName).toBe("tela-1080p-theme");
    expect(defaultThemeName(tela, "tela-1080p-theme.txt")).toBe("tela-1080p-theme");
  });

  it("edit left bumps version+history, then export holds theme.txt at zip root", async () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    expect(st().applyFormPatch(sem.bootMenu!.nodeId, "left", "25%")).toBe("applied");
    expect(st().version).toBeGreaterThan(0);
    expect(temporal().pastStates.length).toBe(1);

    const { blob, files, missing } = await buildExportZip(st().text, st().resources, st().themeName);
    // Single-file import: resources empty -> theme.txt only, missing listed.
    expect(files).toEqual(["theme.txt"]);
    expect(missing.some((m) => m.includes("background.jpg"))).toBe(true);
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files);
    expect(names).toEqual(["theme.txt"]);
    expect(await zip.file("theme.txt")!.async("string")).toBe(st().text);
    expect(st().text).toContain("left = 25%");
  });

  it("loaded resources export at verbatim relative paths", async () => {
    const fakePng = new Uint8Array([137, 80, 78, 71]).buffer;
    const { blob } = await buildExportZip(
      useThemeStore.getState().text,
      new Map([["background.jpg", fakePng]]),
      "tela"
    );
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files).sort()).toEqual(["background.jpg", "theme.txt"]);
  });
});
