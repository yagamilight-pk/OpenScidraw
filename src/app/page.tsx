import React, { useState } from 'react';
import { SidebarLeft } from '../components/SidebarLeft';
import { MainCanvas } from '../components/MainCanvas';
import { SidebarRight } from '../components/SidebarRight';
import { SMILESToolbar } from '../components/SMILESToolbar';
import { ExportModal } from '../components/ExportModal';
import { upsertYObject } from '../store/yjsStore';
import type { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';
import type { CanvasObject } from '../types/canvas';
import { Download } from 'lucide-react';

export default function Page() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [engine, setEngine] = useState<WebGPURenderEngine | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'bioicon') {
        const dropX = e.clientX - 320;
        const dropY = e.clientY - 48;

        const newEl: CanvasObject = {
          id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          type: 'svg-asset',
          assetId: data.id,
          assetPath: null,
          svgRawContent: data.svg,
          label: data.name,
          category: data.category || 'General',
          boundingBox: {
            x: dropX - 60,
            y: dropY - 60,
            width: 120,
            height: 120,
          },
          transform: { scaleX: 1, scaleY: 1, rotation: 0, translateX: 0, translateY: 0, skewX: 0, skewY: 0, flipHorizontal: false, flipVertical: false },
          modifications: {
            colorOverrides: [],
            globalFill: { color: '#3b82f6', opacity: 1, rule: 'nonzero' },
            globalStroke: { color: 'none', width: 0, dashArray: 'none', dashOffset: 0, lineCap: 'round', lineJoin: 'round', miterLimit: 4, opacity: 1 },
            globalOpacity: 1,
            blendMode: 'normal',
            dropShadow: { enabled: false, offsetX: 2, offsetY: 2, blur: 4, color: '#000000', opacity: 0.3 },
            filters: { grayscale: 0, brightness: 1, contrast: 1, saturate: 1, hueRotate: 0, blur: 0 }
          },
          textLayout: null,
          primitiveParams: null,
          zIndex: 1,
          locked: false,
          visible: true,
          groupId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        upsertYObject(newEl);
        setSelectedId(newEl.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-slate-200 overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between bg-[#0f1623] border-b border-[#1e2d45] pr-4 shrink-0">
        <SMILESToolbar />
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export Canvas
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <SidebarLeft />

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 relative overflow-hidden"
        >
          <MainCanvas onEngineReady={setEngine} />
        </div>

        <SidebarRight selectedId={selectedId} />
      </div>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        engine={engine}
        width={1400}
        height={900}
      />
    </div>
  );
}
