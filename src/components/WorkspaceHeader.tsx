import React, { useState, useRef } from 'react';
import {
  Download, FileImage, FileCode, FileType,
  Quote, Copy, Check, BookOpen, ZoomIn, ZoomOut,
  RotateCcw, Upload,
  Atom,
  ChevronDown, Loader2, AlertTriangle
} from 'lucide-react';
import type { CanvasStageHandle } from './CanvasStage';
import type { CanvasState, AssetManifest } from '../types/canvas';
import { generateCitationBlock, serializeCanvasToSVG } from '../utils/canvasBackendEngine';

interface WorkspaceHeaderProps {
  canvasHandle: React.RefObject<CanvasStageHandle | null>;
  state: CanvasState;
  manifest: AssetManifest | null;
  title: string;
  onTitleChange: (t: string) => void;
  onStateLoad: (state: CanvasState) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleGrid: () => void;
  gridEnabled: boolean;
}

type ExportFormat = 'png-1x' | 'png-2x' | 'png-4x' | 'svg' | 'json';

const EXPORT_OPTIONS: { key: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'png-2x', label: 'PNG (2×)', icon: <FileImage className="w-3.5 h-3.5" />, desc: 'High-res raster, 2× canvas scale' },
  { key: 'png-4x', label: 'PNG (4×)', icon: <FileImage className="w-3.5 h-3.5" />, desc: 'Print-quality 4× super-sampling' },
  { key: 'png-1x', label: 'PNG (1×)', icon: <FileImage className="w-3.5 h-3.5" />, desc: 'Screen-resolution raster export' },
  { key: 'svg', label: 'SVG Vector', icon: <FileCode className="w-3.5 h-3.5" />, desc: 'Infinite-resolution scalable vector' },
  { key: 'json', label: 'JSON State', icon: <FileType className="w-3.5 h-3.5" />, desc: 'Portable canvas project file' },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  canvasHandle, state, manifest, title, onTitleChange,
  onStateLoad, onZoomIn, onZoomOut, onZoomReset, onToggleGrid, gridEnabled,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [citationOpen, setCitationOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const exportDropRef = useRef<HTMLDivElement>(null);

  const slug = (title || 'openscidraw-figure').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const citation = manifest && state.objects.length > 0
    ? generateCitationBlock(state, manifest)
    : null;

  const handleExport = async (format: ExportFormat) => {
    setExportOpen(false);
    setExporting(format);
    setExportError(null);
    try {
      if (format === 'json') {
        const json = JSON.stringify(state, null, 2);
        downloadBlob(new Blob([json], { type: 'application/json' }), `${slug}.openscidraw.json`);
        return;
      }
      if (format === 'svg') {
        const result = serializeCanvasToSVG(state);
        if (!result.success || !result.svgString) {
          setExportError(result.errors.join('; ') || 'SVG serialization failed.');
          return;
        }
        downloadBlob(new Blob([result.svgString], { type: 'image/svg+xml;charset=utf-8' }), `${slug}.svg`);
        return;
      }
      if (!canvasHandle.current) { setExportError('Canvas not ready.'); return; }
      const scale = format === 'png-4x' ? 4 : format === 'png-2x' ? 2 : 1;
      const dataUrl = await canvasHandle.current.exportPNG(scale);
      if (!dataUrl) { setExportError('Canvas export returned empty result.'); return; }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `${slug}@${scale}x.png`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        onStateLoad(parsed as CanvasState);
      } catch {
        setExportError('Failed to parse canvas JSON. File may be corrupted or invalid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyCitation = () => {
    if (!citation) return;
    navigator.clipboard.writeText(citation.formattedText).catch(() => {});
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  return (
    <header className="w-full bg-[#0f1623] border-b border-[#1e2d45] px-4 py-2.5 flex items-center gap-3 shrink-0 z-10">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
          <Atom className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white tracking-tight leading-none">OpenSciDraw</span>
          <span className="text-[9px] text-slate-500 leading-none">Open-Source Scientific Canvas</span>
        </div>
      </div>

      <div className="w-px h-6 bg-[#1e2d45] shrink-0" />

      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled Figure"
        className="w-48 bg-transparent border-b border-transparent hover:border-[#1e2d45] focus:border-blue-500 text-sm font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors py-0.5"
      />

      <div className="w-px h-6 bg-[#1e2d45] shrink-0" />

      <div className="flex items-center gap-1">
        {[
          { icon: <ZoomOut className="w-3.5 h-3.5" />, action: onZoomOut, title: 'Zoom Out' },
          { icon: <RotateCcw className="w-3.5 h-3.5" />, action: onZoomReset, title: 'Reset View' },
          { icon: <ZoomIn className="w-3.5 h-3.5" />, action: onZoomIn, title: 'Zoom In' },
        ].map(({ icon, action, title: t }) => (
          <button key={t} onClick={action} title={t}
            className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
            {icon}
          </button>
        ))}
        <button onClick={onToggleGrid} title="Toggle Grid"
          className={`p-1.5 rounded transition-colors text-xs font-bold ${gridEnabled ? 'text-blue-400 bg-blue-600/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
          ⊞
        </button>
      </div>

      <div className="w-px h-6 bg-[#1e2d45] shrink-0" />

      <div className="flex items-center gap-1">
        <button onClick={() => loadInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
          <Upload className="w-3.5 h-3.5" /> Load
        </button>
        <input ref={loadInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />

        <button
          onClick={() => { setCitationOpen((v) => !v); setExportOpen(false); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${citationOpen ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
          <Quote className="w-3.5 h-3.5" /> Cite
          {citation && citation.entries.length > 0 && (
            <span className="ml-0.5 px-1 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">{citation.entries.length}</span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => { setExportOpen((v) => !v); setCitationOpen(false); setExportError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${exportOpen ? 'bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
            <ChevronDown className={`w-3 h-3 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportOpen && (
            <div ref={exportDropRef} className="absolute top-full right-0 mt-1.5 w-64 bg-[#0f1623] border border-[#1e2d45] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-[#1e2d45]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export Format</p>
              </div>
              {EXPORT_OPTIONS.map((opt) => (
                <button key={opt.key} onClick={() => handleExport(opt.key)}
                  disabled={!!exporting}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-white/[0.04] transition-colors disabled:opacity-50">
                  <span className="text-blue-400">{opt.icon}</span>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-200">{opt.label}</div>
                    <div className="text-[9px] text-slate-500">{opt.desc}</div>
                  </div>
                  {exporting === opt.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 max-w-xs shrink-0">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">{exportError}</span>
          <button onClick={() => setExportError(null)} className="ml-1 shrink-0 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-[10px] text-slate-600 shrink-0">
        <span>{state.objects.filter((o) => o.visible).length} element{state.objects.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span className="text-slate-500">{new Date().toLocaleDateString()}</span>
      </div>

      {citationOpen && (
        <div className="absolute top-full right-4 mt-1.5 w-96 bg-[#0f1623] border border-[#1e2d45] rounded-xl shadow-2xl z-50 overflow-hidden" style={{ top: '52px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Academic Attribution</span>
            </div>
            <button onClick={() => setCitationOpen(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
          </div>

          {!citation || citation.entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-[10px] text-slate-500">
              Add elements from the asset library to generate attribution credits.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-3">
                {citation.entries.map((entry, i) => (
                  <div key={entry.assetId} className="text-[10px] text-slate-300 leading-relaxed border-b border-[#1e2d45] pb-3 last:border-0 last:pb-0">
                    <span className="font-bold text-slate-400">[{i + 1}]</span> <span className="font-semibold">{entry.source}</span> — "{entry.assetName}"
                    <div className="mt-0.5 text-slate-500">
                      {entry.license} · {entry.instanceCount} use{entry.instanceCount > 1 ? 's' : ''}
                    </div>
                    <a href={entry.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{entry.licenseUrl}</a>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-[#1e2d45] flex gap-2">
                <button onClick={copyCitation}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 font-semibold transition-colors">
                  {copiedCitation ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Credits</>}
                </button>
                <button onClick={() => {
                  if (!citation) return;
                  downloadBlob(new Blob([citation.bibtex], { type: 'text/plain' }), 'openscidraw-references.bib');
                }} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0b0f19] border border-[#1e2d45] hover:border-blue-500/30 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 font-semibold transition-colors">
                  <Download className="w-3 h-3" /> .bib
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
};
