// Hand-written recursive-descent parser preserving trivia/raw/range/nodeId.
// Grammar (spike subset, unknown-tolerant):
//   file      := line*  (eol detected from first line ending)
//   line      := blank | comment | componentOpen | componentClose | property
//   property  := key (':' | '=') value [comment]
//   component := '+' name '{' ... '}'  (may nest)

import { CSTRoot, CSTNode, PropertyNode, ComponentNode, Range, Sep, nextNodeId, resetNodeIds } from "./cst.js";

interface LineInfo {
  text: string; // without eol
  eol: string;
  startOffset: number;
}

function splitLines(src: string): { lines: LineInfo[]; eol: "\n" | "\r\n" } {
  const lines: LineInfo[] = [];
  let eol: "\n" | "\r\n" = "\n";
  let first = true;
  let offset = 0;
  const re = /(.*?)(\r\n|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[0] === "" && m.index >= src.length) break;
    const text = m[1];
    let ending = m[2];
    if (ending === "" && m.index + m[0].length < src.length) ending = "";
    if (first && (ending === "\r\n" || ending === "\n")) {
      eol = ending as "\n" | "\r\n";
      first = false;
    }
    lines.push({ text, eol: ending, startOffset: offset });
    offset += m[0].length;
    if (m[0] === "") break;
    if (re.lastIndex >= src.length) {
      // trailing position handled; loop guard
      if (src.endsWith("\n")) break;
    }
  }
  return { lines, eol };
}

function posOf(lineNo: number, col: number, lineStart: number): { line: number; col: number; offset: number } {
  return { line: lineNo, col, offset: lineStart + col - 1 };
}

export function parseTheme(src: string): CSTRoot {
  resetNodeIds();
  const bom = src.startsWith("﻿");
  if (bom) src = src.slice(1);
  const { lines, eol } = splitLines(src);
  const root: CSTRoot = { nodeId: nextNodeId(), children: [], eol, bom };
  const stack: { node: ComponentNode; children: CSTNode[] }[] = [];

  const push = (n: CSTNode) => {
    if (stack.length > 0) stack[stack.length - 1].children.push(n);
    else root.children.push(n);
  };

  lines.forEach((li, idx) => {
    const lineNo = idx + 1;
    const { text } = li;
    const startOffset = li.startOffset;
    const fullLen = text.length + li.eol.length;
    const range: Range = {
      start: posOf(lineNo, 1, startOffset),
      end: posOf(lineNo, text.length + 1, startOffset),
    };
    const raw = text + li.eol;
    const trimmed = text.trim();

    if (trimmed === "") {
      push({ nodeId: nextNodeId(), kind: "blank", range, raw, leadingTrivia: "" });
      return;
    }
    if (trimmed.startsWith("#")) {
      push({ nodeId: nextNodeId(), kind: "comment", range, raw, leadingTrivia: "" });
      return;
    }
    // component open: + name {  (spacing variants accepted, e.g. +component{)
    const open = trimmed.match(/^\+\s*([A-Za-z_][\w-]*)\s*\{\s*(#.*)?$/);
    if (open) {
      const node: ComponentNode = {
        nodeId: nextNodeId(), kind: "component", range, raw,
        leadingTrivia: "", name: open[1],
        trailingComment: open[2] ?? "", children: [], singleLine: false,
      };
      push(node);
      stack.push({ node, children: node.children });
      return;
    }
    // single-line component: + name { k = v ... }  (e.g. hbox inline labels)
    // Parsed into children for semantic extraction; replayed verbatim (passthrough).
    const single = trimmed.match(/^\+\s*([A-Za-z_][\w-]*)\s*\{(.*)\}\s*(#.*)?$/);
    if (single) {
      const node: ComponentNode = {
        nodeId: nextNodeId(), kind: "component", range, raw,
        leadingTrivia: "", name: single[1],
        trailingComment: single[3] ?? "", children: [], singleLine: true,
      };
      const inner = single[2];
      const re = /([A-Za-z_][\w-]*)\s*([:=])\s*("[^"]*"|'[^']*'|\S+)/g;
      let pm: RegExpExecArray | null;
      while ((pm = re.exec(inner)) !== null) {
        let value = pm[3];
        let quote: '"' | "'" | null = null;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          quote = value.startsWith('"') ? '"' : "'";
          value = value.slice(1, -1);
        }
        node.children.push({
          nodeId: nextNodeId(), kind: "property", range, raw: "",
          leadingTrivia: " ", key: pm[1], sep: pm[2] as Sep,
          value, quote, trailingComment: "",
        });
      }
      push(node);
      return;
    }
    // bare two-line open: "+ name" followed by "{" on the next non-blank line
    // (e.g. archlinux circular_progress). Brace line becomes first unknown child
    // so byte-identity holds; semantic nesting stays correct.
    const bare = trimmed.match(/^\+\s*([A-Za-z_][\w-]*)\s*(#.*)?$/);
    if (bare) {
      let j = idx + 1;
      while (j < lines.length && lines[j].text.trim() === "") j++;
      if (j < lines.length && lines[j].text.trim().match(/^\{\s*(#.*)?$/)) {
        const node: ComponentNode = {
          nodeId: nextNodeId(), kind: "component", range, raw,
          leadingTrivia: "", name: bare[1],
          trailingComment: bare[2] ?? "", children: [], singleLine: false,
        };
        push(node);
        stack.push({ node, children: node.children });
        return;
      }
    }
    if (trimmed === "{" || trimmed.match(/^\{\s*(#.*)?$/)) {
      // lone brace: belongs to a bare two-line open above (or stray); keep raw.
      push({ nodeId: nextNodeId(), kind: "unknown" as const, range, raw, leadingTrivia: "" });
      return;
    }
    if (trimmed === "}" || trimmed.match(/^\}\s*(#.*)?$/)) {
      // close marker stored as unknown trivia inside parent, then pop
      const mClose = trimmed.match(/^\}(.*)$/);
      const closeNode = { nodeId: nextNodeId(), kind: "unknown" as const, range, raw, leadingTrivia: "" };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(closeNode);
        stack.pop();
      } else {
        root.children.push(closeNode);
      }
      void mClose;
      return;
    }
    // property: key : value  or key = value
    const prop = text.match(/^(\s*)([A-Za-z_][\w-]*)\s*([:=])\s*(.*?)(\s*(#.*))?$/);
    if (prop) {
      const [, indent, key, sepRaw, rest, , trailing] = prop;
      let value = rest ?? "";
      let quote: '"' | "'" | null = null;
      const qm = value.match(/^("([^"]*)"|'([^']*)')$/);
      if (qm) {
        quote = value.startsWith('"') ? '"' : "'";
        value = qm[2] ?? qm[3] ?? "";
      }
      const node: PropertyNode = {
        nodeId: nextNodeId(), kind: "property", range, raw,
        leadingTrivia: indent, key, sep: sepRaw as Sep,
        value, quote, trailingComment: (trailing ?? "").trim(),
      };
      push(node);
      return;
    }
    push({ nodeId: nextNodeId(), kind: "unknown", range, raw, leadingTrivia: "" });
  });

  return root;
}
