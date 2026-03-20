import { SailData, LabelAnnotation } from '../model/types.js';
import { CoordinateSystem } from './CoordinateSystem.js';
import { hexToRgb, seg } from './renderUtils.js';

// ── AnnotationRenderer ────────────────────────────────────────────────────────
export class AnnotationRenderer {
  dpr               = 1;
  sailLabelFontSize = 11;

  constructor(private readonly coords: CoordinateSystem) {}

  private _px(v: number): number { return v / this.dpr; }

  getLabelPixelPos(s: SailData): [number, number] {
    const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
    const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
    const lx = cx + (s.labelOffset?.x ?? 0);
    const ly = cy + (s.labelOffset?.y ?? 0);
    return this.coords.toPixel(lx, ly);
  }

  getAnnotationPixelPos(a: LabelAnnotation): [number, number] {
    return this.coords.toPixel(a.x, a.y);
  }

  drawSailLabel(c: CanvasRenderingContext2D, s: SailData, sel: boolean): void {
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

  drawAnnotations(c: CanvasRenderingContext2D, annotations: LabelAnnotation[]): void {
    for (const a of annotations) {
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

      c.fillStyle = a.color + '28';
      c.beginPath();
      c.roundRect(px - bw / 2, py - bh / 2, bw, bh, cr);
      c.fill();

      c.strokeStyle = a.color;
      c.lineWidth   = this._px(1.2);
      c.beginPath();
      c.roundRect(px - bw / 2, py - bh / 2, bw, bh, cr);
      c.stroke();

      c.fillStyle = a.color;
      c.fillText(a.text, px, py);
    }
  }
}
