import * as Y from 'yjs';
import type { CanvasObject } from '../types/canvas';

export const ydoc = new Y.Doc();

export const yMeta = ydoc.getMap<any>('canvasMeta');
export const yObjects = ydoc.getArray<Y.Map<any>>('canvasObjects');

export function initMeta(width: number, height: number, theme: string): void {
  ydoc.transact(() => {
    yMeta.set('width', width);
    yMeta.set('height', height);
    yMeta.set('theme', theme);
    yMeta.set('backgroundColor', '#0b0f19');
    yMeta.set('gridSize', 20);
    yMeta.set('gridEnabled', true);
  });
}

export function upsertYObject(obj: CanvasObject): void {
  ydoc.transact(() => {
    const existing = findYObjectById(obj.id);
    if (existing) {
      applyObjectToYMap(existing, obj);
    } else {
      const yMap = new Y.Map<any>();
      applyObjectToYMap(yMap, obj);
      yObjects.push([yMap]);
    }
  });
}

export function removeYObject(id: string): void {
  ydoc.transact(() => {
    const idx = findYObjectIndexById(id);
    if (idx !== -1) yObjects.delete(idx, 1);
  });
}

export function findYObjectById(id: string): Y.Map<any> | null {
  for (let i = 0; i < yObjects.length; i++) {
    const m = yObjects.get(i);
    if (m.get('id') === id) return m;
  }
  return null;
}

export function findYObjectIndexById(id: string): number {
  for (let i = 0; i < yObjects.length; i++) {
    if (yObjects.get(i).get('id') === id) return i;
  }
  return -1;
}

export function applyObjectToYMap(yMap: Y.Map<any>, obj: CanvasObject): void {
  yMap.set('id', obj.id);
  yMap.set('type', obj.type);
  yMap.set('label', obj.label);
  yMap.set('category', obj.category);
  yMap.set('zIndex', obj.zIndex);
  yMap.set('locked', obj.locked);
  yMap.set('visible', obj.visible);
  yMap.set('groupId', obj.groupId);
  yMap.set('assetId', obj.assetId);
  yMap.set('assetPath', obj.assetPath);
  yMap.set('createdAt', obj.createdAt);
  yMap.set('updatedAt', obj.updatedAt);
  yMap.set('boundingBox', JSON.stringify(obj.boundingBox));
  yMap.set('transform', JSON.stringify(obj.transform));
  yMap.set('modifications', JSON.stringify(obj.modifications));
  yMap.set('textLayout', obj.textLayout ? JSON.stringify(obj.textLayout) : null);
  yMap.set('primitiveParams', obj.primitiveParams ? JSON.stringify(obj.primitiveParams) : null);
  yMap.set('svgRawContent', obj.svgRawContent ?? null);
}

export function yMapToCanvasObject(yMap: Y.Map<any>): CanvasObject {
  return {
    id: yMap.get('id'),
    type: yMap.get('type'),
    label: yMap.get('label'),
    category: yMap.get('category'),
    zIndex: yMap.get('zIndex'),
    locked: yMap.get('locked'),
    visible: yMap.get('visible'),
    groupId: yMap.get('groupId'),
    assetId: yMap.get('assetId'),
    assetPath: yMap.get('assetPath'),
    svgRawContent: yMap.get('svgRawContent'),
    createdAt: yMap.get('createdAt'),
    updatedAt: yMap.get('updatedAt'),
    boundingBox: JSON.parse(yMap.get('boundingBox') || '{}'),
    transform: JSON.parse(yMap.get('transform') || '{}'),
    modifications: JSON.parse(yMap.get('modifications') || '{}'),
    textLayout: yMap.get('textLayout') ? JSON.parse(yMap.get('textLayout')) : null,
    primitiveParams: yMap.get('primitiveParams') ? JSON.parse(yMap.get('primitiveParams')) : null,
  };
}

export function getAllCanvasObjects(): CanvasObject[] {
  const result: CanvasObject[] = [];
  for (let i = 0; i < yObjects.length; i++) {
    try {
      result.push(yMapToCanvasObject(yObjects.get(i)));
    } catch {
      // skip malformed entries
    }
  }
  return result;
}

export function observeObjects(callback: (objects: CanvasObject[]) => void): () => void {
  const handler = () => callback(getAllCanvasObjects());
  yObjects.observeDeep(handler);
  return () => yObjects.unobserveDeep(handler);
}
