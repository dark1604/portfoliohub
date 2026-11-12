// Three.js 3D Motherboard & Refined Low-Neon Studio Renderer
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.PCSim = window.PCSim || {};

window.PCSim.BoardRenderer = (() => {
  let container = null;
  let labelsLayer = null;
  let onSelect = null;

  let scene, camera, renderer, composer, controls, bloomPass;
  let cpuCoreMat, ssdLedMat, gpuLedMat, pchAccentMat;
  let cpuCoolerGroup = null;
  const fans = [];
  const ramLightBars = [];
  const interactiveMeshes = [];
  const componentAnchors = {};
  const labelEls = {};
  const buses = {};
  const packets3D = [];

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  const defaultCamPos = new THREE.Vector3(10.2, 8.8, 11.8);
  const defaultTarget = new THREE.Vector3(0, 0.35, 0);

  function createPCBTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle matte grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
    }

    // Refined copper & muted slate micro-traces (low-neon)
    for (let i = 0; i < 140; i++) {
      const isCopper = i % 3 === 0;
      ctx.strokeStyle = isCopper ? 'rgba(217, 155, 67, 0.14)' : 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1.4;
      let x = Math.floor(Math.random() * 32) * 32;
      let y = Math.floor(Math.random() * 32) * 32;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 3 + Math.floor(Math.random() * 5);
      for (let s = 0; s < steps; s++) {
        const dir = Math.floor(Math.random() * 4);
        const len = (1 + Math.floor(Math.random() * 4)) * 32;
        if (dir === 0) x += len;
        else if (dir === 1) x -= len;
        else if (dir === 2) y += len;
        else y -= len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function tagInteractive(obj, hwKey) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.userData.hwKey = hwKey;
        interactiveMeshes.push(child);
      }
    });
  }

  function init(wrapEl, selectCallback) {
    container = wrapEl;
    onSelect = selectCallback;

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(300, container.clientHeight);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060911, 0.015);

    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.copy(defaultCamPos);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.prepend(renderer.domElement);

    // Floating 3D Labels Layer
    labelsLayer = document.createElement('div');
    labelsLayer.className = 'labels-3d-layer';
    container.appendChild(labelsLayer);

    // Studio Reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;

    // Subtle, non-glaring Bloom (less neon!)
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.32, 0.88);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5.5;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.copy(defaultTarget);

    // Studio Lighting (Clean & Balanced)
    scene.add(new THREE.AmbientLight(0x1e293b, 1.25));

    const keyLight = new THREE.DirectionalLight(0xf1f5f9, 2.2);
    keyLight.position.set(10, 16, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    const coolRim = new THREE.PointLight(0x38bdf8, 5, 22);
    coolRim.position.set(-7, 5, -6);
    scene.add(coolRim);

    const warmRim = new THREE.PointLight(0xd99b43, 4.5, 22);
    warmRim.position.set(7, 4, 6);
    scene.add(warmRim);

    buildMotherboard();
    buildBuses();
    buildLabels();

    // Pointer click raycasting (distinguish drag vs click)
    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length > 0 && hits[0].object.userData.hwKey && onSelect) {
        onSelect(hits[0].object.userData.hwKey);
      }
    });

    // ResizeObserver for Split <-> Full 3D transitions
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(container);
    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    if (!container || !renderer || !composer) return;
    const w = Math.max(200, container.clientWidth);
    const h = Math.max(200, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  }

  function resetCamera() {
    if (!camera || !controls) return;
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  function buildMotherboard() {
    const matPCB = new THREE.MeshStandardMaterial({
      map: createPCBTexture(),
      roughness: 0.42,
      metalness: 0.25
    });
    const matGunmetal = new THREE.MeshStandardMaterial({ color: 0x1e2533, roughness: 0.34, metalness: 0.85 });
    const matAlum = new THREE.MeshStandardMaterial({ color: 0x8a99ad, roughness: 0.28, metalness: 0.9 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xc97b42, roughness: 0.25, metalness: 0.92 });
    const matDarkPlastic = new THREE.MeshStandardMaterial({ color: 0x0f141e, roughness: 0.58, metalness: 0.15 });

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // PCB Base
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.24, 9.2), matPCB);
    pcb.position.y = -0.12;
    pcb.receiveShadow = true;
    pcb.castShadow = true;
    boardGroup.add(pcb);

    // Subtle Copper Edge Trim
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, roughness: 0.3, metalness: 0.9 });
    const trimF = new THREE.Mesh(new THREE.BoxGeometry(11.64, 0.04, 0.04), trimMat);
    trimF.position.set(0, -0.12, 4.61);
    const trimB = trimF.clone(); trimB.position.z = -4.61;
    boardGroup.add(trimF, trimB);

    // I/O Shield Armor
    const ioArmor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.35, 3.6), matGunmetal);
    ioArmor.position.set(-4.85, 0.67, -2.3);
    ioArmor.castShadow = true;
    boardGroup.add(ioArmor);
    const ioStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 3.1),
      new THREE.MeshStandardMaterial({ color: 0xd99b43, emissive: 0xd99b43, emissiveIntensity: 0.35 })
    );
    ioStripe.position.set(-4.08, 1.15, -2.3);
    boardGroup.add(ioStripe);

    function createFinHeatsink(w, h, d, fins = 10) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), matGunmetal);
      base.position.y = h * 0.225;
      base.castShadow = true;
      g.add(base);
      const step = w / fins;
      for (let i = 0; i < fins; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(step * 0.55, h * 0.55, d * 0.94), matAlum);
        fin.position.set(-w / 2 + step * (i + 0.5), h * 0.72, 0);
        fin.castShadow = true;
        g.add(fin);
      }
      return g;
    }

    function createSpinningFan(radius, bladeCount = 9, ringColor = 0x38bdf8) {
      const fanGroup = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(radius, 0.05, 12, 36);
      const ringMat = new THREE.MeshStandardMaterial({
        color: ringColor,
        emissive: ringColor,
        emissiveIntensity: 0.32,
        roughness: 0.25,
        metalness: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      fanGroup.add(ring);

      const rotor = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.14, 24), matGunmetal);
      rotor.add(hub);

      const bladeGeo = new THREE.BoxGeometry(radius * 0.68, 0.025, radius * 0.22);
      for (let i = 0; i < bladeCount; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / bladeCount) * Math.PI * 2;
        const blade = new THREE.Mesh(bladeGeo, matAlum);
        blade.position.x = radius * 0.54;
        blade.rotation.x = 0.42;
        pivot.add(blade);
        rotor.add(pivot);
      }
      fanGroup.add(rotor);
      fans.push({ rotor, ringMat, baseColor: new THREE.Color(ringColor) });
      return fanGroup;
    }

    // VRM Heatsink & Capacitors
    const vrmTop = createFinHeatsink(3.6, 0.85, 0.9, 12);
    vrmTop.position.set(-1.3, 0, -3.55);
    boardGroup.add(vrmTop);
    for (let i = 0; i < 10; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 12), matAlum);
      cap.position.set(-3.2 + i * 0.38, 0.14, -2.9);
      boardGroup.add(cap);
    }

    // 24-Pin ATX
    const atx24 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 2.2), matDarkPlastic);
    atx24.position.set(5.2, 0.21, -1.2);
    boardGroup.add(atx24);

    // Chipset (PCH)
    const pchGroup = new THREE.Group();
    const pch = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.42, 2.1), matGunmetal);
    pch.position.set(3.8, 0.21, 2.8);
    pch.castShadow = true;
    pchGroup.add(pch);
    pchAccentMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, emissive: 0xd99b43, emissiveIntensity: 0.4 });
    const pchAccent = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.12), pchAccentMat);
    pchAccent.position.set(3.8, 0.44, 2.8);
    pchGroup.add(pchAccent);
    boardGroup.add(pchGroup);
    componentAnchors.chipset = new THREE.Vector3(3.8, 0.85, 2.8);
    tagInteractive(pchGroup, 'chipset');

    // CPU
    const cpuGroup = new THREE.Group();
    cpuGroup.position.set(-1.3, 0, -1.35);
    boardGroup.add(cpuGroup);

    const cpuSocket = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.16, 2.35), matDarkPlastic);
    cpuSocket.position.y = 0.08;
    cpuGroup.add(cpuSocket);

    const cpuIHS = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), matAlum);
    cpuIHS.position.y = 0.24;
    cpuIHS.castShadow = true;
    cpuGroup.add(cpuIHS);

    cpuCoreMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.25 });
    const cpuCore = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 1.15), cpuCoreMat);
    cpuCore.position.y = 0.42;
    cpuGroup.add(cpuCore);

    cpuCoolerGroup = new THREE.Group();
    const cpuCoolerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.24, 0.48, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x161f30, roughness: 0.2, metalness: 0.65, transparent: true, opacity: 0.72 })
    );
    cpuCoolerBody.position.y = 0.56;
    cpuCoolerBody.castShadow = true;
    cpuCoolerGroup.add(cpuCoolerBody);

    const cpuFan = createSpinningFan(1.05, 9, 0x38bdf8);
    cpuFan.position.y = 0.86;
    cpuCoolerGroup.add(cpuFan);
    cpuGroup.add(cpuCoolerGroup);

    componentAnchors.cpu = new THREE.Vector3(-1.3, 1.2, -1.35);
    tagInteractive(cpuGroup, 'cpu');

    // RAM (4 DDR5 Sticks)
    const ramGroup = new THREE.Group();
    ramGroup.position.set(1.65, 0, -1.35);
    boardGroup.add(ramGroup);
    for (let i = 0; i < 4; i++) {
      const slotX = -0.54 + i * 0.36;
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 3.15), matDarkPlastic);
      slot.position.set(slotX, 0.07, 0);
      ramGroup.add(slot);

      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.92, 2.95), matGunmetal);
      stick.position.set(slotX, 0.54, 0);
      stick.castShadow = true;
      ramGroup.add(stick);

      const barMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, emissive: 0xd99b43, emissiveIntensity: 0.38, roughness: 0.2 });
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 2.92), barMat);
      lightBar.position.set(slotX, 1.02, 0);
      ramGroup.add(lightBar);
      ramLightBars.push(barMat);
    }
    componentAnchors.ram = new THREE.Vector3(1.65, 1.3, -1.35);
    tagInteractive(ramGroup, 'ram');

    // SSD (NVMe M.2)
    const ssdGroup = new THREE.Group();
    ssdGroup.position.set(0.15, 0, 0.65);
    boardGroup.add(ssdGroup);
    const m2Slot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.72), matDarkPlastic);
    m2Slot.position.set(-1.35, 0.08, 0);
    ssdGroup.add(m2Slot);
    const ssdPcb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.68), matDarkPlastic);
    ssdPcb.position.set(0, 0.16, 0);
    ssdGroup.add(ssdPcb);
    const ssdHeatsink = createFinHeatsink(2.2, 0.36, 0.66, 10);
    ssdHeatsink.position.set(0.1, 0.19, 0);
    ssdGroup.add(ssdHeatsink);

    ssdLedMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.5 });
    const ssdLed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.45), ssdLedMat);
    ssdLed.position.set(-1.1, 0.24, 0);
    ssdGroup.add(ssdLed);
    componentAnchors.ssd = new THREE.Vector3(0.15, 0.8, 0.65);
    tagInteractive(ssdGroup, 'ssd');

    // GPU (PCIe x16)
    const gpuGroup = new THREE.Group();
    gpuGroup.position.set(-0.65, 0, 2.35);
    boardGroup.add(gpuGroup);
    const pcieSlot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.32), matAlum);
    pcieSlot.position.set(-0.4, 0.11, 0);
    gpuGroup.add(pcieSlot);

    const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.48, 1.05), matGunmetal);
    gpuBody.position.set(0, 0.96, 0);
    gpuBody.castShadow = true;
    gpuGroup.add(gpuBody);

    const gpuTopPlate = new THREE.Mesh(new THREE.BoxGeometry(6.42, 0.1, 1.07), matAlum);
    gpuTopPlate.position.set(0, 1.72, 0);
    gpuGroup.add(gpuTopPlate);

    for (let i = 0; i < 3; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.8, 12), matCopper);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.45 + i * 0.22, 0.53);
      gpuGroup.add(pipe);
    }

    gpuLedMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.4 });
    const gpuLed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 0.05), gpuLedMat);
    gpuLed.position.set(-0.5, 1.56, 0.54);
    gpuGroup.add(gpuLed);

    for (let i = -1; i <= 1; i++) {
      const gFan = createSpinningFan(0.56, 9, 0x38bdf8);
      gFan.rotation.x = Math.PI / 2;
      gFan.position.set(i * 1.85, 0.96, 0.56);
      gpuGroup.add(gFan);
    }
    componentAnchors.gpu = new THREE.Vector3(-0.65, 2.0, 2.35);
    tagInteractive(gpuGroup, 'gpu');
  }

  function buildBuses() {
    const endpoints = {
      ssd: new THREE.Vector3(0.15, 0.28, 0.65),
      ram: new THREE.Vector3(1.65, 0.36, -1.35),
      cpu: new THREE.Vector3(-1.3, 0.36, -1.35),
      gpu: new THREE.Vector3(-0.65, 0.36, 2.35),
      chipset: new THREE.Vector3(3.8, 0.28, 2.8)
    };

    const pairs = [
      { key: 'cpu-ram', a: 'cpu', b: 'ram', color: 0x38bdf8, arc: 0.22 },
      { key: 'cpu-chipset', a: 'cpu', b: 'chipset', color: 0x38bdf8, arc: 0.26 },
      { key: 'ssd-chipset', a: 'ssd', b: 'chipset', color: 0x10b981, arc: 0.22 },
      { key: 'chipset-ram', a: 'chipset', b: 'ram', color: 0xd99b43, arc: 0.28 },
      { key: 'cpu-gpu', a: 'cpu', b: 'gpu', color: 0xa855f7, arc: 0.30 }
    ];

    pairs.forEach((bp) => {
      const start = endpoints[bp.a].clone();
      const end = endpoints[bp.b].clone();
      const mid = start.clone().lerp(end, 0.5);
      mid.y += bp.arc;

      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.036, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: bp.color,
        emissive: bp.color,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.55,
        roughness: 0.3
      });
      const mesh = new THREE.Mesh(tubeGeo, tubeMat);
      mesh.userData.hwKey = 'bus';
      interactiveMeshes.push(mesh);
      scene.add(mesh);

      buses[bp.key] = { curve, mat: tubeMat, baseColor: new THREE.Color(bp.color) };
    });
  }

  function buildLabels() {
    const meta = [
      { key: 'cpu', title: 'CPU', stat: '38°C' },
      { key: 'ram', title: 'ОЗП (DDR5)', stat: '13%' },
      { key: 'ssd', title: 'SSD (Склад)', stat: 'OK' },
      { key: 'gpu', title: 'GPU', stat: '60 FPS' },
      { key: 'chipset', title: 'Чипсет', stat: 'DMI' }
    ];
    meta.forEach(m => {
      const el = document.createElement('div');
      el.className = 'hw-label-3d';
      el.innerHTML = `<span class="lbl-dot"></span><span class="lbl-name">${m.title}</span><span class="lbl-stat mono">${m.stat}</span>`;
      el.addEventListener('click', () => {
        if (onSelect) onSelect(m.key);
      });
      labelsLayer.appendChild(el);
      labelEls[m.key] = el;
    });
  }

  // Sync 3D Packets with Hardware.state.packets
  const packetGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const haloGeo = new THREE.SphereGeometry(0.16, 10, 10);

  function syncPackets() {
    const HW = window.PCSim.Hardware;
    const s = HW.state;
    const speedMul = s.speedMode === 'slow' ? 0.38 : 1.0;

    // Spawn 3D meshes for new packets in HW.state.packets
    for (let i = s.packets.length - 1; i >= 0; i--) {
      const p = s.packets[i];
      if (!p._mesh3d) {
        const bus = buses[p.bus];
        if (!bus) { s.packets.splice(i, 1); continue; }
        const col = new THREE.Color(p.color || '#38bdf8');
        const g = new THREE.Group();
        const core = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 }));
        g.add(core, halo);
        scene.add(g);
        p._mesh3d = g;
        p._curve = bus.curve;
      }

      p.t += p.speed * speedMul;
      const u = Math.max(0, Math.min(1, p.reverse ? 1 - p.t : p.t));
      p._mesh3d.position.copy(p._curve.getPointAt(u));

      if (p.t >= 1) {
        scene.remove(p._mesh3d);
        if (p.onArrive) p.onArrive();
        s.packets.splice(i, 1);
      }
    }
  }

  function updateLabels() {
    if (!labelsLayer || !container) return;
    const HW = window.PCSim.Hardware;
    const s = HW.state;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const v = new THREE.Vector3();

    Object.entries(componentAnchors).forEach(([key, anchor]) => {
      const el = labelEls[key];
      if (!el) return;
      v.copy(anchor).project(camera);
      if (v.z > 1) {
        el.style.opacity = '0';
        return;
      }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = '1';

      const statEl = el.querySelector('.lbl-stat');
      if (key === 'cpu') statEl.textContent = `${Math.round(s.cpuTemp)}°C • ${Math.round(s.cpuLoad)}%`;
      else if (key === 'ram') statEl.textContent = `${Math.round(s.ramPct)}%`;
      else if (key === 'ssd') statEl.textContent = s.isOverflow ? 'SWAP!' : 'NVMe';
      else if (key === 'gpu') statEl.textContent = `${Math.round(s.fps)} FPS`;
      else if (key === 'chipset') statEl.textContent = `${s.busThroughput.toFixed(1)} ГБ/с`;

      el.classList.toggle('throttled', s.isOverflow && (key === 'ram' || key === 'ssd' || key === 'cpu'));
      el.classList.toggle('active', s.selectedPart === key);
    });
  }

  function render() {
    if (!renderer || !composer) return;
    const HW = window.PCSim.Hardware;
    const s = HW.state;

    if (s.powered) {
      syncPackets();

      // Spin 3D fans
      const cpuSpin = 0.08 + (s.fanRpm / 3800) * 0.25;
      const gpuSpin = 0.05 + (s.gpuLoad / 100) * 0.22;
      fans.forEach((f, idx) => {
        f.rotor.rotation.y += idx === 0 ? cpuSpin : gpuSpin;
        if (s.isOverflow) {
          f.ringMat.color.setHex(0xef4444);
          f.ringMat.emissive.setHex(0xef4444);
        } else {
          f.ringMat.color.copy(f.baseColor);
          f.ringMat.emissive.copy(f.baseColor);
        }
      });

      // X-Ray CPU cooler opacity
      if (cpuCoolerGroup) {
        cpuCoolerGroup.visible = !s.xrayCpu || true;
        cpuCoolerGroup.children[0].material.opacity = s.xrayCpu ? 0.35 : 0.88;
      }

      // Dynamic CPU core thermal color
      if (cpuCoreMat) {
        const col = s.cpuTemp > 82 ? 0xef4444 : s.cpuTemp > 62 ? 0xf59e0b : 0x38bdf8;
        cpuCoreMat.color.setHex(col);
        cpuCoreMat.emissive.setHex(col);
      }

      // RAM lightbars on overflow
      ramLightBars.forEach(mat => {
        const col = s.isOverflow ? 0xef4444 : 0xd99b43;
        mat.color.setHex(col);
        mat.emissive.setHex(col);
      });
    }

    controls.update();
    composer.render();
    updateLabels();
  }

  return { init, render, resetCamera };
})();
