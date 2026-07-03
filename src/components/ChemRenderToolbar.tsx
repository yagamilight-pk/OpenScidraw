import React, { useState, useEffect } from 'react';
import { SmilesToVector } from '../chem/smilesParser';
import { WasmChemEngine } from '../chem/wasmLoader';
import { AlertCircle, CheckCircle, FileText } from 'lucide-react';
import type { CanvasObject } from '../types/canvas';

interface ChemRenderToolbarProps {
  onInjectChem: (objects: Omit<CanvasObject, 'id'>[]) => void;
}

export const ChemRenderToolbar: React.FC<ChemRenderToolbarProps> = ({ onInjectChem }) => {
  const [smilesInput, setSmilesInput] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    WasmChemEngine.getInstance().initialize().catch(err => {
      console.error('Wasm setup failure:', err);
    });
  }, []);

  const validateSmiles = (input: string): boolean => {
    if (!input.trim()) {
      setErrorMessage('');
      return false;
    }
    const unmatchedParen = (input.match(/\(/g) || []).length !== (input.match(/\)/g) || []).length;
    const invalidChars = /[^A-Za-z0-9#\(\)\+-\[\]=\/\.\\%@~]/g.test(input);

    if (unmatchedParen) {
      setErrorMessage('Unmatched parenthetical branches');
      return false;
    }
    if (invalidChars) {
      setErrorMessage('Invalid IUPAC / chemical element symbols detected');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSmilesInput(val);
    if (!val) {
      setIsValid(null);
    } else {
      setIsValid(validateSmiles(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !smilesInput.trim()) return;

    try {
      const chemObjects = SmilesToVector.generateChemObjects(smilesInput);
      onInjectChem(chemObjects);
      setSmilesInput('');
      setIsValid(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error rendering SMILES string');
      setIsValid(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-[#0f1623] px-4 py-2 border-b border-[#1e2d45] text-slate-200 shrink-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <FileText className="w-4 h-4 text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chemical Ingestion</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={smilesInput}
            onChange={handleInputChange}
            placeholder="Enter SMILES or common name (e.g. C1=CC=CC=C1, benzene)"
            className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <div className="absolute right-2.5 top-2 flex items-center">
            {isValid === true && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {isValid === false && (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
        >
          Inject Structure
        </button>
      </form>

      {errorMessage && (
        <div className="text-[10px] text-red-400 font-semibold truncate max-w-[200px]" title={errorMessage}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};
