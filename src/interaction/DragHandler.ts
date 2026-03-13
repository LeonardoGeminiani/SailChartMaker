import { SailData, SailPoint } from '../model/types.js';
import { CoordinateSystem } from '../canvas/CoordinateSystem.js';

export type DragType = 'point' | 'shape';

interface PointDrag {
  type: 'point';
  sailId: number;
  pointIndex: number;
  startPx: number;
  startPy: number;
  originX: number; // original data coord
  originY: number;
}

interface ShapeDrag {
  type: 'shape';
  sailId: number;
  startPx: number;
  startPy: number;
  origPoints: SailPoint[]; // snapshot taken at drag start
}

type DragState = PointDrag | ShapeDrag;

// ── DragHandler ───────────────────────────────────────────────────────────────
export class DragHandler {
  private state: DragState | null = null;

  constructor(private readonly coords: CoordinateSystem) {}

  startPointDrag(
    sailId: number, pointIndex: number,
    px: number, py: number,
    originX: number, originY: number,
  ): void {
    this.state = { type: 'point', sailId, pointIndex, startPx: px, startPy: py, originX, originY };
  }

  startShapeDrag(sailId: number, px: number, py: number, origPoints: SailPoint[]): void {
    this.state = {
      type: 'shape', sailId,
      startPx: px, startPy: py,
      origPoints: origPoints.map(p => ({ ...p })),
    };
  }

  /** Apply the current pointer position to mutate sail.points in place. */
  apply(px: number, py: number, sail: SailData): void {
    if (!this.state) return;

    if (this.state.type === 'point') {
      const { pointIndex, originX, originY, startPx, startPy } = this.state;
      const [opx, opy] = this.coords.toPixel(originX, originY);
      const [nx, ny]   = this.coords.fromPixel(opx + (px - startPx), opy + (py - startPy));
      const [cx, cy]   = this.coords.clamp(nx, ny);
      sail.points[pointIndex] = { x: cx, y: cy };
    } else {
      const { origPoints, startPx, startPy } = this.state;
      const ddx = px - startPx;
      const ddy = py - startPy;
      sail.points = origPoints.map(pt => {
        const [opx, opy] = this.coords.toPixel(pt.x, pt.y);
        const [nx, ny]   = this.coords.fromPixel(opx + ddx, opy + ddy);
        const [cx, cy]   = this.coords.clamp(nx, ny);
        return { x: cx, y: cy };
      });
    }
  }

  end(): void { this.state = null; }

  get isDragging(): boolean       { return this.state !== null; }
  get sailId(): number | null     { return this.state?.sailId ?? null; }
  get dragType(): DragType | null { return this.state?.type  ?? null; }
}
