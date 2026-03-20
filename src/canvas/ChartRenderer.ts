import { SailData, LabelAnnotation, EditMode, CursorPosition } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem } from './CoordinateSystem.js';
import { FillPatternMaker } from './sail/FillPatternMaker.js';
import { SailRenderer } from './sail/SailRenderer.js';
import { SplineRenderer } from './sail/SplineRenderer.js';
import { AnnotationRenderer } from './sail/AnnotationRenderer.js';
import { LegendRenderer } from './overlay/LegendRenderer.js';
import { CursorRenderer } from './overlay/CursorRenderer.js';

// ── ChartRenderer ─────────────────────────────────────────────────────────────
export class ChartRenderer {
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

  private readonly _patterns  : FillPatternMaker;
  private readonly _sailRend  : SailRenderer;
  private readonly _splineRend: SplineRenderer;
  private readonly _annotRend : AnnotationRenderer;
  private readonly _legend    : LegendRenderer;
  private readonly _cursor    : CursorRenderer;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coords: CoordinateSystem,
    private readonly store: SailStore,
  ) {
    this.ctx          = canvas.getContext('2d')!;
    this._patterns    = new FillPatternMaker();
    this._sailRend    = new SailRenderer(coords, store, this._patterns);
    this._splineRend  = new SplineRenderer(coords);
    this._annotRend   = new AnnotationRenderer(coords);
    this._legend      = new LegendRenderer(coords, this._patterns);
    this._cursor      = new CursorRenderer(coords);
  }

  private _sync(): void {
    const { resolution, dpr, patternScale, patternThickness, sailLabelFontSize,
            axisFontSize, selectedSplineId, cursor, showCursor, dragging } = this;

    this._patterns.resolution        = resolution;
    this._patterns.patternScale      = patternScale;
    this._patterns.patternThickness  = patternThickness;

    this._sailRend.dpr               = dpr;
    this._sailRend.sailLabelFontSize = sailLabelFontSize;

    this._splineRend.dpr               = dpr;
    this._splineRend.sailLabelFontSize = sailLabelFontSize;
    this._splineRend.selectedSplineId  = selectedSplineId;

    this._annotRend.dpr               = dpr;
    this._annotRend.sailLabelFontSize = sailLabelFontSize;

    this._legend.dpr               = dpr;
    this._legend.sailLabelFontSize = sailLabelFontSize;

    this._cursor.dpr          = dpr;
    this._cursor.axisFontSize = axisFontSize;
    this._cursor.cursor       = cursor;
    this._cursor.showCursor   = showCursor;
    this._cursor.dragging     = dragging;
  }

  resize(w: number, h: number): void {
    this.canvas.width        = Math.round(w * this.resolution);
    this.canvas.height       = Math.round(h * this.resolution);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  draw(mode: EditMode): void {
    this._sync();

    const c = this.ctx;
    const res = this.resolution;
    const { x: l, y: t, w: cw, h: ch } = this.coords.chartRect;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(res, 0, 0, res, 0, 0);

    c.save();
    c.beginPath();
    c.rect(l, t, cw, ch);
    c.clip();

    this._sailRend.draw(c, mode);
    this._annotRend.draw(c, this.store.annotations);
    this._splineRend.draw(c, this.store.splines, mode);

    c.restore();

    if (this.showLegend) this._legend.draw(c, this.store.sails);
    this._cursor.draw(c);
  }

  getLabelPixelPos(s: SailData): [number, number] {
    return this._sailRend.getLabelPixelPos(s);
  }

  getAnnotationPixelPos(a: LabelAnnotation): [number, number] {
    return this._annotRend.getAnnotationPixelPos(a);
  }

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
