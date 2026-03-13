import { SailStore, X_MIN, X_MAX, Y_MIN, Y_MAX } from './sails.js';
import { ChartRenderer } from './chart.js';

// ── State ────────────────────────────────────────────────────────────────────
const store    = new SailStore();
let renderer   = null;
let mode       = 'select';
let drag       = null;
let editDirty  = false; // true after first keystroke in editor (for undo grouping)

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const bgCanvas  = document.getElementById('bgCanvas');
  const mainCanvas = document.getElementById('mainCanvas');
  const area      = document.getElementById('chartArea');

  renderer = new ChartRenderer(bgCanvas, mainCanvas, store);

  const doResize = () => {
    const r = area.getBoundingClientRect();
    renderer.resize(r.width, r.height);
  };
  new ResizeObserver(doResize).observe(area);
  doResize();

  renderList();
  updateUndoButtons();
  setupPointerEvents(mainCanvas);
  setupKeyboard();
  setupToolbar();
  setMode('select');
});

// ── Rendering helpers ─────────────────────────────────────────────────────────
function redraw() { renderer?.drawSails(mode); }

// ── Sail List ─────────────────────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById('sailList');
  list.innerHTML = '';
  document.getElementById('sailCount').textContent = store.sails.length;

  for (const s of store.sails) {
    const item = document.createElement('div');
    item.className = 'sail-item' + (s.id === store.selectedId ? ' selected' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(s.id === store.selectedId));

    item.innerHTML = `
      <div class="swatch" style="background:${s.color};color:${s.color}"></div>
      <span class="sail-name" style="opacity:${s.visible ? 1 : 0.4}">${escHtml(s.name)}</span>
      <button class="vis-btn${s.visible ? '' : ' hidden'}" title="${s.visible ? 'Hide' : 'Show'}" data-id="${s.id}">
        ${s.visible ? eyeIcon() : eyeOffIcon()}
      </button>`;

    item.querySelector('.vis-btn').addEventListener('click', e => {
      e.stopPropagation();
      store.toggleVis(s.id);
      renderList();
      redraw();
    });

    item.addEventListener('click', () => selectSail(s.id));
    list.appendChild(item);
  }
}

function eyeIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}

function eyeOffIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`;
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Selection / Editor ────────────────────────────────────────────────────────
function selectSail(id) {
  store.select(id);
  renderList();
  redraw();
  const ed = document.getElementById('editor');
  ed.classList.toggle('open', id !== null);
  ed.setAttribute('aria-hidden', String(id === null));
  if (id !== null) syncEditor();
}

function syncEditor() {
  const s = store.find(store.selectedId);
  if (!s) return;
  document.getElementById('edTitle').textContent   = s.name;
  document.getElementById('edName').value          = s.name;
  document.getElementById('edColor').value         = s.color;
  document.getElementById('edOpacity').value       = Math.round(s.opacity * 100);
  editDirty = false;
}

function applyEdit() {
  const s = store.find(store.selectedId);
  if (!s) return;
  s.name    = document.getElementById('edName').value;
  s.color   = document.getElementById('edColor').value;
  s.opacity = parseInt(document.getElementById('edOpacity').value, 10) / 100;
  store.save();
  document.getElementById('edTitle').textContent = s.name || 'Edit Sail';
  renderList();
  redraw();
}

function deleteSelected() {
  if (store.selectedId === null) return;
  store.remove(store.selectedId);
  selectSail(null);
  renderList();
  redraw();
  updateUndoButtons();
}

// ── Undo buttons ──────────────────────────────────────────────────────────────
function updateUndoButtons() {
  const u = document.getElementById('btnUndo');
  const r = document.getElementById('btnRedo');
  if (u) u.disabled = !store.canUndo;
  if (r) r.disabled = !store.canRedo;
}

function doUndo() {
  if (store.undo()) { selectSail(store.selectedId); renderList(); redraw(); updateUndoButtons(); }
}

function doRedo() {
  if (store.redo()) { selectSail(store.selectedId); renderList(); redraw(); updateUndoButtons(); }
}

// ── Mode ──────────────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  ['select', 'addpt', 'delpt'].forEach(k => {
    document.getElementById('btn_' + k)?.classList.toggle('active', k === m);
  });
  const labels = { select: 'Select', addpt: 'Add Point', delpt: 'Del Point' };
  const hints  = {
    select: 'Drag handles to reshape · Drag region to move · <kbd>Del</kbd> removes selected',
    addpt:  'Click near an edge to insert a new point',
    delpt:  'Click a handle to remove it (min 3 points)',
  };
  document.getElementById('stMode').textContent    = labels[m];
  document.getElementById('hintText').innerHTML    = hints[m];
  redraw();
}

// ── Pointer / touch events ────────────────────────────────────────────────────
function getPointerPos(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return [src.clientX - r.left, src.clientY - r.top];
}

function setupPointerEvents(canvas) {
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    onDown(e, canvas);
  });
  canvas.addEventListener('pointermove', e => onMove(e, canvas));
  canvas.addEventListener('pointerup',     () => onUp());
  canvas.addEventListener('pointercancel', () => onUp());
  canvas.addEventListener('pointerleave',  () => { renderer.cursor = null; redraw(); });
}

function onDown(e, canvas) {
  const [px, py] = getPointerPos(e, canvas);

  if (mode === 'select') {
    // Try to drag a control point on the selected sail
    if (store.selectedId !== null) {
      const sel = store.find(store.selectedId);
      if (sel) {
        const idx = renderer.hitPoint(px, py, sel);
        if (idx >= 0) {
          store.pushUndo();
          updateUndoButtons();
          drag = { type: 'pt', sailId: sel.id, idx,
                   startPx: px, startPy: py,
                   ox: sel.points[idx].x, oy: sel.points[idx].y };
          return;
        }
      }
    }
    // Try to select/drag a sail
    const hit = renderer.hitSail(px, py);
    if (hit) {
      selectSail(hit.id);
      store.pushUndo();
      updateUndoButtons();
      drag = { type: 'shape', sailId: hit.id,
               startPx: px, startPy: py,
               origPts: hit.points.map(p => ({ ...p })) };
    } else {
      selectSail(null);
    }
    return;
  }

  if (mode === 'addpt') {
    if (store.selectedId === null) return;
    const sel = store.find(store.selectedId);
    if (!sel) return;
    const [dx, dy] = renderer.fromPixel(px, py);
    // Insert at the edge closest to the click
    let best = sel.points.length, bestD = Infinity;
    for (let i = 0; i < sel.points.length; i++) {
      const a = sel.points[i];
      const b = sel.points[(i + 1) % sel.points.length];
      const [mpx, mpy] = renderer.toPixel((a.x + b.x) / 2, (a.y + b.y) / 2);
      const d = Math.hypot(px - mpx, py - mpy);
      if (d < bestD) { bestD = d; best = i + 1; }
    }
    store.pushUndo();
    updateUndoButtons();
    const [cx, cy] = renderer.clampData(dx, dy);
    sel.points.splice(best, 0, { x: cx, y: cy });
    store.save();
    redraw();
    return;
  }

  if (mode === 'delpt') {
    if (store.selectedId === null) return;
    const sel = store.find(store.selectedId);
    if (!sel || sel.points.length <= 3) return;
    const idx = renderer.hitPoint(px, py, sel);
    if (idx >= 0) {
      store.pushUndo();
      updateUndoButtons();
      sel.points.splice(idx, 1);
      store.save();
      redraw();
    }
  }
}

function onMove(e, canvas) {
  const [px, py] = getPointerPos(e, canvas);
  // Update cursor indicator on axes
  const [twa, tws] = renderer.fromPixel(px, py);
  renderer.cursor = { twa, tws };
  updateStatus(px, py);
  updateCursor(canvas, px, py);

  if (!drag) { redraw(); return; }
  const s = store.find(drag.sailId);
  if (!s) return;

  if (drag.type === 'pt') {
    const [opx, opy] = renderer.toPixel(drag.ox, drag.oy);
    const [nx, ny]   = renderer.fromPixel(opx + (px - drag.startPx), opy + (py - drag.startPy));
    const [cx, cy]   = renderer.clampData(nx, ny);
    s.points[drag.idx] = { x: cx, y: cy };
  } else {
    const ddx = px - drag.startPx;
    const ddy = py - drag.startPy;
    s.points = drag.origPts.map(pt => {
      const [opx, opy] = renderer.toPixel(pt.x, pt.y);
      const [nx, ny]   = renderer.fromPixel(opx + ddx, opy + ddy);
      const [cx, cy]   = renderer.clampData(nx, ny);
      return { x: cx, y: cy };
    });
  }
  redraw();
}

function onUp() {
  if (drag) {
    const s = store.find(drag.sailId);
    if (s) store.save();
  }
  drag = null;
}

// ── Status bar ────────────────────────────────────────────────────────────────
function updateStatus(px, py) {
  const [wx, wy] = renderer.fromPixel(px, py);
  if (wx >= X_MIN && wx <= X_MAX && wy >= Y_MIN && wy <= Y_MAX) {
    document.getElementById('stAngle').textContent = Math.round(wx) + '°';
    document.getElementById('stSpeed').textContent = wy.toFixed(1) + ' kts';
    const h = renderer.hitSail(px, py);
    document.getElementById('stSail').textContent  = h ? h.name : '—';
  }
}

// ── Cursor ────────────────────────────────────────────────────────────────────
function updateCursor(canvas, px, py) {
  if (mode === 'addpt') { canvas.style.cursor = 'crosshair'; return; }
  if (mode === 'delpt') {
    const s = store.find(store.selectedId);
    if (s && renderer.hitPoint(px, py, s) >= 0) { canvas.style.cursor = 'not-allowed'; return; }
    canvas.style.cursor = 'default';
    return;
  }
  const s = store.find(store.selectedId);
  if (s && renderer.hitPoint(px, py, s) >= 0) { canvas.style.cursor = 'grab'; return; }
  canvas.style.cursor = renderer.hitSail(px, py) ? 'move' : 'default';
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'v') { setMode('select'); return; }
    if (k === 'a') { setMode('addpt');  return; }
    if (k === 'd') { setMode('delpt');  return; }
    if (k === 'escape') { selectSail(null); return; }
    if (k === 'delete' || k === 'backspace') { deleteSelected(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'z') { e.preventDefault(); doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); doRedo(); }
  });
}

// ── Toolbar setup ─────────────────────────────────────────────────────────────
function setupToolbar() {
  // Editor fields
  const edName    = document.getElementById('edName');
  const edColor   = document.getElementById('edColor');
  const edOpacity = document.getElementById('edOpacity');

  const onFirstChange = () => {
    if (!editDirty) { store.pushUndo(); updateUndoButtons(); editDirty = true; }
  };
  edName.addEventListener('focus', () => { editDirty = false; });
  edName.addEventListener('input', () => { onFirstChange(); applyEdit(); });
  edOpacity.addEventListener('focus', () => { editDirty = false; });
  edOpacity.addEventListener('input', () => { onFirstChange(); applyEdit(); });
  // Color: push undo on each change (picker = discrete interaction)
  edColor.addEventListener('change', () => { store.pushUndo(); updateUndoButtons(); applyEdit(); });
  edColor.addEventListener('input',  () => { applyEdit(); });

  // Mode buttons
  document.getElementById('btn_select').addEventListener('click', () => setMode('select'));
  document.getElementById('btn_addpt').addEventListener('click',  () => setMode('addpt'));
  document.getElementById('btn_delpt').addEventListener('click',  () => setMode('delpt'));

  // Undo / Redo
  document.getElementById('btnUndo').addEventListener('click', doUndo);
  document.getElementById('btnRedo').addEventListener('click', doRedo);

  // XML Load
  document.getElementById('btnLoadXML').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        store.fromXML(ev.target.result);
        selectSail(null);
        renderList();
        redraw();
        updateUndoButtons();
      } catch (err) {
        alert('Error loading file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // XML Save
  document.getElementById('btnSaveXML').addEventListener('click', () => {
    const blob = new Blob([store.toXML()], { type: 'application/xml' });
    downloadAs(URL.createObjectURL(blob), 'CrossoverChart.xml');
  });

  // Export PNG
  document.getElementById('btnExportPNG').addEventListener('click', () => {
    downloadAs(renderer.exportCanvas().toDataURL('image/png'), 'CrossoverChart.png');
  });

  // Print
  document.getElementById('btnPrint').addEventListener('click', () => window.print());

  // Add / Delete sail
  document.getElementById('btnAddSail').addEventListener('click', openAddModal);
  document.getElementById('btnDelSail').addEventListener('click', deleteSelected);

  // Add modal
  document.getElementById('modalCancel').addEventListener('click', closeAddModal);
  document.getElementById('modalAdd').addEventListener('click', doAddSail);
  document.getElementById('addModal').addEventListener('click', e => {
    if (e.target === document.getElementById('addModal')) closeAddModal();
  });
  document.getElementById('newName').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddSail();
  });
}

function downloadAs(href, filename) {
  const a = document.createElement('a');
  a.href = href; a.download = filename; a.click();
}

// ── Add Sail Modal ────────────────────────────────────────────────────────────
function openAddModal() {
  const modal = document.getElementById('addModal');
  modal.classList.add('open');
  document.getElementById('newName').value = '';
  document.getElementById('newName').focus();
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

function doAddSail() {
  const ox = parseFloat(document.getElementById('newAngle').value) || 90;
  const oy = parseFloat(document.getElementById('newSpeed').value) || 15;
  const sail = store.add({
    name:  document.getElementById('newName').value.trim() || 'Sail',
    color: document.getElementById('newColor').value,
    ox, oy, rx: 20, ry: 6,
  });
  closeAddModal();
  selectSail(sail.id);
  renderList();
  redraw();
  updateUndoButtons();
}
