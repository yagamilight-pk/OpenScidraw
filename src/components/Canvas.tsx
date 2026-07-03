import React, { useRef, useEffect, useState } from 'react';

export interface CanvasElement {
  id: string;
  assetId: string;
  name: string;
  category: string;
  path: string;
  svgText: string;
  x: number;
  y: number;
  scale: number;
  rotation: number; // in degrees
  color: string;
  opacity: number;
  zIndex: number;
}

interface CanvasProps {
  elements: CanvasElement[];
  selectedId: string | null;
  onChangeElements: (elements: CanvasElement[]) => void;
  onSelect: (id: string | null) => void;
}

const BASE_SIZE = 120; // Default base size for rendered SVGs
const HANDLE_SIZE = 8;

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedId,
  onChangeElements,
  onSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageCache = useRef<Record<string, { img: HTMLImageElement; color: string }>>({});
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'rotate' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState<{ x: number; y: number; scale: number; rotation: number } | null>(null);
  const [redrawTrigger, setRedrawTrigger] = useState(0);

  // Helper: Rerender canvas
  const triggerRedraw = () => setRedrawTrigger((prev) => prev + 1);

  // Helper: Rotate a point around (0,0)
  const rotatePoint = (x: number, y: number, angleDegrees: number): [number, number] => {
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return [
      x * cos - y * sin,
      x * sin + y * cos
    ];
  };

  // Helper: Get actual coordinates of handles for a selected element
  const getHandles = (el: CanvasElement) => {
    const w = BASE_SIZE * el.scale;
    const h = BASE_SIZE * el.scale;
    
    const corners = {
      tl: [-w / 2, -h / 2],
      tr: [w / 2, -h / 2],
      bl: [-w / 2, h / 2],
      br: [w / 2, h / 2],
      rot: [0, -h / 2 - 24], // 24px above top center
    };

    const result: Record<string, { x: number; y: number }> = {};
    for (const [key, pt] of Object.entries(corners)) {
      const [rx, ry] = rotatePoint(pt[0], pt[1], el.rotation);
      result[key] = { x: el.x + rx, y: el.y + ry };
    }
    return result;
  };

  // Get cached HTMLImageElement or load it asynchronously
  const getCachedImage = (el: CanvasElement): HTMLImageElement | null => {
    const cached = imageCache.current[el.id];
    if (cached && cached.color === el.color) {
      return cached.img;
    }

    const img = new Image();
    // Replace currentColor with actual hex color code
    const processedSvg = el.svgText.replaceAll('currentColor', el.color);
    const blob = new Blob([processedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      imageCache.current[el.id] = { img, color: el.color };
      URL.revokeObjectURL(url);
      triggerRedraw();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;

    // Use previously cached image as fallback while new one loads
    return cached ? cached.img : null;
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Background
    const drawGrid = () => {
      ctx.save();
      ctx.strokeStyle = 'rgba(38, 55, 90, 0.25)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();
    };
    drawGrid();

    // Sort elements by z-index
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    // Draw elements
    sortedElements.forEach((el) => {
      const img = getCachedImage(el);
      if (!img) return; // Will redraw when image loads

      ctx.save();
      // Position and Rotate
      ctx.translate(el.x, el.y);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.globalAlpha = el.opacity;

      const w = BASE_SIZE * el.scale;
      const h = BASE_SIZE * el.scale;
      
      // Draw centered
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });

    // Draw Active Selection Frame & Handles
    if (selectedId) {
      const el = elements.find((e) => e.id === selectedId);
      if (el) {
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate((el.rotation * Math.PI) / 180);

        const w = BASE_SIZE * el.scale;
        const h = BASE_SIZE * el.scale;

        // Bounding Box Border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Rotation Handle Stem Line
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, -h / 2 - 24);
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
        ctx.restore();

        // Draw Interactive Handles
        const handles = getHandles(el);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;

        for (const [key, pt] of Object.entries(handles)) {
          ctx.beginPath();
          if (key === 'rot') {
            // Draw circle handle for rotation
            ctx.arc(pt.x, pt.y, HANDLE_SIZE * 0.9, 0, 2 * Math.PI);
            ctx.fillStyle = '#3b82f6';
          } else {
            // Draw square handles for scaling
            ctx.rect(pt.x - HANDLE_SIZE / 2, pt.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.fillStyle = '#ffffff';
          }
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }, [elements, selectedId, redrawTrigger]);

  // Handle mouse/touch actions
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Account for styling/resizing scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    // Check if clicked inside a handle of the selected element
    if (selectedId) {
      const el = elements.find((item) => item.id === selectedId);
      if (el) {
        const handles = getHandles(el);
        
        // Check rotation handle
        const rotDist = Math.hypot(pos.x - handles.rot.x, pos.y - handles.rot.y);
        if (rotDist <= HANDLE_SIZE + 4) {
          setIsDragging(true);
          setDragMode('rotate');
          setDragStart({ x: pos.x, y: pos.y });
          setElementStart({ x: el.x, y: el.y, scale: el.scale, rotation: el.rotation });
          return;
        }

        // Check scaling handles
        for (const [key, pt] of Object.entries(handles)) {
          if (key === 'rot') continue;
          const dist = Math.hypot(pos.x - pt.x, pos.y - pt.y);
          if (dist <= HANDLE_SIZE + 4) {
            setIsDragging(true);
            setDragMode(`scale-${key}` as any);
            setDragStart({ x: pos.x, y: pos.y });
            setElementStart({ x: el.x, y: el.y, scale: el.scale, rotation: el.rotation });
            return;
          }
        }
      }
    }

    // Check if clicked inside any element (starting from top layers down)
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    for (const el of sorted) {
      const w = BASE_SIZE * el.scale;
      const h = BASE_SIZE * el.scale;
      
      // Transform mouse position to element's local coordinate space
      const dx = pos.x - el.x;
      const dy = pos.y - el.y;
      const [lx, ly] = rotatePoint(dx, dy, -el.rotation);

      // Hit test local coordinates against element bounding box
      if (lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2) {
        onSelect(el.id);
        setIsDragging(true);
        setDragMode('move');
        setDragStart({ x: pos.x, y: pos.y });
        setElementStart({ x: el.x, y: el.y, scale: el.scale, rotation: el.rotation });
        return;
      }
    }

    // Clicked empty space
    onSelect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedId || !elementStart) return;
    const pos = getMousePos(e);
    
    const updated = elements.map((el) => {
      if (el.id !== selectedId) return el;

      if (dragMode === 'move') {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        return {
          ...el,
          x: Math.round(elementStart.x + dx),
          y: Math.round(elementStart.y + dy),
        };
      }

      if (dragMode === 'rotate') {
        // Calculate angle from center (el.x, el.y) to mouse
        const angleStart = Math.atan2(dragStart.y - el.y, dragStart.x - el.x);
        const angleCurrent = Math.atan2(pos.y - el.y, pos.x - el.x);
        
        let rotDiff = ((angleCurrent - angleStart) * 180) / Math.PI;
        // Snap to nearest 15 degrees if shift key is pressed
        let targetRotation = elementStart.rotation + rotDiff;
        if (e.shiftKey) {
          targetRotation = Math.round(targetRotation / 15) * 15;
        }

        return {
          ...el,
          rotation: (targetRotation + 360) % 360,
        };
      }

      if (dragMode && dragMode.startsWith('scale-')) {
        // Uniform scaling
        // Calculate distance from center to start pos vs center to current pos
        const distStart = Math.hypot(dragStart.x - el.x, dragStart.y - el.y);
        const distCurrent = Math.hypot(pos.x - el.x, pos.y - el.y);
        
        let newScale = elementStart.scale * (distCurrent / distStart);
        // Constraint scale
        newScale = Math.max(0.1, Math.min(newScale, 5));
        
        return {
          ...el,
          scale: Number(newScale.toFixed(3)),
        };
      }

      return el;
    });

    onChangeElements(updated);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
    setElementStart(null);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex items-center justify-center bg-dark-bg/40 border border-dark-border rounded-xl p-4 glass-panel shadow-2xl overflow-hidden"
      style={{ width: '832px', height: '632px' }}
    >
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="canvas-grid-bg bg-dark-bg rounded-lg shadow-inner cursor-crosshair"
      />

      {/* Floating Canvas Grid Guides */}
      <div className="absolute bottom-2 left-6 text-xs text-slate-500 select-none">
        Canvas Size: 800 × 600 px | Snap: Shift key
      </div>
    </div>
  );
};
