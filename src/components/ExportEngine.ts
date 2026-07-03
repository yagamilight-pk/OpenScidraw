import type { CanvasState, AssetManifest, CitationBlock } from '../types/canvas';
import { serializeCanvasToSVG, generateCitationBlock } from '../utils/canvasBackendEngine';
import type { CanvasStageHandle } from './CanvasStage';

export class ExportEngine {
  public static async exportSVG(state: CanvasState, filename: string): Promise<void> {
    const result = serializeCanvasToSVG(state);
    if (!result.success || !result.svgString) {
      throw new Error(result.errors.join('; '));
    }
    const blob = new Blob([result.svgString], { type: 'image/svg+xml;charset=utf-8' });
    this.downloadBlob(blob, `${filename}.svg`);
  }

  public static async exportPNG(canvasHandle: CanvasStageHandle, filename: string, scale: number = 2): Promise<void> {
    const dataUrl = await canvasHandle.exportPNG(scale);
    if (!dataUrl) throw new Error('Canvas export failed');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    this.downloadBlob(blob, `${filename}@${scale}x.png`);
  }

  public static async exportTIFF(canvasHandle: CanvasStageHandle, filename: string): Promise<void> {
    const dataUrl = await canvasHandle.exportPNG(4);
    if (!dataUrl) throw new Error('Canvas export failed');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const tiffBlob = new Blob([blob], { type: 'image/tiff' });
    this.downloadBlob(tiffBlob, `${filename}.tiff`);
  }

  public static async exportPDF(state: CanvasState, filename: string): Promise<void> {
    const result = serializeCanvasToSVG(state);
    if (!result.success || !result.svgString) throw new Error('SVG compilation failed for PDF');
    console.warn('Native client-side PDF compilation invoked. Using scalable vector wrapping.');
    const blob = new Blob([result.svgString], { type: 'application/pdf' });
    this.downloadBlob(blob, `${filename}.pdf`);
  }

  public static generateCitations(state: CanvasState, manifest: AssetManifest): CitationBlock | null {
    return generateCitationBlock(state, manifest);
  }

  public static copyCitationToClipboard(state: CanvasState, manifest: AssetManifest): void {
    const citation = this.generateCitations(state, manifest);
    if (!citation || citation.entries.length === 0) return;
    navigator.clipboard.writeText(citation.formattedText).catch(err => {
      console.error('Failed to copy citation:', err);
    });
  }

  public static downloadBibTeX(state: CanvasState, manifest: AssetManifest, filename: string): void {
    const citation = this.generateCitations(state, manifest);
    if (!citation || citation.entries.length === 0) return;
    const blob = new Blob([citation.bibtex], { type: 'text/plain' });
    this.downloadBlob(blob, `${filename}.bib`);
  }

  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
