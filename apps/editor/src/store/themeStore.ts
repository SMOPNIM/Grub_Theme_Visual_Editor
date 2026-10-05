// UI-1 store: text is the ONLY persisted state (Spike 方案A).
// CST/semantic are derived on demand via selectors — history stays text-only,
// so zundo never stores trees and Monaco undo never double-counts.
import { create } from "zustand";
import { temporal } from "zundo";
import { parseTheme, serializeTheme, applyPatch } from "@grub-theme/core";
import type { CSTRoot, SemanticIndex } from "@grub-theme/core";
import { deriveSemantic } from "@grub-theme/core";

export type EditSource = "monaco" | "form" | "import";

export interface FormEditSync {
  nodeId: string;
  key: string;
  /** 1-based line of the edited property (pre-edit == post-edit for scalar sets). */
  line: number;
  /** Replacement full-line text (without EOL). */
  newLineText: string;
}

interface ThemeState {
  text: string;
  version: number;
  source: EditSource;
  lastFormEdit: FormEditSync | null;
  loadSample: (text: string) => void;
  applyMonacoText: (text: string) => void;
  applyFormPatch: (nodeId: string, key: string, value: string) => void;
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

export const useThemeStore = create<ThemeState>()(
  temporal(
    (set, get) => ({
      text: "",
      version: 0,
      source: "import",
      lastFormEdit: null,
      loadSample: (text) => set({ text, version: get().version + 1, source: "import", lastFormEdit: null }),
      applyMonacoText: (text) =>
        set({ text, version: get().version + 1, source: "monaco", lastFormEdit: null }),
      applyFormPatch: (nodeId, key, value) => {
        const root = parseTheme(get().text);
        const dirty = applyPatch(root, { nodeId, key, value, op: "set", source: "form" });
        if (dirty.size === 0) return;
        const out = serializeTheme(root, dirty);
        // Locate edited property node for Monaco executeEdits sync.
        let line = 0;
        for (const id of dirty) {
          const n = findNode(root, id);
          if (n?.range) {
            line = n.range.start.line;
            break;
          }
        }
        const newLineText = line > 0 ? out.split(/\r?\n/)[line - 1] : "";
        set({
          text: out,
          version: get().version + 1,
          source: "form",
          lastFormEdit: line > 0 ? { nodeId, key, line, newLineText } : null,
        });
      },
    }),
    { limit: 50 }
  )
);

// Derived selectors (pure, memoized at call site with useMemo on text).
export function selectCst(text: string): CSTRoot {
  return parseTheme(text);
}

export function selectSemantic(cst: CSTRoot): SemanticIndex {
  return deriveSemantic(cst);
}
