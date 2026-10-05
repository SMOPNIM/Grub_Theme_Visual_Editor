import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>GrubThemeEditor — Spike empty window</h1>
      <p>Gate1: web + tauri dev/build smoke. Canvas/DPR forced 1.0 in preview renderer.</p>
      <canvas id="spike-preview" width={1024} height={768} style={{ border: "1px solid #888", width: 512 }} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
