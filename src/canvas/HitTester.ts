import { SailData } from '../model/types.js';
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
    // Paths are built in logical coords with identity transform so that
    // isPointInPath receives physical canvas coords (CSS * resolution).
    c.setTransform(1, 0, 0, 1, 0, 0);

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
}
