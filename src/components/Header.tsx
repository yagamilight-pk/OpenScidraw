import React, { useState } from 'react';
import { Download, FileDown, BookOpen, Check } from 'lucide-react';
import type { CanvasElement } from './Canvas';

interface HeaderProps {
  elements: CanvasElement[];
  onClear: () => void;
}

export const Header: React.FC<HeaderProps> = ({ elements, onClear }) => {
  const [copiedCitation, setCopiedCitation] = useState(false);

  // Citation logic: compile unique attributions based on elements present
  const getCitations = () => {
    const citations: string[] = [];
    const uniqueIds = new Set<string>();

    elements.forEach((el) => {
      if (uniqueIds.has(el.assetId)) return;
      uniqueIds.add(el.assetId);

      if (el.assetId === 'cell_macrophage') {
        citations.push('Macrophage Cell: Contains assets adapted from Servier Medical Art under CC-BY 3.0');
      } else if (el.assetId === 'dna') {
        citations.push('DNA Helix: Adapted from OpenSciDraw core library under CC-BY 4.0');
      } else if (el.assetId === 'beaker') {
        citations.push('Laboratory Beaker: Adapted from OpenSciDraw chemistry collection (Public Domain CC0)');
      }
    });

    return citations;
  };

  const activeCitations = getCitations();

  // Export to high-resolution PNG (2x scale)
  const exportPNG = async () => {
    if (elements.length === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1600; // 2x scale for crisp export
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(2, 2); // scale coordinate system for 2x rendering

    // Sort elements by z-index
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        const processedSvg = el.svgText.replaceAll('currentColor', el.color);
        const blob = new Blob([processedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
          ctx.save();
          ctx.translate(el.x, el.y);
          ctx.rotate((el.rotation * Math.PI) / 180);
          ctx.globalAlpha = el.opacity;
          
          const w = 120 * el.scale;
          const h = 120 * el.scale;
          
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          URL.revokeObjectURL(url);
          resolve();
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };

        img.src = url;
      });
    }

    ctx.restore();

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'openscidraw_canvas_export.png';
    a.click();
  };

  // Export to SVG vector
  const exportSVG = () => {
    if (elements.length === 0) return;

    let svgInner = '';
    elements.forEach((el) => {
      let content = el.svgText;
      content = content.replaceAll('currentColor', el.color);

      // Extract inner content inside the <svg> tags
      const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      const inner = match ? match[1] : content;

      svgInner += `
  <g transform="translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})" opacity="${el.opacity}">
    <g transform="translate(-60, -60)">
      ${inner}
    </g>
  </g>`;
    });

    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background-color: #0b0f19;">
  <!-- OpenSciDraw Canvas Export -->
  ${svgInner}
</svg>`;

    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openscidraw_vector_export.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCitationToClipboard = () => {
    const text = activeCitations.join('\n') || 'Contains assets adapted under CC licenses.';
    navigator.clipboard.writeText(text);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  return (
    <header className="w-full max-w-6xl glass-panel border border-dark-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Brand logo/title */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-extrabold text-lg select-none">
          Ω
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            OpenSciDraw <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">v1.0.0</span>
          </h1>
          <p className="text-xs text-slate-400">Scientific Illustration Workspace & Asset Processing Engine</p>
        </div>
      </div>

      {/* Citations Overlay */}
      <div className="flex-1 max-w-md px-3 py-1.5 bg-[#0b0f19]/60 border border-dark-border rounded-lg flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 truncate">
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">
            {activeCitations.length > 0 ? (
              <span className="text-emerald-400 font-medium">Attributions compiled ({activeCitations.length})</span>
            ) : (
              'Add elements to generate attributions.'
            )}
          </span>
        </div>
        {activeCitations.length > 0 && (
          <button
            onClick={copyCitationToClipboard}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors shrink-0"
          >
            {copiedCitation ? (
              <>
                <Check className="w-3 h-3" /> Copied
              </>
            ) : (
              'Copy Credits'
            )}
          </button>
        )}
      </div>

      {/* Workspace triggers */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClear}
          disabled={elements.length === 0}
          className="px-3 py-2 text-xs font-semibold border border-dark-border rounded-lg hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear Canvas
        </button>

        <button
          onClick={exportPNG}
          disabled={elements.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-dark-border text-slate-200 border border-transparent rounded-lg hover:bg-dark-border/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileDown className="w-3.5 h-3.5" /> Export PNG
        </button>

        <button
          onClick={exportSVG}
          disabled={elements.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" /> Export SVG
        </button>
      </div>
    </header>
  );
};
