import { CoordinateSystem } from './CoordinateSystem.js';
import { X_MIN, X_MAX, Y_MIN, Y_MAX } from '../model/SailStore.js';

const BSP = 5; // assumed boat speed (kts) for AWS iso-curve formula
const AWS_VALUES = [5, 10, 15, 20, 25, 30];

function seg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

// ── BackgroundRenderer ────────────────────────────────────────────────────────
export class BackgroundRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w;
    this.canvas.height = h;
    this.coords.resize(w, h);
    this.draw();
  }

  draw(): void {
    const c = this.ctx;
    const { W, H } = this.coords;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;
    const r = W - l - cw;
    const b = H - t - ch;

    c.clearRect(0, 0, W, H);

    // Page background
    c.fillStyle = '#d6e0ea';
    c.fillRect(0, 0, W, H);

    // Chart area base
    c.fillStyle = '#dce8f2';
    c.fillRect(l, t, cw, ch);

    // Subtle centre highlight
    const grd = c.createRadialGradient(l + cw * .5, t + ch * .45, 0, l + cw * .5, t + ch * .5, Math.max(cw, ch) * .7);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(180,200,220,0)');
    c.fillStyle = grd;
    c.fillRect(l, t, cw, ch);

    // Minor grid
    c.strokeStyle = 'rgba(90,120,160,0.18)';
    c.lineWidth = 0.5;
    for (let x = X_MIN; x <= X_MAX; x += 5) {
      const [px] = this.coords.toPixel(x, 0);
      seg(c, px, t, px, H - b);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 2) {
      const [, py] = this.coords.toPixel(0, y);
      seg(c, l, py, W - r, py);
    }

    // Major grid
    c.strokeStyle = 'rgba(70,100,145,0.30)';
    c.lineWidth = 0.9;
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.coords.toPixel(x, 0);
      seg(c, px, t, px, H - b);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.coords.toPixel(0, y);
      seg(c, l, py, W - r, py);
    }

    // AWS iso-curves
    this._drawAWSCurves(c);

    // Chart border
    c.strokeStyle = 'rgba(60,90,130,0.50)';
    c.lineWidth = 1.5;
    c.strokeRect(l, t, cw, ch);

    // Tick marks
    c.strokeStyle = 'rgba(60,90,130,0.55)';
    c.lineWidth = 1;
    for (let x = X_MIN; x <= X_MAX; x += 5) {
      const [px] = this.coords.toPixel(x, 0);
      const sz = x % 15 === 0 ? 5 : 3;
      seg(c, px, H - b, px, H - b + sz);
      seg(c, px, t,     px, t - sz);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 2) {
      const [, py] = this.coords.toPixel(0, y);
      const sz = y % 5 === 0 ? 5 : 3;
      seg(c, l,     py, l - sz,     py);
      seg(c, W - r, py, W - r + sz, py);
    }

    // Axis labels
    c.font      = '11px "Azeret Mono", monospace';
    c.fillStyle = 'rgba(40,65,100,0.75)';

    // X bottom
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.coords.toPixel(x, 0);
      c.fillText(x + '°', px, H - b + 8);
    }
    // X top
    c.textBaseline = 'bottom';
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.coords.toPixel(x, 0);
      c.fillText(x + '°', px, t - 8);
    }
    // Y left
    c.textAlign    = 'right';
    c.textBaseline = 'middle';
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.coords.toPixel(0, y);
      c.fillText(String(y), l - 10, py);
    }
    // Y right
    c.textAlign = 'left';
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.coords.toPixel(0, y);
      c.fillText(String(y), W - r + 10, py);
    }

    // Axis titles
    c.fillStyle    = 'rgba(50,75,115,0.55)';
    c.font         = '11.5px "Outfit", sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.fillText('True Wind Angle — TWA (°)', l + cw / 2, H - 2);
    c.save();
    c.translate(11, t + ch / 2);
    c.rotate(-Math.PI / 2);
    c.textBaseline = 'top';
    c.fillText('True Wind Speed — TWS (kts)', 0, 0);
    c.restore();
  }

  // AWS iso-curve: TWS = –BSP·cos(θ) + √(AWS² – BSP²·sin²(θ))
  private _drawAWSCurves(c: CanvasRenderingContext2D): void {
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    for (const aws of AWS_VALUES) {
      c.beginPath();
      let first = true;
      let labelPx = 0, labelPy = 0;

      for (let twa = X_MIN; twa <= X_MAX; twa += 0.5) {
        const rad  = twa * Math.PI / 180;
        const disc = aws * aws - BSP * BSP * Math.sin(rad) ** 2;
        if (disc < 0) continue;
        const tws = -BSP * Math.cos(rad) + Math.sqrt(disc);
        if (tws < Y_MIN || tws > Y_MAX) continue;

        const [px, py] = this.coords.toPixel(twa, tws);
        if (first) { c.moveTo(px, py); labelPx = px; labelPy = py; first = false; }
        else c.lineTo(px, py);
      }

      c.strokeStyle = 'rgba(40,80,170,0.38)';
      c.lineWidth   = 1;
      c.setLineDash([5, 3, 1, 3]);
      c.stroke();
      c.setLineDash([]);

      if (!first) {
        c.font         = '9px "Azeret Mono", monospace';
        c.fillStyle    = 'rgba(30,60,150,0.65)';
        c.textAlign    = 'left';
        c.textBaseline = 'bottom';
        c.fillText(`aws${aws}`, labelPx + 2, labelPy - 1);
      }
    }

    c.restore();
  }
}
