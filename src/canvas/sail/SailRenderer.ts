import { SailData, EditMode } from '../../model/types.js';
import { SailStore } from '../../model/SailStore.js';
import { CoordinateSystem, splinePath2D } from '../CoordinateSystem.js';
import { hexToRgb, seg } from './renderUtils.js';
import { FillPatternMaker } from './FillPatternMaker.js';

// ── SailRenderer ──────────────────────────────────────────────────────────────
export class SailRenderer {
  dpr               = 1;
  sailLabelFontSize = 11;

  constructor(
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
    private readonly patterns: FillPatternMaker,
  ) {}

  private _px(v: number): number { return v / this.dpr; }

  getLabelPixelPos(s: SailData): [number, number] {
    const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
    const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
    const lx = cx + (s.labelOffset?.x ?? 0);
    const ly = cy + (s.labelOffset?.y ?? 0);
    return this.coords.toPixel(lx, ly);
  }

  draw(c: CanvasRenderingContext2D, mode: EditMode): void {
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
        const pattern = this.patterns.make(c, s.color, pat, s.patternDash ?? 4);
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
  }

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

    const xhSize = this._px(6);
    const xhY    = lpy + this._px(6);
    c.strokeStyle = `rgba(${hexToRgb(s.color)},0.9)`;
    c.lineWidth   = this._px(sel ? 1.5 : 1);
    seg(c, lpx - xhSize, xhY, lpx + xhSize, xhY);
    seg(c, lpx, xhY - xhSize, lpx, xhY + xhSize);

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

  private _drawHandles(c: CanvasRenderingContext2D, s: SailData, mode: EditMode): void {
    for (let i = 0; i < s.points.length; i++) {
      const [hx, hy] = this.coords.toPixel(s.points[i].x, s.points[i].y);
      const del = mode === 'delpt';

      c.beginPath();
      c.arc(hx, hy, del ? 16 : 13, 0, Math.PI * 2);
      c.fillStyle = del ? 'rgba(192,48,48,0.15)' : `rgba(${hexToRgb(s.color)},0.18)`;
      c.fill();

      c.beginPath();
      c.arc(hx, hy, del ? 9 : 8, 0, Math.PI * 2);
      c.fillStyle   = del ? '#d04040' : '#ffffff';
      c.fill();
      c.strokeStyle = del ? '#e06060' : s.color;
      c.lineWidth   = this._px(1.5);
      c.stroke();

      c.font         = `10pt "JetBrains Mono", monospace`;
      c.fillStyle    = del ? '#fff' : 'rgba(20,40,70,0.85)';
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i), hx, hy);
    }
  }
}
