"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateGlb } from "@/lib/studio/bundle";

export type ModelAsset = { id: string; name: string; bytes: ArrayBuffer };
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
export default function Viewer({ assets, selected }: { assets: ModelAsset[]; selected: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ models: Map<string, THREE.Object3D>; camera: THREE.PerspectiveCamera; controls: OrbitControls; radius: number } | null>(null);
  const [message, setMessage] = useState("Đang tải mô hình 3D…");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Each bundle is loaded once; selection only toggles cached mesh visibility.
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let alive = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#deded8");
    const world = new THREE.Group();
    scene.add(world);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { queueMicrotask(() => { if (alive) { setFailed(true); setMessage("Không thể mở WebGL. Hãy bật tăng tốc đồ họa hoặc thử trình duyệt khác."); } }); return () => { alive = false; }; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Avatar 3D; kéo để xoay, cuộn để phóng to");
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x96968c, 2));
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
        for (const asset of assets) {
          validateGlb(asset.bytes);
          const gltf = await loader.parseAsync(asset.bytes, "");
          if (!alive) { disposeObject(gltf.scene); return; }
          const model = gltf.scene;
          model.visible = models.size === 0;
          world.add(model); models.set(asset.id, model);
        }
        const avatar = models.get(assets[0].id)!;
        const box = new THREE.Box3().setFromObject(avatar);
        if (box.isEmpty()) throw new Error("Avatar không chứa hình học.");
        const center = box.getCenter(new THREE.Vector3());
        const radius = box.getSize(new THREE.Vector3()).length() * .75;
        if (!Number.isFinite(radius) || radius < .001) throw new Error("Kích thước avatar không hợp lệ.");
        // One common transform preserves alignment between body and pre-draped clothes.
        world.position.sub(center);
        camera.position.set(0, radius * .12, radius * 1.65);
        camera.near = radius / 1000; camera.far = radius * 100; camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0); controls.minDistance = radius * .4; controls.maxDistance = radius * 4; controls.update();
        state.current = { models, camera, controls, radius };
        setReady(true); setMessage("");
      } catch { if (alive) { setFailed(true); setMessage("Không thể đọc mô hình. Kiểm tra GLB có mesh và texture nhúng, cùng hệ tọa độ."); } }
    })();
    const contextLost = (e: Event) => { e.preventDefault(); setFailed(true); setMessage("Mất kết nối GPU trình duyệt. Hãy tải lại trang để mở lại mô hình."); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      alive = false; state.current = null; observer.disconnect(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      controls.dispose(); for (const model of models.values()) disposeObject(model);
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [assets]);
  useEffect(() => {
    if (!ready || !state.current) return;
    // eslint-disable-next-line react-hooks/immutability -- Three.js scene objects are imperative renderer state, not React state.
    for (const [id, model] of state.current.models) model.visible = id === assets[0].id || id === selected;
  }, [selected, ready, assets]);
  function view(angle: number) {
    const s = state.current; if (!s) return;
    s.camera.position.set(Math.sin(angle) * s.radius * 1.65, s.radius * .12, Math.cos(angle) * s.radius * 1.65);
    s.controls.target.set(0, 0, 0); s.controls.update();
  }
  return <div className="relative h-full min-h-[520px] rounded-3xl overflow-hidden bg-[#deded8]">
    <div ref={host} className="absolute inset-0" />
    {message && <div role={failed ? "alert" : "status"} className="absolute inset-0 grid place-items-center p-12 text-center text-neutral-800 bg-[#deded8]/90">{message}</div>}
    <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2">
      {[["Trước", 0], ["Bên", Math.PI / 2], ["Sau", Math.PI], ["Đặt lại", 0]].map(([label, angle]) => <button disabled={!ready || failed} key={label} onClick={() => view(Number(angle))} className="rounded-full bg-white/90 px-4 py-2 text-xs text-neutral-900 shadow disabled:opacity-40">{label}</button>)}
    </div>
  </div>;
}
