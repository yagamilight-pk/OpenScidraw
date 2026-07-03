export type ScientificCategory =
  | 'Cytology & Immunology'
  | 'Molecular Biology'
  | 'Laboratory Equipment'
  | 'Anatomy & Organ Systems'
  | 'General';

export type CanvasObjectType = 'svg-asset' | 'primitive-rect' | 'primitive-circle' | 'primitive-triangle' | 'text-block';

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformMatrix {
  scaleX: number;
  scaleY: number;
  rotation: number;
  translateX: number;
  translateY: number;
  skewX: number;
  skewY: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface ColorModification {
  targetAttribute: 'fill' | 'stroke' | 'both';
  originalValue: string;
  overrideValue: string;
  dataHookId: string;
}

export interface StrokeProperties {
  color: string;
  width: number;
  dashArray: string;
  dashOffset: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  opacity: number;
}

export interface FillProperties {
  color: string;
  opacity: number;
  rule: 'nonzero' | 'evenodd';
}

export interface CustomModifications {
  colorOverrides: ColorModification[];
  globalFill: FillProperties;
  globalStroke: StrokeProperties;
  globalOpacity: number;
  blendMode: BlendMode;
  dropShadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
    opacity: number;
  };
  filters: {
    grayscale: number;
    brightness: number;
    contrast: number;
    saturate: number;
    hueRotate: number;
    blur: number;
  };
}

export interface TextLayoutBlock {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  fontStyle: 'normal' | 'italic' | 'oblique';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textDecoration: 'none' | 'underline' | 'line-through' | 'overline';
  lineHeight: number;
  letterSpacing: number;
  color: string;
  backgroundColor: string;
  padding: { top: number; right: number; bottom: number; left: number };
  borderRadius: number;
}

export interface PrimitiveParameters {
  rect?: {
    cornerRadius: number;
  };
  circle?: {
    radiusX: number;
    radiusY: number;
  };
  triangle?: {
    pointA: { x: number; y: number };
    pointB: { x: number; y: number };
    pointC: { x: number; y: number };
  };
}

export interface CanvasObject {
  id: string;
  type: CanvasObjectType;
  assetId: string | null;
  assetPath: string | null;
  svgRawContent: string | null;
  label: string;
  category: ScientificCategory | null;
  boundingBox: BoundingBox;
  transform: TransformMatrix;
  modifications: CustomModifications;
  textLayout: TextLayoutBlock | null;
  primitiveParams: PrimitiveParameters | null;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasGroup {
  id: string;
  label: string;
  memberIds: string[];
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface CanvasMetadata {
  id: string;
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
  institution: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
  tags: string[];
  exportedFormats: ('png' | 'svg' | 'pdf')[];
  licenseType: string;
}

export interface CanvasState {
  metadata: CanvasMetadata;
  viewport: CanvasViewport;
  objects: CanvasObject[];
  groups: CanvasGroup[];
  backgroundColor: string;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
  rulerEnabled: boolean;
  selectedObjectIds: string[];
  activeGroupId: string | null;
  history: {
    undoStack: CanvasSnapshot[];
    redoStack: CanvasSnapshot[];
    maxStackSize: number;
  };
}

export interface CanvasSnapshot {
  timestamp: string;
  objects: CanvasObject[];
  groups: CanvasGroup[];
  description: string;
}

export interface AssetManifestEntry {
  id: string;
  name: string;
  category: ScientificCategory;
  path: string;
  optimizedPath: string;
  keywords: string[];
  attribution: {
    source: string;
    author: string;
    license: string;
    licenseUrl: string;
    originalUrl: string;
  };
  viewBox: string;
  hasCurrentColor: boolean;
  hookCount: number;
  fileSizeBytes: number;
  checksum: string;
  indexedAt: string;
}

export interface AssetManifest {
  version: string;
  generatedAt: string;
  totalAssets: number;
  categories: Record<ScientificCategory, number>;
  assets: AssetManifestEntry[];
}

export interface ValidationError {
  field: string;
  message: string;
  receivedValue: unknown;
  expectedType: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface CitationEntry {
  assetId: string;
  assetName: string;
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
  originalUrl: string;
  instanceCount: number;
}

export interface CitationBlock {
  generatedAt: string;
  figureTitle: string;
  entries: CitationEntry[];
  formattedText: string;
  bibtex: string;
}

export interface SerializedSVGResult {
  success: boolean;
  svgString: string | null;
  errors: string[];
  warnings: string[];
  width: number;
  height: number;
  objectCount: number;
}
