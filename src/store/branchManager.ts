import type { GitCommit, VisualGitEngine } from './gitEngine';
import type { CanvasObject } from '../types/canvas';

export interface BranchInfo {
  name: string;
  commitHash: string;
}

export class BranchManager {
  private gitEngine: VisualGitEngine;
  private db: IDBDatabase | null = null;
  private headBranchName: string = 'main';

  constructor(gitEngine: VisualGitEngine) {
    this.gitEngine = gitEngine;
  }

  public async init(): Promise<void> {
    await this.gitEngine.init();
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OpenSciDrawBranchStore', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('branches')) {
          db.createObjectStore('branches', { keyPath: 'name' });
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
    const tx = this.db.transaction('branches', mode);
    return tx.objectStore('branches');
  }

  public async createBranch(name: string, commitHash: string): Promise<void> {
    await this.init();
    const branch: BranchInfo = { name, commitHash };
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const req = store.put(branch);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getBranch(name: string): Promise<BranchInfo | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const req = store.get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public getHeadBranch(): string {
    return this.headBranchName;
  }

  public setHeadBranch(name: string): void {
    this.headBranchName = name;
  }

  public async merge(sourceBranch: string, targetBranch: string): Promise<CanvasObject[]> {
    const src = await this.getBranch(sourceBranch);
    const tgt = await this.getBranch(targetBranch);
    if (!src || !tgt) throw new Error('Invalid branch name(s)');

    const srcCommit = await this.gitEngine.getCommit(src.commitHash);
    const tgtCommit = await this.gitEngine.getCommit(tgt.commitHash);
    if (!srcCommit || !tgtCommit) throw new Error('Commit hashes not found in storage');

    const baseCommit = await this.findCommonAncestor(srcCommit, tgtCommit);
    const baseObjects = baseCommit ? baseCommit.objects : [];

    const mergedObjects: CanvasObject[] = [];
    const srcMap = new Map(srcCommit.objects.map(o => [o.id, o]));
    const tgtMap = new Map(tgtCommit.objects.map(o => [o.id, o]));
    const baseMap = new Map(baseObjects.map(o => [o.id, o]));

    const allKeys = new Set([...srcMap.keys(), ...tgtMap.keys(), ...baseMap.keys()]);

    for (const key of allKeys) {
      const b = baseMap.get(key);
      const s = srcMap.get(key);
      const t = tgtMap.get(key);

      if (!b) {
        if (s && t) {
          mergedObjects.push(t);
        } else if (s) {
          mergedObjects.push(s);
        } else if (t) {
          mergedObjects.push(t);
        }
      } else {
        if (!s && !t) {
          // Deleted in both
        } else if (!s) {
          if (JSON.stringify(t) !== JSON.stringify(b)) {
            if (t) mergedObjects.push(t);
          }
        } else if (!t) {
          if (JSON.stringify(s) !== JSON.stringify(b)) {
            mergedObjects.push(s);
          }
        } else {
          const sChanged = JSON.stringify(s) !== JSON.stringify(b);
          const tChanged = JSON.stringify(t) !== JSON.stringify(b);

          if (!sChanged && !tChanged) {
            mergedObjects.push(b);
          } else if (sChanged && !tChanged) {
            mergedObjects.push(s);
          } else if (!sChanged && tChanged) {
            mergedObjects.push(t);
          } else {
            const sTime = new Date(s.updatedAt).getTime();
            const tTime = new Date(t.updatedAt).getTime();
            mergedObjects.push(tTime >= sTime ? t : s);
          }
        }
      }
    }

    return mergedObjects;
  }

  private async findCommonAncestor(c1: GitCommit, c2: GitCommit): Promise<GitCommit | null> {
    const history1 = await this.getHistoryHashes(c1.hash);
    const history2 = new Set(await this.getHistoryHashes(c2.hash));

    for (const h of history1) {
      if (history2.has(h)) {
        return await this.gitEngine.getCommit(h);
      }
    }
    return null;
  }

  private async getHistoryHashes(startHash: string): Promise<string[]> {
    const hashes: string[] = [];
    let current: string | null = startHash;
    while (current) {
      hashes.push(current);
      const commit = await this.gitEngine.getCommit(current);
      current = commit ? commit.parentHash : null;
    }
    return hashes;
  }
}
