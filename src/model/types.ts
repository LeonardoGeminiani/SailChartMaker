export interface SailPoint {
  x: number;
  y: number;
}

export type FillPattern = 'none' | 'lines45' | 'lines135' | 'crosshatch' | 'horizontal' | 'vertical' | 'dots';

export interface SailData {
  id: number;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  showFill: boolean;
  fillPattern: FillPattern;
  points: SailPoint[];
  labelOffset?: SailPoint; // offset from centroid in data coords (TWA, TWS)
}

export interface LabelAnnotation {
  id: number;
  text: string;
  x: number;   // TWA data coordinate
  y: number;   // TWS data coordinate
  color: string;
}

export type EditMode = 'select' | 'addpt' | 'delpt';

export interface CursorPosition {
  twa: number;
  tws: number;
}

export interface ChartSettings {
  bgColor:            string;
  fontSize:           number;
  sailLabelFontSize:  number;
  smoothing:          number;
  vmgStrokeWidth:     number;
  awsStrokeWidth:     number;
  axisStrokeScale:    number;
  twaMin:             number;
  twaMax:             number;
  twsMin:             number;
  twsMax:             number;
  showAWS:            boolean;
  patternScale:       number;
  patternThickness:   number;
  twsReversed:        boolean;
  resolution:         number;
  chartMargin:        number;
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
