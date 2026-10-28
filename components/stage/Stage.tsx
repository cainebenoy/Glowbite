"use client";
// The WebGL stage: a fixed, full-viewport R3F canvas behind the story. Ported from the prototype's
// <script type="module"> — same model, studio light, backdrop, jet, keyframes and bloom pipeline.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { poppins } from "@/lib/fonts";
import { useStory } from "./useStory";
import { adoptGltf, buildDevice, OVAL, radiusAt, type DeviceHandles } from "./model";
import { ease, KEY_NAMES, KEYS, type Key } from "./keyframes";

const isMobile = () => innerWidth < 860;

// ------------------------------------------------------------------ studio pieces
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

// ------------------------------------------------------------------ the scene + frame loop
function Studio({ device, onFirstFrame }: { device: DeviceHandles; onFirstFrame: () => void }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const lowPower = useMemo(() => isMobile() || (navigator.hardwareConcurrency || 8) <= 4, []);
  const backdrop = useMemo(createBackdrop, []);
  // adaptive quality (ported from the prototype): every 90 frames, if the average frame is slower
  // than 1/42 s, step DPR down (twice, floor 1), then disable bloom
  const perf = useRef({ acc: 0, n: 0, level: 0 });
  const setDpr = useThree((st) => st.setDpr);

  // studio env + lights
  useEffect(() => {
    const env = createEnvironment(gl);
    scene.environment = env;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.1;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);

  // composer: background + scene, bloom (low strength, high threshold), output (ACES + sRGB)
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lowPower ? 0.32 : 0.4, 0.65, 0.78);
    c.addPass(bloom);
    c.addPass(new OutputPass());
    return { c, bloom };
  }, [gl, scene, camera, lowPower]);
  useEffect(() => () => composer.c.dispose(), [composer]);
  useEffect(() => {
    composer.c.setPixelRatio(viewport.dpr);
    composer.c.setSize(size.width, size.height);
    backdrop.mat.uniforms.uAspect!.value = size.width / size.height;
  }, [composer, size, viewport.dpr, backdrop]);

  useEffect(
    () => () => {
      backdrop.mesh.geometry.dispose();
      backdrop.mat.dispose();
    },
    [backdrop],
  );

  // pointer parallax on fine pointers only
  const ptr = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || useStory.getState().reduced) return;
    const onMove = (e: PointerEvent) => {
      ptr.current.x = (e.clientX / innerWidth) * 2 - 1;
      ptr.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => removeEventListener("pointermove", onMove);
  }, []);

  // animation state
  const st = useRef({
    cur: { ...KEYS.hero } as Key,
    tg: { ...KEYS.hero } as Key,
    fill: 0.1,
    lastMode: 1,
    pulse: 0,
    first: true,
    jHead: 0,
    drops: Array.from({ length: device.jetCount }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, r: 0 })),
  });
  const tmp = useMemo(
    () => ({ v: new THREE.Vector3(), d: new THREE.Vector3(), o: new THREE.Vector3(), q: new THREE.Quaternion(), j: new THREE.Vector3(), dummy: new THREE.Object3D() }),
    [],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const time = state.clock.elapsedTime;
    const ST = useStory.getState();
    const reduced = ST.reduced;
    const s = st.current;
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
      const a = Math.min(1, innerWidth / innerHeight);
      s.tg.mx = 0;
      s.tg.dist *= 1 + 0.95 * (1 - a);
      s.tg.tgt -= 0.075 * s.tg.dist;
      s.tg.camY -= 0.04 * s.tg.dist;
    }
    const damp = reduced || s.first ? 1 : 1 - Math.pow(0.0015, dt);
    for (const k of KEY_NAMES) s.cur[k] += (s.tg[k] - s.cur[k]) * damp;
    const cur = s.cur;

    const sway = reduced ? 0 : cur.sway;
    const p = ptr.current;
    p.sx += (p.x - p.sx) * (1 - Math.pow(0.02, dt));
    p.sy += (p.y - p.sy) * (1 - Math.pow(0.02, dt));
    device.world.position.set(cur.mx, Math.sin(time * 0.6) * 0.03 * sway, 0);
    device.pivot.rotation.set(
      cur.rx + Math.sin(time * 0.45) * 0.02 * sway + p.sy * 0.07,
      cur.ry + Math.sin(time * 0.22) * 0.22 * sway + p.sx * 0.32,
      cur.rz,
    );

    // tank fill rises through the tank scene, stays full after
    const tankIdx = ids.indexOf("tank");
    const fT = S >= tankIdx + 0.5 ? 0.95 : 0.1 + 0.85 * Math.min(1, Math.max(0, (ST.t.tank ?? 0) / 0.6));
    s.fill += (fT - s.fill) * (reduced || s.first ? 1 : 1 - Math.pow(0.02, dt));
    device.water.scale.y = Math.max(0.01, s.fill * 1.03);

    const throb = reduced ? 1 : 0.94 + 0.06 * Math.sin(time * 0.9) + s.pulse * 0.12;
    device.shadowMat.opacity = (0.35 + s.fill * 0.4) * throb;
    device.shadow.scale.setScalar(1 + Math.abs(cur.rz) * 0.4);
    device.coreLight.intensity = (0.4 + s.fill * 1.4) * throb;
    device.poolLight.intensity = (0.3 + s.fill * 0.9) * throb;
    if (device.waterMat) device.waterMat.emissiveIntensity = 0.38 + s.fill * 0.22 + (reduced ? 0 : 0.05 * Math.sin(time * 0.9)) + s.pulse * 0.25;
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
    const n = device.dotMats.length;
    device.dotMats.forEach((m, i) => {
      m.emissiveIntensity = 0.2 + modeOn * (1.6 + s.pulse * 1.5) * (i < Math.ceil((mode * n) / 5) ? 1 : 0.1);
    });

    // spare tips orbit
    device.spares.forEach((t, i) => {
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
    device.sweep.position.y = 0.1 + yS * 2.8;
    device.sweepMat.opacity = ch * Math.sin(yS * Math.PI) * 0.4;
    const rr = radiusAt(Math.max(1.25, device.sweep.position.y)) || 0.4;
    device.sweep.scale.set(rr / 0.42 + 0.03, (rr / 0.42) * OVAL + 0.03, 1);
    device.sweep.visible = ch > 0.02;
    device.plug.visible = ch > 0.05;
    device.plug.position.set(0.82, 0.45 + (1 - ch) * -2 + (reduced ? 0 : Math.sin(time * 1.2) * 0.04), 0.1);
    device.plug.rotation.set(0, -0.5, 0.18 + (reduced ? 0 : Math.sin(time * 0.9) * 0.05));

    // jet: instanced droplets from the tip along its direction, with gravity
    scene.updateMatrixWorld();
    device.tip.localToWorld(tmp.o.copy(device.tipEnd));
    device.tip.getWorldQuaternion(tmp.q);
    tmp.d.copy(device.tipDir).applyQuaternion(tmp.q);
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
      device.jet.setMatrixAt(i, dummy.matrix);
    }
    device.jet.instanceMatrix.needsUpdate = true;

    // backdrop lift follows the device (and slightly the pointer)
    const u = backdrop.mat.uniforms;
    u.uTime!.value = reduced ? 10 : time;
    device.dev.localToWorld(tmp.v.set(0, 0.65, 0)).project(camera);
    (u.uCore!.value as THREE.Vector2).set(tmp.v.x * 0.5 + 0.5 + p.sx * 0.035, tmp.v.y * 0.5 + 0.5 - p.sy * 0.03);
    u.uCoreAmt!.value = s.fill;

    composer.c.render(dt);
    if (s.first) {
      s.first = false;
      onFirstFrame();
      return;
    }
    const pf = perf.current;
    pf.acc += rawDt;
    pf.n++;
    if (pf.n >= 90) {
      const avg = pf.acc / pf.n;
      pf.acc = 0;
      pf.n = 0;
      if (avg > 1 / 42 && avg < 0.5 && pf.level < 3) {
        pf.level++;
        if (pf.level <= 2) setDpr(Math.max(1, gl.getPixelRatio() - 0.35));
        else composer.bloom.enabled = false;
      }
    }
  }, 1);

  return (
    <>
      <primitive object={backdrop.mesh} />
      <primitive object={device.world} />
      <primitive object={device.jet} />
      <directionalLight color={0xffffff} intensity={1.3} position={[2.5, 5, 4]} />
      <directionalLight color={0xdfeeff} intensity={1.6} position={[-4, 3, -3]} />
      <directionalLight color={0x5cc8ff} intensity={0.9} position={[4, 2.5, -3.5]} />
      <hemisphereLight args={[0x202224, 0x000000, 0.45]} />
    </>
  );
}

function Device({ hasGlb, onReady }: { hasGlb: boolean; onReady: () => void }) {
  const [device, setDevice] = useState<DeviceHandles | null>(null);

  useEffect(() => {
    const lowPower = isMobile() || (navigator.hardwareConcurrency || 8) <= 4;
    let cancelled = false;
    let handles: DeviceHandles | null = null;
    const procedural = () => {
      handles = buildDevice({ lowPower, logoFont: poppins.style.fontFamily });
      // repaint the printed logo once Poppins 600 has loaded
      document.fonts?.load(`600 150px ${poppins.style.fontFamily}`).then(() => handles?.redrawLogo()).catch(() => {});
      if (!cancelled) setDevice(handles);
    };
    if (hasGlb) {
      (async () => {
        try {
          const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
            import("three/examples/jsm/loaders/GLTFLoader.js"),
            import("three/examples/jsm/loaders/DRACOLoader.js"),
          ]);
          const loader = new GLTFLoader();
          const draco = new DRACOLoader().setDecoderPath("/draco/");
          loader.setDRACOLoader(draco);
          const gltf = await loader.loadAsync("/models/glowbite.glb");
          draco.dispose();
          handles = adoptGltf(gltf.scene, { lowPower });
          if (!cancelled) setDevice(handles);
        } catch (e) {
          console.warn("[stage] GLB failed to load, using the procedural model", e);
          if (!cancelled) procedural();
        }
      })();
    } else procedural();
    return () => {
      cancelled = true;
      handles?.dispose();
    };
  }, [hasGlb]);

  return device ? <Studio device={device} onFirstFrame={onReady} /> : null;
}

export default function Stage({ hasGlb }: { hasGlb: boolean }) {
  const active = useStory((s) => s.stageActive);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const maxDpr = useMemo(() => (isMobile() ? 1.5 : 2), []);

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onReady = () => {
    setReady(true);
    document.documentElement.classList.add("gl-on");
  };
  useEffect(() => () => document.documentElement.classList.remove("gl-on"), []);

  const running = active && visible;
  return (
    <Canvas
      className={`stage-canvas${ready ? " ready" : ""}${running ? "" : " paused"}`}
      aria-hidden="true"
      frameloop={running ? "always" : "never"}
      dpr={[1, maxDpr]}
      camera={{ fov: 30, near: 0.05, far: 100, position: [0, 2.5, 9] }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      style={{ position: "fixed", pointerEvents: "none" }}
    >
      <Device hasGlb={hasGlb} onReady={onReady} />
    </Canvas>
  );
}
