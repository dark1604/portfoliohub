// Main Entry Point & UI Orchestrator
(() => {
  const HW = window.PCSim.Hardware;
  const Board = window.PCSim.BoardRenderer;
  const OS = window.PCSim.OS;
  const CpuMicro = window.PCSim.CpuMicro;
  const Audio = window.PCSim.Audio;

  // HUD Elements
  const hudCpu = document.getElementById('hudCpu');
  const hudTemp = document.getElementById('hudTemp');
  const hudRam = document.getElementById('hudRam');
  const hudGpu = document.getElementById('hudGpu');
  const hudBus = document.getElementById('hudBus');
  const osFpsBadge = document.getElementById('osFpsBadge');
  const osClock = document.getElementById('osClock');
  const alertBanner = document.getElementById('alertBanner');

  // Step Card Elements
  const stepCard = document.getElementById('stepCard');
  const stepStageBadge = document.getElementById('stepStageBadge');
  const stepStageTitle = document.getElementById('stepStageTitle');
  const stepStageDesc = document.getElementById('stepStageDesc');

  // Inspector Elements
  const hwInspector = document.getElementById('hwInspector');
  const inspIcon = document.getElementById('inspIcon');
  const inspName = document.getElementById('inspName');
  const inspSpecs = document.getElementById('inspSpecs');
  const inspExplain = document.getElementById('inspExplain');
  const inspLat = document.getElementById('inspLat');
  const inspBw = document.getElementById('inspBw');
  const inspLiveText = document.getElementById('inspLiveText');

  const busToastContainer = document.getElementById('busToastContainer');

  // Virtual OS System Widget (Wave Graph)
  const waveCanvas = document.getElementById('osWaveCanvas');
  const waveCtx = waveCanvas ? waveCanvas.getContext('2d') : null;
  const widgetClock = document.getElementById('widgetClock');
  const widgetCpu = document.getElementById('widgetCpu');
  const widgetRam = document.getElementById('widgetRam');
  const waveHistory = Array(40).fill(5);

  // Wire Hardware callbacks (Ephemeral 2.5s toast in bottom-right of desktop)
  HW.state.onLog = ({ tag, text, level }) => {
    if (!busToastContainer) return;
    const toast = document.createElement('div');
    toast.className = `bus-toast mono ${level === 'err' ? 'err' : level === 'warn' ? 'warn' : ''}`;
    const tagCol = level === 'err' ? '#fca5a5' : level === 'warn' ? '#fde68a' : '#38bdf8';
    toast.innerHTML = `<span style="color:${tagCol};font-weight:700;">${tag}</span> ${text}`;
    busToastContainer.appendChild(toast);

    while (busToastContainer.children.length > 3) {
      busToastContainer.removeChild(busToastContainer.firstChild);
    }

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2400);
  };

  HW.state.onStepUpdate = (st) => {
    if (!st) {
      stepCard.classList.add('hidden');
      return;
    }
    stepStageBadge.textContent = st.badge;
    stepStageTitle.textContent = st.title;
    stepStageDesc.textContent = st.desc;
    stepCard.classList.remove('hidden');
  };

  HW.state.onProcessesChange = () => {
    OS.renderTaskbar();
  };

  // Inspector handler
  function openInspector(partKey) {
    const info = HW.INSPECTOR_DATA[partKey];
    if (!info) return;
    HW.state.selectedPart = partKey;
    inspIcon.textContent = info.icon;
    inspName.textContent = info.name;
    inspSpecs.textContent = info.specs;
    inspExplain.textContent = info.explain;
    inspLat.textContent = info.lat;
    inspBw.textContent = info.bw;
    inspLiveText.textContent = info.live();
    hwInspector.classList.remove('hidden');
  }

  document.getElementById('btnCloseInsp').addEventListener('click', () => {
    HW.state.selectedPart = null;
    hwInspector.classList.add('hidden');
  });

  function startSimulator() {
    // Init Board & Microarchitecture
    if (window.PCSim.BoardRenderer) {
      window.PCSim.BoardRenderer.init(document.getElementById('hwCanvasWrap'), openInspector);
    }
    CpuMicro.init();

    const btnResetCam = document.getElementById('btnResetCam');
    if (btnResetCam && window.PCSim.BoardRenderer && window.PCSim.BoardRenderer.resetCamera) {
      btnResetCam.addEventListener('click', () => window.PCSim.BoardRenderer.resetCamera());
    }

    // Start!
    HW.log('[BIOS]', 'Систему ініціалізовано. KiberOS 12 готова до роботи.');
    OS.runBootSequence();
    requestAnimationFrame(frame);
  }

  if (window.PCSim.BoardRenderer) {
    startSimulator();
  } else {
    window.addEventListener('pcsim-3d-ready', startSimulator, { once: true });
  }

  // View Mode Switcher
  const workspace = document.getElementById('workspace');
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      workspace.className = `workspace view-${tab.dataset.view}`;
    });
  });

  // Speed Pills
  document.querySelectorAll('.speed-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      HW.state.speedMode = pill.dataset.speed;
      if (HW.state.speedMode !== 'step') {
        HW.finishStepsAuto();
      }
    });
  });

  // Step-by-step buttons
  document.getElementById('btnStepNext').addEventListener('click', () => HW.nextStep());
  document.getElementById('btnStepAuto').addEventListener('click', () => HW.finishStepsAuto());

  // X-Ray CPU toggle
  const btnXray = document.getElementById('btnToggleXray');
  btnXray.addEventListener('click', () => {
    HW.state.xrayCpu = !HW.state.xrayCpu;
    btnXray.classList.toggle('active', HW.state.xrayCpu);
  });

  // PC Builder Drawer ("Збери ПК")
  const pcBuilderDrawer = document.getElementById('pcBuilderDrawer');
  const btnBuildPc = document.getElementById('btnBuildPc');
  btnBuildPc.addEventListener('click', () => {
    const isHidden = pcBuilderDrawer.classList.toggle('hidden');
    btnBuildPc.classList.toggle('active', !isHidden);
  });
  document.getElementById('btnCloseBuilder').addEventListener('click', () => {
    pcBuilderDrawer.classList.add('hidden');
    btnBuildPc.classList.remove('active');
  });
  document.querySelectorAll('.builder-opts').forEach(group => {
    const cfgKey = group.dataset.cfg;
    group.querySelectorAll('.cfg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.cfg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = cfgKey === 'ramGb' ? Number(btn.dataset.val) : btn.dataset.val;
        HW.setConfig(cfgKey, val);
      });
    });
  });

  // Sound toggle
  const btnSound = document.getElementById('btnSound');
  const soundIcon = document.getElementById('soundIcon');
  btnSound.addEventListener('click', () => {
    const next = !Audio.isEnabled();
    Audio.setEnabled(next);
    btnSound.classList.toggle('sound-on', next);
    soundIcon.textContent = next ? '🔊' : '🔇';
  });

  // Power / Reboot button
  const btnPower = document.getElementById('btnPower');
  btnPower.addEventListener('click', () => {
    HW.clearAllProcesses();
    OS.runBootSequence();
  });

  // Desktop Icons
  document.querySelectorAll('.desk-icon').forEach(icon => {
    icon.addEventListener('click', () => OS.openApp(icon.dataset.launch));
  });

  document.getElementById('btnStartMenu').addEventListener('click', () => {
    OS.openApp('terminal');
  });

  // Stress Test & Clear RAM
  document.getElementById('btnStressTest').addEventListener('click', () => {
    OS.openApp('browser');
    setTimeout(() => OS.openApp('game'), 250);
    setTimeout(() => OS.openApp('photo'), 500);
    setTimeout(() => OS.openApp('browser'), 750);
  });

  document.getElementById('btnKillAll').addEventListener('click', () => {
    HW.clearAllProcesses();
    document.getElementById('osWindowArea').innerHTML = '';
    OS.renderTaskbar();
  });

  document.getElementById('btnQuickFree').addEventListener('click', () => {
    HW.clearAllProcesses();
    document.getElementById('osWindowArea').innerHTML = '';
    OS.renderTaskbar();
  });

  // Guide Modal
  const guideModal = document.getElementById('guideModal');
  document.getElementById('btnGuide').addEventListener('click', () => guideModal.classList.remove('hidden'));
  document.getElementById('btnCloseGuide').addEventListener('click', () => guideModal.classList.add('hidden'));
  document.getElementById('btnOkGuide').addEventListener('click', () => guideModal.classList.add('hidden'));

  // Main 60FPS Loop
  let uiTick = 0;
  function frame() {
    HW.stepPhysics();
    if (window.PCSim.BoardRenderer) window.PCSim.BoardRenderer.render();

    uiTick++;
    if (uiTick % 8 === 0) {
      const s = HW.state;
      hudCpu.textContent = `${Math.round(s.cpuLoad)}% • ${s.cpuClockGhz.toFixed(1)} ГГц`;
      hudCpu.className = `tele-val mono ${s.cpuLoad > 80 ? 'danger' : s.cpuLoad > 55 ? 'warn' : ''}`;

      hudTemp.textContent = `${Math.round(s.cpuTemp)}°C`;
      hudTemp.className = `tele-val mono ${s.cpuTemp > 82 ? 'danger' : s.cpuTemp > 64 ? 'warn' : ''}`;

      hudRam.textContent = `${s.ramUsed.toFixed(1)} / ${s.ramMax.toFixed(1)} ГБ`;
      hudRam.className = `tele-val mono ${s.isOverflow ? 'danger' : s.ramPct > 75 ? 'warn' : ''}`;

      hudGpu.textContent = `${Math.round(s.gpuLoad)}% • ${Math.round(s.fps)} FPS`;
      hudBus.textContent = `${s.busThroughput.toFixed(1)} ГБ/с`;

      osFpsBadge.textContent = `${Math.round(s.fps)} FPS`;
      osFpsBadge.className = `fps-badge ${s.fps < 20 ? 'lag' : ''}`;

      alertBanner.classList.toggle('visible', s.isOverflow);

      if (s.selectedPart && !hwInspector.classList.contains('hidden')) {
        inspLiveText.textContent = HW.INSPECTOR_DATA[s.selectedPart].live();
      }

      // Update Desktop System Widget Wave Graph
      if (waveCtx) {
        waveHistory.push(s.cpuLoad);
        if (waveHistory.length > 40) waveHistory.shift();
        const ww = waveCanvas.width;
        const wh = waveCanvas.height;
        waveCtx.clearRect(0, 0, ww, wh);
        waveCtx.beginPath();
        waveHistory.forEach((v, idx) => {
          const x = (idx / (waveHistory.length - 1)) * ww;
          const y = wh - (v / 100) * (wh - 6) - 3;
          if (idx === 0) waveCtx.moveTo(x, y);
          else waveCtx.lineTo(x, y);
        });
        waveCtx.strokeStyle = s.isOverflow ? '#ef4444' : '#38bdf8';
        waveCtx.lineWidth = 1.8;
        waveCtx.stroke();
        waveCtx.lineTo(ww, wh);
        waveCtx.lineTo(0, wh);
        waveCtx.closePath();
        waveCtx.fillStyle = s.isOverflow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.16)';
        waveCtx.fill();

        if (widgetCpu) widgetCpu.textContent = `CPU: ${Math.round(s.cpuLoad)}%`;
        if (widgetRam) widgetRam.textContent = `ОЗП: ${Math.round(s.ramPct)}%`;
      }
    }

    if (uiTick % 60 === 0) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      osClock.textContent = timeStr;
      if (widgetClock) widgetClock.textContent = timeStr;
    }

    requestAnimationFrame(frame);
  }
})();
