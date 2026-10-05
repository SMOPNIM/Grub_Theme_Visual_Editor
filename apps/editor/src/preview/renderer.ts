// Canvas geometry renderer (spike): geometric bbox only, text diff explainable.
import { toPx, normalizeColor } from "@grub-theme/core";
import type { SemanticIndex } from "@grub-theme/core";

export interface GeomBox { x: number; y: number; w: number; h: number; color: string | null }

export function computeGeometry(sem: SemanticIndex, W: number, H: number): Record<string, GeomBox> {
  const out: Record<string, GeomBox> = {};
  if (sem.bootMenu) {
    const b = sem.bootMenu;
    out.boot_menu = {
      x: toPx(b.left, W, 0), y: toPx(b.top, H, 0),
      w: toPx(b.width, W, W), h: toPx(b.height, H, H),
      color: b.selected_item_color ?? null,
    };
  }
  sem.labels.forEach((l, i) => {
    out[`label:${l.nodeId}`] = { x: toPx(l.left, W, 0), y: toPx(l.top, H, 0), w: toPx(l.width, W, 200), h: toPx(l.height, H, 30), color: l.color ?? null };
  });
  sem.images.forEach((im) => {
    out[`image:${im.nodeId}`] = { x: toPx(im.left, W, 0), y: toPx(im.top, H, 0), w: toPx(im.width, W, 100), h: toPx(im.height, H, 100), color: null };
  });
  sem.progressbars.forEach((p) => {
    out[`progress:${p.nodeId}`] = { x: toPx(p.left, W, 0), y: toPx(p.top, H, 0), w: toPx(p.width, W, 200), h: toPx(p.height, H, 20), color: p.fg_color ?? null };
  });
  return out;
}

/** Spike Gate3: force devicePixelRatio 1.0 so 1024x768/1920x1080 bboxes are exact.
 *  Never use CSS-scaled backing store in Spike measurements. */
export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): void {
  canvas.width = w;
  canvas.height = h;
  canvas.style.aspectRatio = `${w} / ${h}`;
}

/** Text soft-gate (Gate3, horizontal only): fallback-font text is NOT in the ≤2px
 *  budget. Only assert horizontal-center drift ≤ 5% of item width; vertical is
 *  excluded (fallback line-height error is larger and is "explainable"). */
export function textCenterDriftPx(boxW: number): number {
  return boxW * 0.05;
}

export function drawPreview(canvas: HTMLCanvasElement, sem: SemanticIndex, bg: string | null): void {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = bg ?? "#111";
  ctx.fillRect(0, 0, W, H);
  const g = computeGeometry(sem, W, H);
  for (const [k, b] of Object.entries(g)) {
    if (k.startsWith("label")) {
      const rgb = b.color ? normalizeColor(b.color) : null;
      ctx.fillStyle = rgb ? `rgb(${rgb.join(",")})` : "#fff";
      ctx.fillRect(b.x, b.y, b.w, 4);
    } else {
      const rgb = b.color ? normalizeColor(b.color) : null;
      ctx.strokeStyle = rgb ? `rgb(${rgb.join(",")})` : "#888";
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
}
