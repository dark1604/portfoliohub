// Interactive Virtual OS ("KiberOS 12")
window.PCSim = window.PCSim || {};

window.PCSim.OS = (() => {
  const HW = window.PCSim.Hardware;
  const windowArea = document.getElementById('osWindowArea');
  const taskbarApps = document.getElementById('taskbarApps');
  const bootOverlay = document.getElementById('osBootOverlay');
  const bootLog = document.getElementById('bootLog');

  let activeWinId = null;
  let gameAnimId = null;
  let termInterval = null;

  const APP_META = {
    browser: { title: '🌐 Браузер «Огляд»', ram: 3.5, color: '#0ea5e9', icon: '🌐', name: 'Браузер' },
    game: { title: '🎮 3D-Симулятор польоту', ram: 6.5, color: '#fbbf24', icon: '🎮', name: '3D-Гра' },
    photo: { title: '🖼️ Фотостудія «ПіксельПро»', ram: 4.0, color: '#d99b43', icon: '🖼️', name: 'Фотостудія' },
    video: { title: '🎬 Відеостудія 4K (Рендер)', ram: 5.0, color: '#ef4444', icon: '🎬', name: 'Рендер відео' },
    terminal: { title: '💻 Термінал & Монітор ресурсів', ram: 1.5, color: '#10b981', icon: '💻', name: 'Термінал' },
    files: { title: '💾 Провідник (SSD / NVMe)', ram: 1.0, color: '#14b8a6', icon: '💾', name: 'Файли' }
  };

  function openApp(type) {
    if (!HW.state.powered) return;
    const meta = APP_META[type];
    if (!meta) return;

    // Allocate RAM process
    const proc = HW.addProcess({
      type,
      name: meta.name,
      icon: meta.icon,
      ram: meta.ram,
      color: meta.color
    });

    if (type === 'browser' || type === 'game' || type === 'photo' || type === 'video') {
      HW.triggerWorkload(type);
    } else {
      HW.triggerWorkload('browser');
    }

    renderWindow(proc);
    renderTaskbar();
  }

  function renderTaskbar() {
    taskbarApps.innerHTML = '';
    HW.state.processes.filter(p => p.removable).forEach(proc => {
      const btn = document.createElement('button');
      btn.className = `tb-app ${activeWinId === proc.id ? 'active' : ''}`;
      btn.innerHTML = `${proc.icon} ${proc.name} <span style="opacity:0.65">(${proc.ram}ГБ)</span>`;
      btn.onclick = () => renderWindow(proc);
      taskbarApps.appendChild(btn);
    });
  }

  function closeWindow(procId) {
    if (gameAnimId) { cancelAnimationFrame(gameAnimId); gameAnimId = null; }
    if (termInterval) { clearInterval(termInterval); termInterval = null; }
    HW.removeProcess(procId);
    if (activeWinId === procId) {
      windowArea.innerHTML = '';
      activeWinId = null;
    }
    renderTaskbar();
  }

  function renderWindow(proc) {
    if (gameAnimId) { cancelAnimationFrame(gameAnimId); gameAnimId = null; }
    if (termInterval) { clearInterval(termInterval); termInterval = null; }

    activeWinId = proc.id;
    const meta = APP_META[proc.type];

    windowArea.innerHTML = `
      <div class="os-win">
        <div class="win-header">
          <span>${meta.title} <span class="mono" style="opacity:0.6;font-size:0.7rem;">[${proc.ram} ГБ ОЗП]</span></span>
          <button class="win-close" id="winCloseBtn" title="Закрити програму і звільнити ОЗП">✕</button>
        </div>
        <div class="win-body" id="winBody"></div>
      </div>
    `;

    document.getElementById('winCloseBtn').onclick = () => closeWindow(proc.id);
    const body = document.getElementById('winBody');

    if (proc.type === 'browser') buildBrowserUI(body);
    else if (proc.type === 'game') buildGameUI(body);
    else if (proc.type === 'photo') buildPhotoUI(body);
    else if (proc.type === 'video') buildVideoUI(body);
    else if (proc.type === 'terminal') buildTerminalUI(body);
    else if (proc.type === 'files') buildFilesUI(body);

    renderTaskbar();
  }

  function buildBrowserUI(body) {
    body.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="brUrl" class="mono" type="text" value="https://kiber-wiki.ua/pc-architecture" readonly
          style="flex:1;background:#070b13;border:1px solid #1e293b;color:#7dd3fc;padding:5px 8px;border-radius:6px;font-size:0.74rem;" />
        <button class="btn-primary" id="brReload" style="padding:5px 10px;font-size:0.72rem;">↻ Оновити</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn-ghost br-tab" data-page="wiki" style="padding:4px 8px;font-size:0.72rem;">📖 Як працює ПК</button>
        <button class="btn-ghost br-tab" data-page="video" style="padding:4px 8px;font-size:0.72rem;">🎬 Відео 4K</button>
        <button class="btn-ghost br-tab" data-page="newtab" style="padding:4px 8px;font-size:0.72rem;">➕ Нова вкладка (+3.5 ГБ)</button>
      </div>
      <div id="brContent" style="flex:1;background:#070b13;border:1px solid #1e293b;border-radius:8px;padding:12px;font-size:0.78rem;line-height:1.5;color:#cbd5e1;overflow:auto;">
        <h3 style="color:#38bdf8;margin-bottom:6px;">Архітектура фон Неймана простими словами</h3>
        <p>Кожен раз, коли ти відкриваєш сайт, <strong>SSD</strong> передає код браузера в <strong>ОЗП</strong>, <strong>CPU</strong> розбирає HTML та JS, а <strong>GPU</strong> малює картинку на екрані.</p>
        <p style="margin-top:8px;color:#94a3b8;">Спробуй відкрити кілька вкладок або запустити 3D-гру паралельно, щоб побачити, як заповнюються слоти DDR5!</p>
      </div>
    `;

    document.getElementById('brReload').onclick = () => {
      HW.triggerWorkload('browser');
    };
    body.querySelectorAll('.br-tab').forEach(btn => {
      btn.onclick = () => {
        const p = btn.dataset.page;
        if (p === 'newtab') {
          openApp('browser');
          return;
        }
        HW.triggerWorkload('browser');
        const content = document.getElementById('brContent');
        if (p === 'video') {
          document.getElementById('brUrl').value = 'https://stream.ua/4k-hardware-tour';
          content.innerHTML = `
            <div style="background:#1a1f29;border:1px solid #38bdf8;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:24px;">🎬</div>
              <strong style="color:#f1f5f9;">Стрімінг відео 4K активний</strong>
              <p style="font-size:0.73rem;color:#cbd5e1;margin-top:4px;">Декодування кадрів навантажує ОЗП, CPU та відеокарту GPU.</p>
            </div>
          `;
        } else {
          document.getElementById('brUrl').value = 'https://kiber-wiki.ua/pc-architecture';
          content.innerHTML = `
            <h3 style="color:#38bdf8;margin-bottom:6px;">Архітектура фон Неймана простими словами</h3>
            <p>Кожен раз, коли ти відкриваєш сайт, <strong>SSD</strong> передає код браузера в <strong>ОЗП</strong>, <strong>CPU</strong> розбирає HTML та JS, а <strong>GPU</strong> малює картинку на екрані.</p>
          `;
        }
      };
    });
  }

  function buildGameUI(body) {
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.74rem;">
        <span style="color:#f1f5f9;font-weight:700;">🚀 3D-СИМУЛЯТОР ПОЛЬОТУ (Живий рендер GPU)</span>
        <span id="gameFpsLbl" class="mono" style="color:#22c55e;font-weight:700;">60 FPS</span>
      </div>
      <canvas id="gameCanvas" style="width:100%;flex:1;background:#040507;border:1px solid rgba(255,255,255,0.14);border-radius:8px;"></canvas>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.71rem;color:#94a3b8;">
        <span>Керування: стрілки ◀ ▶ або миша</span>
        <span id="gameLagWarn" style="color:#ef4444;font-weight:700;"></span>
      </div>
    `;

    const gc = document.getElementById('gameCanvas');
    const gctx = gc.getContext('2d');
    const fpsLbl = document.getElementById('gameFpsLbl');
    const lagWarn = document.getElementById('gameLagWarn');

    let shipX = 0;
    let targetShipX = 0;
    const stars = Array.from({ length: 55 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random()
    }));

    gc.addEventListener('mousemove', (e) => {
      const r = gc.getBoundingClientRect();
      targetShipX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    });

    let lastRender = 0;
    function loopGame(ts) {
      if (!document.getElementById('gameCanvas')) return;
      const fps = Math.max(4, HW.state.fps);
      const frameInterval = 1000 / fps;

      if (ts - lastRender >= frameInterval) {
        lastRender = ts;
        const r = gc.getBoundingClientRect();
        if (gc.width !== Math.round(r.width) || gc.height !== Math.round(r.height)) {
          gc.width = Math.max(100, Math.round(r.width));
          gc.height = Math.max(100, Math.round(r.height));
        }

        const w = gc.width;
        const h = gc.height;
        gctx.fillStyle = 'rgba(4, 6, 12, 0.35)';
        gctx.fillRect(0, 0, w, h);

        shipX += (targetShipX - shipX) * 0.12;

        // 3D Starfield / Tunnel
        stars.forEach(st => {
          st.z -= 0.018;
          if (st.z <= 0.02) {
            st.z = 1;
            st.x = (Math.random() - 0.5) * 2;
            st.y = (Math.random() - 0.5) * 2;
          }
          const sx = w / 2 + ((st.x - shipX * 0.4) / st.z) * (w * 0.42);
          const sy = h / 2 + (st.y / st.z) * (h * 0.42);
          const size = (1 - st.z) * 3.5;

          gctx.fillStyle = HW.state.isOverflow ? '#ef4444' : '#fbbf24';
          gctx.beginPath();
          gctx.arc(sx, sy, size, 0, Math.PI * 2);
          gctx.fill();
        });

        // Player cyber-glider
        const px = w / 2 + shipX * (w * 0.32);
        const py = h - 26;
        gctx.beginPath();
        gctx.moveTo(px, py - 14);
        gctx.lineTo(px + 14, py + 8);
        gctx.lineTo(px, py + 3);
        gctx.lineTo(px - 14, py + 8);
        gctx.closePath();
        gctx.fillStyle = '#38bdf8';
        gctx.fill();

        fpsLbl.textContent = `${Math.round(fps)} FPS`;
        fpsLbl.style.color = fps < 20 ? '#ef4444' : '#6ee7b7';
        lagWarn.textContent = HW.state.isOverflow ? '⚠️ ЛАГИ ЧЕРЕЗ SWAP НА SSD!' : '';
      }
      gameAnimId = requestAnimationFrame(loopGame);
    }
    gameAnimId = requestAnimationFrame(loopGame);
  }

  function buildPhotoUI(body) {
    body.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn-ghost ph-flt" data-f="orig" style="padding:4px 8px;font-size:0.72rem;">Оригінал</button>
        <button class="btn-primary ph-flt" data-f="neon" style="padding:4px 8px;font-size:0.72rem;">⚡ Кібер-Неон</button>
        <button class="btn-primary ph-flt" data-f="invert" style="padding:4px 8px;font-size:0.72rem;">🎨 Негатив</button>
        <button class="btn-primary ph-flt" data-f="blur" style="padding:4px 8px;font-size:0.72rem;">🌫️ Розмиття</button>
      </div>
      <canvas id="photoCanvas" style="width:100%;flex:1;border-radius:8px;border:1px solid #d99b43;background:#070b13;"></canvas>
    `;

    const pc = document.getElementById('photoCanvas');
    const pctx = pc.getContext('2d');

    function drawSample(filter = 'orig') {
      const r = pc.getBoundingClientRect();
      pc.width = Math.max(240, Math.round(r.width));
      pc.height = Math.max(140, Math.round(r.height));
      const w = pc.width;
      const h = pc.height;

      // Draw vibrant cyber mountain scene
      const grad = pctx.createLinearGradient(0, 0, 0, h);
      if (filter === 'neon') {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#0284c7');
      } else if (filter === 'invert') {
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(1, '#1e293b');
      } else {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e3a8a');
      }
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, w, h);

      // Sun
      pctx.beginPath();
      pctx.arc(w * 0.5, h * 0.42, 34, 0, Math.PI * 2);
      pctx.fillStyle = filter === 'invert' ? '#38bdf8' : '#f59e0b';
      pctx.fill();

      // Mountains
      pctx.beginPath();
      pctx.moveTo(0, h);
      pctx.lineTo(w * 0.25, h * 0.52);
      pctx.lineTo(w * 0.5, h * 0.72);
      pctx.lineTo(w * 0.78, h * 0.45);
      pctx.lineTo(w, h);
      pctx.closePath();
      pctx.fillStyle = filter === 'neon' ? '#38bdf8' : '#090d16';
      pctx.fill();

      if (filter === 'blur') {
        pctx.fillStyle = 'rgba(255,255,255,0.12)';
        pctx.fillRect(0, 0, w, h);
      }
    }

    setTimeout(() => drawSample('orig'), 20);
    body.querySelectorAll('.ph-flt').forEach(btn => {
      btn.onclick = () => {
        const f = btn.dataset.f;
        drawSample(f);
        HW.triggerWorkload('photo', { filter: btn.textContent });
      };
    });
  }

  function buildTerminalUI(body) {
    body.innerHTML = `
      <div id="termCores" class="mono" style="font-size:0.7rem;background:#070b13;border:1px solid #1e293b;border-radius:7px;padding:8px;color:#6ee7b7;"></div>
      <div id="termOut" class="mono" style="flex:1;font-size:0.71rem;background:#04070d;border:1px solid #1e293b;border-radius:7px;padding:8px;color:#cbd5e1;overflow:auto;">
        <div>KiberOS Terminal v12.4 — введіть <b>help</b>, <b>mem</b> або <b>stress</b></div>
      </div>
      <div style="display:flex;gap:6px;">
        <input id="termIn" class="mono" placeholder="Введіть команду (напр. mem)..."
          style="flex:1;background:#070b13;border:1px solid #38bdf8;color:#fff;padding:5px 8px;border-radius:6px;font-size:0.74rem;" />
        <button id="termRun" class="btn-primary" style="padding:5px 10px;font-size:0.72rem;">Enter</button>
      </div>
    `;

    const coresEl = document.getElementById('termCores');
    const outEl = document.getElementById('termOut');
    const inEl = document.getElementById('termIn');

    function updateHtop() {
      if (!document.getElementById('termCores')) return;
      const s = HW.state;
      coresEl.innerHTML = s.cpuCores.map((c, i) => {
        const bars = '█'.repeat(Math.round(c / 12)) + '░'.repeat(8 - Math.round(c / 12));
        return `Ядро${i}: [${bars}] ${Math.round(c)}%`;
      }).join(' &nbsp;|&nbsp; ');
    }
    updateHtop();
    termInterval = setInterval(updateHtop, 450);

    function execCmd() {
      const cmd = inEl.value.trim().toLowerCase();
      if (!cmd) return;
      inEl.value = '';
      outEl.innerHTML += `<div style="color:#38bdf8;">$ ${cmd}</div>`;
      if (cmd === 'help') {
        outEl.innerHTML += `<div>Доступно: <b>mem</b> (дамп ОЗП), <b>stress</b> (навантажити ПК), <b>clear</b> (очистити ОЗП)</div>`;
      } else if (cmd === 'mem') {
        outEl.innerHTML += `<div>[0x0000-0xFFFF] ОЗП: ${HW.state.ramUsed.toFixed(1)}/${HW.state.ramMax} ГБ | Swap: ${HW.state.isOverflow ? 'ACTIVE' : 'OFF'}</div>`;
      } else if (cmd === 'stress') {
        openApp('game');
        openApp('photo');
      } else if (cmd === 'clear') {
        HW.clearAllProcesses();
        renderTaskbar();
      } else {
        outEl.innerHTML += `<div style="color:#f59e0b;">Невідома команда. Введіть help.</div>`;
      }
      outEl.scrollTop = outEl.scrollHeight;
    }

    document.getElementById('termRun').onclick = execCmd;
    inEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') execCmd(); });
  }

  function buildVideoUI(body) {
    body.innerHTML = `
      <div style="background:#070b13;border:1px solid #ef4444;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:#fecaca;font-size:0.82rem;">🎬 Проєкт: Кіберпанк_Трейлер_4K.mp4</strong>
          <span class="mono" style="color:#fca5a5;font-size:0.72rem;">3840×2160 • 60fps</span>
        </div>
        <div style="height:26px;background:#0f172a;border-radius:5px;border:1px solid #334155;display:flex;gap:3px;padding:3px;">
          <div style="flex:2;background:#0284c7;border-radius:3px;"></div>
          <div style="flex:3;background:#fbbf24;border-radius:3px;"></div>
          <div style="flex:1.5;background:#d97706;border-radius:3px;"></div>
        </div>
        <div style="width:100%;height:10px;background:#0f172a;border-radius:5px;overflow:hidden;">
          <div id="vidProg" style="width:15%;height:100%;background:linear-gradient(90deg,#ef4444,#f59e0b);transition:width 0.3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span id="vidStatus" class="mono" style="font-size:0.71rem;color:#94a3b8;">Готово до експорту</span>
          <button id="btnRenderVid" class="btn-primary" style="background:linear-gradient(135deg,#dc2626,#d97706);">⚡ Рендерити 4K відео</button>
        </div>
      </div>
    `;

    document.getElementById('btnRenderVid').onclick = () => {
      const prog = document.getElementById('vidProg');
      const status = document.getElementById('vidStatus');
      HW.triggerWorkload('video');
      let p = 15;
      status.textContent = 'Кодування кадрів у CPU + GPU...';
      const iv = setInterval(() => {
        if (!document.getElementById('vidProg')) { clearInterval(iv); return; }
        p = Math.min(100, p + (HW.state.isOverflow ? 6 : 18));
        prog.style.width = p + '%';
        if (p >= 100) {
          clearInterval(iv);
          status.textContent = '✅ Збережено на SSD!';
        }
      }, 300);
    };
  }

  function buildFilesUI(body) {
    body.innerHTML = `
      <p style="font-size:0.76rem;color:#cbd5e1;">Натисни на файл, щоб записати зміни з оперативної пам'яті (ОЗП) на постійний накопичувач SSD:</p>
      <div style="display:flex;flex-direction:column;gap:7px;">
        <button class="btn-ghost save-file-btn" data-fn="Звіт_інформатика.docx" style="text-align:left;">📄 Звіт_інформатика.docx (Записати на SSD)</button>
        <button class="btn-ghost save-file-btn" data-fn="Сцена_3D_місто.blend" style="text-align:left;">🧊 Сцена_3D_місто.blend (Записати на SSD)</button>
        <button class="btn-ghost save-file-btn" data-fn="Фото_обробка.png" style="text-align:left;">🖼️ Фото_обробка.png (Записати на SSD)</button>
      </div>
    `;
    body.querySelectorAll('.save-file-btn').forEach(b => {
      b.onclick = () => HW.triggerWorkload('save', { filename: b.dataset.fn });
    });
  }

  function runBootSequence() {
    HW.state.powered = true;
    bootOverlay.classList.remove('hidden');
    bootLog.textContent = '';
    const lines = [
      'KIBER-BIOS v4.80 (c) 2026',
      'CPU: Core X8 @ 4.8 GHz ... OK',
      'RAM: 16384 MB DDR5-6000 Dual Channel ... OK',
      'NVMe0: 1TB SSD PCIe 4.0 x4 ... OK',
      'GPU: RTX Graphics 8GB GDDR6 ... OK',
      'Завантаження ядра KiberOS 12.4...'
    ];
    window.PCSim.Audio.play('boot');
    lines.forEach((line, idx) => {
      setTimeout(() => {
        bootLog.textContent += line + '\n';
        if (idx === lines.length - 1) {
          setTimeout(() => bootOverlay.classList.add('hidden'), 550);
        }
      }, idx * 220);
    });
  }

  return {
    openApp,
    closeWindow,
    renderTaskbar,
    runBootSequence
  };
})();
