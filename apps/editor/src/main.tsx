import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useThemeStore } from "./store/themeStore.js";
import { SourcePane } from "./components/SourcePane.js";
import { AttrForm } from "./components/AttrForm.js";
import { PreviewPane } from "./components/PreviewPane.js";
import { buildExportZip, downloadBlob } from "./export/exporter.js";
import { mockAdapter, tela1080 } from "./platform/mockAdapter.js";

function Toolbar() {
  const source = useThemeStore((s) => s.source);
  const version = useThemeStore((s) => s.version);
  const themeName = useThemeStore((s) => s.themeName);
  const resources = useThemeStore((s) => s.resources);
  const loadSample = useThemeStore((s) => s.loadSample);
  const importFile = useThemeStore((s) => s.importFile);
  const setThemeName = useThemeStore((s) => s.setThemeName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const undo = () => {
    (useThemeStore as any).temporal.getState().undo();
    useThemeStore.getState().markHistorySync();
  };
  const redo = () => {
    (useThemeStore as any).temporal.getState().redo();
    useThemeStore.getState().markHistorySync();
  };

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    importFile(f.name, await f.text());
    setExportNote(null);
  };

  const onExport = async () => {
    const st = useThemeStore.getState();
    const { blob, files, missing } = await buildExportZip(st.text, st.resources, st.themeName);
    downloadBlob(blob, `${st.themeName}.zip`);
    if (missing.length > 0) {
      console.warn(`[export] ${missing.length} unresolved ref(s), zip holds theme.txt only for them:`, missing);
      setExportNote(`导出缺 ${missing.length} 项资源（见 console）：${missing.slice(0, 3).join("；")}${missing.length > 3 ? "…" : ""}`);
    } else {
      setExportNote(`已导出 ${files.length} 个文件。`);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: 8, alignItems: "center" }}>
        <button onClick={() => loadSample(tela1080)}>Load tela-1080p</button>
        <button onClick={() => fileRef.current?.click()}>导入 theme.txt</button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          style={{ display: "none" }}
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
        <button onClick={() => mockAdapter.openThemeFile().then((f) => loadSample(new TextDecoder().decode(f.data)))}>
          Open (mock)
        </button>
        <label>主题名 <input value={themeName} onChange={(e) => setThemeName(e.target.value)} style={{ width: 160 }} /></label>
        <button onClick={() => void onExport()}>导出 zip</button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <span>v{version} · {source}</span>
      </div>
      {resources.size === 0 && (
        <div style={{ background: "#fff3cd", padding: "4px 8px" }}>
          资源未加载，导出仅含 theme.txt（背景/图标缺失）。Web 首版仅支持单文件导入。
        </div>
      )}
      {exportNote && <div style={{ background: "#f8d7da", padding: "4px 8px" }}>{exportNote}</div>}
    </div>
  );
}

function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Toolbar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1 }}><SourcePane /></div>
        <div style={{ width: 320, overflow: "auto", padding: 8 }}>
          <AttrForm />
          <PreviewPane />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
