import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Bot, Key, Eye, EyeOff, Trash2, Lightbulb, SquareCode, AlertCircle, Loader2 } from 'lucide-react';
import type { CanvasObject } from '../types/canvas';
import { createDefaultModifications, createDefaultTransform } from '../utils/canvasBackendEngine';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  injectedIds?: string[];
  error?: boolean;
}

interface AiAssistantPanelProps {
  onInjectElements: (elements: Omit<CanvasObject, 'id'>[]) => void;
  canvasWidth: number;
  canvasHeight: number;
}

const SYSTEM_PROMPT = `You are OpenSciDraw AI, a scientific illustration assistant. The user describes biological, anatomical, molecular, or laboratory diagrams and you respond with a JSON array of canvas element objects that can be injected into the canvas workspace.

Each element must have this exact structure:
{
  "type": "primitive-rect" | "primitive-circle" | "primitive-triangle" | "text-block",
  "label": string,
  "category": "Cytology & Immunology" | "Molecular Biology" | "Laboratory Equipment" | "Anatomy & Organ Systems" | "General",
  "boundingBox": { "x": number, "y": number, "width": number, "height": number },
  "transform": { "scaleX": 1, "scaleY": 1, "rotation": 0, "translateX": 0, "translateY": 0, "skewX": 0, "skewY": 0, "flipHorizontal": false, "flipVertical": false },
  "modifications": {
    "colorOverrides": [],
    "globalFill": { "color": "#hexcode", "opacity": 1, "rule": "nonzero" },
    "globalStroke": { "color": "#hexcode", "width": 2, "dashArray": "none", "dashOffset": 0, "lineCap": "round", "lineJoin": "round", "miterLimit": 4, "opacity": 1 },
    "globalOpacity": 1,
    "blendMode": "normal",
    "dropShadow": { "enabled": false, "offsetX": 2, "offsetY": 2, "blur": 4, "color": "#000000", "opacity": 0.3 },
    "filters": { "grayscale": 0, "brightness": 1, "contrast": 1, "saturate": 1, "hueRotate": 0, "blur": 0 }
  },
  "textLayout": null | { "content": string, "fontFamily": "Inter", "fontSize": 14, "fontWeight": 400, "fontStyle": "normal", "textAlign": "center", "textDecoration": "none", "lineHeight": 1.4, "letterSpacing": 0, "color": "#f1f5f9", "backgroundColor": "transparent", "padding": {"top": 4, "right": 4, "bottom": 4, "left": 4}, "borderRadius": 0 },
  "primitiveParams": null,
  "zIndex": number,
  "locked": false,
  "visible": true,
  "groupId": null,
  "assetId": null,
  "assetPath": null,
  "svgRawContent": null,
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}

Respond ONLY with a valid JSON array in a markdown code block labeled \`json\`. Before the code block, write one short sentence describing what you placed. Do not say anything else. Use colours appropriate for scientific publication.`;

const EXAMPLE_PROMPTS = [
  'Draw a simple cell membrane bilayer with a nucleus',
  'Create a mitochondria diagram with labels',
  'Lay out a PCR workflow with labeled steps',
  'Sketch a synaptic cleft between two neurons',
  'Diagram an antibody binding to an antigen on a cell surface',
];

function parseInjectedJSON(text: string): Omit<CanvasObject, 'id'>[] | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return null;
    return parsed as Omit<CanvasObject, 'id'>[];
  } catch {
    return null;
  }
}

const LOCAL_STORAGE_KEY = 'osd_gemini_api_key';

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  onInjectElements, canvasWidth: _canvasWidth, canvasHeight: _canvasHeight,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem(LOCAL_STORAGE_KEY) ?? ''; } catch { return ''; }
  });
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyStored, setKeyStored] = useState(() => {
    try { return !!localStorage.getItem(LOCAL_STORAGE_KEY); } catch { return false; }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'sys-0',
    role: 'system',
    content: 'OpenSciDraw AI is ready. Describe a scientific diagram and I will generate canvas elements for you.',
    timestamp: new Date().toISOString(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'key'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveKey = () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, apiKey.trim());
      setKeyStored(true);
    } catch { /* storage unavailable */ }
  };

  const clearKey = () => {
    try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
    setApiKey('');
    setKeyStored(false);
  };

  const buildHistory = (): { role: string; parts: { text: string }[] }[] => {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  };

  const sendMessage = useCallback(async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || loading) return;
    const key = apiKey.trim() || ((() => { try { return localStorage.getItem(LOCAL_STORAGE_KEY) ?? ''; } catch { return ''; } })());
    if (!key) {
      setActiveTab('key');
      return;
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = buildHistory();
      const requestBody = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          ...history,
          { role: 'user', parts: [{ text: trimmed }] },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = (errBody as any)?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      const parsed = parseInjectedJSON(replyText);
      const now = new Date().toISOString();
      let injectedIds: string[] = [];

      if (parsed && parsed.length > 0) {
        const withDefaults = parsed.map((el, i) => ({
          ...el,
          modifications: el.modifications ?? createDefaultModifications(),
          transform: el.transform ?? createDefaultTransform(),
          createdAt: now,
          updatedAt: now,
          zIndex: el.zIndex ?? (i + 1),
          assetId: el.assetId ?? null,
          assetPath: el.assetPath ?? null,
          svgRawContent: el.svgRawContent ?? null,
          textLayout: el.textLayout ?? null,
          primitiveParams: el.primitiveParams ?? null,
          groupId: el.groupId ?? null,
          locked: el.locked ?? false,
          visible: el.visible ?? true,
          label: el.label ?? el.type ?? 'AI Element',
          category: el.category ?? 'General',
        }));
        injectedIds = withDefaults.map((_, i) => `ai_el_${Date.now()}_${i}`);
        onInjectElements(withDefaults as Omit<CanvasObject, 'id'>[]);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: now,
        injectedIds,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errText}. Please check your API key and network connection.`,
        timestamp: new Date().toISOString(),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, loading, messages, onInjectElements, buildHistory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => setMessages([{ id: 'sys-0', role: 'system', content: 'Chat cleared. Describe a new diagram to generate canvas elements.', timestamp: new Date().toISOString() }]);

  const cleanDisplayText = (text: string) => text.replace(/```json[\s\S]*?```/g, '').trim();

  return (
    <aside className="w-80 h-full bg-[#0f1623] border-l border-[#1e2d45] flex flex-col text-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45] shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white">AI Scientific Assistant</span>
          <span className={`w-1.5 h-1.5 rounded-full ${keyStored ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
        </div>
        <div className="flex gap-1">
          {(['chat', 'key'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {tab === 'chat' ? 'Chat' : <Key className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'key' && (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-lg">
            <p className="text-[10px] text-blue-300 leading-relaxed">
              Your Gemini API key is stored only in your browser's <strong>localStorage</strong> and is never sent to any server other than Google's API directly. To get a key, visit <span className="underline">aistudio.google.com</span>.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Gemini API Key</label>
            <div className="relative">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-[#0b0f19] border border-[#1e2d45] rounded-lg px-3 py-2 pr-9 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button onClick={() => setKeyVisible((v) => !v)} className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300">
                {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveKey} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
              Save Key Locally
            </button>
            <button onClick={clearKey} className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {keyStored && (
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              API key stored. AI assistant is active.
            </div>
          )}
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Example Prompts</p>
            <div className="space-y-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} onClick={() => { setActiveTab('chat'); setInput(p); }}
                  className="w-full text-left text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded border border-[#1e2d45] hover:border-[#2e3f5a] transition-colors flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className="w-full px-3 py-2 bg-[#0b0f19] rounded-lg border border-[#1e2d45] text-[10px] text-slate-500 text-center">
                    {msg.content}
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="max-w-[85%] px-3 py-2 bg-blue-600/20 border border-blue-500/20 rounded-xl rounded-tr-sm text-xs text-slate-200">
                    {msg.content}
                  </div>
                ) : (
                  <div className={`max-w-[95%] px-3 py-2 rounded-xl rounded-tl-sm border text-xs ${msg.error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-[#151c2c] border-[#1e2d45] text-slate-200'}`}>
                    {msg.error && <AlertCircle className="w-3.5 h-3.5 text-red-400 mb-1" />}
                    <p className="leading-relaxed whitespace-pre-wrap">{cleanDisplayText(msg.content)}</p>
                    {msg.injectedIds && msg.injectedIds.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                        <SquareCode className="w-3 h-3" />
                        {msg.injectedIds.length} element{msg.injectedIds.length > 1 ? 's' : ''} added to canvas
                      </div>
                    )}
                    <p className="text-[9px] text-slate-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 bg-[#151c2c] border border-[#1e2d45] rounded-xl rounded-tl-sm flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  Generating diagram...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 border-t border-[#1e2d45] shrink-0">
            {!keyStored && (
              <button onClick={() => setActiveTab('key')} className="w-full mb-2 flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-400 hover:bg-amber-500/15 transition-colors font-semibold">
                <Key className="w-3 h-3" /> Add API Key to activate AI
              </button>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a scientific diagram..."
                rows={2}
                disabled={loading}
                className="flex-1 bg-[#0b0f19] border border-[#1e2d45] rounded-lg px-3 py-2 text-xs text-slate-200 resize-none focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
              <div className="flex flex-col gap-1">
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
                <button onClick={clearChat} title="Clear chat" className="p-2 bg-[#0b0f19] border border-[#1e2d45] hover:border-red-500/30 hover:text-red-400 text-slate-500 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 mt-1.5 text-center">Press Enter to send · Shift+Enter for newline</p>
          </div>
        </>
      )}
    </aside>
  );
};
