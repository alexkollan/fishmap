import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MaplibreMap } from "maplibre-gl";

// Windy-style animated particle layer — purely visual, unrelated to scoring.
// v1 draws simple moving point sprites (no per-particle trail history): a
// full trail-based line-strip system needs either one drawArrays call per
// particle or a primitive-restart index buffer, both meaningfully more GL
// code to get right with no way to visually verify it from this environment.
// Points still read clearly as flow once animated (the same simplification
// several lightweight wind-viz plugins use) — trails are a reasonable v2 if
// wanted after this ships and gets eyeballed live (DEV_PLAN.md §6.4/§8: this
// whole layer sits behind the admin-only `windParticles` flag specifically
// so frame cost/look can be judged before any wider rollout).

export interface VectorSample {
  u: number; // km/h (Open-Meteo's default unit), mercator +x direction
  v: number; // km/h, mercator +y direction (note: mercator y increases southward)
  speed: number;
}

export interface ParticleLayerOptions {
  id: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  sample: (lon: number, lat: number) => VectorSample | null;
  color: [number, number, number]; // 0-1 RGB
  particleCount?: number;
  /** km/h -> mercator-units/millisecond scale. Mercator units span 0..1
   * across the whole world (~40,075km at the equator) — a raw km/h velocity
   * needs heavy scaling to be visually meaningful as on-screen motion, and
   * that scaling is deliberately latitude-independent (not a true
   * equirectangular correction) since this is a decorative layer, not a
   * physically accurate simulation. */
  speedScale?: number;
  maxAgeMs?: number;
}

const VERTEX_SRC = `#version 300 es
uniform mat4 u_matrix;
uniform float u_pointSize;
in vec2 a_pos;
in float a_alpha;
out float v_alpha;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_alpha = a_alpha;
}`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;
uniform vec3 u_color;
in float v_alpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float a = v_alpha * (1.0 - smoothstep(0.3, 0.5, d));
  outColor = vec4(u_color * a, a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

interface Particle {
  lon: number;
  lat: number;
  ageMs: number;
}

export class WindParticleLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "2d" as const;

  private readonly bbox: [number, number, number, number];
  private sample: (lon: number, lat: number) => VectorSample | null;
  color: [number, number, number];
  private readonly particleCount: number;
  private readonly speedScale: number;
  private readonly maxAgeMs: number;

  private particles: Particle[] = [];
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private matrixLoc: WebGLUniformLocation | null = null;
  private colorLoc: WebGLUniformLocation | null = null;
  private pointSizeLoc: WebGLUniformLocation | null = null;
  private posLoc = 0;
  private alphaLoc = 0;
  private lastFrameMs: number | null = null;
  private map: MaplibreMap | null = null;

  constructor(opts: ParticleLayerOptions) {
    this.id = opts.id;
    this.bbox = opts.bbox;
    this.sample = opts.sample;
    this.color = opts.color;
    this.particleCount = opts.particleCount ?? 400;
    this.speedScale = opts.speedScale ?? 0.00002;
    this.maxAgeMs = opts.maxAgeMs ?? 6000;
    this.particles = Array.from({ length: this.particleCount }, () => this.spawn());
  }

  /** Swap in a new sample function (new field data, e.g. after a refetch) without rebuilding GL state. */
  setSample(sample: (lon: number, lat: number) => VectorSample | null) {
    this.sample = sample;
  }

  private randomPointInBbox(): { lon: number; lat: number } {
    const [minLon, minLat, maxLon, maxLat] = this.bbox;
    return { lon: minLon + Math.random() * (maxLon - minLon), lat: minLat + Math.random() * (maxLat - minLat) };
  }

  private spawn(): Particle {
    // A handful of retries to avoid spawning directly on a null-data cell
    // (e.g. land, for the current layer) — not exhaustive, a particle that
    // wanders into null data mid-flight just gets respawned next tick.
    for (let i = 0; i < 5; i++) {
      const p = this.randomPointInBbox();
      if (this.sample(p.lon, p.lat)) return { ...p, ageMs: Math.random() * this.maxAgeMs };
    }
    const p = this.randomPointInBbox();
    return { ...p, ageMs: Math.random() * this.maxAgeMs };
  }

  onAdd(map: MaplibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create GL program");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.matrixLoc = gl.getUniformLocation(program, "u_matrix");
    this.colorLoc = gl.getUniformLocation(program, "u_color");
    this.pointSizeLoc = gl.getUniformLocation(program, "u_pointSize");
    this.posLoc = gl.getAttribLocation(program, "a_pos");
    this.alphaLoc = gl.getAttribLocation(program, "a_alpha");
    this.buffer = gl.createBuffer();
  }

  onRemove(_map: MaplibreMap, gl: WebGL2RenderingContext) {
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.program = null;
    this.buffer = null;
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    const now = performance.now();
    const dtMs = this.lastFrameMs === null ? 16 : Math.min(now - this.lastFrameMs, 100);
    this.lastFrameMs = now;

    const [minLon, minLat, maxLon, maxLat] = this.bbox;
    const vertexData = new Float32Array(this.particles.length * 3);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]!;
      particle.ageMs += dtMs;

      const v = this.sample(particle.lon, particle.lat);
      const outOfBounds = particle.lon < minLon || particle.lon > maxLon || particle.lat < minLat || particle.lat > maxLat;
      if (!v || outOfBounds || particle.ageMs > this.maxAgeMs) {
        const fresh = this.spawn();
        particle.lon = fresh.lon;
        particle.lat = fresh.lat;
        particle.ageMs = 0;
      } else {
        particle.lon += v.u * this.speedScale * dtMs;
        particle.lat -= v.v * this.speedScale * dtMs; // mercator y grows southward
      }

      const merc = MercatorCoordinate.fromLngLat({ lng: particle.lon, lat: particle.lat });
      const fadeIn = Math.min(1, particle.ageMs / 400);
      const fadeOut = Math.min(1, (this.maxAgeMs - particle.ageMs) / 400);
      vertexData[i * 3] = merc.x;
      vertexData[i * 3 + 1] = merc.y;
      vertexData[i * 3 + 2] = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.85;
    }

    if (!this.program || !this.buffer) return;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(this.alphaLoc);
    gl.vertexAttribPointer(this.alphaLoc, 1, gl.FLOAT, false, 12, 8);

    // gl-matrix's `mat4` is a Float32Array-backed numeric array at runtime;
    // its TS type just doesn't structurally match WebGL's Float32List.
    gl.uniformMatrix4fv(this.matrixLoc, false, options.modelViewProjectionMatrix as unknown as Float32Array);
    gl.uniform3f(this.colorLoc, this.color[0], this.color[1], this.color[2]);
    gl.uniform1f(this.pointSizeLoc, 3.5);

    gl.drawArrays(gl.POINTS, 0, this.particles.length);

    this.map?.triggerRepaint();
  }
}
