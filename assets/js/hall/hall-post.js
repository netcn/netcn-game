/* ============================================================
   hall-post.js —— 轻量后期：HDR 场景靶 + 阈值提取 + 两次高斯模糊 + 合成
   —— 合成阶段统一做 ACES 色调映射 / 暗角 / 轻微色散 / 颗粒
   —— 可整体关闭（移动端或低帧率自动降级），关闭后仍走同一条合成链
   ============================================================ */
window.HallPost = (function () {
  'use strict';

  var VS = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  var BRIGHT = [
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform float uThreshold;',
    'void main(){',
    '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
    '  float l = max(max(c.r, c.g), c.b);',
    '  float k = smoothstep(uThreshold, uThreshold + 0.28, l);',
    '  gl_FragColor = vec4(c * k, 1.0);',
    '}'
  ].join('\n');

  var BLUR = [
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uDir;',
    'void main(){',
    '  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;',
    '  s += texture2D(tDiffuse, vUv + uDir * 1.3846).rgb * 0.316216;',
    '  s += texture2D(tDiffuse, vUv - uDir * 1.3846).rgb * 0.316216;',
    '  s += texture2D(tDiffuse, vUv + uDir * 3.2308).rgb * 0.070270;',
    '  s += texture2D(tDiffuse, vUv - uDir * 3.2308).rgb * 0.070270;',
    '  gl_FragColor = vec4(s, 1.0);',
    '}'
  ].join('\n');

  var COMP = [
    'varying vec2 vUv;',
    'uniform sampler2D tScene;',
    'uniform sampler2D tBloom;',
    'uniform float uStrength;',
    'uniform float uExposure;',
    'uniform float uVignette;',
    'uniform float uTime;',
    'uniform float uAb;',
    'vec3 aces(vec3 x){',
    '  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
    '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
    '}',
    'vec3 srgb(vec3 c){',
    '  c = clamp(c, 0.0, 1.0);',
    '  vec3 lo = c * 12.92;',
    '  vec3 hi = 1.055 * pow(max(c, vec3(0.00001)), vec3(1.0 / 2.4)) - 0.055;',
    '  return mix(lo, hi, step(vec3(0.003), c));',
    '}',
    'void main(){',
    '  vec2 d = vUv - 0.5;',
    '  vec3 col;',
    '  col.r = texture2D(tScene, vUv + d * uAb).r;',
    '  col.g = texture2D(tScene, vUv).g;',
    '  col.b = texture2D(tScene, vUv - d * uAb).b;',
    '  col += texture2D(tBloom, vUv).rgb * uStrength;',
    '  col = aces(col * uExposure);',
    '  float vig = 1.0 - uVignette * smoothstep(0.32, 0.95, length(d));',
    '  col *= vig;',
    '  float n = fract(sin(dot(vUv + uTime * 0.017, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (n - 0.5) * 0.012;',
    '  gl_FragColor = vec4(srgb(col), 1.0);',
    '}'
  ].join('\n');

  function create(renderer, opts) {
    opts = opts || {};
    var enabled = opts.enabled !== false;
    var strength = opts.strength === undefined ? 0.85 : opts.strength;
    var threshold = opts.threshold === undefined ? 0.72 : opts.threshold;
    var exposure = opts.exposure === undefined ? 1.12 : opts.exposure;
    var bw = 1, bh = 1, sw = 1, sh = 1;

    var rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    var sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
      samples: opts.samples || 0
    });
    sceneRT.texture.minFilter = THREE.LinearFilter;
    sceneRT.texture.magFilter = THREE.LinearFilter;
    var bloomA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    var bloomB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    bloomA.texture.minFilter = bloomA.texture.magFilter = THREE.LinearFilter;
    bloomB.texture.minFilter = bloomB.texture.magFilter = THREE.LinearFilter;

    var black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    black.needsUpdate = true;

    var quadScene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    quad.frustumCulled = false;
    quadScene.add(quad);

    var matBright = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: BRIGHT, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: threshold } }
    });
    var matBlur = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: BLUR, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(0, 0) } }
    });
    var matComp = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: COMP, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: sceneRT.texture },
        tBloom: { value: black },
        uStrength: { value: enabled ? strength : 0 },
        uExposure: { value: exposure },
        uVignette: { value: 0.38 },
        uTime: { value: 0 },
        uAb: { value: 0.0016 }
      }
    });

    function setSize(w, h, pr) {
      sw = Math.max(2, Math.round(w * pr));
      sh = Math.max(2, Math.round(h * pr));
      sceneRT.setSize(sw, sh);
      bw = Math.max(2, Math.round(sw * 0.5));
      bh = Math.max(2, Math.round(sh * 0.5));
      bloomA.setSize(bw, bh);
      bloomB.setSize(bw, bh);
    }

    function pass(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, camera);
    }

    function render(scene, cam, time) {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, cam);

      if (enabled && strength > 0) {
        matBright.uniforms.tDiffuse.value = sceneRT.texture;
        pass(matBright, bloomA);

        matBlur.uniforms.tDiffuse.value = bloomA.texture;
        matBlur.uniforms.uDir.value.set(1 / bw, 0);
        pass(matBlur, bloomB);

        matBlur.uniforms.tDiffuse.value = bloomB.texture;
        matBlur.uniforms.uDir.value.set(0, 1 / bh);
        pass(matBlur, bloomA);

        matComp.uniforms.tBloom.value = bloomA.texture;
        matComp.uniforms.uStrength.value = strength;
      } else {
        matComp.uniforms.tBloom.value = black;
        matComp.uniforms.uStrength.value = 0;
      }

      matComp.uniforms.tScene.value = sceneRT.texture;
      matComp.uniforms.uTime.value = time || 0;
      renderer.setRenderTarget(null);
      pass(matComp, null);
    }

    return {
      render: render,
      setSize: setSize,
      setEnabled: function (on) { enabled = !!on; },
      isEnabled: function () { return enabled; },
      setStrength: function (v) { strength = v; },
      dispose: function () {
        sceneRT.dispose(); bloomA.dispose(); bloomB.dispose();
        quad.geometry.dispose();
        matBright.dispose(); matBlur.dispose(); matComp.dispose();
        black.dispose();
      }
    };
  }

  return { create: create };
})();
