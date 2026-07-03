import type { CanvasObject } from '../types/canvas';
import { createDefaultModifications, createDefaultTransform } from '../utils/canvasBackendEngine';

export interface AtomNode {
  element: string;
  x: number;
  y: number;
}

export interface BondConnection {
  fromIndex: number;
  toIndex: number;
  type: 'single' | 'double' | 'triple' | 'aromatic';
}

export class SmilesToVector {
  public static parseSmilesToCoordinates(smiles: string): { atoms: AtomNode[]; bonds: BondConnection[] } {
    const normalized = smiles.trim();
    if (normalized === 'C' || normalized.toLowerCase() === 'methane') {
      return {
        atoms: [{ element: 'C', x: 250, y: 250 }],
        bonds: []
      };
    }

    if (normalized === 'CC' || normalized.toLowerCase() === 'ethane') {
      return {
        atoms: [
          { element: 'C', x: 200, y: 250 },
          { element: 'C', x: 300, y: 250 }
        ],
        bonds: [{ fromIndex: 0, toIndex: 1, type: 'single' }]
      };
    }

    if (normalized === 'C=C' || normalized.toLowerCase() === 'ethene') {
      return {
        atoms: [
          { element: 'C', x: 200, y: 250 },
          { element: 'C', x: 300, y: 250 }
        ],
        bonds: [{ fromIndex: 0, toIndex: 1, type: 'double' }]
      };
    }

    if (normalized === 'C1=CC=CC=C1' || normalized.toLowerCase() === 'benzene') {
      const atoms: AtomNode[] = [];
      const bonds: BondConnection[] = [];
      const cx = 250;
      const cy = 250;
      const r = 50;
      for (let i = 0; i < 6; i++) {
        const rad = (Math.PI / 3) * i - Math.PI / 6;
        atoms.push({
          element: 'C',
          x: cx + r * Math.cos(rad),
          y: cy + r * Math.sin(rad)
        });
        bonds.push({
          fromIndex: i,
          toIndex: (i + 1) % 6,
          type: i % 2 === 0 ? 'double' : 'single'
        });
      }
      return { atoms, bonds };
    }

    const atoms: AtomNode[] = [];
    const bonds: BondConnection[] = [];
    const elements = normalized.match(/C|O|N|Cl|Br|F|S|P/g) || ['C'];
    elements.forEach((el, i) => {
      atoms.push({
        element: el,
        x: 150 + i * 60,
        y: 250 + (i % 2 === 0 ? 20 : -20)
      });
      if (i > 0) {
        bonds.push({
          fromIndex: i - 1,
          toIndex: i,
          type: 'single'
        });
      }
    });

    return { atoms, bonds };
  }

  public static generateChemObjects(smiles: string): Omit<CanvasObject, 'id'>[] {
    const { atoms, bonds } = this.parseSmilesToCoordinates(smiles);
    const objects: Omit<CanvasObject, 'id'>[] = [];
    const now = new Date().toISOString();

    atoms.forEach((atom, index) => {
      objects.push({
        type: 'text-block',
        assetId: null,
        assetPath: null,
        svgRawContent: null,
        label: `Atom_${atom.element}_${index}`,
        category: 'Molecular Biology',
        boundingBox: {
          x: atom.x - 12,
          y: atom.y - 12,
          width: 24,
          height: 24
        },
        transform: createDefaultTransform(),
        modifications: createDefaultModifications(),
        textLayout: {
          content: atom.element,
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 700,
          fontStyle: 'normal',
          textAlign: 'center',
          textDecoration: 'none',
          lineHeight: 1.2,
          letterSpacing: 0,
          color: atom.element === 'O' ? '#ef4444' : atom.element === 'N' ? '#3b82f6' : '#f8fafc',
          backgroundColor: '#0b0f19',
          padding: { top: 2, right: 2, bottom: 2, left: 2 },
          borderRadius: 4
        },
        primitiveParams: null,
        zIndex: index + 10,
        locked: false,
        visible: true,
        groupId: 'chem_group',
        createdAt: now,
        updatedAt: now
      });
    });

    bonds.forEach((bond, index) => {
      const fromAtom = atoms[bond.fromIndex];
      const toAtom = atoms[bond.toIndex];
      
      const minX = Math.min(fromAtom.x, toAtom.x);
      const minY = Math.min(fromAtom.y, toAtom.y);
      const w = Math.max(8, Math.abs(fromAtom.x - toAtom.x));
      const h = Math.max(8, Math.abs(fromAtom.y - toAtom.y));

      let pathData = `M ${fromAtom.x} ${fromAtom.y} L ${toAtom.x} ${toAtom.y}`;
      if (bond.type === 'double') {
        const dx = toAtom.x - fromAtom.x;
        const dy = toAtom.y - fromAtom.y;
        const len = Math.hypot(dx, dy);
        const ox = (-dy / len) * 4;
        const oy = (dx / len) * 4;
        pathData = `M ${fromAtom.x - ox} ${fromAtom.y - oy} L ${toAtom.x - ox} ${toAtom.y - oy} M ${fromAtom.x + ox} ${fromAtom.y + oy} L ${toAtom.x + ox} ${toAtom.y + oy}`;
      }

      objects.push({
        type: 'primitive-rect',
        assetId: null,
        assetPath: null,
        svgRawContent: `<path d="${pathData}" fill="none" stroke="#f8fafc" stroke-width="2.5" />`,
        label: `${bond.type.toUpperCase()}_BOND_${index}`,
        category: 'Molecular Biology',
        boundingBox: { x: minX, y: minY, width: w, height: h },
        transform: createDefaultTransform(),
        modifications: createDefaultModifications(),
        textLayout: null,
        primitiveParams: null,
        zIndex: index + 1,
        locked: false,
        visible: true,
        groupId: 'chem_group',
        createdAt: now,
        updatedAt: now
      });
    });

    return objects;
  }
}
