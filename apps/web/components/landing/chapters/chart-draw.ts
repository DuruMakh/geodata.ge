// Small canvas drawing primitives shared by the chapter charts, ported from the design board
// (txt, halo, hline, vline, dot, bar, hbar), and the easings of every chapter chart. They draw in CSS
// pixels on a context from `sizeCanvas`.

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
  baseline: CanvasTextBaseline = "alphabetic",
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
}

/** Text with a 4 px outline in `halo` colour so it stays readable over marks. */
export function haloTxt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  halo: string,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = halo;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Horizontal line, snapped to the pixel grid so 1 px lines stay crisp. */
export function hline(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, width = 1, dash?: number[]): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  const yy = Math.round(y) + (width % 2 ? 0.5 : 0);
  ctx.beginPath();
  ctx.moveTo(x0, yy);
  ctx.lineTo(x1, yy);
  ctx.stroke();
  ctx.restore();
}

export function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string, width = 1, dash?: number[]): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  const xx = Math.round(x) + (width % 2 ? 0.5 : 0);
  ctx.beginPath();
  ctx.moveTo(xx, y0);
  ctx.lineTo(xx, y1);
  ctx.stroke();
  ctx.restore();
}

/** Filled circle of radius `r`, with a `ring` of 2 px around it when given. */
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring?: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r + (ring ? 2 : 0), 0, Math.PI * 2);
  if (ring) {
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Filled bar whose `end` ("top" or "bottom") has corners rounded to radius `r`; the other end is square. */
export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, end: "top" | "bottom"): void {
  if (w <= 0 || h <= 0) return;
  const rad = Math.max(0, Math.min(r, w / 2, h));
  ctx.beginPath();
  if (!rad) ctx.rect(x, y, w, h);
  else if (end === "top") {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.closePath();
  }
  ctx.fill();
}

/** Horizontal bar whose `end` ("left" or "right") has corners rounded to radius `r`; the other end is square. */
export function hbar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, end: "left" | "right"): void {
  if (w <= 0 || h <= 0) return;
  const rad = Math.max(0, Math.min(r, h / 2, w));
  ctx.beginPath();
  if (!rad) ctx.rect(x, y, w, h);
  else if (end === "right") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + rad, y);
    ctx.arcTo(x, y, x, y + rad, rad);
    ctx.lineTo(x, y + h - rad);
    ctx.arcTo(x, y + h, x + rad, y + h, rad);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }
  ctx.fill();
}
