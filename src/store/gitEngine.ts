import * as Y from 'yjs';
import type { CanvasObject } from '../types/canvas';
import { applyObjectToYMap, yMapToCanvasObject } from './yjsStore';

export interface GitCommit {
  hash: string;
  parentHash: string | null;
  objects: CanvasObject[];
  message: string;
  timestamp: number;
  author: string;
}

export class VisualGitEngine {
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OpenSciDrawGitStore', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('commits')) {
          db.createObjectStore('commits', { keyPath: 'hash' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('IndexedDB Database not initialized');
    const tx = this.db.transaction('commits', mode);
    return tx.objectStore('commits');
  }

  public async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public async commit(
    ydoc: Y.Doc,
    message: string,
    author: string,
    parentHash: string | null
  ): Promise<GitCommit> {
    await this.init();
    const canvasObjects: CanvasObject[] = [];
    const localYObjects = ydoc.getArray<Y.Map<any>>('canvasObjects');
    
    for (let i = 0; i < localYObjects.length; i++) {
      try {
        canvasObjects.push(yMapToCanvasObject(localYObjects.get(i)));
      } catch {
        // Skip malformed entries
      }
    }

    const payload = JSON.stringify({
      parentHash,
      objects: canvasObjects.sort((a, b) => a.id.localeCompare(b.id)),
      message,
      author
    });
    
    const hash = await this.sha256(payload);
    const commitObj: GitCommit = {
      hash,
      parentHash,
      objects: canvasObjects,
      message,
      timestamp: Date.now(),
      author
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const req = store.put(commitObj);
      req.onsuccess = () => resolve(commitObj);
      req.onerror = () => reject(req.error);
    });
  }

  public async getCommit(hash: string): Promise<GitCommit | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const req = store.get(hash);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async checkout(ydoc: Y.Doc, commitHash: string): Promise<void> {
    const commit = await this.getCommit(commitHash);
    if (!commit) throw new Error(`Commit ${commitHash} not found`);

    ydoc.transact(() => {
      const localYObjects = ydoc.getArray<Y.Map<any>>('canvasObjects');
      localYObjects.delete(0, localYObjects.length);

      for (const obj of commit.objects) {
        const yMap = new Y.Map<any>();
        applyObjectToYMap(yMap, obj);
        localYObjects.push([yMap]);
      }
    });
  }
}
