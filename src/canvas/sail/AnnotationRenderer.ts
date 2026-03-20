import { LabelAnnotation } from '../../model/types.js';
import { CoordinateSystem } from '../CoordinateSystem.js';

// ── AnnotationRenderer ────────────────────────────────────────────────────────
export class AnnotationRenderer {
  dpr               = 1;
  sailLabelFontSize = 11;

  constructor(private readonly coords: CoordinateSystem) {}

  private _px(v: number): number { return v / this.dpr; }

  getAnnotationPixelPos(a: LabelAnnotation): [number, number] {
    return this.coords.toPixel(a.x, a.y);
  }

  draw(c: CanvasRenderingContext2D, annotations: LabelAnnotation[]): void {
    for (const a of annotations) {
      const [px, py] = this.getAnnotationPixelPos(a);
      const fs = this._px(this.sailLabelFontSize);
      c.font         = `600 ${fs}pt "Inter", sans-serif`;
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
