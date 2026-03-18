import { FillPattern } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';

// ── SidebarPanel ──────────────────────────────────────────────────────────────
export class SidebarPanel {
  private editDirty = false;

  constructor(
    private readonly store: SailStore,
    private readonly onSelect: (id: number | null) => void,
    private readonly onDelete: () => void,
    private readonly onRedraw: () => void,
  ) {}

  // ── Sail list ───────────────────────────────────────────────────────────────
  renderList(): void {
    const list = document.getElementById('sailList')!;
    list.innerHTML = '';

    const counter = document.getElementById('sailCount');
    if (counter) counter.textContent = String(this.store.sails.length);

    const sails = this.store.sails;
    for (let idx = 0; idx < sails.length; idx++) {
      const s = sails[idx];
      const isFirst = idx === 0;
      const isLast  = idx === sails.length - 1;

      const item = document.createElement('div');
      item.className = 'sail-item' + (s.id === this.store.selectedId ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(s.id === this.store.selectedId));
      item.innerHTML = `
        <div class="order-btns">
          <button class="order-btn up-btn" title="Move up" data-id="${s.id}" ${isFirst ? 'disabled' : ''}>${this._chevronUpIcon()}</button>
          <button class="order-btn dn-btn" title="Move down" data-id="${s.id}" ${isLast  ? 'disabled' : ''}>${this._chevronDnIcon()}</button>
        </div>
        <div class="swatch" style="background:${s.color};border-color:rgba(0,0,0,0.12)"></div>
        <span class="sail-name" style="opacity:${s.visible ? 1 : 0.4}">${this._esc(s.name)}</span>
        <button class="vis-btn${s.visible ? '' : ' hidden'}" title="${s.visible ? 'Hide' : 'Show'}" data-id="${s.id}">
          ${s.visible ? this._eyeIcon() : this._eyeOffIcon()}
        </button>`;

      item.querySelector<HTMLButtonElement>('.vis-btn')!.addEventListener('click', e => {
        e.stopPropagation();
        this.store.toggleVis(s.id);
        this.renderList();
        this.onRedraw();
      });

      item.querySelector<HTMLButtonElement>('.up-btn')!.addEventListener('click', e => {
        e.stopPropagation();
        this.store.moveUp(s.id);
        this.renderList();
        this.onRedraw();
      });

      item.querySelector<HTMLButtonElement>('.dn-btn')!.addEventListener('click', e => {
        e.stopPropagation();
        this.store.moveDown(s.id);
        this.renderList();
        this.onRedraw();
      });

      item.addEventListener('click', () => this.onSelect(s.id));
      list.appendChild(item);
    }
  }

  // ── Annotation list ─────────────────────────────────────────────────────────
  renderAnnotations(): void {
    const list = document.getElementById('annotationList');
    if (!list) return;
    list.innerHTML = '';
    for (const a of this.store.annotations) {
      const item = document.createElement('div');
      item.className = 'ann-item';
      item.innerHTML = `
        <input type="color" class="ann-color" value="${a.color}" title="Label color">
        <input type="text" class="ann-text" value="${this._esc(a.text)}" placeholder="Label text" spellcheck="false">
        <button class="ann-del" title="Remove label">×</button>`;
      item.querySelector<HTMLInputElement>('.ann-color')!.addEventListener('input', e => {
        a.color = (e.target as HTMLInputElement).value;
        this.store.save();
        this.onRedraw();
      });
      item.querySelector<HTMLInputElement>('.ann-text')!.addEventListener('input', e => {
        a.text = (e.target as HTMLInputElement).value;
        this.store.save();
        this.onRedraw();
      });
      item.querySelector<HTMLButtonElement>('.ann-del')!.addEventListener('click', () => {
        this.store.removeAnnotation(a.id);
        this.renderAnnotations();
        this.onRedraw();
      });
      list.appendChild(item);
    }
  }

  // ── Editor panel ────────────────────────────────────────────────────────────
  openEditor(name: string): void {
    const ed = document.getElementById('editor')!;
    ed.classList.add('open');
    ed.setAttribute('aria-hidden', 'false');
    document.getElementById('edTitle')!.textContent = name;
  }

  closeEditor(): void {
    const ed = document.getElementById('editor')!;
    ed.classList.remove('open');
    ed.setAttribute('aria-hidden', 'true');
  }

  syncEditor(): void {
    const s = this.store.find(this.store.selectedId);
    if (!s) return;
    (document.getElementById('edName')        as HTMLInputElement).value  = s.name;
    (document.getElementById('edColor')       as HTMLInputElement).value  = s.color;
    (document.getElementById('edOpacity')     as HTMLInputElement).value  = String(Math.round(s.opacity * 100));
    (document.getElementById('edShowFill')    as HTMLInputElement).checked = s.showFill !== false;
    (document.getElementById('edFillPattern') as HTMLSelectElement).value   = s.fillPattern ?? 'none';
    (document.getElementById('edPatternDash') as HTMLInputElement).value    = String(s.patternDash ?? 4);
    this._syncDashRow(s.fillPattern ?? 'none');
    document.getElementById('edTitle')!.textContent = s.name;
    this.editDirty = false;
  }

  // ── Undo button state ────────────────────────────────────────────────────────
  updateUndoButtons(): void {
    const u = document.getElementById('btnUndo') as HTMLButtonElement | null;
    const r = document.getElementById('btnRedo') as HTMLButtonElement | null;
    if (u) u.disabled = !this.store.canUndo;
    if (r) r.disabled = !this.store.canRedo;
  }

  // ── Editor field listeners (call once on init) ───────────────────────────────
  setupEditorListeners(): void {
    const edName    = document.getElementById('edName')    as HTMLInputElement;
    const edColor   = document.getElementById('edColor')   as HTMLInputElement;
    const edOpacity = document.getElementById('edOpacity') as HTMLInputElement;

    const onFirst = () => {
      if (!this.editDirty) { this.store.pushUndo(); this.editDirty = true; }
    };

    edName.addEventListener('focus', () => { this.editDirty = false; });
    edName.addEventListener('input', () => { onFirst(); this._applyEdit(); });

    edOpacity.addEventListener('focus', () => { this.editDirty = false; });
    edOpacity.addEventListener('input', () => { onFirst(); this._applyEdit(); });

    // Color picker: push undo on each discrete change
    edColor.addEventListener('change', () => { this.store.pushUndo(); this._applyEdit(); });
    edColor.addEventListener('input',  () => { this._applyEdit(); });

    const edShowFill    = document.getElementById('edShowFill')    as HTMLInputElement;
    const edFillPattern = document.getElementById('edFillPattern') as HTMLSelectElement;
    const edPatternDash = document.getElementById('edPatternDash') as HTMLInputElement;
    edShowFill.addEventListener('change',    () => { onFirst(); this._applyEdit(); });
    edFillPattern.addEventListener('change', () => {
      onFirst();
      this._syncDashRow(edFillPattern.value);
      this._applyEdit();
    });
    edPatternDash.addEventListener('input',  () => { onFirst(); this._applyEdit(); });

    document.getElementById('btnDelSail')!.addEventListener('click', () => this.onDelete());
  }

  // ── Private ──────────────────────────────────────────────────────────────────
  private _applyEdit(): void {
    const s = this.store.find(this.store.selectedId);
    if (!s) return;
    s.name        = (document.getElementById('edName')        as HTMLInputElement).value;
    s.color       = (document.getElementById('edColor')       as HTMLInputElement).value;
    s.opacity     = parseInt((document.getElementById('edOpacity') as HTMLInputElement).value, 10) / 100;
    s.showFill    = (document.getElementById('edShowFill')    as HTMLInputElement).checked;
    s.fillPattern = (document.getElementById('edFillPattern') as HTMLSelectElement).value as FillPattern;
    s.patternDash = Math.max(1, parseInt((document.getElementById('edPatternDash') as HTMLInputElement).value, 10) || 4);
    this.store.save();
    document.getElementById('edTitle')!.textContent = s.name || 'Edit Sail';
    this.renderList();
    this.onRedraw();
  }

  private _syncDashRow(pattern: string): void {
    const row = document.getElementById('dashLenRow');
    if (row) row.style.display = (pattern === 'dashes45' || pattern === 'dashes135') ? '' : 'none';
  }

  private _esc(str: string): string {
    return str.replace(/[&<>"']/g, c => (
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
    ));
  }

  private _eyeIcon(): string {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>`;
  }

  private _chevronUpIcon(): string {
    return `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10 L8 6 L12 10"/></svg>`;
  }

  private _chevronDnIcon(): string {
    return `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 L8 10 L12 6"/></svg>`;
  }

  private _eyeOffIcon(): string {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;
  }
}
