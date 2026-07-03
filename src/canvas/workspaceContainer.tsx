import React, { useEffect, useState } from 'react';
import { SciDrawKernel } from '../kernel/stateEngine';

interface WorkspaceContainerProps {
  kernel: SciDrawKernel;
}

export const WorkspaceContainer: React.FC<WorkspaceContainerProps> = ({ kernel }) => {
  const [peerId] = useState<string>(kernel.peerId);
  const [clock, setClock] = useState<number>(kernel.logicalClock);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      kernel.applyMutation({
        objectId: `cursor_${peerId}`,
        field: 'position',
        value: { x: e.clientX, y: e.clientY },
        timestamp: Date.now(),
        peerId
      });
      setClock(kernel.logicalClock);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [kernel, peerId]);

  return (
    <div className="flex h-screen w-full bg-[#0b0f19] text-slate-200 overflow-hidden font-sans">
      <aside className="w-64 border-r border-[#1e2d45] flex flex-col p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">SciDraw Sync</h2>
        <div className="text-xs text-slate-500 mb-2">Peer ID: {peerId}</div>
        <div className="text-xs text-slate-500 mb-4">Clock: {clock}</div>
        <div className="flex-1 bg-[#151c2c] rounded-md border border-[#1e2d45] p-2 overflow-y-auto">
          <div className="text-[10px] text-slate-600">Active Peer Cursors Broadcast</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative p-6 bg-[#0b0f19]">
        <div className="flex-1 border-2 border-dashed border-[#1e2d45] rounded-xl relative overflow-hidden grid grid-cols-2 grid-rows-2 gap-4 p-4">
          
          <div className="relative border border-blue-500/30 bg-blue-500/5 rounded-lg flex items-center justify-center">
            <span className="absolute top-2 left-3 text-2xl font-bold text-slate-700">A</span>
            <span className="text-xs text-slate-500">Main Figure</span>
          </div>
          
          <div className="relative border border-blue-500/30 bg-blue-500/5 rounded-lg flex items-center justify-center">
            <span className="absolute top-2 left-3 text-2xl font-bold text-slate-700">B</span>
            <span className="text-xs text-slate-500">Experimental Design</span>
          </div>

          <div className="relative border border-blue-500/30 bg-blue-500/5 rounded-lg flex items-center justify-center">
            <span className="absolute top-2 left-3 text-2xl font-bold text-slate-700">C</span>
            <span className="text-xs text-slate-500">Signaling Pathway</span>
          </div>

          <div className="relative border border-blue-500/30 bg-blue-500/5 rounded-lg flex items-center justify-center">
            <span className="absolute top-2 left-3 text-2xl font-bold text-slate-700">D</span>
            <span className="text-xs text-slate-500">Quantification</span>
          </div>

        </div>
      </main>

      <aside className="w-80 border-l border-[#1e2d45] flex flex-col p-4 bg-[#0f1623]">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Inspector</h2>
        <div className="text-[10px] text-slate-500">Structural properties and CRDT state values go here.</div>
      </aside>
    </div>
  );
};
