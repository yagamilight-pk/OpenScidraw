import { wgslShaders } from './shaders.wgsl';

export class WebGPURenderEngine {
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public format: GPUTextureFormat | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private storageBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private bindGroup0: GPUBindGroup | null = null;
  private bindGroup1: GPUBindGroup | null = null;

  private maxInstances = 150000;
  private transformDataSize = 16 * 4 + 4 * 4;

  public async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported in this browser.');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn('No appropriate GPU adapter found.');
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!this.context) return false;

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    const shaderModule = this.device.createShaderModule({ code: wgslShaders });

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat }]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }]
      },
      primitive: { topology: 'triangle-list' }
    });

    this.uniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.storageBuffer = this.device.createBuffer({
      size: this.maxInstances * this.transformDataSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup0 = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
    });

    this.bindGroup1 = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: this.storageBuffer } }]
    });

    const vertices = new Float32Array([
      0, 0,  1, 0,  0, 1,
      0, 1,  1, 0,  1, 1
    ]);
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    return true;
  }

  public updateUniforms(projMatrix: Float32Array): void {
    if (!this.device || !this.uniformBuffer) return;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, projMatrix);
  }

  public updateInstanceData(instanceData: Float32Array, count: number): void {
    if (!this.device || !this.storageBuffer) return;
    const byteLength = count * this.transformDataSize;
    if (byteLength > this.storageBuffer.size) return;
    this.device.queue.writeBuffer(this.storageBuffer, 0, instanceData, 0, count * 20);
  }

  public render(instanceCount: number): void {
    if (!this.device || !this.context || !this.pipeline || !this.vertexBuffer || !this.bindGroup0 || !this.bindGroup1) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.043, g: 0.058, b: 0.098, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup0);
    passEncoder.setBindGroup(1, this.bindGroup1);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(6, instanceCount, 0, 0);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
