import { SailData, EditMode, CursorPosition } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath } from './CoordinateSystem.js';
import { X_MIN, X_MAX, Y_MIN, Y_MAX } from '../model/SailStore.js';

function seg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

function hexToRgb(hex: string): string {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].join(',');
}

// ── SailRenderer ──────────────────────────────────────────────────────────────
export class SailRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  cursor: CursorPosition | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  draw(mode: EditMode): void {
    const c = this.ctx;
    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    // Pass 1 — fills
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 3) continue;
      splinePath(c, s.points, this.coords);
      c.fillStyle = `rgba(${hexToRgb(s.color)},${s.opacity})`;
      c.fill();
    }

    // Pass 2 — borders, labels, handles
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 2) continue;
      const sel = s.id === this.store.selectedId;

      splinePath(c, s.points, this.coords);
      c.strokeStyle = `rgba(${hexToRgb(s.color)},${sel ? 1.0 : 0.80})`;
      c.lineWidth   = sel ? 2.5 : 1.5;
      if (sel) c.setLineDash([7, 4]);
      c.stroke();
      c.setLineDash([]);

      this._drawLabel(c, s, sel);

      if (sel) this._drawHandles(c, s, mode);
    }

    c.restore();

    // Cursor axis indicators (outside clip)
    if (this.cursor) this._drawCursorIndicators(c);
  }

  // ── Label: bold name + crosshair (+) ─────────────────────────────────────
  private _drawLabel(c: CanvasRenderingContext2D, s: SailData, sel: boolean): void {
    const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
    const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
    const [lpx, lpy] = this.coords.toPixel(cx, cy);

    c.font         = `bold ${sel ? 13 : 12}px "Outfit", sans-serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.shadowColor  = 'rgba(255,255,255,0.85)';
    c.shadowBlur   = 4;
    c.fillStyle    = 'rgba(15,25,40,0.90)';
    c.fillText(s.name, lpx, lpy - 1);
    c.shadowBlur   = 0;

    // Crosshair
    const xhSize = 6;
    const xhY    = lpy + 6;
    c.strokeStyle = `rgba(${hexToRgb(s.color)},0.9)`;
    c.lineWidth   = sel ? 1.5 : 1;
    seg(c, lpx - xhSize, xhY, lpx + xhSize, xhY);
    seg(c, lpx, xhY - xhSize, lpx, xhY + xhSize);
  }

  // ── Control-point handles ─────────────────────────────────────────────────
  private _drawHandles(c: CanvasRenderingContext2D, s: SailData, mode: EditMode): void {
    for (let i = 0; i < s.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(s.points[i].x, s.points[i].y);
      const del = mode === 'delpt';

      // Halo
      c.beginPath();
      c.arc(hx, hy, del ? 11 : 9, 0, Math.PI * 2);
      c.fillStyle = del ? 'rgba(192,48,48,0.15)' : `rgba(${hexToRgb(s.color)},0.18)`;
      c.fill();

      // Handle
      c.beginPath();
      c.arc(hx, hy, del ? 6 : 5, 0, Math.PI * 2);
      c.fillStyle   = del ? '#d04040' : '#ffffff';
      c.fill();
      c.strokeStyle = del ? '#e06060' : s.color;
      c.lineWidth   = 1.5;
      c.stroke();

      // Index number
      c.font         = '9px "Azeret Mono", monospace';
      c.fillStyle    = del ? '#fff' : 'rgba(20,40,70,0.85)';
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i), hx, hy);
    }
  }

  // ── Cursor axis indicators ────────────────────────────────────────────────
  private _drawCursorIndicators(c: CanvasRenderingContext2D): void {
    if (!this.cursor) return;
    const { twa, tws } = this.cursor;
    if (!this.coords.isInBounds(twa, tws)) return;

    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;
    const r = W - l - cw;
    const b = H - t - ch;
    const [cx, cy] = this.coords.toPixel(twa, tws);

    c.font         = 'bold 9px "Azeret Mono", monospace';
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

    this._cursorBox(c, cx,         t - 8,       24, 11, `${Math.round(twa)}°`);
    this._cursorBox(c, cx,         H - b + 8,   24, 11, `${Math.round(twa)}°`);
    this._cursorBox(c, l - 24,     cy,           40, 11, tws.toFixed(1));
    this._cursorBox(c, W - r + 24, cy,           40, 11, tws.toFixed(1));

    // Hairlines
    c.save();
    c.strokeStyle = 'rgba(200,100,20,0.35)';
    c.lineWidth   = 0.5;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();
    seg(c, cx, t, cx, H - b);
    seg(c, l, cy, W - r, cy);
    c.restore();
  }

  private _cursorBox(
    c: CanvasRenderingContext2D,
    cx: number, cy: number, w: number, h: number, label: string,
  ): void {
    c.fillStyle = '#d07018';
    c.beginPath();
    c.roundRect(cx - w / 2, cy - h / 2, w, h, 2);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(label, cx, cy);
  }

  /** Composite bgCanvas + mainCanvas into a new canvas for PNG export. */
  exportWith(bgCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width  = this.coords.W;
    out.height = this.coords.H;
    const oc = out.getContext('2d')!;
    oc.drawImage(bgCanvas, 0, 0);
    oc.drawImage(this.canvas, 0, 0);
    return out;
  }
}
