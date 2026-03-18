import { AppActions } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';
import { CoordinateSystem } from '../canvas/CoordinateSystem.js';
import { HitTester } from '../canvas/HitTester.js';
import { SailRenderer } from '../canvas/SailRenderer.js';
import { DragHandler } from './DragHandler.js';

type CursorMoveCb = (twa: number, tws: number, sailName: string | null) => void;

const LABEL_HIT_R = 30; // px radius around label anchor that counts as a hit

// ── InputController ───────────────────────────────────────────────────────────
export class InputController {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: SailStore,
    private readonly coords: CoordinateSystem,
    private readonly hitTester: HitTester,
    private readonly drag: DragHandler,
    private readonly sailRend: SailRenderer,
    private readonly actions: AppActions,
    private readonly onCursorMove: CursorMoveCb,
  ) {}

  setup(): void {
    const cv = this.canvas;
    cv.addEventListener('pointerdown',   e => { cv.setPointerCapture(e.pointerId); this._onDown(e); });
    cv.addEventListener('pointermove',   e => this._onMove(e));
    cv.addEventListener('pointerup',     () => this._onUp());
    cv.addEventListener('pointercancel', () => this._onUp());
    cv.addEventListener('pointerleave',  () => { this._onUp(); this.onCursorMove(0, 0, null); this.actions.redraw(); });
    document.addEventListener('keydown', e => this._onKey(e));
  }

  // ── Pointer down ────────────────────────────────────────────────────────────
  private _onDown(e: PointerEvent): void {
    const [px, py] = this._pos(e);
    const mode = this.actions.mode;

    if (mode === 'select') {
      // 1. Hit a control point on the selected sail?
      const sel = this.store.find(this.store.selectedId);
      if (sel) {
        const idx = this.hitTester.hitPoint(px, py, sel);
        if (idx >= 0) {
          this.store.pushUndo();
          this.drag.startPointDrag(sel.id, idx, px, py, sel.points[idx].x, sel.points[idx].y);
          return;
        }
      }
      // 2. Hit a label? Check all visible sails.
      for (const s of [...this.store.sails].reverse()) {
        if (!s.visible) continue;
        const [lpx, lpy] = this.sailRend.getLabelPixelPos(s);
        if (Math.hypot(px - lpx, py - lpy) <= LABEL_HIT_R) {
          this.actions.selectSail(s.id);
          this.store.pushUndo();
          this.drag.startLabelDrag(s.id, px, py, lpx, lpy);
          return;
        }
      }
      // 3. Hit a sail body?
      const hit = this.hitTester.hitSail(px, py);
      if (hit) {
        this.actions.selectSail(hit.id);
        this.store.pushUndo();
        this.drag.startShapeDrag(hit.id, px, py, hit.points);
      } else {
        this.actions.selectSail(null);
      }
      return;
    }

    if (mode === 'addpt') {
      const sailId = this.store.selectedId;
      if (sailId === null) return;
      const s = this.store.find(sailId);
      if (!s) return;
      const [dx, dy] = this.coords.fromPixel(px, py);

      // Find best insertion edge (closest midpoint)
      let best = s.points.length, bestD = Infinity;
      for (let i = 0; i < s.points.length; i++) {
        const a = s.points[i];
        const b = s.points[(i + 1) % s.points.length];
        const [mpx, mpy] = this.coords.toPixel((a.x + b.x) / 2, (a.y + b.y) / 2);
        const d = Math.hypot(px - mpx, py - mpy);
        if (d < bestD) { bestD = d; best = i + 1; }
      }

      const [cx, cy] = this.coords.clamp(dx, dy);
      this.store.addPoint(sailId, best, { x: cx, y: cy });
      this.actions.redraw();
      return;
    }

    if (mode === 'delpt') {
      const sailId = this.store.selectedId;
      if (sailId === null) return;
      const s = this.store.find(sailId);
      if (!s || s.points.length <= 3) return;
      const idx = this.hitTester.hitPoint(px, py, s);
      if (idx >= 0) {
        this.store.removePoint(sailId, idx);
        this.actions.redraw();
      }
    }
  }

  // ── Pointer move ────────────────────────────────────────────────────────────
  private _onMove(e: PointerEvent): void {
    const [px, py] = this._pos(e);
    const [twa, tws] = this.coords.fromPixel(px, py);

    // Update cursor indicators + status bar
    const hoveredSail = this.drag.isDragging ? null : this.hitTester.hitSail(px, py);
    this.onCursorMove(twa, tws, hoveredSail?.name ?? null);

    // Update cursor style
    this._updateCursor(px, py);

    // Apply drag
    if (this.drag.isDragging) {
      const s = this.store.find(this.drag.sailId);
      if (s) { this.drag.apply(px, py, s); this.actions.redraw(); }
      return;
    }

    this.actions.redraw();
  }

  // ── Pointer up ──────────────────────────────────────────────────────────────
  private _onUp(): void {
    if (this.drag.isDragging) {
      const s = this.store.find(this.drag.sailId);
      if (s) this.store.save();
    }
    this.drag.end();
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  private _onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();

    if (k === 'v') { this.actions.setMode('select'); return; }
    if (k === 'a') { this.actions.setMode('addpt');  return; }
    if (k === 'd') { this.actions.setMode('delpt');  return; }
    if (k === 'escape')                           { this.actions.selectSail(null); return; }
    if (k === 'delete' || k === 'backspace')      { this.actions.deleteSelected(); return; }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && k === 'z') { e.preventDefault(); this.actions.undo(); return; }
    if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); this.actions.redo(); }
  }

  // ── Cursor style ────────────────────────────────────────────────────────────
  private _updateCursor(px: number, py: number): void {
    const mode = this.actions.mode;
    if (mode === 'addpt') { this.canvas.style.cursor = 'crosshair'; return; }
    if (mode === 'delpt') {
      const s = this.store.find(this.store.selectedId);
      if (s && this.hitTester.hitPoint(px, py, s) >= 0) {
        this.canvas.style.cursor = 'not-allowed'; return;
      }
      this.canvas.style.cursor = 'default'; return;
    }
    const s = this.store.find(this.store.selectedId);
    if (s && this.hitTester.hitPoint(px, py, s) >= 0) { this.canvas.style.cursor = 'grab'; return; }
    // Label hit check
    for (const sail of this.store.sails) {
      if (!sail.visible) continue;
      const [lpx, lpy] = this.sailRend.getLabelPixelPos(sail);
      if (Math.hypot(px - lpx, py - lpy) <= LABEL_HIT_R) {
        this.canvas.style.cursor = 'grab'; return;
      }
    }
    this.canvas.style.cursor = this.hitTester.hitSail(px, py) ? 'move' : 'default';
  }

  private _pos(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
}
