export interface SailPoint {
  x: number;
  y: number;
}

export interface SailData {
  id: number;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  points: SailPoint[];
}

export type EditMode = 'select' | 'addpt' | 'delpt';

export interface CursorPosition {
  twa: number;
  tws: number;
}

export interface ChartSettings {
  bgColor:        string;
  fontSize:       number;
  smoothing:      number;
  vmgStrokeWidth: number;
  awsStrokeWidth: number;
  axisStrokeScale:number;
  twaMin:         number;
  twaMax:         number;
  twsMin:         number;
  twsMax:         number;
  showAWS:        boolean;
  resolution:     number;
}

/** Implemented by App, consumed by InputController and SidebarPanel */
export interface AppActions {
  readonly mode: EditMode;
  selectSail(id: number | null): void;
  setMode(mode: EditMode): void;
  deleteSelected(): void;
  undo(): void;
  redo(): void;
  redraw(): void;
}
