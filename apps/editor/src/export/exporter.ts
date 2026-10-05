// PR1 exporter: flat zip, verbatim relative paths (no assets/ reshuffling).
// Layout: theme.txt at zip ROOT + each loaded resource at its original string.
// Missing refs are reported, never silently invented.
import JSZip from "jszip";
import { parseTheme, scanMissingAssets } from "@grub-theme/core";

export interface ExportResult {
  blob: Blob;
  /** theme.txt + written resource paths, zip-root-relative. */
  files: string[];
  /** Unresolved refs (images/fonts). Export proceeds; caller surfaces them. */
  missing: string[];
}

const FONT_KEY = /(^|[-_])font$/;

function fontRefs(root: ReturnType<typeof parseTheme>): string[] {
  const out: string[] = [];
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.kind === "property" && FONT_KEY.test(n.key)) out.push(n.value);
      else if (n.kind === "component") walk(n.children);
    }
  };
  walk(root.children as any[]);
  return out;
}

export async function buildExportZip(
  text: string,
  resources: Map<string, ArrayBuffer>,
  _themeName: string
): Promise<ExportResult> {
  void _themeName; // PR1: flat layout; themeName only names the .zip file.
  const root = parseTheme(text);
  const available = new Set(resources.keys());
  // Font refs need name-based matching (a font NAME never equals a .pf2 filename),
  // so drop scanMissingAssets' exact-match font entries and apply the light rule.
  const missing = scanMissingAssets(root, available).filter((e) => !FONT_KEY.test(e.split(":")[0]));
  // Light font rule (PR1): a font NAME never equals a .pf2 filename, so exact
  // matching would always warn. Approximation: warn only when ZERO .pf2 loaded.
  const hasPf2 = [...resources.keys()].some((k) => k.toLowerCase().endsWith(".pf2"));
  const fonts = fontRefs(root);
  if (fonts.length > 0 && !hasPf2) {
    for (const f of fonts) missing.push(`font: "${f}" (no .pf2 loaded)`);
  }
  const zip = new JSZip();
  zip.file("theme.txt", text);
  const files = ["theme.txt"];
  for (const [path, data] of resources) {
    zip.file(path, data);
    files.push(path);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, files, missing };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
