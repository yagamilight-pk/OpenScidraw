import React, { useEffect, useRef } from 'react';
import type { CanvasObject } from '../types/canvas';

interface VisualDiffOverlayProps {
  commitA: CanvasObject[];
  commitB: CanvasObject[];
  width: number;
  height: number;
  onClose: () => void;
}

export const VisualDiffOverlay: React.FC<VisualDiffOverlayProps> = ({
  commitA,
  commitB,
  width,
  height,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const mapA = new Map(commitA.map((o) => [o.id, o]));
    const mapB = new Map(commitB.map((o) => [o.id, o]));

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

    const drawDiffRect = (
      obj: CanvasObject,
      color: string,
      opacity: number,
      isDashed: boolean
    ) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      if (isDashed) {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }

      const { x, y, width: w, height: h } = obj.boundingBox;

      // Draw dashed or solid border
      ctx.strokeRect(x, y, w, h);

      // Draw light transparent overlay inside bounding box
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity * 0.12;
      ctx.fillRect(x, y, w, h);

      // Draw identifier label overlay
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = 'bold 9px monospace';
      ctx.fillText(obj.label || 'Unnamed Asset', x + 6, y + 14);

      ctx.restore();
    };

    for (const id of allKeys) {
      const a = mapA.get(id);
      const b = mapB.get(id);

      if (a && !b) {
        // Deleted in Commit B (render red)
        drawDiffRect(a, '#ef4444', 0.95, false);
      } else if (!a && b) {
        // Added in Commit B (render bright green)
        drawDiffRect(b, '#10b981', 0.95, false);
      } else if (a && b) {
        const isModified =
          JSON.stringify(a.boundingBox) !== JSON.stringify(b.boundingBox) ||
          JSON.stringify(a.transform) !== JSON.stringify(b.transform) ||
          JSON.stringify(a.modifications) !== JSON.stringify(b.modifications);

        if (isModified) {
          // Modified structurally/visually (render blue with dashed bounding box)
          drawDiffRect(b, '#3b82f6', 0.95, true);
        } else {
          // Unchanged (render low 20% opacity gray/slate)
          drawDiffRect(b, '#94a3b8', 0.20, false);
        }
      }
    }
  }, [commitA, commitB, width, height]);

  return (
    <div className="absolute inset-0 bg-[#0b0f19]/95 z-[99] flex flex-col p-6 text-slate-200">
      <div className="flex items-center justify-between mb-4 border-b border-[#1e2d45] pb-3 shrink-0">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Visual Git Commit Diff Analyzer</h3>
          <p className="text-[10px] text-slate-500">Highlighting differences between repository HEAD configurations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[10px] bg-[#0f1623] px-3 py-1.5 rounded-lg border border-[#1e2d45]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#10b981] rounded" /> Added
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ef4444] rounded" /> Removed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#3b82f6] rounded border border-dashed border-[#3b82f6]" /> Modified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#94a3b8] opacity-30 rounded" /> Unchanged
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-lg transition-colors"
          >
            Exit Diff View
          </button>
        </div>
      </div>
      <div className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded-xl overflow-hidden relative shadow-inner">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>
    </div>
  );
};
