import React, { useState } from 'react';
import { PluginSandbox } from '../plugins/sandbox';
import { createMainThreadAPI } from '../plugins/api';
import type { SciDrawKernel } from '../kernel/stateEngine';
import type { CanvasObject } from '../types/canvas';
import { Play, Cpu, Terminal } from 'lucide-react';

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  code: string;
}

interface PluginManagerProps {
  kernel: SciDrawKernel;
  onInjectElement: (el: Omit<CanvasObject, 'id'>) => string;
  onUpdateElement: (id: string, patch: Partial<CanvasObject>) => void;
  onApplyTheme: (theme: string) => void;
  getSelectedIds: () => string[];
}

const DEFAULT_PLUGINS: PluginManifest[] = [
  {
    id: 'align-horizontal',
    name: 'Auto-Align Columns',
    description: 'Finds selected elements and aligns them horizontally across the canvas width.',
    author: 'OpenSciDraw Core',
    version: '1.0.0',
    code: `
      async function run() {
        const selected = await self.openSci.getSelection();
        if (selected.length < 2) return "Select at least 2 elements";
        for (let i = 0; i < selected.length; i++) {
          await self.openSci.modifyNode(selected[i], {
            boundingBox: { x: 100 + i * 150, y: 300, width: 100, height: 100 }
          });
        }
        return "Aligned " + selected.length + " elements";
      }
      run();
    `
  },
  {
    id: 'generate-cycle',
    name: 'Apoptosis Path Creator',
    description: 'Generates a cyclical cell death cascade structure with linked vector steps.',
    author: 'Pathways Lab',
    version: '1.2.0',
    code: `
      async function run() {
        await self.openSci.applyJournalTheme("cell-vivid");
        const steps = ["Signals", "Caspase Activation", "Apoptosome", "Cell Apoptosis"];
        for(let i=0; i<4; i++) {
          await self.openSci.createNode("primitive-rect", {
            x: 200 + i * 180,
            y: 400,
            width: 130,
            height: 60
          });
        }
        return "Apoptosis timeline generated successfully.";
      }
      run();
    `
  }
];

export const PluginManager: React.FC<PluginManagerProps> = ({
  kernel,
  onInjectElement,
  onUpdateElement,
  onApplyTheme,
  getSelectedIds
}) => {
  const [plugins] = useState<PluginManifest[]>(DEFAULT_PLUGINS);
  const [logs, setLogs] = useState<string[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const addLog = (msg: string) => setLogs((prev) => [...prev.slice(-30), msg]);

  const handleRunPlugin = async (plugin: PluginManifest) => {
    setRunningId(plugin.id);
    addLog(`Initializing plugin sandbox: ${plugin.name}`);

    const sandbox = new PluginSandbox(5000);
    const mainAPI = createMainThreadAPI(
      kernel,
      onInjectElement,
      onUpdateElement,
      onApplyTheme,
      getSelectedIds
    );

    try {
      sandbox.initialize('', async (req) => {
        const method = req.method as keyof typeof mainAPI;
        if (typeof mainAPI[method] === 'function') {
          return await (mainAPI[method] as any)(...req.args);
        }
        throw new Error(`Unsupported API call: ${req.method}`);
      });

      const output = await sandbox.execute(plugin.code);
      addLog(`Plugin output: ${JSON.stringify(output)}`);
    } catch (err) {
      addLog(`Plugin Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      sandbox.destroy();
      setRunningId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1623] text-slate-200 border-l border-[#1e2d45] w-80 shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2d45] shrink-0 bg-[#0b0f19]">
        <Cpu className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Plugin Controller</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="bg-[#151c2c] border border-[#1e2d45] rounded-xl p-3.5 space-y-2 hover:border-[#2e3f5a] transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">{plugin.name}</h4>
                <p className="text-[9px] text-slate-500">v{plugin.version} by {plugin.author}</p>
              </div>
              <button
                onClick={() => handleRunPlugin(plugin)}
                disabled={runningId !== null}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-bold text-white rounded-lg transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                Run
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">{plugin.description}</p>
          </div>
        ))}
      </div>

      <div className="h-44 border-t border-[#1e2d45] bg-[#0b0f19] flex flex-col overflow-hidden shrink-0 font-mono text-[9px]">
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1e2d45] bg-[#0f1623] text-slate-400 select-none">
          <Terminal className="w-3 h-3" />
          <span>Execution Output Logs</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 text-slate-400 font-mono">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No output logs registered.</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="leading-relaxed border-l-2 border-blue-500/20 pl-2">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
