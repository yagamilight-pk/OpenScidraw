import React, { useState } from 'react';
import { SmilesToVector } from '../chem/smilesParser';
import { upsertYObject } from '../store/yjsStore';
import type { CanvasObject } from '../types/canvas';

export const SMILESToolbar: React.FC = () => {
  const [smiles, setSmiles] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smiles.trim()) return;

    try {
      const objects = SmilesToVector.generateChemObjects(smiles);
      objects.forEach((obj, idx) => {
        const fullObj: CanvasObject = {
          ...obj,
          id: `chem_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`,
        };
        upsertYObject(fullObj);
      });
      setSmiles('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid SMILES string');
    }
  };

  return (
    <div className="flex items-center gap-3 bg-[#0f1623] px-4 py-2 border-b border-[#1e2d45] text-slate-200 shrink-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chemical Ingestion</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="Enter SMILES or common name (e.g. C1=CC=CC=C1, benzene)"
            className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
        >
          Inject Structure
        </button>
      </form>

      {error && (
        <div className="text-[10px] text-red-400 font-semibold truncate max-w-[200px]" title={error}>
          {error}
        </div>
      )}
    </div>
  );
};
