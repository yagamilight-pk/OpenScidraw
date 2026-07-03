import type { SciDrawKernel } from '../kernel/stateEngine';
import type { CanvasObject } from '../types/canvas';
import { createDefaultModifications, createDefaultTransform } from '../utils/canvasBackendEngine';

export interface OpenSciAPI {
  createNode: (type: string, coords: { x: number; y: number; width: number; height: number }) => Promise<string>;
  getSelection: () => Promise<string[]>;
  modifyNode: (id: string, params: Record<string, any>) => Promise<boolean>;
  applyJournalTheme: (themeName: string) => Promise<boolean>;
}

export function createMainThreadAPI(
  kernel: SciDrawKernel,
  onInjectElement: (el: Omit<CanvasObject, 'id'>) => string,
  onUpdateElement: (id: string, patch: Partial<CanvasObject>) => void,
  onApplyTheme: (theme: string) => void,
  getSelectedIds: () => string[]
): OpenSciAPI {
  return {
    createNode: async (type, coords) => {
      const now = new Date().toISOString();
      const el: Omit<CanvasObject, 'id'> = {
        type: type as any,
        label: `Plugin_${type}`,
        category: 'General',
        boundingBox: coords,
        transform: createDefaultTransform(),
        modifications: createDefaultModifications(),
        textLayout: null,
        primitiveParams: null,
        zIndex: 99,
        locked: false,
        visible: true,
        groupId: null,
        createdAt: now,
        updatedAt: now
      };
      
      const newId = onInjectElement(el);
      kernel.applyMutation({
        objectId: newId,
        field: 'created',
        value: el,
        timestamp: Date.now(),
        peerId: kernel.peerId
      });
      
      return newId;
    },

    getSelection: async () => {
      return getSelectedIds();
    },

    modifyNode: async (id, params) => {
      onUpdateElement(id, params);
      for (const [key, value] of Object.entries(params)) {
        kernel.applyMutation({
          objectId: id,
          field: key,
          value,
          timestamp: Date.now(),
          peerId: kernel.peerId
        });
      }
      return true;
    },

    applyJournalTheme: async (themeName) => {
      onApplyTheme(themeName);
      return true;
    }
  };
}
