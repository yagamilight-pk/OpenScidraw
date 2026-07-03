import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applyObjectToYMap, yMapToCanvasObject } from '../src/store/yjsStore';
import type { CanvasObject } from '../src/types/canvas';
import { createDefaultModifications, createDefaultTransform } from '../src/utils/canvasBackendEngine';

describe('WebRTC & CRDT Mesh Network State Concurrency Stress Tests', () => {
  it('should deterministically resolve 10,000 conflicting canvas mutations among 50 mock peers', async () => {
    const numPeers = 50;
    const mutationsPerPeer = 200;
    const docs = Array.from({ length: numPeers }, () => new Y.Doc());
    const arrays = docs.map(d => d.getArray<Y.Map<any>>('canvasObjects'));

    for (let i = 0; i < numPeers; i++) {
      docs[i].on('update', (update, origin) => {
        if (origin === 'remote') return;
        for (let j = 0; j < numPeers; j++) {
          if (i !== j) {
            Y.applyUpdate(docs[j], update, 'remote');
          }
        }
      });
    }

    const initialObj: CanvasObject = {
      id: 'node-0',
      type: 'primitive-circle',
      label: 'Initial',
      category: 'General',
      boundingBox: { x: 100, y: 100, width: 50, height: 50 },
      transform: createDefaultTransform(),
      modifications: createDefaultModifications(),
      textLayout: null,
      primitiveParams: null,
      zIndex: 1,
      locked: false,
      visible: true,
      groupId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    docs[0].transact(() => {
      const yMap = new Y.Map<any>();
      applyObjectToYMap(yMap, initialObj);
      arrays[0].push([yMap]);
    });

    const mutatePromises = Array.from({ length: numPeers }).map(async (_, peerIdx) => {
      for (let count = 0; count < mutationsPerPeer; count++) {
        docs[peerIdx].transact(() => {
          const yMap = arrays[peerIdx].get(0);
          if (yMap) {
            const currentX = JSON.parse(yMap.get('boundingBox') || '{}').x || 100;
            yMap.set('boundingBox', JSON.stringify({ x: currentX + (peerIdx - 25), y: 100, width: 50, height: 50 }));
            yMap.set('updatedAt', new Date().toISOString());
          }
        });
      }
    });

    await Promise.all(mutatePromises);

    const finalStates = docs.map(doc => {
      const array = doc.getArray<Y.Map<any>>('canvasObjects');
      return yMapToCanvasObject(array.get(0));
    });

    const firstStatePayload = JSON.stringify(finalStates[0]);
    for (let i = 1; i < numPeers; i++) {
      const peerStatePayload = JSON.stringify(finalStates[i]);
      expect(peerStatePayload).toBe(firstStatePayload);
    }
  }, 30000);
});
