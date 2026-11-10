"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateGlb } from "@/lib/studio/bundle";
import type { Outfit } from "@/lib/studio/outfit";
import type { CameraState } from "@/lib/v2/contracts";

export type ModelAsset = { id: string; name: string; bytes: ArrayBuffer };
export type LookbookShot = { angle: "current" | "front" | "side" | "back"; background: "neutral" | "white" | "dark" };
export const LOOKBOOK_BACKGROUNDS: Record<LookbookShot["background"], string> = { neutral: "#e4e4e0", white: "#ffffff", dark: "#1d1d1f" };
export type ViewerControl = {
  getCamera(): CameraState | null;
  setCamera(camera: CameraState): void;
  /** Renders the exact scene on screen (same avatar, items, versions, lights) to a PNG. No generative step. */
  capture(shot: LookbookShot): Promise<Blob | null>;
};
function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of materials) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
      m.dispose();
    }
  });
  for (const t of textures) {
    const data = t.source?.data;
    if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap) data.close();
    t.dispose();
  }
}
type Scene = {
  world: THREE.Group;
  loader: GLTFLoader;
  models: Map<string, THREE.Object3D>;
  loading: Set<string>;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  radius: number;
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Mirrors the camera on the canvas host (data-camera) so automated checks can verify save/reopen. */
function mark(s: Scene) {
  s.host.setAttribute("data-camera", JSON.stringify([...s.camera.position.toArray(), ...s.controls.target.toArray()].map(round)));
}
function applyCamera(s: Scene, c: CameraState) {
  const pos = new THREE.Vector3(...c.position);
  const target = new THREE.Vector3(...c.target);
  const distance = THREE.MathUtils.clamp(pos.distanceTo(target), s.controls.minDistance, s.controls.maxDistance);
  const dir = pos.sub(target).normalize();
  if (!Number.isFinite(dir.x)) return;
  s.controls.target.copy(target);
  s.camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
  s.controls.update();
  mark(s);
}

/**
 * Body and every outfit item share ONE world transform (computed from the body), so items prepared
 * in the body's frame stay aligned. Items load incrementally into a cache; `shown` only toggles
 * visibility, so switching a slot never reloads the body or resets the camera.
 */
export default function Viewer({
  avatar,
  items,
  shown,
  onLoaded,
  onFailed,
  controlRef,
  initialCamera,
}: {
  avatar: ModelAsset;
  items: ModelAsset[];
  shown: Outfit;
  onLoaded?: (id: string) => void;
  onFailed?: (id: string) => void;
  controlRef?: RefObject<ViewerControl | null>;
  initialCamera?: CameraState | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<Scene | null>(null);
  const shownRef = useRef(shown);
  const callbacks = useRef({ onLoaded, onFailed });
  const firstCamera = useRef(initialCamera);
  const [message, setMessage] = useState("Loading 3D models…");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(!!initialCamera?.autoOrbit);
  const autoRef = useRef(autoOrbit);
  useEffect(() => {
    callbacks.current = { onLoaded, onFailed };
    shownRef.current = shown;
  });
  useEffect(() => {
    autoRef.current = autoOrbit;
    if (state.current) state.current.controls.autoRotate = autoOrbit;
  }, [autoOrbit]);
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      getCamera() {
        const s = state.current;
        if (!s) return null;
        return {
          position: s.camera.position.toArray().map(round) as [number, number, number],
          target: s.controls.target.toArray().map(round) as [number, number, number],
          autoOrbit: autoRef.current,
        };
      },
      setCamera(c) {
        const s = state.current;
        if (!s) {
          firstCamera.current = c;
          return;
        }
        applyCamera(s, c);
        setAutoOrbit(c.autoOrbit);
      },
      async capture(shot) {
        const s = state.current;
        if (!s) return null;
        const background = s.scene.background;
        const position = s.camera.position.clone();
        const target = s.controls.target.clone();
        const rotating = s.controls.autoRotate;
        s.controls.autoRotate = false;
        try {
          if (shot.angle !== "current") {
            const angle = { front: 0, side: Math.PI / 2, back: Math.PI }[shot.angle];
            s.camera.position.set(Math.sin(angle) * s.radius * 1.65, s.radius * .12, Math.cos(angle) * s.radius * 1.65);
            s.camera.lookAt(0, 0, 0);
          }
          s.scene.background = new THREE.Color(LOOKBOOK_BACKGROUNDS[shot.background]);
          s.renderer.render(s.scene, s.camera);
          return await new Promise<Blob | null>((resolve) => s.renderer.domElement.toBlob(resolve, "image/png"));
        } finally {
          s.scene.background = background;
          s.camera.position.copy(position);
          s.controls.target.copy(target);
          s.controls.autoRotate = rotating;
          s.controls.update();
        }
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);
  // The body defines the scene; it is loaded once per avatar version.
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let alive = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e4e4e0");
    const world = new THREE.Group();
    scene.add(world);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    catch { queueMicrotask(() => { if (alive) { setFailed(true); setMessage("Unable to start WebGL. Enable hardware acceleration or try another browser."); } }); return () => { alive = false; }; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "3D avatar; drag to orbit and scroll to zoom");
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.autoRotateSpeed = 0.9;
    controls.autoRotate = autoRef.current;
    // Neutral white light so garment colors are judged without a color cast.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa0a09a, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1); fill.position.set(-4, 2, -3); scene.add(fill);
    const models = new Map<string, THREE.Object3D>();
    const loader = new GLTFLoader();
    // Defense in depth: never resolve network resources from imported models.
    loader.manager.setURLModifier(url => { if (!url.startsWith("blob:") && !url.startsWith("data:")) throw new Error("External resource blocked"); return url; });
    const observer = new ResizeObserver(() => {
      const w = element.clientWidth, h = element.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    observer.observe(element);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    void (async () => {
      try {
        validateGlb(avatar.bytes);
        const gltf = await loader.parseAsync(avatar.bytes, "");
        if (!alive) { disposeObject(gltf.scene); return; }
        const body = gltf.scene;
        world.add(body); models.set(avatar.id, body);
        const box = new THREE.Box3().setFromObject(body);
        if (box.isEmpty()) throw new Error("This avatar contains no geometry.");
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        // Orbit distance that keeps the whole body (head to feet) in frame at this field of view.
        const fit = (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12 / 1.65;
        const radius = Math.max(size.length() * .75, fit);
        if (!Number.isFinite(radius) || radius < .001) throw new Error("Invalid avatar dimensions.");
        world.position.sub(center);
        // Front view by default.
        camera.position.set(0, radius * .12, radius * 1.65);
        camera.near = radius / 1000; camera.far = radius * 100; camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0); controls.minDistance = radius * .4; controls.maxDistance = radius * 4; controls.update();
        const s: Scene = { world, loader, models, loading: new Set(), camera, controls, radius, host: element, renderer, scene };
        if (firstCamera.current) applyCamera(s, firstCamera.current);
        else mark(s);
        controls.addEventListener("end", () => mark(s));
        state.current = s;
        setReady(true); setMessage("");
      } catch { if (alive) { setFailed(true); setMessage("Unable to read the model. Check that the GLB contains meshes and embedded textures with compatible coordinates."); } }
    })();
    const contextLost = (e: Event) => { e.preventDefault(); setFailed(true); setMessage("The browser lost its GPU connection. Reload the page to reopen the models."); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      alive = false; state.current = null; setReady(false); observer.disconnect(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      controls.dispose(); for (const model of models.values()) disposeObject(model);
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [avatar]);
  // Outfit items load into the cache as they arrive; none of them moves the shared world transform.
  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    for (const item of items) {
      if (s.models.has(item.id) || s.loading.has(item.id)) continue;
      s.loading.add(item.id);
      void (async () => {
        try {
          validateGlb(item.bytes);
          const gltf = await s.loader.parseAsync(item.bytes, "");
          if (state.current !== s) { disposeObject(gltf.scene); return; }
          const model = gltf.scene;
          model.visible = shownRef.current.top === item.id || shownRef.current.bottom === item.id;
          s.world.add(model); s.models.set(item.id, model);
          callbacks.current.onLoaded?.(item.id);
        } catch {
          if (state.current === s) callbacks.current.onFailed?.(item.id);
        } finally {
          s.loading.delete(item.id);
        }
      })();
    }
  }, [items, ready]);
  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    for (const [id, model] of s.models)
      // eslint-disable-next-line react-hooks/immutability -- Three.js scene objects are imperative renderer state, not React state.
      model.visible = id === avatar.id || id === shown.top || id === shown.bottom;
  }, [shown, ready, avatar]);
  function view(angle: number) {
    const s = state.current; if (!s) return;
    s.camera.position.set(Math.sin(angle) * s.radius * 1.65, s.radius * .12, Math.cos(angle) * s.radius * 1.65);
    s.controls.target.set(0, 0, 0); s.controls.update(); mark(s);
  }
  const pill = "rounded-full bg-white/90 px-4 py-2 text-xs text-neutral-900 shadow disabled:opacity-40";
  return <div className="relative h-[600px] lg:h-[660px] rounded-3xl overflow-hidden bg-[#e4e4e0]">
    <div ref={host} className="absolute inset-0" data-testid="viewer-canvas" />
    {message && <div role={failed ? "alert" : "status"} className="absolute inset-0 grid place-items-center p-12 text-center text-neutral-800 bg-[#e4e4e0]/90">{message}</div>}
    <div className="absolute bottom-5 inset-x-0 flex flex-wrap justify-center gap-2 px-3">
      {[["Front", 0], ["Side", Math.PI / 2], ["Back", Math.PI], ["Reset", 0]].map(([label, angle]) => <button disabled={!ready || failed} key={label} onClick={() => view(Number(angle))} className={pill}>{label}</button>)}
      <button disabled={!ready || failed} aria-pressed={autoOrbit} onClick={() => setAutoOrbit(v => !v)} className={`${pill} ${autoOrbit ? "!bg-neutral-900 !text-white" : ""}`}>
        {autoOrbit ? "Stop auto-orbit" : "Auto-orbit"}
      </button>
    </div>
  </div>;
}
