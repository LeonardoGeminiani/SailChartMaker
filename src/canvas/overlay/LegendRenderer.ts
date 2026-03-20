import { SailData } from '../../model/types.js';
import { CoordinateSystem } from '../CoordinateSystem.js';
import { FillPatternMaker } from '../sail/FillPatternMaker.js';
import { hexToRgb } from '../sail/renderUtils.js';

// ── LegendRenderer ────────────────────────────────────────────────────────────
export class LegendRenderer {
  dpr               = 1;
  sailLabelFontSize = 11;

  constructor(
    private readonly coords: CoordinateSystem,
    private readonly patterns: FillPatternMaker,
  ) {}

  private _px(v: number): number { return v / this.dpr; }

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
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  draw(c: CanvasRenderingContext2D, sails: SailData[]): void {
    const { x: cl, y: ct, w: cw, h: ch } = this.coords.chartRect;
    const { W } = this.coords;
    const gap      = this._px(10);
    const rPad     = this._px(6);
    const lx       = cl + cw + gap;
    const lw       = W - lx - rPad;
    if (lw < this._px(30)) return;

    const fs       = this._px(this.sailLabelFontSize);
    const lineH    = fs * (4 / 3);
    const padV     = this._px(6);
    const swW      = lw;
    const rowGap   = this._px(10);
    const textPadH = this._px(4);

    c.font = `600 ${fs}pt "Inter", sans-serif`;

    let ry = ct;
    for (const s of sails) {
      if (!s.visible) continue;

      const lines = this._wrapText(c, s.name, swW - textPadH * 2);
      const swH   = lines.length * lineH + padV * 2;
      if (ry + swH > ct + ch) break;

      if (s.showFill !== false) {
        c.fillStyle = `rgba(${hexToRgb(s.color)},${s.opacity})`;
        c.fillRect(lx, ry, swW, swH);
      }

      const pat = s.fillPattern ?? 'none';
      if (pat !== 'none') {
        const pattern = this.patterns.make(c, s.color, pat, s.patternDash ?? 4);
        if (pattern) { c.fillStyle = pattern; c.fillRect(lx, ry, swW, swH); }
      }

      c.strokeStyle = s.color;
      c.lineWidth   = this._px(1);
      c.strokeRect(lx, ry, swW, swH);

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
}
