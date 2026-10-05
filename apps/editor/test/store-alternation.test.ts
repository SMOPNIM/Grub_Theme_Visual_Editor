// Gate4 headless half: 10x monaco↔form alternation at store level.
// Asserts: single-version steps (no loop/overwrite), source alternates,
// zundo records exactly one entry per commit (no double-count),
// undo restores the 9th state exactly.
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, selectCst, selectSemantic } from "../src/store/themeStore.js";

const SAMPLE = `title-text: "T"\n+ boot_menu {\n  left = 20%\n  top = 30%\n  width = 40%\n  height = 40%\n}\n`;

beforeEach(() => {
  useThemeStore.getState().loadSample(SAMPLE);
  (useThemeStore as any).temporal.getState().clear();
});

describe("Gate4 alternation (store level)", () => {
  it("10 alternating edits: versions +1 each, sources alternate, history exact", () => {
    const st = () => useThemeStore.getState();
    const base = st().version;
    const snapshots: string[] = [st().text];
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        const sem = selectSemantic(selectCst(st().text));
        // 21,23,...,29: always a REAL change (SAMPLE starts at 20%, so 20+i
        // would be an empty submit at i=0 and trip the equality short-circuit).
        st().applyFormPatch(sem.bootMenu!.nodeId, "left", `${21 + i}%`);
        expect(st().source).toBe("form");
      } else {
        st().applyMonacoText(st().text.replace(/(left = )\d+%/, `$1${30 + i}%`));
        expect(st().source).toBe("monaco");
      }
      expect(st().version).toBe(base + 1 + i);
      snapshots.push(st().text);
    }
    expect(st().text).toContain("left = 39%");
    const past = (useThemeStore as any).temporal.getState().pastStates;
    expect(past.length).toBe(10); // one entry per commit, no double-count
    (useThemeStore as any).temporal.getState().undo();
    expect(useThemeStore.getState().text).toBe(snapshots[9]);
  });

  it("undo after mixed edits restores exact prior text", () => {
    const st = () => useThemeStore.getState();
    const before = st().text;
    const sem = selectSemantic(selectCst(before));
    st().applyFormPatch(sem.bootMenu!.nodeId, "top", "35%");
    const afterForm = st().text;
    expect(afterForm).not.toBe(before);
    (useThemeStore as any).temporal.getState().undo();
    expect(useThemeStore.getState().text).toBe(before);
  });
});
