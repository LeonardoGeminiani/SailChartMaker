export interface SailPoint {
  x: number;
  y: number;
}

export type FillPattern = 'none' | 'lines45' | 'lines135' | 'crosshatch' | 'horizontal' | 'vertical' | 'dots' | 'dashes45' | 'dashes135' | 'finedash45' | 'finedash135';

export type SplineStroke = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'finedash' | 'longdash';

export interface ChartSpline {
  id: number;
  name: string;
  color: string;
  strokeWidth: number;
  stroke: SplineStroke;
  visible: boolean;
  points: SailPoint[];
}

export interface SailData {
  id: number;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  showFill: boolean;
  fillPattern: FillPattern;
  patternDash: number;  // dash length in logical px, only used by dashes45/dashes135
  points: SailPoint[];
  showLabel: boolean;       // whether to draw the in-graph label
  labelOffset?: SailPoint;  // offset from centroid in data coords (TWA, TWS)
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
  showBSP:            boolean;
  bspLabelStep:       number;
  bspFontSize:        number;
  bspColor:           string;
  patternScale:       number;
  patternThickness:   number;
  twsReversed:        boolean;
  resolution:         number;
  chartMargin:        number;
  showLegend:         boolean;
}

/** Implemented by App, consumed by InputController and SidebarPanel */
export interface AppActions {
  readonly mode: EditMode;
  selectSail(id: number | null): void;
  selectSpline(id: number | null): void;
  setMode(mode: EditMode): void;
  deleteSelected(): void;
  undo(): void;
  redo(): void;
  redraw(): void;
}
