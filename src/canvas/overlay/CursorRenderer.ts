import { CursorPosition } from '../../model/types.js';
import { CoordinateSystem } from '../CoordinateSystem.js';
import { seg } from '../sail/renderUtils.js';

// ── CursorRenderer ────────────────────────────────────────────────────────────
export class CursorRenderer {
  dpr          = 1;
  axisFontSize = 11;
  cursor: CursorPosition | null = null;
  showCursor   = false;
  dragging     = false;

  constructor(private readonly coords: CoordinateSystem) {}

  private _px(v: number): number { return v / this.dpr; }

  draw(c: CanvasRenderingContext2D): void {
    if (!this.cursor || !this.showCursor || this.dragging) return;
    const { twa, tws } = this.cursor;
    if (!this.coords.isInBounds(twa, tws)) return;

    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;
    const r = W - l - cw;
    const b = H - t - ch;
    const [cx, cy] = this.coords.toPixel(twa, tws);

    c.font         = `bold ${this._px(this.axisFontSize)}pt "JetBrains Mono", monospace`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

    const sc   = this.axisFontSize / 9;
    const bh   = this._px(11 * sc);
    const bwA  = this._px(24 * sc);
    const bwS  = this._px(40 * sc);
    const gapV = this._px(8  * sc);
    const gapH = this._px(24 * sc);
    const cr   = this._px(2  * sc);

    this._cursorBox(c, cx,           t - gapV,     bwA, bh, `${Math.round(twa)}°`, cr);
    this._cursorBox(c, cx,           H - b + gapV, bwA, bh, `${Math.round(twa)}°`, cr);
    this._cursorBox(c, l - gapH,     cy,            bwS, bh, tws.toFixed(1),        cr);
    this._cursorBox(c, W - r + gapH, cy,            bwS, bh, tws.toFixed(1),        cr);

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
    cx: number, cy: number, w: number, h: number, label: string, r = 2,
  ): void {
    c.fillStyle = '#d07018';
    c.beginPath();
    c.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(label, cx, cy);
  }
}
