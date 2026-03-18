import { X_MIN, X_MAX, Y_MIN, Y_MAX } from '../model/SailStore.js';

export interface ChartRect { x: number; y: number; w: number; h: number; }

// ── CoordinateSystem ──────────────────────────────────────────────────────────
const BASE_PAD = { l: 54, r: 42, t: 32, b: 46 };

export class CoordinateSystem {
  pad = { ...BASE_PAD };
  W = 800;
  H = 600;

  /** Add `extra` CSS pixels of margin to every side (can be negative to shrink). */
  setMargin(extra: number): void {
    const m = Math.round(extra);
    this.pad = {
      l: Math.max(10, BASE_PAD.l + m),
      r: Math.max(10, BASE_PAD.r + m),
      t: Math.max(10, BASE_PAD.t + m),
      b: Math.max(10, BASE_PAD.b + m),
    };
  }

  // Axis range — mutable at runtime
  twaMin = X_MIN;
  twaMax = X_MAX;
  twsMin = Y_MIN;
  twsMax = Y_MAX;
  twsReversed = false; // when true: twsMax at bottom, twsMin at top
  legendWidth = 0;    // extra right space reserved for the legend panel

  resize(w: number, h: number): void { this.W = w; this.H = h; }

  toPixel(dx: number, dy: number): [number, number] {
    const { x: l, y: t, w: cw, h: ch } = this.chartRect;
    const t_frac = (dy - this.twsMin) / (this.twsMax - this.twsMin);
    return [
      l + (dx - this.twaMin) / (this.twaMax - this.twaMin) * cw,
      this.twsReversed ? t + t_frac * ch : t + ch * (1 - t_frac),
    ];
  }

  fromPixel(px: number, py: number): [number, number] {
    const { x: l, y: t, w: cw, h: ch } = this.chartRect;
    const t_frac = this.twsReversed ? (py - t) / ch : (t + ch - py) / ch;
    return [
      this.twaMin + (px - l) / cw * (this.twaMax - this.twaMin),
      this.twsMin + t_frac * (this.twsMax - this.twsMin),
    ];
  }

  clamp(x: number, y: number): [number, number] {
    return [
      Math.max(this.twaMin, Math.min(this.twaMax, x)),
      Math.max(this.twsMin, Math.min(this.twsMax, y)),
    ];
  }

  get chartRect(): ChartRect {
    const { l, r, t, b } = this.pad;
    return { x: l, y: t, w: this.W - l - r - this.legendWidth, h: this.H - t - b };
  }

  isInBounds(twa: number, tws: number): boolean {
    return twa >= this.twaMin && twa <= this.twaMax && tws >= this.twsMin && tws <= this.twsMax;
  }
}

// ── Shared Catmull-Rom closed spline helper ────────────────────────────────────
export function splinePath(
  ctx: CanvasRenderingContext2D,
  pts: import('../model/types.js').SailPoint[],
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
