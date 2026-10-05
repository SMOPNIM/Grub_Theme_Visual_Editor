// Serializer: unknown/unmodified nodes replay raw; modified property nodes rebuild
// preserving sep + trivia + quote style (V3 §3).

import { CSTRoot, CSTNode } from "./cst.js";

function lineEol(raw: string, fallback: string): string {
  // Per-line EOL: mixed CRLF/LF files must round-trip byte-identically (no root.eol normalization).
  return raw.endsWith("\r\n") ? "\r\n" : raw.endsWith("\n") ? "\n" : fallback;
}

function serializeNode(n: CSTNode, defaultEol: string, dirtyIds: Set<string>): string {
  if (n.kind === "property") {
    if (!dirtyIds.has(n.nodeId)) return n.raw;
    const eol = lineEol(n.raw, defaultEol);
    const q = n.quote ?? '"';
    const needsQuote = n.quote !== null || /[\s#]/.test(n.value) || n.value === "";
    const v = needsQuote ? `${q}${n.value}${q}` : n.value;
    const trail = n.trailingComment ? ` ${n.trailingComment}` : "";
    return `${n.leadingTrivia}${n.key}${n.preSep}${n.sep}${n.postSep}${v}${trail}${eol}`;
  }
  if (n.kind === "component") {
    if (n.singleLine && !dirtyIds.has(n.nodeId) && n.children.every((c) => !dirtyIds.has(c.nodeId))) {
      return n.raw; // passthrough: hbox inline labels etc.
    }
    // Open line: replay raw first line with its own EOL (mixed-EOL safe).
    const openRaw = n.raw;
    const openEol = lineEol(openRaw, defaultEol);
    let out = openRaw.split(/\r?\n/)[0] + openEol;
    for (const c of n.children) out += serializeNode(c, defaultEol, dirtyIds);
    return out;
  }
  return n.raw;
}

export function serializeTheme(root: CSTRoot, dirtyIds: Set<string> = new Set()): string {
  let out = root.bom ? "﻿" : "";
  for (const c of root.children) out += serializeNode(c, root.eol, dirtyIds);
  return out;
}

/** Byte-identity check gate A: serialize(parse(x)) === x */
export function isByteIdentical(original: string, serialized: string): boolean {
  return original === serialized;
}
