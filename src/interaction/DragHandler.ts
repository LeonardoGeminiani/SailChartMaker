import { SailData, SailPoint } from '../model/types.js';
import { CoordinateSystem } from '../canvas/CoordinateSystem.js';

export type DragType = 'point' | 'shape' | 'label';

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

interface LabelDrag {
  type: 'label';
  sailId: number;
  startPx: number;
  startPy: number;
  // pixel offset from click point to label center (so label doesn't jump)
  hitOffsetX: number;
  hitOffsetY: number;
}

type DragState = PointDrag | ShapeDrag | LabelDrag;

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

  /** labelPx/labelPy: the current pixel position of the label anchor. */
  startLabelDrag(sailId: number, px: number, py: number, labelPx: number, labelPy: number): void {
    this.state = {
      type: 'label', sailId,
      startPx: px, startPy: py,
      hitOffsetX: labelPx - px,
      hitOffsetY: labelPy - py,
    };
  }

  /** Apply the current pointer position to mutate sail in place. */
  apply(px: number, py: number, sail: SailData): void {
    if (!this.state) return;

    if (this.state.type === 'point') {
      const { pointIndex, originX, originY, startPx, startPy } = this.state;
      const [opx, opy] = this.coords.toPixel(originX, originY);
      const [nx, ny]   = this.coords.fromPixel(opx + (px - startPx), opy + (py - startPy));
      const [cx, cy]   = this.coords.clamp(nx, ny);
      sail.points[pointIndex] = { x: cx, y: cy };
    } else if (this.state.type === 'shape') {
      const { origPoints, startPx, startPy } = this.state;
      const ddx = px - startPx;
      const ddy = py - startPy;
      sail.points = origPoints.map(pt => {
        const [opx, opy] = this.coords.toPixel(pt.x, pt.y);
        const [nx, ny]   = this.coords.fromPixel(opx + ddx, opy + ddy);
        const [cx, cy]   = this.coords.clamp(nx, ny);
        return { x: cx, y: cy };
      });
    } else {
      // label drag — update labelOffset relative to centroid
      const { hitOffsetX, hitOffsetY } = this.state;
      const [lx, ly] = this.coords.fromPixel(px + hitOffsetX, py + hitOffsetY);
      const [clx, cly] = this.coords.clamp(lx, ly);
      const cx = sail.points.reduce((a, p) => a + p.x, 0) / sail.points.length;
      const cy = sail.points.reduce((a, p) => a + p.y, 0) / sail.points.length;
      sail.labelOffset = { x: clx - cx, y: cly - cy };
    }
  }

  end(): void { this.state = null; }

  get isDragging(): boolean       { return this.state !== null; }
  get sailId(): number | null     { return this.state?.sailId ?? null; }
  get dragType(): DragType | null { return this.state?.type  ?? null; }
}
