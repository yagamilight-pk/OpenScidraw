import React, {
  useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef,
} from 'react';
import type { CanvasObject, CanvasState } from '../types/canvas';
import type { PatternBrushTheme } from './SidebarAssetPanel';

export interface CanvasStageHandle {
  exportPNG(scale?: number): Promise<string>;
  exportSVGString(): string;
  getState(): CanvasState;
  setState(state: CanvasState): void;
  centerViewport(): void;
  zoomTo(level: number): void;
}

interface ConnectionPort {
  objectId: string;
  portId: string;
  x: number;
  y: number;
  side: 'top' | 'right' | 'bottom' | 'left';
}

interface SmartConnector {
  id: string;
  fromObjectId: string;
  fromPortId: string;
  toObjectId: string;
  toPortId: string;
  color: string;
  strokeWidth: number;
  arrowEnd: boolean;
  arrowStart: boolean;
  label: string;
}

interface CanvasStageProps {
  elements: CanvasObject[];
  selectedId: string | null;
  connectors: SmartConnector[];
  activeBrush: PatternBrushTheme;
  onSelect: (id: string | null) => void;
  onUpdateElements: (elements: CanvasObject[]) => void;
  onConnectorAdd: (connector: SmartConnector) => void;
  onConnectorUpdate: (connectors: SmartConnector[]) => void;
}


const HANDLE = 9;
const GRID = 20;
const PORT_RADIUS = 5;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const BRUSH_SVG: Record<PatternBrushTheme, (x: number, y: number, angle: number, scale: number) => string> = {
  'none': () => '',
  'lipid-bilayer': (x, y, angle, s) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tx = (dx: number, dy: number) => [x + (dx * cos - dy * sin) * s, y + (dx * sin + dy * cos) * s];
    const head = tx(0, -10); const t1 = tx(-4, 2); const t2 = tx(4, 2);
    const h2 = tx(0, 10); const t3 = tx(-4, -2); const t4 = tx(4, -2);
    return `M${head[0]},${head[1]} Q${t1[0]},${t1[1]} ${tx(0,0)[0]},${tx(0,0)[1]}
      M${head[0]},${head[1]} Q${t2[0]},${t2[1]} ${tx(0,0)[0]},${tx(0,0)[1]}
      M${h2[0]},${h2[1]} Q${t3[0]},${t3[1]} ${tx(0,0)[0]},${tx(0,0)[1]}
      M${h2[0]},${h2[1]} Q${t4[0]},${t4[1]} ${tx(0,0)[0]},${tx(0,0)[1]}`;
  },
  'dna-helix': (x, y, angle, s) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const pts: string[] = [];
    for (let i = -1; i <= 1; i++) {
      const t = i * 0.5;
      const wave = Math.sin(t * Math.PI) * 8 * s;
      const lx = x + (t * 12 * cos - wave * sin);
      const ly = y + (t * 12 * sin + wave * cos);
      pts.push(`${i === -1 ? 'M' : 'L'}${lx},${ly}`);
    }
    return pts.join(' ');
  },
  'microtubule': (x, y, angle, s) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tx = (dx: number, dy: number) => [x + (dx * cos - dy * sin) * s, y + (dx * sin + dy * cos) * s];
    const corners = [tx(-10, -4), tx(10, -4), tx(10, 4), tx(-10, 4)];
    return `M${corners[0][0]},${corners[0][1]} L${corners[1][0]},${corners[1][1]} L${corners[2][0]},${corners[2][1]} L${corners[3][0]},${corners[3][1]} Z`;
  },
  'capillary': (x, y, angle, s) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tx = (dx: number, dy: number) => [x + (dx * cos - dy * sin) * s, y + (dx * sin + dy * cos) * s];
    const a = tx(-12, 0); const b = tx(12, 0);
    const c = tx(-8, -7); const d = tx(8, -7);
    return `M${a[0]},${a[1]} C${c[0]},${c[1]} ${d[0]},${d[1]} ${b[0]},${b[1]}
      M${a[0]},${a[1]} L${tx(-12,7)[0]},${tx(-12,7)[1]}
      M${b[0]},${b[1]} L${tx(12,7)[0]},${tx(12,7)[1]}`;
  },
};

function getObjectPorts(obj: CanvasObject): ConnectionPort[] {
  const { x, y, width, height } = obj.boundingBox;
  const cx = x + width / 2; const cy = y + height / 2;
  return [
    { objectId: obj.id, portId: 'top', x: cx, y, side: 'top' },
    { objectId: obj.id, portId: 'right', x: x + width, y: cy, side: 'right' },
    { objectId: obj.id, portId: 'bottom', x: cx, y: y + height, side: 'bottom' },
    { objectId: obj.id, portId: 'left', x, y: cy, side: 'left' },
  ];
}



function rotatePoint(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos((angle * Math.PI) / 180);
  const s = Math.sin((angle * Math.PI) / 180);
  return [x * c - y * s, x * s + y * c];
}

function getHandlePositions(obj: CanvasObject) {
  const { x, y, width, height } = obj.boundingBox;
  const cx = x + width / 2; const cy = y + height / 2;
  const rot = obj.transform.rotation;
  const rp = (dx: number, dy: number) => {
    const [rx, ry] = rotatePoint(dx, dy, rot);
    return { x: cx + rx, y: cy + ry };
  };
  return {
    tl: rp(-width / 2, -height / 2),
    tr: rp(width / 2, -height / 2),
    bl: rp(-width / 2, height / 2),
    br: rp(width / 2, height / 2),
    rot: rp(0, -height / 2 - 28),
  };
}

type DragMode = 'move' | 'rotate' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'pan' | 'draw-connector' | 'brush-path';

interface ImageCacheEntry { img: HTMLImageElement; color: string }
const IMAGE_CACHE: Record<string, ImageCacheEntry> = {};

export const CanvasStage = forwardRef<CanvasStageHandle, CanvasStageProps>((
  { elements, selectedId, connectors, activeBrush, onSelect, onUpdateElements, onConnectorAdd },
  ref
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elemStart, setElemStart] = useState<{ x: number; y: number; w: number; h: number; scale: number; rotation: number } | null>(null);
  const [vpStart, setVpStart] = useState({ x: 0, y: 0 });
  const [brushPath, setBrushPath] = useState<{ x: number; y: number }[]>([]);
  const [_brushActive, setBrushActive] = useState(false);
  const [hoveredPort, setHoveredPort] = useState<ConnectionPort | null>(null);
  const [connectorDraft, setConnectorDraft] = useState<{ fromPort: ConnectionPort; mouseX: number; mouseY: number } | null>(null);
  const [redraw, setRedraw] = useState(0);

  const triggerRedraw = useCallback(() => setRedraw((n) => n + 1), []);



  const toScreen = useCallback((cx: number, cy: number) => ({
    x: cx * viewport.zoom + viewport.x,
    y: cy * viewport.zoom + viewport.y,
  }), [viewport]);

  const getCachedImage = useCallback((obj: CanvasObject): HTMLImageElement | null => {
    const color = obj.modifications.globalFill.color;
    const cached = IMAGE_CACHE[obj.id];
    if (cached && cached.color === color) return cached.img;
    if (!obj.svgRawContent) return null;
    const svg = obj.svgRawContent.replace(/currentColor/g, color);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      IMAGE_CACHE[obj.id] = { img, color };
      URL.revokeObjectURL(url);
      triggerRedraw();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    return cached?.img ?? null;
  }, [triggerRedraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    const gridStart = {
      x: Math.floor(-viewport.x / viewport.zoom / GRID) * GRID,
      y: Math.floor(-viewport.y / viewport.zoom / GRID) * GRID,
    };
    const gridEnd = {
      x: gridStart.x + width / viewport.zoom + GRID * 2,
      y: gridStart.y + height / viewport.zoom + GRID * 2,
    };

    ctx.strokeStyle = 'rgba(38, 55, 90, 0.22)';
    ctx.lineWidth = 0.5;
    for (let gx = gridStart.x; gx < gridEnd.x; gx += GRID) {
      ctx.beginPath(); ctx.moveTo(gx, gridStart.y); ctx.lineTo(gx, gridEnd.y); ctx.stroke();
    }
    for (let gy = gridStart.y; gy < gridEnd.y; gy += GRID) {
      ctx.beginPath(); ctx.moveTo(gridStart.x, gy); ctx.lineTo(gridEnd.x, gy); ctx.stroke();
    }

    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((obj) => {
      if (!obj.visible) return;
      ctx.save();
      const { x, y, width: w, height: h } = obj.boundingBox;
      const cx = x + w / 2; const cy = y + h / 2;
      const t = obj.transform;
      ctx.translate(cx, cy);
      ctx.rotate((t.rotation * Math.PI) / 180);
      const sx = t.scaleX * (t.flipHorizontal ? -1 : 1);
      const sy = t.scaleY * (t.flipVertical ? -1 : 1);
      ctx.scale(sx, sy);
      ctx.globalAlpha = obj.modifications.globalOpacity;

      if (obj.type === 'svg-asset') {
        const img = getCachedImage(obj);
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
        else { ctx.fillStyle = '#1e2d45'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      } else if (obj.type === 'primitive-rect') {
        const r = obj.primitiveParams?.rect?.cornerRadius ?? 0;
        ctx.fillStyle = obj.modifications.globalFill.color;
        ctx.strokeStyle = obj.modifications.globalStroke.color;
        ctx.lineWidth = obj.modifications.globalStroke.width;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.fill(); if (obj.modifications.globalStroke.width > 0) ctx.stroke();
      } else if (obj.type === 'primitive-circle') {
        ctx.fillStyle = obj.modifications.globalFill.color;
        ctx.strokeStyle = obj.modifications.globalStroke.color;
        ctx.lineWidth = obj.modifications.globalStroke.width;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill(); if (obj.modifications.globalStroke.width > 0) ctx.stroke();
      } else if (obj.type === 'primitive-triangle') {
        const p = obj.primitiveParams?.triangle;
        ctx.fillStyle = obj.modifications.globalFill.color;
        ctx.strokeStyle = obj.modifications.globalStroke.color;
        ctx.lineWidth = obj.modifications.globalStroke.width;
        ctx.beginPath();
        if (p) {
          ctx.moveTo(p.pointA.x - w / 2, p.pointA.y - h / 2);
          ctx.lineTo(p.pointB.x - w / 2, p.pointB.y - h / 2);
          ctx.lineTo(p.pointC.x - w / 2, p.pointC.y - h / 2);
        } else { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); }
        ctx.closePath(); ctx.fill(); if (obj.modifications.globalStroke.width > 0) ctx.stroke();
      } else if (obj.type === 'text-block' && obj.textLayout) {
        const tl = obj.textLayout;
        ctx.font = `${tl.fontStyle} ${tl.fontWeight} ${tl.fontSize}px ${tl.fontFamily}`;
        ctx.fillStyle = tl.color;
        ctx.textAlign = tl.textAlign as CanvasTextAlign;
        ctx.textBaseline = 'top';
        const tx2 = tl.textAlign === 'center' ? 0 : tl.textAlign === 'right' ? w / 2 - tl.padding.right : -w / 2 + tl.padding.left;
        ctx.fillText(tl.content, tx2, -h / 2 + tl.padding.top, w);
      }
      ctx.restore();
    });

    if (brushPath.length > 1 && activeBrush !== 'none') {
      const fn = BRUSH_SVG[activeBrush];
      const SPACING = 28;
      let totalLen = 0;
      const segments: number[] = [0];
      for (let i = 1; i < brushPath.length; i++) {
        const dx = brushPath[i].x - brushPath[i - 1].x;
        const dy = brushPath[i].y - brushPath[i - 1].y;
        totalLen += Math.hypot(dx, dy);
        segments.push(totalLen);
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      let dist = 0;
      while (dist < totalLen) {
        let segIdx = 0;
        for (let i = 1; i < segments.length; i++) {
          if (segments[i] >= dist) { segIdx = i - 1; break; }
        }
        const t2 = (dist - segments[segIdx]) / Math.max(1, segments[segIdx + 1] - segments[segIdx]);
        const px = brushPath[segIdx].x + (brushPath[segIdx + 1]?.x - brushPath[segIdx].x) * t2;
        const py = brushPath[segIdx].y + (brushPath[segIdx + 1]?.y - brushPath[segIdx].y) * t2;
        const nx = brushPath[segIdx + 1]?.x - brushPath[segIdx].x;
        const ny = brushPath[segIdx + 1]?.y - brushPath[segIdx].y;
        const angle = Math.atan2(ny, nx);
        const pathStr = fn(px, py, angle, 1);
        if (pathStr) {
          const seg2d = new Path2D(pathStr.replace(/\n/g, ' '));
          ctx.stroke(seg2d);
        }
        dist += SPACING;
      }
    }

    if (selectedId) {
      const obj = elements.find((e) => e.id === selectedId);
      if (obj) {
        const handles = getHandlePositions(obj);
        const { x, y, width: w, height: h } = obj.boundingBox;
        const cx = x + w / 2; const cy = y + h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((obj.transform.rotation * Math.PI) / 180);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, -h / 2 - 28);
        ctx.stroke();
        ctx.restore();

        ctx.setLineDash([]);
        for (const [key, pt] of Object.entries(handles)) {
          ctx.beginPath();
          if (key === 'rot') {
            ctx.arc(toScreen(pt.x, pt.y).x / viewport.zoom, toScreen(pt.x, pt.y).y / viewport.zoom, HANDLE * 0.85, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
          } else {
            ctx.fillStyle = '#fff';
            const sp = { x: pt.x, y: pt.y };
            ctx.rect(sp.x - HANDLE / 2, sp.y - HANDLE / 2, HANDLE, HANDLE);
          }
          ctx.fill();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        getObjectPorts(obj).forEach((port) => {
          const isHov = hoveredPort?.objectId === port.objectId && hoveredPort.portId === port.portId;
          ctx.beginPath();
          ctx.arc(port.x, port.y, isHov ? PORT_RADIUS + 2 : PORT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = isHov ? '#10b981' : '#1e2d45';
          ctx.strokeStyle = isHov ? '#34d399' : '#3b82f6';
          ctx.lineWidth = 2;
          ctx.fill(); ctx.stroke();
        });
      }
    }

    ctx.restore();
  }, [elements, selectedId, viewport, brushPath, activeBrush, hoveredPort, redraw, getCachedImage, toScreen]);

  const getMouseCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      clientX: e.clientX - rect.left,
      clientY: e.clientY - rect.top,
      canvasX: (e.clientX - rect.left - viewport.x) / viewport.zoom,
      canvasY: (e.clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { clientX, clientY, canvasX, canvasY } = getMouseCanvas(e);
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setDragMode('pan');
      setDragStart({ x: clientX, y: clientY });
      setVpStart({ x: viewport.x, y: viewport.y });
      return;
    }

    if (activeBrush !== 'none') {
      setDragMode('brush-path');
      setBrushPath([{ x: canvasX, y: canvasY }]);
      setBrushActive(true);
      return;
    }

    if (selectedId) {
      const obj = elements.find((el) => el.id === selectedId);
      if (obj) {
        const handles = getHandlePositions(obj);
        for (const [key, pt] of Object.entries(handles)) {
          const dist = Math.hypot(canvasX - pt.x, canvasY - pt.y);
          if (dist <= HANDLE + 4) {
            setDragMode(key as DragMode);
            setDragStart({ x: clientX, y: clientY });
            const bb = obj.boundingBox;
            setElemStart({ x: bb.x, y: bb.y, w: bb.width, h: bb.height, scale: obj.transform.scaleX, rotation: obj.transform.rotation });
            return;
          }
        }
        const ports = getObjectPorts(obj);
        for (const port of ports) {
          const dist = Math.hypot(canvasX - port.x, canvasY - port.y);
          if (dist <= PORT_RADIUS + 6) {
            setDragMode('draw-connector');
            setConnectorDraft({ fromPort: port, mouseX: canvasX, mouseY: canvasY });
            return;
          }
        }
      }
    }

    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    for (const obj of sorted) {
      if (!obj.visible) continue;
      const { x, y, width: w, height: h } = obj.boundingBox;
      const cx = x + w / 2; const cy = y + h / 2;
      const dx = canvasX - cx; const dy = canvasY - cy;
      const [lx, ly] = rotatePoint(dx, dy, -obj.transform.rotation);
      if (lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2) {
        onSelect(obj.id);
        setDragMode('move');
        setDragStart({ x: clientX, y: clientY });
        const bb = obj.boundingBox;
        setElemStart({ x: bb.x, y: bb.y, w: bb.width, h: bb.height, scale: obj.transform.scaleX, rotation: obj.transform.rotation });
        return;
      }
    }
    onSelect(null);
  }, [getMouseCanvas, viewport, activeBrush, selectedId, elements, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { clientX, clientY, canvasX, canvasY } = getMouseCanvas(e);

    if (dragMode === 'pan') {
      setViewport((v) => ({ ...v, x: vpStart.x + (clientX - dragStart.x), y: vpStart.y + (clientY - dragStart.y) }));
      return;
    }

    if (dragMode === 'brush-path') {
      setBrushPath((prev) => [...prev, { x: canvasX, y: canvasY }]);
      return;
    }

    if (dragMode === 'draw-connector' && connectorDraft) {
      setConnectorDraft((d) => d ? { ...d, mouseX: canvasX, mouseY: canvasY } : d);
      triggerRedraw();
      return;
    }

    if (selectedId && elemStart) {
      const dx = (clientX - dragStart.x) / viewport.zoom;
      const dy = (clientY - dragStart.y) / viewport.zoom;
      const updated = elements.map((obj) => {
        if (obj.id !== selectedId) return obj;
        if (dragMode === 'move') {
          const newBB = { ...obj.boundingBox, x: elemStart.x + dx, y: elemStart.y + dy };
          const childrenUpdated = elements
            .filter((c) => c.groupId === obj.id)
            .map((child) => ({
              ...child,
              boundingBox: {
                ...child.boundingBox,
                x: child.boundingBox.x + dx,
                y: child.boundingBox.y + dy,
              },
            }));
          onUpdateElements([
            ...elements.filter((el) => el.id !== selectedId && el.groupId !== obj.id),
            { ...obj, boundingBox: newBB },
            ...childrenUpdated,
          ]);
          return obj;
        }
        if (dragMode === 'rotate') {
          const cx = elemStart.x + elemStart.w / 2;
          const cy = elemStart.y + elemStart.h / 2;
          const a0 = Math.atan2(dragStart.y / viewport.zoom + viewport.y / viewport.zoom - cy, dragStart.x / viewport.zoom + viewport.x / viewport.zoom - cx);
          const a1 = Math.atan2(clientY / viewport.zoom + viewport.y / viewport.zoom - cy, clientX / viewport.zoom + viewport.x / viewport.zoom - cx);
          let newRot = elemStart.rotation + ((a1 - a0) * 180) / Math.PI;
          if (e.shiftKey) newRot = Math.round(newRot / 15) * 15;
          return { ...obj, transform: { ...obj.transform, rotation: (newRot + 360) % 360 } };
        }
        if (dragMode && dragMode.startsWith('scale-')) {
          const cx = elemStart.x + elemStart.w / 2;
          const cy = elemStart.y + elemStart.h / 2;
          const d0 = Math.hypot(dragStart.x / viewport.zoom + viewport.x / viewport.zoom - cx, dragStart.y / viewport.zoom + viewport.y / viewport.zoom - cy);
          const d1 = Math.hypot(clientX / viewport.zoom + viewport.x / viewport.zoom - cx, clientY / viewport.zoom + viewport.y / viewport.zoom - cy);
          const factor = Math.max(0.05, d1 / Math.max(1, d0));
          const nw = Math.max(10, elemStart.w * factor);
          const nh = Math.max(10, elemStart.h * factor);
          return { ...obj, boundingBox: { x: cx - nw / 2, y: cy - nh / 2, width: nw, height: nh } };
        }
        return obj;
      });
      if (dragMode !== 'move') onUpdateElements(updated);
    }

    if (selectedId) {
      const obj = elements.find((el) => el.id === selectedId);
      if (obj) {
        const ports = getObjectPorts(obj);
        const hovered = ports.find((p) => Math.hypot(canvasX - p.x, canvasY - p.y) <= PORT_RADIUS + 6);
        setHoveredPort(hovered ?? null);
      }
    }
  }, [dragMode, vpStart, dragStart, viewport, connectorDraft, selectedId, elemStart, elements, triggerRedraw, onUpdateElements]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { canvasX, canvasY } = getMouseCanvas(e);

    if (dragMode === 'draw-connector' && connectorDraft) {
      const allPorts = elements.flatMap(getObjectPorts);
      const target = allPorts.find(
        (p) => p.objectId !== connectorDraft.fromPort.objectId && Math.hypot(canvasX - p.x, canvasY - p.y) <= PORT_RADIUS + 8
      );
      if (target) {
        const newConn: SmartConnector = {
          id: `conn_${Date.now()}`,
          fromObjectId: connectorDraft.fromPort.objectId,
          fromPortId: connectorDraft.fromPort.portId,
          toObjectId: target.objectId,
          toPortId: target.portId,
          color: '#3b82f6',
          strokeWidth: 2,
          arrowEnd: true,
          arrowStart: false,
          label: '',
        };
        onConnectorAdd(newConn);
      }
      setConnectorDraft(null);
    }

    if (dragMode === 'brush-path') setBrushActive(false);
    setDragMode(null);
    setElemStart(null);
  }, [dragMode, connectorDraft, getMouseCanvas, elements, onConnectorAdd]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setViewport((v) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      return {
        zoom: nz,
        x: mx - (mx - v.x) * (nz / v.zoom),
        y: my - (my - v.y) * (nz / v.zoom),
      };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      triggerRedraw();
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [triggerRedraw]);

  useImperativeHandle(ref, () => ({
    exportPNG: async (scale = 2) => {
      const src = canvasRef.current;
      if (!src) return '';
      const offscreen = document.createElement('canvas');
      offscreen.width = src.width * scale;
      offscreen.height = src.height * scale;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(src, 0, 0);
      return offscreen.toDataURL('image/png');
    },
    exportSVGString: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      const w = canvas.width; const h = canvas.height;
      const bodies = elements
        .filter((o) => o.visible)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((o) => {
          if (o.type === 'svg-asset' && o.svgRawContent) {
            const inner = o.svgRawContent.replace(/<svg[^>]*>|<\/svg>/gi, '').replace(/currentColor/g, o.modifications.globalFill.color);
            const t = o.transform;
            const cx = o.boundingBox.x + o.boundingBox.width / 2;
            const cy = o.boundingBox.y + o.boundingBox.height / 2;
            return `<g transform="translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY}) translate(${-o.boundingBox.width / 2},${-o.boundingBox.height / 2})">${inner}</g>`;
          }
          return '';
        })
        .filter(Boolean);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bodies.join('')}</svg>`;
    },
    getState: () => ({ metadata: { id: 'canvas', title: '', description: '', authorName: '', authorEmail: '', institution: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: '1.0.0', tags: [], exportedFormats: [], licenseType: 'CC-BY-4.0' }, viewport: { offsetX: viewport.x, offsetY: viewport.y, zoom: viewport.zoom, width: canvasRef.current?.width ?? 800, height: canvasRef.current?.height ?? 600 }, objects: elements, groups: [], backgroundColor: '#0b0f19', gridEnabled: true, gridSize: GRID, snapToGrid: false, rulerEnabled: false, selectedObjectIds: selectedId ? [selectedId] : [], activeGroupId: null, history: { undoStack: [], redoStack: [], maxStackSize: 100 } } as any),
    setState: () => {},
    centerViewport: () => setViewport({ x: 0, y: 0, zoom: 1 }),
    zoomTo: (level) => setViewport((v) => ({ ...v, zoom: level })),
  }));

  const cursorClass = dragMode === 'pan' ? 'cursor-grabbing' : activeBrush !== 'none' ? 'cursor-crosshair' : dragMode === 'move' ? 'cursor-move' : 'cursor-default';

  return (
    <div ref={wrapRef} className="relative flex-1 h-full overflow-hidden bg-[#0b0f19]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`absolute inset-0 w-full h-full ${cursorClass}`}
      />
      <svg
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 Z" fill="#3b82f6" />
          </marker>
        </defs>
        {connectors.map((conn) => {
          const fromObj = elements.find((el) => el.id === conn.fromObjectId);
          const toObj = elements.find((el) => el.id === conn.toObjectId);
          if (!fromObj || !toObj) return null;
          const fromPorts = getObjectPorts(fromObj);
          const toPorts = getObjectPorts(toObj);
          const fromPort = fromPorts.find((p) => p.portId === conn.fromPortId) ?? fromPorts[1];
          const toPort = toPorts.find((p) => p.portId === conn.toPortId) ?? toPorts[3];
          if (!fromPort || !toPort) return null;
          const fs = toScreen(fromPort.x, fromPort.y);
          const ts = toScreen(toPort.x, toPort.y);
          const fromSS = { x: fs.x, y: fs.y, side: fromPort.side, objectId: fromPort.objectId, portId: fromPort.portId };
          const toSS = { x: ts.x, y: ts.y, side: toPort.side, objectId: toPort.objectId, portId: toPort.portId };
          const BEND = 60 * viewport.zoom;
          const cp1x = fromSS.side === 'right' ? fromSS.x + BEND : fromSS.side === 'left' ? fromSS.x - BEND : fromSS.x;
          const cp1y = fromSS.side === 'bottom' ? fromSS.y + BEND : fromSS.side === 'top' ? fromSS.y - BEND : fromSS.y;
          const cp2x = toSS.side === 'left' ? toSS.x - BEND : toSS.side === 'right' ? toSS.x + BEND : toSS.x;
          const cp2y = toSS.side === 'top' ? toSS.y - BEND : toSS.side === 'bottom' ? toSS.y + BEND : toSS.y;
          const d = `M${fromSS.x},${fromSS.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${toSS.x},${toSS.y}`;
          return (
            <g key={conn.id}>
              <path d={d} fill="none" stroke={conn.color} strokeWidth={conn.strokeWidth} markerEnd={conn.arrowEnd ? 'url(#arrow-end)' : undefined} />
              {conn.label && (
                <text x={(fromSS.x + toSS.x) / 2} y={(fromSS.y + toSS.y) / 2 - 6} fill="#94a3b8" fontSize="11" textAnchor="middle">{conn.label}</text>
              )}
            </g>
          );
        })}
        {connectorDraft && (() => {
          const fs = toScreen(connectorDraft.fromPort.x, connectorDraft.fromPort.y);
          const ts = toScreen(connectorDraft.mouseX, connectorDraft.mouseY);
          return <line x1={fs.x} y1={fs.y} x2={ts.x} y2={ts.y} stroke="#10b981" strokeWidth="2" strokeDasharray="6,4" />;
        })()}
      </svg>
      <div className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] text-slate-500 select-none">
        <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
        <span>|</span>
        <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })} className="hover:text-slate-300 transition-colors">Reset</button>
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, v.zoom * 1.2) }))} className="hover:text-slate-300 transition-colors">+</button>
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(MIN_ZOOM, v.zoom / 1.2) }))} className="hover:text-slate-300 transition-colors">−</button>
      </div>
    </div>
  );
});

CanvasStage.displayName = 'CanvasStage';
