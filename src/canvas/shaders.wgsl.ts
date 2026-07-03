export const wgslShaders = `
struct TransformData {
  matrix_0: vec4<f32>,
  matrix_1: vec4<f32>,
  matrix_2: vec4<f32>,
  matrix_3: vec4<f32>,
  colorData: vec4<f32>,
};

struct Uniforms {
  projectionMatrix_0: vec4<f32>,
  projectionMatrix_1: vec4<f32>,
  projectionMatrix_2: vec4<f32>,
  projectionMatrix_3: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var<storage, read> transforms : array<TransformData>;

struct VertexInput {
  @location(0) position : vec2<f32>,
  @builtin(instance_index) instanceIdx : u32,
};

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragColor : vec4<f32>,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let transform = transforms[input.instanceIdx];
  
  let mat = mat4x4<f32>(
    transform.matrix_0,
    transform.matrix_1,
    transform.matrix_2,
    transform.matrix_3
  );

  let projMat = mat4x4<f32>(
    uniforms.projectionMatrix_0,
    uniforms.projectionMatrix_1,
    uniforms.projectionMatrix_2,
    uniforms.projectionMatrix_3
  );

  let worldPos = mat * vec4<f32>(input.position, 0.0, 1.0);
  output.Position = projMat * worldPos;
  output.fragColor = transform.colorData;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.fragColor;
}
`;
