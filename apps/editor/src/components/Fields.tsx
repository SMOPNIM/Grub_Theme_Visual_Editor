// PR4 field components: color (swatch + free text + format-change hint) and
// font (name + size split inputs). All submits go through the store's
// equality/short-circuit rules; hints are local and cleared on version change.
import { useEffect, useState } from "react";
import { normalizeColor, splitFont, joinFont, isValidFontSize } from "@grub-theme/core";
import { useThemeStore } from "../store/themeStore.js";

function toHex6(color: string | undefined): string {
  const rgb = color ? normalizeColor(color) : null;
  if (!rgb) return "#ffffff";
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

export function ColorField(props: { nodeId: string; propKey: string; label: string; path: string; current: string }) {
  const { nodeId, propKey, label, path, current } = props;
  const applyColorPatch = useThemeStore((s) => s.applyColorPatch);
  const version = useThemeStore((s) => s.version);
  const [text, setText] = useState(current);
  const [note, setNote] = useState<{ text: string; tone: "red" | "amber" } | null>(null);
  useEffect(() => {
    setText(current);
    setNote(null);
  }, [version, current]);

  const submit = () => {
    const r = applyColorPatch(nodeId, propKey, text);
    if (r.status === "invalid") {
      setNote({ text: r.detail ?? "颜色不可识别", tone: "red" });
      setText(current);
    } else if (r.status === "skipped-equal") {
      setText(current);
      setNote(null);
    } else if (r.status === "applied") {
      setNote(r.formatChanged ? { text: `格式变更：${r.detail}`, tone: "amber" } : null);
    }
  };

  return (
    <div>
      <label>{label} <small>{path}</small></label>
      <div style={{ display: "flex", gap: 4 }}>
        <input type="color" value={toHex6(current)} onChange={(e) => setText(e.target.value)} onBlur={submit} aria-label={`${label} picker`} />
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={submit} style={{ flex: 1 }} />
      </div>
      {note && <span style={{ color: note.tone === "red" ? "red" : "#856404" }}>{note.text}</span>}
    </div>
  );
}

export function FontField(props: { nodeId: string; fontKey: string; label: string; path: string; current: string }) {
  const { nodeId, fontKey, label, path, current } = props;
  const applyFormPatch = useThemeStore((s) => s.applyFormPatch);
  const version = useThemeStore((s) => s.version);
  const parts = splitFont(current);
  const [name, setName] = useState(parts.name);
  const [size, setSize] = useState(parts.size);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const p = splitFont(current);
    setName(p.name);
    setSize(p.size);
    setHint(null);
  }, [version, current]);

  const submit = () => {
    if (!isValidFontSize(size)) {
      setHint(`字号 "${size}" 非法，应为纯数字。`);
      return;
    }
    const value = joinFont(name, size);
    if (value === current) return;
    const result = value === "" ? "skipped-equal" : applyFormPatch(nodeId, fontKey, value);
    if (result === "applied") {
      const hasPf2 = [...useThemeStore.getState().resources.keys()].some((k) =>
        k.toLowerCase().endsWith(".pf2")
      );
      if (!hasPf2) {
        const msg = `字体 "${value}" 无对应 .pf2 已加载，导出将缺字体资源。`;
        console.warn(`[font-scan] ${msg}`);
        setHint(msg);
      } else {
        setHint(null);
      }
    } else if (result === "skipped-equal") {
      const p = splitFont(current);
      setName(p.name);
      setSize(p.size);
      setHint(null);
    }
  };

  return (
    <div>
      <label>{label} <small>{path}</small></label>
      <div style={{ display: "flex", gap: 4 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={submit} placeholder="字体名" style={{ flex: 3 }} />
        <input value={size} onChange={(e) => setSize(e.target.value)} onBlur={submit} placeholder="字号" style={{ flex: 1 }} />
      </div>
      {hint && <p style={{ color: "red" }}>{hint}</p>}
    </div>
  );
}
