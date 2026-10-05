// CST types — Spike V3 contract §1
// UI never touches CST nodes directly; only via updateProperty -> CSTPatch.

export interface Position {
  line: number; // 1-based
  col: number; // 1-based
  offset: number; // 0-based
}

export interface Range {
  start: Position;
  end: Position;
}

export type Sep = ":" | "=";

export type CSTNodeKind = "root" | "property" | "component" | "comment" | "blank" | "unknown";

export interface CSTBase {
  nodeId: string;
  kind: CSTNodeKind;
  range: Range;
  /** Original source slice for unknown/unmodified round-trip. */
  raw: string;
  leadingTrivia: string; // comments/blank lines/indent before node
}

export interface PropertyNode extends CSTBase {
  kind: "property";
  key: string;
  sep: Sep;
  value: string; // unquoted inner value
  quote: '"' | "'" | null;
  trailingComment: string;
}

export interface ComponentNode extends CSTBase {
  kind: "component";
  name: string;
  trailingComment: string;
  children: CSTNode[];
  /** Single-line `+ label { k = v ... }`: replay raw verbatim unless a child is dirty. */
  singleLine: boolean;
}

export interface TriviaNode extends CSTBase {
  kind: "comment" | "blank" | "unknown";
}

export type CSTNode = PropertyNode | ComponentNode | TriviaNode;

export interface CSTRoot {
  nodeId: string;
  children: CSTNode[];
  eol: "\n" | "\r\n";
  /** Preserved UTF-8 BOM ("\uFEFF") if present; re-emitted on serialize. */
  bom: boolean;
}

export type PatchOp = "set" | "insert" | "remove";
export type PatchSource = "monaco" | "form" | "import";

export interface CSTPatch {
  nodeId: string;
  key: string;
  value: string;
  op: PatchOp;
  source: PatchSource;
}

let counter = 0;
export function nextNodeId(): string {
  counter += 1;
  return `n${counter}`;
}
export function resetNodeIds(): void {
  counter = 0;
}
