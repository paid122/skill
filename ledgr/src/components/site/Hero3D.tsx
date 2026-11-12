"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Original 3D hero: the LEDGR mark (an L built from a ledger spine, baseline and two ruled
 * entry lines) in glossy white, floating in a field of drifting ledger lines.
 * three.js is loaded on demand; reduced-motion users get a single still frame.
 */
export function Hero3D({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const el = host.current;
      if (!el) return;
      let THREE: typeof import("three");
      let RoomEnvironment: typeof import("three/examples/jsm/environments/RoomEnvironment.js").RoomEnvironment;
      try {
        THREE = await import("three");
        ({ RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js"));
      } catch { setFailed(true); return; }
      if (disposed) return;

      let renderer: import("three").WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
      catch { setFailed(true); return; }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.2, 9.5);

      // --- The mark -------------------------------------------------------
      const mark = new THREE.Group();
      const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, metalness: 0.15, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
      const graphite = new THREE.MeshPhysicalMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.28, clearcoat: 0.6 });
      const bevel = { depth: 0.55, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6, curveSegments: 8 };
      const lShape = new THREE.Shape();
      // An L: spine 0.62 wide × 3.4 tall, baseline 2.9 long × 0.62 high
      lShape.moveTo(-1.45, -1.7); lShape.lineTo(1.45, -1.7); lShape.lineTo(1.45, -1.08); lShape.lineTo(-0.83, -1.08); lShape.lineTo(-0.83, 1.7); lShape.lineTo(-1.45, 1.7); lShape.closePath();
      const lGeo = new THREE.ExtrudeGeometry(lShape, bevel);
      lGeo.center();
      mark.add(new THREE.Mesh(lGeo, white));
      const ruled = (w: number, y: number) => {
        const g = new THREE.BoxGeometry(w, 0.16, 0.3, 1, 1, 1);
        const m = new THREE.Mesh(g, graphite);
        m.position.set(-0.83 + 0.42 + w / 2 + 0.05, y, 0.05);
        return m;
      };
      mark.add(ruled(1.3, 0.35), ruled(1.85, -0.38));
      mark.rotation.set(-0.12, -0.42, 0.02);
      scene.add(mark);

      // --- Ledger lines field ----------------------------------------------
      const lines = new THREE.Group();
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09 });
      const lineData: { mesh: import("three").Mesh; base: number; phase: number; speed: number }[] = [];
      for (let i = 0; i < 46; i++) {
        const w = 2 + Math.random() * 7;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.012), lineMat);
        const z = -2 - Math.random() * 10;
        m.position.set((Math.random() - 0.5) * 16, (i / 46 - 0.5) * 12, z);
        lines.add(m);
        lineData.push({ mesh: m, base: m.position.x, phase: Math.random() * Math.PI * 2, speed: 0.15 + Math.random() * 0.35 });
      }
      scene.add(lines);

      // Dust
      const dustGeo = new THREE.BufferGeometry();
      const pts = new Float32Array(600 * 3);
      for (let i = 0; i < pts.length; i += 3) { pts[i] = (Math.random() - 0.5) * 18; pts[i + 1] = (Math.random() - 0.5) * 12; pts[i + 2] = -Math.random() * 12; }
      dustGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.5 }));
      scene.add(dust);

      const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 5, 6); scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(-6, -2, -4); scene.add(rim);

      // --- Interaction ------------------------------------------------------
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      let baseX = 0;
      let scrollFactor = 1.2;
      const onMove = (e: PointerEvent) => { pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2; pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2; };
      window.addEventListener("pointermove", onMove, { passive: true });

      const resize = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        // Keep the mark clear of the headline: right-hand side on wide screens,
        // smaller and behind the copy (dimmed by the overlay) on narrow ones.
        // Desktop: the canvas fills the hero and the mark sits right of the headline.
        // Mobile: the canvas is its own band above the copy, with the mark centred.
        const desktop = window.innerWidth >= 1024;
        camera.position.z = desktop ? 13 : 11;
        baseX = desktop ? Math.min(3.6, 1.2 + camera.aspect * 1.3) : 0;
        mark.scale.setScalar(desktop ? 0.9 : 0.62);
        scrollFactor = desktop ? 1.2 : 0;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(el);

      const clock = new THREE.Clock();
      let raf = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!visible) return;
        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        const scroll = Math.min(1, window.scrollY / Math.max(1, el.clientHeight));
        mark.rotation.y = -0.42 + Math.sin(t * 0.35) * 0.18 + pointer.x * 0.35 + scroll * 0.9;
        mark.rotation.x = -0.12 + Math.cos(t * 0.3) * 0.06 + pointer.y * 0.18;
        mark.position.y = Math.sin(t * 0.8) * 0.08 - scroll * scrollFactor;
        mark.position.x = baseX;
        for (const l of lineData) l.mesh.position.x = l.base + Math.sin(t * l.speed + l.phase) * 0.6;
        lines.rotation.y = pointer.x * 0.05;
        dust.rotation.y = t * 0.01;
        camera.position.x = pointer.x * 0.35;
        camera.position.y = 0.2 - pointer.y * 0.25;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      if (reduce) { mark.position.x = baseX; renderer.render(scene, camera); } else frame();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        ro.disconnect(); io.disconnect();
        scene.traverse((o) => { const m = o as import("three").Mesh; m.geometry?.dispose?.(); });
        white.dispose(); graphite.dispose(); lineMat.dispose(); pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <div ref={host} className={className}>
      {failed && (
        <svg viewBox="0 0 32 32" className="mx-auto h-full max-h-72 w-auto opacity-90" aria-hidden>
          <path d="M9 7.5V24.5H23.5" stroke="#fff" strokeWidth="3" fill="none" />
          <path d="M13.5 13H20.5M13.5 18.5H23" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
