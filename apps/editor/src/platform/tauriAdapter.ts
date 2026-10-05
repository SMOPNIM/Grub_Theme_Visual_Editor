// Tauri adapter (desktop only). Lazy dynamic imports keep @tauri-apps/* out of
// the Web bundle entirely; every entry asserts isTauri() first.
import type { PlatformAdapter, ThemeDirData } from "./adapter.js";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function assertTauri(): void {
  if (!isTauri()) throw new Error("tauriAdapter used outside Tauri runtime");
}

function baseName(p: string): string {
  return p.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? p;
}

async function readFileBytes(path: string): Promise<ArrayBuffer> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export const tauriAdapter: PlatformAdapter = {
  async openThemeFile() {
    assertTauri();
    const { open } = await import("@tauri-apps/plugin-dialog");
    const sel = await open({ filters: [{ name: "GRUB theme", extensions: ["txt"] }] });
    if (typeof sel !== "string") throw new Error("cancelled");
    return { name: baseName(sel), data: await readFileBytes(sel) };
  },

  async openThemeDir(): Promise<ThemeDirData | null> {
    assertTauri();
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const sel = await open({ directory: true });
    if (typeof sel !== "string") return null;
    // Absolute paths; store relativizes against the theme.txt entry (PR2 rule).
    const files: Array<{ path: string; data: ArrayBuffer }> = [];
    const walk = async (dir: string) => {
      const entries = await readDir(dir); // shallow; recursion is manual (symlink-safe)
      for (const e of entries) {
        if (e.isSymlink) continue; // no loop chasing in PR2
        const full = `${dir.replace(/[/\\]+$/, "")}/${e.name}`;
        if (e.isDirectory) await walk(full);
        else if (e.isFile) files.push({ path: full, data: await readFileBytes(full) });
      }
    };
    await walk(sel);
    return { name: baseName(sel), files };
  },

  async saveZip(data, suggestedName) {
    assertTauri();
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const dest = await save({ defaultPath: suggestedName });
    if (!dest) return;
    await writeFile(dest, new Uint8Array(data));
  },

  async hasNativeFont() {
    return isTauri();
  },
  async hasTruePreview() {
    return isTauri();
  },
};
