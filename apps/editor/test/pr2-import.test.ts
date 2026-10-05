// PR2: directory/multi-file import, path rules, themeName priority, banner split.
import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { useThemeStore } from "../src/store/themeStore.js";
import {
  normalizeSep, baseDirOf, baseNameOf, relativizeToTheme, stripTopDir, findThemeEntry,
} from "../src/platform/paths.js";
import { buildExportZip, missingBanner, scanExportRefs } from "../src/export/exporter.js";
import tela from "../../../assets/samples/tela-1080p-theme.txt?raw";

const temporal = () => (useThemeStore as any).temporal.getState();
const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("path rules (FROZEN)", () => {
  it("posix absolute under theme base", () => {
    expect(relativizeToTheme("/t/boot/grub/themes/tela/theme.txt", ["/t/boot/grub/themes/tela/background.jpg"])).toEqual(["background.jpg"]);
  });
  it("windows absolute with backslashes", () => {
    const out = relativizeToTheme("C:\\themes\\tela\\theme.txt", ["C:\\themes\\tela\\icons\\arch.png"]);
    expect(out).toEqual(["icons/arch.png"]);
  });
  it("theme in subdir keeps subdir-relative remainder", () => {
    const out = relativizeToTheme("/x/tela/config/theme.txt", ["/x/tela/config/theme.txt", "/x/tela/config/bg.png"]);
    expect(out).toEqual(["theme.txt", "bg.png"]);
  });
  it("outside-base falls back to basename", () => {
    expect(relativizeToTheme("/a/theme.txt", ["/elsewhere/logo.png"])).toEqual(["logo.png"]);
  });
  it("bare names pass through", () => {
    expect(relativizeToTheme("theme.txt", ["theme.txt", "background.jpg"])).toEqual(["theme.txt", "background.jpg"]);
  });
  it("stripTopDir + findThemeEntry (case-sensitive)", () => {
    expect(stripTopDir("tela/icons/a.png")).toBe("icons/a.png");
    expect(stripTopDir("theme.txt")).toBe("theme.txt");
    expect(findThemeEntry(["a/Theme.txt", "a/theme.txt"])).toBe("a/theme.txt");
    expect(findThemeEntry(["a/other.txt"])).toBeNull();
    expect(normalizeSep("C:\\x\\")).toBe("C:/x");
    expect(baseDirOf("theme.txt")).toBe("");
    expect(baseNameOf("/a/b/c.png")).toBe("c.png");
  });
});

describe("importDir", () => {
  beforeEach(() => {
    useThemeStore.getState().importFile("x.txt", 'title-text: ""\n');
    temporal().clear();
  });
  const files = (extra: Array<[string, string]> = []) => [
    { path: "/t/tela/theme.txt", data: enc(tela) },
    { path: "/t/tela/background.jpg", data: enc("BG") },
    { path: "/t/tela/icons/arch.png", data: enc("ICON") },
    ...extra.map(([p, s]) => ({ path: p, data: enc(s) })),
  ];
  it("dirname wins over empty title", () => {
    expect(useThemeStore.getState().importDir("MyTela", files())).toBe("ok");
    const st = useThemeStore.getState();
    expect(st.themeName).toBe("mytela");
    expect(st.resources.size).toBe(2);
    expect([...st.resources.keys()].sort()).toEqual(["background.jpg", "icons/arch.png"]);
    expect(st.text).toContain('desktop-image: "background.jpg"');
  });
  it("empty dirname falls back to title-text then filename", () => {
    const withTitle = files().map((f) =>
      f.path.endsWith("theme.txt") ? { ...f, data: enc('title-text: "Cool Theme"\n') } : f
    );
    expect(useThemeStore.getState().importDir("", withTitle)).toBe("ok");
    expect(useThemeStore.getState().themeName).toBe("cool-theme");
  });
  it("no theme.txt leaves state untouched", () => {
    const st = () => useThemeStore.getState();
    const v0 = st().version;
    const t0 = st().text;
    expect(st().importDir("d", [{ path: "/d/a.png", data: enc("x") }])).toBe("no-theme-txt");
    expect(st().version).toBe(v0);
    expect(st().text).toBe(t0);
  });
});

describe("missing split + export with resources", () => {
  it("partial resources: missing names only the absent ones", () => {
    const missing = scanExportRefs(tela, new Map([["background.jpg", enc("BG")]]));
    expect(missing.some((m) => m.includes("background.jpg"))).toBe(false);
    expect(missing.some((m) => m.includes("info.png"))).toBe(true);
    const b = missingBanner(1, missing);
    expect(b?.tone).toBe("red");
    expect(b!.text.startsWith("缺 ")).toBe(true);
  });
  it("zero resources: amber not-loaded copy (not the red copy)", () => {
    const b = missingBanner(0, scanExportRefs(tela, new Map()));
    expect(b?.tone).toBe("amber");
    expect(b!.text).toContain("资源未加载");
  });
  it("all resolved: no banner", () => {
    // tela refs background.jpg + info.png + select_*.png + terminal_box_*.png + fonts
    const res = new Map<string, ArrayBuffer>([
      ["background.jpg", enc("a")],
      ["info.png", enc("b")],
      ["select_c.png", enc("c")],
      ["terminal_box_c.png", enc("d")],
      ["DejaVuSans.pf2", enc("e")],
    ]);
    const missing = scanExportRefs(tela, res);
    // pixmap globs (select_*.png) never match literal files -> still missing: honest, keep listed
    expect(missingBanner(res.size, missing.filter((m) => !m.includes("*")))).toBeNull();
  });
  it("export zip carries resources at verbatim paths", async () => {
    const { blob } = await buildExportZip(tela, new Map([["background.jpg", enc("BG")], ["icons/arch.png", enc("I")]]), "tela");
    const zip = await JSZip.loadAsync(blob);
    // JSZip synthesizes folder entries ("icons/"); assert file entries only.
    const names = Object.keys(zip.files).filter((n) => !n.endsWith("/")).sort();
    expect(names).toEqual(["background.jpg", "icons/arch.png", "theme.txt"]);
    expect(await zip.file("theme.txt")!.async("string")).toContain('desktop-image: "background.jpg"');
  });
});
