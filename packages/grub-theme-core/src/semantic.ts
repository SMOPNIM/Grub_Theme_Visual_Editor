// SemanticIndex derived from CST (pure derive). UI reads this only.

import { CSTRoot, ComponentNode, PropertyNode } from "./cst.js";

export interface BoxProps {
  nodeId: string;
  /**
   * PATH CONTRACT (frozen for UI-1; do not change format without a migration):
   * `root.<component>[<siblingIndex>](.<component>[<siblingIndex>])*`
   * e.g. "root.boot_menu[0]", "root.hbox[0].label[1]".
   * Counters are per (parentPath, componentName); top-level globals are NOT in paths.
   * UI locates CST nodes via `path` + `nodeId`; never via positional `label[0]` guesses.
   */
  path: string;
  left?: string;
  top?: string;
  width?: string;
  height?: string;
}

export interface BootMenuSemantic extends BoxProps {
  item_color?: string;
  item_font?: string;
  selected_item_color?: string;
  item_height?: string;
  item_spacing?: string;
}

export interface LabelSemantic extends BoxProps {
  nodeId: string;
  text?: string;
  color?: string;
  font?: string;
  align?: string;
}

export interface ImageSemantic extends BoxProps {
  file?: string;
}

export interface ProgressSemantic extends BoxProps {
  id?: string;
  fg_color?: string;
  bg_color?: string;
}

export interface SemanticIndex {
  globals: Record<string, { nodeId: string; value: string }>;
  bootMenu: BootMenuSemantic | null;
  labels: LabelSemantic[];
  images: ImageSemantic[];
  progressbars: ProgressSemantic[];
}

function propsOf(c: ComponentNode): Record<string, PropertyNode> {
  const m: Record<string, PropertyNode> = {};
  for (const ch of c.children) if (ch.kind === "property") m[ch.key] = ch;
  return m;
}

function box(nodeId: string, path: string, p: Record<string, PropertyNode>): BoxProps {
  return {
    nodeId, path,
    left: p["left"]?.value, top: p["top"]?.value,
    width: p["width"]?.value, height: p["height"]?.value,
  };
}

export function deriveSemantic(root: CSTRoot): SemanticIndex {
  const globals: SemanticIndex["globals"] = {};
  const labels: LabelSemantic[] = [];
  const images: ImageSemantic[] = [];
  const progressbars: ProgressSemantic[] = [];
  let bootMenu: BootMenuSemantic | null = null;

  // Recursive: hbox/vbox nesting is extracted, not skipped. Counters per
  // (parentPath, name) yield stable paths like root.hbox[0].label[1].
  const visit = (nodes: typeof root.children, parentPath: string, counters: Record<string, number>) => {
    for (const n of nodes) {
      if (n.kind === "property") globals[n.key] = { nodeId: n.nodeId, value: n.value };
      else if (n.kind === "component") {
        const key = `${parentPath}.${n.name}`;
        const idx = counters[key] ?? 0;
        counters[key] = idx + 1;
        const path = `${parentPath}.${n.name}[${idx}]`;
        const p = propsOf(n);
        if (n.name === "boot_menu") {
          bootMenu = {
            ...box(n.nodeId, path, p),
            item_color: p["item_color"]?.value,
            item_font: p["item_font"]?.value,
            selected_item_color: p["selected_item_color"]?.value,
            item_height: p["item_height"]?.value,
            item_spacing: p["item_spacing"]?.value,
          };
        } else if (n.name === "label") {
          labels.push({ ...box(n.nodeId, path, p), nodeId: n.nodeId, path, text: p["text"]?.value, color: p["color"]?.value, font: p["font"]?.value, align: p["align"]?.value });
        } else if (n.name === "image") {
          images.push({ ...box(n.nodeId, path, p), path, file: p["file"]?.value });
        } else if (n.name === "progress_bar" || n.name === "circular_progress") {
          progressbars.push({ ...box(n.nodeId, path, p), path, id: p["id"]?.value, fg_color: p["fg_color"]?.value, bg_color: p["bg_color"]?.value });
        }
        visit(n.children, path, counters);
      }
    }
  };
  visit(root.children, "root", {});
  return { globals, bootMenu, labels, images, progressbars };
}

/** Required-asset scan (V3 §5): desktop-image, file=, icon_*, font */
export function scanMissingAssets(root: CSTRoot, availableFiles: Set<string>): string[] {
  const refs: string[] = [];
  const walk = (nodes: typeof root.children) => {
    for (const n of nodes) {
      if (n.kind === "property") {
        if (["desktop-image", "desktop_image", "file", "icon_dir", "item_icon"].includes(n.key) || n.key.endsWith("_font") || n.key === "font") {
          if (n.value && !availableFiles.has(n.value)) refs.push(`${n.key}: "${n.value}" (${n.nodeId})`);
        }
      } else if (n.kind === "component") walk(n.children);
    }
  };
  walk(root.children);
  return refs;
}
