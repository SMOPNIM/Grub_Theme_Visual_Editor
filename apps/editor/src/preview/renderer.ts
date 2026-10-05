// Canvas preview renderer (spike): geometry-exact boxes + recognizable GRUB mock.
// Zero-dep Canvas2D. Text uses system fallback fonts (Gate3 soft-gate); layout and
// colors are exact. Resource images (.png/.pf2) are placeholders until V1.1.
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
  sem.labels.forEach((l) => {
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

function css(color: string | undefined | null, fallback: string): string {
  if (!color) return fallback;
  const rgb = normalizeColor(color);
  return rgb ? `rgb(${rgb.join(",")})` : fallback;
}

/** Trailing point size in a GRUB font spec ("DejaVu Sans Regular 16" -> 16). */
export function fontSizeOf(font: string | undefined, fallback: number): number {
  const m = (font ?? "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : fallback;
}

const MOCK_ENTRIES = ["Ubuntu", "Advanced options for Ubuntu", "Windows Boot Manager"];

export function drawPreview(canvas: HTMLCanvasElement, sem: SemanticIndex, bg: string | null): void {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = css(bg, "#111111");
  ctx.fillRect(0, 0, W, H);

  // Boot menu panel + mock entries (second entry highlighted, GRUB-style).
  if (sem.bootMenu) {
    const b = sem.bootMenu;
    const bx = toPx(b.left, W, 0), by = toPx(b.top, H, 0);
    const bw = toPx(b.width, W, W), bh = toPx(b.height, H, H);
    const sel = css(b.selected_item_color, "#ffffff");
    const item = css(b.item_color, "#cccccc");
    ctx.strokeStyle = sel;
    ctx.strokeRect(bx, by, bw, bh);
    const rowH = Math.max(18, toPx(b.item_height, H, 36));
    const gap = Math.max(2, toPx(b.item_spacing, H, 10));
    const fs = Math.min(32, Math.max(10, Math.round(rowH * 0.45)));
    ctx.font = `${fs}px sans-serif`;
    ctx.textBaseline = "middle";
    MOCK_ENTRIES.forEach((entry, i) => {
      const y = by + 8 + i * (rowH + gap);
      if (y + rowH > by + bh) return;
      if (i === 1) {
        ctx.fillStyle = sel;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(bx + 2, y, bw - 4, rowH);
        ctx.globalAlpha = 1;
        ctx.fillStyle = sel;
      } else {
        ctx.fillStyle = item;
      }
      ctx.fillText(entry, bx + 12, y + rowH / 2, bw - 24);
    });
  }

  // Labels as real text (aligned), not bars.
  for (const l of sem.labels) {
    const x = toPx(l.left, W, 0), y = toPx(l.top, H, 0);
    const w = toPx(l.width, W, 200), h = toPx(l.height, H, 30);
    const fs = Math.min(48, Math.max(9, Math.round(fontSizeOf(l.font, 16) * Math.min(W / 1024, 1.5))));
    ctx.font = `${fs}px sans-serif`;
    ctx.fillStyle = css(l.color, "#ffffff");
    ctx.textBaseline = "middle";
    ctx.textAlign = l.align === "right" ? "right" : l.align === "center" ? "center" : "left";
    const tx = ctx.textAlign === "right" ? x + w : ctx.textAlign === "center" ? x + w / 2 : x;
    const labelText = (l.text ?? "").replace(/%d/g, "5").replace(/@[^@]*@/g, "").trim() || "(label)";
    ctx.fillText(labelText, tx, y + h / 2, w);
    ctx.textAlign = "left";
  }

  // Images: dashed placeholder + file name (asset loading deferred to V1.1).
  for (const im of sem.images) {
    const x = toPx(im.left, W, 0), y = toPx(im.top, H, 0);
    const w = toPx(im.width, W, 100), h = toPx(im.height, H, 100);
    ctx.strokeStyle = "#888888";
    ctx.setLineDash?.([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash?.([]);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(im.file ?? "(image)", x + 4, y + 14, Math.max(0, w - 8));
  }

  // Progress bars: track + 35% fill + border.
  for (const p of sem.progressbars) {
    const x = toPx(p.left, W, 0), y = toPx(p.top, H, 0);
    const w = toPx(p.width, W, 200), h = toPx(p.height, H, 20);
    ctx.fillStyle = css(p.bg_color, "#333333");
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = css(p.fg_color, "#ffffff");
    ctx.fillRect(x, y, w * 0.35, h);
    ctx.strokeStyle = css(p.fg_color, "#ffffff");
    ctx.strokeRect(x, y, w, h);
  }
}
