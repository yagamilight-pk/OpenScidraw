import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Upload, BarChart2, Layers,
  Microscope, Dna, FlaskConical, Heart, Grid3x3, Repeat2,
  X, Plus, FileSpreadsheet
} from 'lucide-react';
import type { AssetManifest, AssetManifestEntry } from '../types/canvas';

export type PatternBrushTheme = 'lipid-bilayer' | 'dna-helix' | 'microtubule' | 'capillary' | 'none';

interface SidebarAssetPanelProps {
  manifest: AssetManifest | null;
  selectedBrush: PatternBrushTheme;
  onSelectBrush: (brush: PatternBrushTheme) => void;
  onAddAsset: (entry: AssetManifestEntry, svgText: string) => void;
  onCSVDrop: (file: File) => void;
  onXLSXDrop: (file: File) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Cytology & Immunology': <Microscope className="w-3.5 h-3.5" />,
  'Molecular Biology': <Dna className="w-3.5 h-3.5" />,
  'Laboratory Equipment': <FlaskConical className="w-3.5 h-3.5" />,
  'Anatomy & Organ Systems': <Heart className="w-3.5 h-3.5" />,
  'General': <Grid3x3 className="w-3.5 h-3.5" />,
};

const BRUSH_PRESETS: { key: PatternBrushTheme; label: string; color: string; desc: string }[] = [
  { key: 'lipid-bilayer', label: 'Lipid Bilayer', color: '#06b6d4', desc: 'Repeating phospholipid heads & tails along a path' },
  { key: 'dna-helix', label: 'DNA Double Helix', color: '#a855f7', desc: 'Interleaved helical backbone stamp along curve' },
  { key: 'microtubule', label: 'Microtubule', color: '#f59e0b', desc: 'Tubulin dimer ring segments along a vector' },
  { key: 'capillary', label: 'Capillary Vessel', color: '#ef4444', desc: 'Endothelial cell wall repeater on path arc' },
];

const SVG_CACHE: Record<string, string> = {};

async function fetchSVGText(path: string): Promise<string> {
  if (SVG_CACHE[path]) return SVG_CACHE[path];
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    SVG_CACHE[path] = text;
    return text;
  } catch {
    return '';
  }
}

export const SidebarAssetPanel: React.FC<SidebarAssetPanelProps> = ({
  manifest, selectedBrush, onSelectBrush, onAddAsset, onCSVDrop, onXLSXDrop,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assets' | 'brush' | 'plot'>('assets');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [svgTexts, setSvgTexts] = useState<Record<string, string>>({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo<Record<string, AssetManifestEntry[]>>(() => {
    const entries = manifest?.assets ?? [];
    const filtered = query.trim()
      ? entries.filter(
          (a) =>
            a.name.toLowerCase().includes(query.toLowerCase()) ||
            a.keywords.some((k) => k.includes(query.toLowerCase()))
        )
      : entries;
    return filtered.reduce<Record<string, AssetManifestEntry[]>>((acc, a) => {
      (acc[a.category] = acc[a.category] ?? []).push(a);
      return acc;
    }, {});
  }, [manifest, query]);

  useEffect(() => {
    const entries = manifest?.assets ?? [];
    entries.forEach((a) => {
      if (!svgTexts[a.id]) {
        fetchSVGText(a.optimizedPath).then((text) => {
          if (text) setSvgTexts((prev) => ({ ...prev, [a.id]: text }));
        });
      }
    });
  }, [manifest]);

  const toggleCollapse = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file.name.endsWith('.csv')) onCSVDrop(file);
      else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) onXLSXDrop(file);
    },
    [onCSVDrop, onXLSXDrop]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.csv')) onCSVDrop(file);
    else onXLSXDrop(file);
    e.target.value = '';
  };

  return (
    <aside className="w-72 h-full bg-[#0f1623] border-r border-[#1e2d45] flex flex-col text-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45] shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Asset Library</span>
        <div className="flex gap-1">
          {(['assets', 'brush', 'plot'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 rounded text-[10px] font-semibold uppercase transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab === 'assets' ? <Layers className="w-3.5 h-3.5" /> : tab === 'brush' ? <Repeat2 className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'assets' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vectors..."
                className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {Object.entries(grouped).length === 0 && (
              <p className="text-center text-slate-600 text-xs py-8">
                {manifest ? 'No results found.' : 'Loading manifest…'}
              </p>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md transition-colors"
                >
                  {collapsed[cat] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {CATEGORY_ICONS[cat]}
                  <span>{cat}</span>
                  <span className="ml-auto text-slate-600">{items.length}</span>
                </button>
                {!collapsed[cat] && (
                  <div className="grid grid-cols-2 gap-1.5 pl-1 pr-1 mb-1">
                    {items.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => onAddAsset(asset, svgTexts[asset.id] ?? '')}
                        className="group flex flex-col items-center p-2 rounded-lg bg-[#0b0f19]/60 border border-[#1e2d45] hover:border-blue-500/40 hover:bg-blue-600/5 transition-all text-left"
                      >
                        <div className="w-14 h-14 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
                          {svgTexts[asset.id] ? (
                            <div
                              className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                              dangerouslySetInnerHTML={{ __html: svgTexts[asset.id] }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1e2d45] animate-pulse" />
                          )}
                        </div>
                        <span className="mt-1 text-[9px] font-medium text-slate-400 group-hover:text-slate-200 truncate w-full text-center transition-colors">
                          {asset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'brush' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
            Select a pattern theme, then draw a curved path on the canvas. The selected unit will tile and bend along your stroke.
          </p>
          <button
            onClick={() => onSelectBrush('none')}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
              selectedBrush === 'none'
                ? 'border-slate-500 bg-slate-500/10 text-slate-200'
                : 'border-[#1e2d45] text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            No Pattern (Free Path)
          </button>
          {BRUSH_PRESETS.map((b) => (
            <button
              key={b.key}
              onClick={() => onSelectBrush(b.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                selectedBrush === b.key
                  ? 'border-blue-500/60 bg-blue-600/10'
                  : 'border-[#1e2d45] hover:border-[#2e3f5a]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <span className="text-xs font-semibold text-slate-200">{b.label}</span>
                {selectedBrush === b.key && (
                  <span className="ml-auto text-[9px] font-bold text-blue-400 uppercase">Active</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 ml-4">{b.desc}</p>
            </button>
          ))}
          <div className="mt-3 p-3 bg-[#0b0f19] rounded-lg border border-[#1e2d45]">
            <p className="text-[10px] text-slate-400 font-semibold mb-1">Tiling Controls</p>
            <div className="space-y-2">
              {['Unit Spacing', 'Unit Scale', 'Path Tension'].map((label) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 w-24 shrink-0">{label}</span>
                  <input type="range" min="0" max="100" defaultValue="50" className="flex-1 h-1 accent-blue-500 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plot' && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
            Drop a CSV or Excel file to generate an editable vector chart directly on the canvas. Supports bar, line, scatter, pie, and heatmap layouts.
          </p>
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleFileDrop}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 px-4 transition-all cursor-pointer ${
              isDraggingOver
                ? 'border-blue-400 bg-blue-600/10'
                : 'border-[#1e2d45] hover:border-[#2e4060] hover:bg-white/[0.02]'
            }`}
          >
            <FileSpreadsheet className="w-8 h-8 text-slate-600" />
            <p className="text-xs text-slate-400 text-center">Drop a .csv or .xlsx file here</p>
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-400 font-semibold cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Browse File
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
            </label>
          </div>
          <div className="mt-4 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Chart Type</p>
            {['Bar Chart', 'Line Graph', 'Scatter Plot', 'Pie / Donut', 'Heatmap Grid'].map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer py-1 px-2 rounded hover:bg-white/5">
                <input type="radio" name="chart-type" className="accent-blue-500" defaultChecked={t === 'Bar Chart'} />
                {t}
              </label>
            ))}
          </div>
          <div className="mt-4 p-3 bg-[#0b0f19] rounded-lg border border-[#1e2d45] space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Axis Mapping</p>
            {['X Column (Label)', 'Y Column (Values)', 'Group/Series'].map((lbl) => (
              <div key={lbl} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500">{lbl}</span>
                <input
                  type="text"
                  placeholder="auto-detect"
                  className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                />
              </div>
            ))}
          </div>
          <button className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Generate Chart on Canvas
          </button>
        </div>
      )}
    </aside>
  );
};
