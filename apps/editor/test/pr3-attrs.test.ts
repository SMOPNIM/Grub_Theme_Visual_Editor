// PR3: four geometry attrs + label text, consecutive edits, empty-remove.
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, selectCst, selectSemantic } from "../src/store/themeStore.js";

const SAMPLE = [
  'title-text: "T"',
  "+ boot_menu {",
  "  left = 20%",
  "  top = 30%",
  "  width = 40%",
  "  height = 50%",
  "}",
  "+ label {",
  '  text = "Hello"',
  "  color = cornflowerblue",
  "}",
  "",
].join("\n");

const temporal = () => (useThemeStore as any).temporal.getState();
beforeEach(() => {
  useThemeStore.getState().loadSample(SAMPLE);
  temporal().clear();
});

describe("consecutive geometry edits (no drift)", () => {
  it("left/top/width/height each +1 version, each line exact", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const vals: Array<[string, string]> = [["left", "21%"], ["top", "31%"], ["width", "41%"], ["height", "51%"]];
    vals.forEach(([k, v], i) => {
      const sem = selectSemantic(selectCst(st().text));
      expect(st().applyFormPatch(sem.bootMenu!.nodeId, k, v)).toBe("applied");
      expect(st().version).toBe(v0 + 1 + i);
      expect(st().text).toContain(`  ${k} = ${v}\n`);
    });
    expect(temporal().pastStates.length).toBe(4);
    // Untouched label block byte-identical.
    expect(st().text).toContain('  text = "Hello"\n');
  });
});

describe("label text edit", () => {
  it("writes verbatim, bumps once", () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    expect(st().applyFormPatch(sem.labels[0].nodeId, "text", "World %d")).toBe("applied");
    expect(st().text).toContain('  text = "World %d"\n');
    expect(temporal().pastStates.length).toBe(1);
  });
});

describe("removeProperty (empty = GRUB default)", () => {
  it("deletes the line, others intact, Canvas falls back", () => {
    const st = () => useThemeStore.getState();
    const sem = selectSemantic(selectCst(st().text));
    expect(st().removeProperty(sem.bootMenu!.nodeId, "height")).toBe(true);
    expect(st().text).not.toContain("height");
    expect(st().text).toContain("  width = 40%\n");
    expect(temporal().pastStates.length).toBe(1);
    // Semantic no longer carries height -> renderer default applies.
    const sem2 = selectSemantic(selectCst(st().text));
    expect(sem2.bootMenu?.height).toBeUndefined();
  });
  it("removing a missing key changes nothing", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    expect(st().removeProperty(sem.bootMenu!.nodeId, "item_color")).toBe(false);
    expect(st().version).toBe(v0);
    expect(temporal().pastStates.length).toBe(0);
  });
});
