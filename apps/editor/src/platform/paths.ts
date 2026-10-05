// PR2 path rules (FROZEN): zip must never contain absolute paths.
// - Separators normalized `\` -> `/`; trailing slashes stripped.
// - base = directory portion of the theme.txt path in the SAME path space.
// - A file under base/ is stored as its remainder ("bg" stays "background.png",
//   "icons/a.png" stays "icons/a.png").
// - A file outside base falls back to its basename (documented, warned by caller).
// - webkitRelativePath "THEME/sub/f" is first stripped to "sub/f" (drop top dir),
//   which is exactly "relative to the picked directory".
export interface PickedFile {
  path: string;
  data: ArrayBuffer;
}

export function normalizeSep(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function baseDirOf(themeFilePath: string): string {
  const n = normalizeSep(themeFilePath);
  const i = n.lastIndexOf("/");
  return i < 0 ? "" : n.slice(0, i);
}

export function baseNameOf(p: string): string {
  const n = normalizeSep(p);
  const i = n.lastIndexOf("/");
  return i < 0 ? n : n.slice(i + 1);
}

export function relativizeToTheme(themeFilePath: string, absPaths: string[]): string[] {
  const base = baseDirOf(themeFilePath);
  return absPaths.map((raw) => {
    const p = normalizeSep(raw);
    if (base !== "" && p.startsWith(base + "/")) return p.slice(base.length + 1);
    if (base === "") return p;
    if (p === normalizeSep(themeFilePath)) return "theme.txt";
    return baseNameOf(p); // outside-base fallback
  });
}

/** "THEME/icons/a.png" -> "icons/a.png"; "theme.txt" unchanged. */
export function stripTopDir(webkitPath: string): string {
  const n = normalizeSep(webkitPath);
  const i = n.indexOf("/");
  return i < 0 ? n : n.slice(i + 1);
}

/** First entry whose basename is exactly "theme.txt" (case-sensitive). */
export function findThemeEntry(paths: string[]): string | null {
  return paths.find((p) => baseNameOf(p) === "theme.txt") ?? null;
}
