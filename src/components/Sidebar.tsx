import React, { useEffect, useState } from 'react';
import { Search, Plus, Sparkles } from 'lucide-react';

interface Asset {
  id: string;
  category: string;
  name: string;
  path: string;
}

interface SidebarProps {
  onAddElement: (asset: Asset, svgText: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAddElement }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [svgCache, setSvgCache] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Load Manifest and SVGs
  useEffect(() => {
    fetch('/data-feed/manifest.json')
      .then((res) => res.json())
      .then(async (data) => {
        const assetList: Asset[] = data.assets || [];
        setAssets(assetList);

        // Pre-fetch SVG texts for previews
        const cache: Record<string, string> = {};
        await Promise.all(
          assetList.map(async (asset) => {
            try {
              const response = await fetch(asset.path);
              const svgText = await response.text();
              cache[asset.id] = svgText;
            } catch (err) {
              console.error(`Failed to fetch SVG for ${asset.name}:`, err);
            }
          })
        );
        setSvgCache(cache);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load asset manifest:', err);
        setLoading(false);
      });
  }, []);

  // Filter Categories
  const categories = ['All', ...Array.from(new Set(assets.map((a) => a.category)))];

  // Filtered Assets
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          asset.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <aside className="w-80 glass-panel border border-dark-border rounded-xl p-4 flex flex-col gap-4 text-slate-200">
      {/* Sidebar Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h2 className="font-bold text-lg text-white">Scientific Vector Library</h2>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search vectors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0b0f19] border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
      </div>

      {/* Categories Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-dark-border/40 text-slate-400 hover:bg-dark-border/80 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <hr className="border-dark-border" />

      {/* Assets Grid */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Loading scientific catalog...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No assets match your search.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredAssets.map((asset) => {
              const svgText = svgCache[asset.id] || '';
              return (
                <div
                  key={asset.id}
                  onClick={() => onAddElement(asset, svgText)}
                  className="group relative flex flex-col items-center justify-center p-3 rounded-lg border border-dark-border hover-glow bg-dark-bg/20 cursor-pointer select-none"
                >
                  {/* SVG Thumbnail Container */}
                  <div className="w-20 h-20 flex items-center justify-center p-2 bg-dark-bg/40 rounded border border-dark-border group-hover:border-blue-500/30 transition-colors">
                    {svgText ? (
                      <div
                        className="w-full h-full text-slate-300 group-hover:text-blue-400 transition-colors flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: svgText }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-dark-border animate-pulse" />
                    )}
                  </div>

                  {/* Asset Metadata */}
                  <div className="mt-2 text-center">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate max-w-[120px]">
                      {asset.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {asset.category}
                    </div>
                  </div>

                  {/* Quick Add Overlay */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/90 text-white rounded p-0.5">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-[10px] text-slate-600 leading-normal border-t border-dark-border pt-2.5">
        Tip: Drag or click elements in the grid to place them. Select any canvas element to adjust layer stack or colors.
      </div>
    </aside>
  );
};
