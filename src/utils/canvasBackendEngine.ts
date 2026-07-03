import type {
  CanvasState,
  CanvasObject,
  AssetManifest,
  AssetManifestEntry,
  ValidationResult,
  ValidationError,
  SerializedSVGResult,
  CitationBlock,
  CitationEntry,
  TransformMatrix,
  CustomModifications,
} from '../types/canvas';

const SCHEMA_VERSION = '1.0.0';
const REQUIRED_OBJECT_FIELDS: (keyof CanvasObject)[] = [
  'id', 'type', 'label', 'boundingBox', 'transform', 'modifications', 'zIndex',
];
const VALID_OBJECT_TYPES: CanvasObject['type'][] = [
  'svg-asset', 'primitive-rect', 'primitive-circle', 'primitive-triangle', 'text-block',
];


function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateBoundingBox(bb: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(bb)) {
    return [{ field: path, message: 'Must be an object', receivedValue: bb, expectedType: 'BoundingBox' }];
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof bb[key] !== 'number') {
      errors.push({ field: `${path}.${key}`, message: 'Must be a number', receivedValue: bb[key], expectedType: 'number' });
    }
  }
  if (typeof bb['width'] === 'number' && (bb['width'] as number) < 0) {
    errors.push({ field: `${path}.width`, message: 'Must be non-negative', receivedValue: bb['width'], expectedType: 'number >= 0' });
  }
  if (typeof bb['height'] === 'number' && (bb['height'] as number) < 0) {
    errors.push({ field: `${path}.height`, message: 'Must be non-negative', receivedValue: bb['height'], expectedType: 'number >= 0' });
  }
  return errors;
}

function validateTransform(t: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(t)) {
    return [{ field: path, message: 'Must be an object', receivedValue: t, expectedType: 'TransformMatrix' }];
  }
  for (const key of ['scaleX', 'scaleY', 'rotation', 'translateX', 'translateY', 'skewX', 'skewY'] as const) {
    if (typeof t[key] !== 'number') {
      errors.push({ field: `${path}.${key}`, message: 'Must be a number', receivedValue: t[key], expectedType: 'number' });
    }
  }
  for (const key of ['flipHorizontal', 'flipVertical'] as const) {
    if (typeof t[key] !== 'boolean') {
      errors.push({ field: `${path}.${key}`, message: 'Must be a boolean', receivedValue: t[key], expectedType: 'boolean' });
    }
  }
  return errors;
}

function validateModifications(m: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(m)) {
    return [{ field: path, message: 'Must be an object', receivedValue: m, expectedType: 'CustomModifications' }];
  }
  if (!Array.isArray(m['colorOverrides'])) {
    errors.push({ field: `${path}.colorOverrides`, message: 'Must be an array', receivedValue: m['colorOverrides'], expectedType: 'ColorModification[]' });
  }
  if (typeof m['globalOpacity'] !== 'number' || (m['globalOpacity'] as number) < 0 || (m['globalOpacity'] as number) > 1) {
    errors.push({ field: `${path}.globalOpacity`, message: 'Must be a number between 0 and 1', receivedValue: m['globalOpacity'], expectedType: 'number 0-1' });
  }
  return errors;
}

function validateCanvasObject(obj: unknown, idx: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `objects[${idx}]`;
  if (!isRecord(obj)) {
    return [{ field: path, message: 'Must be an object', receivedValue: obj, expectedType: 'CanvasObject' }];
  }
  for (const field of REQUIRED_OBJECT_FIELDS) {
    if (obj[field] === undefined || obj[field] === null) {
      errors.push({ field: `${path}.${field}`, message: 'Required field is missing', receivedValue: obj[field], expectedType: 'any non-null' });
    }
  }
  if (typeof obj['id'] !== 'string' || (obj['id'] as string).trim() === '') {
    errors.push({ field: `${path}.id`, message: 'Must be a non-empty string', receivedValue: obj['id'], expectedType: 'string' });
  }
  if (!VALID_OBJECT_TYPES.includes(obj['type'] as CanvasObject['type'])) {
    errors.push({ field: `${path}.type`, message: `Must be one of: ${VALID_OBJECT_TYPES.join(', ')}`, receivedValue: obj['type'], expectedType: 'CanvasObjectType' });
  }
  if (typeof obj['zIndex'] !== 'number') {
    errors.push({ field: `${path}.zIndex`, message: 'Must be a number', receivedValue: obj['zIndex'], expectedType: 'number' });
  }
  if (typeof obj['locked'] !== 'boolean') {
    errors.push({ field: `${path}.locked`, message: 'Must be a boolean', receivedValue: obj['locked'], expectedType: 'boolean' });
  }
  if (typeof obj['visible'] !== 'boolean') {
    errors.push({ field: `${path}.visible`, message: 'Must be a boolean', receivedValue: obj['visible'], expectedType: 'boolean' });
  }
  errors.push(...validateBoundingBox(obj['boundingBox'], `${path}.boundingBox`));
  errors.push(...validateTransform(obj['transform'], `${path}.transform`));
  errors.push(...validateModifications(obj['modifications'], `${path}.modifications`));
  return errors;
}

export function validateCanvasState(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'CanvasState must be an object', receivedValue: raw, expectedType: 'CanvasState' }],
      warnings: [],
    };
  }

  if (!isRecord(raw['metadata'])) {
    errors.push({ field: 'metadata', message: 'metadata must be an object', receivedValue: raw['metadata'], expectedType: 'CanvasMetadata' });
  } else {
    const meta = raw['metadata'] as Record<string, unknown>;
    if (typeof meta['id'] !== 'string') errors.push({ field: 'metadata.id', message: 'Must be string', receivedValue: meta['id'], expectedType: 'string' });
    if (typeof meta['title'] !== 'string') errors.push({ field: 'metadata.title', message: 'Must be string', receivedValue: meta['title'], expectedType: 'string' });
    if (typeof meta['schemaVersion'] !== 'string') {
      errors.push({ field: 'metadata.schemaVersion', message: 'Must be string', receivedValue: meta['schemaVersion'], expectedType: 'string' });
    } else if (meta['schemaVersion'] !== SCHEMA_VERSION) {
      warnings.push(`Schema version mismatch: expected ${SCHEMA_VERSION}, got ${meta['schemaVersion']}`);
    }
  }

  if (!isRecord(raw['viewport'])) {
    errors.push({ field: 'viewport', message: 'viewport must be an object', receivedValue: raw['viewport'], expectedType: 'CanvasViewport' });
  }

  if (!Array.isArray(raw['objects'])) {
    errors.push({ field: 'objects', message: 'objects must be an array', receivedValue: raw['objects'], expectedType: 'CanvasObject[]' });
  } else {
    const ids = new Set<string>();
    (raw['objects'] as unknown[]).forEach((obj, idx) => {
      errors.push(...validateCanvasObject(obj, idx));
      if (isRecord(obj) && typeof obj['id'] === 'string') {
        if (ids.has(obj['id'] as string)) {
          errors.push({ field: `objects[${idx}].id`, message: `Duplicate ID detected: ${obj['id']}`, receivedValue: obj['id'], expectedType: 'unique string' });
        }
        ids.add(obj['id'] as string);
      }
    });
  }

  if (!Array.isArray(raw['groups'])) {
    warnings.push('groups field missing or not an array; treating as empty');
  }

  if (typeof raw['backgroundColor'] !== 'string') {
    warnings.push('backgroundColor missing; will use default');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function buildCSSFilter(obj: CanvasObject): string {
  const f = obj.modifications.filters;
  const parts: string[] = [];
  if (f.grayscale) parts.push(`grayscale(${f.grayscale})`);
  if (f.brightness !== undefined && f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== undefined && f.contrast !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturate !== undefined && f.saturate !== 1) parts.push(`saturate(${f.saturate})`);
  if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.join(' ');
}

function buildTransformAttr(obj: CanvasObject): string {
  const t = obj.transform;
  const parts: string[] = [];
  parts.push(`translate(${obj.boundingBox.x + obj.boundingBox.width / 2},${obj.boundingBox.y + obj.boundingBox.height / 2})`);
  parts.push(`rotate(${t.rotation})`);
  const sx = t.scaleX * (t.flipHorizontal ? -1 : 1);
  const sy = t.scaleY * (t.flipVertical ? -1 : 1);
  parts.push(`scale(${sx},${sy})`);
  if (t.skewX || t.skewY) parts.push(`skewX(${t.skewX}) skewY(${t.skewY})`);
  parts.push(`translate(${-obj.boundingBox.width / 2},${-obj.boundingBox.height / 2})`);
  return parts.join(' ');
}

function applyColorOverrides(svgContent: string, obj: CanvasObject): string {
  let result = svgContent;
  result = result.replace(/currentColor/g, obj.modifications.globalFill.color || 'currentColor');
  for (const override of obj.modifications.colorOverrides) {
    const hookPattern = new RegExp(
      `(data-osd-hook="${escapeRegex(override.dataHookId)}"[^>]*?)\\s(?:fill|stroke)="[^"]*"`,
      'g'
    );
    result = result.replace(hookPattern, (match) => {
      if (override.targetAttribute === 'fill' || override.targetAttribute === 'both') {
        match = match.replace(/fill="[^"]*"/, `fill="${override.overrideValue}"`);
      }
      if (override.targetAttribute === 'stroke' || override.targetAttribute === 'both') {
        match = match.replace(/stroke="[^"]*"/, `stroke="${override.overrideValue}"`);
      }
      return match;
    });
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializePrimitive(obj: CanvasObject): string {
  const { boundingBox: bb, modifications: mod } = obj;
  const fill = mod.globalFill.color;
  const stroke = mod.globalStroke.color;
  const sw = mod.globalStroke.width;
  const opacity = mod.globalOpacity;
  const transform = buildTransformAttr(obj);
  const base = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" transform="${transform}"`;

  if (obj.type === 'primitive-rect') {
    const r = obj.primitiveParams?.rect?.cornerRadius ?? 0;
    return `<rect x="0" y="0" width="${bb.width}" height="${bb.height}" rx="${r}" ry="${r}" ${base} />`;
  }
  if (obj.type === 'primitive-circle') {
    const rx = obj.primitiveParams?.circle?.radiusX ?? bb.width / 2;
    const ry = obj.primitiveParams?.circle?.radiusY ?? bb.height / 2;
    return `<ellipse cx="${bb.width / 2}" cy="${bb.height / 2}" rx="${rx}" ry="${ry}" ${base} />`;
  }
  if (obj.type === 'primitive-triangle') {
    const p = obj.primitiveParams?.triangle;
    if (p) {
      return `<polygon points="${p.pointA.x},${p.pointA.y} ${p.pointB.x},${p.pointB.y} ${p.pointC.x},${p.pointC.y}" ${base} />`;
    }
    return `<polygon points="${bb.width / 2},0 ${bb.width},${bb.height} 0,${bb.height}" ${base} />`;
  }
  return '';
}

function serializeTextBlock(obj: CanvasObject): string {
  const tl = obj.textLayout;
  if (!tl) return '';
  const { boundingBox: bb } = obj;
  const transform = buildTransformAttr(obj);
  const opacity = obj.modifications.globalOpacity;
  const bg = tl.backgroundColor !== 'transparent' && tl.backgroundColor !== ''
    ? `<rect x="0" y="0" width="${bb.width}" height="${bb.height}" fill="${tl.backgroundColor}" rx="${tl.borderRadius}" />`
    : '';
  const anchor = tl.textAlign === 'center' ? 'middle' : tl.textAlign === 'right' ? 'end' : 'start';
  const tx = tl.textAlign === 'center' ? bb.width / 2 : tl.textAlign === 'right' ? bb.width - tl.padding.right : tl.padding.left;
  return [
    `<g transform="${transform}" opacity="${opacity}">`,
    bg,
    `  <text x="${tx}" y="${tl.padding.top + tl.fontSize}"`,
    `    font-family="${tl.fontFamily}" font-size="${tl.fontSize}" font-weight="${tl.fontWeight}"`,
    `    font-style="${tl.fontStyle}" text-anchor="${anchor}"`,
    `    fill="${tl.color}" text-decoration="${tl.textDecoration}"`,
    `    letter-spacing="${tl.letterSpacing}">`,
    `    <![CDATA[${tl.content}]]>`,
    `  </text>`,
    `</g>`,
  ].join('\n');
}

function serializeSVGAsset(obj: CanvasObject): string {
  if (!obj.svgRawContent) return `<!-- asset ${obj.id} has no SVG content -->`;
  const inner = obj.svgRawContent
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<svg([^>]*)>/i, '')
    .replace(/<\/svg>/i, '')
    .trim();

  const colored = applyColorOverrides(inner, obj);
  const transform = buildTransformAttr(obj);
  const opacity = obj.modifications.globalOpacity;
  const filter = buildCSSFilter(obj);
  const filterAttr = filter ? ` style="filter:${filter}"` : '';
  const shadow = obj.modifications.dropShadow;
  let filterDef = '';
  let filterRef = '';
  if (shadow.enabled) {
    const filterId = `shadow_${obj.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    filterDef = [
      `<defs>`,
      `  <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">`,
      `    <feDropShadow dx="${shadow.offsetX}" dy="${shadow.offsetY}" stdDeviation="${shadow.blur}"`,
      `      flood-color="${shadow.color}" flood-opacity="${shadow.opacity}" />`,
      `  </filter>`,
      `</defs>`,
    ].join('\n');
    filterRef = ` filter="url(#${filterId})"`;
  }
  return [
    filterDef,
    `<g id="${obj.id}" transform="${transform}" opacity="${opacity}"${filterRef}${filterAttr}>`,
    colored,
    `</g>`,
  ].filter(Boolean).join('\n');
}

export function serializeCanvasToSVG(state: CanvasState): SerializedSVGResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validation = validateCanvasState(state);
  if (!validation.valid) {
    return {
      success: false,
      svgString: null,
      errors: validation.errors.map((e) => `${e.field}: ${e.message}`),
      warnings: validation.warnings,
      width: 0,
      height: 0,
      objectCount: 0,
    };
  }
  warnings.push(...validation.warnings);

  const vp = state.viewport;
  const width = vp.width || 800;
  const height = vp.height || 600;
  const bg = state.backgroundColor || '#ffffff';

  const sorted = [...state.objects]
    .filter((o) => o.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  const defs: string[] = [];
  const bodies: string[] = [];

  for (const obj of sorted) {
    try {
      let node = '';
      if (obj.type === 'svg-asset') {
        node = serializeSVGAsset(obj);
      } else if (obj.type === 'text-block') {
        node = serializeTextBlock(obj);
      } else {
        node = serializePrimitive(obj);
      }
      if (node) bodies.push(node);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to serialize object ${obj.id}: ${msg}`);
      warnings.push(`Object ${obj.id} was skipped due to serialization error`);
    }
  }

  const svgLines = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `  viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`,
    `  data-osd-version="${SCHEMA_VERSION}" data-figure-id="${state.metadata.id}">`,
    defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '',
    `  <rect width="${width}" height="${height}" fill="${bg}" id="canvas-background" />`,
    ...bodies,
    `</svg>`,
  ].filter(Boolean);

  return {
    success: errors.length === 0,
    svgString: svgLines.join('\n'),
    errors,
    warnings,
    width,
    height,
    objectCount: sorted.length,
  };
}

export function generateCitationBlock(
  state: CanvasState,
  manifest: AssetManifest
): CitationBlock {
  const manifestMap = new Map<string, AssetManifestEntry>(
    manifest.assets.map((a) => [a.id, a])
  );

  const aggregated = new Map<string, CitationEntry>();

  for (const obj of state.objects) {
    if (!obj.visible || !obj.assetId) continue;
    const entry = manifestMap.get(obj.assetId);
    if (!entry) continue;

    const key = `${entry.attribution.source}__${entry.attribution.license}`;
    if (aggregated.has(key)) {
      aggregated.get(key)!.instanceCount += 1;
    } else {
      aggregated.set(key, {
        assetId: entry.id,
        assetName: entry.name,
        source: entry.attribution.source,
        author: entry.attribution.author,
        license: entry.attribution.license,
        licenseUrl: entry.attribution.licenseUrl,
        originalUrl: entry.attribution.originalUrl,
        instanceCount: 1,
      });
    }
  }

  const entries = Array.from(aggregated.values());
  const figureTitle = state.metadata.title || 'Untitled Figure';
  const year = new Date().getFullYear();

  const textLines: string[] = [
    `Figure: "${figureTitle}"`,
    ``,
    `This figure was created using OpenSciDraw (https://github.com/openscidraw/openscidraw).`,
    `The following third-party vector assets were used and are hereby attributed per their respective licenses:`,
    ``,
  ];

  const bibtexEntries: string[] = [];

  entries.forEach((entry, idx) => {
    const count = entry.instanceCount;
    const plural = count > 1 ? `s` : ``;
    textLines.push(
      `[${idx + 1}] ${entry.source}. "${entry.assetName}" (${count} instance${plural} used).`
    );
    textLines.push(`    Author/Publisher: ${entry.author}`);
    textLines.push(`    License: ${entry.license} — ${entry.licenseUrl}`);
    textLines.push(`    Source URL: ${entry.originalUrl}`);
    textLines.push(``);

    const citeKey = `${entry.source.replace(/\s+/g, '').toLowerCase()}${year}`;
    bibtexEntries.push(
      [
        `@misc{${citeKey}_${idx + 1},`,
        `  title        = {${entry.assetName}},`,
        `  author       = {${entry.author}},`,
        `  howpublished = {\\url{${entry.originalUrl}}},`,
        `  note         = {License: ${entry.license}. Accessed ${new Date().toISOString().split('T')[0]}},`,
        `  year         = {${year}},`,
        `}`,
      ].join('\n')
    );
  });

  if (entries.length === 0) {
    textLines.push('No third-party assets were used in this figure.');
  }

  textLines.push(
    `OpenSciDraw is free and open-source software distributed under the MIT License.`
  );

  return {
    generatedAt: new Date().toISOString(),
    figureTitle,
    entries,
    formattedText: textLines.join('\n'),
    bibtex: bibtexEntries.join('\n\n'),
  };
}

export function createDefaultTransform(): TransformMatrix {
  return {
    scaleX: 1, scaleY: 1, rotation: 0,
    translateX: 0, translateY: 0,
    skewX: 0, skewY: 0,
    flipHorizontal: false, flipVertical: false,
  };
}

export function createDefaultModifications(): CustomModifications {
  return {
    colorOverrides: [],
    globalFill: { color: 'currentColor', opacity: 1, rule: 'nonzero' },
    globalStroke: {
      color: 'none', width: 0, dashArray: 'none', dashOffset: 0,
      lineCap: 'round', lineJoin: 'round', miterLimit: 4, opacity: 1,
    },
    globalOpacity: 1,
    blendMode: 'normal',
    dropShadow: { enabled: false, offsetX: 2, offsetY: 2, blur: 4, color: '#000000', opacity: 0.3 },
    filters: { grayscale: 0, brightness: 1, contrast: 1, saturate: 1, hueRotate: 0, blur: 0 },
  };
}

export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPNG(svgString: string, filename: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const w = parseInt(svgEl.getAttribute('width') ?? '800', 10) * scale;
    const h = parseInt(svgEl.getAttribute('height') ?? '600', 10) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Failed to get 2D context'));
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return reject(new Error('Canvas toBlob failed'));
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(b);
        a.href = objUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image load failed'));
    };
    img.src = url;
  });
}
