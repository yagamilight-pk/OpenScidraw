import React, { useState, useCallback } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Bold, Italic, Underline,
  Layers, ChevronDown, ChevronRight, Lock, Eye, EyeOff,
  Palette, Sliders, Type, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown as ChevDown,
  Copy, Trash2,
} from 'lucide-react';
import type { CanvasObject, CanvasGroup, CustomModifications, TextLayoutBlock } from '../types/canvas';

type ColorTheme = 'accessible-hc' | 'nature-pastels' | 'cell-vivid' | 'cmyk-print' | 'default';

const COLOR_THEMES: Record<ColorTheme, { label: string; desc: string; palette: string[] }> = {
  'default': { label: 'OpenSciDraw Default', desc: 'Curated dark-mode scientific palette', palette: ['#3b82f6','#a855f7','#06b6d4','#10b981','#f59e0b','#ef4444','#94a3b8','#f1f5f9'] },
  'accessible-hc': { label: 'Accessible High-Contrast', desc: 'WCAG 2.1 AAA for color-blind readers', palette: ['#0000FF','#FF6600','#009900','#CC0000','#FF00FF','#00CCCC','#000000','#FFFFFF'] },
  'nature-pastels': { label: 'Nature Portfolio Pastels', desc: 'Soft, print-ready tones used in Nature journals', palette: ['#9ecae1','#fdbe85','#a1d99b','#fcbba1','#c994c7','#d9d9d9','#3182bd','#e6550d'] },
  'cell-vivid': { label: 'Cell Press Vivid', desc: 'High-saturation palette from Cell family journals', palette: ['#E64B35','#4DBBD5','#00A087','#3C5488','#F39B7F','#8491B4','#91D1C2','#B09C85'] },
  'cmyk-print': { label: 'CMYK Print-Safe', desc: 'Offset-press safe, no out-of-gamut RGB values', palette: ['#005B99','#CC3300','#007A5E','#E6A817','#7B2D8B','#003A70','#C0392B','#27AE60'] },
};

interface LayerTreeNode {
  object: CanvasObject;
  children: LayerTreeNode[];
}

function buildLayerTree(objects: CanvasObject[], _groups: CanvasGroup[]): LayerTreeNode[] {
  const roots = objects.filter((o) => !o.groupId).sort((a, b) => b.zIndex - a.zIndex);
  function makeNode(obj: CanvasObject): LayerTreeNode {
    const children = objects
      .filter((c) => c.groupId === obj.id)
      .sort((a, b) => b.zIndex - a.zIndex)
      .map(makeNode);
    return { object: obj, children };
  }
  return roots.map(makeNode);
}

interface PropertyInspectorProps {
  selectedId: string | null;
  elements: CanvasObject[];
  groups: CanvasGroup[];
  onUpdateElement: (id: string, patch: Partial<CanvasObject>) => void;
  onUpdateModifications: (id: string, patch: Partial<CustomModifications>) => void;
  onLayerAction: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onGroupElements: (ids: string[]) => void;
  onUngroupElement: (id: string) => void;
  onSelectElement: (id: string) => void;
  onApplyColorTheme: (theme: ColorTheme) => void;
}

const PRESET_COLORS = COLOR_THEMES.default.palette;

const FloatInput: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (v: number) => void }> =
  ({ label, value, min, max, step = 1, unit = '', onChange }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          min={min} max={max} step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 text-right"
        />
        {unit && <span className="text-[10px] text-slate-600 shrink-0">{unit}</span>}
      </div>
    </div>
  );

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; open: boolean; onToggle: () => void }> = ({ icon, label, open, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex items-center gap-2 w-full px-3 py-2 border-b border-[#1e2d45] text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] transition-colors"
  >
    {icon}
    <span>{label}</span>
    <span className="ml-auto">{open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
  </button>
);

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedId, elements, groups, onUpdateElement, onUpdateModifications,
  onLayerAction, onDuplicate, onDelete, onGroupElements: _onGroupElements, onUngroupElement: _onUngroupElement,
  onSelectElement, onApplyColorTheme,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    transform: true, fill: true, text: false, theme: false, layers: true,
  });
  const [layerCollapsed, setLayerCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  const obj = elements.find((e) => e.id === selectedId);

  const updateBB = useCallback((patch: Partial<CanvasObject['boundingBox']>) => {
    if (!obj) return;
    onUpdateElement(obj.id, { boundingBox: { ...obj.boundingBox, ...patch } });
  }, [obj, onUpdateElement]);

  const updateTransform = useCallback((patch: Partial<CanvasObject['transform']>) => {
    if (!obj) return;
    onUpdateElement(obj.id, { transform: { ...obj.transform, ...patch } });
  }, [obj, onUpdateElement]);

  const updateFill = useCallback((color: string) => {
    if (!obj) return;
    onUpdateModifications(obj.id, { globalFill: { ...obj.modifications.globalFill, color } });
  }, [obj, onUpdateModifications]);

  const updateOpacity = useCallback((v: number) => {
    if (!obj) return;
    onUpdateModifications(obj.id, { globalOpacity: Math.min(1, Math.max(0, v / 100)) });
  }, [obj, onUpdateModifications]);

  const updateTextLayout = useCallback((patch: Partial<TextLayoutBlock>) => {
    if (!obj || !obj.textLayout) return;
    onUpdateElement(obj.id, { textLayout: { ...obj.textLayout, ...patch } });
  }, [obj, onUpdateElement]);

  const tree = buildLayerTree(elements, groups);

  function renderNode(node: LayerTreeNode, depth = 0): React.ReactNode {
    const el = node.object;
    const isSelected = el.id === selectedId;
    const hasChildren = node.children.length > 0;
    const isCollapsed = layerCollapsed[el.id];
    return (
      <div key={el.id}>
        <div
          onClick={() => onSelectElement(el.id)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-[10px] transition-colors ${
            isSelected ? 'bg-blue-600/15 text-blue-300' : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
          }`}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); setLayerCollapsed((s) => ({ ...s, [el.id]: !s[el.id] })); }} className="shrink-0">
              {isCollapsed ? <ChevronRight className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>
          ) : <span className="w-2.5 shrink-0" />}
          <span className="truncate flex-1">{el.label || el.type}</span>
          <button onClick={(e) => { e.stopPropagation(); onUpdateElement(el.id, { visible: !el.visible }); }} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            {el.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-slate-600" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
            {el.locked ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Lock className="w-2.5 h-2.5" />}
          </button>
        </div>
        {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <aside className="w-72 h-full bg-[#0f1623] border-l border-[#1e2d45] flex flex-col text-slate-200 overflow-y-auto">
      <div className="px-4 py-3 border-b border-[#1e2d45] shrink-0">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Properties</p>
        {obj && <p className="text-[10px] text-slate-600 mt-0.5 truncate">{obj.label || obj.type} · {obj.category ?? 'Unlabeled'}</p>}
      </div>

      {obj ? (
        <>
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1e2d45]">
            {[
              { icon: <ChevronsUp className="w-3.5 h-3.5" />, title: 'Bring to Front', action: 'front' as const },
              { icon: <ChevronUp className="w-3.5 h-3.5" />, title: 'Forward', action: 'forward' as const },
              { icon: <ChevDown className="w-3.5 h-3.5" />, title: 'Backward', action: 'backward' as const },
              { icon: <ChevronsDown className="w-3.5 h-3.5" />, title: 'Send to Back', action: 'back' as const },
            ].map((btn) => (
              <button key={btn.action} onClick={() => onLayerAction(btn.action)} title={btn.title}
                className="flex-1 flex items-center justify-center p-1.5 rounded bg-[#0b0f19] border border-[#1e2d45] hover:border-blue-500/40 hover:text-blue-400 transition-all">
                {btn.icon}
              </button>
            ))}
            <button onClick={() => onDuplicate(obj.id)} title="Duplicate" className="flex items-center justify-center p-1.5 rounded bg-[#0b0f19] border border-[#1e2d45] hover:border-blue-500/40 hover:text-blue-400 transition-all">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(obj.id)} title="Delete" className="flex items-center justify-center p-1.5 rounded bg-[#0b0f19] border border-red-500/20 hover:bg-red-500/10 hover:text-red-400 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <SectionHeader icon={<Sliders className="w-3.5 h-3.5" />} label="Transform" open={openSections.transform} onToggle={() => toggle('transform')} />
          {openSections.transform && (
            <div className="px-3 py-3 space-y-2 border-b border-[#1e2d45]">
              <div className="grid grid-cols-2 gap-2">
                <FloatInput label="X" value={obj.boundingBox.x} step={1} unit="px" onChange={(v) => updateBB({ x: v })} />
                <FloatInput label="Y" value={obj.boundingBox.y} step={1} unit="px" onChange={(v) => updateBB({ y: v })} />
                <FloatInput label="W" value={obj.boundingBox.width} min={1} step={1} unit="px" onChange={(v) => updateBB({ width: v })} />
                <FloatInput label="H" value={obj.boundingBox.height} min={1} step={1} unit="px" onChange={(v) => updateBB({ height: v })} />
              </div>
              <FloatInput label="Rotation" value={obj.transform.rotation} min={0} max={359} step={1} unit="°" onChange={(v) => updateTransform({ rotation: v })} />
              <FloatInput label="Scale X" value={obj.transform.scaleX} min={0.01} step={0.01} onChange={(v) => updateTransform({ scaleX: v })} />
              <FloatInput label="Scale Y" value={obj.transform.scaleY} min={0.01} step={0.01} onChange={(v) => updateTransform({ scaleY: v })} />
              <div className="flex gap-3 pt-1">
                {[{ label: 'Flip H', key: 'flipHorizontal' as const }, { label: 'Flip V', key: 'flipVertical' as const }].map(({ label, key }) => (
                  <label key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={obj.transform[key]} onChange={(e) => updateTransform({ [key]: e.target.checked })} className="accent-blue-500 w-3 h-3" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <SectionHeader icon={<Palette className="w-3.5 h-3.5" />} label="Fill & Opacity" open={openSections.fill} onToggle={() => toggle('fill')} />
          {openSections.fill && (
            <div className="px-3 py-3 space-y-3 border-b border-[#1e2d45]">
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => updateFill(c)}
                    style={{ backgroundColor: c }}
                    className={`h-6 rounded cursor-pointer transition-all hover:scale-110 ${obj.modifications.globalFill.color === c ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0f1623] scale-105' : ''}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={obj.modifications.globalFill.color} onChange={(e) => updateFill(e.target.value)}
                  className="w-8 h-8 rounded border border-[#1e2d45] bg-transparent cursor-pointer" />
                <input type="text" value={obj.modifications.globalFill.color} onChange={(e) => updateFill(e.target.value)}
                  className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 uppercase" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-20 shrink-0">Opacity</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(obj.modifications.globalOpacity * 100)}
                  onChange={(e) => updateOpacity(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 accent-blue-500 cursor-pointer" />
                <span className="text-[10px] text-blue-400 w-8 text-right">{Math.round(obj.modifications.globalOpacity * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-20 shrink-0">Blend Mode</span>
                <select value={obj.modifications.blendMode}
                  onChange={(e) => onUpdateModifications(obj.id, { blendMode: e.target.value as any })}
                  className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500">
                  {['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-20 shrink-0">Drop Shadow</span>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={obj.modifications.dropShadow.enabled}
                    onChange={(e) => onUpdateModifications(obj.id, { dropShadow: { ...obj.modifications.dropShadow, enabled: e.target.checked } })}
                    className="accent-blue-500" />
                  Enable
                </label>
              </div>
            </div>
          )}

          {obj.type === 'text-block' && obj.textLayout && (
            <>
              <SectionHeader icon={<Type className="w-3.5 h-3.5" />} label="Text Formatting" open={openSections.text} onToggle={() => toggle('text')} />
              {openSections.text && (
                <div className="px-3 py-3 space-y-2 border-b border-[#1e2d45]">
                  <div className="flex items-center gap-1">
                    {[
                      { icon: <AlignLeft className="w-3.5 h-3.5" />, value: 'left' as const },
                      { icon: <AlignCenter className="w-3.5 h-3.5" />, value: 'center' as const },
                      { icon: <AlignRight className="w-3.5 h-3.5" />, value: 'right' as const },
                      { icon: <AlignJustify className="w-3.5 h-3.5" />, value: 'justify' as const },
                    ].map(({ icon, value }) => (
                      <button key={value} onClick={() => updateTextLayout({ textAlign: value })}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded border transition-all ${obj.textLayout!.textAlign === value ? 'border-blue-500/50 bg-blue-600/10 text-blue-400' : 'border-[#1e2d45] text-slate-500 hover:text-slate-300'}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateTextLayout({ fontWeight: obj.textLayout!.fontWeight === 700 ? 400 : 700 })}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded border transition-all ${obj.textLayout!.fontWeight >= 700 ? 'border-blue-500/50 bg-blue-600/10 text-blue-400' : 'border-[#1e2d45] text-slate-500 hover:text-slate-300'}`}>
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => updateTextLayout({ fontStyle: obj.textLayout!.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded border transition-all ${obj.textLayout!.fontStyle === 'italic' ? 'border-blue-500/50 bg-blue-600/10 text-blue-400' : 'border-[#1e2d45] text-slate-500 hover:text-slate-300'}`}>
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => updateTextLayout({ textDecoration: obj.textLayout!.textDecoration === 'underline' ? 'none' : 'underline' })}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded border transition-all ${obj.textLayout!.textDecoration === 'underline' ? 'border-blue-500/50 bg-blue-600/10 text-blue-400' : 'border-[#1e2d45] text-slate-500 hover:text-slate-300'}`}>
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <FloatInput label="Font Size" value={obj.textLayout.fontSize} min={6} max={200} step={1} unit="px" onChange={(v) => updateTextLayout({ fontSize: v })} />
                  <FloatInput label="Line Height" value={obj.textLayout.lineHeight} min={0.5} max={4} step={0.1} onChange={(v) => updateTextLayout({ lineHeight: v })} />
                  <FloatInput label="Letter Spacing" value={obj.textLayout.letterSpacing} min={-5} max={30} step={0.5} unit="px" onChange={(v) => updateTextLayout({ letterSpacing: v })} />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-20 shrink-0">Font Family</span>
                    <select value={obj.textLayout.fontFamily} onChange={(e) => updateTextLayout({ fontFamily: e.target.value })}
                      className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500">
                      {['Inter', 'Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Courier New', 'Roboto', 'Lato'].map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <textarea value={obj.textLayout.content} onChange={(e) => updateTextLayout({ content: e.target.value })}
                    rows={3} className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded px-2 py-1.5 text-xs text-slate-200 resize-none focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="px-3 py-4 text-center text-[10px] text-slate-600">Select a canvas element to edit its properties.</div>
      )}

      <SectionHeader icon={<Palette className="w-3.5 h-3.5" />} label="Journal Color Themes" open={openSections.theme} onToggle={() => toggle('theme')} />
      {openSections.theme && (
        <div className="px-3 py-3 space-y-2 border-b border-[#1e2d45]">
          <p className="text-[10px] text-slate-500 leading-relaxed mb-2">Apply a publication-standard color palette to all canvas elements globally.</p>
          {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(([key, theme]) => (
            <button key={key} onClick={() => onApplyColorTheme(key)}
              className="w-full text-left p-2.5 rounded-lg border border-[#1e2d45] hover:border-blue-500/30 hover:bg-blue-600/5 transition-all group">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex gap-0.5">
                  {theme.palette.slice(0, 5).map((c) => (
                    <span key={c} style={{ backgroundColor: c }} className="w-3 h-3 rounded-sm" />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white transition-colors">{theme.label}</span>
              </div>
              <p className="text-[9px] text-slate-600">{theme.desc}</p>
            </button>
          ))}
        </div>
      )}

      <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label="Layer Tree" open={openSections.layers} onToggle={() => toggle('layers')} />
      {openSections.layers && (
        <div className="px-1 py-1 flex-1 overflow-y-auto">
          {tree.length === 0 ? (
            <p className="text-[10px] text-slate-600 text-center py-4">No elements on canvas.</p>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>
      )}
    </aside>
  );
};
