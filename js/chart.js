import { X_MIN, X_MAX, Y_MIN, Y_MAX } from './sails.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HIT_R  = 9;   // px — control-point hit radius
const BSP    = 5;   // kts — assumed boat speed for AWS iso-curves

export class ChartRenderer {
  constructor(bgCanvas, mainCanvas, store) {
    this.bg    = bgCanvas;
    this.cv    = mainCanvas;
    this.bgx   = bgCanvas.getContext('2d');
    this.ctx   = mainCanvas.getContext('2d');
    this.store = store;
    this.pad   = { l: 54, r: 42, t: 32, b: 46 };
    this.W     = 800;
    this.H     = 600;
    this.cursor = null; // { twa, tws } — set by app.js on mousemove
  }

  resize(w, h) {
    this.W = w; this.H = h;
    this.bg.width  = this.cv.width  = w;
    this.bg.height = this.cv.height = h;
    this.drawBackground();
    this.drawSails('select');
  }

  // ── Coordinate transforms ─────────────────────────────────────────────────

  toPixel(dx, dy) {
    const { l, r, t, b } = this.pad;
    return [
      l + (dx - X_MIN) / (X_MAX - X_MIN) * (this.W - l - r),
      this.H - b - (dy - Y_MIN) / (Y_MAX - Y_MIN) * (this.H - t - b),
    ];
  }

  fromPixel(px, py) {
    const { l, r, t, b } = this.pad;
    return [
      X_MIN + (px - l) / (this.W - l - r) * (X_MAX - X_MIN),
      Y_MIN + (this.H - b - py) / (this.H - t - b) * (Y_MAX - Y_MIN),
    ];
  }

  clampData(x, y) {
    return [clamp(x, X_MIN, X_MAX), clamp(y, Y_MIN, Y_MAX)];
  }

  // ── Background ────────────────────────────────────────────────────────────

  drawBackground() {
    const c = this.bgx;
    const { W, H, pad: { l, r, t, b } } = this;
    const cw = W - l - r;
    const ch = H - t - b;

    // Page background
    c.fillStyle = '#d6e0ea';
    c.fillRect(0, 0, W, H);

    // Chart area base — light blue paper
    c.fillStyle = '#dce8f2';
    c.fillRect(l, t, cw, ch);

    // Subtle inner gradient — slightly brighter at centre
    const grd = c.createRadialGradient(l + cw * .5, t + ch * .45, 0, l + cw * .5, t + ch * .5, Math.max(cw, ch) * .7);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(180,200,220,0.0)');
    c.fillStyle = grd;
    c.fillRect(l, t, cw, ch);

    // ── Minor grid ──────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(90,120,160,0.18)';
    c.lineWidth = 0.5;
    for (let x = X_MIN; x <= X_MAX; x += 5) {
      const [px] = this.toPixel(x, 0);
      line(c, px, t, px, H - b);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 2) {
      const [, py] = this.toPixel(0, y);
      line(c, l, py, W - r, py);
    }

    // ── Major grid ──────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(70,100,145,0.30)';
    c.lineWidth = 0.9;
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.toPixel(x, 0);
      line(c, px, t, px, H - b);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.toPixel(0, y);
      line(c, l, py, W - r, py);
    }

    // ── AWS iso-curves ───────────────────────────────────────────────────────
    this._drawAWSCurves(c);

    // ── Chart border ─────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(60,90,130,0.50)';
    c.lineWidth = 1.5;
    c.strokeRect(l, t, cw, ch);

    // ── Tick marks ───────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(60,90,130,0.55)';
    c.lineWidth = 1;
    for (let x = X_MIN; x <= X_MAX; x += 5) {
      const [px] = this.toPixel(x, 0);
      const big  = x % 15 === 0;
      const sz   = big ? 5 : 3;
      // bottom
      line(c, px, H - b, px, H - b + sz);
      // top
      line(c, px, t, px, t - sz);
    }
    for (let y = Y_MIN; y <= Y_MAX; y += 2) {
      const [, py] = this.toPixel(0, y);
      const big = y % 5 === 0;
      const sz  = big ? 5 : 3;
      // left
      line(c, l, py, l - sz, py);
      // right
      line(c, W - r, py, W - r + sz, py);
    }

    // ── Axis labels ──────────────────────────────────────────────────────────
    c.font      = '11px "Azeret Mono", monospace';
    c.fillStyle = 'rgba(40,65,100,0.75)';

    // X — bottom
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.toPixel(x, 0);
      c.fillText(x + '°', px, H - b + 8);
    }

    // X — top
    c.textBaseline = 'bottom';
    for (let x = X_MIN; x <= X_MAX; x += 15) {
      const [px] = this.toPixel(x, 0);
      c.fillText(x + '°', px, t - 8);
    }

    // Y — left
    c.textAlign    = 'right';
    c.textBaseline = 'middle';
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.toPixel(0, y);
      c.fillText(y, l - 10, py);
    }

    // Y — right
    c.textAlign = 'left';
    for (let y = Y_MIN; y <= Y_MAX; y += 5) {
      const [, py] = this.toPixel(0, y);
      c.fillText(y, W - r + 10, py);
    }

    // ── Axis titles ──────────────────────────────────────────────────────────
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

  // ── AWS iso-curves ────────────────────────────────────────────────────────
  // Formula: AWS² = BSP² + TWS² + 2·BSP·TWS·cos(TWA_rad)
  // Solved for TWS: TWS = –BSP·cos(θ) + √(AWS² – BSP²·sin²(θ))
  _drawAWSCurves(c) {
    const { W, H, pad: { l, r, t, b } } = this;
    const cw = W - l - r;
    const ch = H - t - b;

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    const awsValues = [5, 10, 15, 20, 25, 30];

    for (const aws of awsValues) {
      c.beginPath();
      let first = true;
      let labelPx = null, labelPy = null;

      for (let twa = X_MIN; twa <= X_MAX; twa += 0.5) {
        const rad  = twa * Math.PI / 180;
        const disc = aws * aws - BSP * BSP * Math.sin(rad) * Math.sin(rad);
        if (disc < 0) continue;
        const tws = -BSP * Math.cos(rad) + Math.sqrt(disc);
        if (tws < Y_MIN || tws > Y_MAX) continue;

        const [px, py] = this.toPixel(twa, tws);
        if (first) {
          c.moveTo(px, py);
          first = false;
          labelPx = px;
          labelPy = py;
        } else {
          c.lineTo(px, py);
        }
      }

      // Style: dot-dash blue
      c.strokeStyle = 'rgba(40,80,170,0.38)';
      c.lineWidth   = 1;
      c.setLineDash([5, 3, 1, 3]);
      c.stroke();
      c.setLineDash([]);

      // Label at curve entry point (left side)
      if (labelPx !== null) {
        c.font         = '9px "Azeret Mono", monospace';
        c.fillStyle    = 'rgba(30,60,150,0.65)';
        c.textAlign    = 'left';
        c.textBaseline = 'bottom';
        c.fillText('aws' + aws, labelPx + 2, labelPy - 1);
      }
    }

    c.restore();
  }

  // ── Sails ─────────────────────────────────────────────────────────────────

  _rgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ].join(',');
  }

  _splinePath(c, pts) {
    if (pts.length < 2) return;
    const n = pts.length;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const [x0, y0] = this.toPixel(p0.x, p0.y);
      const [x1, y1] = this.toPixel(p1.x, p1.y);
      const [x2, y2] = this.toPixel(p2.x, p2.y);
      const [x3, y3] = this.toPixel(p3.x, p3.y);
      if (i === 0) c.moveTo(x1, y1);
      c.bezierCurveTo(
        x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6,
        x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6,
        x2, y2,
      );
    }
    c.closePath();
  }

  drawSails(mode) {
    const c = this.ctx;
    const { store, W, H, pad: { l, r, t, b } } = this;

    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath();
    c.rect(l, t, W - l - r, H - t - b);
    c.clip();

    // Pass 1 — fills
    for (const s of store.sails) {
      if (!s.visible || s.points.length < 3) continue;
      this._splinePath(c, s.points);
      c.fillStyle = `rgba(${this._rgb(s.color)},${s.opacity})`;
      c.fill();
    }

    // Pass 2 — borders, labels, handles
    for (const s of store.sails) {
      if (!s.visible || s.points.length < 2) continue;
      const sel = s.id === store.selectedId;

      this._splinePath(c, s.points);
      c.strokeStyle = `rgba(${this._rgb(s.color)},${sel ? 1.0 : 0.80})`;
      c.lineWidth   = sel ? 2.5 : 1.5;
      if (sel) c.setLineDash([7, 4]);
      c.stroke();
      c.setLineDash([]);

      // Centroid
      const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
      const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
      const [lpx, lpy] = this.toPixel(cx, cy);

      // Name — bold dark text (like the reference)
      c.font         = `bold ${sel ? 13 : 12}px "Outfit", sans-serif`;
      c.textAlign    = 'center';
      c.textBaseline = 'bottom';
      c.fillStyle    = 'rgba(15,25,40,0.90)';
      c.shadowColor  = 'rgba(255,255,255,0.85)';
      c.shadowBlur   = 4;
      c.fillText(s.name, lpx, lpy - 1);
      c.shadowBlur   = 0;

      // Crosshair (+) marker below the name
      const xhSize = 6;
      const xhY    = lpy + 6;
      c.strokeStyle = `rgba(${this._rgb(s.color)},0.9)`;
      c.lineWidth   = sel ? 1.5 : 1;
      line(c, lpx - xhSize, xhY, lpx + xhSize, xhY);
      line(c, lpx, xhY - xhSize, lpx, xhY + xhSize);

      // Control handles (selected sail only)
      if (sel) {
        for (let i = 0; i < s.points.length; i++) {
          const [hx, hy] = this.toPixel(s.points[i].x, s.points[i].y);
          const del       = mode === 'delpt';

          // Halo
          c.beginPath();
          c.arc(hx, hy, del ? 11 : 9, 0, Math.PI * 2);
          c.fillStyle = del ? 'rgba(192,48,48,0.15)' : `rgba(${this._rgb(s.color)},0.18)`;
          c.fill();

          // Handle
          c.beginPath();
          c.arc(hx, hy, del ? 6 : 5, 0, Math.PI * 2);
          c.fillStyle   = del ? '#d04040' : '#ffffff';
          c.fill();
          c.strokeStyle = del ? '#e06060' : s.color;
          c.lineWidth   = 1.5;
          c.stroke();

          // Index number
          c.font         = '9px "Azeret Mono", monospace';
          c.fillStyle    = del ? '#fff' : 'rgba(20,40,70,0.85)';
          c.textAlign    = 'center';
          c.textBaseline = 'middle';
          c.fillText(i, hx, hy);
        }
      }
    }

    c.restore();

    // Cursor axis indicators (drawn outside clip, on axis margins)
    if (this.cursor) this._drawCursorIndicators(c);
  }

  // ── Cursor indicator boxes on both axes ───────────────────────────────────
  _drawCursorIndicators(c) {
    const { W, H, pad: { l, r, t, b }, cursor } = this;
    if (!cursor) return;
    const { twa, tws } = cursor;
    if (twa < X_MIN || twa > X_MAX || tws < Y_MIN || tws > Y_MAX) return;

    const [cx, cy] = this.toPixel(twa, tws);
    const BOXY = 10, BOXX = 22;

    c.font = 'bold 9px "Azeret Mono", monospace';
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

    // TWA label — top axis
    this._cursorBox(c, cx, t - BOXY / 2 - 7, BOXX, BOXY, Math.round(twa) + '°');
    // TWA label — bottom axis
    this._cursorBox(c, cx, H - b + BOXY / 2 + 7, BOXX, BOXY, Math.round(twa) + '°');

    c.textAlign = 'center';
    const twsLabel = tws.toFixed(1);
    // TWS label — left axis
    this._cursorBox(c, l - 23, cy, 38, BOXY, twsLabel);
    // TWS label — right axis
    this._cursorBox(c, W - r + 23, cy, 38, BOXY, twsLabel);

    // Hairlines
    c.save();
    c.strokeStyle = 'rgba(200,100,20,0.35)';
    c.lineWidth   = 0.5;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.rect(l, t, W - l - r, H - t - b);
    c.clip();
    line(c, cx, t, cx, H - b);
    line(c, l, cy, W - r, cy);
    c.restore();
  }

  _cursorBox(c, cx, cy, w, h, label) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    c.fillStyle   = '#d07018';
    c.beginPath();
    c.roundRect(x, y, w, h, 2);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(label, cx, cy);
  }

  // ── Hit testing ───────────────────────────────────────────────────────────

  hitPoint(px, py, sail) {
    for (let i = 0; i < sail.points.length; i++) {
      const [hx, hy] = this.toPixel(sail.points[i].x, sail.points[i].y);
      if (Math.hypot(px - hx, py - hy) <= HIT_R) return i;
    }
    return -1;
  }

  hitSail(px, py) {
    const { ctx: c, store } = this;
    const sel = store.find(store.selectedId);
    if (sel && sel.visible && sel.points.length >= 3) {
      this._splinePath(c, sel.points);
      if (c.isPointInPath(px, py)) return sel;
    }
    for (let i = store.sails.length - 1; i >= 0; i--) {
      const s = store.sails[i];
      if (!s.visible || s.points.length < 3) continue;
      this._splinePath(c, s.points);
      if (c.isPointInPath(px, py)) return s;
    }
    return null;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportCanvas() {
    const out = document.createElement('canvas');
    out.width  = this.W;
    out.height = this.H;
    const oc = out.getContext('2d');
    oc.drawImage(this.bg, 0, 0);
    oc.drawImage(this.cv, 0, 0);
    return out;
  }
}

// helper: draw a single line segment
function line(c, x1, y1, x2, y2) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
