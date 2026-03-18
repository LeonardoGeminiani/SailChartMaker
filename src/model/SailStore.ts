import { SailData, SailPoint, FillPattern, ChartSettings, LabelAnnotation } from './types.js';
import { UndoManager } from './UndoManager.js';

// ── Chart domain constants ────────────────────────────────────────────────────
export const X_MIN = 30;
export const X_MAX = 160;
export const Y_MIN = 0;
export const Y_MAX = 30;

const STORAGE_KEY = 'sailchart_v3';

// ── Helpers ───────────────────────────────────────────────────────────────────
export function makeOval(
  ox: number, oy: number, rx: number, ry: number, n = 8,
): SailPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: ox + rx * Math.cos(a), y: oy + ry * Math.sin(a) };
  });
}

function escXml(str: string): string {
  return str.replace(/[&<>"']/g, c => (
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
  ));
}

// ── Default sail definitions ──────────────────────────────────────────────────
interface SailDef { name: string; ox: number; oy: number; rx: number; ry: number; color: string; }

const DEFAULT_DEFS: SailDef[] = [
  { name: 'J1 Light', ox: 72,  oy: 8,  rx: 34, ry: 5,  color: '#ee0090' },
  { name: 'J1 Heavy', ox: 62,  oy: 14, rx: 18, ry: 6,  color: '#d4b800' },
  { name: 'J3',       ox: 58,  oy: 22, rx: 16, ry: 6,  color: '#2855cc' },
  { name: 'Reacher',  ox: 88,  oy: 24, rx: 30, ry: 5,  color: '#18b030' },
  { name: 'JT',       ox: 95,  oy: 18, rx: 40, ry: 10, color: '#e83030' },
  { name: 'A3',       ox: 118, oy: 19, rx: 22, ry: 8,  color: '#e85020' },
  { name: 'A2',       ox: 148, oy: 17, rx: 18, ry: 8,  color: '#28b8e8' },
  { name: 'A1.5',     ox: 142, oy: 8,  rx: 18, ry: 5,  color: '#d4d000' },
  { name: 'HA Sym',   ox: 155, oy: 23, rx: 12, ry: 6,  color: '#9030cc' },
];

// ── Internal state shape (what gets snapshotted) ──────────────────────────────
interface StoreState {
  sails: SailData[];
  annotations: LabelAnnotation[];
  nextId: number;
  nextAnnId: number;
}

const DEFAULT_CHART_SETTINGS: ChartSettings = {
  bgColor: '#ffffff', fontSize: 11, sailLabelFontSize: 11, smoothing: 5,
  vmgStrokeWidth: 1.5, awsStrokeWidth: 1.0, axisStrokeScale: 1.0,
  twaMin: 30, twaMax: 160, twsMin: 0, twsMax: 30,
  showAWS: false, patternScale: 1, patternThickness: 1, twsReversed: false, resolution: 0, chartMargin: 0,
};

// ── SailStore ─────────────────────────────────────────────────────────────────
export class SailStore {
  private _state: StoreState;
  private _selectedId: number | null = null;
  private readonly _undo = new UndoManager<StoreState>();

  chartSettings: ChartSettings = { ...DEFAULT_CHART_SETTINGS };

  constructor() {
    this._state = this._load();
  }

  // ── Accessors ───────────────────────────────────────────────────────────────
  get sails(): SailData[]                  { return this._state.sails; }
  get annotations(): LabelAnnotation[]    { return this._state.annotations; }
  get selectedId(): number | null          { return this._selectedId; }

  find(id: number | null): SailData | null {
    if (id === null) return null;
    return this._state.sails.find(s => s.id === id) ?? null;
  }

  findAnnotation(id: number | null): LabelAnnotation | null {
    if (id === null) return null;
    return this._state.annotations.find(a => a.id === id) ?? null;
  }

  select(id: number | null): void { this._selectedId = id; }

  // ── Undo/Redo ───────────────────────────────────────────────────────────────
  get canUndo(): boolean { return this._undo.canUndo; }
  get canRedo(): boolean { return this._undo.canRedo; }

  pushUndo(): void { this._undo.snapshot(this._clone()); }

  undo(): boolean {
    const prev = this._undo.undo(this._clone());
    if (!prev) return false;
    this._state = prev;
    if (this._selectedId !== null && !this.find(this._selectedId)) this._selectedId = null;
    this.save();
    return true;
  }

  redo(): boolean {
    const next = this._undo.redo(this._clone());
    if (!next) return false;
    this._state = next;
    if (this._selectedId !== null && !this.find(this._selectedId)) this._selectedId = null;
    this.save();
    return true;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  add(props: Partial<SailData> & { ox?: number; oy?: number; rx?: number; ry?: number }): SailData {
    this.pushUndo();
    const sail: SailData = {
      id:          this._state.nextId++,
      name:        props.name        ?? 'Sail',
      color:       props.color       ?? '#4f8ef7',
      opacity:     props.opacity     ?? 0.62,
      visible:     props.visible     ?? true,
      showFill:    props.showFill    ?? true,
      fillPattern: props.fillPattern ?? 'none',
      points:      props.points      ?? makeOval(props.ox ?? 90, props.oy ?? 15, props.rx ?? 20, props.ry ?? 6),
    };
    this._state.sails.push(sail);
    this.save();
    return sail;
  }

  remove(id: number): void {
    this.pushUndo();
    this._state.sails = this._state.sails.filter(s => s.id !== id);
    if (this._selectedId === id) this._selectedId = null;
    this.save();
  }

  addPoint(sailId: number, index: number, point: SailPoint): void {
    const s = this.find(sailId);
    if (!s) return;
    this.pushUndo();
    s.points.splice(index, 0, point);
    this.save();
  }

  removePoint(sailId: number, index: number): void {
    const s = this.find(sailId);
    if (!s || s.points.length <= 3) return;
    this.pushUndo();
    s.points.splice(index, 1);
    this.save();
  }

  toggleVis(id: number): void {
    const s = this.find(id);
    if (s) { s.visible = !s.visible; this.save(); }
  }

  moveUp(id: number): void {
    const i = this._state.sails.findIndex(s => s.id === id);
    if (i <= 0) return;
    this.pushUndo();
    [this._state.sails[i - 1], this._state.sails[i]] = [this._state.sails[i], this._state.sails[i - 1]];
    this.save();
  }

  moveDown(id: number): void {
    const i = this._state.sails.findIndex(s => s.id === id);
    if (i < 0 || i >= this._state.sails.length - 1) return;
    this.pushUndo();
    [this._state.sails[i], this._state.sails[i + 1]] = [this._state.sails[i + 1], this._state.sails[i]];
    this.save();
  }

  // ── Annotation CRUD ──────────────────────────────────────────────────────────
  addAnnotation(text: string, x: number, y: number): LabelAnnotation {
    this.pushUndo();
    const ann: LabelAnnotation = { id: this._state.nextAnnId++, text, x, y, color: '#2a3f6f' };
    this._state.annotations.push(ann);
    this.save();
    return ann;
  }

  removeAnnotation(id: number): void {
    this.pushUndo();
    this._state.annotations = this._state.annotations.filter(a => a.id !== id);
    this.save();
  }

  updateAnnotation(id: number, changes: Partial<Pick<LabelAnnotation, 'text' | 'color' | 'x' | 'y'>>): void {
    const a = this.findAnnotation(id);
    if (!a) return;
    Object.assign(a, changes);
    this.save();
  }

  reset(): void {
    this.pushUndo();
    this._state = this._defaults();
    this._selectedId = null;
    this.save();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  /** Save sails + chartSettings to localStorage. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...this._state,
        chartSettings: this.chartSettings,
      }));
    } catch { /* quota */ }
  }

  private _load(): StoreState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as StoreState & { chartSettings?: Partial<ChartSettings> };
        if (Array.isArray(data.sails) && data.sails.length > 0) {
          if (data.chartSettings) {
            this.chartSettings = { ...DEFAULT_CHART_SETTINGS, ...data.chartSettings };
          }
          return {
            sails: data.sails,
            annotations: data.annotations ?? [],
            nextId: data.nextId,
            nextAnnId: data.nextAnnId ?? 1,
          };
        }
      }
    } catch { /* corrupt */ }
    return this._defaults();
  }

  private _defaults(): StoreState {
    let nextId = 1;
    const sails = DEFAULT_DEFS.map(d => ({
      id: nextId++, name: d.name, color: d.color,
      opacity: 0.62, visible: true, showFill: true, fillPattern: 'none' as FillPattern,
      points: makeOval(d.ox, d.oy, d.rx, d.ry),
    }));
    return { sails, annotations: [], nextId, nextAnnId: 1 };
  }

  private _clone(): StoreState {
    return JSON.parse(JSON.stringify(this._state));
  }

  // ── XML import / export ──────────────────────────────────────────────────────
  toXML(): string {
    const cs = this.chartSettings;
    const settingsAttr = [
      `bgColor="${cs.bgColor}"`, `fontSize="${cs.fontSize}"`,
      `sailLabelFontSize="${cs.sailLabelFontSize}"`, `smoothing="${cs.smoothing}"`,
      `vmgStrokeWidth="${cs.vmgStrokeWidth}"`, `awsStrokeWidth="${cs.awsStrokeWidth}"`,
      `axisStrokeScale="${cs.axisStrokeScale}"`,
      `twaMin="${cs.twaMin}"`, `twaMax="${cs.twaMax}"`,
      `twsMin="${cs.twsMin}"`, `twsMax="${cs.twsMax}"`,
      `showAWS="${cs.showAWS}"`, `patternScale="${cs.patternScale}"`, `patternThickness="${cs.patternThickness}"`, `twsReversed="${cs.twsReversed}"`, `resolution="${cs.resolution}"`,
      `chartMargin="${cs.chartMargin}"`,
    ].join(' ');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<SailChart>\n`;
    xml += `  <ChartSettings ${settingsAttr}/>\n`;
    for (const s of this._state.sails) {
      const pts = s.points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
      const loAttr = s.labelOffset
        ? ` labelOffsetX="${s.labelOffset.x.toFixed(3)}" labelOffsetY="${s.labelOffset.y.toFixed(3)}"`
        : '';
      const fillAttr = ` showFill="${s.showFill ?? true}" fillPattern="${s.fillPattern ?? 'none'}"`;
      xml += `  <Sail name="${escXml(s.name)}" color="${s.color}" opacity="${s.opacity.toFixed(2)}" visible="${s.visible}"${fillAttr} points="${pts}"${loAttr}/>\n`;
    }
    for (const a of this._state.annotations) {
      xml += `  <Label id="${a.id}" text="${escXml(a.text)}" x="${a.x.toFixed(3)}" y="${a.y.toFixed(3)}" color="${a.color}"/>\n`;
    }
    return xml + '</SailChart>';
  }

  fromXML(xmlStr: string): void {
    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const nodes = doc.querySelectorAll('Sail');
    if (!nodes.length) throw new Error('No sail data found in file.');

    // Load chart settings if present
    const csNode = doc.querySelector('ChartSettings');
    if (csNode) {
      const g = (k: string, fb: string) => csNode.getAttribute(k) ?? fb;
      this.chartSettings = {
        bgColor:           g('bgColor',           DEFAULT_CHART_SETTINGS.bgColor),
        fontSize:          Number(g('fontSize',          String(DEFAULT_CHART_SETTINGS.fontSize))),
        sailLabelFontSize: Number(g('sailLabelFontSize', String(DEFAULT_CHART_SETTINGS.sailLabelFontSize))),
        smoothing:         Number(g('smoothing',         String(DEFAULT_CHART_SETTINGS.smoothing))),
        vmgStrokeWidth:    Number(g('vmgStrokeWidth',    String(DEFAULT_CHART_SETTINGS.vmgStrokeWidth))),
        awsStrokeWidth:    Number(g('awsStrokeWidth',    String(DEFAULT_CHART_SETTINGS.awsStrokeWidth))),
        axisStrokeScale:   Number(g('axisStrokeScale',   String(DEFAULT_CHART_SETTINGS.axisStrokeScale))),
        twaMin:            Number(g('twaMin',            String(DEFAULT_CHART_SETTINGS.twaMin))),
        twaMax:            Number(g('twaMax',            String(DEFAULT_CHART_SETTINGS.twaMax))),
        twsMin:            Number(g('twsMin',            String(DEFAULT_CHART_SETTINGS.twsMin))),
        twsMax:            Number(g('twsMax',            String(DEFAULT_CHART_SETTINGS.twsMax))),
        showAWS:           g('showAWS',      'false') === 'true',
        patternScale:      Number(g('patternScale',     '1')),
        patternThickness:  Number(g('patternThickness', '1')),
        twsReversed:       g('twsReversed',  'false') === 'true',
        resolution:        Number(g('resolution',        String(DEFAULT_CHART_SETTINGS.resolution))),
        chartMargin:       Number(g('chartMargin',       String(DEFAULT_CHART_SETTINGS.chartMargin))),
      };
    }

    this.pushUndo();
    let nextId = 1;
    const sails: SailData[] = [];

    nodes.forEach(n => {
      const ptsStr = n.getAttribute('points') ?? '';
      let points: SailPoint[] = ptsStr.trim()
        ? ptsStr.trim().split(/\s+/).map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return { x, y };
          }).filter(p => !isNaN(p.x) && !isNaN(p.y))
        : [];
      if (points.length < 3) {
        points = makeOval(
          parseFloat(n.getAttribute('cx') ?? '90'),
          parseFloat(n.getAttribute('cy') ?? '15'),
          parseFloat(n.getAttribute('rx') ?? '20'),
          parseFloat(n.getAttribute('ry') ?? '6'),
        );
      }
      const loX = n.getAttribute('labelOffsetX');
      const loY = n.getAttribute('labelOffsetY');
      const labelOffset = loX !== null && loY !== null
        ? { x: parseFloat(loX), y: parseFloat(loY) }
        : undefined;
      sails.push({
        id: nextId++,
        name:        n.getAttribute('name')    ?? 'Sail',
        color:       n.getAttribute('color')   ?? '#4f8ef7',
        opacity:     parseFloat(n.getAttribute('opacity') ?? '0.62') || 0.62,
        visible:     n.getAttribute('visible') !== 'false',
        showFill:    n.getAttribute('showFill') !== 'false',
        fillPattern: (n.getAttribute('fillPattern') ?? 'none') as FillPattern,
        points,
        labelOffset,
      });
    });

    const annotations: LabelAnnotation[] = [];
    let nextAnnId = 1;
    doc.querySelectorAll('Label').forEach(n => {
      annotations.push({
        id: nextAnnId++,
        text:  n.getAttribute('text')  ?? '',
        x:     parseFloat(n.getAttribute('x')     ?? '90'),
        y:     parseFloat(n.getAttribute('y')     ?? '15'),
        color: n.getAttribute('color') ?? '#2a3f6f',
      });
    });

    this._state = { sails, annotations, nextId, nextAnnId };
    this._selectedId = null;
    this.save();
  }
}
