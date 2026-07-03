export interface SandboxResponse {
  id: string;
  result?: any;
  error?: string;
}

export interface SandboxRequest {
  id: string;
  method: string;
  args: any[];
}

export class PluginSandbox {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private timeoutDuration: number;

  constructor(timeoutDuration: number = 5000) {
    this.timeoutDuration = timeoutDuration;
  }

  public initialize(pluginCode: string, onApiRequest: (request: SandboxRequest) => Promise<any>): void {
    if (this.worker) this.destroy();

    const workerTemplate = `
      self.openSci = {
        createNode: async (type, coords) => self.callHost("createNode", [type, coords]),
        getSelection: async () => self.callHost("getSelection", []),
        modifyNode: async (id, params) => self.callHost("modifyNode", [id, params]),
        applyJournalTheme: async (theme) => self.callHost("applyJournalTheme", [theme])
      };

      self.pendingCalls = new Map();

      self.callHost = function(method, args) {
        const id = Math.random().toString(36).substring(2);
        return new Promise((resolve, reject) => {
          self.pendingCalls.set(id, { resolve, reject });
          self.postMessage({ type: "API_REQUEST", id, method, args });
        });
      };

      self.onmessage = async function(e) {
        const { type, id, result, error, code } = e.data;
        if (type === "API_RESPONSE") {
          const promise = self.pendingCalls.get(id);
          if (promise) {
            self.pendingCalls.delete(id);
            if (error) promise.reject(new Error(error));
            else promise.resolve(result);
          }
        } else if (type === "EXECUTE") {
          try {
            const runner = new Function(code);
            const output = await runner();
            self.postMessage({ type: "EXECUTE_COMPLETE", id, result: output });
          } catch (err) {
            self.postMessage({ type: "EXECUTE_COMPLETE", id, error: err instanceof Error ? err.message : String(err) });
          }
        }
      };
    `;

    const blob = new Blob([workerTemplate + '\n' + pluginCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));

    this.worker.onmessage = async (e) => {
      const { type, id, method, args, result, error } = e.data;

      if (type === 'API_REQUEST') {
        try {
          const res = await onApiRequest({ id, method, args });
          this.worker?.postMessage({ type: 'API_RESPONSE', id, result: res });
        } catch (err) {
          this.worker?.postMessage({
            type: 'API_RESPONSE',
            id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (type === 'EXECUTE_COMPLETE') {
        const request = this.pendingRequests.get(id);
        if (request) {
          this.pendingRequests.delete(id);
          if (error) request.reject(new Error(error));
          else request.resolve(result);
        }
      }
    };
  }

  public execute(code: string): Promise<any> {
    if (!this.worker) throw new Error('Sandbox is not initialized');
    const id = Math.random().toString(36).substring(2);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.destroy();
        reject(new Error(`Execution timed out after ${this.timeoutDuration}ms`));
      }, this.timeoutDuration);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.worker?.postMessage({ type: 'EXECUTE', id, code });
    });
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}
