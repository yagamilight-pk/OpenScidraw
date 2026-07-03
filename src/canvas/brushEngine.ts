export interface PathPoint {
  x: number;
  y: number;
}

export interface RenderedBrushUnit {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  svgData: string;
}

export class VectorBrushEngine {
  public calculateArcLengths(points: PathPoint[]): { lengths: number[], totalLength: number } {
    const lengths: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalLength += Math.hypot(dx, dy);
      lengths.push(totalLength);
    }
    return { lengths, totalLength };
  }

  public getPointAtLength(points: PathPoint[], lengths: number[], length: number): { x: number, y: number, angle: number } | null {
    if (points.length < 2) return null;
    if (length <= 0) {
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      return { x: points[0].x, y: points[0].y, angle: Math.atan2(dy, dx) };
    }
    const totalLength = lengths[lengths.length - 1];
    if (length >= totalLength) {
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      return { x: p2.x, y: p2.y, angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) };
    }

    let low = 0;
    let high = lengths.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lengths[mid] < length) {
        low = mid + 1;
      } else if (lengths[mid] > length) {
        high = mid - 1;
      } else {
        low = mid;
        break;
      }
    }

    const idx = Math.max(0, low - 1);
    const p1 = points[idx];
    const p2 = points[idx + 1];
    const segLen = lengths[idx + 1] - lengths[idx];
    const t = segLen > 0 ? (length - lengths[idx]) / segLen : 0;
    const x = p1.x + t * (p2.x - p1.x);
    const y = p1.y + t * (p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    return { x, y, angle };
  }

  public tileAssetAlongPath(points: PathPoint[], spacing: number, scale: number, svgData: string): RenderedBrushUnit[] {
    const units: RenderedBrushUnit[] = [];
    const { lengths, totalLength } = this.calculateArcLengths(points);
    if (totalLength === 0 || spacing <= 0) return units;

    for (let l = 0; l <= totalLength; l += spacing) {
      const pt = this.getPointAtLength(points, lengths, l);
      if (pt) {
        units.push({
          x: pt.x,
          y: pt.y,
          rotation: pt.angle,
          scale,
          svgData
        });
      }
    }
    return units;
  }
}
