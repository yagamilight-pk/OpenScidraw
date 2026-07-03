import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export interface BioiconAsset {
  id: string;
  name: string;
  category: string;
  svg: string;
}

const MOCK_BIOICONS: BioiconAsset[] = [
  {
    id: 'bio-cell',
    name: 'Eukaryotic Cell',
    category: 'Cytology',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" stroke-dasharray="3,3" stroke-width="1.5"/><circle cx="48" cy="48" r="8" fill="currentColor" opacity="0.8"/></svg>`
  },
  {
    id: 'bio-mitochondria',
    name: 'Mitochondria',
    category: 'Cytology',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><ellipse cx="50" cy="50" rx="45" ry="25" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 12 50 C 20 38, 25 62, 35 38 C 45 62, 50 38, 60 62 C 70 38, 75 62, 88 50" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  },
  {
    id: 'bio-dna',
    name: 'DNA Double Helix',
    category: 'Molecular',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><path d="M 10 30 Q 30 70, 50 30 T 90 30" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 10 70 Q 30 30, 50 70 T 90 70" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="42" x2="20" y2="58" stroke="currentColor" stroke-width="1.5"/><line x1="35" y1="35" x2="35" y2="65" stroke="currentColor" stroke-width="1.5"/><line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" stroke-width="1.5"/><line x1="65" y1="35" x2="65" y2="65" stroke="currentColor" stroke-width="1.5"/><line x1="80" y1="42" x2="80" y2="58" stroke="currentColor" stroke-width="1.5"/></svg>`
  },
  {
    id: 'bio-beaker',
    name: 'Flask Beaker',
    category: 'Equipment',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><path d="M 35 15 L 65 15 M 40 15 L 40 30 L 20 80 L 80 80 L 60 30 L 60 15" fill="none" stroke="currentColor" stroke-width="2"/><line x1="25" y1="70" x2="75" y2="70" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/><path d="M 22 75 L 78 75" stroke="currentColor" stroke-width="1.5"/></svg>`
  },
  {
    id: 'bio-pipette',
    name: 'Micropipette',
    category: 'Equipment',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><rect x="45" y="10" width="10" height="40" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="42" y="5" width="16" height="5" fill="currentColor"/><path d="M 48 50 L 48 85 L 50 90 L 52 85 L 52 50 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  },
  {
    id: 'bio-antibody',
    name: 'Antibody (IgG)',
    category: 'Immunology',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><path d="M 50 80 L 50 50 L 20 20 M 50 50 L 80 20 M 27 27 L 43 43 M 73 27 L 57 43" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  {
    id: 'bio-virus',
    name: 'Adenovirus',
    category: 'Microbiology',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><polygon points="50,15 80,35 80,65 50,85 20,65 20,35" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="50" y1="15" x2="50" y2="5" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="5" r="2" fill="currentColor"/><line x1="80" y1="35" x2="90" y2="30" stroke="currentColor" stroke-width="1.5"/><circle cx="90" cy="30" r="2" fill="currentColor"/><line x1="80" y1="65" x2="90" y2="70" stroke="currentColor" stroke-width="1.5"/><circle cx="90" cy="70" r="2" fill="currentColor"/><line x1="50" y1="85" x2="50" y2="95" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="95" r="2" fill="currentColor"/><line x1="20" y1="65" x2="10" y2="70" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="70" r="2" fill="currentColor"/><line x1="20" y1="35" x2="10" y2="30" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="30" r="2" fill="currentColor"/></svg>`
  },
  {
    id: 'bio-chloroplast',
    name: 'Chloroplast',
    category: 'Plant Biology',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><ellipse cx="50" cy="50" rx="45" ry="25" fill="none" stroke="currentColor" stroke-width="2"/><rect x="25" y="42" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="25" y="50" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="45" y="38" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="45" y="46" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="45" y="54" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="65" y="42" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="65" y="50" width="12" height="6" rx="1" fill="currentColor" opacity="0.7"/></svg>`
  },
  {
    id: 'bio-neuron',
    name: 'Neuron Cell',
    category: 'Anatomy',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><circle cx="20" cy="50" r="8" fill="currentColor" opacity="0.8"/><path d="M 20 42 L 15 30 M 20 58 L 15 70 M 28 50 L 70 50 Q 80 50, 90 40 M 70 50 Q 80 50, 90 60" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 20 50 Q 10 50, 5 45 M 20 50 Q 10 50, 5 55" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  },
  {
    id: 'bio-petri',
    name: 'Petri Dish',
    category: 'Equipment',
    svg: `<svg viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4,2"/><circle cx="35" cy="45" r="4" fill="currentColor" opacity="0.5"/><circle cx="65" cy="55" r="6" fill="currentColor" opacity="0.5"/><circle cx="45" cy="60" r="3" fill="currentColor" opacity="0.5"/></svg>`
  }
];

export const AssetLibrary: React.FC = () => {
  const [search, setSearch] = useState('');
  const [loading] = useState(false);

  const filtered = MOCK_BIOICONS.filter(
    item => item.name.toLowerCase().includes(search.toLowerCase()) || 
            item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, item: BioiconAsset) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'bioicon',
      id: item.id,
      name: item.name,
      category: item.category,
      svg: item.svg
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-full h-full flex flex-col text-slate-200 overflow-hidden bg-[#0f1623]">
      <div className="px-4 py-3 border-b border-[#1e2d45] shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Bioicons Library</span>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search biological icons..."
            className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-600 text-xs py-8">No icons found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-1">
            {filtered.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="group flex flex-col items-center p-3 rounded-lg bg-[#0b0f19]/60 border border-[#1e2d45] hover:border-blue-500/40 hover:bg-blue-600/5 transition-all cursor-grab active:cursor-grabbing text-center"
              >
                <div className="w-16 h-16 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
                  <div
                    className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                </div>
                <span className="mt-2 text-[9px] font-medium text-slate-400 group-hover:text-slate-200 truncate w-full transition-colors">
                  {item.name}
                </span>
                <span className="text-[7px] text-slate-600 uppercase tracking-widest mt-0.5">
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
