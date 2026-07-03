import React, { useEffect, useState } from 'react';
import { yObjects, ydoc } from '../store/yjsStore';
import type { CanvasObject } from '../types/canvas';

interface SidebarRightProps {
  selectedId: string | null;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({ selectedId }) => {
  const [activeObj, setActiveObj] = useState<CanvasObject | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setActiveObj(null);
      return;
    }

    const updateActive = () => {
      const match = yObjects.toArray().find((m) => m.get('id') === selectedId);
      if (match) {
        try {
          setActiveObj({
            id: match.get('id'),
            type: match.get('type'),
            label: match.get('label'),
            category: match.get('category'),
            zIndex: match.get('zIndex'),
            locked: match.get('locked'),
            visible: match.get('visible'),
            groupId: match.get('groupId'),
            assetId: match.get('assetId'),
            assetPath: match.get('assetPath'),
            svgRawContent: match.get('svgRawContent'),
            createdAt: match.get('createdAt'),
            updatedAt: match.get('updatedAt'),
            boundingBox: JSON.parse(match.get('boundingBox') || '{}'),
            transform: JSON.parse(match.get('transform') || '{}'),
            modifications: JSON.parse(match.get('modifications') || '{}'),
          });
        } catch {
          // ignore
        }
      } else {
        setActiveObj(null);
      }
    };

    updateActive();
    yObjects.observeDeep(updateActive);
    return () => yObjects.unobserveDeep(updateActive);
  }, [selectedId]);

  const handleTransformChange = (field: 'rotation' | 'scaleX' | 'scaleY', value: number) => {
    if (!selectedId) return;
    const match = yObjects.toArray().find((m) => m.get('id') === selectedId);
    if (match) {
      ydoc.transact(() => {
        try {
          const t = JSON.parse(match.get('transform') || '{}');
          t[field] = value;
          match.set('transform', JSON.stringify(t));
          match.set('updatedAt', new Date().toISOString());
        } catch (e) {
          console.error(e);
        }
      });
    }
  };

  const handleColorChange = (color: string) => {
    if (!selectedId) return;
    const match = yObjects.toArray().find((m) => m.get('id') === selectedId);
    if (match) {
      ydoc.transact(() => {
        try {
          const mods = JSON.parse(match.get('modifications') || '{}');
          mods.globalFill = mods.globalFill || {};
          mods.globalFill.color = color;
          match.set('modifications', JSON.stringify(mods));
          match.set('updatedAt', new Date().toISOString());
        } catch (e) {
          console.error(e);
        }
      });
    }
  };

  if (!activeObj) {
    return (
      <aside className="w-80 h-full bg-[#0f1623] border-l border-[#1e2d45] flex items-center justify-center text-slate-500 text-xs shrink-0 select-none">
        Select an element to inspect properties
      </aside>
    );
  }

  return (
    <aside className="w-80 h-full bg-[#0f1623] border-l border-[#1e2d45] flex flex-col text-slate-200 overflow-hidden shrink-0">
      <div className="px-4 py-3.5 border-b border-[#1e2d45] shrink-0 bg-[#0b0f19]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Properties</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Scale</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={activeObj.transform.scaleX || 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                handleTransformChange('scaleX', val);
                handleTransformChange('scaleY', val);
              }}
              className="flex-1 accent-blue-500 bg-[#0b0f19]"
            />
            <span className="text-xs font-mono w-10 text-right">{Math.round((activeObj.transform.scaleX || 1) * 100)}%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Rotation</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={activeObj.transform.rotation || 0}
              onChange={(e) => handleTransformChange('rotation', parseInt(e.target.value) || 0)}
              className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-500">deg</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Fill Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={activeObj.modifications?.globalFill?.color || '#3b82f6'}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-10 h-8 bg-transparent cursor-pointer rounded overflow-hidden"
            />
            <span className="text-xs font-mono">{activeObj.modifications?.globalFill?.color || '#3b82f6'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
