import React, { useEffect, useRef, useState } from 'react';
import { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';
import { useCanvasSync } from '../hooks/useCanvasSync';

export const MainCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<WebGPURenderEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const instance = new WebGPURenderEngine();
    instance.initialize(canvas).then((success) => {
      if (success) {
        setEngine(instance);
        const proj = new Float32Array([
          2 / canvas.width, 0, 0, 0,
          0, -2 / canvas.height, 0, 0,
          0, 0, 1, 0,
          -1, 1, 0, 1
        ]);
        instance.updateUniforms(proj);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (canvas && instance.device) {
        const width = canvas.parentElement?.clientWidth || window.innerWidth;
        const height = canvas.parentElement?.clientHeight || window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        
        if (instance.context && instance.format) {
          instance.context.configure({
            device: instance.device,
            format: instance.format,
            alphaMode: 'premultiplied'
          });
        }
        
        const proj = new Float32Array([
          2 / width, 0, 0, 0,
          0, -2 / height, 0, 0,
          0, 0, 1, 0,
          -1, 1, 0, 1
        ]);
        instance.updateUniforms(proj);
        instance.render(0);
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
      if (instance.device) {
        instance.device.destroy();
      }
      instance.device = null;
      instance.context = null;
    };
  }, []);

  useCanvasSync(engine);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0b0f19]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    </div>
  );
};
