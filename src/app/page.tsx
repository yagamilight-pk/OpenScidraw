import { AssetLibrary } from '../components/AssetLibrary';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SidebarAssetPanel } from '../components/SidebarAssetPanel';
import type { PatternBrushTheme } from '../components/SidebarAssetPanel';
import { CanvasStage } from '../components/CanvasStage';
import type { CanvasStageHandle } from '../components/CanvasStage';
import { PropertyInspector } from '../components/PropertyInspector';
import { AiAssistantPanel } from '../components/AiAssistantPanel';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { PanelLeft, PanelRight, ZoomIn, ZoomOut, Maximize, Grid3x3 } from 'lucide-react';
import type {
  CanvasObject, CanvasState, CanvasGroup, AssetManifest,
  AssetManifestEntry, CustomModifications,
} from '../types/canvas';
import { createDefaultModifications, createDefaultTransform, validateCanvasState } from '../utils/canvasBackendEngine';

const MANIFEST_URL = '/data-feed/manifest.json';
const DEFAULT_CANVAS_W = 1400;
const DEFAULT_CANVAS_H = 900;

type ColorTheme = 'accessible-hc' | 'nature-pastels' | 'cell-vivid' | 'cmyk-print' | 'default';

const THEME_PALETTES: Record<ColorTheme, string[]> = {
  'default': ['#3b82f6','#a855f7','#06b6d4','#10b981','#f59e0b','#ef4444','#94a3b8','#f1f5f9'],
  'accessible-hc': ['#0000FF','#FF6600','#009900','#CC0000','#FF00FF','#00CCCC','#000000','#FFFFFF'],
  'nature-pastels': ['#9ecae1','#fdbe85','#a1d99b','#fcbba1','#c994c7','#d9d9d9','#3182bd','#e6550d'],
  'cell-vivid': ['#E64B35','#4DBBD5','#00A087','#3C5488','#F39B7F','#8491B4','#91D1C2','#B09C85'],
  'cmyk-print': ['#005B99','#CC3300','#007A5E','#E6A817','#7B2D8B','#003A70','#C0392B','#27AE60'],
};

const CATEGORY_DEFAULT_COLORS: Record<string, string> = {
  'Cytology & Immunology': '#a855f7',
  'Molecular Biology': '#ef4444',
  'Laboratory Equipment': '#06b6d4',
  'Anatomy & Organ Systems': '#f59e0b',
  'General': '#3b82f6',
};

function makeId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultCanvasState(elements: CanvasObject[], groups: CanvasGroup[]): CanvasState {
  return {
    metadata: {
      id: `fig_${Date.now()}`,
      title: '',
      description: '',
      authorName: '',
      authorEmail: '',
      institution: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: '1.0.0',
      tags: [],
      exportedFormats: [],
      licenseType: 'CC-BY-4.0',
    },
    viewport: { offsetX: 0, offsetY: 0, zoom: 1, width: DEFAULT_CANVAS_W, height: DEFAULT_CANVAS_H },
    objects: elements,
    groups,
    backgroundColor: '#0b0f19',
    gridEnabled: true,
    gridSize: 20,
    snapToGrid: false,
    rulerEnabled: false,
    selectedObjectIds: [],
    activeGroupId: null,
    history: { undoStack: [], redoStack: [], maxStackSize: 100 },
  };
}

function parseCSVToChart(csv: string): Omit<CanvasObject, 'id'>[] {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((v) => v.trim().replace(/"/g, ''))
  );
  const now = new Date().toISOString();
  const elements: Omit<CanvasObject, 'id'>[] = [];
  const COLORS = THEME_PALETTES.default;
  const BAR_W = 50; const GAP = 20; const MAX_H = 180; const BASE_Y = 350;
  const values = rows.map((r) => parseFloat(r[1]) || 0);
  const maxVal = Math.max(...values, 1);
  rows.forEach((row, i) => {
    const val = parseFloat(row[1]) || 0;
    const bh = Math.max(4, (val / maxVal) * MAX_H);
    const bx = 200 + i * (BAR_W + GAP);
    const by = BASE_Y - bh;
    elements.push({
      type: 'primitive-rect',
      assetId: null, assetPath: null, svgRawContent: null,
      label: row[0] || `Item ${i + 1}`,
      category: 'General',
      boundingBox: { x: bx, y: by, width: BAR_W, height: bh },
      transform: createDefaultTransform(),
      modifications: {
        ...createDefaultModifications(),
        globalFill: { color: COLORS[i % COLORS.length], opacity: 1, rule: 'nonzero' },
        globalStroke: { color: 'none', width: 0, dashArray: 'none', dashOffset: 0, lineCap: 'round', lineJoin: 'round', miterLimit: 4, opacity: 1 },
      },
      textLayout: null,
      primitiveParams: { rect: { cornerRadius: 4 } },
      zIndex: i + 1,
      locked: false,
      visible: true,
      groupId: null,
      createdAt: now,
      updatedAt: now,
    });
    elements.push({
      type: 'text-block',
      assetId: null, assetPath: null, svgRawContent: null,
      label: `${row[0]} label`,
      category: 'General',
      boundingBox: { x: bx - 5, y: BASE_Y + 4, width: BAR_W + 10, height: 20 },
      transform: createDefaultTransform(),
      modifications: createDefaultModifications(),
      textLayout: {
        content: row[0] || `Item ${i + 1}`,
        fontFamily: 'Inter',
        fontSize: 10,
        fontWeight: 400,
        fontStyle: 'normal',
        textAlign: 'center',
        textDecoration: 'none',
        lineHeight: 1.3,
        letterSpacing: 0,
        color: '#94a3b8',
        backgroundColor: 'transparent',
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        borderRadius: 0,
      },
      primitiveParams: null,
      zIndex: rows.length + i + 1,
      locked: false,
      visible: true,
      groupId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
  return elements;
}

export default function Page() {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [elements, setElements] = useState<CanvasObject[]>([]);
  const [groups, setGroups] = useState<CanvasGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeBrush, setActiveBrush] = useState<PatternBrushTheme>('none');
  const [connectors, setConnectors] = useState<Parameters<typeof CanvasStage>[0]['connectors']>([]);
  const [title, setTitle] = useState('');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const stageRef = useRef<CanvasStageHandle>(null);

  // Layout State
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'controls' | 'gemini'>('controls');

  useEffect(() => {
    fetch(MANIFEST_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => setManifest(data as AssetManifest))
      .catch((err) => setManifestError(err.message));
  }, []);

  const canvasState = defaultCanvasState(elements, groups);

  const handleAddAsset = useCallback((asset: AssetManifestEntry, svgText: string) => {
    const color = CATEGORY_DEFAULT_COLORS[asset.category] ?? '#3b82f6';
    const now = new Date().toISOString();
    const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex), 0);
    const newEl: CanvasObject = {
      id: makeId(),
      type: 'svg-asset',
      assetId: asset.id,
      assetPath: asset.optimizedPath,
      svgRawContent: svgText,
      label: asset.name,
      category: asset.category,
      boundingBox: {
        x: 200 + Math.random() * 60,
        y: 200 + Math.random() * 60,
        width: 120,
        height: 120,
      },
      transform: createDefaultTransform(),
      modifications: {
        ...createDefaultModifications(),
        globalFill: { color, opacity: 1, rule: 'nonzero' },
      },
      textLayout: null,
      primitiveParams: null,
      zIndex: maxZ + 1,
      locked: false,
      visible: true,
      groupId: null,
      createdAt: now,
      updatedAt: now,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  }, [elements]);

  const handleInjectElements = useCallback((rawEls: Omit<CanvasObject, 'id'>[]) => {
    const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex), 0);
    const withIds = rawEls.map((el, i) => ({
      ...el,
      id: makeId(),
      zIndex: maxZ + el.zIndex + i,
    }));
    setElements((prev) => [...prev, ...withIds]);
    if (withIds.length > 0) setSelectedId(withIds[withIds.length - 1].id);
  }, [elements]);

  const handleUpdateElement = useCallback((id: string, patch: Partial<CanvasObject>) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...patch, updatedAt: new Date().toISOString() } : el));
  }, []);

  const handleUpdateModifications = useCallback((id: string, patch: Partial<CustomModifications>) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id
          ? { ...el, modifications: { ...el.modifications, ...patch }, updatedAt: new Date().toISOString() }
          : el
      )
    );
  }, []);

  const handleLayerAction = useCallback((action: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedId) return;
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === selectedId);
      if (idx === -1) return prev;
      if (action === 'front') { const el = sorted.splice(idx, 1)[0]; sorted.push(el); }
      else if (action === 'back') { const el = sorted.splice(idx, 1)[0]; sorted.unshift(el); }
      else if (action === 'forward' && idx < sorted.length - 1) { [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]]; }
      else if (action === 'backward' && idx > 0) { [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]]; }
      return sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
    });
  }, [selectedId]);

  const handleDuplicate = useCallback((id: string) => {
    const original = elements.find((el) => el.id === id);
    if (!original) return;
    const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex), 0);
    const clone: CanvasObject = {
      ...original,
      id: makeId(),
      boundingBox: { ...original.boundingBox, x: original.boundingBox.x + 24, y: original.boundingBox.y + 24 },
      zIndex: maxZ + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setElements((prev) => [...prev, clone]);
    setSelectedId(clone.id);
  }, [elements]);

  const handleDelete = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  }, []);

  const handleGroupElements = useCallback((ids: string[]) => {
    const newGroup: CanvasGroup = {
      id: makeId(),
      label: 'Group',
      memberIds: ids,
      locked: false,
      visible: true,
      zIndex: elements.reduce((m, el) => ids.includes(el.id) ? Math.max(m, el.zIndex) : m, 0),
    };
    setGroups((prev) => [...prev, newGroup]);
    setElements((prev) => prev.map((el) => ids.includes(el.id) ? { ...el, groupId: newGroup.id } : el));
  }, [elements]);

  const handleUngroupElement = useCallback((id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    setElements((prev) => prev.map((el) => el.groupId === id ? { ...el, groupId: null } : el));
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, [groups]);

  const handleApplyColorTheme = useCallback((theme: ColorTheme) => {
    const palette = THEME_PALETTES[theme];
    setElements((prev) =>
      prev.map((el, i) => ({
        ...el,
        modifications: {
          ...el.modifications,
          globalFill: {
            ...el.modifications.globalFill,
            color: palette[i % palette.length],
          },
        },
        updatedAt: new Date().toISOString(),
      }))
    );
  }, []);

  const handleStateLoad = useCallback((state: CanvasState) => {
    const result = validateCanvasState(state);
    if (!result.valid) {
      console.error('Invalid canvas state:', result.errors);
      return;
    }
    setElements(state.objects);
    setGroups(state.groups);
    setTitle(state.metadata.title);
    setSelectedId(null);
  }, []);

  const handleCSVDrop = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      if (!csv) return;
      const chartEls = parseCSVToChart(csv);
      handleInjectElements(chartEls);
    };
    reader.readAsText(file);
  }, [handleInjectElements]);

  const handleXLSXDrop = useCallback((file: File) => {
    console.warn('XLSX parsing requires a runtime library (e.g., SheetJS). Falling back to CSV reader attempt.', file.name);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] overflow-hidden text-slate-200 select-none">
      <WorkspaceHeader
        canvasHandle={stageRef}
        state={canvasState}
        manifest={manifest}
        title={title}
        onTitleChange={setTitle}
        onStateLoad={handleStateLoad}
        onZoomIn={() => stageRef.current?.zoomTo(Math.min(8, 1.2))}
        onZoomOut={() => stageRef.current?.zoomTo(Math.max(0.1, 0.8))}
        onZoomReset={() => stageRef.current?.centerViewport()}
        onToggleGrid={() => setGridEnabled((v) => !v)}
        gridEnabled={gridEnabled}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Resizable Sidebar */}
        <div className={`transition-all duration-300 ease-in-out shrink-0 bg-[#0f1623] border-r border-[#1e2d45] ${isLeftOpen ? 'w-[320px]' : 'w-0 overflow-hidden border-none'}`}>
          <div className="w-[320px] h-full flex flex-col">
            <AssetLibrary />
          </div>
        </div>

        <main className="flex-1 relative overflow-hidden flex flex-col">
          {/* Floating Collapsible Sidebar Toggles */}
          <div className="absolute top-4 left-4 z-20">
            <button onClick={() => setIsLeftOpen(!isLeftOpen)} title="Toggle Asset Sidebar" className="p-2 bg-[#0f1623]/80 backdrop-blur-md border border-[#1e2d45] rounded-lg shadow-lg hover:bg-white/10 transition-colors">
              <PanelLeft className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="absolute top-4 right-4 z-20">
            <button onClick={() => setIsRightOpen(!isRightOpen)} title="Toggle Inspector Sidebar" className="p-2 bg-[#0f1623]/80 backdrop-blur-md border border-[#1e2d45] rounded-lg shadow-lg hover:bg-white/10 transition-colors">
              <PanelRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {manifestError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-400 shadow-lg">
              <span>⚠</span> Asset manifest failed to load: {manifestError}
            </div>
          )}

          <CanvasStage
            ref={stageRef}
            elements={elements}
            selectedId={selectedId}
            connectors={connectors}
            activeBrush={activeBrush}
            onSelect={setSelectedId}
            onUpdateElements={setElements}
            onConnectorAdd={(c) => setConnectors((prev) => [...prev, c])}
          />

          {/* Floating Viewport Utilities Layer */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-[#0f1623]/90 backdrop-blur-md border border-[#1e2d45] rounded-xl shadow-2xl">
            <button onClick={() => stageRef.current?.zoomTo(Math.max(0.1, 0.8))} title="Zoom Out" className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 min-w-[70px] text-center text-[10px] font-mono text-blue-400 font-bold bg-[#0b0f19] rounded-lg border border-[#1e2d45] shadow-inner select-none cursor-default">
              FIT
            </div>
            <button onClick={() => stageRef.current?.zoomTo(Math.min(8, 1.2))} title="Zoom In" className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            
            <div className="w-px h-5 bg-[#1e2d45] mx-1" />
            
            <button onClick={() => stageRef.current?.centerViewport()} title="Center Viewport" className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <Maximize className="w-4 h-4" />
            </button>
            <button onClick={() => setGridEnabled(v => !v)} title="Toggle Grid" className={`p-1.5 rounded-lg transition-colors ${gridEnabled ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}>
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>
        </main>

        {/* Right Tabbed Docking Overlay Sidebar */}
        <div className={`transition-all duration-300 ease-in-out shrink-0 bg-[#0f1623] border-l border-[#1e2d45] ${isRightOpen ? 'w-[320px]' : 'w-0 overflow-hidden border-none'}`}>
          <div className="w-[320px] h-full flex flex-col">
            
            {/* Tabbed Header */}
            <div className="flex p-2 gap-1 border-b border-[#1e2d45] shrink-0 bg-[#0b0f19]">
               <button 
                onClick={() => setActiveRightTab('controls')} 
                className={`flex-1 py-2 text-[10px] font-bold rounded uppercase tracking-wider transition-all duration-200 ${activeRightTab === 'controls' ? 'bg-[#1e2d45] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                 Controls
               </button>
               <button 
                onClick={() => setActiveRightTab('gemini')} 
                className={`flex-1 py-2 text-[10px] font-bold rounded uppercase tracking-wider transition-all duration-200 ${activeRightTab === 'gemini' ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                 Gemini AI
               </button>
            </div>

            {/* Tab Content Enclosure */}
            <div className="flex-1 overflow-hidden relative">
              <div className={`absolute inset-0 transition-opacity duration-300 ${activeRightTab === 'controls' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <PropertyInspector
                  selectedId={selectedId}
                  elements={elements}
                  groups={groups}
                  onUpdateElement={handleUpdateElement}
                  onUpdateModifications={handleUpdateModifications}
                  onLayerAction={handleLayerAction}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onGroupElements={handleGroupElements}
                  onUngroupElement={handleUngroupElement}
                  onSelectElement={setSelectedId}
                  onApplyColorTheme={handleApplyColorTheme}
                />
              </div>
              <div className={`absolute inset-0 transition-opacity duration-300 ${activeRightTab === 'gemini' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <AiAssistantPanel
                  onInjectElements={handleInjectElements}
                  canvasWidth={DEFAULT_CANVAS_W}
                  canvasHeight={DEFAULT_CANVAS_H}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
