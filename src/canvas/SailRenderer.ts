import { SailData, LabelAnnotation, EditMode, CursorPosition } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem, splinePath2D } from './CoordinateSystem.js';
import { hexToRgb } from './renderUtils.js';
import { FillPatternMaker } from './FillPatternMaker.js';
import { HandleRenderer } from './HandleRenderer.js';
import { AnnotationRenderer } from './AnnotationRenderer.js';
import { LegendRenderer } from './LegendRenderer.js';
import { CursorRenderer } from './CursorRenderer.js';

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
  dragging           = false;

  private readonly _patterns  = new FillPatternMaker();
  private readonly _handles   : HandleRenderer;
  private readonly _annots    : AnnotationRenderer;
  private readonly _legend    : LegendRenderer;
  private readonly _cursor    : CursorRenderer;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    this.ctx      = canvas.getContext('2d')!;
    this._handles = new HandleRenderer(coords);
    this._annots  = new AnnotationRenderer(coords);
    this._legend  = new LegendRenderer(coords, this._patterns);
    this._cursor  = new CursorRenderer(coords);
  }

  private _syncSubRenderers(): void {
    const { resolution, dpr, patternScale, patternThickness, sailLabelFontSize,
            axisFontSize, selectedSplineId, cursor, showCursor, dragging } = this;

    this._patterns.resolution        = resolution;
    this._patterns.patternScale      = patternScale;
    this._patterns.patternThickness  = patternThickness;

    this._handles.dpr                = dpr;
    this._handles.sailLabelFontSize  = sailLabelFontSize;
    this._handles.selectedSplineId   = selectedSplineId;

    this._annots.dpr                 = dpr;
    this._annots.sailLabelFontSize   = sailLabelFontSize;

    this._legend.dpr                 = dpr;
    this._legend.sailLabelFontSize   = sailLabelFontSize;

    this._cursor.dpr                 = dpr;
    this._cursor.axisFontSize        = axisFontSize;
    this._cursor.cursor              = cursor;
    this._cursor.showCursor          = showCursor;
    this._cursor.dragging            = dragging;
  }

  resize(w: number, h: number): void {
    this.canvas.width        = Math.round(w * this.resolution);
    this.canvas.height       = Math.round(h * this.resolution);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  draw(mode: EditMode): void {
    this._syncSubRenderers();

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
        const pattern = this._patterns.make(c, s.color, pat, s.patternDash ?? 4);
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

      if (s.showLabel !== false) this._annots.drawSailLabel(c, s, sel);
      if (sel) this._handles.drawSailHandles(c, s, mode);
    }

    this._annots.drawAnnotations(c, this.store.annotations);
    this._handles.drawSplines(c, this.store.splines, mode);

    c.restore();

    if (this.showLegend) this._legend.draw(c, this.store.sails);
    this._cursor.draw(c);
  }

  /** Returns the label anchor pixel position, accounting for any labelOffset. */
  getLabelPixelPos(s: SailData): [number, number] {
    return this._annots.getLabelPixelPos(s);
  }

  getAnnotationPixelPos(a: LabelAnnotation): [number, number] {
    return this._annots.getAnnotationPixelPos(a);
  }

  /** Composite bgCanvas + mainCanvas into a new canvas for PNG export. */
  exportWith(bgCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width  = this.canvas.width;
    out.height = this.canvas.height;
    const oc = out.getContext('2d')!;
    oc.drawImage(bgCanvas, 0, 0);
    oc.drawImage(this.canvas, 0, 0);
    return out;
  }
}
