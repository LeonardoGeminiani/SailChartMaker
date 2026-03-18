import { jsPDF } from 'jspdf';
import { AppActions, EditMode } from './model/types.js';
import { SailStore } from './model/SailStore.js';
import { PolarData } from './model/PolarData.js';
import { CoordinateSystem } from './canvas/CoordinateSystem.js';
import { BackgroundRenderer } from './canvas/BackgroundRenderer.js';
import { SailRenderer } from './canvas/SailRenderer.js';
import { HitTester } from './canvas/HitTester.js';
import { DragHandler } from './interaction/DragHandler.js';
import { InputController } from './interaction/InputController.js';
import { SidebarPanel } from './ui/SidebarPanel.js';
import { AddSailModal } from './ui/AddSailModal.js';

// ── App ───────────────────────────────────────────────────────────────────────
export class App implements AppActions {
  mode: EditMode = 'select';

  private readonly store:    SailStore;
  private readonly coords:   CoordinateSystem;
  private readonly bgRend:   BackgroundRenderer;
  private readonly sailRend: SailRenderer;
  private readonly hitTest:  HitTester;
  private readonly drag:     DragHandler;
  private readonly input:    InputController;
  private readonly sidebar:  SidebarPanel;
  private readonly modal:    AddSailModal;

  private readonly bgCanvas:   HTMLCanvasElement;
  private readonly mainCanvas: HTMLCanvasElement;

  // Canvas proportion
  private ratio   = 297 / 210; // default: A4 horizontal
  private resolution = 1;
  private static readonly LEGEND_W = 130; // logical px reserved for the legend
  private lastAreaW = 0;
  private lastAreaH = 0;

  static readonly RATIOS: Record<string, number> = {
    a4h: 297 / 210,
    a4v: 210 / 297,
    sq:  1,
  };

  constructor() {
    this.bgCanvas   = document.getElementById('bgCanvas')   as HTMLCanvasElement;
    this.mainCanvas = document.getElementById('mainCanvas') as HTMLCanvasElement;

    this.store    = new SailStore();
    this.coords   = new CoordinateSystem();
    this.bgRend   = new BackgroundRenderer(this.bgCanvas, this.coords);
    this.sailRend = new SailRenderer(this.mainCanvas, this.coords, this.store);
    this.hitTest  = new HitTester(this.mainCanvas, this.coords, this.store);
    this.drag     = new DragHandler(this.coords);

    this.sidebar = new SidebarPanel(
      this.store,
      id => this.selectSail(id),
      ()  => this.deleteSelected(),
      ()  => this.redraw(),
      id  => this.selectSpline(id),
      ()  => this.deleteSelected(),
    );

    this.modal = new AddSailModal(this.store, sail => {
      this.selectSail(sail.id);
      this.sidebar.renderList();
      this.sidebar.updateUndoButtons();
      this.redraw();
    });

    this.input = new InputController(
      this.mainCanvas,
      this.store,
      this.coords,
      this.hitTest,
      this.drag,
      this.sailRend,
      this,
      (twa, tws, sailName) => this._onCursorMove(twa, tws, sailName),
    );
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  init(): void {
    const area = document.getElementById('chartArea')!;

    new ResizeObserver(entries => {
      const { width: areaW, height: areaH } = entries[0].contentRect;
      this._applySize(areaW, areaH);
    }).observe(area);

    this.sidebar.setupEditorListeners();
    this.sidebar.setupSplineEditorListeners();
    this.sidebar.renderList();
    this.sidebar.renderAnnotations();
    this.sidebar.renderSplines();
    this.sidebar.updateUndoButtons();
    this.modal.setup();
    this.input.setup();
    this._setupToolbar();
    this._applySettings(this.store.chartSettings);
    this._setModeButtons('select');
    this._watchDPR();
  }

  // ── AppActions ───────────────────────────────────────────────────────────────
  selectSail(id: number | null): void {
    this.store.select(id);
    if (id !== null) {
      this.store.selectSpline(null);
      this.sidebar.closeSplineEditor();
      this.sailRend.selectedSplineId = null;
      const s = this.store.find(id);
      this.sidebar.openEditor(s?.name ?? '');
      this.sidebar.syncEditor();
    } else {
      this.sidebar.closeEditor();
    }
    this.sidebar.renderList();
    this.redraw();
  }

  selectSpline(id: number | null): void {
    this.store.selectSpline(id);
    if (id !== null) {
      this.store.select(null);           // deselect sail
      this.sidebar.closeEditor();
      const sp = this.store.findSpline(id);
      this.sidebar.openSplineEditor(sp?.name ?? '');
      this.sidebar.syncSplineEditor();
    } else {
      this.sidebar.closeSplineEditor();
    }
    this.sailRend.selectedSplineId = id;
    this.sidebar.renderSplines();
    this.redraw();
  }

  setMode(mode: EditMode): void {
    this.mode = mode;
    this._setModeButtons(mode);

    const labels = { select: 'Select', addpt: 'Add Point', delpt: 'Del Point' };
    const hints: Record<EditMode, string> = {
      select: 'Drag handles to reshape · Drag region to move · <kbd>Del</kbd> removes selected',
      addpt:  'Click near an edge to insert a new point',
      delpt:  'Click a handle to remove it (min 3 points)',
    };
    const stMode = document.getElementById('stMode');
    const hint   = document.getElementById('hintText');
    if (stMode) stMode.textContent  = labels[mode];
    if (hint)   hint.innerHTML      = hints[mode];
    this.redraw();
  }

  deleteSelected(): void {
    if (this.store.selectedSplineId !== null) {
      this.store.removeSpline(this.store.selectedSplineId);
      this.selectSpline(null);
      this.sidebar.renderSplines();
      this.sidebar.updateUndoButtons();
      this.redraw();
      return;
    }
    if (this.store.selectedId === null) return;
    this.store.remove(this.store.selectedId);
    this.selectSail(null);
    this.sidebar.updateUndoButtons();
    this.redraw();
  }

  undo(): void {
    if (this.store.undo()) {
      this.selectSail(this.store.selectedId);
      this.sidebar.renderList();
      this.sidebar.renderAnnotations();
      this.sidebar.renderSplines();
      this.sidebar.updateUndoButtons();
      this.sailRend.selectedSplineId = this.store.selectedSplineId;
      if (this.store.selectedSplineId !== null) this.sidebar.syncSplineEditor();
      this.redraw();
    }
  }

  redo(): void {
    if (this.store.redo()) {
      this.selectSail(this.store.selectedId);
      this.sidebar.renderList();
      this.sidebar.renderAnnotations();
      this.sidebar.renderSplines();
      this.sidebar.updateUndoButtons();
      this.sailRend.selectedSplineId = this.store.selectedSplineId;
      if (this.store.selectedSplineId !== null) this.sidebar.syncSplineEditor();
      this.redraw();
    }
  }

  redraw(): void {
    this.sailRend.draw(this.mode);
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────────
  private _setupToolbar(): void {
    this._btn('btn_select', () => this.setMode('select'));
    this._btn('btn_addpt',  () => this.setMode('addpt'));
    this._btn('btn_delpt',  () => this.setMode('delpt'));

    this._btn('btnUndo', () => this.undo());
    this._btn('btnRedo', () => this.redo());

    // ── Add label ─────────────────────────────────────────────────────────────
    this._btn('btnAddLabel', () => {
      const cx = (this.coords.twaMin + this.coords.twaMax) / 2;
      const cy = (this.coords.twsMin + this.coords.twsMax) / 2;
      this.store.addAnnotation('Label', cx, cy);
      this.sidebar.renderAnnotations();
      this.redraw();
    });

    // ── Add spline ────────────────────────────────────────────────────────────
    this._btn('btnAddSpline', () => {
      const sp = this.store.addSpline({
        twaMin: this.coords.twaMin, twaMax: this.coords.twaMax,
        twsMin: this.coords.twsMin, twsMax: this.coords.twsMax,
      });
      this.selectSpline(sp.id);
      this.sidebar.renderSplines();
      this.sidebar.updateUndoButtons();
      this.redraw();
    });

    // ── Sidebar tabs ─────────────────────────────────────────────────────────
    const panelsTrack = document.getElementById('panelsTrack')!;
    const tabSails    = document.getElementById('tabSails')!;
    const tabChart    = document.getElementById('tabChart')!;
    const switchTab = (toAppearance: boolean) => {
      panelsTrack.classList.toggle('show-appearance', toAppearance);
      tabSails.classList.toggle('active', !toAppearance);
      tabChart.classList.toggle('active',  toAppearance);
    };
    tabSails.addEventListener('click', () => switchTab(false));
    tabChart.addEventListener('click', () => switchTab(true));

    // ── AWS polar load ────────────────────────────────────────────────────────
    const awsToggle  = document.getElementById('toggleAWS')  as HTMLInputElement;
    const polarHint  = document.getElementById('polarHint')!;
    const polarInput = document.getElementById('polarInput') as HTMLInputElement;

    awsToggle?.addEventListener('change', () => {
      this.bgRend.showAWS = awsToggle.checked;
      this.store.chartSettings.showAWS = awsToggle.checked;
      this.store.save();
      this.bgRend.draw();
    });

    const bspToggle = document.getElementById('toggleBSP') as HTMLInputElement | null;
    bspToggle?.addEventListener('change', () => {
      this.bgRend.showBSP = bspToggle.checked;
      this.store.chartSettings.showBSP = bspToggle.checked;
      this.store.save();
      this.bgRend.draw();
    });

    const bspStepVal = document.getElementById('bspStepVal')!;
    const updateBspStep = (delta: number) => {
      const next = Math.max(1, (this.store.chartSettings.bspLabelStep ?? 2) + delta);
      this.store.chartSettings.bspLabelStep = next;
      this.bgRend.bspLabelStep = next;
      bspStepVal.textContent = String(next);
      this.store.save();
      this.bgRend.draw();
    };
    this._btn('bspStepDec', () => updateBspStep(-1));
    this._btn('bspStepInc', () => updateBspStep(+1));

    const bspFontVal = document.getElementById('bspFontVal')!;
    const updateBspFont = (delta: number) => {
      const next = Math.max(1, (this.store.chartSettings.bspFontSize ?? 9) + delta);
      this.store.chartSettings.bspFontSize = next;
      this.bgRend.bspFontSize = next;
      bspFontVal.textContent = String(next);
      this.store.save();
      this.bgRend.draw();
    };
    this._btn('bspFontDec', () => updateBspFont(-1));
    this._btn('bspFontInc', () => updateBspFont(+1));

    const bspColorPicker = document.getElementById('bspColor') as HTMLInputElement;
    bspColorPicker?.addEventListener('input', () => {
      this.bgRend.bspColor = bspColorPicker.value;
      this.store.chartSettings.bspColor = bspColorPicker.value;
      this.store.save();
      this.bgRend.draw();
    });


    const twsRevToggle = document.getElementById('toggleTWSReversed') as HTMLInputElement | null;
    twsRevToggle?.addEventListener('change', () => {
      this.coords.twsReversed = twsRevToggle.checked;
      this.store.chartSettings.twsReversed = twsRevToggle.checked;
      this.store.save();
      this.bgRend.draw();
      this.redraw();
    });

    const legendToggle = document.getElementById('toggleLegend') as HTMLInputElement | null;
    legendToggle?.addEventListener('change', () => {
      const show = legendToggle.checked;
      this.coords.legendWidth      = show ? App.LEGEND_W / (window.devicePixelRatio || 1) : 0;
      this.bgRend.showLegend       = show;
      this.sailRend.showLegend     = show;
      this.store.chartSettings.showLegend = show;
      this.store.save();
      this.bgRend.draw();
      this.redraw();
    });

    const cursorToggle = document.getElementById('toggleCursor') as HTMLInputElement | null;
    cursorToggle?.addEventListener('change', () => {
      this.sailRend.showCursor = cursorToggle.checked;
      this.store.chartSettings.showCursor = cursorToggle.checked;
      this.store.save();
      this.redraw();
    });

    this._btn('btnLoadPolar', () => polarInput.click());
    polarInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const polar = PolarData.fromCSV(ev.target!.result as string, file.name);
          this.bgRend.polar = polar;
          awsToggle.disabled = false;
          if (bspToggle) bspToggle.disabled = false;
          polarHint.textContent = polar.name;
          polarHint.classList.add('polar-hint--loaded');
          this.bgRend.draw();
        } catch (err) {
          alert('Error loading polar: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
      polarInput.value = '';
    });

    // ── Background color ──────────────────────────────────────────────────────
    const bgColorPicker = document.getElementById('bgColor') as HTMLInputElement;
    bgColorPicker?.addEventListener('input', () => {
      this.bgRend.bgColor = bgColorPicker.value;
      this.store.chartSettings.bgColor = bgColorPicker.value;
      this.store.save();
      this.bgRend.draw();
    });

    // ── Axis font size ────────────────────────────────────────────────────────
    const fontSizeVal = document.getElementById('fontSizeVal')!;
    const updateFontSize = (delta: number) => {
      this.bgRend.fontSize = Math.max(1, this.bgRend.fontSize + delta);
      this.sailRend.axisFontSize = this.bgRend.fontSize;
      this.store.chartSettings.fontSize = this.bgRend.fontSize;
      fontSizeVal.textContent = String(this.bgRend.fontSize);
      this.store.save();
      this.bgRend.draw();
    };
    this._btn('fontSizeDec', () => updateFontSize(-1));
    this._btn('fontSizeInc', () => updateFontSize(+1));

    // ── Sail label font size ──────────────────────────────────────────────────
    const sailLabelFontSizeVal = document.getElementById('sailLabelFontSizeVal')!;
    const updateSailLabelFontSize = (delta: number) => {
      this.sailRend.sailLabelFontSize = Math.max(1, this.sailRend.sailLabelFontSize + delta);
      this.store.chartSettings.sailLabelFontSize = this.sailRend.sailLabelFontSize;
      sailLabelFontSizeVal.textContent = String(this.sailRend.sailLabelFontSize);
      this.store.save();
      this.redraw();
    };
    this._btn('sailLabelFontSizeDec', () => updateSailLabelFontSize(-1));
    this._btn('sailLabelFontSizeInc', () => updateSailLabelFontSize(+1));

    // ── Pattern scale ────────────────────────────────────────────────────────
    const patternScaleVal = document.getElementById('patternScaleVal')!;
    const updatePatternScale = (delta: number) => {
      const next = Math.max(0.5, Math.round((this.store.chartSettings.patternScale + delta) * 10) / 10);
      this.store.chartSettings.patternScale = next;
      this.sailRend.patternScale = next;
      patternScaleVal.textContent = next.toFixed(1);
      this.store.save();
      this.redraw();
    };
    this._btn('patternScaleDec', () => updatePatternScale(-0.5));
    this._btn('patternScaleInc', () => updatePatternScale(+0.5));

    // ── Pattern thickness ────────────────────────────────────────────────────
    const patternThicknessVal = document.getElementById('patternThicknessVal')!;
    const updatePatternThickness = (delta: number) => {
      const next = Math.max(0.5, Math.round((this.store.chartSettings.patternThickness + delta) * 10) / 10);
      this.store.chartSettings.patternThickness = next;
      this.sailRend.patternThickness = next;
      patternThicknessVal.textContent = next.toFixed(1);
      this.store.save();
      this.redraw();
    };
    this._btn('patternThicknessDec', () => updatePatternThickness(-0.5));
    this._btn('patternThicknessInc', () => updatePatternThickness(+0.5));

    // ── Chart margin ─────────────────────────────────────────────────────────
    const chartMarginVal = document.getElementById('chartMarginVal')!;
    const updateChartMargin = (delta: number) => {
      const next = (this.store.chartSettings.chartMargin ?? 0) + delta;
      this.store.chartSettings.chartMargin = next;
      this.coords.setMargin(next);
      chartMarginVal.textContent = String(next);
      this.store.save();
      this.bgRend.draw();
      this.redraw();
    };
    this._btn('chartMarginDec', () => updateChartMargin(-5));
    this._btn('chartMarginInc', () => updateChartMargin(+5));

    // ── Smoothing ─────────────────────────────────────────────────────────────
    const smoothingRange = document.getElementById('smoothingRange') as HTMLInputElement;
    const smoothingVal   = document.getElementById('smoothingVal')!;
    smoothingRange?.addEventListener('input', () => {
      this.bgRend.smoothing = Number(smoothingRange.value);
      this.store.chartSettings.smoothing = this.bgRend.smoothing;
      smoothingVal.textContent = smoothingRange.value;
      this.store.save();
      this.bgRend.draw();
    });

    // ── Axis range ────────────────────────────────────────────────────────────
    const axisInput = (id: string, setter: (v: number) => void) => {
      const el = document.getElementById(id) as HTMLInputElement;
      el?.addEventListener('change', () => {
        const v = Number(el.value);
        if (!isFinite(v)) return;
        setter(v);
        this.store.save();
        this.bgRend.draw();
        this.redraw();
      });
    };
    axisInput('twaMin', v => { this.coords.twaMin = v; this.store.chartSettings.twaMin = v; });
    axisInput('twaMax', v => { this.coords.twaMax = v; this.store.chartSettings.twaMax = v; });
    axisInput('twsMin', v => { this.coords.twsMin = v; this.store.chartSettings.twsMin = v; });
    axisInput('twsMax', v => { this.coords.twsMax = v; this.store.chartSettings.twsMax = v; });

    // ── Stroke widths ─────────────────────────────────────────────────────────
    const strokeSlider = (id: string, valId: string, setter: (v: number) => void) => {
      const el  = document.getElementById(id)    as HTMLInputElement;
      const val = document.getElementById(valId)!;
      el?.addEventListener('input', () => {
        setter(Number(el.value));
        val.textContent = el.value;
        this.store.save();
        this.bgRend.draw();
      });
    };
    strokeSlider('vmgStroke',  'vmgStrokeVal',  v => { this.bgRend.vmgStrokeWidth  = v; this.store.chartSettings.vmgStrokeWidth  = v; });
    strokeSlider('awsStroke',  'awsStrokeVal',  v => { this.bgRend.awsStrokeWidth  = v; this.store.chartSettings.awsStrokeWidth  = v; });
    strokeSlider('axisStroke', 'axisStrokeVal', v => { this.bgRend.axisStrokeScale = v; this.store.chartSettings.axisStrokeScale = v; });

    // ── Canvas resolution ─────────────────────────────────────────────────────
    const resSelect = document.getElementById('canvasRes') as HTMLSelectElement;
    resSelect?.addEventListener('change', () => {
      this.resolution = Number(resSelect.value);
      this.store.chartSettings.resolution = this.resolution;
      this.store.save();
      this._applySize(this.lastAreaW, this.lastAreaH);
    });

    // ── File I/O ──────────────────────────────────────────────────────────────
    this._btn('btnLoadXML', () => (document.getElementById('fileInput') as HTMLInputElement).click());
    this._btn('btnSaveXML', () => {
      this._download(
        URL.createObjectURL(new Blob([this.store.toXML()], { type: 'application/xml' })),
        'SailChart.xml',
      );
    });
    this._btn('btnExportPNG', () => {
      this._download(this.sailRend.exportWith(this.bgCanvas).toDataURL('image/png'), 'SailChart.png');
    });
    this._btn('btnExportPDF', () => this._exportPDF());

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          this.store.fromXML(ev.target!.result as string);
          this._applySettings(this.store.chartSettings);
          this.selectSail(null);
          this.selectSpline(null);
          this.sidebar.renderList();
          this.sidebar.renderAnnotations();
          this.sidebar.renderSplines();
          this.sidebar.updateUndoButtons();
          this.redraw();
        } catch (err) {
          alert('Error loading file: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  // ── Apply chart settings to renderers + sync all UI controls ─────────────────
  private _applySettings(s: import('./model/types.js').ChartSettings): void {
    this.bgRend.bgColor             = s.bgColor;
    this.bgRend.fontSize            = s.fontSize;
    this.sailRend.axisFontSize      = s.fontSize;
    this.sailRend.sailLabelFontSize = s.sailLabelFontSize;
    this.sailRend.patternScale      = s.patternScale     ?? 1;
    this.sailRend.patternThickness  = s.patternThickness ?? 1;
    this.bgRend.smoothing         = s.smoothing;
    this.bgRend.vmgStrokeWidth  = s.vmgStrokeWidth;
    this.bgRend.awsStrokeWidth  = s.awsStrokeWidth;
    this.bgRend.axisStrokeScale = s.axisStrokeScale;
    this.bgRend.showAWS         = s.showAWS && this.bgRend.polar !== null;
    this.bgRend.showBSP      = (s.showBSP ?? false) && this.bgRend.polar !== null;
    this.bgRend.bspLabelStep = s.bspLabelStep ?? 2;
    this.bgRend.bspFontSize  = s.bspFontSize  ?? 9;
    this.bgRend.bspColor     = s.bspColor     ?? '#128048';
    this.coords.twaMin          = s.twaMin;
    this.coords.twaMax          = s.twaMax;
    this.coords.twsMin          = s.twsMin;
    this.coords.twsMax          = s.twsMax;
    this.coords.twsReversed     = s.twsReversed ?? false;
    this.coords.legendWidth  = (s.showLegend ?? false) ? App.LEGEND_W / (window.devicePixelRatio || 1) : 0;
    this.bgRend.showLegend   = s.showLegend ?? false;
    this.sailRend.showLegend = s.showLegend ?? false;
    this.sailRend.showCursor = s.showCursor ?? false;
    this.coords.setMargin(s.chartMargin ?? 0);
    // Normalize legacy multiplier values (1, 2, 3) to 0 (screen mode)
    this.resolution = s.resolution <= 3 ? 0 : s.resolution;

    const set = <T extends HTMLInputElement | HTMLSelectElement>(id: string, v: string) => {
      const el = document.getElementById(id) as T | null;
      if (el) el.value = v;
    };
    const setText = (id: string, v: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    set('bgColor',       s.bgColor);
    set('smoothingRange', String(s.smoothing));    setText('smoothingVal',  String(s.smoothing));
    setText('fontSizeVal',          String(s.fontSize));
    setText('sailLabelFontSizeVal', String(s.sailLabelFontSize));
    setText('patternScaleVal',     (s.patternScale     ?? 1).toFixed(1));
    setText('patternThicknessVal', (s.patternThickness ?? 1).toFixed(1));
    set('vmgStroke',     String(s.vmgStrokeWidth)); setText('vmgStrokeVal',  String(s.vmgStrokeWidth));
    set('awsStroke',     String(s.awsStrokeWidth)); setText('awsStrokeVal',  String(s.awsStrokeWidth));
    set('axisStroke',    String(s.axisStrokeScale));setText('axisStrokeVal', String(s.axisStrokeScale));
    set('twaMin', String(s.twaMin)); set('twaMax', String(s.twaMax));
    set('twsMin', String(s.twsMin)); set('twsMax', String(s.twsMax));
    set('canvasRes', String(this.resolution));
    setText('chartMarginVal', String(s.chartMargin ?? 0));

    const awsTog = document.getElementById('toggleAWS') as HTMLInputElement | null;
    if (awsTog) awsTog.checked = this.bgRend.showAWS;
    const bspTog = document.getElementById('toggleBSP') as HTMLInputElement | null;
    if (bspTog) bspTog.checked = this.bgRend.showBSP;
    setText('bspStepVal', String(s.bspLabelStep ?? 2));
    setText('bspFontVal', String(s.bspFontSize  ?? 9));
    set('bspColor', s.bspColor ?? '#128048');
    const twsRevTog = document.getElementById('toggleTWSReversed') as HTMLInputElement | null;
    if (twsRevTog) twsRevTog.checked = s.twsReversed ?? false;
    const legendTog = document.getElementById('toggleLegend') as HTMLInputElement | null;
    if (legendTog) legendTog.checked = s.showLegend ?? false;
    const cursorTog = document.getElementById('toggleCursor') as HTMLInputElement | null;
    if (cursorTog) cursorTog.checked = s.showCursor ?? false;

    this._applySize(this.lastAreaW, this.lastAreaH);
  }

  // ── Cursor / status bar ───────────────────────────────────────────────────────
  private _onCursorMove(twa: number, tws: number, sailName: string | null): void {
    if (this.coords.isInBounds(twa, tws)) {
      const stAngle = document.getElementById('stAngle');
      const stSpeed = document.getElementById('stSpeed');
      const stSail  = document.getElementById('stSail');
      if (stAngle) stAngle.textContent = `${Math.round(twa)}°`;
      if (stSpeed) stSpeed.textContent = `${tws.toFixed(1)} kts`;
      if (stSail)  stSail.textContent  = sailName ?? '—';
      this.sailRend.cursor = { twa, tws };
    } else {
      this.sailRend.cursor = null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private _setModeButtons(mode: EditMode): void {
    (['select', 'addpt', 'delpt'] as EditMode[]).forEach(k => {
      document.getElementById('btn_' + k)?.classList.toggle('active', k === mode);
    });
  }

  private _btn(id: string, fn: () => void): void {
    document.getElementById(id)?.addEventListener('click', fn);
  }

  private _exportPDF(): void {
    const canvas = this.sailRend.exportWith(this.bgCanvas);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    // Determine orientation from canvas aspect ratio
    const landscape = canvas.width >= canvas.height;
    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Fit image to page with uniform margins
    const margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    const imgW = canvas.width  * scale;
    const imgH = canvas.height * scale;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;
    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
    pdf.save('SailChart.pdf');
  }

  private _download(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href; a.download = filename; a.click();
  }

  /** Apply canvas dimensions for the stored ratio, centred in the given area. */
  private _applySize(areaW: number, areaH: number): void {
    this.lastAreaW = areaW;
    this.lastAreaH = areaH;

    let w = areaW;
    let h = Math.round(w / this.ratio);
    if (h > areaH) { h = areaH; w = Math.round(h * this.ratio); }

    const left = Math.round((areaW - w) / 2);
    const top  = Math.round((areaH - h) / 2);

    for (const cv of [this.bgCanvas, this.mainCanvas]) {
      cv.style.left = `${left}px`;
      cv.style.top  = `${top}px`;
    }

    // dpr keeps fonts/UI zoom-independent; effectiveRes sets canvas pixel count.
    const dpr = window.devicePixelRatio || 1;
    const effectiveRes = this.resolution === 0
      ? dpr                       // "Screen" mode: match device pixels
      : this.resolution / w;      // pixel-target mode: e.g. 1920 / logicalW
    this.bgRend.dpr      = dpr;
    this.sailRend.dpr    = dpr;
    this.bgRend.resolution   = effectiveRes;
    this.sailRend.resolution = effectiveRes;
    this.hitTest.resolution  = effectiveRes;
    // legendWidth in _px units (= LEGEND_W physical px) so it stays zoom-stable
    if (this.bgRend.showLegend) this.coords.legendWidth = App.LEGEND_W / dpr;
    this.bgRend.resize(w, h);
    this.sailRend.resize(w, h);
    this.redraw();
  }

  /** Re-register a matchMedia listener each time devicePixelRatio changes
   *  (browser zoom, moving the window between displays). */
  private _watchDPR(): void {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => {
      this._applySize(this.lastAreaW, this.lastAreaH);
      this._watchDPR();
    }, { once: true });
  }
}
