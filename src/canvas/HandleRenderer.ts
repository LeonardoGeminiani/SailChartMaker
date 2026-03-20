import { SailData, ChartSpline, EditMode, SplineStroke } from '../model/types.js';
import { CoordinateSystem, openSplinePath2D } from './CoordinateSystem.js';
import { hexToRgb } from './renderUtils.js';

// ── HandleRenderer ─────────────────────────────────────────────────────────────
export class HandleRenderer {
  dpr               = 1;
  sailLabelFontSize = 11;
  selectedSplineId: number | null = null;

  constructor(private readonly coords: CoordinateSystem) {}

  private _px(v: number): number { return v / this.dpr; }

  private _dashPattern(stroke: SplineStroke): number[] {
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

  drawSailHandles(c: CanvasRenderingContext2D, s: SailData, mode: EditMode): void {
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

  drawSplines(c: CanvasRenderingContext2D, splines: ChartSpline[], mode: EditMode): void {
    for (const sp of splines) {
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
}
