import { AppActions, EditMode } from './model/types.js';
import { SailStore } from './model/SailStore.js';
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
    this.sidebar.renderList();
    this.sidebar.updateUndoButtons();
    this.modal.setup();
    this.input.setup();
    this._setupToolbar();
    this._setModeButtons('select');
  }

  // ── AppActions ───────────────────────────────────────────────────────────────
  selectSail(id: number | null): void {
    this.store.select(id);
    this.sidebar.renderList();
    if (id !== null) {
      const s = this.store.find(id);
      this.sidebar.openEditor(s?.name ?? '');
      this.sidebar.syncEditor();
    } else {
      this.sidebar.closeEditor();
    }
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
      this.sidebar.updateUndoButtons();
      this.redraw();
    }
  }

  redo(): void {
    if (this.store.redo()) {
      this.selectSail(this.store.selectedId);
      this.sidebar.renderList();
      this.sidebar.updateUndoButtons();
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

    // ── Chart Settings modal ──────────────────────────────────────────────────
    const settingsModal = document.getElementById('chartSettingsModal')!;
    this._btn('btnChartSettings', () => { settingsModal.classList.add('open'); });
    this._btn('chartSettingsClose', () => { settingsModal.classList.remove('open'); });
    settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) settingsModal.classList.remove('open');
    });

    const awsToggle = document.getElementById('toggleAWS') as HTMLInputElement;
    awsToggle?.addEventListener('change', () => {
      this.bgRend.showAWS = awsToggle.checked;
      this.bgRend.draw();
    });

    const bgColorPicker = document.getElementById('bgColor') as HTMLInputElement;
    bgColorPicker?.addEventListener('input', () => {
      this.bgRend.bgColor = bgColorPicker.value;
      this.bgRend.draw();
    });

    const fontSizeVal = document.getElementById('fontSizeVal')!;
    const updateFontSize = (delta: number) => {
      this.bgRend.fontSize = Math.min(18, Math.max(7, this.bgRend.fontSize + delta));
      fontSizeVal.textContent = String(this.bgRend.fontSize);
      this.bgRend.draw();
    };
    this._btn('fontSizeDec', () => updateFontSize(-1));
    this._btn('fontSizeInc', () => updateFontSize(+1));

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
    this._btn('btnPrint', () => window.print());

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          this.store.fromXML(ev.target!.result as string);
          this.selectSail(null);
          this.sidebar.renderList();
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

    this.bgRend.resize(w, h);
    this.sailRend.resize(w, h);
    this.redraw();
  }
}
