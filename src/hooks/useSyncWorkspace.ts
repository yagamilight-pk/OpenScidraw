import { useEffect, useState, useCallback } from 'react';
import { ydoc, yObjects, observeObjects, upsertYObject, removeYObject } from '../store/yjsStore';
import { getAwareness } from '../network/webrtcProvider';
import type { CanvasObject } from '../types/canvas';

export function useSyncWorkspace(onRemoteChange?: (objects: CanvasObject[]) => void) {
  const [elements, setElements] = useState<CanvasObject[]>([]);

  useEffect(() => {
    const current = yObjects.toArray().map((m) => {
      try {
        return {
          id: m.get('id'),
          type: m.get('type'),
          label: m.get('label'),
          category: m.get('category'),
          zIndex: m.get('zIndex'),
          locked: m.get('locked'),
          visible: m.get('visible'),
          groupId: m.get('groupId'),
          assetId: m.get('assetId'),
          assetPath: m.get('assetPath'),
          svgRawContent: m.get('svgRawContent'),
          createdAt: m.get('createdAt'),
          updatedAt: m.get('updatedAt'),
          boundingBox: JSON.parse(m.get('boundingBox') || '{}'),
          transform: JSON.parse(m.get('transform') || '{}'),
          modifications: JSON.parse(m.get('modifications') || '{}'),
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as CanvasObject[];
    
    setElements(current);

    const unsubscribe = observeObjects((updatedList) => {
      setElements(updatedList);
      if (onRemoteChange) {
        onRemoteChange(updatedList);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onRemoteChange]);

  const updateElementPosition = useCallback((id: string, x: number, y: number) => {
    const existing = yObjects.toArray().find((m) => m.get('id') === id);
    if (existing) {
      ydoc.transact(() => {
        try {
          const bbox = JSON.parse(existing.get('boundingBox') || '{}');
          bbox.x = x;
          bbox.y = y;
          existing.set('boundingBox', JSON.stringify(bbox));
          existing.set('updatedAt', new Date().toISOString());
        } catch (e) {
          console.error(e);
        }
      });
    }
  }, []);

  const addElement = useCallback((obj: CanvasObject) => {
    upsertYObject(obj);
  }, []);

  const removeElement = useCallback((id: string) => {
    removeYObject(id);
  }, []);

  return {
    elements,
    addElement,
    updateElementPosition,
    removeElement,
    awareness: getAwareness()
  };
}
