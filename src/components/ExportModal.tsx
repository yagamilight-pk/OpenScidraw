import React, { useState } from 'react';
import type { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';
import { exportWebGPUCanvas } from '../utils/gpuExport';
import { Download, Copy, Check } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: WebGPURenderEngine | null;
  width: number;
  height: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, engine, width, height }) => {
  const [copied, setCopied] = useState(false);
  const currentYear = new Date().getFullYear();

  const citations = {
    apa: `OpenSciDraw. (${currentYear}). Figure layout schema compiler. Retrieved from https://openscidraw.vercel.app`,
    mla: `OpenSciDraw. "Figure layout schema compiler." https://openscidraw.vercel.app, ${currentYear}.`,
    ieee: `[1] OpenSciDraw, "Figure layout schema compiler," ${currentYear}. [Online]. Available: https://openscidraw.vercel.app.`,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    if (!engine) return;
    try {
      await exportWebGPUCanvas(engine, width, height, 'figure', citations.ieee);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0f1623] border border-[#1e2d45] rounded-xl overflow-hidden shadow-2xl text-slate-200">
        <div className="px-4 py-3 border-b border-[#1e2d45] flex items-center justify-between bg-[#0b0f19]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Attribution & Export</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Citations</label>
            <div className="space-y-2">
              {Object.entries(citations).map(([format, text]) => (
                <div key={format} className="p-2.5 bg-[#0b0f19] border border-[#1e2d45] rounded-lg text-xs leading-relaxed relative group">
                  <div className="text-[9px] text-blue-400 uppercase font-bold mb-1">{format}</div>
                  <div>{text}</div>
                  <button
                    onClick={() => handleCopy(text)}
                    className="absolute top-2 right-2 p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#1e2d45] bg-[#0b0f19] flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-white/5 border border-[#1e2d45] text-slate-400 text-xs font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export High-Res PNG
          </button>
        </div>
      </div>
    </div>
  );
};
