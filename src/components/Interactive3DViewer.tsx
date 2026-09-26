import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, RotateCw, Maximize2, Layers, Cpu, Compass, Play, Pause, RefreshCw } from 'lucide-react';

interface Interactive3DViewerProps {
  modelType?: 'harmonic_actuator' | 'gimbal_bracket' | 'planetary_gearbox' | 'chassis_suspension';
  initialExplode?: number;
}

export const Interactive3DViewer: React.FC<Interactive3DViewerProps> = ({
  modelType = 'harmonic_actuator',
  initialExplode = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = useState<'solid' | 'wireframe'>('solid');
  const [explodedOffset, setExplodedOffset] = useState<number>(initialExplode);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [activeComponent, setActiveComponent] = useState<string>('Master Assembly');
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  // References for animation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const partsGroupRef = useRef<THREE.Group | null>(null);
  const partsListRef = useRef<Array<{ mesh: THREE.Mesh; defaultPos: THREE.Vector3; explodeDir: THREE.Vector3; name: string }>>([]);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const reqIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 420;

      // 1. Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(0x131a26);

      // 2. Camera
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(4.5, 3.2, 5.0);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // 3. Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 4. Lighting (Engineering Studio Rig)
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xe0f2fe, 3.2);
      keyLight.position.set(5, 8, 5);
      keyLight.castShadow = true;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
      fillLight.position.set(-5, 2, -4);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xa855f7, 1.2);
      rimLight.position.set(0, -5, 4);
      scene.add(rimLight);

      // Metrology Ground Plate Grid
      const gridHelper = new THREE.GridHelper(8, 20, 0x0284c7, 0x334155);
      gridHelper.position.y = -1.6;
      scene.add(gridHelper);

      // 5. Build Procedural Precision Mechanical Assembly
      const partsGroup = new THREE.Group();
      partsGroupRef.current = partsGroup;
      scene.add(partsGroup);

      const partsList: Array<{ mesh: THREE.Mesh; defaultPos: THREE.Vector3; explodeDir: THREE.Vector3; name: string }> = [];

      // Color maps for solid / FEA
      const solidAlloyMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.85,
        roughness: 0.25,
      });

      const titaniumMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.9,
        roughness: 0.18,
      });

      const bronzeBearingMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.95,
        roughness: 0.2,
      });

      const steelFastenerMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.9,
        roughness: 0.15,
      });

      if (modelType === 'harmonic_actuator' || modelType === 'planetary_gearbox') {
        // Part 1: Outer Cylindrical Fin Stator Housing
        const housingGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.9, 36, 1, true);
        const housingMesh = new THREE.Mesh(housingGeo, solidAlloyMat);
        housingMesh.position.set(0, 0, 0);
        partsGroup.add(housingMesh);
        partsList.push({ mesh: housingMesh, defaultPos: new THREE.Vector3(0, 0, 0), explodeDir: new THREE.Vector3(0, 0, 0), name: 'Stator Heat-Sink Housing (6061-T6)' });

        // Outer cooling fins rings
        for (let i = -2; i <= 2; i++) {
          const finGeo = new THREE.TorusGeometry(1.42, 0.04, 12, 48);
          const finMesh = new THREE.Mesh(finGeo, solidAlloyMat);
          finMesh.rotation.x = Math.PI / 2;
          finMesh.position.set(0, i * 0.18, 0);
          partsGroup.add(finMesh);
          partsList.push({ mesh: finMesh, defaultPos: new THREE.Vector3(0, i * 0.18, 0), explodeDir: new THREE.Vector3(0, 0, 0), name: 'Convective Heat-Dissipation Fins' });
        }

        // Part 2: Circular Spline Internal Gear Ring
        const ringGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.3, 32);
        const ringMesh = new THREE.Mesh(ringGeo, titaniumMat);
        ringMesh.position.set(0, -0.2, 0);
        partsGroup.add(ringMesh);
        partsList.push({ mesh: ringMesh, defaultPos: new THREE.Vector3(0, -0.2, 0), explodeDir: new THREE.Vector3(0, -0.8, 0), name: 'Rigid Circular Spline (4140 Nitrided)' });

        // Part 3: Flexspline Elastic Cup
        const cupGeo = new THREE.CylinderGeometry(1.05, 0.98, 0.7, 32);
        const cupMesh = new THREE.Mesh(cupGeo, titaniumMat);
        cupMesh.position.set(0, 0.25, 0);
        partsGroup.add(cupMesh);
        partsList.push({ mesh: cupMesh, defaultPos: new THREE.Vector3(0, 0.25, 0), explodeDir: new THREE.Vector3(0, 1.2, 0), name: 'Flexspline Diaphragm Cup (15-5 PH H1025)' });

        // Part 4: Wave Generator Elliptical Cam
        const camGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.35, 24);
        camGeo.scale(1.15, 1, 0.88);
        const camMesh = new THREE.Mesh(camGeo, bronzeBearingMat);
        camMesh.position.set(0, 0.35, 0);
        partsGroup.add(camMesh);
        partsList.push({ mesh: camMesh, defaultPos: new THREE.Vector3(0, 0.35, 0), explodeDir: new THREE.Vector3(0, 2.2, 0), name: 'Wave-Generator Elliptical Bearing' });

        // Part 5: Central Hollow Drive Shaft
        const shaftGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.6, 24);
        const shaftMesh = new THREE.Mesh(shaftGeo, steelFastenerMat);
        shaftMesh.position.set(0, 0.1, 0);
        partsGroup.add(shaftMesh);
        partsList.push({ mesh: shaftMesh, defaultPos: new THREE.Vector3(0, 0.1, 0), explodeDir: new THREE.Vector3(0, 3.2, 0), name: 'Through-Hole Azimuth Wire Shaft (Ti-6Al-4V)' });

        // Part 6: Cross-Roller Output Bearing Cartridge
        const bearingGeo = new THREE.TorusGeometry(1.18, 0.12, 16, 36);
        const bearingMesh = new THREE.Mesh(bearingGeo, bronzeBearingMat);
        bearingMesh.rotation.x = Math.PI / 2;
        bearingMesh.position.set(0, -0.45, 0);
        partsGroup.add(bearingMesh);
        partsList.push({ mesh: bearingMesh, defaultPos: new THREE.Vector3(0, -0.45, 0), explodeDir: new THREE.Vector3(0, -1.8, 0), name: 'Precision Cross-Roller Bearing (RU85)' });

        // Part 7: Front Output Flange Ring
        const flangeGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.12, 32);
        const flangeMesh = new THREE.Mesh(flangeGeo, solidAlloyMat);
        flangeMesh.position.set(0, -0.6, 0);
        partsGroup.add(flangeMesh);
        partsList.push({ mesh: flangeMesh, defaultPos: new THREE.Vector3(0, -0.6, 0), explodeDir: new THREE.Vector3(0, -2.6, 0), name: 'ASME Y14.5 Tooling Output Flange' });
      } else {
        // Gimbal / Chassis 5-Axis Yoke
        const baseGeo = new THREE.BoxGeometry(2.4, 0.25, 1.4);
        const baseMesh = new THREE.Mesh(baseGeo, solidAlloyMat);
        baseMesh.position.set(0, -0.8, 0);
        partsGroup.add(baseMesh);
        partsList.push({ mesh: baseMesh, defaultPos: new THREE.Vector3(0, -0.8, 0), explodeDir: new THREE.Vector3(0, -1.2, 0), name: 'Azimuth Mounting Base (7075-T6)' });

        // Left Upright Fork Arm
        const leftArmGeo = new THREE.BoxGeometry(0.35, 1.6, 1.1);
        const leftArmMesh = new THREE.Mesh(leftArmGeo, solidAlloyMat);
        leftArmMesh.position.set(-1.0, 0.1, 0);
        partsGroup.add(leftArmMesh);
        partsList.push({ mesh: leftArmMesh, defaultPos: new THREE.Vector3(-1.0, 0.1, 0), explodeDir: new THREE.Vector3(-1.4, 0, 0), name: 'Left Trunnion Yoke Rib (Lightweight Pocketed)' });

        // Right Upright Fork Arm
        const rightArmGeo = new THREE.BoxGeometry(0.35, 1.6, 1.1);
        const rightArmMesh = new THREE.Mesh(rightArmGeo, solidAlloyMat);
        rightArmMesh.position.set(1.0, 0.1, 0);
        partsGroup.add(rightArmMesh);
        partsList.push({ mesh: rightArmMesh, defaultPos: new THREE.Vector3(1.0, 0.1, 0), explodeDir: new THREE.Vector3(1.4, 0, 0), name: 'Right Motor Stator Housing Arm' });

        // Center Payload Gimbal Carrier Ring
        const ringGeo = new THREE.TorusGeometry(0.85, 0.18, 16, 32);
        const ringMesh = new THREE.Mesh(ringGeo, titaniumMat);
        ringMesh.position.set(0, 0.4, 0);
        partsGroup.add(ringMesh);
        partsList.push({ mesh: ringMesh, defaultPos: new THREE.Vector3(0, 0.4, 0), explodeDir: new THREE.Vector3(0, 1.4, 0), name: 'Optical Sensor Trunnion Carrier Ring' });

        // Trunnion Pivot Pins
        const pinLeftGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16);
        pinLeftGeo.rotateZ(Math.PI / 2);
        const pinLeftMesh = new THREE.Mesh(pinLeftGeo, bronzeBearingMat);
        pinLeftMesh.position.set(-0.85, 0.4, 0);
        partsGroup.add(pinLeftMesh);
        partsList.push({ mesh: pinLeftMesh, defaultPos: new THREE.Vector3(-0.85, 0.4, 0), explodeDir: new THREE.Vector3(-2.2, 0, 0), name: 'Left Elevation Pivot Shaft (ABEC 7)' });

        const pinRightMesh = new THREE.Mesh(pinLeftGeo, bronzeBearingMat);
        pinRightMesh.position.set(0.85, 0.4, 0);
        partsGroup.add(pinRightMesh);
        partsList.push({ mesh: pinRightMesh, defaultPos: new THREE.Vector3(0.85, 0.4, 0), explodeDir: new THREE.Vector3(2.2, 0, 0), name: 'Right Direct-Drive Stator Coupling' });
      }

      partsListRef.current = partsList;

      // Mouse Drag Interaction handlers
      const handleMouseDown = (e: MouseEvent) => {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !partsGroupRef.current) return;
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        const deltaY = e.clientY - previousMousePositionRef.current.y;

        partsGroupRef.current.rotation.y += deltaX * 0.008;
        partsGroupRef.current.rotation.x += deltaY * 0.008;

        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (!cameraRef.current) return;
        cameraRef.current.position.z = Math.max(2.5, Math.min(10, cameraRef.current.position.z + e.deltaY * 0.005));
      };

      // Raycast hover component detector
      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2();

      const handleRaycastHover = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (cameraRef.current && sceneRef.current) {
          raycaster.setFromCamera(mouseVec, cameraRef.current);
          const intersects = raycaster.intersectObjects(partsListRef.current.map(p => p.mesh));
          if (intersects.length > 0) {
            const hit = partsListRef.current.find(p => p.mesh === intersects[0].object);
            if (hit) setActiveComponent(hit.name);
          }
        }
      };

      container.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('mousemove', handleRaycastHover);

      // Render Loop
      const animate = () => {
        reqIdRef.current = requestAnimationFrame(animate);

        if (isAutoRotating && !isDraggingRef.current && partsGroupRef.current) {
          partsGroupRef.current.rotation.y += 0.004;
        }

        renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (!container || !rendererRef.current || !cameraRef.current) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        cameraRef.current.aspect = newW / newH;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
        window.removeEventListener('resize', handleResize);
        container.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('mousemove', handleRaycastHover);
        renderer.dispose();
      };
    } catch (err) {
      console.warn('WebGL initialization fallback triggered:', err);
      setWebGlSupported(false);
    }
  }, [modelType, isAutoRotating]);

  // Update materials when renderMode changes
  useEffect(() => {
    if (!partsListRef.current) return;

    partsListRef.current.forEach((part, idx) => {
      if (renderMode === 'solid') {
        part.mesh.material = new THREE.MeshStandardMaterial({
          color: idx % 2 === 0 ? 0x94a3b8 : 0x38bdf8,
          metalness: 0.85,
          roughness: 0.22,
          wireframe: false,
        });
      } else if (renderMode === 'wireframe') {
        part.mesh.material = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          wireframe: true,
        });
      } else if (renderMode === 'fea') {
        const stressColors = [0x1d4ed8, 0x06b6d4, 0x10b981, 0xf59e0b, 0xef4444];
        part.mesh.material = new THREE.MeshStandardMaterial({
          color: stressColors[idx % stressColors.length],
          metalness: 0.3,
          roughness: 0.5,
          wireframe: false,
        });
      }
    });
  }, [renderMode]);

  // Update Exploded view translation
  useEffect(() => {
    if (!partsListRef.current) return;
    const factor = explodedOffset / 100;
    partsListRef.current.forEach((part) => {
      part.mesh.position.set(
        part.defaultPos.x + part.explodeDir.x * factor,
        part.defaultPos.y + part.explodeDir.y * factor,
        part.defaultPos.z + part.explodeDir.z * factor
      );
    });
  }, [explodedOffset]);

  const handleResetCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(4.5, 3.2, 5.0);
      cameraRef.current.lookAt(0, 0, 0);
    }
    if (partsGroupRef.current) {
      partsGroupRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-[440px] sm:h-[480px] bg-[#0c1421] rounded-2xl border border-[#b8c6d4] overflow-hidden shadow-md flex flex-col font-serif">
      {/* Top HUD Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Active Component Inspector Tag */}
        <div className="pointer-events-auto bg-[#1a2536]/90 backdrop-blur-md border border-[#3b4c63] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-sans text-cyan-300 flex items-center gap-2 shadow-md">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="truncate max-w-[200px] sm:max-w-[300px] font-medium">
            {activeComponent}
          </span>
        </div>

        {/* Render Mode Switcher */}
        <div className="pointer-events-auto flex items-center bg-[#1a2536]/90 backdrop-blur-md border border-[#3b4c63] p-1 rounded-xl text-xs sm:text-sm font-sans shadow-md">
          <button
            onClick={() => setRenderMode('solid')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              renderMode === 'solid' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            CAD Solid
          </button>
          <button
            onClick={() => setRenderMode('wireframe')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              renderMode === 'wireframe' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Mesh Wire
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative flex-1 touch-none"
      />

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Exploded View Slider */}
        <div className="pointer-events-auto bg-[#1a2536]/90 backdrop-blur-md border border-[#3b4c63] px-4 py-2 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-sans text-slate-200 shadow-lg">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="whitespace-nowrap font-medium">Exploded View:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={explodedOffset}
            onChange={(e) => setExplodedOffset(Number(e.target.value))}
            className="w-24 sm:w-36 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <span className="w-9 tabular-nums text-right text-cyan-300 font-bold font-mono">{explodedOffset}%</span>
        </div>

        {/* Orbit, Pause, Reset Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#1a2536]/90 backdrop-blur-md border border-[#3b4c63] p-1 rounded-xl text-xs shadow-lg">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isAutoRotating ? 'text-cyan-300 bg-slate-800' : 'text-slate-400 hover:text-white'
            }`}
            title={isAutoRotating ? 'Pause Turntable' : 'Auto Rotate Turntable'}
          >
            {isAutoRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleResetCamera}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Camera Viewport"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
