import { SailData, ChartSpline } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath } from './CoordinateSystem.js';

const HIT_RADIUS = 9; // px

// ── HitTester ─────────────────────────────────────────────────────────────────
export class HitTester {
  resolution = 1;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Returns the sail under (px, py), checking the selected sail first. */
  hitSail(px: number, py: number): SailData | null {
    const c = this.ctx;
    const res = this.resolution;
    // Match the same transform used by SailRenderer so the hit path aligns with
    // the visual.  isPointInPath in Chromium takes physical canvas coordinates,
    // so scale the CSS-pixel test point by res.
    c.setTransform(res, 0, 0, res, 0, 0);

    const check = (s: SailData): boolean => {
      if (!s.visible || s.points.length < 3) return false;
      splinePath(c, s.points, this.coords);
      return c.isPointInPath(px * res, py * res);
    };

    const sel = this.store.find(this.store.selectedId);
    if (sel && check(sel)) return sel;

    for (let i = this.store.sails.length - 1; i >= 0; i--) {
      const s = this.store.sails[i];
      if (check(s)) return s;
    }
    return null;
  }

  /** Returns the control-point index under (px, py) for the given sail, or -1. */
  hitPoint(px: number, py: number, sail: SailData): number {
    for (let i = 0; i < sail.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(sail.points[i].x, sail.points[i].y);
      if (Math.hypot(px - hx, py - hy) <= HIT_RADIUS) return i;
    }
    return -1;
  }

  /** Returns the control-point index under (px, py) for the given spline, or -1. */
  hitSplinePoint(px: number, py: number, spline: ChartSpline): number {
    for (let i = 0; i < spline.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(spline.points[i].x, spline.points[i].y);
      if (Math.hypot(px - hx, py - hy) <= HIT_RADIUS) return i;
    }
    return -1;
  }

  /** Returns the spline nearest to (px, py) within a proximity threshold, or null. */
  hitSpline(px: number, py: number): ChartSpline | null {
    const PROX = 10;
    for (let i = this.store.splines.length - 1; i >= 0; i--) {
      const sp = this.store.splines[i];
      if (!sp.visible || sp.points.length < 2) continue;
      for (let j = 0; j < sp.points.length - 1; j++) {
        const [x1, y1] = this.coords.toPixel(sp.points[j].x,     sp.points[j].y);
        const [x2, y2] = this.coords.toPixel(sp.points[j + 1].x, sp.points[j + 1].y);
        if (this._distToSeg(px, py, x1, y1, x2, y2) <= PROX) return sp;
      }
    }
    return null;
  }

  private _distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
}
