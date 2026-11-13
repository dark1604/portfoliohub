// === STATE & GAMIFICATION ===
const state = {
  xp: 0,
  soundEnabled: true,
  projectorMode: false,
  warmupSolved: new Set(),
  nameCheckSolved: new Set(),
  questsDone: new Set(),
  comboFound: new Set(),
  stemBuilds: 0,
  quizAwarded: false
};

const FORBIDDEN_CHARS = ['\\', '*', '/', ':', '?', '"', '<', '>', '|'];

// === SOUND EFFECTS (Web Audio API) ===
let audioCtx = null;
function playTone(freq, duration = 0.12, type = 'sine', vol = 0.08) {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {
    // Ignore audio context restrictions
  }
}

function playSuccess() {
  playTone(523.25, 0.1, 'triangle');
  setTimeout(() => playTone(659.25, 0.14, 'triangle'), 80);
}

function playError() {
  playTone(220, 0.18, 'sawtooth', 0.05);
}

function addXP(amount) {
  state.xp += amount;
  const el = document.getElementById('xp-value');
  el.textContent = state.xp;
  const pill = el.closest('.xp-pill');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
}

// === CONFETTI ===
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 140,
    w: 7 + Math.random() * 7,
    h: 5 + Math.random() * 6,
    vy: 2.8 + Math.random() * 4,
    vx: (Math.random() - 0.5) * 3,
    rot: Math.random() * Math.PI,
    vrot: (Math.random() - 0.5) * 0.2,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 130) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  tick();
}

// === NAVIGATION ===
function goToSection(sectionId) {
  document.querySelectorAll('.module-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === sectionId);
  });
  document.querySelectorAll('.nav-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === sectionId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-pill').forEach(btn => {
  btn.addEventListener('click', () => goToSection(btn.dataset.target));
});

document.getElementById('sound-toggle').addEventListener('click', (e) => {
  state.soundEnabled = !state.soundEnabled;
  e.currentTarget.textContent = state.soundEnabled ? '🔊' : '🔇';
  e.currentTarget.setAttribute('aria-pressed', String(state.soundEnabled));
});

document.getElementById('projector-toggle').addEventListener('click', (e) => {
  state.projectorMode = !state.projectorMode;
  document.body.classList.toggle('projector-mode', state.projectorMode);
  e.currentTarget.setAttribute('aria-pressed', String(state.projectorMode));
});

// === SECTION 0: WARMUP ===
const warmupData = [
  { id: 'w1', emoji: '🖼️', name: 'монітор.jpg', type: 'file' },
  { id: 'w2', emoji: '📁', name: 'Мої уроки', type: 'folder' },
  { id: 'w3', emoji: '📊', name: 'комп’ютер.pptx', type: 'file' },
  { id: 'w4', emoji: '📂', name: 'Фото', type: 'folder' }
];

document.getElementById('btn-warmup-toggle').addEventListener('click', () => {
  document.getElementById('warmup-box').classList.toggle('hidden');
});

function renderWarmup() {
  const grid = document.getElementById('warmup-grid');
  grid.innerHTML = warmupData.map(item => `
    <div class="warmup-item" id="wu-${item.id}">
      <div class="warmup-emoji">${item.emoji}</div>
      <div class="warmup-name">${item.name}</div>
      <div class="warmup-btns">
        <button class="mini-choice" onclick="checkWarmup('${item.id}', 'file')">Файл</button>
        <button class="mini-choice" onclick="checkWarmup('${item.id}', 'folder')">Папка</button>
      </div>
    </div>
  `).join('');
}

function checkWarmup(id, choice) {
  const item = warmupData.find(x => x.id === id);
  const card = document.getElementById(`wu-${id}`);
  if (item.type === choice) {
    card.classList.remove('wrong');
    card.classList.add('correct');
    playSuccess();
    if (!state.warmupSolved.has(id)) {
      state.warmupSolved.add(id);
      if (state.warmupSolved.size === warmupData.length) {
        addXP(20);
        const fb = document.getElementById('warmup-feedback');
        fb.classList.remove('hidden');
        fb.classList.add('success');
        fb.innerHTML = '🎉 Супер! Розминку пройдено (+20 XP)! <button class="btn btn-sm btn-primary" onclick="goToSection(\'mission-1\')">До Місії 1 →</button>';
      }
    }
  } else {
    card.classList.remove('correct');
    card.classList.add('wrong');
    playError();
  }
}

// === MISSION 1: LIVE FILENAME SCANNER (p. 43) ===
const extMeta = {
  pptx: { icon: '📊', label: 'Презентація' },
  ppt:  { icon: '📊', label: 'Презентація' },
  docx: { icon: '📝', label: 'Текстовий документ' },
  doc:  { icon: '📝', label: 'Текстовий документ' },
  txt:  { icon: '📄', label: 'Текстовий файл' },
  jpg:  { icon: '🖼️', label: 'Зображення' },
  jpeg: { icon: '🖼️', label: 'Зображення' },
  png:  { icon: '🖼️', label: 'Зображення' },
  mp3:  { icon: '🎵', label: 'Аудіофайл' },
  mp4:  { icon: '🎬', label: 'Відеофайл' }
};

function renderForbiddenKeys() {
  const container = document.getElementById('forbidden-keys');
  container.innerHTML = '';
  FORBIDDEN_CHARS.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'fkey';
    btn.textContent = ch;
    btn.title = `Додати символ ${ch} для тесту`;
    btn.addEventListener('click', () => {
      const inp = document.getElementById('filename-input');
      inp.value += ch;
      updateScanner();
      inp.focus();
    });
    container.appendChild(btn);
  });
}

function setScannerInput(val) {
  const inp = document.getElementById('filename-input');
  inp.value = val;
  updateScanner();
}

function updateScanner() {
  const raw = document.getElementById('filename-input').value;
  const inp = document.getElementById('filename-input');
  const statusPill = document.getElementById('scanner-status-pill');
  const alertBox = document.getElementById('forbidden-alert');
  const foundSpan = document.getElementById('forbidden-found');

  const foundBad = FORBIDDEN_CHARS.filter(ch => raw.includes(ch));
  const isEmpty = raw.trim().length === 0;

  if (foundBad.length > 0 || isEmpty) {
    inp.classList.add('invalid');
    statusPill.className = 'status-pill invalid';
    statusPill.textContent = isEmpty ? '⚠️ Ім’я порожнє' : '⛔ Заборонені символи!';
    if (foundBad.length > 0) {
      alertBox.classList.remove('hidden');
      foundSpan.textContent = foundBad.map(c => `[ ${c} ]`).join('  ');
    } else {
      alertBox.classList.add('hidden');
    }
  } else {
    inp.classList.remove('invalid');
    statusPill.className = 'status-pill valid';
    statusPill.textContent = '✅ Ім’я коректне';
    alertBox.classList.add('hidden');
  }

  const lastDot = raw.lastIndexOf('.');
  let base = raw;
  let ext = '';
  if (lastDot > 0 && lastDot < raw.length - 1) {
    base = raw.slice(0, lastDot);
    ext = raw.slice(lastDot + 1).toLowerCase();
  }

  document.getElementById('part-basename').textContent = base || '—';
  document.getElementById('part-extension').textContent = ext || 'немає';

  const meta = extMeta[ext] || { icon: ext ? '📦' : '📁', label: ext ? 'Файл' : 'Без розширення / Папка' };
  document.getElementById('scanner-icon').textContent = meta.icon;
  document.getElementById('scanner-type-label').textContent = meta.label;
}

document.getElementById('filename-input').addEventListener('input', updateScanner);

// === MISSION 1B: TEXTBOOK p. 43 NAME CHECKER ===
const textbookNames = [
  { id: 'n1', text: 'Мій край.pptx', valid: true, why: 'Літери, пробіл та крапка перед розширенням — усе дозволено!' },
  { id: 'n2', text: 'Інформатика', valid: true, why: 'Можна (наприклад, для папки або файлу без розширення).' },
  { id: 'n3', text: 'Комп’ютер_1', valid: true, why: 'Підкреслення та цифри повністю дозволені.' },
  { id: 'n4', text: 'Приклади?задачі.docx', valid: false, why: 'Заборонено! Знак питання (?) не можна використовувати в іменах.' },
  { id: 'n5', text: '**Світлини**.jpg', valid: false, why: 'Заборонено! Зірочка (*) входить до 9 заборонених символів.' },
  { id: 'n6', text: '<Dogs-cats>', valid: false, why: 'Заборонено! Символи < та > використовувати не можна.' }
];

function renderNameChecker() {
  const grid = document.getElementById('name-check-grid');
  grid.innerHTML = textbookNames.map(item => `
    <div class="name-card" id="nc-${item.id}">
      <div class="name-sample">${escapeHtml(item.text)}</div>
      <div class="name-actions">
        <button onclick="checkTextbookName('${item.id}', true)">✅ Можна</button>
        <button onclick="checkTextbookName('${item.id}', false)">⛔ Заборонено</button>
      </div>
      <div class="name-explain hidden" id="nce-${item.id}"></div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function checkTextbookName(id, userSaysValid) {
  const item = textbookNames.find(n => n.id === id);
  const card = document.getElementById(`nc-${id}`);
  const exp = document.getElementById(`nce-${id}`);
  exp.classList.remove('hidden');

  if (item.valid === userSaysValid) {
    card.classList.remove('solved-err');
    card.classList.add('solved-ok');
    exp.textContent = '✅ Вірно! ' + item.why;
    playSuccess();
    if (!state.nameCheckSolved.has(id)) {
      state.nameCheckSolved.add(id);
      addXP(10);
      if (state.nameCheckSolved.size === textbookNames.length) {
        document.getElementById('m1-done').textContent = '2';
        document.getElementById('m1-complete-banner').classList.remove('hidden');
      } else {
        document.getElementById('m1-done').textContent = '1';
      }
    }
  } else {
    card.classList.remove('solved-ok');
    card.classList.add('solved-err');
    exp.textContent = '❌ Спробуй ще раз! Перевір 9 заборонених символів.';
    playError();
  }
}

// === MISSION 2: FILE SYSTEM TREE & EXPLORER (pp. 44-45) ===
const fileSystem = {
  id: 'disk-d',
  name: 'D:',
  label: 'Локальний диск (D:)',
  type: 'disk',
  icon: '💾',
  children: [
    {
      id: 'lessons',
      name: 'Мої уроки',
      type: 'folder',
      icon: '📁',
      children: [
        {
          id: 'math',
          name: 'Математика',
          type: 'folder',
          icon: '📁',
          children: [
            { id: 'tasks-docx', name: 'задачі.docx', type: 'file', icon: '📝' }
          ]
        },
        {
          id: 'cs',
          name: 'Інформатика',
          type: 'folder',
          icon: '📁',
          children: [
            { id: 'comp-pptx', name: 'комп’ютер.pptx', type: 'file', icon: '📊' },
            { id: 'mon-jpg', name: 'монітор.jpg', type: 'file', icon: '🖼️' }
          ]
        }
      ]
    }
  ]
};

let currentFolderId = 'disk-d';
let selectedItemId = null;
let navHistory = ['disk-d'];
let activeQuestIndex = 0;

const explorerQuests = [
  {
    id: 'q1',
    text: 'Відкрий папку <code>Інформатика</code> та натисни на файл <code>монітор.jpg</code>',
    check: (folderId, selId) => selId === 'mon-jpg'
  },
  {
    id: 'q2',
    text: 'Натисни кнопку <strong>← Назад</strong>, відкрий <code>Математика</code> і вибери <code>задачі.docx</code>',
    check: (folderId, selId) => selId === 'tasks-docx'
  },
  {
    id: 'q3',
    text: 'Повернись у <code>Інформатика</code> та вибери презентацію <code>комп’ютер.pptx</code>',
    check: (folderId, selId) => selId === 'comp-pptx'
  }
];

function findNodeAndPath(targetId, node = fileSystem, path = []) {
  const nextPath = [...path, node];
  if (node.id === targetId) return { node, path: nextPath };
  if (node.children) {
    for (const child of node.children) {
      const res = findNodeAndPath(targetId, child, nextPath);
      if (res) return res;
    }
  }
  return null;
}

function renderVisualTree() {
  const container = document.getElementById('visual-tree');
  function buildHtml(node) {
    const isActive = node.id === currentFolderId || node.id === selectedItemId;
    let html = `<div class="tree-node-row">
      <button class="tree-btn ${isActive ? 'active-node' : ''}" onclick="treeClick('${node.id}')">
        <span>${node.icon}</span>
        <span>${node.name}</span>
      </button>`;
    if (node.children && node.children.length) {
      html += `<div class="tree-children">${node.children.map(buildHtml).join('')}</div>`;
    }
    html += `</div>`;
    return html;
  }
  container.innerHTML = buildHtml(fileSystem);
}

function treeClick(nodeId) {
  const found = findNodeAndPath(nodeId);
  if (!found) return;
  if (found.node.type === 'file') {
    const parent = found.path[found.path.length - 2];
    navigateToFolder(parent.id, nodeId);
  } else {
    navigateToFolder(nodeId, null);
  }
}

function navigateToFolder(folderId, selectId = null, pushHistory = true) {
  if (pushHistory && folderId !== currentFolderId) {
    navHistory.push(folderId);
  }
  currentFolderId = folderId;
  selectedItemId = selectId;
  renderExplorer();
  renderVisualTree();
  updatePathFormula();
  checkExplorerQuest();
}

function renderExplorer() {
  const found = findNodeAndPath(currentFolderId);
  const folder = found.node;
  const addressStr = found.path.map(p => p.name).join('\\') + (found.path.length === 1 ? '\\' : '');
  document.getElementById('explorer-address').textContent = addressStr;

  const backBtn = document.getElementById('explorer-back-btn');
  backBtn.disabled = navHistory.length <= 1;

  const itemsDiv = document.getElementById('explorer-items');
  const children = folder.children || [];
  itemsDiv.innerHTML = children.map(ch => `
    <div class="exp-item ${ch.id === selectedItemId ? 'selected' : ''}" onclick="explorerItemClick('${ch.id}')">
      <div class="exp-icon">${ch.icon}</div>
      <div class="exp-name">${ch.name}</div>
      <div class="exp-hint">${ch.type === 'folder' ? 'Папка (відкрити)' : 'Файл (вибрати)'}</div>
    </div>
  `).join('');

  document.getElementById('explorer-status-count').textContent = `Елементів: ${children.length}`;
  const selObj = selectedItemId ? findNodeAndPath(selectedItemId).node : null;
  document.getElementById('explorer-selected-info').textContent = selObj ? `Вибрано: ${selObj.name}` : 'Натисни на папку або файл';
}

function explorerItemClick(itemId) {
  const found = findNodeAndPath(itemId);
  if (!found) return;
  playTone(440, 0.06, 'sine', 0.04);
  if (found.node.type === 'folder' || found.node.type === 'disk') {
    navigateToFolder(itemId, null, true);
  } else {
    selectedItemId = itemId;
    renderExplorer();
    renderVisualTree();
    updatePathFormula();
    checkExplorerQuest();
  }
}

document.getElementById('explorer-back-btn').addEventListener('click', () => {
  if (navHistory.length > 1) {
    navHistory.pop();
    const prevId = navHistory[navHistory.length - 1];
    navigateToFolder(prevId, null, false);
    playTone(360, 0.07, 'sine', 0.04);
  }
});

function updatePathFormula() {
  const targetId = selectedItemId || currentFolderId;
  const found = findNodeAndPath(targetId);
  const tokensEl = document.getElementById('formula-tokens');
  tokensEl.innerHTML = found.path.map((node, idx) => {
    let cls = 'token-folder';
    if (node.type === 'disk') cls = 'token-disk';
    if (node.type === 'file') cls = 'token-file';
    const sep = idx < found.path.length - 1 ? '<span class="token-sep">\\</span>' : '';
    return `<span class="token ${cls}">${node.name}</span>${sep}`;
  }).join('');
}

function renderQuestDots() {
  const dots = document.getElementById('quest-dots');
  dots.innerHTML = explorerQuests.map((q, i) => `
    <div class="q-dot ${state.questsDone.has(q.id) ? 'done' : ''}">${state.questsDone.has(q.id) ? '✓' : i + 1}</div>
  `).join('');
}

function checkExplorerQuest() {
  const currentQ = explorerQuests[activeQuestIndex];
  if (!currentQ) return;
  if (currentQ.check(currentFolderId, selectedItemId)) {
    if (!state.questsDone.has(currentQ.id)) {
      state.questsDone.add(currentQ.id);
      addXP(20);
      playSuccess();
    }
    if (activeQuestIndex < explorerQuests.length - 1) {
      activeQuestIndex++;
      document.getElementById('current-quest-text').innerHTML = explorerQuests[activeQuestIndex].text;
    } else {
      document.getElementById('current-quest-text').innerHTML = '🎉 Усі практичні квести Провідника виконано!';
    }
    document.getElementById('m2-done').textContent = state.questsDone.size;
    renderQuestDots();
  }
}

// === MISSION 2B: PHOTO SORTER (p. 44) ===
const photosData = [
  { id: 'p1', emoji: '🎒', label: 'Перший дзвоник', event: 'sep1', topic: 'portraits' },
  { id: 'p2', emoji: '🌲', label: 'Похід у ліс', event: 'forest', topic: 'landscapes' },
  { id: 'p3', emoji: '🎂', label: 'Торт бабусі', event: 'bday', topic: 'portraits' },
  { id: 'p4', emoji: '🐶', label: 'Мій песик', event: 'forest', topic: 'pets' },
  { id: 'p5', emoji: '🌷', label: 'Тюльпани', event: 'bday', topic: 'flowers' },
  { id: 'p6', emoji: '🌻', label: 'Соняшники', event: 'sep1', topic: 'flowers' }
];

const sortModes = {
  events: [
    { key: 'sep1', title: '📁 Свято 1 Вересня' },
    { key: 'forest', title: '📁 Відпочинок у лісі' },
    { key: 'bday', title: '📁 День народження бабусі' }
  ],
  topics: [
    { key: 'landscapes', title: '📁 Пейзажі' },
    { key: 'portraits', title: '📁 Портрети' },
    { key: 'pets', title: '📁 Домашні тварини' },
    { key: 'flowers', title: '📁 Квіти' }
  ]
};

let currentSortMode = 'events';
let selectedPhotoId = null;
let sortedMap = {};

document.querySelectorAll('.switch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.switch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSortMode = btn.dataset.sortMode;
    selectedPhotoId = null;
    sortedMap = {};
    document.getElementById('sorter-feedback').classList.add('hidden');
    renderPhotoSorter();
  });
});

function renderPhotoSorter() {
  const tray = document.getElementById('photo-tray');
  const unsorted = photosData.filter(p => !sortedMap[p.id]);
  tray.innerHTML = unsorted.length
    ? unsorted.map(p => `
        <div class="photo-card ${selectedPhotoId === p.id ? 'selected' : ''}" onclick="selectPhoto('${p.id}')">
          <div class="photo-emoji">${p.emoji}</div>
          <div class="photo-label">${p.label}</div>
        </div>
      `).join('')
    : '<p style="font-weight:800;color:#059669;margin:8px 0;">✅ Усі фото розкладено по вкладених папках!</p>';

  const targets = document.getElementById('folder-targets');
  const folders = sortModes[currentSortMode];
  targets.innerHTML = folders.map(f => {
    const inside = photosData.filter(p => sortedMap[p.id] === f.key);
    return `
      <div class="target-folder" onclick="dropIntoFolder('${f.key}')">
        <div class="target-folder-head">${f.title}</div>
        <div class="target-pills">
          ${inside.map(p => `<span class="sorted-pill">${p.emoji} ${p.label}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function selectPhoto(pid) {
  selectedPhotoId = pid;
  renderPhotoSorter();
}

function dropIntoFolder(folderKey) {
  if (!selectedPhotoId) return;
  const photo = photosData.find(p => p.id === selectedPhotoId);
  const expected = currentSortMode === 'events' ? photo.event : photo.topic;
  if (expected === folderKey) {
    sortedMap[photo.id] = folderKey;
    selectedPhotoId = null;
    playSuccess();
    renderPhotoSorter();
    if (Object.keys(sortedMap).length === photosData.length) {
      const fb = document.getElementById('sorter-feedback');
      fb.classList.remove('hidden');
      fb.classList.add('success');
      fb.textContent = '🎉 Чудово! Ти побачив, що ту саму папку «Фото» можна організувати різними способами!';
    }
  } else {
    playError();
  }
}

// === MISSION 3A: COMBINATORICS (p. 46) ===
let pickName = null;
let pickExt = null;

document.querySelectorAll('[data-pick-name]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-pick-name]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pickName = btn.dataset.pickName;
    updateComboBtn();
  });
});

document.querySelectorAll('[data-pick-ext]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-pick-ext]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pickExt = btn.dataset.pickExt;
    updateComboBtn();
  });
});

function updateComboBtn() {
  document.getElementById('create-combo-btn').disabled = !(pickName && pickExt);
}

function renderComboSlots() {
  const slots = document.getElementById('combo-slots');
  const foundArr = Array.from(state.comboFound);
  slots.innerHTML = Array.from({ length: 6 }, (_, i) => {
    const val = foundArr[i];
    if (val) {
      return `<div class="combo-slot filled">📄 ${val}</div>`;
    }
    return `<div class="combo-slot">Слот #${i + 1}</div>`;
  }).join('');
  document.getElementById('combo-count').textContent = foundArr.length;
}

document.getElementById('create-combo-btn').addEventListener('click', () => {
  if (!pickName || !pickExt) return;
  const full = `${pickName}.${pickExt}`;
  if (state.comboFound.has(full)) {
    playError();
    return;
  }
  state.comboFound.add(full);
  playSuccess();
  renderComboSlots();
  if (state.comboFound.size === 6) {
    addXP(40);
    document.getElementById('combo-feedback').classList.remove('hidden');
    updateM3Progress();
  }
});

// === MISSION 3B: STEM CLASSIFICATION TREE (p. 46) ===
const stemShapes = [
  { shape: 'circle', color: 'red', size: 'big' },
  { shape: 'circle', color: 'red', size: 'small' },
  { shape: 'circle', color: 'green', size: 'big' },
  { shape: 'circle', color: 'green', size: 'small' },
  { shape: 'square', color: 'red', size: 'big' },
  { shape: 'square', color: 'red', size: 'small' },
  { shape: 'square', color: 'green', size: 'big' },
  { shape: 'square', color: 'green', size: 'small' }
];

const propLabels = {
  shape: { circle: 'Круг', square: 'Квадрат' },
  color: { red: 'Червоний', green: 'Зелений' },
  size: { big: 'Великий', small: 'Малий' }
};

function renderShapeTokens(list) {
  return `<div class="shape-row">${list.map(s => `<span class="shape-token ${s.shape} ${s.color} ${s.size}" title="${s.size} ${s.color} ${s.shape}"></span>`).join('')}</div>`;
}

function buildStemTree() {
  const p1 = document.getElementById('prop-1').value;
  const p2 = document.getElementById('prop-2').value;
  const p3 = document.getElementById('prop-3').value;
  const errEl = document.getElementById('stem-error');

  if (new Set([p1, p2, p3]).size < 3) {
    errEl.classList.remove('hidden');
    playError();
    return;
  }
  errEl.classList.add('hidden');

  const splitBy = (items, prop) => {
    const keys = Object.keys(propLabels[prop]);
    return keys.map(k => ({
      label: propLabels[prop][k],
      items: items.filter(it => it[prop] === k)
    }));
  };

  const level1 = splitBy(stemShapes, p1);
  const level2 = level1.flatMap(g => splitBy(g.items, p2));
  const level3 = level2.flatMap(g => splitBy(g.items, p3));

  const vp = document.getElementById('stem-tree-viewport');
  vp.innerHTML = `
    <div class="stem-level">
      <div class="stem-node root-node">
        <div class="stem-node-label">Усі 8 об'єктів</div>
        ${renderShapeTokens(stemShapes)}
      </div>
    </div>
    <div class="stem-level">
      ${level1.map(n => `<div class="stem-node"><div class="stem-node-label">${n.label}</div>${renderShapeTokens(n.items)}</div>`).join('')}
    </div>
    <div class="stem-level">
      ${level2.map(n => `<div class="stem-node"><div class="stem-node-label">${n.label}</div>${renderShapeTokens(n.items)}</div>`).join('')}
    </div>
    <div class="stem-level">
      ${level3.map(n => `<div class="stem-node"><div class="stem-node-label">${n.label}</div>${renderShapeTokens(n.items)}</div>`).join('')}
    </div>
  `;

  state.stemBuilds++;
  if (state.stemBuilds === 1) {
    addXP(50);
    updateM3Progress();
  }
  if (state.stemBuilds >= 2) {
    document.getElementById('stem-conclusion').classList.remove('hidden');
  }
  playSuccess();
}

document.getElementById('stem-build-btn').addEventListener('click', buildStemTree);

function updateM3Progress() {
  let done = 0;
  if (state.comboFound.size === 6) done++;
  if (state.stemBuilds >= 1) done++;
  document.getElementById('m3-done').textContent = done;
}

// === SECTION 4: FINAL BLITZ QUIZ ===
const quizQuestions = [
  {
    q: 'Яку пару частин має ім’я файлу (наприклад, моя_школа.png)?',
    opts: ['Диск і папка', 'Власне ім’я та розширення, розділені крапкою', 'Тільки розширення'],
    ans: 1
  },
  {
    q: 'Який із цих символів ЗАБОРОНЕНИЙ в імені файлу чи папки?',
    opts: ['_ (підкреслення)', '? (знак питання)', '- (дефіс)'],
    ans: 1
  },
  {
    q: 'Який роздільник використовується у шляху до файлу (наприклад, D:\\Мої уроки\\Інформатика)?',
    opts: ['Зворотний слеш (\\)', 'Зірочка (*)', 'Двокрапка (:)'],
    ans: 0
  },
  {
    q: 'Як називають схему, що показує вкладеність папок і файлів?',
    opts: ['Таблиця файлів', 'Дерево папок (каталогів)', 'Список розширень'],
    ans: 1
  },
  {
    q: 'Скільки різних імен файлів можна скласти з імен cat, dog та розширень docx, pptx, jpg?',
    opts: ['5', '6', '9'],
    ans: 1
  }
];

let quizIdx = 0;
let quizScore = 0;

function renderQuiz() {
  const stage = document.getElementById('quiz-stage');
  const fill = document.getElementById('quiz-progress-fill');

  if (quizIdx >= quizQuestions.length) {
    fill.style.width = '100%';
    if (!state.quizAwarded) {
      state.quizAwarded = true;
      addXP(quizScore * 10);
    }
    launchConfetti();
    playSuccess();
    stage.innerHTML = `
      <div class="quiz-result-box">
        <div class="quiz-trophy">🏆</div>
        <h3>Вітаємо, Майстер Файлової Системи!</h3>
        <p>Правильних відповідей: <strong>${quizScore} з ${quizQuestions.length}</strong> • Загальний рахунок: <strong>${state.xp} XP</strong></p>
        <button class="btn btn-primary" onclick="restartQuiz()">🔄 Пройти бліц ще раз</button>
      </div>
    `;
    return;
  }

  fill.style.width = `${((quizIdx + 1) / quizQuestions.length) * 100}%`;
  const item = quizQuestions[quizIdx];
  stage.innerHTML = `
    <div style="font-size:0.85rem;font-weight:800;color:var(--text-muted);margin-bottom:6px;">
      Питання ${quizIdx + 1} з ${quizQuestions.length}
    </div>
    <div class="quiz-question">${item.q}</div>
    <div class="quiz-options">
      ${item.opts.map((opt, i) => `<button class="quiz-opt" onclick="answerQuiz(${i}, this)">${opt}</button>`).join('')}
    </div>
  `;
}

function answerQuiz(chosenIdx, btn) {
  const item = quizQuestions[quizIdx];
  const allBtns = document.querySelectorAll('.quiz-opt');
  allBtns.forEach(b => (b.disabled = true));

  if (chosenIdx === item.ans) {
    btn.classList.add('correct');
    quizScore++;
    playSuccess();
  } else {
    btn.classList.add('wrong');
    allBtns[item.ans].classList.add('correct');
    playError();
  }

  setTimeout(() => {
    quizIdx++;
    renderQuiz();
  }, 950);
}

function restartQuiz() {
  quizIdx = 0;
  quizScore = 0;
  renderQuiz();
}

// === INIT ===
renderWarmup();
renderForbiddenKeys();
updateScanner();
renderNameChecker();
renderVisualTree();
renderExplorer();
updatePathFormula();
renderQuestDots();
renderPhotoSorter();
renderComboSlots();
buildStemTree();
renderQuiz();

// === THEORY SECTION ===
let currentTheoryStep = 0;
const visitedTheorySteps = new Set([0]);
let theoryXpAwarded = false;

function setTheoryStep(stepIdx) {
  currentTheoryStep = Math.max(0, Math.min(3, stepIdx));
  visitedTheorySteps.add(currentTheoryStep);

  document.querySelectorAll('.theory-tab').forEach(tab => {
    tab.classList.toggle('active', Number(tab.dataset.theoryStep) === currentTheoryStep);
  });
  document.querySelectorAll('.theory-slide').forEach(panel => {
    panel.classList.toggle('active', Number(panel.dataset.theoryPanel) === currentTheoryStep);
  });

  document.getElementById('theory-prev-btn').disabled = currentTheoryStep === 0;
  document.getElementById('theory-next-btn').disabled = currentTheoryStep === 3;
  document.getElementById('theory-done').textContent = visitedTheorySteps.size;

  const dotsEl = document.getElementById('theory-dots');
  dotsEl.innerHTML = [0, 1, 2, 3].map(i => `<span class="t-dot ${i === currentTheoryStep ? 'active' : ''}"></span>`).join('');

  if (visitedTheorySteps.size === 4 && !theoryXpAwarded) {
    theoryXpAwarded = true;
    addXP(20);
    playSuccess();
  } else {
    playTone(500, 0.05, 'sine', 0.03);
  }
}

document.querySelectorAll('.theory-tab').forEach(tab => {
  tab.addEventListener('click', () => setTheoryStep(Number(tab.dataset.theoryStep)));
});

document.getElementById('theory-prev-btn').addEventListener('click', () => {
  setTheoryStep(currentTheoryStep - 1);
});

document.getElementById('theory-next-btn').addEventListener('click', () => {
  setTheoryStep(currentTheoryStep + 1);
});

function showLegendInfo(msg) {
  document.getElementById('legend-info-box').textContent = msg;
  playTone(560, 0.06, 'triangle', 0.04);
}

function showAnatomyHint(msg) {
  document.getElementById('anatomy-hint-box').textContent = msg;
  playTone(560, 0.06, 'triangle', 0.04);
}

setTheoryStep(0);
