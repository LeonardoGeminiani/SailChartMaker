import { SailData, LabelAnnotation, FillPattern, EditMode, CursorPosition } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath } from './CoordinateSystem.js';

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
  resolution         = 1;
  dpr                = 1;
  sailLabelFontSize  = 11;
  axisFontSize       = 11;
  patternScale       = 1;
  patternThickness   = 1;
  cursor: CursorPosition | null = null;
  private _patCache = new Map<string, CanvasPattern | null>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  private _px(v: number): number { return v / this.dpr; }

  resize(w: number, h: number): void {
    this.canvas.width        = Math.round(w * this.resolution);
    this.canvas.height       = Math.round(h * this.resolution);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  draw(mode: EditMode): void {
    const c = this.ctx;
    const res = this.resolution;
    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(res, 0, 0, res, 0, 0);

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    // Pass 1 — fills + patterns
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 3) continue;
      splinePath(c, s.points, this.coords);
      if (s.showFill !== false) {
        c.fillStyle = `rgba(${hexToRgb(s.color)},${s.opacity})`;
        c.fill();
      }
      const pat = s.fillPattern ?? 'none';
      if (pat !== 'none') {
        const pattern = this._makePattern(s.color, pat);
        if (pattern) { c.fillStyle = pattern; c.fill(); }
      }
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

    // Annotations (inside chart clip)
    this._drawAnnotations(c);

    c.restore();

    // Cursor axis indicators (outside clip)
    if (this.cursor) this._drawCursorIndicators(c);
  }

  /** Returns the label anchor pixel position, accounting for any labelOffset. */
  getLabelPixelPos(s: SailData): [number, number] {
    const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
    const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
    const lx = cx + (s.labelOffset?.x ?? 0);
    const ly = cy + (s.labelOffset?.y ?? 0);
    return this.coords.toPixel(lx, ly);
  }

  // ── Fill pattern generator ────────────────────────────────────────────────
  private _makePattern(color: string, pattern: FillPattern): CanvasPattern | null {
    const key = `${color}_${pattern}_${this.resolution.toFixed(3)}_${this.patternScale.toFixed(2)}_${this.patternThickness.toFixed(2)}`;
    if (this._patCache.has(key)) return this._patCache.get(key)!;

    // Tile is `spacing` logical units → spacing * resolution physical pixels
    const spacing = Math.round(10 * this.resolution * this.patternScale);
    const s = Math.max(4, spacing);
    const oc = document.createElement('canvas');
    oc.width = s; oc.height = s;
    const ox = oc.getContext('2d')!;

    const lw = Math.max(0.5, this.resolution * this.patternThickness);
    ox.strokeStyle = `rgba(${hexToRgb(color)},0.80)`;
    ox.fillStyle   = `rgba(${hexToRgb(color)},0.80)`;
    ox.lineWidth   = lw;

    const drawLines45 = () => {
      for (let i = -1; i <= 2; i++) {
        ox.beginPath();
        ox.moveTo(i * s / 2,         0);
        ox.lineTo(i * s / 2 + s,     s);
        ox.stroke();
      }
    };
    const drawLines135 = () => {
      for (let i = -1; i <= 2; i++) {
        ox.beginPath();
        ox.moveTo(i * s / 2 + s,     0);
        ox.lineTo(i * s / 2,         s);
        ox.stroke();
      }
    };

    switch (pattern) {
      case 'lines45':    drawLines45(); break;
      case 'lines135':   drawLines135(); break;
      case 'crosshatch': drawLines45(); drawLines135(); break;
      case 'horizontal':
        for (let y = 0; y < s; y += s / 2) {
          ox.beginPath(); ox.moveTo(0, y); ox.lineTo(s, y); ox.stroke();
        }
        break;
      case 'vertical':
        for (let x = 0; x < s; x += s / 2) {
          ox.beginPath(); ox.moveTo(x, 0); ox.lineTo(x, s); ox.stroke();
        }
        break;
      case 'dots': {
        const r = s / 5;
        ox.beginPath(); ox.arc(s / 2, s / 2, r, 0, Math.PI * 2); ox.fill();
        for (const [cx, cy] of [[0,0],[s,0],[0,s],[s,s]] as [number,number][]) {
          ox.beginPath(); ox.arc(cx, cy, r / 2, 0, Math.PI * 2); ox.fill();
        }
        break;
      }
    }

    const result = this.ctx.createPattern(oc, 'repeat');
    this._patCache.set(key, result);
    return result;
  }

  // ── Label: bold name + crosshair (+) ─────────────────────────────────────
  private _drawLabel(c: CanvasRenderingContext2D, s: SailData, sel: boolean): void {
    const [lpx, lpy] = this.getLabelPixelPos(s);
    const fs = this._px(this.sailLabelFontSize + (sel ? 1 : 0));

    c.font         = `bold ${fs}pt "Outfit", sans-serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.shadowColor  = 'rgba(255,255,255,0.85)';
    c.shadowBlur   = this._px(4);
    c.fillStyle    = 'rgba(15,25,40,0.90)';
    c.fillText(s.name, lpx, lpy - this._px(1));
    c.shadowBlur   = 0;

    // Crosshair
    const xhSize = this._px(6);
    const xhY    = lpy + this._px(6);
    c.strokeStyle = `rgba(${hexToRgb(s.color)},0.9)`;
    c.lineWidth   = this._px(sel ? 1.5 : 1);
    seg(c, lpx - xhSize, xhY, lpx + xhSize, xhY);
    seg(c, lpx, xhY - xhSize, lpx, xhY + xhSize);

    // Drag handle hint (shown when selected) — sized to actual text
    if (sel) {
      const pad = this._px(6);
      const tw  = c.measureText(s.name).width;
      const bw  = tw + pad * 2;
      const bh2 = fs * (4 / 3) + pad;
      c.strokeStyle = `rgba(${hexToRgb(s.color)},0.55)`;
      c.lineWidth   = this._px(1);
      c.setLineDash([this._px(2), this._px(2)]);
      c.strokeRect(lpx - bw / 2, lpy - bh2 - this._px(2), bw, bh2 + this._px(4));
      c.setLineDash([]);
    }
  }

  // ── Control-point handles ─────────────────────────────────────────────────
  private _drawHandles(c: CanvasRenderingContext2D, s: SailData, mode: EditMode): void {
    for (let i = 0; i < s.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(s.points[i].x, s.points[i].y);
      const del = mode === 'delpt';

      // Halo — raw (no _px) so it scales with page zoom / DPR
      c.beginPath();
      c.arc(hx, hy, del ? 16 : 13, 0, Math.PI * 2);
      c.fillStyle = del ? 'rgba(192,48,48,0.15)' : `rgba(${hexToRgb(s.color)},0.18)`;
      c.fill();

      // Handle dot — scales with zoom
      c.beginPath();
      c.arc(hx, hy, del ? 9 : 8, 0, Math.PI * 2);
      c.fillStyle   = del ? '#d04040' : '#ffffff';
      c.fill();
      c.strokeStyle = del ? '#e06060' : s.color;
      c.lineWidth   = this._px(1.5);
      c.stroke();

      // Index number — scales with zoom
      c.font         = `10pt "Azeret Mono", monospace`;
      c.fillStyle    = del ? '#fff' : 'rgba(20,40,70,0.85)';
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i), hx, hy);
    }
  }

  // ── Free label annotations ────────────────────────────────────────────────
  getAnnotationPixelPos(a: LabelAnnotation): [number, number] {
    return this.coords.toPixel(a.x, a.y);
  }

  private _drawAnnotations(c: CanvasRenderingContext2D): void {
    for (const a of this.store.annotations) {
      const [px, py] = this.getAnnotationPixelPos(a);
      const fs = this._px(this.sailLabelFontSize);
      c.font = `600 ${fs}pt "Outfit", sans-serif`;
      c.textAlign    = 'center';
      c.textBaseline = 'middle';

      const tw  = c.measureText(a.text).width;
      const pad = this._px(6);
      const bw  = tw + pad * 2;
      const bh  = fs * (4 / 3) + this._px(10);
      const cr  = this._px(4);

      // Fill
      c.fillStyle = a.color + '28';
      c.beginPath();
      c.roundRect(px - bw / 2, py - bh / 2, bw, bh, cr);
      c.fill();

      // Border
      c.strokeStyle = a.color;
      c.lineWidth   = this._px(1.2);
      c.beginPath();
      c.roundRect(px - bw / 2, py - bh / 2, bw, bh, cr);
      c.stroke();

      // Text
      c.fillStyle = a.color;
      c.fillText(a.text, px, py);
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

    c.font         = `bold ${this._px(this.axisFontSize)}pt "Azeret Mono", monospace`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

    // Scale all box geometry proportionally to axisFontSize (9pt was the design reference)
    const sc  = this.axisFontSize / 9;
    const bh  = this._px(11 * sc);          // box height
    const bwA = this._px(24 * sc);          // TWA box width
    const bwS = this._px(40 * sc);          // TWS box width
    const gapV = this._px(8  * sc);         // centre offset above/below axis
    const gapH = this._px(24 * sc);         // centre offset left/right of axis
    const cr   = this._px(2  * sc);         // corner radius

    this._cursorBox(c, cx,           t - gapV,    bwA, bh, `${Math.round(twa)}°`, cr);
    this._cursorBox(c, cx,           H - b + gapV, bwA, bh, `${Math.round(twa)}°`, cr);
    this._cursorBox(c, l - gapH,     cy,           bwS, bh, tws.toFixed(1),         cr);
    this._cursorBox(c, W - r + gapH, cy,           bwS, bh, tws.toFixed(1),         cr);

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
    cx: number, cy: number, w: number, h: number, label: string, r = 2,
  ): void {
    c.fillStyle = '#d07018';
    c.beginPath();
    c.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(label, cx, cy);
  }

  /** Composite bgCanvas + mainCanvas into a new canvas for PNG export. */
  exportWith(bgCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width  = this.canvas.width;   // physical = logical × resolution
    out.height = this.canvas.height;
    const oc = out.getContext('2d')!;
    oc.drawImage(bgCanvas, 0, 0);
    oc.drawImage(this.canvas, 0, 0);
    return out;
  }
}
