import { useEffect } from 'react';
import { yObjects, observeObjects } from '../store/yjsStore';
import type { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';

export function useCanvasSync(engine: WebGPURenderEngine | null) {
  useEffect(() => {
    if (!engine) return;

    const updateGpuBuffers = () => {
      const count = yObjects.length;
      if (count === 0) {
        engine.render(0);
        return;
      }

      const instanceData = new Float32Array(count * 20);

      for (let i = 0; i < count; i++) {
        const yMap = yObjects.get(i);
        let x = 0, y = 0, w = 50, h = 50;
        let r = 0.0, g = 0.5, b = 1.0, a = 1.0;

        try {
          const bbox = JSON.parse(yMap.get('boundingBox') || '{}');
          x = bbox.x ?? 0;
          y = bbox.y ?? 0;
          w = bbox.width ?? 50;
          h = bbox.height ?? 50;

          const mods = JSON.parse(yMap.get('modifications') || '{}');
          const fillColor = mods.globalFill?.color || '#3b82f6';
          const hex = fillColor.replace('#', '');
          const bigint = parseInt(hex, 16);
          r = ((bigint >> 16) & 255) / 255;
          g = ((bigint >> 8) & 255) / 255;
          b = (bigint & 255) / 255;
          a = mods.globalOpacity ?? 1.0;
        } catch {
          // fallback to defaults
        }

        const offset = i * 20;
        instanceData[offset + 0] = w;
        instanceData[offset + 1] = 0;
        instanceData[offset + 2] = 0;
        instanceData[offset + 3] = 0;

        instanceData[offset + 4] = 0;
        instanceData[offset + 5] = h;
        instanceData[offset + 6] = 0;
        instanceData[offset + 7] = 0;

        instanceData[offset + 8] = 0;
        instanceData[offset + 9] = 0;
        instanceData[offset + 10] = 1;
        instanceData[offset + 11] = 0;

        instanceData[offset + 12] = x;
        instanceData[offset + 13] = y;
        instanceData[offset + 14] = 0;
        instanceData[offset + 15] = 1;

        instanceData[offset + 16] = r;
        instanceData[offset + 17] = g;
        instanceData[offset + 18] = b;
        instanceData[offset + 19] = a;
      }

      engine.updateInstanceData(instanceData, count);
      engine.render(count);
    };

    updateGpuBuffers();

    const unsubscribe = observeObjects(() => {
      updateGpuBuffers();
    });

    return () => {
      unsubscribe();
    };
  }, [engine]);
}
