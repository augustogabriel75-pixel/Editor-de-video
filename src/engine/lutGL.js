/**
 * Aplica LUTs 3D na GPU (WebGL2, textura 3D com interpolação trilinear).
 * Sem WebGL2, cai para a CPU (mais lento, mas o resultado é o mesmo).
 */
import { applyLutToImageData } from '../lib/luts';

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D img;
uniform sampler3D lut;
uniform float size;
uniform float amount;
in vec2 uv;
out vec4 color;
void main() {
  vec4 c = texture(img, uv);
  if (c.a <= 0.0) { color = vec4(0.0); return; }
  vec3 rgb = c.rgb / c.a; // a textura vem pré-multiplicada
  vec3 coord = rgb * ((size - 1.0) / size) + 0.5 / size; // centro dos texels
  vec3 graded = texture(lut, coord).rgb;
  vec3 outc = mix(rgb, graded, amount);
  color = vec4(outc * c.a, c.a);
}`;

let state; // { gl, canvas, prog, imgTex, lutTex, lutKey, loc } | null (sem WebGL2)

function toHalf(v) {
  // float32 -> float16 (para RGBA16F, que tem filtragem linear em todo WebGL2)
  const f = new Float32Array([v]);
  const x = new Uint32Array(f.buffer)[0];
  const sign = (x >> 16) & 0x8000;
  let e = ((x >> 23) & 0xff) - 127 + 15;
  let m = x & 0x7fffff;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7c00;
  return sign | (e << 10) | (m >> 13);
}

function init() {
  if (state !== undefined) return state;
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(2, 2) : document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return (state = null);
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    const imgTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const lutTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, lutTex);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'lut'), 1);
    const loc = { size: gl.getUniformLocation(prog, 'size'), amount: gl.getUniformLocation(prog, 'amount') };
    canvas.addEventListener?.('webglcontextlost', () => (state = undefined));
    state = { gl, canvas, prog, imgTex, lutTex, lutKey: null, loc };
  } catch (e) {
    console.warn('LUT na GPU indisponível, usando CPU', e);
    state = null;
  }
  return state;
}

function uploadLut(s, lut) {
  const key = `${lut.id}:${lut.size}:${lut.data.length}`;
  if (s.lutKey === key) return;
  const { gl } = s;
  const n = lut.size ** 3;
  const half = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) {
    half[i * 4] = toHalf(lut.data[i * 3]);
    half[i * 4 + 1] = toHalf(lut.data[i * 3 + 1]);
    half[i * 4 + 2] = toHalf(lut.data[i * 3 + 2]);
    half[i * 4 + 3] = 0x3c00; // 1.0
  }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, s.lutTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.HALF_FLOAT, half);
  s.lutKey = key;
}

/**
 * Aplica o LUT ao conteúdo de `layer` (canvas 2D W×H), no próprio canvas.
 * @param {CanvasRenderingContext2D} lctx
 */
export function applyLutToLayer(lctx, layer, lut, intensity = 1) {
  if (!lut || intensity <= 0) return;
  const W = layer.width;
  const H = layer.height;
  const s = init();
  if (s) {
    try {
      const { gl, canvas } = s;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      uploadLut(s, lut);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.imgTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
      gl.uniform1f(s.loc.size, lut.size);
      gl.uniform1f(s.loc.amount, Math.min(1, intensity));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      lctx.save();
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'copy';
      lctx.globalAlpha = 1;
      lctx.filter = 'none';
      lctx.drawImage(canvas, 0, 0, W, H);
      lctx.restore();
      return;
    } catch (e) {
      console.warn('falha no LUT (GPU), usando CPU', e);
      state = null;
    }
  }
  try {
    const img = lctx.getImageData(0, 0, W, H);
    lctx.putImageData(applyLutToImageData(img, lut, Math.min(1, intensity)), 0, 0);
  } catch {
    /* canvas contaminado (CORS): mantém sem LUT */
  }
}

/** Indica se a GPU está sendo usada (para diagnóstico/testes). */
export const lutBackend = () => (init() ? 'webgl2' : 'cpu');
