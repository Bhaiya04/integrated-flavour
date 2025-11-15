/* script.js
   Plain WebGL implementation of the iridescence shader you provided.
   Configuration near the top: color (RGB components 0..1), amplitude, speed, mouseReact
*/

(() => {
  // ---------- CONFIG ----------
  // Equivalent to <Iridescence color={[1,1,1]} amplitude={0.1} speed={1.0} mouseReact={false} />
  const COLOR = [1.0, 1.0, 1.0]; // [r,g,b] each 0..1
  const AMPLITUDE = 0.1;
  const SPEED = 1.0;
  const MOUSE_REACT = true;
  // ----------------------------

  // DOM
  const container = document.getElementById('iridescence-root');
  container.style.background = '#cfd8e3';

  // create full-size canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  container.appendChild(canvas);

  // webgl context
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }

  // ---------- Shaders ----------
  const vertexSrc = `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 vUv;
    void main() {
      vUv = a_uv;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;

    uniform float uTime;
    uniform vec3 uColor;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    uniform float uAmplitude;
    uniform float uSpeed;

    varying vec2 vUv;

    void main() {
      float mr = min(uResolution.x, uResolution.y);
      vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

      uv += (uMouse - vec2(0.5)) * uAmplitude;

      float d = -uTime * 0.5 * uSpeed;
      float a = 0.0;
      for (float i = 0.0; i < 8.0; i += 1.0) {
        a += cos(i - d - a * uv.x);
        d += sin(uv.y * i + a);
      }
      d += uTime * 0.5 * uSpeed;
      vec3 col = vec3(cos(uv.x * d) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5, cos(uv.y * a) * 0.6 + 0.4);
      col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // compile helpers
  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vShader = compileShader(vertexSrc, gl.VERTEX_SHADER);
  const fShader = compileShader(fragmentSrc, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  // Full-screen triangle / quad
  // We'll make a quad with two triangles
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
  ]);

  // position buffer
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // uv buffer
  const uvLoc = gl.getAttribLocation(program, 'a_uv');
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  // uniforms
  const uTimeLoc = gl.getUniformLocation(program, 'uTime');
  const uColorLoc = gl.getUniformLocation(program, 'uColor');
  const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
  const uMouseLoc = gl.getUniformLocation(program, 'uMouse');
  const uAmplitudeLoc = gl.getUniformLocation(program, 'uAmplitude');
  const uSpeedLoc = gl.getUniformLocation(program, 'uSpeed');

  // set static uniforms
  gl.uniform3f(uColorLoc, COLOR[0], COLOR[1], COLOR[2]);
  gl.uniform1f(uAmplitudeLoc, AMPLITUDE);
  gl.uniform1f(uSpeedLoc, SPEED);
  gl.uniform2f(uMouseLoc, 0.5, 0.5);

  // resize handling with devicePixelRatio
  function resizeCanvasToDisplaySize() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolutionLoc, width, height);
    }
  }

  // mouse tracking
  let mouse = { x: 0.5, y: 0.5 };
  function setMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    mouse.x = x;
    mouse.y = y;
    gl.uniform2f(uMouseLoc, x, y);
  }
  if (MOUSE_REACT) {
    canvas.addEventListener('mousemove', setMouseFromEvent);
    canvas.addEventListener('touchmove', (ev) => {
      if (ev.touches && ev.touches.length) {
        setMouseFromEvent(ev.touches[0]);
      }
    }, { passive: true });
  }

  // animation loop
  let start = performance.now();
  function render(now) {
    resizeCanvasToDisplaySize();
    const t = (now - start) * 0.001;
    gl.uniform1f(uTimeLoc, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // expose a minimal API for dev use (console)
  window.__Iridescence = {
    setColor: (r, g, b) => {
      gl.uniform3f(uColorLoc, r, g, b);
    },
    setAmplitude: (v) => { gl.uniform1f(uAmplitudeLoc, v); },
    setSpeed: (v) => { gl.uniform1f(uSpeedLoc, v); },
    dispose: () => {
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };

  // small housekeeping for the page UI
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('demoToggle').addEventListener('change', (e) => {
    // just toggles visibility of the hero inner content as a demo
    const heroInner = document.querySelector('.hero-inner');
    heroInner.style.opacity = e.target.checked ? '0.12' : '1';
  });
})();
