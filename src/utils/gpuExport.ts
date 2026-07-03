import { WebGPURenderEngine } from '../canvas/webgpuRenderEngine';

export async function exportWebGPUCanvas(
  engine: WebGPURenderEngine,
  width: number,
  height: number,
  filename: string,
  citationText: string
): Promise<void> {
  const { device, context } = engine;
  if (!device || !context) throw new Error('WebGPU engine is not initialized');

  const texture = context.getCurrentTexture();
  const bytesPerPixel = 4;
  const rowAlignment = 256;
  const unalignedBytesPerRow = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(unalignedBytesPerRow / rowAlignment) * rowAlignment;
  const bufferSize = bytesPerRow * height;

  const readBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyTextureToBuffer(
    { texture },
    { buffer: readBuffer, bytesPerRow },
    { width, height }
  );

  device.queue.submit([commandEncoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  const pixelData = new Uint8ClampedArray(arrayBuffer.slice(0));
  readBuffer.unmap();

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D fallback failed');

  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const srcOffset = y * bytesPerRow;
    const destOffset = y * width * bytesPerPixel;
    imageData.data.set(
      pixelData.subarray(srcOffset, srcOffset + unalignedBytesPerRow),
      destOffset
    );
  }
  ctx.putImageData(imageData, 0, 0);

  if (citationText) {
    ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
    ctx.fillRect(0, height - 30, width, 30);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(citationText, 15, height - 12);
  }

  tempCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
