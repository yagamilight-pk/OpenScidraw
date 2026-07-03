import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';
import type { SciDrawKernel } from '../kernel/stateEngine';

export interface UseWebGpuWorkspaceProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  kernel: SciDrawKernel;
}

export function useWebGpuWorkspace({ canvasRef, kernel }: UseWebGpuWorkspaceProps) {
  const engineRef = useRef<WebGPURenderEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 1400, height: 900, zoom: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new WebGPURenderEngine();
    engine.initialize(canvasRef.current).then((success) => {
      if (success) {
        engineRef.current = engine;
        setIsReady(true);
      }
    });

    return () => {
      engineRef.current = null;
      setIsReady(false);
    };
  }, [canvasRef]);

  const updateOrthographicProjection = useCallback(() => {
    if (!engineRef.current) return;
    const { width, height, zoom, offsetX, offsetY } = viewport;
    const proj = new Float32Array([
      2 / width * zoom, 0, 0, 0,
      0, -2 / height * zoom, 0, 0,
      0, 0, 1, 0,
      -1 + (offsetX * 2 / width), 1 - (offsetY * 2 / height), 0, 1
    ]);
    engineRef.current.updateUniforms(proj);
  }, [viewport]);

  useEffect(() => {
    if (isReady) updateOrthographicProjection();
  }, [isReady, viewport, updateOrthographicProjection]);

  const flushKernelStateToGPU = useCallback(() => {
    if (!engineRef.current) return;
    
    const kernelAny = kernel as any;
    if (!kernelAny.stateMap) {
      engineRef.current.render(0);
      return;
    }

    const objects = Array.from(kernelAny.stateMap.entries());
    const count = objects.length;
    if (count === 0) {
      engineRef.current.render(0);
      return;
    }

    const instanceData = new Float32Array(count * 20);
    
    let i = 0;
    for (const [_, objectMap] of objects) {
      const objMap = objectMap as Map<string, any>;
      const x = objMap.get('x')?.value || 0;
      const y = objMap.get('y')?.value || 0;
      const w = objMap.get('width')?.value || 50;
      const h = objMap.get('height')?.value || 50;
      
      const r = objMap.get('colorR')?.value || 0.0;
      const g = objMap.get('colorG')?.value || 0.5;
      const b = objMap.get('colorB')?.value || 1.0;
      const a = objMap.get('colorA')?.value || 1.0;

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

      i++;
    }

    engineRef.current.updateInstanceData(instanceData, count);
    engineRef.current.render(count);
  }, [kernel]);

  useEffect(() => {
    if (!isReady) return;
    let frameId: number;
    const loop = () => {
      flushKernelStateToGPU();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isReady, flushKernelStateToGPU]);

  return { isReady, setViewport };
}
