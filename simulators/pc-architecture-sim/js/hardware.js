// Central Hardware Simulation Engine
window.PCSim = window.PCSim || {};

window.PCSim.Hardware = (() => {
  const state = {
    powered: true,
    speedMode: 'normal', // 'slow' | 'normal' | 'step'
    xrayCpu: false,
    selectedPart: null,

    config: {
      ramGb: 16,
      diskType: 'nvme', // 'hdd' | 'nvme'
      coolerType: 'tower' // 'box' | 'tower' | 'aio'
    },

    ramMax: 16.0,
    ramTotalRequested: 2.0,
    ramUsed: 2.0,
    ramPct: 12.5,
    isOverflow: false,

    cpuLoad: 4,
    cpuCores: [5, 3, 6, 2, 4, 3, 5, 4],
    cpuClockGhz: 3.8,
    cpuTemp: 38,
    fanRpm: 920,
    cuState: 'IDLE',
    aluOps: '0.4 GOPS',

    gpuLoad: 2,
    gpuVram: 0.4,
    fps: 60,

    ssdBusy: 0,
    busThroughput: 0.4,

    processes: [
      { id: 'os', type: 'os', name: 'KiberOS Ядро', icon: '⚙️', ram: 2.0, color: '#38bdf8', removable: false }
    ],
    procSeq: 0,

    packets: [],
    stepQueue: [],
    stepPaused: false,
    onStepUpdate: null,
    onLog: null,
    onProcessesChange: null
  };

  const INSPECTOR_DATA = {
    cpu: {
      icon: '🧠',
      name: 'Процесор-майстер (CPU)',
      specs: '8 Ядер • до 4.8 ГГц • Кеш L1/L2',
      explain: 'Головний майстер на виробництві. Пристрій керування (CU) приймає замовлення, АЛУ (ALU) виконує математику й логіку, а Кеш L1/L2 тримає інструменти під рукою.',
      lat: '~0.3 нс (Кеш L1: ~1 нс)',
      bw: '~120 ГБ/с',
      live: () => {
        if (!state.powered) return 'Живлення вимкнено.';
        if (state.isOverflow) return `ПЕРЕВАНТАЖЕННЯ! Температура ${Math.round(state.cpuTemp)}°C, кулер ${Math.round(state.fanRpm)} RPM. Простоює в очікуванні повільного Swap з SSD.`;
        if (state.cpuLoad > 55) return `Високе навантаження (${Math.round(state.cpuLoad)}%) на ${state.cpuClockGhz.toFixed(1)} ГГц. АЛУ виконує ${state.aluOps}.`;
        return `Штатна робота (${Math.round(state.cpuLoad)}%), ${state.cpuClockGhz.toFixed(1)} ГГц, ${Math.round(state.cpuTemp)}°C.`;
      }
    },
    ram: {
      icon: '⚡',
      name: 'Швидкий оперативний верстак (ОЗП / DDR5)',
      specs: '16 ГБ • 4 модулі DIMM • 6000 МТ/с',
      explain: 'Просторий та надшвидкий «верстак» процесора. Сюди завозять деталі (програми) зі складу SSD, щоб майстер працював миттєво. При вимкненні світла верстак очищується!',
      lat: '~12 наносекунд',
      bw: '~64 ГБ/с',
      live: () => {
        if (state.isOverflow) return `КРИТИЧНО: Верстак забитий (${state.ramTotalRequested.toFixed(1)} / 16.0 ГБ)! Переповнення викликає скидання даних у Swap на SSD.`;
        return `Зайнято ${state.ramUsed.toFixed(1)} ГБ з 16.0 ГБ (${Math.round(state.ramPct)}%). Активних процесів: ${state.processes.length}.`;
      }
    },
    ssd: {
      icon: '💾',
      name: 'Великий склад даних (NVMe SSD)',
      specs: '1 ТБ • PCIe 4.0 x4 • Постійна пам\'ять',
      explain: 'Величезний «склад» комп\'ютера: ОС, ігри, відео та фото зберігаються тут навіть без живлення. Надійний, але в тисячі разів повільніший за оперативний верстак (ОЗП).',
      lat: '~80 мікросекунд',
      bw: '~3.5 – 5.0 ГБ/с',
      live: () => {
        if (state.isOverflow) return 'АКТИВНИЙ SWAP! Склад перевантажений постійним перекиданням даних замість ОЗП.';
        if (state.ssdBusy > 0) return 'Триває відвантаження або запис блоків даних через NVMe-контролер.';
        return 'У режимі очікування. Усі файли надійно збережено на складі.';
      }
    },
    gpu: {
      icon: '🎨',
      name: 'Відеокарта — Графічний цех (GPU)',
      specs: '8 ГБ GDDR6 • 3584 Шейдери • PCIe x16',
      explain: 'Спеціалізований цех із тисячами «художників», які одночасно прораховують 3D-геометрію, відеоефекти та мільйони пікселів для монітора.',
      lat: '~140 нс (VRAM)',
      bw: '~448 ГБ/с (внутр.)',
      live: () => {
        if (state.gpuLoad > 45) return `Активний рендеринг графіки! Завантаження ${Math.round(state.gpuLoad)}%, поточна плавність: ${Math.round(state.fps)} FPS.`;
        return `Виводить робочий стіл та інтерфейс (${Math.round(state.gpuLoad)}%, ${Math.round(state.fps)} FPS).`;
      }
    },
    chipset: {
      icon: '🔀',
      name: 'Системний чипсет (Диспетчер логістики)',
      specs: 'Маршрутизатор DMI 4.0 • Контролер DMA',
      explain: '«Диспетчер логістики» материнської плати. Координує вантажівки даних між складом SSD, портами, ОЗП та процесором.',
      lat: '~25 нс',
      bw: '~16 ГБ/с',
      live: () => {
        if (state.isOverflow) return 'ЗАТОР НА РОЗВ\'ЯЗЦІ! Пропускає аварійний потік Swap між ОЗП та SSD.';
        return `Стабільна маршрутизація пакетів (${state.busThroughput.toFixed(1)} ГБ/с).`;
      }
    },
    bus: {
      icon: '🛣️',
      name: 'Транспортні магістралі (Шини даних і адрес)',
      specs: 'Багатосмугові мідні магістралі',
      explain: 'Швидкісні «автобани» материнської плати, якими мчать електричні імпульси (0 і 1). Поділяються на шину даних, адресну шину та шину керування.',
      lat: 'Швидкість сигналу ~20 см/нс',
      bw: 'DDR5: 64 ГБ/с • PCIe x16: 32 ГБ/с',
      live: () => {
        if (state.isOverflow) return `ПРОБКА НА МАГІСТРАЛІ! Шини перевантажені Swap-трафіком.`;
        return `Поточний потік: ${state.busThroughput.toFixed(1)} ГБ/с • Активних пакетів (0/1): ${state.packets.length}.`;
      }
    }
  };

  function log(tag, text, level = 'info') {
    if (state.onLog) state.onLog({ tag, text, level });
  }

  function recalcRam() {
    const total = state.processes.reduce((s, p) => s + p.ram, 0);
    state.ramTotalRequested = total;
    state.ramUsed = Math.min(state.ramMax, total);
    state.ramPct = Math.min(100, (total / state.ramMax) * 100);
    state.isOverflow = total > state.ramMax;
    if (state.onProcessesChange) state.onProcessesChange(state.processes);
  }

  function addProcess({ type, name, icon, ram, color }) {
    state.procSeq++;
    const proc = {
      id: `${type}-${state.procSeq}`,
      type,
      name,
      icon,
      ram,
      color,
      removable: true
    };
    state.processes.push(proc);
    recalcRam();
    return proc;
  }

  function removeProcess(id) {
    state.processes = state.processes.filter(p => p.id !== id);
    recalcRam();
    log('[ОЗП]', 'Процес завершено, блоки пам\'яті звільнено.');
  }

  function clearAllProcesses() {
    state.processes = state.processes.filter(p => !p.removable);
    state.cpuLoad = 4;
    state.gpuLoad = 2;
    state.stepQueue = [];
    state.stepPaused = false;
    if (state.onStepUpdate) state.onStepUpdate(null);
    recalcRam();
    log('[ОЗП]', 'Усі користувацькі програми закрито. Пам\'ять очищено.');
  }

  const BIT_STREAMS = ['0101', '1011', '0010', '1101', '0x4F', '0xA2', '1001'];

  function setConfig(key, value) {
    state.config[key] = value;
    if (key === 'ramGb') {
      state.ramMax = Number(value);
      recalcRam();
      log('[ЗБІРКА]', `Встановлено ОЗП: ${state.ramMax} ГБ DDR5.`);
    } else if (key === 'diskType') {
      log('[ЗБІРКА]', `Накопичувач змінено на: ${value === 'hdd' ? 'HDD 5400 RPM (повільний)' : 'NVMe SSD PCIe 4.0'}.`);
    } else if (key === 'coolerType') {
      const names = { box: 'Боксовий кулер', tower: 'Потужна вежа', aio: 'Водяне охолодження (СРО)' };
      log('[ЗБІРКА]', `Охолодження CPU: ${names[value]}.`);
    }
    window.dispatchEvent(new CustomEvent('pcsim-config-change', { detail: state.config }));
  }

  function spawnPacket({ bus, reverse = false, color = '#38bdf8', label = '', speed = 0.015, onArrive = null }) {
    if (!state.powered) return;
    const overflow = state.isOverflow;
    const isDiskBus = bus === 'ssd-chipset';
    const diskMul = (isDiskBus && state.config.diskType === 'hdd') ? 0.32 : 1.0;
    const finalLabel = label || BIT_STREAMS[Math.floor(Math.random() * BIT_STREAMS.length)];
    state.packets.push({
      bus,
      reverse,
      t: 0,
      speed: (overflow ? speed * 0.42 : speed) * diskMul,
      color: overflow ? (Math.random() > 0.35 ? '#ef4444' : '#f59e0b') : color,
      label: finalLabel,
      onArrive,
      trail: []
    });
  }

  function spawnBurst(bus, reverse, color, count, intervalMs, label, onDone) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        spawnPacket({
          bus,
          reverse,
          color,
          label,
          onArrive: i === count - 1 ? onDone : null
        });
        if (i === 0) window.PCSim.Audio.play('tick');
      }, i * intervalMs);
    }
  }

  function runSequence(steps) {
    if (state.speedMode === 'step') {
      state.stepQueue = [...steps];
      nextStep();
    } else {
      let i = 0;
      const go = () => {
        if (i >= steps.length) return;
        const st = steps[i++];
        st.run(() => {
          setTimeout(go, state.speedMode === 'slow' ? 420 : 110);
        });
      };
      go();
    }
  }

  function nextStep() {
    if (state.stepQueue.length === 0) {
      state.stepPaused = false;
      if (state.onStepUpdate) state.onStepUpdate(null);
      return;
    }
    const st = state.stepQueue.shift();
    state.stepPaused = true;
    if (state.onStepUpdate) state.onStepUpdate(st);
    st.run(() => {});
  }

  function finishStepsAuto() {
    state.stepPaused = false;
    if (state.onStepUpdate) state.onStepUpdate(null);
    while (state.stepQueue.length > 0) {
      const st = state.stepQueue.shift();
      st.run(() => {});
    }
  }

  function triggerWorkload(kind, meta = {}) {
    if (!state.powered) return;
    window.PCSim.Audio.play('launch');

    if (kind === 'browser') {
      log('[0x1A40]', 'SSD ➔ ОЗП: Завантаження рушія браузера...', state.isOverflow ? 'err' : 'info');
      runSequence([
        {
          badge: 'ЕТАП 1: SSD ➔ ЧИПСЕТ ➔ ОЗП',
          title: 'Копіювання програми в ОЗП',
          desc: 'Браузер зчитується з накопичувача SSD і через Чипсет (DMA) розміщується в оперативній пам\'яті.',
          run: (done) => {
            state.ssdBusy = 45;
            spawnBurst('ssd-chipset', false, '#10b981', 4, 80, 'BIN', () => {
              spawnBurst('chipset-ram', false, '#38bdf8', 4, 80, 'RAM', done);
            });
          }
        },
        {
          badge: 'ЕТАП 2: FETCH & DECODE (ОЗП ➔ CPU)',
          title: 'Процесор обробляє веб-сторінку',
          desc: 'Пристрій керування забирає інструкції з ОЗП, а АЛУ виконує JavaScript-код сторінки.',
          run: (done) => {
            state.cpuLoad = Math.min(98, state.cpuLoad + 28);
            state.cuState = 'FETCH/DECODE';
            state.aluOps = '4.8 GOPS';
            spawnBurst('cpu-ram', true, '#38bdf8', 5, 75, 'JS', done);
          }
        },
        {
          badge: 'ЕТАП 3: RENDER (CPU ➔ GPU)',
          title: 'Малювання інтерфейсу на екрані',
          desc: 'Відеокарта отримує команди малювання вкладок і тексту від CPU по шині PCIe x16.',
          run: (done) => {
            state.gpuLoad = Math.min(95, state.gpuLoad + 18);
            spawnBurst('cpu-gpu', false, '#fbbf24', 4, 80, 'UI', done);
          }
        }
      ]);
    } else if (kind === 'game') {
      log('[0x8F00]', 'SSD ➔ ОЗП: Завантаження 3D-рушія та текстур!', state.isOverflow ? 'err' : 'warn');
      runSequence([
        {
          badge: 'ЕТАП 1: МАСИВНИЙ ТРАНСФЕР (SSD ➔ ОЗП)',
          title: 'Завантаження 3D-текстур із SSD',
          desc: 'Ігрові моделі та текстури переміщуються з постійного сховища SSD в швидку пам\'ять DDR5.',
          run: (done) => {
            state.ssdBusy = 75;
            spawnBurst('ssd-chipset', false, '#22c55e', 7, 65, 'TEX', () => {
              spawnBurst('chipset-ram', false, '#fbbf24', 7, 65, 'MEM', done);
            });
          }
        },
        {
          badge: 'ЕТАП 2: ІГРОВА ФІЗИКА (ОЗП ↔ CPU)',
          title: 'Прорахунок фізики та логіки гри',
          desc: 'CPU та ОЗП безперервно обмінюються координатами об\'єктів і станом світу.',
          run: (done) => {
            state.cpuLoad = Math.min(98, state.cpuLoad + 46);
            state.cuState = 'GAME LOOP';
            state.aluOps = '19.2 GOPS';
            spawnBurst('cpu-ram', true, '#38bdf8', 5, 65, 'PHYS', () => {
              spawnBurst('cpu-ram', false, '#f5b95b', 4, 65, 'OUT', done);
            });
          }
        },
        {
          badge: 'ЕТАП 3: 3D-РЕНДЕРИНГ (CPU ➔ GPU)',
          title: 'Рендеринг 3D-сцени у Відеокарті',
          desc: 'GPU отримує потік вершин і шейдерів по PCIe x16 та малює кожен кадр для монітора.',
          run: (done) => {
            state.gpuLoad = Math.min(98, state.gpuLoad + 68);
            spawnBurst('cpu-gpu', false, '#fbbf24', 8, 60, '3D', done);
          }
        }
      ]);
    } else if (kind === 'photo') {
      log('[0x4B20]', `АЛУ CPU: Обробка фільтра «${meta.filter || 'Пікселі'}»!`, state.isOverflow ? 'err' : 'info');
      runSequence([
        {
          badge: 'ЕТАП 1: SIMD ОБЧИСЛЕННЯ В АЛУ',
          title: 'Математична обробка пікселів',
          desc: 'АЛУ процесора застосовує матрицю фільтра до мільйонів пікселів зображення в ОЗП.',
          run: (done) => {
            state.cpuLoad = Math.min(99, state.cpuLoad + 55);
            state.cuState = 'SIMD ALU';
            state.aluOps = '26.4 GOPS';
            spawnBurst('cpu-ram', true, '#f5b95b', 6, 60, 'RGB', () => {
              spawnBurst('cpu-ram', false, '#10b981', 5, 60, 'PIX', done);
            });
          }
        },
        {
          badge: 'ЕТАП 2: ОНОВЛЕННЯ ЕКРАНА (CPU ➔ GPU)',
          title: 'Вивід відредагованого фото',
          desc: 'Оновлений буфер зображення передається на GPU для показу на моніторі.',
          run: (done) => {
            state.gpuLoad = Math.min(90, state.gpuLoad + 22);
            spawnBurst('cpu-gpu', false, '#fbbf24', 4, 75, 'IMG', done);
          }
        }
      ]);
    } else if (kind === 'video') {
      log('[0x7E00]', 'РЕНДЕР ВІДЕО 4K: Важке навантаження на SSD ➔ ОЗП ➔ CPU + GPU!', state.isOverflow ? 'err' : 'warn');
      runSequence([
        {
          badge: 'ЕТАП 1: ІМПОРТ КЛІПІВ (SSD ➔ ОЗП)',
          title: 'Завантаження сирого відео зі складу SSD',
          desc: 'Великі відеофайли 4K копіюються з накопичувача SSD на оперативний верстак (ОЗП).',
          run: (done) => {
            state.ssdBusy = 80;
            spawnBurst('ssd-chipset', false, '#10b981', 6, 70, 'MP4', () => {
              spawnBurst('chipset-ram', false, '#38bdf8', 6, 70, '4K', done);
            });
          }
        },
        {
          badge: 'ЕТАП 2: КОДУВАННЯ КАДРІВ (ОЗП ↔ CPU + GPU)',
          title: 'Стиснення відео в АЛУ та Графічному цеху',
          desc: 'Процесор-майстер кодує потік H.265, а GPU прискорює ефекти та переходи.',
          run: (done) => {
            state.cpuLoad = Math.min(99, state.cpuLoad + 60);
            state.gpuLoad = Math.min(98, state.gpuLoad + 58);
            state.cuState = 'H.265 ENC';
            state.aluOps = '29.8 GOPS';
            spawnBurst('cpu-ram', true, '#fbbf24', 6, 65, '0101', () => {
              spawnBurst('cpu-gpu', false, '#fbbf24', 6, 65, 'ENC', done);
            });
          }
        },
        {
          badge: 'ЕТАП 3: ЕКСПОРТ ГОТОВОГО ВІДЕО (ОЗП ➔ SSD)',
          title: 'Запис змонтованого ролика на SSD',
          desc: 'Готовий відеофайл зберігається назад на склад даних SSD.',
          run: (done) => {
            state.ssdBusy = 65;
            spawnBurst('chipset-ram', true, '#10b981', 5, 75, 'OUT', () => {
              spawnBurst('ssd-chipset', true, '#10b981', 5, 75, 'SAVE', () => {
                log('[SSD]', 'Рендер 4K-відео завершено і збережено на SSD!');
                done();
              });
            });
          }
        }
      ]);
    } else if (kind === 'save') {
      log('[0x9C10]', `ОЗП ➔ SSD: Запис файлу «${meta.filename || 'project.dat'}» на диск.`);
      runSequence([
        {
          badge: 'ЕТАП 1: ПІДГОТОВКА БУФЕРА (CPU ➔ ОЗП)',
          title: 'Формування блоків для запису',
          desc: 'Процесор фіксує останні зміни файлу в оперативній пам\'яті.',
          run: (done) => {
            state.cpuLoad = Math.min(90, state.cpuLoad + 16);
            spawnBurst('cpu-ram', false, '#38bdf8', 3, 80, 'BUF', done);
          }
        },
        {
          badge: 'ЕТАП 2: ЗАПИС НА SSD (ОЗП ➔ ЧИПСЕТ ➔ SSD)',
          title: 'Збереження у флеш-пам\'ять NAND',
          desc: 'Дані записуються на постійний накопичувач SSD і тепер не зникнуть після вимкнення ПК.',
          run: (done) => {
            state.ssdBusy = 60;
            spawnBurst('chipset-ram', true, '#10b981', 5, 80, 'WRT', () => {
              spawnBurst('ssd-chipset', true, '#10b981', 5, 80, 'NAND', () => {
                log('[SSD]', `Файл «${meta.filename || 'project.dat'}» успішно збережено!`);
                done();
              });
            });
          }
        }
      ]);
    }
  }

  let tickCount = 0;
  function stepPhysics() {
    if (!state.powered) return;
    tickCount++;

    const hasGame = state.processes.some(p => p.type === 'game');
    const hasPhoto = state.processes.some(p => p.type === 'photo');
    const extraProcs = Math.max(0, state.processes.length - 1);

    const targetCpu = Math.min(99, 4 + extraProcs * 13 + (state.isOverflow ? 42 : 0));
    const targetGpu = Math.min(98, 2 + (hasGame ? 58 : 0) + (hasPhoto ? 12 : 0) + extraProcs * 4);

    state.cpuLoad += (targetCpu - state.cpuLoad) * 0.03;
    state.gpuLoad += (targetGpu - state.gpuLoad) * 0.03;
    if (state.ssdBusy > 0) state.ssdBusy--;

    // Per-core jitter
    for (let i = 0; i < 8; i++) {
      const targetCore = Math.max(2, Math.min(100, state.cpuLoad + Math.sin(tickCount * 0.07 + i * 1.3) * 14));
      state.cpuCores[i] += (targetCore - state.cpuCores[i]) * 0.1;
    }

    // Temperature & Thermal Throttling based on installed cooler
    const coolerFactor = state.config.coolerType === 'aio' ? 0.52 : state.config.coolerType === 'tower' ? 0.72 : 1.18;
    const targetTemp = 34 + (state.cpuLoad / 100) * 56 * coolerFactor;
    state.cpuTemp += (targetTemp - state.cpuTemp) * 0.025;
    state.fanRpm = 850 + Math.max(0, state.cpuTemp - 35) * 52;
    window.PCSim.Audio.updateFanRpm(state.fanRpm);

    if (state.cpuTemp > 88) {
      // Thermal throttling reduces clock!
      state.cpuClockGhz = Math.max(2.2, 4.8 - (state.cpuTemp - 88) * 0.25);
    } else {
      state.cpuClockGhz = 3.6 + (state.cpuLoad / 100) * 1.2;
    }

    // FPS calculation (dramatic drop on RAM overflow!)
    const targetFps = state.isOverflow
      ? 7 + Math.sin(tickCount * 0.25) * 3
      : Math.max(30, 60 - Math.max(0, state.gpuLoad - 85) * 0.6);
    state.fps += (targetFps - state.fps) * 0.12;

    if (state.cpuLoad < 12) {
      state.cuState = 'IDLE';
      state.aluOps = '0.3 GOPS';
    }

    // Idle OS heartbeat
    if (tickCount % 85 === 0 && !state.stepPaused) {
      spawnPacket({ bus: 'cpu-ram', reverse: true, color: '#38bdf8', label: 'OS', speed: 0.013 });
    }

    // Continuous 3D Game GPU traffic if game is open
    if (hasGame && tickCount % 26 === 0 && !state.stepPaused) {
      spawnPacket({ bus: 'cpu-gpu', reverse: false, color: '#fbbf24', label: 'FRM', speed: 0.022 });
    }

    // RAM Overflow -> Swap Thrashing
    if (state.isOverflow) {
      if (tickCount % 38 === 0) {
        window.PCSim.Audio.play('warn');
        spawnPacket({ bus: 'chipset-ram', reverse: true, color: '#ef4444', label: 'SWAP', speed: 0.008 });
        spawnPacket({ bus: 'ssd-chipset', reverse: true, color: '#f59e0b', label: 'PAGE', speed: 0.008 });
      }
      if (tickCount % 140 === 0) {
        log('[SWAP]', 'Переповнення ОЗП! Перекачування сторінок на SSD...', 'err');
      }
    }

    state.busThroughput = 0.3 + state.packets.length * 0.7 + (state.isOverflow ? 2.1 : 0);
  }

  return {
    state,
    INSPECTOR_DATA,
    setConfig,
    log,
    addProcess,
    removeProcess,
    clearAllProcesses,
    recalcRam,
    spawnPacket,
    spawnBurst,
    triggerWorkload,
    nextStep,
    finishStepsAuto,
    stepPhysics
  };
})();
