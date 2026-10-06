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

export function removeNode(root: CSTRoot, nodeId: string): boolean {
  const walk = (nodes: any[]): boolean => {
    for (let k = 0; k < nodes.length; k++) {
      if ((nodes[k] as any).nodeId === nodeId) {
        nodes.splice(k, 1);
        return true;
      }
      if (nodes[k].kind === "component" && walk(nodes[k].children)) return true;
    }
    return false;
  };
  return walk(root.children);
}

/** Apply patch to CST in place; returns dirty nodeIds for serializer.
 *  - set: rewrite the property value (separator gaps preserved by serializer).
 *  - remove: splice the property node out (empty field = GRUB default, PR3 rule).
 *    Removal is structural: the node vanishes, so no dirty id is needed.
 *  - insert: not supported (missing attr stays missing; PR4 decides).
 */
export function applyPatch(root: CSTRoot, patch: CSTPatch): Set<string> {
  const dirty = new Set<string>();
  if (patch.op === "remove") {
    // Straightforward walk: component member first, then property node itself.
    const target: any = findComponentNode(root, patch.nodeId);
    if (target?.kind === "component") {
      const idx = target.children.findIndex((c: any) => c.kind === "property" && c.key === patch.key);
      if (idx >= 0) target.children.splice(idx, 1);
    } else if (target?.kind === "property") {
      removeNode(root, target.nodeId);
    } else {
      // globals at root: match by key.
      const walk = (nodes: any[]): boolean => {
        for (let k = 0; k < nodes.length; k++) {
          const n = nodes[k];
          if (n.kind === "property" && n.key === patch.key) {
            nodes.splice(k, 1);
            return true;
          }
          if (n.kind === "component" && walk(n.children)) return true;
        }
        return false;
      };
      walk(root.children);
    }
    return dirty;
  }
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
