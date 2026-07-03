export interface CanvasObjectMutation {
  objectId: string;
  field: string;
  value: any;
  timestamp: number;
  peerId: string;
}

export class SciDrawKernel {
  public readonly peerId: string;
  public logicalClock: number = 0;
  private stateMap: Map<string, Map<string, { value: any; timestamp: number; peerId: string }>> = new Map();

  constructor(peerId?: string) {
    this.peerId = peerId || this.generatePeerId();
  }

  private generatePeerId(): string {
    return 'peer_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  public applyMutation(mutation: CanvasObjectMutation): boolean {
    this.logicalClock = Math.max(this.logicalClock, mutation.timestamp) + 1;

    let objectMap = this.stateMap.get(mutation.objectId);
    if (!objectMap) {
      objectMap = new Map();
      this.stateMap.set(mutation.objectId, objectMap);
    }

    const currentEntry = objectMap.get(mutation.field);
    if (!currentEntry) {
      objectMap.set(mutation.field, { value: mutation.value, timestamp: mutation.timestamp, peerId: mutation.peerId });
      return true;
    }

    if (mutation.timestamp > currentEntry.timestamp) {
      objectMap.set(mutation.field, { value: mutation.value, timestamp: mutation.timestamp, peerId: mutation.peerId });
      return true;
    } else if (mutation.timestamp === currentEntry.timestamp) {
      if (mutation.peerId > currentEntry.peerId) {
        objectMap.set(mutation.field, { value: mutation.value, timestamp: mutation.timestamp, peerId: mutation.peerId });
        return true;
      }
    }

    return false;
  }

  public compileDeltaPacket(): string[] {
    const delta: string[] = [];
    for (const [objectId, objectMap] of this.stateMap.entries()) {
      for (const [field, entry] of objectMap.entries()) {
        delta.push(JSON.stringify({
          objectId,
          field,
          value: entry.value,
          timestamp: entry.timestamp,
          peerId: entry.peerId
        }));
      }
    }
    return delta;
  }

  public getObjectState(objectId: string): Record<string, any> | null {
    const objectMap = this.stateMap.get(objectId);
    if (!objectMap) return null;
    const state: Record<string, any> = {};
    for (const [field, entry] of objectMap.entries()) {
      state[field] = entry.value;
    }
    return state;
  }
}
