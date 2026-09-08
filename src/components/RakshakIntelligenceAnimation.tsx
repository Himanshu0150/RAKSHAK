import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const RakshakIntelligenceAnimation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frameId: number;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 280;

    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isReducedMotion = mediaQuery.matches;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.8);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x2563eb, 2.5);
    dirLight.position.set(5, 5, 8);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x0284c7, 3, 20);
    pointLight.position.set(-4, -2, 5);
    scene.add(pointLight);

    // 4. Main Group
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Central Security Core: Wireframe Geodesic Icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(1.8, 1);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x2563eb,
      wireframe: true,
      wireframeLinewidth: 1.5,
      transparent: true,
      opacity: 0.65
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(coreMesh);

    // Glowing Inner Octahedron / Quantum Node
    const innerGeo = new THREE.OctahedronGeometry(1.0, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    mainGroup.add(innerMesh);

    // Cryptographic Orbital Rings
    const ringGeo1 = new THREE.TorusGeometry(2.6, 0.035, 16, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.55 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    mainGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(3.0, 0.025, 16, 80);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.45 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 3.5;
    mainGroup.add(ring2);

    // Satellite Intel Nodes (Suspect, Financial, CDR vectors)
    const nodeCount = 16;
    const nodeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const nodeMatBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.85 });
    const nodeMatAlert = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.85 });
    const nodeMatCyan = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.85 });

    const nodes: THREE.Mesh[] = [];
    const nodeGroup = new THREE.Group();
    for (let i = 0; i < nodeCount; i++) {
      const theta = (i / nodeCount) * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 2.2 + (Math.random() * 0.7);
      const mat = (i % 5 === 0) ? nodeMatAlert : (i % 2 === 0 ? nodeMatCyan : nodeMatBlue);
      const node = new THREE.Mesh(nodeGeo, mat);
      node.userData = {
        theta: theta,
        phi: phi,
        radius: radius,
        speed: 0.005 + Math.random() * 0.007
      };
      node.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      nodeGroup.add(node);
      nodes.push(node);
    }
    mainGroup.add(nodeGroup);

    // Inter-node connection vectors
    const lineMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.4 });
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      points.push(nodes[i].position);
      if (nodes[i + 1]) points.push(nodes[i + 1].position);
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    mainGroup.add(linesMesh);

    // 5. Mouse & Touch Reactive Tracking
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      targetRotY = x * 0.55;
      targetRotX = -y * 0.35;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    // 6. Resize Handling
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', onResize);
    }

    // 7. Render Loop
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      const rotSpeed = isReducedMotion ? 0.0005 : 1;

      mainGroup.rotation.y += 0.004 * rotSpeed;
      mainGroup.rotation.x = currentRotX + 0.12;
      mainGroup.rotation.z = currentRotY * 0.4;

      coreMesh.rotation.y -= 0.003 * rotSpeed;
      innerMesh.rotation.y += 0.008 * rotSpeed;
      innerMesh.rotation.x += 0.005 * rotSpeed;

      ring1.rotation.z += 0.005 * rotSpeed;
      ring2.rotation.z -= 0.004 * rotSpeed;

      nodes.forEach(node => {
        node.userData.theta += node.userData.speed * rotSpeed;
        const r = node.userData.radius;
        const p = node.userData.phi;
        const t = node.userData.theta;
        node.position.set(
          r * Math.sin(p) * Math.cos(t),
          r * Math.sin(p) * Math.sin(t),
          r * Math.cos(p)
        );
      });

      lineGeo.setFromPoints(nodes.map(n => n.position));

      renderer.render(scene, camera);
    };

    animate();

    // 8. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', onResize);
      }

      // Dispose Geometries
      coreGeo.dispose();
      innerGeo.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      nodeGeo.dispose();
      lineGeo.dispose();

      // Dispose Materials
      coreMat.dispose();
      innerMat.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      nodeMatBlue.dispose();
      nodeMatAlert.dispose();
      nodeMatCyan.dispose();
      lineMat.dispose();

      // Dispose Renderer
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[260px] sm:min-h-[300px] relative overflow-hidden bg-transparent"
    />
  );
};
