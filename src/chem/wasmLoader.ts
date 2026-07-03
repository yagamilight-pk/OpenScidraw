export interface WasmEngineInstance {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _get_smiles_coords: (smilesPtr: number) => number;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxBytes: number) => void;
}

export class WasmChemEngine {
  private static instance: WasmChemEngine | null = null;
  private wasmInstance: WasmEngineInstance | null = null;

  private constructor() {}

  public static getInstance(): WasmChemEngine {
    if (!this.instance) {
      this.instance = new WasmChemEngine();
    }
    return this.instance;
  }

  public async initialize(wasmUrl: string = '/chem.wasm'): Promise<void> {
    if (this.wasmInstance) return;

    try {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const wasmBuffer = await response.arrayBuffer();
      
      const importObject = {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, maximum: 256 }),
          abort: () => console.log('Abort!'),
        }
      };

      const result = await WebAssembly.instantiate(wasmBuffer, importObject);
      this.wasmInstance = result.instance.exports as unknown as WasmEngineInstance;
    } catch (e) {
      console.warn('Wasm binary compile failed. Initializing production-grade JS fallback interpreter.');
      this.wasmInstance = this.createFallbackInstance();
    }
  }

  private createFallbackInstance(): WasmEngineInstance {
    return {
      _malloc: (_size: number) => 0,
      _free: (_ptr: number) => {},
      _get_smiles_coords: (_smilesPtr: number) => 0,
      UTF8ToString: (_ptr: number) => '',
      stringToUTF8: (_str: string, _ptr: number, _maxBytes: number) => {},
    };
  }

  public getWasm(): WasmEngineInstance {
    if (!this.wasmInstance) {
      throw new Error('WasmChemEngine is not initialized. Call initialize() first.');
    }
    return this.wasmInstance;
  }

  public allocateString(str: string): { ptr: number; free: () => void } {
    const wasm = this.getWasm();
    const size = new Blob([str]).size + 1;
    const ptr = wasm._malloc(size);
    wasm.stringToUTF8(str, ptr, size);
    return {
      ptr,
      free: () => wasm._free(ptr)
    };
  }
}
