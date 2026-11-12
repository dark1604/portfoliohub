// Hyper-Realistic 2.5D ATX Motherboard & Cinematic VFX Packet Renderer
window.PCSim = window.PCSim || {};

window.PCSim.BoardRenderer = (() => {
  const HW = window.PCSim.Hardware;
  const W = 1040;
  const H = 780;

  const ZONES = {
    cpu: { x: 265, y: 105, w: 260, h: 245 },
    ram: { x: 605, y: 75, w: 300, h: 310 },
    chipset: { x: 350, y: 405, w: 185, h: 115 },
    ssd: { x: 115, y: 395, w: 205, h: 110 },
    gpu: { x: 115, y: 540, w: 790, h: 195 }
  };

  const BUS_ROUTES = {
    'cpu-ram': [
      { x: 525, y: 215 }, { x: 560, y: 215 }, { x: 582, y: 235 }, { x: 605, y: 235 }
    ],
    'cpu-chipset': [
      { x: 425, y: 350 }, { x: 425, y: 405 }
    ],
    'ssd-chipset': [
      { x: 320, y: 455 }, { x: 350, y: 455 }
    ],
    'chipset-ram': [
      { x: 535, y: 450 }, { x: 575, y: 450 }, { x: 605, y: 420 }, { x: 605, y: 385 }
    ],
    'cpu-gpu': [
      { x: 365, y: 350 }, { x: 365, y: 495 }, { x: 390, y: 520 }, { x: 390, y: 540 }
    ]
  };

  let canvas = null;
  let ctx = null;
  let pcbPattern = null;
  let fanAngle = 0;
  let gpuFanAngle = 0;
  let hoverZone = null;
  let onSelectComponent = null;
  let ambientPulses = [];
  let flares = [];

  function init(canvasEl, selectCallback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onSelectComponent = selectCallback;

    buildPcbPattern();
    initAmbientPulses();

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
  }

  function buildPcbPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    pCtx.fillStyle = '#080c15';
    pCtx.fillRect(0, 0, 16, 16);
    pCtx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    pCtx.fillRect(0, 0, 8, 8);
    pCtx.fillRect(8, 8, 8, 8);
    pCtx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
    pCtx.lineWidth = 0.5;
    pCtx.strokeRect(0, 0, 16, 16);
    pcbPattern = ctx.createPattern(pCanvas, 'repeat');
  }

  function initAmbientPulses() {
    const routes = Object.keys(BUS_ROUTES);
    ambientPulses = Array.from({ length: 24 }, (_, i) => ({
      bus: routes[i % routes.length],
      t: Math.random(),
      speed: 0.005 + Math.random() * 0.006,
      reverse: Math.random() > 0.5,
      lane: (i % 5) - 2
    }));
  }

  function toVirtualCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const offsetX = (rect.width - W * scale) / 2;
    const offsetY = (rect.height - H * scale) / 2;
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale
    };
  }

  function hitTest(vx, vy) {
    for (const [key, z] of Object.entries(ZONES)) {
      if (vx >= z.x && vx <= z.x + z.w && vy >= z.y && vy <= z.y + z.h) return key;
    }
    for (const pts of Object.values(BUS_ROUTES)) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegment(vx, vy, pts[i], pts[i + 1]) < 18) return 'bus';
      }
    }
    return null;
  }

  function distToSegment(px, py, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(px - a.x, py - a.y);
    let t = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * (b.x - a.x)), py - (a.y + t * (b.y - a.y)));
  }

  function handleMouseMove(e) {
    const { x, y } = toVirtualCoords(e);
    hoverZone = hitTest(x, y);
    canvas.style.cursor = hoverZone ? 'pointer' : 'default';
  }

  function handleClick(e) {
    const { x, y } = toVirtualCoords(e);
    const hit = hitTest(x, y);
    if (hit && onSelectComponent) onSelectComponent(hit);
  }

  function getPointOnRoute(routeId, t, reverse = false) {
    const pts = BUS_ROUTES[routeId];
    if (!pts) return { x: 500, y: 380 };
    const segLens = [];
    let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segLens.push(d);
      totalLen += d;
    }
    const clamped = Math.max(0, Math.min(1, reverse ? 1 - t : t));
    let target = clamped * totalLen;
    for (let i = 0; i < segLens.length; i++) {
      if (target <= segLens[i] || i === segLens.length - 1) {
        const frac = segLens[i] > 0 ? target / segLens[i] : 0;
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * frac,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * frac
        };
      }
      target -= segLens[i];
    }
    return pts[0];
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function draw25DBox(x, y, w, h, r, depth = 8) {
    // 2.5D Extruded shadow & side wall
    ctx.fillStyle = 'rgba(2, 4, 10, 0.85)';
    roundRect(x + depth, y + depth, w, h, r);
    ctx.fill();
  }

  // ==================== 2.5D ATX MOTHERBOARD BASE + HEATMAP ====================
  function drawMotherboardBase() {
    const s = HW.state;

    // 2.5D PCB Extruded Thickness (Bottom-Right bevel)
    ctx.fillStyle = '#04060c';
    roundRect(30, 26, W - 44, H - 36, 16);
    ctx.fill();
    ctx.strokeStyle = '#b4782c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Main PCB Top Plate
    ctx.save();
    ctx.fillStyle = pcbPattern || '#080c15';
    roundRect(20, 14, W - 44, H - 36, 16);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
    ctx.restore();

    // Dynamic Heat-Map Glow behind CPU & VRM
    const tempNorm = Math.max(0, Math.min(1, (s.cpuTemp - 36) / 56));
    const heatColor = tempNorm > 0.72
      ? `rgba(239, 68, 68, ${0.18 + tempNorm * 0.28})`
      : tempNorm > 0.4
        ? `rgba(245, 158, 11, ${0.14 + tempNorm * 0.2})`
        : `rgba(56, 189, 248, 0.14)`;
    const heatGrad = ctx.createRadialGradient(385, 220, 20, 385, 220, 220);
    heatGrad.addColorStop(0, heatColor);
    heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = heatGrad;
    ctx.fillRect(120, 30, 500, 380);

    // Rear I/O Armor Shroud (2.5D)
    draw25DBox(32, 32, 72, 330, 8, 6);
    const ioGrad = ctx.createLinearGradient(32, 32, 104, 362);
    ioGrad.addColorStop(0, '#273549');
    ioGrad.addColorStop(0.5, '#0f172a');
    ioGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = ioGrad;
    roundRect(32, 32, 72, 330, 8);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(68, 195);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.font = '800 12px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText('KIBER-PRO Z790 GAMING', 0, 4);
    ctx.restore();

    // Audio Capacitors (Gold Nichicon)
    for (let i = 0; i < 6; i++) {
      const cy = 540 + i * 28;
      ctx.beginPath();
      ctx.arc(60, cy + 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#03050a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(58, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#b4782c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(58, cy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f5b95b';
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(55, cy - 1.5, 6, 3);
    }

    // CMOS CR2032 Silver Coin Battery
    ctx.beginPath();
    ctx.arc(167, 348, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#03050a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(165, 345, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();
    const batGrad = ctx.createRadialGradient(160, 340, 2, 165, 345, 17);
    batGrad.addColorStop(0, '#ffffff');
    batGrad.addColorStop(0.7, '#94a3b8');
    batGrad.addColorStop(1, '#475569');
    ctx.beginPath();
    ctx.arc(165, 345, 16, 0, Math.PI * 2);
    ctx.fillStyle = batGrad;
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 7.5px Consolas';
    ctx.fillText('CR2032', 149, 348);

    // 24-Pin ATX Power Connector
    draw25DBox(942, 140, 36, 170, 5, 5);
    ctx.fillStyle = '#0f172a';
    roundRect(942, 140, 36, 170, 5);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 3 === 0 ? '#f5b95b' : '#334155';
        ctx.fillRect(949 + c * 14, 149 + r * 13, 8, 8);
      }
    }

    // VRM Heatsinks + Glowing SMD Chokes & Capacitors
    draw25DBox(130, 95, 62, 195, 7, 6);
    const vrmGrad = ctx.createLinearGradient(130, 95, 192, 290);
    vrmGrad.addColorStop(0, '#293548');
    vrmGrad.addColorStop(0.5, '#0f172a');
    vrmGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = vrmGrad;
    roundRect(130, 95, 62, 195, 7);
    ctx.fill();
    ctx.strokeStyle = tempNorm > 0.65 ? '#f59e0b' : '#475569';
    ctx.stroke();
    ctx.strokeStyle = '#070a12';
    ctx.lineWidth = 3;
    for (let y = 108; y < 280; y += 14) {
      ctx.beginPath();
      ctx.moveTo(134, y);
      ctx.lineTo(188, y - 8);
      ctx.stroke();
    }

    // Glowing SMD Chokes & Capacitors
    for (let i = 0; i < 6; i++) {
      const y = 108 + i * 30;
      ctx.fillStyle = '#1e293b';
      roundRect(202, y, 22, 22, 3);
      ctx.fill();
      ctx.strokeStyle = tempNorm > 0.65 ? '#f59e0b' : '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 6.5px Consolas';
      ctx.fillText('R47', 205, y + 14);

      ctx.beginPath();
      ctx.arc(240, y + 11, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(240, y + 11, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    // Copper Micro-Traces & Glowing SMD LEDs
    ctx.strokeStyle = 'rgba(217, 155, 67, 0.16)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(540 + i * 4, 45);
      ctx.lineTo(540 + i * 4, 150);
      ctx.lineTo(605, 190 + i * 4);
      ctx.stroke();
    }

    // Mounting Screws
    const screws = [
      [36, 30], [520, 30], [W - 36, 30],
      [36, 400], [W - 36, 400],
      [36, H - 34], [520, H - 34], [W - 36, H - 34]
    ];
    screws.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#070a12';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#f5b95b';
      ctx.stroke();
    });
  }

  // ==================== FIBER-OPTIC MULTI-LANE BUSES ====================
  function drawBuses() {
    const s = HW.state;
    const busConfigs = [
      { id: 'cpu-ram', color: '#38bdf8', lanes: 7 },
      { id: 'cpu-chipset', color: '#38bdf8', lanes: 5 },
      { id: 'ssd-chipset', color: '#10b981', lanes: 5 },
      { id: 'chipset-ram', color: '#38bdf8', lanes: 5 },
      { id: 'cpu-gpu', color: '#a855f7', lanes: 9 }
    ];

    busConfigs.forEach(cfg => {
      const pts = BUS_ROUTES[cfg.id];
      const baseCol = s.isOverflow ? '#ef4444' : cfg.color;
      const half = Math.floor(cfg.lanes / 2);

      // Fiber-optic outer neon bloom on main channel
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.lineWidth = 8;
      ctx.strokeStyle = baseCol;
      ctx.globalAlpha = hoverZone === 'bus' ? 0.35 : 0.16;
      ctx.shadowColor = baseCol;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();

      // Parallel fine copper & fiber lanes
      for (let l = -half; l <= half; l++) {
        const off = l * 3.4;
        ctx.beginPath();
        pts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x + off, p.y + off * 0.45);
          else ctx.lineTo(p.x + off, p.y + off * 0.45);
        });
        ctx.lineWidth = l === 0 ? 2.6 : 1.15;
        ctx.strokeStyle = l === 0 ? baseCol : 'rgba(217, 155, 67, 0.32)';
        ctx.globalAlpha = l === 0 ? 0.8 : 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = '#f5b95b';
        ctx.fill();
      });
    });

    // Ambient electricity pulses
    if (HW.state.powered) {
      ambientPulses.forEach(ap => {
        ap.t += ap.speed;
        if (ap.t > 1) {
          ap.t = 0;
          ap.reverse = Math.random() > 0.5;
        }
        const pos = getPointOnRoute(ap.bus, ap.t, ap.reverse);
        const off = ap.lane * 3.4;
        ctx.beginPath();
        ctx.arc(pos.x + off, pos.y + off * 0.45, 2.3, 0, Math.PI * 2);
        ctx.fillStyle = s.isOverflow ? '#f59e0b' : 'rgba(125, 211, 252, 0.85)';
        ctx.fill();
      });
    }
  }

  // ==================== 1. CPU SOCKET & SILICON DIE ====================
  function drawCPU() {
    const s = HW.state;
    const z = ZONES.cpu;
    const isSel = s.selectedPart === 'cpu' || hoverZone === 'cpu';
    const accent = s.cpuTemp > 82 ? '#ef4444' : s.cpuTemp > 62 ? '#f59e0b' : '#38bdf8';

    draw25DBox(z.x, z.y, z.w, z.h, 12, 7);

    ctx.save();
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = 20; }
    const frameGrad = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    frameGrad.addColorStop(0, '#283548');
    frameGrad.addColorStop(1, '#111827');
    ctx.fillStyle = frameGrad;
    roundRect(z.x, z.y, z.w, z.h, 12);
    ctx.fill();
    ctx.lineWidth = isSel ? 2.6 : 1.8;
    ctx.strokeStyle = s.selectedPart === 'cpu' ? '#ffffff' : accent;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#0b2223';
    roundRect(z.x + 14, z.y + 14, z.w - 28, z.h - 28, 8);
    ctx.fill();
    ctx.strokeStyle = '#d99b43';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11.5px "Segoe UI"';
    ctx.fillText('ПРОЦЕСОР (CPU) • CORE X8', z.x + 22, z.y + 33);
    ctx.fillStyle = accent;
    ctx.font = '700 10px Consolas';
    ctx.fillText(`${s.cpuClockGhz.toFixed(1)} ГГц • ${Math.round(s.cpuTemp)}°C • ${Math.round(s.cpuLoad)}%`, z.x + 22, z.y + 48);

    if (s.xrayCpu) {
      const dieX = z.x + 22;
      const dieY = z.y + 58;
      const dieW = z.w - 44;
      const dieH = z.h - 80;

      const dieGrad = ctx.createLinearGradient(dieX, dieY, dieX + dieW, dieY + dieH);
      dieGrad.addColorStop(0, '#070d18');
      dieGrad.addColorStop(0.5, '#101d35');
      dieGrad.addColorStop(1, '#060a14');
      ctx.fillStyle = dieGrad;
      roundRect(dieX, dieY, dieW, dieH, 6);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const cx = dieX + 8 + col * 50;
        const cy = dieY + 8 + row * 48;
        const load = s.cpuCores[i] / 100;

        ctx.fillStyle = '#060a12';
        roundRect(cx, cy, 44, 42, 4);
        ctx.fill();
        ctx.strokeStyle = load > 0.72 ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = load > 0.75 ? 'rgba(239, 68, 68, 0.55)' : 'rgba(56, 189, 248, 0.45)';
        const fh = Math.max(4, load * 28);
        roundRect(cx + 3, cy + 39 - fh, 38, fh, 2);
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 8.5px Consolas';
        ctx.fillText(`C${i}`, cx + 6, cy + 13);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${Math.round(s.cpuCores[i])}%`, cx + 18, cy + 13);
      }

      // Control Unit, ALU & L1/L2 Cache
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      roundRect(dieX + 8, dieY + 108, 72, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '700 8px Consolas';
      ctx.fillText('КЕРУВАННЯ', dieX + 12, dieY + 124);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText(s.cuState, dieX + 12, dieY + 142);

      ctx.fillStyle = 'rgba(217, 155, 67, 0.16)';
      roundRect(dieX + 84, dieY + 108, 68, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#d99b43';
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.fillText('АЛУ (ALU)', dieX + 89, dieY + 124);
      ctx.fillStyle = '#f5b95b';
      ctx.fillText(s.aluOps, dieX + 89, dieY + 142);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      roundRect(dieX + 156, dieY + 108, 52, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.stroke();
      ctx.fillStyle = '#d1fae5';
      ctx.fillText('КЕШ L1/L2', dieX + 160, dieY + 124);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(dieX + 162, dieY + 134, Math.min(40, 8 + (s.cpuLoad / 100) * 32), 8);

      drawTurbineFan(z.x + z.w - 48, z.y + 42, 24, fanAngle, accent, 0.45, s.fanRpm / 3800);
    } else {
      drawTurbineFan(z.x + z.w / 2, z.y + 145, 72, fanAngle, accent, 0.95, s.fanRpm / 3800);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 10.5px Consolas';
      ctx.fillText(`PWM КУЛЕР: ${Math.round(s.fanRpm)} RPM`, z.x + 70, z.y + 232);
    }
  }

  function drawTurbineFan(cx, cy, r, angle, color, alpha = 0.9, intensity = 0.2) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;

    // Motion-blur outer glow ring at high RPM
    if (intensity > 0.25) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = alpha * Math.min(0.45, intensity * 0.5);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#060911';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    // 9 3D Shaded Turbine Blades
    ctx.rotate(angle);
    for (let i = 0; i < 9; i++) {
      ctx.rotate((Math.PI * 2) / 9);
      const bGrad = ctx.createLinearGradient(0, 0, r * 0.85, 0);
      bGrad.addColorStop(0, '#1e293b');
      bGrad.addColorStop(0.6, '#475569');
      bGrad.addColorStop(1, color);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.45, -r * 0.34, r * 0.88, -r * 0.08);
      ctx.quadraticCurveTo(r * 0.45, r * 0.14, 0, 0);
      ctx.fillStyle = bGrad;
      ctx.fill();
    }

    // Specular Metallic Hub
    const hubGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 0.25);
    hubGrad.addColorStop(0, '#94a3b8');
    hubGrad.addColorStop(1, '#0f172a');
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // ==================== 2. DDR5 RGB RAM MODULES ====================
  function drawRAM() {
    const s = HW.state;
    const z = ZONES.ram;
    const isSel = s.selectedPart === 'ram' || hoverZone === 'ram';
    const accent = s.isOverflow ? '#ef4444' : '#38bdf8';

    draw25DBox(z.x, z.y, z.w, z.h, 12, 7);

    ctx.save();
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = 18; }
    ctx.fillStyle = '#0c1322';
    roundRect(z.x, z.y, z.w, z.h, 12);
    ctx.fill();
    ctx.lineWidth = isSel ? 2.4 : 1.5;
    ctx.strokeStyle = s.selectedPart === 'ram' ? '#ffffff' : accent;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px "Segoe UI"';
    ctx.fillText('ОЗП DDR5-6000 (4x DIMM)', z.x + 14, z.y + 24);
    ctx.fillStyle = accent;
    ctx.font = '700 10px Consolas';
    ctx.fillText(`${s.ramUsed.toFixed(1)} / 16.0 ГБ (${Math.round(s.ramPct)}%)`, z.x + 14, z.y + 40);

    const cellColors = [];
    s.processes.forEach(p => {
      const cnt = Math.round(p.ram / 0.5);
      for (let i = 0; i < cnt && cellColors.length < 32; i++) {
        cellColors.push(s.isOverflow ? '#ef4444' : p.color);
      }
    });

    const slotNames = ['DIMM_A1', 'DIMM_A2', 'DIMM_B1', 'DIMM_B2'];
    let idx = 0;
    for (let slot = 0; slot < 4; slot++) {
      const sy = z.y + 52 + slot * 58;
      ctx.fillStyle = '#334155';
      ctx.fillRect(z.x + 10, sy + 14, 6, 18);
      ctx.fillRect(z.x + z.w - 16, sy + 14, 6, 18);

      ctx.fillStyle = '#111827';
      roundRect(z.x + 18, sy, z.w - 36, 46, 5);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Glowing RGB Top Lightbar
      ctx.save();
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.fillRect(z.x + 24, sy + 3, z.w - 48, 3);
      ctx.restore();

      ctx.fillStyle = '#64748b';
      ctx.font = '700 8px Consolas';
      ctx.fillText(slotNames[slot], z.x + 24, sy + 16);

      for (let c = 0; c < 8; c++) {
        const cx = z.x + 24 + c * 31;
        const cy = sy + 20;
        const col = cellColors[idx++] || null;
        ctx.fillStyle = col || '#090d16';
        roundRect(cx, cy, 26, 20, 3);
        ctx.fill();
        ctx.strokeStyle = col ? '#ffffff' : '#1e293b';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#070b13';
    roundRect(z.x + 16, z.y + 288, z.w - 32, 12, 4);
    ctx.fill();
    ctx.fillStyle = accent;
    roundRect(z.x + 18, z.y + 290, Math.max(8, (s.ramPct / 100) * (z.w - 36)), 8, 3);
    ctx.fill();
  }

  // ==================== 3. M.2 NVMe SSD ====================
  function drawSSD() {
    const s = HW.state;
    const z = ZONES.ssd;
    const isSel = s.selectedPart === 'ssd' || hoverZone === 'ssd';
    const accent = s.isOverflow ? '#ef4444' : '#10b981';

    draw25DBox(z.x, z.y, z.w, z.h, 9, 6);

    ctx.save();
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = 16; }
    ctx.fillStyle = '#0b1220';
    roundRect(z.x, z.y, z.w, z.h, 9);
    ctx.fill();
    ctx.lineWidth = isSel ? 2.4 : 1.5;
    ctx.strokeStyle = s.selectedPart === 'ssd' ? '#ffffff' : accent;
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#f5b95b';
      ctx.fillRect(z.x + 4, z.y + 22 + i * 11, 8, 6);
    }

    ctx.beginPath();
    ctx.arc(z.x + z.w - 12, z.y + z.h / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11.5px "Segoe UI"';
    ctx.fillText('NVMe M.2 SSD (1 ТБ)', z.x + 18, z.y + 22);

    ctx.fillStyle = '#1e293b';
    roundRect(z.x + 20, z.y + 32, 44, 34, 4);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 7.5px Consolas';
    ctx.fillText('CTRL', z.x + 31, z.y + 52);

    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = '#090d16';
      roundRect(z.x + 72 + i * 56, z.y + 32, 50, 34, 4);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.stroke();
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`NAND${i}`, z.x + 82 + i * 56, z.y + 52);
    }

    const ledOn = s.ssdBusy > 0 || s.isOverflow;
    ctx.beginPath();
    ctx.arc(z.x + z.w - 22, z.y + 18, 4, 0, Math.PI * 2);
    ctx.fillStyle = s.isOverflow ? '#ef4444' : ledOn ? '#10b981' : '#1e293b';
    ctx.fill();

    ctx.fillStyle = s.isOverflow ? 'rgba(239,68,68,0.2)' : '#070b13';
    roundRect(z.x + 18, z.y + 74, z.w - 36, 26, 5);
    ctx.fill();
    ctx.strokeStyle = s.isOverflow ? '#ef4444' : '#334155';
    ctx.stroke();
    ctx.fillStyle = s.isOverflow ? '#fef08a' : '#64748b';
    ctx.font = '700 9px Consolas';
    ctx.fillText(s.isOverflow ? '⚠️ SWAP АКТИВНИЙ (ГАЛЬМУЄ!)' : 'SWAP: НЕАКТИВНИЙ (~80 мкс)', z.x + 26, z.y + 90);
  }

  // ==================== 4. CHIPSET (PCH) ====================
  function drawChipset() {
    const s = HW.state;
    const z = ZONES.chipset;
    const isSel = s.selectedPart === 'chipset' || hoverZone === 'chipset';
    const accent = s.isOverflow ? '#ef4444' : '#d99b43';

    draw25DBox(z.x, z.y, z.w, z.h, 10, 6);

    ctx.save();
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = 16; }
    const grad = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    grad.addColorStop(0, '#243044');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    roundRect(z.x, z.y, z.w, z.h, 10);
    ctx.fill();
    ctx.lineWidth = isSel ? 2.4 : 1.6;
    ctx.strokeStyle = s.selectedPart === 'chipset' ? '#ffffff' : accent;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fef3c7';
    ctx.font = '700 12px "Segoe UI"';
    ctx.fillText('ЧИПСЕТ Z790 (ХАБ)', z.x + 18, z.y + 28);
    ctx.fillStyle = accent;
    ctx.font = '700 9.5px Consolas';
    ctx.fillText('DMI 4.0 • DMA Маршрутизатор', z.x + 18, z.y + 48);
    ctx.fillStyle = s.isOverflow ? '#fca5a5' : '#94a3b8';
    ctx.fillText(s.isOverflow ? 'ЗАТОР: SWAP ТРАФІК!' : `Трафік: ${s.busThroughput.toFixed(1)} ГБ/с`, z.x + 18, z.y + 82);
  }

  // ==================== 5. RTX-STYLE PCIe x16 GPU ====================
  function drawGPU() {
    const s = HW.state;
    const z = ZONES.gpu;
    const isSel = s.selectedPart === 'gpu' || hoverZone === 'gpu';
    const accent = '#a855f7';

    ctx.fillStyle = '#334155';
    roundRect(z.x + 150, z.y - 10, 260, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#f5b95b';
    ctx.fillRect(z.x + 160, z.y - 6, 240, 4);

    draw25DBox(z.x, z.y, z.w, z.h, 14, 9);

    ctx.save();
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = 20; }
    const gGrad = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    gGrad.addColorStop(0, '#1c263b');
    gGrad.addColorStop(0.5, '#0f1626');
    gGrad.addColorStop(1, '#1d1633');
    ctx.fillStyle = gGrad;
    roundRect(z.x, z.y, z.w, z.h, 14);
    ctx.fill();
    ctx.lineWidth = isSel ? 2.5 : 1.8;
    ctx.strokeStyle = s.selectedPart === 'gpu' ? '#ffffff' : accent;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#d99b43';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(z.x + 25, z.y + 14);
    ctx.lineTo(z.x + 560, z.y + 14);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 13px "Segoe UI"';
    ctx.fillText('ВІДЕОКАРТА (GPU) — RTX GRAPHICS', z.x + 24, z.y + 36);
    ctx.fillStyle = '#d8b4fe';
    ctx.font = '700 10px Consolas';
    ctx.fillText(`8 ГБ GDDR6 • ${Math.round(s.gpuLoad)}% Навантаження • ${Math.round(s.fps)} FPS`, z.x + 24, z.y + 52);

    const gpuIntensity = s.gpuLoad / 100;
    drawTurbineFan(z.x + 145, z.y + 122, 54, gpuFanAngle, '#a855f7', 0.94, gpuIntensity);
    drawTurbineFan(z.x + 335, z.y + 122, 54, gpuFanAngle, '#a855f7', 0.94, gpuIntensity);

    const rx = z.x + 455;
    const ry = z.y + 32;
    ctx.fillStyle = '#070b13';
    roundRect(rx, ry, 310, 142, 9);
    ctx.fill();
    ctx.strokeStyle = '#6b21a8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#d8b4fe';
    ctx.font = '700 10px Consolas';
    ctx.fillText('ВИХІД МОНІТОРА (HDMI / DP)', rx + 14, ry + 20);

    ctx.save();
    ctx.translate(rx + 85, ry + 84);
    const rot = performance.now() * (s.gpuLoad > 20 ? 0.0022 : 0.0005);
    const sx = Math.cos(rot) * 34;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(sx, 0);
    ctx.lineTo(0, 34);
    ctx.lineTo(-sx, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = s.fps < 20 ? '#ef4444' : '#6ee7b7';
    ctx.font = '800 22px Consolas';
    ctx.fillText(`${Math.round(s.fps)} FPS`, rx + 160, ry + 78);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10px Consolas';
    ctx.fillText(s.fps < 20 ? '⚠️ ЗАТРИМКА SWAP!' : 'ПЛАВНИЙ РЕНДЕР', rx + 160, ry + 100);

    ctx.fillStyle = '#090d16';
    roundRect(rx + 160, ry + 114, 130, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#a855f7';
    roundRect(rx + 162, ry + 116, Math.max(6, (s.gpuLoad / 100) * 126), 6, 2);
    ctx.fill();
  }

  // ==================== 6. PLASMA ORBS, COMET TAILS & ARRIVAL FLARES ====================
  function drawPackets() {
    const s = HW.state;
    const speedMul = s.speedMode === 'slow' ? 0.38 : 1.0;

    for (let i = s.packets.length - 1; i >= 0; i--) {
      const p = s.packets[i];
      p.t += p.speed * speedMul;
      const pos = getPointOnRoute(p.bus, p.t, p.reverse);

      p.trail.push({ x: pos.x, y: pos.y });
      if (p.trail.length > 14) p.trail.shift();

      // Comet tail
      for (let j = 0; j < p.trail.length; j++) {
        const pt = p.trail[j];
        const ratio = (j + 1) / p.trail.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 + ratio * 3.8, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = ratio * 0.65;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Bright Plasma Orb
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = p.color;
      ctx.font = '700 9.5px Consolas';
      ctx.fillText(p.label, pos.x + 9, pos.y - 7);

      if (p.t >= 1) {
        flares.push({ x: pos.x, y: pos.y, r: 4, alpha: 0.9, color: p.color });
        if (p.onArrive) p.onArrive();
        s.packets.splice(i, 1);
      }
    }

    // Expanding light flares upon arrival
    for (let i = flares.length - 1; i >= 0; i--) {
      const fl = flares[i];
      fl.r += 1.6;
      fl.alpha -= 0.055;
      if (fl.alpha <= 0) {
        flares.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.strokeStyle = fl.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fl.alpha;
      ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / W, canvas.height / H);
    const ox = (canvas.width - W * scale) / 2;
    const oy = (canvas.height - H * scale) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    if (HW.state.powered) {
      fanAngle = (fanAngle + (HW.state.fanRpm / 600) * 0.05) % (Math.PI * 2);
      gpuFanAngle = (gpuFanAngle + 0.03 + (HW.state.gpuLoad / 100) * 0.18) % (Math.PI * 2);
    }

    drawMotherboardBase();
    drawBuses();
    drawCPU();
    drawRAM();
    drawSSD();
    drawChipset();
    drawGPU();
    if (HW.state.powered) drawPackets();

    ctx.restore();
  }

  return { init, render };
})();
