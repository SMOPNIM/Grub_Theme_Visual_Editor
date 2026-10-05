import React from "react";
import { createRoot } from "react-dom/client";
import { useThemeStore } from "./store/themeStore.js";
import { SourcePane } from "./components/SourcePane.js";
import { AttrForm } from "./components/AttrForm.js";
import { PreviewPane } from "./components/PreviewPane.js";
import { mockAdapter, tela1080 } from "./platform/mockAdapter.js";

function Toolbar() {
  const source = useThemeStore((s) => s.source);
  const version = useThemeStore((s) => s.version);
  const loadSample = useThemeStore((s) => s.loadSample);
  const undo = () => (useThemeStore as any).temporal.getState().undo();
  const redo = () => (useThemeStore as any).temporal.getState().redo();
  return (
    <div style={{ display: "flex", gap: 8, padding: 8 }}>
      <button onClick={() => loadSample(tela1080)}>Load tela-1080p</button>
      <button onClick={() => mockAdapter.openThemeFile().then((f) => loadSample(new TextDecoder().decode(f.data)))}>
        Open (mock)
      </button>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
      <span>v{version} · {source} · adapter: mock (real after CI green)</span>
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
