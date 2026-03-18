import { SailData, LabelAnnotation, FillPattern, EditMode, CursorPosition, ChartSpline } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath2D, openSplinePath2D } from './CoordinateSystem.js';

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
  showLegend         = false;
  selectedSplineId: number | null = null;
  cursor: CursorPosition | null = null;
  showCursor         = false;
  /** Set to true during drag so cursor indicators are skipped each frame. */
  dragging           = false;
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

    // Build spline paths once — reused by both fill and stroke passes.
    const sailPaths = new Map<number, Path2D>();
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 2) continue;
      sailPaths.set(s.id, splinePath2D(s.points, this.coords));
    }

    // Pass 1 — fills + patterns
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 3) continue;
      const path = sailPaths.get(s.id)!;
      if (s.showFill !== false) {
        c.fillStyle = `rgba(${hexToRgb(s.color)},${s.opacity})`;
        c.fill(path);
      }
      const pat = s.fillPattern ?? 'none';
      if (pat !== 'none') {
        const pattern = this._makePattern(s.color, pat, s.patternDash ?? 4);
        if (pattern) { c.fillStyle = pattern; c.fill(path); }
      }
    }

    // Pass 2 — borders, labels, handles
    for (const s of this.store.sails) {
      if (!s.visible || s.points.length < 2) continue;
      const sel = s.id === this.store.selectedId;

      const path = sailPaths.get(s.id)!;
      c.strokeStyle = `rgba(${hexToRgb(s.color)},${sel ? 1.0 : 0.80})`;
      c.lineWidth   = sel ? 2.5 : 1.5;
      if (sel) c.setLineDash([7, 4]);
      c.stroke(path);
      c.setLineDash([]);

      if (s.showLabel !== false) this._drawLabel(c, s, sel);

      if (sel) this._drawHandles(c, s, mode);
    }

    // Annotations (inside chart clip)
    this._drawAnnotations(c);

    // Splines (inside chart clip)
    this._drawSplines(c, mode);

    c.restore();

    // Legend (outside chart clip, in right margin)
    if (this.showLegend) this._drawLegend(c);

    // Cursor axis indicators (outside clip) — skipped during drag to reduce per-frame work
    if (this.cursor && this.showCursor && !this.dragging) this._drawCursorIndicators(c);
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
  private _makePattern(color: string, pattern: FillPattern, dash = 4): CanvasPattern | null {
    const key = `${color}_${pattern}_${this.resolution.toFixed(3)}_${this.patternScale.toFixed(2)}_${this.patternThickness.toFixed(2)}_${dash}`;
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

    // One line per s×s tile, extended past edges by lw so endpoint corners are
    // fully covered. Tile (s,s) starts exactly where tile (0,0) ends → seamless.
    const e = lw;  // extension past tile edge
    const dashLen = Math.max(1, dash * this.resolution);

    switch (pattern) {
      case 'lines45':
        ox.beginPath(); ox.moveTo(-e, -e); ox.lineTo(s + e, s + e); ox.stroke();
        break;
      case 'lines135':
        ox.beginPath(); ox.moveTo(s + e, -e); ox.lineTo(-e, s + e); ox.stroke();
        break;
      case 'crosshatch':
        ox.beginPath();
        ox.moveTo(-e, -e); ox.lineTo(s + e, s + e);
        ox.moveTo(s + e, -e); ox.lineTo(-e, s + e);
        ox.stroke();
        break;
      case 'horizontal':
        ox.beginPath(); ox.moveTo(-e, 0); ox.lineTo(s + e, 0); ox.stroke();
        break;
      case 'vertical':
        ox.beginPath(); ox.moveTo(0, -e); ox.lineTo(0, s + e); ox.stroke();
        break;
      case 'dashes45':
        ox.setLineDash([dashLen, dashLen]);
        ox.beginPath(); ox.moveTo(-e, -e); ox.lineTo(s + e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      case 'dashes135':
        ox.setLineDash([dashLen, dashLen]);
        ox.beginPath(); ox.moveTo(s + e, -e); ox.lineTo(-e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      case 'finedash45': {
        const u = this.resolution;
        ox.setLineDash([5 * u, 3 * u, 1 * u, 3 * u]);
        ox.beginPath(); ox.moveTo(-e, -e); ox.lineTo(s + e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      }
      case 'finedash135': {
        const u = this.resolution;
        ox.setLineDash([5 * u, 3 * u, 1 * u, 3 * u]);
        ox.beginPath(); ox.moveTo(s + e, -e); ox.lineTo(-e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      }
      case 'dots': {
        ox.fillStyle = `rgba(${hexToRgb(color)},0.80)`;
        const r = s / 5;
        ox.beginPath(); ox.arc(s / 2, s / 2, r, 0, Math.PI * 2); ox.fill();
        break;
      }
    }

    const result = this.ctx.createPattern(oc, 'repeat');
    if (result) {
      // The tile was drawn at physical resolution; undo the canvas transform so the
      // pattern tiles at a constant visual size regardless of DPR / export scale.
      const inv = 1 / this.resolution;
      result.setTransform(new DOMMatrix([inv, 0, 0, inv, 0, 0]));
    }
    this._patCache.set(key, result);
    return result;
  }

  // ── Label: bold name + crosshair (+) ─────────────────────────────────────
  private _drawLabel(c: CanvasRenderingContext2D, s: SailData, sel: boolean): void {
    const [lpx, lpy] = this.getLabelPixelPos(s);
    const fs = this._px(this.sailLabelFontSize + (sel ? 1 : 0));

    c.font         = `bold ${fs}pt "Inter", sans-serif`;
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
      c.font         = `10pt "JetBrains Mono", monospace`;
      c.fillStyle    = del ? '#fff' : 'rgba(20,40,70,0.85)';
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i), hx, hy);
    }
  }

  // ── Splines ───────────────────────────────────────────────────────────────
  private _dashPattern(stroke: import('../model/types.js').SplineStroke): number[] {
    const p = (v: number) => this._px(v);
    switch (stroke) {
      case 'dashed':   return [p(8),  p(5)];
      case 'dotted':   return [p(1),  p(6)];
      case 'dashdot':  return [p(8),  p(4), p(2), p(4)];
      case 'finedash': return [p(5),  p(3), p(1), p(3)];
      case 'longdash': return [p(14), p(5)];
      default:         return [];
    }
  }

  private _drawSplines(c: CanvasRenderingContext2D, mode: EditMode): void {
    for (const sp of this.store.splines) {
      if (!sp.visible || sp.points.length < 2) continue;
      const sel = sp.id === this.selectedSplineId;

      const path = openSplinePath2D(sp.points, this.coords);
      c.strokeStyle = sp.color;
      c.lineWidth   = sel ? sp.strokeWidth + 1 : sp.strokeWidth;
      c.setLineDash(this._dashPattern(sp.stroke));
      c.stroke(path);
      c.setLineDash([]);

      this._drawSplineLabel(c, sp, sel);
      if (sel) this._drawSplineHandles(c, sp, mode);
    }
  }

  private _drawSplineLabel(c: CanvasRenderingContext2D, sp: ChartSpline, sel: boolean): void {
    if (!sp.name) return;
    const mid = sp.points[Math.floor(sp.points.length / 2)];
    const [mx, my] = this.coords.toPixel(mid.x, mid.y);
    const fs = this._px(this.sailLabelFontSize + (sel ? 1 : 0));
    c.font         = `600 ${fs}pt "Inter", sans-serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.shadowColor  = 'rgba(255,255,255,0.85)';
    c.shadowBlur   = this._px(4);
    c.fillStyle    = sp.color;
    c.fillText(sp.name, mx, my - this._px(6));
    c.shadowBlur   = 0;
  }

  private _drawSplineHandles(c: CanvasRenderingContext2D, sp: ChartSpline, mode: EditMode): void {
    for (let i = 0; i < sp.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(sp.points[i].x, sp.points[i].y);
      const del = mode === 'delpt';
      c.beginPath();
      c.arc(hx, hy, del ? 16 : 13, 0, Math.PI * 2);
      c.fillStyle = del ? 'rgba(192,48,48,0.15)' : 'rgba(150,150,150,0.18)';
      c.fill();
      c.beginPath();
      c.arc(hx, hy, del ? 9 : 8, 0, Math.PI * 2);
      c.fillStyle   = del ? '#d04040' : '#ffffff';
      c.fill();
      c.strokeStyle = del ? '#e06060' : sp.color;
      c.lineWidth   = this._px(1.5);
      c.stroke();
      c.font         = `10pt "JetBrains Mono", monospace`;
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
      c.font = `600 ${fs}pt "Inter", sans-serif`;
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

  // ── Right-side legend ─────────────────────────────────────────────────────
  private _wrapText(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (c.measureText(test).width <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        // If a single word is wider than maxW, push it as-is
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  private _drawLegend(c: CanvasRenderingContext2D): void {
    const { x: cl, y: ct, w: cw, h: ch } = this.coords.chartRect;
    const { W } = this.coords;
    // All dimensions via _px() (= v/dpr) so they stay constant in physical pixels
    // across any browser zoom level, matching how legendWidth is now set in App.
    const gap      = this._px(10);        // gap between chart edge and legend
    const rPad     = this._px(6);         // right margin
    const lx       = cl + cw + gap;      // legend left edge
    const lw       = W - lx - rPad;      // available legend width
    if (lw < this._px(30)) return;

    const fs       = this._px(this.sailLabelFontSize);
    const lineH    = fs * (4 / 3);       // line height in canvas units
    const padV     = this._px(6);        // vertical padding inside swatch
    const swW      = lw;                 // swatch spans full legend width
    const rowGap   = this._px(10);       // gap between rows
    const textPadH = this._px(4);        // horizontal text inset

    c.font = `600 ${fs}pt "Inter", sans-serif`;

    let ry = ct;

    for (const s of this.store.sails) {
      if (!s.visible) continue;

      const lines = this._wrapText(c, s.name, swW - textPadH * 2);
      const swH   = lines.length * lineH + padV * 2;

      if (ry + swH > ct + ch) break;

      // Swatch — solid fill
      if (s.showFill !== false) {
        c.fillStyle = `rgba(${hexToRgb(s.color)},${s.opacity})`;
        c.fillRect(lx, ry, swW, swH);
      }

      // Swatch — pattern overlay
      const pat = s.fillPattern ?? 'none';
      if (pat !== 'none') {
        const pattern = this._makePattern(s.color, pat, s.patternDash ?? 4);
        if (pattern) { c.fillStyle = pattern; c.fillRect(lx, ry, swW, swH); }
      }

      // Swatch border
      c.strokeStyle = s.color;
      c.lineWidth   = this._px(1);
      c.strokeRect(lx, ry, swW, swH);

      // Sail name — wrapped lines centred in swatch
      c.font         = `600 ${fs}pt "Inter", sans-serif`;
      c.fillStyle    = 'rgba(15,25,40,0.88)';
      c.shadowColor  = 'rgba(255,255,255,0.80)';
      c.shadowBlur   = this._px(3);
      c.textAlign    = 'center';
      c.textBaseline = 'middle';

      const totalTextH = lines.length * lineH;
      const textStartY = ry + (swH - totalTextH) / 2 + lineH / 2;
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], lx + swW / 2, textStartY + i * lineH);
      }
      c.shadowBlur = 0;

      ry += swH + rowGap;
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

    c.font         = `bold ${this._px(this.axisFontSize)}pt "JetBrains Mono", monospace`;
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
