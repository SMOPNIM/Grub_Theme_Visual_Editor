// Preview pane: DPR locked to 1.0 (Gate3), redrawn from semantic on every version.
import { useEffect, useMemo, useRef, useState } from "react";
import { useThemeStore, selectCst, selectSemantic } from "../store/themeStore.js";
import { setupCanvas, drawPreview } from "../preview/renderer.js";

export function PreviewPane() {
  const text = useThemeStore((s) => s.text);
  const [res, setRes] = useState<"1024x768" | "1920x1080">("1024x768");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sem = useMemo(() => selectSemantic(selectCst(text)), [text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [w, h] = res.split("x").map(Number);
    setupCanvas(canvas, w, h); // DPR 1.0 forced
    drawPreview(canvas, sem, sem.globals["desktop-color"]?.value ?? "#111111");
  }, [sem, res]);

  return (
    <div>
      <select value={res} onChange={(e) => setRes(e.target.value as typeof res)}>
        <option value="1024x768">1024x768</option>
        <option value="1920x1080">1920x1080</option>
      </select>
      <canvas ref={canvasRef} style={{ width: "100%", border: "1px solid #888" }} />
    </div>
  );
}
