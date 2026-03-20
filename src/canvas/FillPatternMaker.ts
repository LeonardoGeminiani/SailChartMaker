import { FillPattern } from '../model/types.js';
import { hexToRgb } from './renderUtils.js';

// ── FillPatternMaker ──────────────────────────────────────────────────────────
export class FillPatternMaker {
  resolution       = 1;
  patternScale     = 1;
  patternThickness = 1;

  private readonly _cache = new Map<string, CanvasPattern | null>();

  clearCache(): void { this._cache.clear(); }

  /**
   * Build (or return cached) a CanvasPattern for the given sail fill style.
   * @param ctx  The main canvas context — used only for createPattern(); tile
   *             rendering is done on a separate off-screen canvas internally.
   */
  make(ctx: CanvasRenderingContext2D, color: string, pattern: FillPattern, dash = 4): CanvasPattern | null {
    const key = `${color}_${pattern}_${this.resolution.toFixed(3)}_${this.patternScale.toFixed(2)}_${this.patternThickness.toFixed(2)}_${dash}`;
    if (this._cache.has(key)) return this._cache.get(key)!;

    // Off-screen tile canvas — size in physical pixels.
    const spacing = Math.round(10 * this.resolution * this.patternScale);
    const s = Math.max(4, spacing);
    const oc = document.createElement('canvas');
    oc.width = s; oc.height = s;
    const ox = oc.getContext('2d')!;

    const lw      = Math.max(0.5, this.resolution * this.patternThickness);
    const e       = lw;                            // extend lines past tile edges
    const dashLen = Math.max(1, dash * this.resolution);
    const u       = this.resolution;

    ox.strokeStyle = `rgba(${hexToRgb(color)},0.80)`;
    ox.fillStyle   = `rgba(${hexToRgb(color)},0.80)`;
    ox.lineWidth   = lw;

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
      case 'finedash45':
        ox.setLineDash([5 * u, 3 * u, 1 * u, 3 * u]);
        ox.beginPath(); ox.moveTo(-e, -e); ox.lineTo(s + e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      case 'finedash135':
        ox.setLineDash([5 * u, 3 * u, 1 * u, 3 * u]);
        ox.beginPath(); ox.moveTo(s + e, -e); ox.lineTo(-e, s + e); ox.stroke();
        ox.setLineDash([]);
        break;
      case 'dots': {
        const r = s / 5;
        ox.beginPath(); ox.arc(s / 2, s / 2, r, 0, Math.PI * 2); ox.fill();
        break;
      }
    }

    // Bind to the main canvas context; apply inverse scale so the pattern tiles
    // at a constant visual size regardless of DPR / export resolution.
    const result = ctx.createPattern(oc, 'repeat');
    if (result) {
      const inv = 1 / this.resolution;
      result.setTransform(new DOMMatrix([inv, 0, 0, inv, 0, 0]));
    }
    this._cache.set(key, result);
    return result;
  }
}
