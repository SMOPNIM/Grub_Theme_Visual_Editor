// Regression: store-level equality short-circuit.
// - Same semantic value (even different raw spelling) -> version/history untouched.
// - Different value -> exactly +1 version, +1 history entry.
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, selectCst, selectSemantic } from "../src/store/themeStore.js";

const SAMPLE = `title-text: "T"\n+ boot_menu {\n  left = 20%\n  item_color = "#ffffff"\n}\n`;

const temporal = () => (useThemeStore as any).temporal.getState();

beforeEach(() => {
  useThemeStore.getState().loadSample(SAMPLE);
  temporal().clear();
});

describe("applyFormPatch short-circuit", () => {
  it("identical raw value: no bump, no history", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    expect(st().applyFormPatch(sem.bootMenu!.nodeId, "left", "20%")).toBe("skipped-equal");
    expect(st().version).toBe(v0);
    expect(temporal().pastStates.length).toBe(0);
    expect(st().text).toBe(SAMPLE);
  });
  it("same meaning, different spelling: no bump, no history", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    expect(st().applyFormPatch(sem.bootMenu!.nodeId, "item_color", "#FFF")).toBe("skipped-equal");
    expect(st().version).toBe(v0);
    expect(temporal().pastStates.length).toBe(0);
  });
  it("different value: exactly +1 version, +1 history", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const sem = selectSemantic(selectCst(st().text));
    expect(st().applyFormPatch(sem.bootMenu!.nodeId, "left", "30%")).toBe("applied");
    expect(st().version).toBe(v0 + 1);
    expect(temporal().pastStates.length).toBe(1);
    expect(st().text).toContain("left = 30%");
  });
  it("missing node: skipped-missing, no bump", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    expect(st().applyFormPatch("n9999", "left", "30%")).toBe("skipped-missing");
    expect(st().version).toBe(v0);
  });
});
