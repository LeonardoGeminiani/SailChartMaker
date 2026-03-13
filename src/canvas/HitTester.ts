import { SailData } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath } from './CoordinateSystem.js';

const HIT_RADIUS = 9; // px

// ── HitTester ─────────────────────────────────────────────────────────────────
export class HitTester {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    // Uses the same canvas context as SailRenderer for isPointInPath.
    // Path operations do not affect the visual output.
    this.ctx = canvas.getContext('2d')!;
  }

  /** Returns the sail under (px, py), checking the selected sail first. */
  hitSail(px: number, py: number): SailData | null {
    const c = this.ctx;

    // Check selected sail first
    const sel = this.store.find(this.store.selectedId);
    if (sel && sel.visible && sel.points.length >= 3) {
      splinePath(c, sel.points, this.coords);
      if (c.isPointInPath(px, py)) return sel;
    }

    // Check all sails top-to-bottom
    for (let i = this.store.sails.length - 1; i >= 0; i--) {
      const s = this.store.sails[i];
      if (!s.visible || s.points.length < 3) continue;
      splinePath(c, s.points, this.coords);
      if (c.isPointInPath(px, py)) return s;
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
