// Web import, two roads (capability differs by browser — UI must label them):
// - Chromium: <input webkitdirectory> preserves directory structure.
// - Safari/Firefox: <input multiple> flat file list, no directories.
import type { ThemeDirData } from "./adapter.js";
import { stripTopDir } from "./paths.js";

export function supportsDirectoryPicker(): boolean {
  return "webkitdirectory" in document.createElement("input");
}

function pick(input: HTMLInputElement): Promise<File[]> {
  return new Promise((resolve) => {
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

async function read(f: File): Promise<ArrayBuffer> {
  return f.arrayBuffer();
}

/** Chromium road: directory tree, paths relative to the picked dir. */
export async function pickThemeDir(): Promise<ThemeDirData | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.setAttribute("webkitdirectory", "");
  const files = await pick(input);
  if (files.length === 0) return null;
  const top = (files[0] as any).webkitRelativePath?.split("/")[0] ?? "theme-dir";
  return {
    name: top,
    files: await Promise.all(
      files.map(async (f) => ({
        path: stripTopDir((f as any).webkitRelativePath || f.name),
        data: await read(f),
      }))
    ),
  };
}

/** Fallback road: flat multi-select, paths are bare filenames. */
export async function pickThemeFiles(): Promise<ThemeDirData | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  const files = await pick(input);
  if (files.length === 0) return null;
  return {
    name: "",
    files: await Promise.all(files.map(async (f) => ({ path: f.name, data: await read(f) }))),
  };
}
