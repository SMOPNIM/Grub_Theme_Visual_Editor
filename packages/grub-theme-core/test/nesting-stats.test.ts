import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTheme } from "../src/parser.js";
import { deriveSemantic } from "../src/semantic.js";

const samplesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets", "samples");

// Gate3 coverage: no silent empty-render. Nested components must be extracted.
describe("nesting extraction (Gate3 coverage)", () => {
  it("tela: all four-component kinds top-level", () => {
    const root = parseTheme(readFileSync(join(samplesDir, "tela-1080p-theme.txt"), "utf8"));
    const sem = deriveSemantic(root);
    expect(sem.bootMenu?.path).toBe("root.boot_menu[0]");
    expect(sem.labels[0]?.path).toBe("root.label[0]");
    expect(sem.images[0]?.path).toBe("root.image[0]");
  });

  it("archlinux: hbox inline labels + two-line circular_progress extracted", () => {
    const root = parseTheme(readFileSync(join(samplesDir, "archlinux-theme.txt"), "utf8"));
    const sem = deriveSemantic(root);
    expect(sem.bootMenu?.path).toBe("root.boot_menu[0]");
    // 6 inline + label {...} inside hbox — exact paths, so a future parser change
    // cannot silently swallow a nested item and still pass on length alone.
    expect(sem.labels.length).toBe(6);
    expect(sem.labels.map((l) => l.path)).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => `root.hbox[0].label[${i}]`)
    );
    // circular_progress collected as progress (passthrough render in MVP)
    expect(sem.progressbars.length).toBe(1);
    expect(sem.progressbars[0]?.path).toBe("root.circular_progress[0]");
  });
});
