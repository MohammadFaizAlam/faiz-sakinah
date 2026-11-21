import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { shaderSignal } from '../lib/shaderSignal';

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Voice-reactive liquid-silk ribbon shader with 3 curated quiet-luxury moods:
 * - Midnight Silk (default): Deep #0A0F1E navy negative space + crisp liquid silver-blue satin ribbons
 * - Lunar Mist: Broader, softer moonlit swells with gentle luminous vocal wash
 * - Still Night: Ultra-minimal deep sanctuary with whisper-quiet vocal breathing halo
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uPlaying;
  uniform float uAyahPulse;
  uniform float uProgress;
  uniform float uBloomY;
  uniform vec2 uPointer;
  uniform float uVoiceLevel;
  uniform float uVoiceWarmth;
  uniform float uVoiceCrest;
  uniform float uMoodLunar;
  uniform float uMoodStill;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  const mat2 ROT = mat2(0.80, -0.60, 0.60, 0.80);

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      val += amp * noise(p);
      p = ROT * p * 2.02 + vec2(1.7, 9.2);
      amp *= 0.5;
    }
    return val;
  }

  vec2 silkWarp(vec2 p, float t, float phase, float swell) {
    vec2 q = vec2(
      fbm(p * 0.88 + vec2(t * 0.28 + phase * 0.18, -t * 0.20)),
      fbm(p * 0.88 + vec2(-t * 0.22, t * 0.26) + vec2(4.7, 1.9))
    );
    float warpAmp = 1.45 + swell * 0.32;
    vec2 r = vec2(
      fbm(p * 1.08 + warpAmp * q + vec2(1.7 + t * 0.18, 8.4 - t * 0.15)),
      fbm(p * 1.08 + warpAmp * q + vec2(7.6 - t * 0.16, 2.3 + t * 0.19))
    );
    return r;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 ptr = uPointer * 0.045;
    p += ptr;

    // Lunar Mist scales space slightly broader and softer
    float spaceScale = mix(1.0, 0.78, uMoodLunar);
    p *= spaceScale;

    float t = uTime * mix(0.48, 0.34, uMoodLunar);
    float phase = uProgress * 1.6;

    // Two-stage fluid domain warp subtly swelled by real vocal warmth
    vec2 r = silkWarp(p, t, phase, uVoiceWarmth);
    vec2 rDx = silkWarp(p + vec2(0.035, 0.0), t, phase, uVoiceWarmth);
    float slopeGlint = clamp(
      0.55 + (r.x - rDx.x) * 8.5 + (r.y - rDx.y) * 5.0 + uVoiceCrest * 0.42,
      0.25,
      1.5
    );

    // Primary sweeping liquid-silk arc
    float bandSharpness1 = mix(6.5, 3.2, uMoodLunar);
    float crestSharpness1 = mix(34.0, 14.0, uMoodLunar);
    float flow1 = (p.x * 1.05 - p.y * 1.48) + r.x * 2.75 + r.y * 1.15 - t * 0.62 + phase * 0.55;
    float s1 = sin(flow1);
    float band1 = exp(-s1 * s1 * bandSharpness1);
    float crest1 = exp(-s1 * s1 * crestSharpness1);

    // Secondary counter-flowing satin ribbon
    float bandSharpness2 = mix(8.5, 4.2, uMoodLunar);
    float crestSharpness2 = mix(44.0, 18.0, uMoodLunar);
    float flow2 = (p.x * 0.82 + p.y * 1.65) - r.y * 2.55 + r.x * 1.25 + t * 0.48 + 1.35;
    float s2 = sin(flow2);
    float band2 = exp(-s2 * s2 * bandSharpness2);
    float crest2 = exp(-s2 * s2 * crestSharpness2);

    // Delicate inner caustic shimmer thread drifting inside the folds
    float flow3 = (p.x * 1.38 - p.y * 0.72) + (r.x - r.y) * 2.3 - t * 0.36;
    float s3 = cos(flow3);
    float band3 = exp(-s3 * s3 * mix(12.0, 6.0, uMoodLunar)) * (0.55 + uVoiceCrest * 0.35);

    // Vocal breathing halo & expanding ripple centered behind active ayah
    vec2 bloomCenter = vec2(0.56 + uPointer.x * 0.025, uBloomY);
    vec2 bloomDelta = (uv - bloomCenter) * vec2(aspect * 0.68, 1.0);
    float bloomDist = length(bloomDelta);
    float vocalHalo = exp(-bloomDist * bloomDist * (2.9 - uVoiceWarmth * 0.65)) *
      (0.11 + 0.08 * uPlaying + 0.18 * uAyahPulse + 0.34 * uVoiceLevel);
    float pulseRing = exp(-pow(bloomDist - (1.0 - uAyahPulse) * 0.55, 2.0) * 18.0) * uAyahPulse * 0.18;
    float voiceWave = exp(-pow(bloomDist - (0.28 + uVoiceLevel * 0.36), 2.0) * 24.0) * uVoiceCrest * 0.15;

    float activity = 0.86 + 0.16 * uPlaying + 0.24 * uAyahPulse + 0.46 * uVoiceLevel;

    // Still Night attenuates outer ribbons cleanly while preserving the quiet vocal aura
    float ribbonPresence = mix(1.0, 0.22, uMoodStill);
    float crestPresence = mix(1.0, 0.16, uMoodStill);

    float ribbonBody = (band1 * 0.58 + band2 * 0.44 + band3 * 0.32) * activity * ribbonPresence;
    float liquidCrest =
      (crest1 * 0.78 + crest2 * 0.56) * slopeGlint * activity * crestPresence +
      pulseRing +
      voiceWave;

    // Strict Navy #0A0F1E -> Deep Fold #131E38 -> Silver Blue #8FA3C7 -> Crisp Pale Silver Crest
    vec3 colNavy   = vec3(0.0392, 0.0588, 0.1176); // #0A0F1E
    vec3 colFold   = vec3(0.0745, 0.1176, 0.2196); // #131E38
    vec3 colSilver = vec3(0.5608, 0.6392, 0.7804); // #8FA3C7
    vec3 colCrest  = vec3(0.7804, 0.8353, 0.9255); // #C7D5EC

    vec3 color = colNavy;
    color = mix(color, colFold, smoothstep(0.06, 0.65, ribbonBody + vocalHalo));
    color = mix(
      color,
      colSilver,
      smoothstep(0.18, 1.05, ribbonBody * 0.88 + vocalHalo * 0.85) * mix(0.56, 0.62, uMoodLunar)
    );
    color = mix(
      color,
      colCrest,
      clamp(liquidCrest, 0.0, 1.0) * mix(0.44, 0.30, uMoodLunar)
    );

    // Subtle deep-navy vignette so edges stay rich and grounded
    float vig = 1.0 - smoothstep(0.50, 1.40, length((uv - 0.5) * vec2(1.06, 1.0)));
    color = mix(colNavy * 0.88, color, 0.46 + 0.54 * vig);

    // Subtle film-grain dither to prevent dark gradient banding
    float grain = (hash12(gl_FragCoord.xy + fract(uTime * 0.5) * 43.0) - 0.5) * 0.013;
    color += grain;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function detectWebGLCapabilities(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { supported: false, isSoftwareGl: false };
  }

  try {
    const probeCanvas = document.createElement('canvas');
    const gl =
      probeCanvas.getContext('webgl2') ||
      probeCanvas.getContext('webgl') ||
      probeCanvas.getContext('experimental-webgl');

    if (!gl) {
      return { supported: false, isSoftwareGl: false };
    }

    const webgl = gl as WebGLRenderingContext;
    const ext = webgl.getExtension('WEBGL_debug_renderer_info');
    const rendererParam = ext ? ext.UNMASKED_RENDERER_WEBGL : webgl.RENDERER;
    const gpuName = String(webgl.getParameter(rendererParam) ?? '');
    webgl.getExtension('WEBGL_lose_context')?.loseContext();

    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      gpuName,
    );
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: false };
  }
}

export function SilkWebGLBackground() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { supported, isSoftwareGl } = detectWebGLCapabilities();
    document.documentElement.dataset.webglMode = !supported
      ? 'fallback'
      : isSoftwareGl
        ? 'software'
        : 'gpu';

    if (!supported) {
      setFallbackActive(true);
      return;
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = reducedMotionQuery.matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: isSoftwareGl ? 'low-power' : 'high-performance',
        depth: false,
        stencil: false,
      });
    } catch {
      setFallbackActive(true);
      return;
    }

    const computePixelRatio = () => {
      if (isSoftwareGl) return 0.65;
      const cap = window.innerWidth < 768 ? 1.15 : 1.5;
      return Math.min(window.devicePixelRatio || 1, cap);
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(computePixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 4.5 },
      uResolution: {
        value: new THREE.Vector2(
          window.innerWidth * renderer.getPixelRatio(),
          window.innerHeight * renderer.getPixelRatio(),
        ),
      },
      uPlaying: { value: 0 },
      uAyahPulse: { value: 0 },
      uProgress: { value: 0 },
      uBloomY: { value: 0.52 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uVoiceLevel: { value: 0 },
      uVoiceWarmth: { value: 0 },
      uVoiceCrest: { value: 0 },
      uMoodLunar: { value: shaderSignal.moodIndex === 1 ? 1 : 0 },
      uMoodStill: { value: shaderSignal.moodIndex === 2 ? 1 : 0 },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let disposed = false;
    let frameHandle = 0;
    let isTimerHandle = false;
    let lastNow = performance.now();

    // Damped state variables (zero GC allocations inside render loop)
    let simTime = 4.5;
    let curPlaying = 0;
    let curProgress = 0;
    let curBloomY = 0.52;
    let curPulse = 0;
    let curPtrX = 0;
    let curPtrY = 0;
    let curVoiceLevel = 0;
    let curVoiceWarmth = 0;
    let curVoiceCrest = 0;
    let curMoodLunar = shaderSignal.moodIndex === 1 ? 1 : 0;
    let curMoodStill = shaderSignal.moodIndex === 2 ? 1 : 0;

    const cancelScheduled = () => {
      if (frameHandle) {
        if (isTimerHandle) {
          window.clearTimeout(frameHandle);
        } else {
          window.cancelAnimationFrame(frameHandle);
        }
        frameHandle = 0;
      }
    };

    const scheduleAfterDraw = (cb: () => void) => {
      const gl = renderer.getContext();
      if (gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            isTimerHandle = true;
            frameHandle = window.setTimeout(poll, 8);
          } else {
            if (sync) gl.deleteSync(sync);
            isTimerHandle = true;
            frameHandle = window.setTimeout(cb, 55);
          }
        };
        isTimerHandle = true;
        frameHandle = window.setTimeout(poll, 8);
      } else {
        isTimerHandle = true;
        frameHandle = window.setTimeout(cb, 75);
      }
    };

    const renderSingleFrame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      const damp = (cur: number, target: number, lambda: number) =>
        THREE.MathUtils.damp(cur, target, lambda, dt);

      curPlaying = damp(curPlaying, shaderSignal.playingTarget, 2.4);
      curProgress = damp(curProgress, shaderSignal.progressTarget, 2.0);
      curBloomY = damp(curBloomY, shaderSignal.bloomYTarget, 3.2);
      curPtrX = damp(curPtrX, shaderSignal.pointerX, 3.0);
      curPtrY = damp(curPtrY, shaderSignal.pointerY, 3.0);

      // Voice-reactive smoothing: responsive attack, calm release
      const reactivity = shaderSignal.reactivityTarget;
      const targetLevel = Math.min(1.25, shaderSignal.voiceLevelTarget * reactivity);
      const targetWarmth = Math.min(1.25, shaderSignal.voiceWarmthTarget * reactivity);
      const targetCrest = Math.min(1.25, shaderSignal.voiceCrestTarget * reactivity);

      curVoiceLevel = damp(curVoiceLevel, targetLevel, targetLevel > curVoiceLevel ? 9.0 : 3.5);
      curVoiceWarmth = damp(curVoiceWarmth, targetWarmth, targetWarmth > curVoiceWarmth ? 7.5 : 3.0);
      curVoiceCrest = damp(curVoiceCrest, targetCrest, targetCrest > curVoiceCrest ? 11.0 : 4.2);

      // Smoothly cross-fade between Atmosphere moods
      const targetLunar = shaderSignal.moodIndex === 1 ? 1 : 0;
      const targetStill = shaderSignal.moodIndex === 2 ? 1 : 0;
      curMoodLunar = damp(curMoodLunar, targetLunar, 3.2);
      curMoodStill = damp(curMoodStill, targetStill, 3.2);

      // Soft ~1.6s ayah transition caustic ripple
      const msSincePulse = Math.max(0, now - shaderSignal.ayahPulseStamp);
      const pulseSeconds = msSincePulse / 1000;
      const targetPulse =
        pulseSeconds < 2.6
          ? Math.min(1, pulseSeconds * 6.0) * Math.exp(-pulseSeconds * 1.8)
          : 0;
      curPulse = damp(curPulse, targetPulse, 7.0);

      // Gentle flow accelerates softly with recitation cadence and vocal energy
      const flowSpeed =
        (0.62 + curPlaying * 0.58 + curVoiceLevel * 0.52 + curPulse * 0.4) *
        (1 - curMoodStill * 0.35);
      simTime += dt * flowSpeed;

      uniforms.uTime.value = simTime;
      uniforms.uPlaying.value = curPlaying;
      uniforms.uAyahPulse.value = curPulse;
      uniforms.uProgress.value = curProgress;
      uniforms.uBloomY.value = curBloomY;
      uniforms.uPointer.value.set(curPtrX, curPtrY);
      uniforms.uVoiceLevel.value = curVoiceLevel;
      uniforms.uVoiceWarmth.value = curVoiceWarmth;
      uniforms.uVoiceCrest.value = curVoiceCrest;
      uniforms.uMoodLunar.value = curMoodLunar;
      uniforms.uMoodStill.value = curMoodStill;

      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed || document.hidden || prefersReducedMotion) return;
      renderSingleFrame(performance.now());
      if (isSoftwareGl) {
        scheduleAfterDraw(tick);
      } else {
        isTimerHandle = false;
        frameHandle = window.requestAnimationFrame(tick);
      }
    };

    const handleResize = () => {
      if (disposed) return;
      const dpr = computePixelRatio();
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      uniforms.uResolution.value.set(
        window.innerWidth * dpr,
        window.innerHeight * dpr,
      );
      if (prefersReducedMotion) {
        renderSingleFrame(performance.now());
      }
    };

    const handleVisibility = () => {
      if (disposed) return;
      if (document.hidden) {
        cancelScheduled();
      } else if (!prefersReducedMotion) {
        lastNow = performance.now();
        tick();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
      shaderSignal.pointerX = nx;
      shaderSignal.pointerY = ny;
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      cancelScheduled();
      if (prefersReducedMotion) {
        renderSingleFrame(performance.now());
      } else if (!document.hidden) {
        lastNow = performance.now();
        tick();
      }
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelScheduled();
      setFallbackActive(true);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    renderSingleFrame(performance.now());
    if (!prefersReducedMotion && !document.hidden) {
      if (isSoftwareGl) {
        scheduleAfterDraw(tick);
      } else {
        isTimerHandle = false;
        frameHandle = window.requestAnimationFrame(tick);
      }
    }

    return () => {
      disposed = true;
      cancelScheduled();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pointermove', handlePointerMove);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="webgl-silk-backdrop"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden silk-fallback-bg"
    >
      {!fallbackActive && <div ref={mountRef} className="w-full h-full" />}
      <div className="absolute inset-0 reading-scrim pointer-events-none" />
    </div>
  );
}
