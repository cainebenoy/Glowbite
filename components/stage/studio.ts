// The WebGL stage engine, in plain three.js (ported from the prototype's <script type="module">):
// renderer, studio environment, backdrop shader, lights, the device, the jet, keyframed camera,
// bloom pipeline and adaptive quality. React only mounts the canvas (Stage.tsx).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useStory } from "./useStory";
import { OVAL, radiusAt, type DeviceHandles } from "./model";
import { ease, KEY_NAMES, KEYS, type Key } from "./keyframes";

export const isMobile = () => innerWidth < 860;
export const isLowPower = () => isMobile() || (navigator.hardwareConcurrency || 8) <= 4;

function createBackdrop() {
  // true black, with only a faint neutral lift so the white body separates from the void
  const mat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uCore: { value: new THREE.Vector2(0.7, 0.45) }, uCoreAmt: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uAspect, uCoreAmt; uniform vec2 uCore;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec2 d = (vUv - uCore) * vec2(uAspect, 1.);
        float r = length(d * vec2(1.25, .8));
        vec3 col = vec3(.0034, .0034, .0036) * exp(-r * r * 3.2) * (.7 + uCoreAmt * .3);
        col += h(vUv * 1013. + fract(uTime * .5) * 91.) * .0012;
        gl_FragColor = vec4(max(col, 0.), 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, mat };
}

function createEnvironment(gl: THREE.WebGLRenderer) {
  // dark studio: one large softbox above, two tall strip lights, a faint cool kicker
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const box = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x020304, side: THREE.BackSide }));
  env.add(box);
  disposables.push(box.geometry, box.material as THREE.Material);
  const strip = (hex: number, k: number, pos: [number, number, number], rot: [number, number, number], size: [number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
    disposables.push(m.geometry, m.material as THREE.Material);
  };
  strip(0xffffff, 3.2, [0, 8, 2], [Math.PI / 2, 0, 0], [8, 4]);
  strip(0xf4f8ff, 2.6, [-7, 1, 2], [0, Math.PI / 2, 0], [1, 12]);
  strip(0xf4f8ff, 1.6, [7, 1, -1], [0, -Math.PI / 2, 0], [1, 12]);
  strip(0x2fb8ff, 1.2, [0, 1, -8], [0, 0, 0], [6, 10]);
  const texture = pmrem.fromScene(env, 0.02).texture;
  disposables.forEach((d) => d.dispose());
  pmrem.dispose();
  return texture;
}

export type Studio = {
  /** Swap in the device (procedural or GLB). */
  setDevice: (d: DeviceHandles) => void;
  /** Run/pause the render loop (pauses when hidden or scrolled past). */
  setRunning: (on: boolean) => void;
  dispose: () => void;
};

export function createStudio(canvas: HTMLCanvasElement, onFirstFrame: () => void): Studio {
  const lowPower = isLowPower();
  const maxDpr = isMobile() ? 1.5 : 2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const env = createEnvironment(renderer);
  scene.environment = env;
  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2.5, 5, 4);
  const rim = new THREE.DirectionalLight(0xdfeeff, 1.6);
  rim.position.set(-4, 3, -3);
  const rim2 = new THREE.DirectionalLight(0x5cc8ff, 0.9);
  rim2.position.set(4, 2.5, -3.5);
  scene.add(key, rim, rim2, new THREE.HemisphereLight(0x202224, 0x000000, 0.45));

  // composer: scene (with backdrop), bloom (low strength, high threshold), output (ACES + sRGB).
  // Multisampled target: the bloom pipeline would otherwise bypass canvas MSAA and leave jagged edges.
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowPower ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lowPower ? 0.32 : 0.4, 0.65, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = innerWidth,
      h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    backdrop.mat.uniforms.uAspect!.value = w / h;
  };
  addEventListener("resize", resize);
  resize();

  // pointer parallax on fine pointers only
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = (e.clientY / innerHeight) * 2 - 1;
  };
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !useStory.getState().reduced)
    addEventListener("pointermove", onMove, { passive: true });

  // adaptive quality (ported): every 90 frames, if the average frame is slower than 1/42 s,
  // step DPR down (twice, floor 1), then disable bloom
  const perf = { acc: 0, n: 0, level: 0 };
  const adapt = (dt: number) => {
    perf.acc += dt;
    perf.n++;
    if (perf.n < 90) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg > 1 / 42 && avg < 0.5 && perf.level < 3) {
      perf.level++;
      if (perf.level <= 2) {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.35));
        resize();
      } else bloom.enabled = false;
    }
  };

  let device: DeviceHandles | null = null;
  const st = {
    cur: { ...KEYS.hero } as Key,
    tg: { ...KEYS.hero } as Key,
    fill: 0.1,
    lastMode: 1,
    pulse: 0,
    first: true,
    jHead: 0,
    drops: [] as { p: THREE.Vector3; v: THREE.Vector3; life: number; r: number }[],
  };
  const tmp = { v: new THREE.Vector3(), d: new THREE.Vector3(), o: new THREE.Vector3(), q: new THREE.Quaternion(), j: new THREE.Vector3(), dummy: new THREE.Object3D() };
  const timer = new THREE.Timer();
  let raf = 0;
  let running = false;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!device) return;
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const time = timer.getElapsed();
    const ST = useStory.getState();
    const reduced = ST.reduced;
    const s = st;
    const dv = device;
    const ids = ST.ids;
    const last = ids.length - 1;

    // keyframe interpolation between neighbouring scenes
    const S = Math.min(last, ST.S),
      i0 = Math.floor(S),
      i1 = Math.min(last, i0 + 1),
      f = ease(S - i0);
    const k0 = KEYS[ids[i0]!],
      k1 = KEYS[ids[i1]!];
    for (const k of KEY_NAMES) s.tg[k] = k0[k] + (k1[k] - k0[k]) * f;
    if (isMobile()) {
      // The prototype scaled distance by aspect ratio; pinning it to the 390x844 reference framing keeps
      // the device the same on-screen size on every phone/tablet layout (and matching poster-phone.jpg).
      const a = 390 / 844;
      s.tg.mx = 0;
      s.tg.dist *= 1 + 0.95 * (1 - a);
      s.tg.tgt -= 0.075 * s.tg.dist;
      s.tg.camY -= 0.04 * s.tg.dist;
    }
    const damp = reduced || s.first ? 1 : 1 - Math.pow(0.0015, dt);
    for (const k of KEY_NAMES) s.cur[k] += (s.tg[k] - s.cur[k]) * damp;
    const cur = s.cur;

    const sway = reduced ? 0 : cur.sway;
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.pow(0.02, dt));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.pow(0.02, dt));
    dv.world.position.set(cur.mx, Math.sin(time * 0.6) * 0.03 * sway, 0);
    dv.pivot.rotation.set(
      cur.rx + Math.sin(time * 0.45) * 0.02 * sway + ptr.sy * 0.07,
      cur.ry + Math.sin(time * 0.22) * 0.22 * sway + ptr.sx * 0.32,
      cur.rz,
    );

    // tank fill rises through the tank scene, stays full after
    const tankIdx = ids.indexOf("tank");
    const fT = S >= tankIdx + 0.5 ? 0.95 : 0.1 + 0.85 * Math.min(1, Math.max(0, (ST.t.tank ?? 0) / 0.6));
    s.fill += (fT - s.fill) * (reduced || s.first ? 1 : 1 - Math.pow(0.02, dt));
    dv.setFill(s.fill);
    dv.updateBubbles(time, dt, s.fill, reduced ? 0 : Math.max(0, 1 - Math.abs(S - tankIdx) * 1.5));

    const throb = reduced ? 1 : 0.94 + 0.06 * Math.sin(time * 0.9) + s.pulse * 0.12;
    dv.shadowMat.opacity = (0.35 + s.fill * 0.4) * throb;
    dv.shadow.scale.setScalar(1 + Math.abs(cur.rz) * 0.4);
    dv.coreLight.intensity = (0.4 + s.fill * 1.4) * throb;
    dv.poolLight.intensity = (0.3 + s.fill * 0.9) * throb;
    if (dv.waterMat) dv.waterMat.emissiveIntensity = 0.38 + s.fill * 0.22 + (reduced ? 0 : 0.05 * Math.sin(time * 0.9)) + s.pulse * 0.25;
    camera.position.set(0, cur.camY, cur.dist);
    camera.lookAt(0, cur.tgt, 0);

    // mode indicator: the dots pulse on each mode change
    const mode = ST.mode || 1;
    if (mode !== s.lastMode) {
      s.pulse = reduced ? 0 : 1;
      s.lastMode = mode;
    }
    s.pulse *= Math.pow(0.04, dt);
    const modeOn = Math.max(0, 1 - Math.abs(S - ids.indexOf("modes")) * 1.6);
    const n = dv.dotMats.length;
    dv.dotMats.forEach((m, i) => {
      m.emissiveIntensity = 0.2 + modeOn * (1.6 + s.pulse * 1.5) * (i < Math.ceil((mode * n) / 5) ? 1 : 0.1);
    });

    // spare tips orbit
    dv.spares.forEach((t, i) => {
      const sp = cur.spread,
        a = (i / 5) * Math.PI * 2 + (reduced ? 0 : time * 0.12),
        R = 1.15 * sp;
      t.visible = sp > 0.01;
      t.scale.setScalar(Math.max(0.0001, sp * 0.95));
      t.position.set(Math.cos(a) * R, 1.3, Math.sin(a) * R);
      t.rotation.set(0, -a + Math.PI / 2, 0);
    });

    // charging: light ring climbs the body, plug floats alongside (never plugged in: port position unconfirmed)
    const ch = cur.charge;
    const yS = reduced ? 0.5 : (time * 0.32) % 1;
    dv.sweep.position.y = 0.1 + yS * 2.8;
    dv.sweepMat.opacity = ch * Math.sin(yS * Math.PI) * 0.4;
    const rr = radiusAt(Math.max(1.25, dv.sweep.position.y)) || 0.4;
    dv.sweep.scale.set(rr / 0.42 + 0.03, (rr / 0.42) * OVAL + 0.03, 1);
    dv.sweep.visible = ch > 0.02;
    dv.plug.visible = ch > 0.05;
    dv.plug.position.set(0.82, 0.45 + (1 - ch) * -2 + (reduced ? 0 : Math.sin(time * 1.2) * 0.04), 0.1);
    dv.plug.rotation.set(0, -0.5, 0.18 + (reduced ? 0 : Math.sin(time * 0.9) * 0.05));

    // jet: instanced droplets from the tip along its direction, with gravity
    scene.updateMatrixWorld();
    dv.tip.localToWorld(tmp.o.copy(dv.tipEnd));
    dv.tip.getWorldQuaternion(tmp.q);
    tmp.d.copy(dv.tipDir).applyQuaternion(tmp.q);
    const beat = 0.55 + 0.45 * Math.sin(time * (3 + mode * 2.4));
    const rate = reduced ? 0 : cur.jet * (180 + mode * 40) * (mode === 1 ? 1 : beat * 1.4) * (lowPower ? 0.6 : 1);
    let spawn = rate * dt + Math.random();
    const drops = s.drops;
    const JN = drops.length;
    while (spawn-- > 1) {
      const d = drops[s.jHead]!;
      s.jHead = (s.jHead + 1) % JN;
      d.p.copy(tmp.o);
      tmp.j.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.16);
      d.v.copy(tmp.d).multiplyScalar(2.6 + mode * 0.25 + Math.random() * 0.5).add(tmp.j);
      d.life = 1;
      d.r = 0.004 + Math.random() * 0.008;
    }
    const dummy = tmp.dummy;
    for (let i = 0; i < JN; i++) {
      const d = drops[i]!;
      if (d.life > 0) {
        d.v.y -= 4.2 * dt;
        d.p.addScaledVector(d.v, dt);
        d.life -= dt * 0.9;
      }
      const sc = d.life > 0 ? Math.min(0.012, d.r) * Math.min(1, d.life * 3) : 0;
      dummy.position.copy(d.p);
      dummy.lookAt(tmp.v.copy(d.p).add(d.v));
      dummy.scale.set(sc, sc, sc * (1 + d.v.length() * 0.9));
      dummy.updateMatrix();
      dv.jet.setMatrixAt(i, dummy.matrix);
    }
    dv.jet.instanceMatrix.needsUpdate = true;

    // backdrop lift follows the device (and slightly the pointer)
    const u = backdrop.mat.uniforms;
    u.uTime!.value = reduced ? 10 : time;
    dv.dev.localToWorld(tmp.v.set(0, 0.65, 0)).project(camera);
    (u.uCore!.value as THREE.Vector2).set(tmp.v.x * 0.5 + 0.5 + ptr.sx * 0.035, tmp.v.y * 0.5 + 0.5 - ptr.sy * 0.03);
    u.uCoreAmt!.value = s.fill;

    composer.render(dt);
    if (s.first) {
      s.first = false;
      onFirstFrame();
    } else adapt(rawDt);
  }

  return {
    setDevice(d) {
      if (device) {
        scene.remove(device.world, device.jet);
        device.dispose();
      }
      device = d;
      st.drops = Array.from({ length: d.jetCount }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, r: 0 }));
      st.jHead = 0;
      scene.add(d.world, d.jet);
    },
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) {
        timer.update(); // don't jump after a pause
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    },
    dispose() {
      cancelAnimationFrame(raf);
      running = false;
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      if (device) {
        scene.remove(device.world, device.jet);
        device.dispose();
        device = null;
      }
      backdrop.mesh.geometry.dispose();
      backdrop.mat.dispose();
      env.dispose();
      composer.dispose();
      rt.dispose();
      renderer.dispose();
    },
  };
}
