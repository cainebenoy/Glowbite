// Procedural Glowbite device, ported from the approved prototype (reference/prototype.html).
// Built once, imperatively, and handed to R3F as a <primitive>. Everything created here is
// tracked so dispose() frees all GPU resources on unmount.
import * as THREE from "three";

export const OVAL = 0.88;
// body + tank outline measured from the front product photo (bottom of tank = 0)
export const BODY: [number, number][] = [
  [0.375, 1.245], [0.366, 1.33], [0.355, 1.445], [0.338, 1.57], [0.325, 1.695], [0.316, 1.82], [0.3125, 1.945],
  [0.3125, 2.195], [0.318, 2.32], [0.33, 2.445], [0.345, 2.57], [0.3575, 2.695], [0.3585, 2.79], [0.354, 2.845],
  [0.338, 2.885], [0.305, 2.918], [0.262, 2.943], [0.205, 2.962], [0.14, 2.975], [0, 2.985],
];

/** Body radius at height y (front-view half width). */
export function radiusAt(y: number): number {
  for (let i = 0; i < BODY.length - 1; i++) {
    const [r0, y0] = BODY[i]!,
      [r1, y1] = BODY[i + 1]!;
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return BODY[0]![0];
}

/** Front surface depth of the oval body at (x, y). */
export function surfZ(x: number, y: number): number {
  const a = radiusAt(y),
    b = a * OVAL;
  const k = Math.min(0.999, Math.abs(x) / a);
  return b * Math.sqrt(1 - k * k);
}

const NEON = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);

export type DeviceHandles = {
  world: THREE.Group;
  pivot: THREE.Group;
  dev: THREE.Group;
  water: THREE.Object3D;
  waterMat: THREE.MeshPhysicalMaterial | null;
  dotMats: THREE.MeshStandardMaterial[];
  tip: THREE.Object3D;
  tipEnd: THREE.Vector3;
  tipDir: THREE.Vector3;
  sweep: THREE.Mesh;
  sweepMat: THREE.MeshBasicMaterial;
  plug: THREE.Group;
  shadow: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
  coreLight: THREE.PointLight;
  poolLight: THREE.PointLight;
  spares: THREE.Group[];
  jet: THREE.InstancedMesh;
  jetCount: number;
  redrawLogo: () => void;
  dispose: () => void;
};

type Tracker = { geos: Set<THREE.BufferGeometry>; mats: Set<THREE.Material>; texs: Set<THREE.Texture> };

function track<T extends THREE.Object3D>(t: Tracker, o: T): T {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) t.geos.add(m.geometry);
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      t.mats.add(mat);
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) t.texs.add(v);
    }
  });
  return o;
}

export function createMaterials() {
  return {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xf3f4f5, roughness: 0.38, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.15, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1 }),
    shellEdge: new THREE.MeshPhysicalMaterial({ color: 0xd9dde1, roughness: 0.45, clearcoat: 0.3 }),
    tank: new THREE.MeshPhysicalMaterial({ color: 0xbfeaff, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x2aa8e8, emissive: 0x0a8cff, emissiveIntensity: 0.5, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false }),
    hose: new THREE.MeshPhysicalMaterial({ color: 0xf4f8fa, emissive: 0x9fe6ff, emissiveIntensity: 0.15, roughness: 0.35, transparent: true, opacity: 0.95 }),
    clear: new THREE.MeshPhysicalMaterial({ color: 0xdff2fb, emissive: 0x0090d0, emissiveIntensity: 0.05, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.7, depthWrite: false, envMapIntensity: 2 }),
    drop: new THREE.MeshBasicMaterial({ color: NEON(0xcff2ff, 1.25), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }),
    glow: new THREE.MeshBasicMaterial({ color: NEON(0x7fdcff, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
}
type Mats = ReturnType<typeof createMaterials>;

const lathe = (pts: [number, number][], seg = 96) =>
  new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

/** Wrap a front-facing flat geometry onto the curved body. */
function conform(geo: THREE.BufferGeometry, cy: number, lift: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i) + cy,
      z = p.getZ(i);
    p.setXYZ(i, x, y, surfZ(x, y) + lift + z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function iconTexture(kind: "power" | "mode") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f2f3f4";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#8b9198";
  g.lineWidth = 9;
  g.lineCap = "round";
  if (kind === "power") {
    g.beginPath();
    g.arc(128, 136, 44, -Math.PI * 0.3, Math.PI * 1.3);
    g.stroke();
    g.beginPath();
    g.moveTo(128, 72);
    g.lineTo(128, 128);
    g.stroke();
  } else {
    g.setLineDash([16, 14]);
    g.beginPath();
    g.arc(128, 128, 40, 0, Math.PI * 2);
    g.stroke();
  }
  return canvasTexture(c);
}

/** Clear jet tip with a soft bend and rounded nozzle. */
export function makeTip(M: Pick<Mats, "clear">) {
  const g = new THREE.Group();
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.45, 0),
    new THREE.Vector3(0, 0.74, 0.005),
    new THREE.Vector3(0, 0.83, 0.035),
    new THREE.Vector3(0, 0.885, 0.085),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.021, 20), M.clear);
  tube.renderOrder = 5;
  g.add(tube);
  const base = new THREE.Mesh(lathe([[0, 0], [0.04, 0], [0.042, 0.03], [0.03, 0.06], [0.024, 0.08], [0, 0.08]], 48), M.clear);
  base.renderOrder = 5;
  g.add(base);
  const nib = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), M.clear);
  nib.position.set(0, 0.885, 0.085);
  g.add(nib);
  return g;
}

/** Shared scaffolding: pivot hierarchy, charging ring, plug, floor glow, lights, spare tips, jet. */
function buildCommon(M: Mats, T: Tracker, lowPower: boolean) {
  const world = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 1.95;
  world.add(pivot);
  const dev = new THREE.Group();
  dev.position.y = -1.95;
  pivot.add(dev);

  // charging moment: a ring of light sweeping the body + a USB-C plug floating alongside
  const sweep = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.004, 8, 160), M.glow);
  sweep.rotation.x = Math.PI / 2;
  sweep.scale.y = OVAL;
  world.add(sweep);

  const plug = new THREE.Group();
  {
    const bodyP = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 8, 24), M.shell);
    bodyP.scale.x = 1.45;
    plug.add(bodyP);
    const metal = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.017, 0.05, 6, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xd9dee3, metalness: 1, roughness: 0.2 }),
    );
    metal.rotation.z = Math.PI / 2;
    metal.position.y = 0.15;
    metal.scale.z = 0.45;
    plug.add(metal);
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.12, 0),
          new THREE.Vector3(0, -0.5, -0.05),
          new THREE.Vector3(0.2, -1.2, -0.3),
          new THREE.Vector3(0.5, -2.4, -0.6),
        ]),
        80,
        0.022,
        12,
      ),
      M.shell,
    );
    plug.add(cord);
  }
  world.add(plug);

  // small additive floor glow
  const shCv = document.createElement("canvas");
  shCv.width = shCv.height = 256;
  {
    const c = shCv.getContext("2d")!,
      g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(90,190,255,.42)");
    g.addColorStop(0.22, "rgba(30,120,220,.1)");
    g.addColorStop(0.55, "rgba(0,60,160,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }
  const shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.17;
  world.add(shadow);

  const coreLight = new THREE.PointLight(0x2ab8ff, 2, 3, 1.8);
  coreLight.position.set(0, 0.55, 0.75);
  dev.add(coreLight);
  const poolLight = new THREE.PointLight(0x2ab8ff, 1, 2.5, 2);
  poolLight.position.set(0, -0.05, 0);
  world.add(poolLight);

  const spares = Array.from({ length: 5 }, () => {
    const t = makeTip(M);
    t.scale.setScalar(0.0001);
    t.visible = false;
    world.add(t);
    return t;
  });

  const jetCount = lowPower ? 420 : 760;
  const jet = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), M.drop, jetCount);
  jet.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < jetCount; i++) jet.setMatrixAt(i, zero);

  track(T, world);
  track(T, jet);
  return { world, pivot, dev, sweep, sweepMat: M.glow, plug, shadow, shadowMat, coreLight, poolLight, spares, jet, jetCount };
}

/** The hand-built model (default). */
export function buildDevice(opts: { lowPower: boolean; logoFont: string }): DeviceHandles {
  const T: Tracker = { geos: new Set(), mats: new Set(), texs: new Set() };
  const M = createMaterials();
  const common = buildCommon(M, T, opts.lowPower);
  const { dev } = common;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = dev) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  // tank: clear, slightly flared toward the base, thick clear floor
  const tank = add(lathe([[0.0, 0.0], [0.43, 0.0], [0.458, 0.012], [0.4625, 0.05], [0.4525, 0.2], [0.4425, 0.32], [0.425, 0.52], [0.4075, 0.695], [0.392, 0.95], [0.38, 1.195], [0.376, 1.245]]), M.tank);
  tank.scale.z = OVAL;
  tank.renderOrder = 4;
  const floor = add(new THREE.CylinderGeometry(0.44, 0.455, 0.05, 96), M.clear);
  floor.position.y = 0.03;
  floor.scale.z = OVAL;
  const water = add(lathe([[0, 0], [0.43, 0], [0.43, 0.02], [0.36, 1], [0, 1]]), M.water);
  water.position.y = 0.06;
  water.scale.set(1, 0.1, OVAL);
  water.renderOrder = 2;

  // white cap at the top of the tank + hose (visible through the clear walls)
  add(lathe([[0, 1.12], [0.35, 1.12], [0.362, 1.14], [0.37, 1.245], [0, 1.245]]), M.shell).scale.z = OVAL;
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 32), M.shell).position.set(0.03, 1.08, 0.02);
  const hosePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.03, 1.05, 0.02),
    new THREE.Vector3(0.07, 0.85, 0.06),
    new THREE.Vector3(0.1, 0.62, 0.07),
    new THREE.Vector3(0.03, 0.38, 0.06),
    new THREE.Vector3(-0.04, 0.18, 0.03),
    new THREE.Vector3(-0.06, 0.07, 0),
  ]);
  add(new THREE.TubeGeometry(hosePath, 80, 0.026, 16), M.hose).renderOrder = 1;
  add(new THREE.SphereGeometry(0.032, 16, 12), M.hose).position.set(-0.06, 0.065, 0);

  // body: satin white, gently waisted
  add(lathe(BODY, 128), M.shell).scale.z = OVAL;
  const seam = add(new THREE.TorusGeometry(0.376, 0.005, 8, 128), M.shellEdge);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 1.245;
  seam.scale.y = OVAL;
  // collar + tip holder on the domed top
  add(lathe([[0, 2.96], [0.095, 2.96], [0.1, 2.99], [0.092, 3.02], [0.06, 3.035], [0, 3.035]]), M.shell);

  // front control panel: raised pill that follows the body curve
  const PANEL_Y = 2.24;
  const panelCv = document.createElement("canvas");
  panelCv.width = 360;
  panelCv.height = 830;
  {
    const g = panelCv.getContext("2d")!,
      W = 360,
      H = 830;
    const pill = (inset: number) => {
      const r = (W - inset * 2) / 2;
      g.beginPath();
      g.moveTo(inset, inset + r);
      g.arc(W / 2, inset + r, r, Math.PI, 0);
      g.lineTo(W - inset, H - inset - r);
      g.arc(W / 2, H - inset - r, r, 0, Math.PI);
      g.closePath();
    };
    pill(4);
    g.lineWidth = 5;
    g.strokeStyle = "rgba(150,158,166,.55)";
    g.stroke();
    pill(10);
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, "#e6e8ea");
    gr.addColorStop(0.18, "#f6f7f8");
    gr.addColorStop(0.82, "#f3f4f5");
    gr.addColorStop(1, "#dfe2e5");
    g.fillStyle = gr;
    g.fill();
    pill(10);
    g.lineWidth = 3;
    g.strokeStyle = "rgba(255,255,255,.9)";
    g.stroke();
  }
  add(
    conform(new THREE.PlaneGeometry(0.36, 0.83, 36, 80), PANEL_Y, 0.0025),
    new THREE.MeshPhysicalMaterial({ map: canvasTexture(panelCv), transparent: true, roughness: 0.45, clearcoat: 0.3, polygonOffset: true, polygonOffsetFactor: -1 }),
  );

  const button = (y: number, kind: "power" | "mode") => {
    const g = new THREE.Group();
    const z = surfZ(0, y) + 0.003;
    const cap = new THREE.Mesh(lathe([[0, 0.022], [0.07, 0.02], [0.088, 0.012], [0.098, 0], [0, 0]], 64), M.shell);
    cap.rotation.x = Math.PI / 2;
    g.add(cap);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48), new THREE.MeshPhysicalMaterial({ map: iconTexture(kind), roughness: 0.45, clearcoat: 0.3 }));
    face.position.z = 0.0225;
    g.add(face);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 8, 64), M.shellEdge));
    g.position.set(0, y, z);
    dev.add(g);
  };
  button(2.4575, "power");
  button(2.02, "mode");

  // three indicator dots (the unit shows 3; copy says 5 modes until confirmed)
  const dotMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0x9aa3ab, emissive: 0x5cd6ff, emissiveIntensity: 0.2, roughness: 0.4 }));
  [2.3575, 2.27, 2.19].forEach((y, i) => {
    add(new THREE.SphereGeometry(0.007, 12, 10), dotMats[i]!).position.set(0, y, surfZ(0, y) + 0.006);
  });

  // printed logo: "Gl⚡wbite" in grey, wrapped onto the body
  const logoCv = document.createElement("canvas");
  logoCv.width = 1024;
  logoCv.height = 256;
  const logoTex = canvasTexture(logoCv);
  const redrawLogo = () => {
    const g = logoCv.getContext("2d")!;
    g.clearRect(0, 0, 1024, 256);
    g.fillStyle = "#8c9198";
    g.font = `600 150px ${opts.logoFont}, "Helvetica Neue", Arial, sans-serif`;
    g.textBaseline = "alphabetic";
    const a = "Gl",
      b = "wbite",
      wa = g.measureText(a).width,
      wb = g.measureText(b).width,
      wBolt = 78,
      total = wa + wBolt + wb;
    let x = (1024 - total) / 2;
    const base = 182;
    g.fillText(a, x, base);
    x += wa;
    g.beginPath(); // bolt standing in for the "o"
    const bx = x + 4,
      by = base - 140;
    g.moveTo(bx + 58, by);
    g.lineTo(bx + 16, by + 82);
    g.lineTo(bx + 40, by + 82);
    g.lineTo(bx + 14, by + 160);
    g.lineTo(bx + 70, by + 64);
    g.lineTo(bx + 44, by + 64);
    g.lineTo(bx + 74, by);
    g.closePath();
    g.fill();
    x += wBolt;
    g.fillText(b, x, base);
    logoTex.needsUpdate = true;
  };
  redrawLogo();
  add(
    conform(new THREE.PlaneGeometry(0.4, 0.1, 32, 4), 1.585, 0.0015),
    new THREE.MeshPhysicalMaterial({ map: logoTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );

  const tip = makeTip(M);
  tip.position.y = 3.03;
  dev.add(tip);

  track(T, dev);
  return {
    ...common,
    water,
    waterMat: M.water,
    dotMats,
    tip,
    tipEnd: new THREE.Vector3(0, 0.9, 0.1),
    tipDir: new THREE.Vector3(0, 0.5, 0.87).normalize(),
    redrawLogo,
    dispose: () => disposeAll(T),
  };
}

/**
 * Manufacturer CAD slot. The GLB replaces the hand-built body; the story still needs three nodes:
 *  - `water`: the water volume inside the tank, origin at the tank floor; scaled on Y with fill (0..1)
 *  - `dots`:  the indicator dot(s); every mesh below it gets an emissive glow on mode changes
 *  - `tip`:   an object at the nozzle exit; the jet emits along its local +Y axis
 * Units: metres-ish to match the procedural model (device ≈ 3.9 units tall, tank base at y = 0).
 */
export function adoptGltf(scene: THREE.Object3D, opts: { lowPower: boolean }): DeviceHandles {
  const T: Tracker = { geos: new Set(), mats: new Set(), texs: new Set() };
  const M = createMaterials();
  const common = buildCommon(M, T, opts.lowPower);
  common.dev.add(scene);
  track(T, scene);
  const water = scene.getObjectByName("water") ?? new THREE.Object3D();
  const waterMat = ((water as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined) ?? null;
  const dotMats: THREE.MeshStandardMaterial[] = [];
  scene.getObjectByName("dots")?.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && "emissiveIntensity" in m) {
      if (m.emissive.getHex() === 0) m.emissive.setHex(0x5cd6ff);
      dotMats.push(m);
    }
  });
  const tip = scene.getObjectByName("tip") ?? common.dev;
  return {
    ...common,
    water,
    waterMat,
    dotMats,
    tip,
    tipEnd: new THREE.Vector3(0, 0, 0),
    tipDir: new THREE.Vector3(0, 1, 0),
    redrawLogo: () => {},
    dispose: () => disposeAll(T),
  };
}

function disposeAll(T: Tracker) {
  T.geos.forEach((g) => g.dispose());
  T.mats.forEach((m) => m.dispose());
  T.texs.forEach((t) => t.dispose());
}
