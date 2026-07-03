export class ChemVectorRenderer {
  public generateStructureFromNotation(notation: string): string {
    const normalized = notation.trim().toLowerCase();
    
    if (normalized === 'benzene' || normalized === 'c6h6' || normalized === 'cyclohexane') {
      const hasDoubleBonds = normalized === 'benzene' || normalized === 'c6h6';
      return this.drawHexagonRing(hasDoubleBonds);
    }

    throw new Error(`Unsupported notation: ${notation}`);
  }

  public drawHexagonRing(includeDoubleBonds: boolean): string {
    const radius = 50;
    const centerX = 50;
    const centerY = 50;
    const points: [number, number][] = [];

    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      points.push([
        centerX + radius * Math.cos(angle_rad),
        centerY + radius * Math.sin(angle_rad)
      ]);
    }

    const pathData = `M ${points[0][0]} ${points[0][1]} ` +
      points.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ') +
      ` Z`;

    let svg = `<path d="${pathData}" fill="none" stroke="currentColor" stroke-width="2" />`;

    if (includeDoubleBonds) {
      const innerRadius = 35;
      const innerPoints: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        innerPoints.push([
          centerX + innerRadius * Math.cos(angle_rad),
          centerY + innerRadius * Math.sin(angle_rad)
        ]);
      }
      
      const doubleBond1 = `M ${innerPoints[0][0]} ${innerPoints[0][1]} L ${innerPoints[1][0]} ${innerPoints[1][1]}`;
      const doubleBond2 = `M ${innerPoints[2][0]} ${innerPoints[2][1]} L ${innerPoints[3][0]} ${innerPoints[3][1]}`;
      const doubleBond3 = `M ${innerPoints[4][0]} ${innerPoints[4][1]} L ${innerPoints[5][0]} ${innerPoints[5][1]}`;
      
      svg += `<path d="${doubleBond1}" fill="none" stroke="currentColor" stroke-width="2" />`;
      svg += `<path d="${doubleBond2}" fill="none" stroke="currentColor" stroke-width="2" />`;
      svg += `<path d="${doubleBond3}" fill="none" stroke="currentColor" stroke-width="2" />`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${svg}</svg>`;
  }
}
