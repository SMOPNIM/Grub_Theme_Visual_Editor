// updateProperty: the ONLY write path UI may use (V3 §1).
import { CSTRoot, CSTPatch } from "./cst.js";

export function findPropertyNode(root: CSTRoot, nodeId: string, key: string) {
  let found: { node: any; parentChildren: any[] } | null = null;
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.kind === "property" && n.nodeId === nodeId && n.key === key) {
        found = { node: n, parentChildren: nodes };
        return;
      }
      if (n.kind === "component") walk(n.children);
    }
  };
  walk(root.children);
  return found;
}

export function findComponentNode(root: CSTRoot, nodeId: string): any | null {
  let found: any | null = null;
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if ((n.kind === "component" || n.kind === "property") && n.nodeId === nodeId) {
        found = n;
        return;
      }
      if (n.kind === "component") walk(n.children);
    }
  };
  walk(root.children);
  return found;
}

/** Apply patch to CST in place; returns dirty nodeIds for serializer. */
export function applyPatch(root: CSTRoot, patch: CSTPatch): Set<string> {
  const dirty = new Set<string>();
  if (patch.op === "set") {
    // patch.nodeId = component nodeId for component props, or property nodeId
    let target: any = findComponentNode(root, patch.nodeId);
    if (target?.kind === "component") {
      const prop = target.children.find((c: any) => c.kind === "property" && c.key === patch.key);
      if (prop) {
        prop.value = patch.value;
        dirty.add(prop.nodeId);
      }
    } else if (target?.kind === "property") {
      target.value = patch.value;
      dirty.add(target.nodeId);
    } else {
      // globals at root: match by key
      const walk = (nodes: any[]): boolean => {
        for (const n of nodes) {
          if (n.kind === "property" && n.key === patch.key) {
            n.value = patch.value;
            dirty.add(n.nodeId);
            return true;
          }
          if (n.kind === "component" && walk(n.children)) return true;
        }
        return false;
      };
      walk(root.children);
    }
  }
  return dirty;
}
