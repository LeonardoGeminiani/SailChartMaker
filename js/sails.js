// ── Chart constants ─────────────────────────────────────────────────────────
export const X_MIN = 30, X_MAX = 160, Y_MIN = 0, Y_MAX = 30;

const STORAGE_KEY = 'sailchart_v3'; // bump version to reset cached sails after redesign

export function makeOval(ox, oy, rx, ry, n = 8) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: ox + rx * Math.cos(a), y: oy + ry * Math.sin(a) });
  }
  return pts;
}

const DEFAULT_SAILS = [
  { name: 'J1 Light',  ox: 72,  oy: 8,  rx: 34, ry: 5,  color: '#ee0090' }, // magenta
  { name: 'J1 Heavy',  ox: 62,  oy: 14, rx: 18, ry: 6,  color: '#d4b800' }, // yellow
  { name: 'J3',        ox: 58,  oy: 22, rx: 16, ry: 6,  color: '#2855cc' }, // blue
  { name: 'Reacher',   ox: 88,  oy: 24, rx: 30, ry: 5,  color: '#18b030' }, // green
  { name: 'JT',        ox: 95,  oy: 18, rx: 40, ry: 10, color: '#e83030' }, // red  (large central)
  { name: 'A3',        ox: 118, oy: 19, rx: 22, ry: 8,  color: '#e85020' }, // orange-red
  { name: 'A2',        ox: 148, oy: 17, rx: 18, ry: 8,  color: '#28b8e8' }, // cyan
  { name: 'A1.5',      ox: 142, oy: 8,  rx: 18, ry: 5,  color: '#d4d000' }, // yellow-green
  { name: 'HA Sym',    ox: 155, oy: 23, rx: 12, ry: 6,  color: '#9030cc' }, // purple
];

export class SailStore {
  constructor() {
    this.sails     = [];
    this.nextId    = 1;
    this.selectedId = null;
    this._undo = [];
    this._redo = [];
    this._load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sails:  this.sails,
        nextId: this.nextId,
      }));
    } catch (_) { /* storage unavailable */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.sails) && data.sails.length > 0) {
          this.sails  = data.sails;
          this.nextId = data.nextId ?? (data.sails.length + 1);
          return;
        }
      }
    } catch (_) { /* ignore */ }
    this._loadDefaults();
  }

  _loadDefaults() {
    this.sails  = [];
    this.nextId = 1;
    for (const d of DEFAULT_SAILS) {
      this.sails.push({
        id:      this.nextId++,
        name:    d.name,
        color:   d.color,
        opacity: 0.62,
        visible: true,
        points:  makeOval(d.ox, d.oy, d.rx, d.ry),
      });
    }
    this.save();
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  _snapshot() {
    return JSON.stringify({ sails: this.sails, nextId: this.nextId });
  }

  pushUndo() {
    this._undo.push(this._snapshot());
    if (this._undo.length > 60) this._undo.shift();
    this._redo = [];
  }

  undo() {
    if (!this._undo.length) return false;
    this._redo.push(this._snapshot());
    const prev = JSON.parse(this._undo.pop());
    this.sails  = prev.sails;
    this.nextId = prev.nextId;
    if (this.selectedId !== null && !this.find(this.selectedId)) this.selectedId = null;
    this.save();
    return true;
  }

  redo() {
    if (!this._redo.length) return false;
    this._undo.push(this._snapshot());
    const next = JSON.parse(this._redo.pop());
    this.sails  = next.sails;
    this.nextId = next.nextId;
    if (this.selectedId !== null && !this.find(this.selectedId)) this.selectedId = null;
    this.save();
    return true;
  }

  get canUndo() { return this._undo.length > 0; }
  get canRedo()  { return this._redo.length > 0; }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  find(id) { return this.sails.find(s => s.id === id) ?? null; }

  add(props) {
    this.pushUndo();
    const sail = {
      id:      this.nextId++,
      name:    props.name    ?? 'Sail',
      color:   props.color   ?? '#4f8ef7',
      opacity: props.opacity ?? 0.55,
      visible: true,
      points:  props.points  ?? makeOval(props.ox ?? 90, props.oy ?? 15, props.rx ?? 20, props.ry ?? 6),
    };
    this.sails.push(sail);
    this.save();
    return sail;
  }

  remove(id) {
    this.pushUndo();
    this.sails = this.sails.filter(s => s.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.save();
  }

  toggleVis(id) {
    const s = this.find(id);
    if (s) { s.visible = !s.visible; this.save(); }
  }

  select(id) { this.selectedId = id; }

  reset() {
    this.pushUndo();
    this._loadDefaults();
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  toXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<CrossoverChart>\n';
    for (const s of this.sails) {
      const pts = s.points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
      xml += `  <Sail name="${esc(s.name)}" color="${s.color}" opacity="${s.opacity.toFixed(2)}" visible="${s.visible}" points="${pts}"/>\n`;
    }
    return xml + '</CrossoverChart>';
  }

  fromXML(xmlStr) {
    const doc   = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const nodes = doc.querySelectorAll('Sail');
    if (!nodes.length) throw new Error('No sail data found in file.');
    this.pushUndo();
    this.sails  = [];
    this.nextId = 1;
    nodes.forEach(n => {
      const ptsStr = n.getAttribute('points') ?? '';
      let points = ptsStr.trim()
        ? ptsStr.trim().split(/\s+/).map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return { x, y };
          }).filter(p => !isNaN(p.x) && !isNaN(p.y))
        : [];
      if (points.length < 3) {
        points = makeOval(
          parseFloat(n.getAttribute('cx')) || 90,
          parseFloat(n.getAttribute('cy')) || 15,
          parseFloat(n.getAttribute('rx')) || 20,
          parseFloat(n.getAttribute('ry')) || 6,
        );
      }
      this.sails.push({
        id:      this.nextId++,
        name:    n.getAttribute('name')    ?? 'Sail',
        color:   n.getAttribute('color')   ?? '#4f8ef7',
        opacity: parseFloat(n.getAttribute('opacity')) || 0.55,
        visible: n.getAttribute('visible') !== 'false',
        points,
      });
    });
    this.selectedId = null;
    this.save();
  }
}

function esc(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
