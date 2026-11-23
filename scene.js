/* MARG — fluid gradient background.
   The logo's colours flow like silk behind the page. The pointer pulls and swirls them,
   and the colours warm from night toward sunrise as you scroll. Plain WebGL, no 3D. */

const canvas = document.querySelector('.webgl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones and low-power devices get a lighter version of the same look
const LIGHT = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

if (!gl) {
  canvas.remove(); // the CSS aurora behind still gives colour
} else {
  document.documentElement.classList.add('has-fluid');
  run();
}

function run() {
  const vert = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const frag = `
    precision mediump float;
    #define OCTAVES ${LIGHT ? 3 : 4}
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;      // 0..1, y up
    uniform float uMouseForce;
    uniform float uScroll;    // 0..1 down the page

    const vec3 NIGHT = vec3(0.000, 0.043, 0.133);
    const vec3 DEEP  = vec3(0.004, 0.133, 0.310);
    const vec3 NAVY  = vec3(0.000, 0.204, 0.471);
    const vec3 SKY   = vec3(0.184, 0.498, 0.659);
    const vec3 TEAL  = vec3(0.290, 0.639, 0.710);
    const vec3 SAGE  = vec3(0.663, 0.745, 0.612);
    const vec3 DAWN  = vec3(1.000, 0.835, 0.518);

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = r * p * 2.02 + 3.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * aspect, uv.y) * 1.05;
      vec2 m = vec2(uMouse.x * aspect, uMouse.y) * 1.05;
      float t = uTime * 0.06;

      // the pointer pulls the silk toward it and twists it around itself
      vec2 toM = p - m;
      float fall = exp(-dot(toM, toM) * 5.0) * uMouseForce;
      float ang = fall * 1.6;
      mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
      p = m + rot * toM * (1.0 - 0.35 * fall);

      // domain warping gives the flowing, folded look
      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * 1.2));
      float f = fbm(p + 3.0 * r);

      // base: deep night, with navy and blue rivers
      vec3 col = mix(NIGHT, DEEP, smoothstep(0.1, 0.6, f));
      col = mix(col, NAVY, smoothstep(0.35, 0.8, f * length(q)) * 0.9);
      col = mix(col, SKY, smoothstep(0.55, 0.95, r.x) * 0.55);

      // like the logo: the sunrise lives toward the upper right, and grows as you scroll
      float diag = clamp(uv.x * 0.6 + uv.y * 0.55 - 0.15 + uScroll * 0.35, 0.0, 1.2);
      float warm = smoothstep(0.3, 0.95, diag);
      col = mix(col, TEAL, smoothstep(0.42, 0.8, r.y) * (0.45 + 0.5 * warm));
      col = mix(col, SAGE, smoothstep(0.5, 0.85, f) * warm * 0.8);
      col = mix(col, DAWN, smoothstep(0.45, 0.85, f * r.x * 1.7) * warm);

      // silk sheen along the folds
      float sheen = pow(1.0 - abs(f * 2.0 - 1.0), 6.0);
      col += sheen * mix(TEAL, DAWN, warm) * 0.18;

      // light gathers under the pointer
      col += fall * mix(TEAL, DAWN, 0.4) * 0.12;

      // keep the left side calm and dark enough for text
      col *= 0.55 + 0.45 * smoothstep(0.15, 0.85, uv.x * 0.8 + uv.y * 0.4);
      col = mix(col, NIGHT, 0.08);

      gl_FragColor = vec4(col, 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
  } catch (err) {
    console.warn('Background shader failed:', err);
    document.documentElement.classList.remove('has-fluid');
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uForce = u('uMouseForce'), uScroll = u('uScroll');

  // Smooth gradients do not need full resolution: render small, let CSS stretch it
  const QUALITY = LIGHT ? 0.22 : 0.4;
  function resize() {
    canvas.width = Math.max(1, Math.round(innerWidth * QUALITY));
    canvas.height = Math.max(1, Math.round(innerHeight * QUALITY));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  resize();
  addEventListener('resize', resize);

  const mouse = { x: 0.7, y: 0.6 }, smooth = { x: 0.7, y: 0.6 };
  let force = 0, lastMove = -1e9;
  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / innerWidth;
    mouse.y = 1 - e.clientY / innerHeight;
    lastMove = performance.now();
  });

  const start = performance.now();
  let scrollSmooth = 0;
  const FRAME_MS = LIGHT ? 1000 / 30 : 0; // 30 fps is plenty for slow-moving silk
  let lastDraw = 0;
  function frame(now) {
    if (!reduced) requestAnimationFrame(frame);
    now = now || performance.now();
    if (now - lastDraw < FRAME_MS) return;
    lastDraw = now;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollSmooth += (scrollY / maxScroll - scrollSmooth) * 0.05;
    smooth.x += (mouse.x - smooth.x) * 0.06;
    smooth.y += (mouse.y - smooth.y) * 0.06;
    const moving = performance.now() - lastMove < 1500;
    force += ((moving ? 1 : 0.25) - force) * 0.04;

    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, smooth.x, smooth.y);
    gl.uniform1f(uForce, force);
    gl.uniform1f(uScroll, scrollSmooth);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  requestAnimationFrame(frame);
}
