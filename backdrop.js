// Adapted from dopa-drill/app/js/bg.js (MIT, copyright 2026 gear_machine).
// The original mascot silhouette was replaced with a five-point star.
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
uniform vec2 uRes, uCenter;
uniform float uTime, uE, uKick, uFlash, uReach, uHue;
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6. + vec3(0.,4.,2.), 6.) - 3.) - 1., 0., 1.); return v * mix(vec3(1.), k, s); }
float star(vec2 p){ float a = atan(p.y, p.x); return length(p) - (.2 + .09 * cos(a * 5.)); }
float beatRings(float r, float t, float E){ return smoothstep(.35, .7, E) * smoothstep(.035, 0., abs(fract(r * 2.4 - t * .8) - .5) - .45); }
vec3 classic(vec2 p, float r, float a, float E, float t){
  float nr = floor(mix(10., 20., clamp(E, 0., 1.)));
  float tw = sin(r * 6. - t * 1.5) * .25 * smoothstep(.6, 1., E);
  float ray = smoothstep(-.06, .06, sin(a * nr + t * (.12 + .55 * E) + tw));
  float sat = smoothstep(.15, .75, E);
  vec3 col = mix(mix(vec3(1., .975, .93), vec3(.24, .43, 1.), sat),
                 mix(vec3(1., .93, .96), vec3(1., .5, .72), sat), ray);
  float rb = smoothstep(.55, .95, E);
  vec3 rain = hsv(fract(a / 6.2832 + t * .07 + r * .25 + uHue), .75, 1.);
  col = mix(col, mix(rain, rain * .7 + .3, ray), rb * .85);
  col = mix(col, vec3(1.), beatRings(r, t, E) * .55);
  float tn = smoothstep(.75, 1., E);
  if (tn > .001) {
    vec2 uv = vec2(a / 6.2832 * 12., .32 / (r + .015) + t * 1.5);
    vec2 cell = floor(uv); vec2 f = fract(uv) - .5;
    f.x += .5 * mod(cell.y, 2.) - .25;
    float d = star(f * 1.1);
    vec3 sc = hsv(fract(cell.x * .11 + cell.y * .17 + t * .25 + uHue), .7, 1.);
    float m = smoothstep(.015, -.015, d) * smoothstep(.02, .22, r);
    float ol = smoothstep(.03, 0., abs(d + .012)) * smoothstep(.02, .22, r);
    col = mix(col, sc, tn * m);
    col = mix(col, vec3(.1, .11, .3), tn * ol * .8);
  }
  return col;
}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (fc - uCenter) / uRes.y;
  float E = uE; float t = uTime;
  p *= 1. - .06 * uKick * smoothstep(.35, .6, E);
  float r = length(p); float a = atan(p.y, p.x);
  vec3 col = classic(p, r, a, E, t);
  col += vec3(1., .96, .85) * exp(-r * r * 14.) * (.25 + .6 * uKick * E);
  col = mix(col, col * vec3(.16, .12, .32), uReach * smoothstep(.08, .5, r));
  col = mix(col, vec3(1.), clamp(uFlash, 0., 1.));
  float alpha = smoothstep(.1, .3, E) * (.32 + .68 * smoothstep(.3, .62, E));
  alpha = max(alpha, uReach * .88);
  alpha = max(alpha, clamp(uFlash, 0., 1.));
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export class Backdrop {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = { E: .08, kick: 0, flash: 0, reach: 0, hue: 0, cx: 0, cy: 0 };
    try { this.init(); } catch (error) { console.warn('WebGL 背景不可用', error); }
    if (!this.gl) canvas.hidden = true;
  }

  init() {
    const gl = this.canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true, powerPreference: 'high-performance' });
    if (!gl) return;
    const shader = (type, source) => {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['uRes', 'uCenter', 'uTime', 'uE', 'uKick', 'uFlash', 'uReach', 'uHue'].map((name) => [name, gl.getUniformLocation(program, name)]));
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); this.gl = null; this.canvas.hidden = true; });
  }

  render(time) {
    const gl = this.gl;
    if (!gl || document.hidden) return;
    const scale = Math.min(1.25, window.devicePixelRatio || 1);
    const width = Math.round(this.canvas.clientWidth * scale);
    const height = Math.round(this.canvas.clientHeight * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    const s = this.state;
    gl.uniform2f(this.uniforms.uRes, width, height);
    gl.uniform2f(this.uniforms.uCenter, s.cx * scale, s.cy * scale);
    gl.uniform1f(this.uniforms.uTime, time / 1000);
    for (const [key, name] of [['E', 'uE'], ['kick', 'uKick'], ['flash', 'uFlash'], ['reach', 'uReach'], ['hue', 'uHue']]) gl.uniform1f(this.uniforms[name], s[key]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
