import { SailPoint } from '../model/types.js';
import { X_MIN, X_MAX, Y_MIN, Y_MAX } from '../model/SailStore.js';

export interface ChartRect { x: number; y: number; w: number; h: number; }

// ── CoordinateSystem ──────────────────────────────────────────────────────────
export class CoordinateSystem {
  readonly pad = { l: 54, r: 42, t: 32, b: 46 };
  W = 800;
  H = 600;

  resize(w: number, h: number): void { this.W = w; this.H = h; }

  toPixel(dx: number, dy: number): [number, number] {
    const { l, r, t, b } = this.pad;
    return [
      l + (dx - X_MIN) / (X_MAX - X_MIN) * (this.W - l - r),
      this.H - b - (dy - Y_MIN) / (Y_MAX - Y_MIN) * (this.H - t - b),
    ];
  }

  fromPixel(px: number, py: number): [number, number] {
    const { l, r, t, b } = this.pad;
    return [
      X_MIN + (px - l) / (this.W - l - r) * (X_MAX - X_MIN),
      Y_MIN + (this.H - b - py) / (this.H - t - b) * (Y_MAX - Y_MIN),
    ];
  }

  clamp(x: number, y: number): [number, number] {
    return [
      Math.max(X_MIN, Math.min(X_MAX, x)),
      Math.max(Y_MIN, Math.min(Y_MAX, y)),
    ];
  }

  get chartRect(): ChartRect {
    const { l, r, t, b } = this.pad;
    return { x: l, y: t, w: this.W - l - r, h: this.H - t - b };
  }

  isInBounds(twa: number, tws: number): boolean {
    return twa >= X_MIN && twa <= X_MAX && tws >= Y_MIN && tws <= Y_MAX;
  }
}

// ── Shared Catmull-Rom closed spline helper ────────────────────────────────────
export function splinePath(
  ctx: CanvasRenderingContext2D,
  pts: SailPoint[],
  coords: CoordinateSystem,
): void {
  if (pts.length < 2) return;
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const [x0, y0] = coords.toPixel(p0.x, p0.y);
    const [x1, y1] = coords.toPixel(p1.x, p1.y);
    const [x2, y2] = coords.toPixel(p2.x, p2.y);
    const [x3, y3] = coords.toPixel(p3.x, p3.y);
    if (i === 0) ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(
      x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6,
      x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6,
      x2, y2,
    );
  }
  ctx.closePath();
}
