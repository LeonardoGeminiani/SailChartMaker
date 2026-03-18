import { CoordinateSystem } from './CoordinateSystem.js';
import { PolarData } from '../model/PolarData.js';

const AWS_VALUES = [5, 10, 15, 20, 25, 30];

function seg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

/** Open Catmull-Rom spline through pixel points (clamped endpoints). */
function openSpline(c: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return;
  const n = pts.length;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(n - 1, i + 2)];
    c.bezierCurveTo(
      x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6,
      x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6,
      x2, y2,
    );
  }
}

/** Smooth one coordinate of a point sequence with a centred moving average. */
function smooth(pts: [number, number][], axis: 0 | 1, half: number): [number, number][] {
  if (half <= 0) return pts;
  return pts.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(pts.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += pts[j][axis];
    const avg = sum / (hi - lo + 1);
    return axis === 0 ? [avg, pts[i][1]] : [pts[i][0], avg];
  });
}

// ── BackgroundRenderer ────────────────────────────────────────────────────────
export class BackgroundRenderer {
  showAWS     = false;
  showBSP     = false;
  showLegend  = false;
  bgColor     = '#ffffff';
  fontSize  = 11;
  smoothing = 5;          // moving-average half-window (0 = off, 10 = max)
  resolution = 1;
  dpr        = 1;
  vmgStrokeWidth = 1.5;
  awsStrokeWidth = 1.0;
  bspLabelStep   = 2;
  bspFontSize    = 9;
  bspColor       = '#128048';
  axisStrokeScale = 1.0;
  twaStep = 15;
  twsStep = 5;
  polar: PolarData | null = null;

  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.canvas.width        = Math.round(w * this.resolution);
    this.canvas.height       = Math.round(h * this.resolution);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.coords.resize(w, h);
    this.draw();
  }

  /** Convert a "zoom-independent CSS px" value to the current logical canvas unit.
   *  Use this for font sizes and fixed pixel offsets so they stay the same
   *  physical size regardless of devicePixelRatio / browser zoom. */
  private _px(v: number): number { return v / this.dpr; }

  draw(): void {
    const c = this.ctx;
    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;
    const r = W - l - cw;
    const b = H - t - ch;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.resolution, 0, 0, this.resolution, 0, 0);

    // Page background
    c.fillStyle = this.bgColor;
    c.fillRect(0, 0, W, H);

    // Chart area base (slightly lighter overlay)
    c.fillStyle = this.bgColor;
    c.fillRect(l, t, cw, ch);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(l, t, cw, ch);

    // Subtle centre highlight
    const grd = c.createRadialGradient(l + cw * .5, t + ch * .45, 0, l + cw * .5, t + ch * .5, Math.max(cw, ch) * .7);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(180,200,220,0)');
    c.fillStyle = grd;
    c.fillRect(l, t, cw, ch);

    const twaMinor = Math.max(1, Math.round(this.twaStep / 3));
    const twsMinor = Math.max(1, Math.round(this.twsStep / 2.5));

    // Minor grid
    c.strokeStyle = 'rgba(90,120,160,0.18)';
    c.lineWidth = 0.5 * this.axisStrokeScale;
    for (let x = this.coords.twaMin; x <= this.coords.twaMax; x += twaMinor) {
      const [px] = this.coords.toPixel(x, 0);
      seg(c, px, t, px, H - b);
    }
    for (let y = this.coords.twsMin; y <= this.coords.twsMax; y += twsMinor) {
      const [, py] = this.coords.toPixel(0, y);
      seg(c, l, py, W - r, py);
    }

    // Major grid
    c.strokeStyle = 'rgba(70,100,145,0.30)';
    c.lineWidth = 0.9 * this.axisStrokeScale;
    for (let x = this.coords.twaMin; x <= this.coords.twaMax; x += this.twaStep) {
      const [px] = this.coords.toPixel(x, 0);
      seg(c, px, t, px, H - b);
    }
    for (let y = this.coords.twsMin; y <= this.coords.twsMax; y += this.twsStep) {
      const [, py] = this.coords.toPixel(0, y);
      seg(c, l, py, W - r, py);
    }

    // BSP speed labels at grid intersections
    if (this.showBSP) this._drawBSPLabels(c);

    // VMG target curves (always shown when polar is loaded)
    if (this.polar) this._drawVMGCurves(c);

    // AWS iso-curves
    if (this.showAWS) this._drawAWSCurves(c);

    // Chart border
    c.strokeStyle = 'rgba(60,90,130,0.50)';
    c.lineWidth = 1.5 * this.axisStrokeScale;
    c.strokeRect(l, t, cw, ch);

    // Tick marks
    c.strokeStyle = 'rgba(60,90,130,0.55)';
    c.lineWidth = 1 * this.axisStrokeScale;
    for (let x = this.coords.twaMin; x <= this.coords.twaMax; x += twaMinor) {
      const [px] = this.coords.toPixel(x, 0);
      const sz = this._px(x % this.twaStep === 0 ? 5 : 3);
      seg(c, px, H - b, px, H - b + sz);
      seg(c, px, t,     px, t - sz);
    }
    for (let y = this.coords.twsMin; y <= this.coords.twsMax; y += twsMinor) {
      const [, py] = this.coords.toPixel(0, y);
      const sz = this._px(y % this.twsStep === 0 ? 5 : 3);
      seg(c, l, py, l - sz, py);
      if (!this.showLegend) seg(c, W - r, py, W - r + sz, py);
    }

    // Axis labels
    c.font      = `${this._px(this.fontSize)}pt "JetBrains Mono", monospace`;
    c.fillStyle = 'rgba(40,65,100,0.75)';

    // X bottom
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    for (let x = this.coords.twaMin; x <= this.coords.twaMax; x += this.twaStep) {
      const [px] = this.coords.toPixel(x, 0);
      c.fillText(x + '°', px, H - b + this._px(8));
    }
    // X top
    c.textBaseline = 'bottom';
    for (let x = this.coords.twaMin; x <= this.coords.twaMax; x += this.twaStep) {
      const [px] = this.coords.toPixel(x, 0);
      c.fillText(x + '°', px, t - this._px(8));
    }
    // Y left
    c.textAlign    = 'right';
    c.textBaseline = 'middle';
    for (let y = this.coords.twsMin; y <= this.coords.twsMax; y += this.twsStep) {
      const [, py] = this.coords.toPixel(0, y);
      c.fillText(String(y), l - this._px(10), py);
    }
    // Y right (suppressed when legend is visible to avoid overlap)
    if (!this.showLegend) {
      c.textAlign = 'left';
      for (let y = this.coords.twsMin; y <= this.coords.twsMax; y += this.twsStep) {
        const [, py] = this.coords.toPixel(0, y);
        c.fillText(String(y), W - r + this._px(10), py);
      }
    }

    // Axis titles
    c.fillStyle    = 'rgba(50,75,115,0.55)';
    c.font         = `${this._px(this.fontSize + 0.5)}pt "Inter", sans-serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.fillText('True Wind Angle — TWA (°)', l + cw / 2, H - this._px(2));
    c.save();
    c.translate(this._px(11), t + ch / 2);
    c.rotate(-Math.PI / 2);
    c.textBaseline = 'top';
    c.fillText('True Wind Speed — TWS (kts)', 0, 0);
    c.restore();
  }

  // VMG = BSP·cos(TWA)
  // Upwind curve:   TWA that maximises VMG  for each TWS (TWA ∈ [twaMin, 90])
  // Downwind curve: TWA that minimises VMG  for each TWS (TWA ∈ [90, twaMax])
  private _drawVMGCurves(c: CanvasRenderingContext2D): void {
    const polar = this.polar!;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    const twsMin = Math.max(polar.minTWS, this.coords.twsMin);
    const twsMax = Math.min(polar.maxTWS, this.coords.twsMax);

    // Clamp TWA search to polar file's actual range to avoid extrapolation artefacts
    const twaSearchMin = Math.max(polar.minTWA, this.coords.twaMin);
    const twaSearchMax = Math.min(polar.maxTWA, this.coords.twaMax);

    const upPts:  [number, number][] = [];
    const dnPts:  [number, number][] = [];

    for (let tws = twsMin; tws <= twsMax + 0.01; tws += 0.25) {
      let bestUpVMG = -Infinity, bestUpTWA = twaSearchMin;
      let bestDnVMG =  Infinity, bestDnTWA = twaSearchMax;

      for (let twa = twaSearchMin; twa <= Math.min(90, twaSearchMax); twa += 0.5) {
        const vmg = polar.getBSP(twa, tws) * Math.cos(twa * Math.PI / 180);
        if (vmg > bestUpVMG) { bestUpVMG = vmg; bestUpTWA = twa; }
      }
      for (let twa = Math.max(90, twaSearchMin); twa <= twaSearchMax; twa += 0.5) {
        const vmg = polar.getBSP(twa, tws) * Math.cos(twa * Math.PI / 180);
        if (vmg < bestDnVMG) { bestDnVMG = vmg; bestDnTWA = twa; }
      }

      upPts.push([bestUpTWA, Math.min(tws, twsMax)]);
      dnPts.push([bestDnTWA, Math.min(tws, twsMax)]);
    }

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    const drawCurve = (rawPts: [number, number][]) => {
      // Smooth the optimal-TWA coordinate, then render with open Catmull-Rom.
      const smoothed = smooth(rawPts, 0, this.smoothing);
      const px: [number, number][] = smoothed.map(([twa, tws]) =>
        this.coords.toPixel(twa, tws) as [number, number]);
      openSpline(c, px);
      c.strokeStyle = 'rgba(200,30,30,0.80)';
      c.lineWidth   = this.vmgStrokeWidth;
      c.setLineDash([6, 3]);
      c.stroke();
      c.setLineDash([]);
    };

    drawCurve(upPts);
    drawCurve(dnPts);
    c.restore();

    // Labels & axis tick boxes outside the clip region
    const labelCurve = (pts: [number, number][], label: string, align: 'left' | 'right') => {
      if (!pts.length) return;

      // Mid-curve label (at 60% height for readability)
      const midIdx = Math.floor(pts.length * 0.35);
      const [twa60, tws60] = pts[midIdx];
      const [lx, ly] = this.coords.toPixel(twa60, tws60);
      c.font      = `bold ${this._px(Math.max(1, this.fontSize - 1))}pt "JetBrains Mono", monospace`;
      c.fillStyle = 'rgba(180,20,20,0.85)';
      c.textAlign    = align;
      c.textBaseline = 'middle';
      c.fillText(label, align === 'left' ? lx + this._px(4) : lx - this._px(4), ly);
    };

    labelCurve(upPts, 'UpVMG', 'right');
    labelCurve(dnPts, 'DnVMG', 'left');
  }

  // AWS iso-curve: AWS = √(TWS² + BSP² + 2·TWS·BSP·cos(TWA))
  // For each target AWS value, binary-search for TWS at each TWA step.
  private _drawAWSCurves(c: CanvasRenderingContext2D): void {
    if (!this.polar) return;
    const polar = this.polar;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    const awsAt = (twa: number, tws: number): number => {
      const bsp = polar.getBSP(twa, tws);
      const rad = twa * Math.PI / 180;
      return Math.sqrt(tws * tws + bsp * bsp + 2 * tws * bsp * Math.cos(rad));
    };

    const findTWS = (twa: number, targetAWS: number): number | null => {
      if (awsAt(twa, this.coords.twsMax) < targetAWS) return null;
      let lo = this.coords.twsMin, hi = this.coords.twsMax;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (awsAt(twa, mid) < targetAWS) lo = mid; else hi = mid;
      }
      const tws = (lo + hi) / 2;
      return tws >= this.coords.twsMin && tws <= this.coords.twsMax ? tws : null;
    };

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    for (const aws of AWS_VALUES) {
      const curvePts: [number, number][] = [];
      let labelPx = 0, labelPy = 0;

      for (let twa = this.coords.twaMin; twa <= this.coords.twaMax; twa += 2) {
        const tws = findTWS(twa, aws);
        if (tws === null) continue;
        const [px, py] = this.coords.toPixel(twa, tws);
        if (!curvePts.length) { labelPx = px; labelPy = py; }
        curvePts.push([px, py]);
      }

      if (!curvePts.length) continue;
      openSpline(c, smooth(curvePts, 1, this.smoothing));
      c.strokeStyle = 'rgba(40,80,170,0.38)';
      c.lineWidth   = this.awsStrokeWidth;
      c.setLineDash([5, 3, 1, 3]);
      c.stroke();
      c.setLineDash([]);

      c.font         = `${this._px(Math.max(1, this.fontSize - 2))}pt "JetBrains Mono", monospace`;
      c.fillStyle    = 'rgba(30,60,150,0.65)';
      c.textAlign    = 'left';
      c.textBaseline = 'bottom';
      c.fillText(`aws${aws}`, labelPx + this._px(2), labelPy - this._px(1));
    }

    c.restore();
  }

  // BSP labels: boat speed value drawn at each grid intersection.
  // Uses polar data points when sparse (≤80 total), axis grid otherwise.
  // Skips points outside the polar's actual data range.
  private _drawBSPLabels(c: CanvasRenderingContext2D): void {
    if (!this.polar) return;
    const polar = this.polar;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    // Choose grid: polar data points if sparse, else chart axis intersections.
    // bspLabelStep: 1 = coarsest, higher = denser.
    const d = Math.max(1, Math.round(this.bspLabelStep));
    let twaGrid: number[];
    let twsGrid: number[];
    if (polar.allTWA.length * polar.allTWS.length <= 80) {
      // Sparse polar: subsample every Nth polar point (higher d → smaller N)
      const sub = Math.max(1, Math.ceil(3 / d)); // d=1→3, d=2→2, d=3+→1
      twaGrid = polar.allTWA.filter((_, i) => i % sub === 0)
                             .filter(v => v >= this.coords.twaMin && v <= this.coords.twaMax) as number[];
      twsGrid = polar.allTWS.filter((_, i) => i % sub === 0)
                             .filter(v => v >= this.coords.twsMin && v <= this.coords.twsMax) as number[];
    } else {
      // Dense polar: use axis grid with interval shrinking as d grows.
      // d=2 is the "one label per major gridline" baseline (aligns to twaStep/twsStep).
      const twaDelta = d <= 1 ? this.twaStep * 2
                     : d <= 2 ? this.twaStep
                     : d <= 4 ? Math.max(1, Math.round(this.twaStep / 2))
                     :          Math.max(1, Math.round(this.twaStep / 3));
      const twsDelta = d <= 1 ? this.twsStep * 2
                     : d <= 3 ? this.twsStep
                     :          Math.max(1, Math.round(this.twsStep / 2));
      twaGrid = [];
      for (let v = this.coords.twaMin; v <= this.coords.twaMax; v += twaDelta) twaGrid.push(v);
      twsGrid = [];
      for (let v = this.coords.twsMin; v <= this.coords.twsMax; v += twsDelta) {
        if (v > 0) twsGrid.push(v); // skip 0 kts
      }
    }

    c.font         = `500 ${this._px(this.bspFontSize)}pt "JetBrains Mono", monospace`;
    c.fillStyle    = this.bspColor;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

    for (const twa of twaGrid) {
      for (const tws of twsGrid) {
        // Only draw if within polar's actual data bounds (no clamped extrapolation)
        if (twa < polar.minTWA || twa > polar.maxTWA) continue;
        if (tws < polar.minTWS || tws > polar.maxTWS) continue;

        const [px, py] = this.coords.toPixel(twa, tws);
        const m = this._px(20);
        if (px < l + m || px > l + cw - m || py < t + m || py > t + ch - m) continue;

        const bsp = polar.getBSP(twa, tws);
        c.fillText(bsp.toFixed(1), px, py);
      }
    }
  }
}
