import type { BoundingBox } from '../types/canvas';

export interface AnchorPort {
  objectId: string;
  portId: string;
  x: number;
  y: number;
  side: 'top' | 'right' | 'bottom' | 'left';
}

export interface ConnectorLine {
  id: string;
  fromObjectId: string;
  fromPortId: string;
  toObjectId: string;
  toPortId: string;
  points: { x: number, y: number }[];
}

export class ConnectorMatrix {
  private anchorPorts: Map<string, AnchorPort[]> = new Map();

  public registerObjectPorts(objectId: string, bbox: BoundingBox): void {
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    this.anchorPorts.set(objectId, [
      { objectId, portId: 'top', x: cx, y: bbox.y, side: 'top' },
      { objectId, portId: 'right', x: bbox.x + bbox.width, y: cy, side: 'right' },
      { objectId, portId: 'bottom', x: cx, y: bbox.y + bbox.height, side: 'bottom' },
      { objectId, portId: 'left', x: bbox.x, y: cy, side: 'left' }
    ]);
  }

  public getObjectPorts(objectId: string): AnchorPort[] {
    return this.anchorPorts.get(objectId) || [];
  }

  public calculateConnectorPath(fromObj: string, fromPortId: string, toObj: string, toPortId: string): { x: number, y: number }[] {
    const fromPorts = this.getObjectPorts(fromObj);
    const toPorts = this.getObjectPorts(toObj);
    const p1 = fromPorts.find(p => p.portId === fromPortId);
    const p2 = toPorts.find(p => p.portId === toPortId);

    if (!p1 || !p2) return [];

    const bend = 40;
    const cp1x = p1.side === 'right' ? p1.x + bend : p1.side === 'left' ? p1.x - bend : p1.x;
    const cp1y = p1.side === 'bottom' ? p1.y + bend : p1.side === 'top' ? p1.y - bend : p1.y;
    const cp2x = p2.side === 'left' ? p2.x - bend : p2.side === 'right' ? p2.x + bend : p2.x;
    const cp2y = p2.side === 'top' ? p2.y - bend : p2.side === 'bottom' ? p2.y + bend : p2.y;

    return [
      { x: p1.x, y: p1.y },
      { x: cp1x, y: cp1y },
      { x: cp2x, y: cp2y },
      { x: p2.x, y: p2.y }
    ];
  }

  public buildPathString(points: { x: number, y: number }[]): string {
    if (points.length !== 4) return '';
    return `M${points[0].x},${points[0].y} C${points[1].x},${points[1].y} ${points[2].x},${points[2].y} ${points[3].x},${points[3].y}`;
  }
}
