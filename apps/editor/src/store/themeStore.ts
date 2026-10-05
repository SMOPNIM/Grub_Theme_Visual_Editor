// UI-1 store: text is the ONLY persisted state (Spike 方案A).
// CST/semantic are derived on demand via selectors — history stays text-only,
// so zundo never stores trees and Monaco undo never double-counts.
import { create } from "zustand";
import { temporal } from "zundo";
import { parseTheme, serializeTheme, applyPatch, valuesEqual } from "@grub-theme/core";
import type { CSTRoot, SemanticIndex } from "@grub-theme/core";
import { deriveSemantic } from "@grub-theme/core";

export type EditSource = "monaco" | "form" | "import" | "history";

export interface FormEditSync {
  nodeId: string;
  key: string;
  /** Store version that produced this edit — effect applies it only on match. */
  version: number;
}

export type PatchResult = "applied" | "skipped-equal" | "skipped-missing";

interface ThemeState {
  text: string;
  version: number;
  source: EditSource;
  lastFormEdit: FormEditSync | null;
  /** Loaded resource files by ORIGINAL relative path (verbatim). Empty on Web single-file import. */
  resources: Map<string, ArrayBuffer>;
  /** Export base name. Default: title-text slug, else imported filename slug. */
  themeName: string;
  loadSample: (text: string) => void;
  /** PR1 import: single theme.txt (Web). Resources stay empty; banner says so. */
  importFile: (fileName: string, text: string) => void;
  setThemeName: (name: string) => void;
  applyMonacoText: (text: string) => void;
  /** Semantic-equality short-circuit: equal values never bump version/history. */
  applyFormPatch: (nodeId: string, key: string, value: string) => PatchResult;
  consumeFormEdit: () => void;
  /** Call right after temporal undo()/redo(): marks wholesale text restore. */
  markHistorySync: () => void;
}

function findNode(root: CSTRoot, nodeId: string): any | null {
  let found: any | null = null;
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.nodeId === nodeId) {
        found = n;
        return;
      }
      if (n.kind === "component") walk(n.children);
      if (found) return;
    }
  };
  walk(root.children as any[]);
  return found;
}

/** slugify for default themeName: lower, non-alnum -> "-", fallback custom-theme. */
export function slugify(s: string): string {
  const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "custom-theme";
}

/** PR1 default: title-text slug, else imported filename slug (desktop overrides with dir name in PR2). */
export function defaultThemeName(text: string, fileName: string): string {
  const root = parseTheme(text);
  let title = "";
  for (const n of root.children as any[]) {
    if (n.kind === "property" && n.key === "title-text") {
      title = (n.value as string).trim();
      break;
    }
  }
  if (title) return slugify(title);
  return slugify(fileName.replace(/\.[^.]*$/, ""));
}
export function currentValue(root: CSTRoot, nodeId: string, key: string): string | null {
  const target: any = findNode(root, nodeId);
  if (!target) return null;
  if (target.kind === "component") {
    const prop = target.children.find((c: any) => c.kind === "property" && c.key === key);
    return prop ? prop.value : null;
  }
  if (target.kind === "property") return target.value;
  return null;
}

export const useThemeStore = create<ThemeState>()(
  temporal(
    (set, get) => ({
      text: "",
      version: 0,
      source: "import",
      lastFormEdit: null,
      resources: new Map(),
      themeName: "custom-theme",
      loadSample: (text) => set({ text, version: get().version + 1, source: "import", lastFormEdit: null, themeName: defaultThemeName(text, "sample-theme.txt") }),
      importFile: (fileName, text) =>
        set({
          text,
          version: get().version + 1,
          source: "import",
          lastFormEdit: null,
          resources: new Map(),
          themeName: defaultThemeName(text, fileName),
        }),
      setThemeName: (themeName) => set({ themeName: slugify(themeName) || get().themeName }),
      applyMonacoText: (text) =>
        set({ text, version: get().version + 1, source: "monaco", lastFormEdit: null }),
      applyFormPatch: (nodeId, key, value) => {
        const root = parseTheme(get().text);
        const cur = currentValue(root, nodeId, key);
        if (cur === null) return "skipped-missing";
        if (valuesEqual(cur, value)) return "skipped-equal";
        const dirty = applyPatch(root, { nodeId, key, value, op: "set", source: "form" });
        if (dirty.size === 0) return "skipped-missing";
        const out = serializeTheme(root, dirty);
        const version = get().version + 1;
        set({
          text: out,
          version,
          source: "form",
          lastFormEdit: { nodeId, key, version },
        });
        return "applied";
      },
      consumeFormEdit: () => set({ lastFormEdit: null }),
      markHistorySync: () => {
        // Paused: this marker set must NOT become a history entry (else redo dies).
        const t = (useThemeStore as any).temporal.getState();
        t.pause();
        set({ source: "history", lastFormEdit: null });
        t.resume();
      },
    }),
    {
      limit: 50,
      // True text-snapshot history (V3 方案A): only text+version are tracked.
      // source/lastFormEdit are UI sync markers, never history.
      partialize: (s: ThemeState) => ({ text: s.text, version: s.version }) as ThemeState,
    }
  )
);

// Derived selectors (pure, memoized at call site with useMemo on text).
export function selectCst(text: string): CSTRoot {
  return parseTheme(text);
}

export function selectSemantic(cst: CSTRoot): SemanticIndex {
  return deriveSemantic(cst);
}
