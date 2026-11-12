// Interactive CPU Microarchitecture (Fetch-Decode-Execute Microscope)
window.PCSim = window.PCSim || {};

window.PCSim.CpuMicro = (() => {
  const PROGRAMS = {
    add: [
      { addr: '0x00', op: 'LOAD R0, 5', desc: 'Завантажити число 5 у регістр R0 (Акумулятор).' },
      { addr: '0x01', op: 'LOAD R1, 7', desc: 'Завантажити число 7 у регістр R1.' },
      { addr: '0x02', op: 'ADD R0, R1', desc: 'АЛУ додає значення R0 (5) та R1 (7) і зберігає 12 у R0.' },
      { addr: '0x03', op: 'STORE R0, [0x10]', desc: 'Записати результат 12 назад у пам\'ять ОЗП за адресою 0x10.' },
      { addr: '0x04', op: 'HALT', desc: 'Програма завершена! Результат обчислення: 12.' }
    ],
    loop: [
      { addr: '0x00', op: 'LOAD R0, 0', desc: 'Ініціалізація лічильника R0 = 0.' },
      { addr: '0x01', op: 'ADD R0, 1', desc: 'Збільшити лічильник R0 на 1 в АЛУ.' },
      { addr: '0x02', op: 'ADD R0, 1', desc: 'Повторне збільшення R0 на 1.' },
      { addr: '0x03', op: 'ADD R0, 1', desc: 'Третя ітерація циклу: R0 = 3.' },
      { addr: '0x04', op: 'HALT', desc: 'Цикл 1..3 успішно виконано!' }
    ],
    render: [
      { addr: '0x00', op: 'LOAD R0, 128', desc: 'Завантажити яскравість пікселя (128).' },
      { addr: '0x01', op: 'LOAD R1, 2', desc: 'Завантажити коефіцієнт контрасту (2).' },
      { addr: '0x02', op: 'MUL R0, R1', desc: 'АЛУ множить 128 × 2 = 256 (макс. яскравість).' },
      { addr: '0x03', op: 'OUT GPU, R0', desc: 'Відправити готовий колір пікселя на відеокарту GPU.' },
      { addr: '0x04', op: 'HALT', desc: 'Піксель відмальовано на екрані!' }
    ]
  };

  let currentProgKey = 'add';
  let pc = 0;
  let phase = 0; // 0: FETCH, 1: DECODE, 2: EXECUTE
  let regs = { r0: 0, r1: 0, r2: 0, flags: 'Z=0' };
  let autoTimer = null;

  const elPC = document.getElementById('regPC');
  const elIR = document.getElementById('regIR');
  const elPhase = document.getElementById('regPhase');
  const elR0 = document.getElementById('regR0');
  const elR1 = document.getElementById('regR1');
  const elR2 = document.getElementById('regR2');
  const elFlags = document.getElementById('regFlags');
  const elAluA = document.getElementById('aluInA');
  const elAluOp = document.getElementById('aluOp');
  const elAluB = document.getElementById('aluInB');
  const elAluOut = document.getElementById('aluOut');
  const elExplain = document.getElementById('cpuStepExplain');
  const elRamTable = document.getElementById('microRamTable');

  const mbCu = document.getElementById('mb-cu');
  const mbAlu = document.getElementById('mb-alu');
  const mbRam = document.getElementById('mb-ram');

  function renderRam() {
    const prog = PROGRAMS[currentProgKey];
    elRamTable.innerHTML = prog.map((line, i) => `
      <div class="ram-row ${i === pc ? 'active-pc' : ''}">
        <span style="color:#7dd3fc;">${line.addr}</span>
        <span>${line.op}</span>
      </div>
    `).join('');
  }

  function clearHighlights() {
    mbCu.classList.remove('highlight');
    mbAlu.classList.remove('highlight');
    mbRam.classList.remove('highlight');
  }

  function reset() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    pc = 0;
    phase = 0;
    regs = { r0: 0, r1: 0, r2: 0, flags: 'Z=0' };
    elPC.textContent = '0x00';
    elIR.textContent = 'NOP';
    elPhase.textContent = 'ОЧІКУВАННЯ';
    elR0.textContent = '0';
    elR1.textContent = '0';
    elR2.textContent = '0';
    elFlags.textContent = 'Z=0';
    elAluA.textContent = 'A: 0';
    elAluOp.textContent = '+';
    elAluB.textContent = 'B: 0';
    elAluOut.textContent = 'Результат: 0';
    elExplain.innerHTML = 'Натисни <strong>«Наступний такт ➔»</strong>, щоб почати цикл Fetch ➔ Decode ➔ Execute.';
    clearHighlights();
    renderRam();
  }

  function step() {
    const prog = PROGRAMS[currentProgKey];
    if (pc >= prog.length) {
      reset();
      return;
    }
    const instr = prog[pc];
    clearHighlights();
    window.PCSim.Audio.play('tick');

    if (phase === 0) {
      // FETCH
      mbRam.classList.add('highlight');
      mbCu.classList.add('highlight');
      elPC.textContent = instr.addr;
      elIR.textContent = instr.op;
      elPhase.textContent = '1. FETCH (Зчитування)';
      elExplain.innerHTML = `<strong>Фаза FETCH:</strong> Пристрій керування зчитує команду <code>${instr.op}</code> з ОЗП за адресою <code>${instr.addr}</code> у регістр інструкцій (IR).`;
      phase = 1;
    } else if (phase === 1) {
      // DECODE
      mbCu.classList.add('highlight');
      elPhase.textContent = '2. DECODE (Розшифрування)';
      elExplain.innerHTML = `<strong>Фаза DECODE:</strong> Пристрій керування розшифровує команду <code>${instr.op}</code> та готує АЛУ й регістри до виконання.`;
      phase = 2;
    } else {
      // EXECUTE
      mbAlu.classList.add('highlight');
      elPhase.textContent = '3. EXECUTE (Виконання)';
      if (instr.op.startsWith('LOAD R0,')) {
        regs.r0 = parseInt(instr.op.split(',')[1], 10);
      } else if (instr.op.startsWith('LOAD R1,')) {
        regs.r1 = parseInt(instr.op.split(',')[1], 10);
      } else if (instr.op === 'ADD R0, R1') {
        elAluA.textContent = `A: ${regs.r0}`;
        elAluOp.textContent = '+';
        elAluB.textContent = `B: ${regs.r1}`;
        regs.r0 = regs.r0 + regs.r1;
        elAluOut.textContent = `Результат: ${regs.r0}`;
      } else if (instr.op === 'ADD R0, 1') {
        elAluA.textContent = `A: ${regs.r0}`;
        elAluOp.textContent = '+';
        elAluB.textContent = 'B: 1';
        regs.r0 += 1;
        elAluOut.textContent = `Результат: ${regs.r0}`;
      } else if (instr.op === 'MUL R0, R1') {
        elAluA.textContent = `A: ${regs.r0}`;
        elAluOp.textContent = '×';
        elAluB.textContent = `B: ${regs.r1}`;
        regs.r0 = regs.r0 * regs.r1;
        elAluOut.textContent = `Результат: ${regs.r0}`;
      } else if (instr.op === 'HALT') {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      }

      elR0.textContent = regs.r0;
      elR1.textContent = regs.r1;
      elExplain.innerHTML = `<strong>Фаза EXECUTE:</strong> ${instr.desc}`;
      phase = 0;
      if (instr.op !== 'HALT') pc++;
    }
    renderRam();
  }

  function init() {
    document.getElementById('cpuProgramSelect').addEventListener('change', (e) => {
      currentProgKey = e.target.value;
      reset();
    });
    document.getElementById('btnCpuStep').addEventListener('click', step);
    document.getElementById('btnCpuReset').addEventListener('click', reset);
    document.getElementById('btnCpuRun').addEventListener('click', () => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      } else {
        autoTimer = setInterval(step, 850);
      }
    });
    reset();
  }

  return { init };
})();
