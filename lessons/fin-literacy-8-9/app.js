(() => {
  'use strict';

  const AUTHOR =
    (document.body && document.body.dataset && document.body.dataset.author) ||
    'plastun';
  const STORAGE_KEY =
    AUTHOR === 'kuzniecova'
      ? 'fin_lit_kuz_8_9_progress_v1'
      : 'fin_lit_8_9_progress_v1';
  const LETTERS = ['А', 'Б', 'В', 'Г'];
  const RING_RADIUS = 42;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const RANKS = [
    { minXp: 450, level: 5, title: 'Майстер-підприємець' },
    { minXp: 300, level: 4, title: 'Фінансовий стратег' },
    { minXp: 160, level: 3, title: 'Знавець фінансів' },
    { minXp: 60, level: 2, title: 'Скарбничий' },
    { minXp: 0, level: 1, title: 'Новачок' }
  ];

  const state = {
    grade: 8,
    sectionId: null,
    view: 'welcome', // 'welcome' | 'map' | 'paragraph' | 'practical' | 'final'
    activeItemId: null,
    searchQuery: '',
    onlyUnlearned: false,
    collapsedTopics: {},
    progress: loadProgress()
  };

  // DOM Elements from index.html
  const bodyEl = document.body;
  const appMain = document.getElementById('app-main');
  const topbarBrand = document.querySelector('.topbar-brand');
  const navigatorTree = document.getElementById('navigator-tree');
  const navGradeLabel = document.getElementById('nav-grade-label');
  const courseNavigator = document.getElementById('course-navigator');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  const gradeButtons = document.querySelectorAll('.grade-btn[data-grade-btn]');
  const modeTabs = document.querySelectorAll('.mode-tab[data-mode]');
  const progressParagraphsEl = document.getElementById('progress-paragraphs');
  const progressXpEl = document.getElementById('progress-xp');
  const progressBarFillEl = document.getElementById('progress-bar-fill');
  const resetProgressBtn = document.getElementById('reset-progress-btn');

  // WOW-effect DOM elements
  const readingProgressBar = document.getElementById('reading-progress-bar');
  const studentRankEl = document.getElementById('student-rank');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const xpToastContainer = document.getElementById('xp-toast-container');

  if (appMain) {
    appMain.style.viewTransitionName = 'main-canvas';
  }

  // ---------------------------------------------------------------------------
  // Web Audio API Tactile Sound Engine
  // ---------------------------------------------------------------------------

  let audioCtx = null;

  function getAudioContext() {
    if (!state.progress.soundEnabled) return null;
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    } catch {
      return null;
    }
  }

  function playTone(freqStart, freqEnd, durationSec, type = 'sine', gainPeak = 0.04, delaySec = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + durationSec);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore audio errors
    }
  }

  function playClick() {
    playTone(540, 320, 0.05, 'triangle', 0.035);
  }

  function playCoin() {
    playTone(880, 880, 0.08, 'sine', 0.045, 0);
    playTone(1318.5, 1318.5, 0.14, 'sine', 0.045, 0.06);
  }

  function playCelebrate() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      playTone(freq, freq, 0.18, 'triangle', 0.04, idx * 0.07);
    });
  }

  // ---------------------------------------------------------------------------
  // Context-Preserving View Transitions
  // ---------------------------------------------------------------------------

  let transitionCleanupTimer = null;

  function applyDirectionClass(direction) {
    if (!appMain) return;
    appMain.classList.remove('transition-forward', 'transition-back', 'transition-crossfade');
    void appMain.offsetWidth;
    const cls =
      direction === 'back'
        ? 'transition-back'
        : direction === 'crossfade'
        ? 'transition-crossfade'
        : 'transition-forward';
    appMain.classList.add(cls);

    if (transitionCleanupTimer) clearTimeout(transitionCleanupTimer);
    transitionCleanupTimer = setTimeout(() => {
      appMain.classList.remove('transition-forward', 'transition-back', 'transition-crossfade');
    }, 450);
  }

  function transitionView(direction, updateFn) {
    if (typeof document.startViewTransition === 'function') {
      try {
        const vt = document.startViewTransition(() => {
          updateFn();
        });
        vt.finished.catch(() => {});
        applyDirectionClass(direction);
        return;
      } catch {
        // Fallback below
      }
    }
    updateFn();
    applyDirectionClass(direction);
  }

  // ---------------------------------------------------------------------------
  // Toast & Particle Burst Feedback
  // ---------------------------------------------------------------------------

  function showXpToast(amount, label) {
    if (!xpToastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.textContent = `+${amount} XP · ${label}`;
    xpToastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2400);
  }

  function spawnBurst(anchorEl) {
    const rect = anchorEl
      ? anchorEl.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: 120, width: 0, height: 0 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#58AD3A', '#3574B9', '#E8743B', '#B02A7E', '#36A59A'];

    for (let i = 0; i < 10; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'burst-particle';
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.35;
      const dist = 36 + Math.random() * 34;
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty('--tx', `${Math.round(Math.cos(angle) * dist)}px`);
      particle.style.setProperty('--ty', `${Math.round(Math.sin(angle) * dist)}px`);
      particle.style.backgroundColor = colors[i % colors.length];
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 750);
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence & Data Helpers
  // ---------------------------------------------------------------------------

  function defaultProgress() {
    return {
      completedParagraphs: {},
      solvedCases: {},
      quizAnswers: {},
      checkedSteps: {},
      finalAnswers: {},
      reflections: {},
      masteredTerms: {},
      soundEnabled: true
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      return {
        ...defaultProgress(),
        ...parsed
      };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch {
      // Ignore storage quota / privacy-mode errors
    }
  }

  function getGradeData(grade = state.grade) {
    if (AUTHOR === 'kuzniecova') {
      if (Number(grade) === 9) {
        return window.KUZ_GRADE_9_DATA || null;
      }
      return window.KUZ_GRADE_8_DATA || null;
    }
    if (Number(grade) === 9) {
      return window.GRADE_9_DATA || null;
    }
    return window.GRADE_8_DATA || null;
  }

  function getUnitLabel(gradeData = getGradeData()) {
    return (gradeData && gradeData.unitLabel) || '§';
  }

  function formatUnitBadge(num, gradeData = getGradeData()) {
    const label = getUnitLabel(gradeData);
    return `${label} ${num}`;
  }

  function getAllParagraphs(gradeData) {
    const list = [];
    if (!gradeData || !Array.isArray(gradeData.sections)) return list;
    gradeData.sections.forEach((sec) => {
      (sec.topics || []).forEach((topic) => {
        (topic.paragraphs || []).forEach((p) => {
          list.push({ section: sec, topic, paragraph: p });
        });
      });
    });
    return list;
  }

  function findSectionById(gradeData, sectionId) {
    if (!gradeData || !Array.isArray(gradeData.sections)) return null;
    return (
      gradeData.sections.find((s) => String(s.id) === String(sectionId)) ||
      gradeData.sections[0] ||
      null
    );
  }

  function findParagraphContext(gradeData, paragraphId) {
    const all = getAllParagraphs(gradeData);
    return (
      all.find((item) => String(item.paragraph.id) === String(paragraphId)) ||
      all[0] ||
      null
    );
  }

  function findPracticalContext(gradeData, workId) {
    if (!gradeData || !Array.isArray(gradeData.sections)) return null;
    for (const sec of gradeData.sections) {
      const pw = (sec.practicalWorks || []).find(
        (w) => String(w.id) === String(workId)
      );
      if (pw) return { section: sec, work: pw };
    }
    for (const sec of gradeData.sections) {
      if (sec.practicalWorks && sec.practicalWorks.length > 0) {
        return { section: sec, work: sec.practicalWorks[0] };
      }
    }
    return null;
  }

  function findFinalContext(gradeData, finalId) {
    if (!gradeData || !Array.isArray(gradeData.sections)) return null;
    for (const sec of gradeData.sections) {
      if (sec.finalWork && String(sec.finalWork.id) === String(finalId)) {
        return { section: sec, finalWork: sec.finalWork };
      }
    }
    for (const sec of gradeData.sections) {
      if (sec.finalWork) {
        return { section: sec, finalWork: sec.finalWork };
      }
    }
    return null;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripOptionPrefix(optText) {
    return String(optText || '').replace(/^[АБВГA-D]\)\s*/i, '');
  }

  function pKey(grade, paragraphId) {
    return `${grade}:${paragraphId}`;
  }

  function calculateXp() {
    const p = state.progress;
    let xp = 0;
    xp += Object.values(p.completedParagraphs).filter(Boolean).length * 20;
    xp += Object.values(p.solvedCases).filter(Boolean).length * 15;
    xp += Object.values(p.quizAnswers).filter((a) => a && a.correct).length * 10;
    xp += Object.values(p.finalAnswers).filter((a) => a && a.correct).length * 10;
    xp += Object.values(p.checkedSteps).filter(Boolean).length * 5;
    return xp;
  }

  function getStudentRank(xp) {
    return RANKS.find((r) => xp >= r.minXp) || RANKS[RANKS.length - 1];
  }

  // ---------------------------------------------------------------------------
  // Chrome, Reading Ruler & Navigation Sync
  // ---------------------------------------------------------------------------

  function updateReadingProgress() {
    if (!readingProgressBar) return;
    if (state.view !== 'paragraph') {
      readingProgressBar.style.width = '0%';
      return;
    }
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) {
      readingProgressBar.style.width = '100%';
      return;
    }
    const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
    readingProgressBar.style.width = `${pct}%`;
  }

  function syncThemeAttributes() {
    const gradeData = getGradeData();
    const sec = findSectionById(gradeData, state.sectionId);
    bodyEl.dataset.grade = String(state.grade);
    bodyEl.dataset.section = sec ? String(sec.number || 1) : '1';
    bodyEl.classList.toggle('is-welcome', state.view === 'welcome');

    let activeTheme = null;
    if (state.view === 'paragraph' && state.activeItemId) {
      const ctx = findParagraphContext(gradeData, state.activeItemId);
      if (ctx && ctx.topic && ctx.topic.theme) {
        activeTheme = ctx.topic.theme;
      } else if (ctx && ctx.section && ctx.section.theme) {
        activeTheme = ctx.section.theme;
      }
    } else if (AUTHOR === 'kuzniecova' && sec && sec.theme) {
      activeTheme = sec.theme;
    }

    if (activeTheme) {
      bodyEl.style.setProperty('--section-primary', activeTheme.primary);
      bodyEl.style.setProperty('--section-dark', activeTheme.dark);
      bodyEl.style.setProperty('--section-tint', activeTheme.tint);
    } else {
      bodyEl.style.removeProperty('--section-primary');
      bodyEl.style.removeProperty('--section-dark');
      bodyEl.style.removeProperty('--section-tint');
    }
  }

  function syncTopBar() {
    const isWelcome = state.view === 'welcome';
    gradeButtons.forEach((btn) => {
      const isCurrent = !isWelcome && Number(btn.dataset.gradeBtn) === state.grade;
      btn.classList.toggle('is-active', isCurrent);
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });

    const activeMode =
      state.view === 'practical' || state.view === 'final' ? 'lab' : state.view;
    modeTabs.forEach((tab) => {
      const isCurrent = !isWelcome && tab.dataset.mode === activeMode;
      tab.classList.toggle('is-active', isCurrent);
      tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    const gradeData = getGradeData();
    const allParagraphs = getAllParagraphs(gradeData);
    const totalCount = allParagraphs.length;
    const completedCount = allParagraphs.filter(
      (item) => state.progress.completedParagraphs[pKey(state.grade, item.paragraph.id)]
    ).length;

    const xp = calculateXp();
    const rank = getStudentRank(xp);

    if (progressParagraphsEl) {
      progressParagraphsEl.textContent = `${completedCount} / ${totalCount}`;
    }
    if (progressXpEl) {
      progressXpEl.textContent = `${xp} XP`;
    }
    if (studentRankEl) {
      studentRankEl.textContent = `Рівень ${rank.level} • ${rank.title}`;
    }
    if (progressBarFillEl) {
      const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      progressBarFillEl.style.width = `${pct}%`;
    }
    if (soundToggleBtn) {
      const isOn = !!state.progress.soundEnabled;
      soundToggleBtn.classList.toggle('is-muted', !isOn);
      soundToggleBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      soundToggleBtn.textContent = isOn ? '🔊 Звук' : '🔇 Тиша';
    }
    if (navGradeLabel) {
      navGradeLabel.textContent = `${state.grade} клас`;
    }
  }

  function openMobileSidebar() {
    if (!courseNavigator || !sidebarBackdrop) return;
    courseNavigator.classList.add('is-open');
    sidebarBackdrop.removeAttribute('hidden');
    if (sidebarToggleBtn) sidebarToggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMobileSidebar() {
    if (!courseNavigator || !sidebarBackdrop) return;
    courseNavigator.classList.remove('is-open');
    sidebarBackdrop.setAttribute('hidden', '');
    if (sidebarToggleBtn) sidebarToggleBtn.setAttribute('aria-expanded', 'false');
  }

  function getStartPage(pagesStr) {
    const match = String(pagesStr || '').match(/\d+/);
    return match ? Number(match[0]) : 9999;
  }

  function getTopicTimelineItems(sec, topicIdx) {
    const topics = sec.topics || [];
    const topic = topics[topicIdx];
    const nextTopic = topics[topicIdx + 1];
    const topicStart =
      topicIdx === 0
        ? 0
        : getStartPage(
            topic && topic.paragraphs && topic.paragraphs[0] ? topic.paragraphs[0].pages : ''
          );
    const nextTopicStart =
      nextTopic && nextTopic.paragraphs && nextTopic.paragraphs[0]
        ? getStartPage(nextTopic.paragraphs[0].pages)
        : Infinity;

    const items = (topic.paragraphs || []).map((p) => ({
      kind: 'paragraph',
      page: getStartPage(p.pages),
      data: p
    }));

    (sec.practicalWorks || []).forEach((pw) => {
      const pwPage = getStartPage(pw.pages);
      if (pwPage >= topicStart && pwPage < nextTopicStart) {
        items.push({
          kind: 'practical',
          page: pwPage,
          data: pw
        });
      }
    });

    items.sort((a, b) => a.page - b.page);
    return items;
  }

  function renderSidebar() {
    if (!navigatorTree) return;
    const gradeData = getGradeData();
    if (!gradeData || !Array.isArray(gradeData.sections)) {
      navigatorTree.innerHTML = '<p class="nav-empty">Дані курсу не знайдено.</p>';
      return;
    }

    const html = gradeData.sections
      .map((sec) => {
        const isCurrentSec = String(sec.id) === String(state.sectionId);
        const topicsHtml = (sec.topics || [])
          .map((topic, topicIdx) => {
            const timelineItems = getTopicTimelineItems(sec, topicIdx);
            const itemsHtml = timelineItems
              .map((entry) => {
                if (entry.kind === 'practical') {
                  const pw = entry.data;
                  const isActive =
                    state.view === 'practical' &&
                    String(state.activeItemId) === String(pw.id);
                  return `
                    <button type="button"
                      class="nav-work-btn is-practical ${isActive ? 'is-active' : ''}"
                      data-nav-action="practical"
                      data-section-id="${escapeHtml(sec.id)}"
                      data-item-id="${escapeHtml(pw.id)}">
                      <span class="nav-item-badge">ПР ${escapeHtml(pw.number)}</span>
                      <span class="nav-item-title">${escapeHtml(pw.title)}</span>
                    </button>
                  `;
                }

                const p = entry.data;
                const isDone =
                  !!state.progress.completedParagraphs[pKey(state.grade, p.id)];
                const isActive =
                  state.view === 'paragraph' &&
                  String(state.activeItemId) === String(p.id);
                return `
                  <button type="button"
                    class="nav-item ${isActive ? 'is-active' : ''} ${isDone ? 'is-completed' : ''}"
                    data-nav-action="paragraph"
                    data-section-id="${escapeHtml(sec.id)}"
                    data-item-id="${escapeHtml(p.id)}">
                    <span class="nav-item-badge">${escapeHtml(formatUnitBadge(p.number, gradeData))}</span>
                    <span class="nav-item-title">${escapeHtml(p.title)}</span>
                    ${isDone ? '<span class="nav-item-check" aria-label="Вивчено">✓</span>' : ''}
                  </button>
                `;
              })
              .join('');

            return `
              <div class="nav-topic">
                <div class="nav-topic-title">Тема ${escapeHtml(topic.number)}. ${escapeHtml(topic.title)}</div>
                <div class="nav-topic-items">${itemsHtml}</div>
              </div>
            `;
          })
          .join('');

        const finalBtn = sec.finalWork
          ? `
            <button type="button"
              class="nav-work-btn is-final ${
                state.view === 'final' &&
                String(state.activeItemId) === String(sec.finalWork.id)
                  ? 'is-active'
                  : ''
              }"
              data-nav-action="final"
              data-section-id="${escapeHtml(sec.id)}"
              data-item-id="${escapeHtml(sec.finalWork.id)}">
              <span class="nav-item-badge">Підс.</span>
              <span class="nav-item-title">${escapeHtml(sec.finalWork.title)}</span>
            </button>
          `
          : '';

        return `
          <section class="nav-section ${isCurrentSec ? 'is-current-section' : ''}" data-section="${escapeHtml(sec.number)}">
            <div class="nav-section-header">
              <span class="nav-section-badge">Розділ ${escapeHtml(sec.roman)}</span>
              <strong class="nav-section-name">${escapeHtml(sec.title)}</strong>
            </div>
            ${topicsHtml}
            ${finalBtn ? `<div class="nav-works-group">${finalBtn}</div>` : ''}
          </section>
        `;
      })
      .join('');

    navigatorTree.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // View 1: Course Map + Hero Mastery Banner + Cursor-Reactive Chart
  // ---------------------------------------------------------------------------

  function computeGradeMastery(gradeData) {
    const allParagraphs = getAllParagraphs(gradeData);
    const totalParagraphs = allParagraphs.length;
    const doneParagraphs = allParagraphs.filter(
      (item) => !!state.progress.completedParagraphs[pKey(state.grade, item.paragraph.id)]
    ).length;

    let totalWorks = 0;
    let doneWorks = 0;

    (gradeData.sections || []).forEach((sec) => {
      (sec.practicalWorks || []).forEach((pw) => {
        totalWorks += 1;
        const checklist = (pw.interactiveTask && pw.interactiveTask.checklist) || [];
        if (
          checklist.length > 0 &&
          checklist.every((_, idx) => !!state.progress.checkedSteps[`${state.grade}:${pw.id}:${idx}`])
        ) {
          doneWorks += 1;
        }
      });
      if (sec.finalWork) {
        totalWorks += 1;
        const tasks = sec.finalWork.tasks || [];
        if (
          tasks.length > 0 &&
          tasks.every((_, idx) => {
            const ans = state.progress.finalAnswers[`${state.grade}:${sec.finalWork.id}:${idx}`];
            return ans && ans.correct;
          })
        ) {
          doneWorks += 1;
        }
      }
    });

    const totalItems = totalParagraphs + totalWorks;
    const doneItems = doneParagraphs + doneWorks;
    const masteryPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    const nextParagraphItem =
      allParagraphs.find(
        (item) => !state.progress.completedParagraphs[pKey(state.grade, item.paragraph.id)]
      ) || allParagraphs[0] || null;

    return {
      totalParagraphs,
      doneParagraphs,
      totalWorks,
      doneWorks,
      masteryPct,
      nextParagraphItem
    };
  }

  function buildTopicChartData(gradeData) {
    const bars = [];
    (gradeData.sections || []).forEach((sec) => {
      (sec.topics || []).forEach((topic) => {
        const paragraphs = topic.paragraphs || [];
        const total = paragraphs.length;
        let done = 0;
        let xp = 0;
        paragraphs.forEach((p) => {
          if (state.progress.completedParagraphs[pKey(state.grade, p.id)]) {
            done += 1;
            xp += 20;
          }
          if (state.progress.solvedCases[pKey(state.grade, p.id)]) {
            xp += 15;
          }
          (p.quiz || []).forEach((_, idx) => {
            const ans = state.progress.quizAnswers[`${state.grade}:${p.id}:${idx}`];
            if (ans && ans.correct) xp += 10;
          });
        });
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        bars.push({
          shortLabel: `Т${topic.number}`,
          fullLabel: `Тема ${topic.number}: ${topic.title}`,
          sectionNum: sec.number,
          done,
          total,
          pct,
          xp
        });
      });
    });
    return bars;
  }

  function renderHeroChartSvg(bars) {
    if (!bars || bars.length === 0) return '';
    const svgW = 260;
    const topY = 12;
    const baseY = 86;
    const maxH = baseY - topY;
    const count = bars.length;
    const slotW = svgW / count;
    const barW = Math.min(26, Math.max(12, Math.floor(slotW * 0.56)));

    const barsSvg = bars
      .map((bar, idx) => {
        const xCenter = slotW * idx + slotW / 2;
        const x = xCenter - barW / 2;
        const fillH = Math.max(8, Math.round((bar.pct / 100) * maxH));
        const fillY = baseY - fillH;
        return `
          <g class="chart-bar-group"
             data-bar-idx="${idx}"
             data-x-center="${xCenter.toFixed(1)}"
             data-label="${escapeHtml(bar.fullLabel)}"
             data-done="${bar.done}"
             data-total="${bar.total}"
             data-pct="${bar.pct}"
             data-xp="${bar.xp}">
            <rect class="chart-bar-track" x="${x.toFixed(1)}" y="${topY}" width="${barW}" height="${maxH}" rx="4" />
            <rect class="chart-bar" x="${x.toFixed(1)}" y="${fillY}" width="${barW}" height="${fillH}" rx="4" data-section="${escapeHtml(bar.sectionNum)}" />
            <text class="chart-bar-label" x="${xCenter.toFixed(1)}" y="102" text-anchor="middle">${escapeHtml(bar.shortLabel)}</text>
          </g>
        `;
      })
      .join('');

    return `
      <svg class="chart-svg" viewBox="0 0 260 110" role="img" aria-label="Інтерактивний графік прогресу за темами">
        <line class="chart-baseline" x1="4" y1="${baseY}" x2="256" y2="${baseY}" />
        ${barsSvg}
        <line class="chart-crosshair" x1="0" y1="${topY - 4}" x2="0" y2="${baseY + 2}" visibility="hidden" />
      </svg>
    `;
  }

  function attachHeroInteractions() {
    const tiltTargets = appMain.querySelectorAll('.mastery-ring-card, .hero-chart-card');
    tiltTargets.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        const tiltY = Math.max(-4, Math.min(4, nx * 8));
        const tiltX = Math.max(-4, Math.min(4, -ny * 8));
        card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
      });

      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    });

    const chartCard = appMain.querySelector('.hero-chart-card');
    if (!chartCard) return;
    const svg = chartCard.querySelector('.chart-svg');
    const crosshair = chartCard.querySelector('.chart-crosshair');
    const tooltip = chartCard.querySelector('.chart-tooltip');
    const groups = Array.from(chartCard.querySelectorAll('.chart-bar-group'));
    if (!svg || !crosshair || !tooltip || groups.length === 0) return;

    svg.addEventListener('mousemove', (e) => {
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect.width) return;
      const relX = ((e.clientX - svgRect.left) / svgRect.width) * 260;

      let closest = groups[0];
      let minDist = Infinity;
      groups.forEach((g) => {
        const cx = Number(g.dataset.xCenter);
        const dist = Math.abs(relX - cx);
        if (dist < minDist) {
          minDist = dist;
          closest = g;
        }
      });

      groups.forEach((g) => {
        const bar = g.querySelector('.chart-bar');
        if (bar) bar.classList.toggle('is-hovered', g === closest);
      });

      const cx = closest.dataset.xCenter;
      crosshair.setAttribute('x1', cx);
      crosshair.setAttribute('x2', cx);
      crosshair.setAttribute('visibility', 'visible');

      const cardRect = chartCard.getBoundingClientRect();
      const tipX = Math.min(cardRect.width - 140, Math.max(8, e.clientX - cardRect.left + 10));
      const tipY = Math.max(8, e.clientY - cardRect.top - 48);

      tooltip.innerHTML = `
        <strong>${escapeHtml(closest.dataset.label)}</strong>
        <span>${escapeHtml(closest.dataset.done)}/${escapeHtml(closest.dataset.total)} § (${escapeHtml(closest.dataset.pct)}%) · ${escapeHtml(closest.dataset.xp)} XP</span>
      `;
      tooltip.style.left = `${tipX}px`;
      tooltip.style.top = `${tipY}px`;
      tooltip.removeAttribute('hidden');
    });

    svg.addEventListener('mouseleave', () => {
      groups.forEach((g) => {
        const bar = g.querySelector('.chart-bar');
        if (bar) bar.classList.remove('is-hovered');
      });
      crosshair.setAttribute('visibility', 'hidden');
      tooltip.setAttribute('hidden', '');
    });
  }

  function renderCourseMap() {
    const gradeData = getGradeData();
    if (!gradeData || !Array.isArray(gradeData.sections)) {
      appMain.innerHTML = `
        <div class="empty-state">
          <h2>Матеріали ${state.grade} класу ще завантажуються</h2>
          <p>Перевірте підключення файлів <code>data-grade8.js</code> та <code>data-grade9.js</code>.</p>
        </div>
      `;
      return;
    }

    const mastery = computeGradeMastery(gradeData);
    const xp = calculateXp();
    const rank = getStudentRank(xp);
    const ringOffset = RING_CIRCUMFERENCE * (1 - mastery.masteryPct / 100);
    const chartBars = buildTopicChartData(gradeData);

    const continueBtnHtml = mastery.nextParagraphItem
      ? `
        <button type="button"
          class="hero-continue-btn"
          data-action="open-paragraph"
          data-section-id="${escapeHtml(mastery.nextParagraphItem.section.id)}"
          data-item-id="${escapeHtml(mastery.nextParagraphItem.paragraph.id)}">
          Продовжити навчання: ${escapeHtml(formatUnitBadge(mastery.nextParagraphItem.paragraph.number, gradeData))}. ${escapeHtml(
          mastery.nextParagraphItem.paragraph.title
        )} →
        </button>
      `
      : '';

  function matchesCourseFilter(entry, topic, query, onlyUnlearned) {
    if (onlyUnlearned && entry.kind !== 'practical') {
      const isDone = !!state.progress.completedParagraphs[pKey(state.grade, entry.data.id)];
      if (isDone) return false;
    }
    if (!query) return true;
    const q = query.toLowerCase();
    const tTitle = String(topic.title || '').toLowerCase();
    if (tTitle.includes(q)) return true;
    const title = String(entry.data.title || '').toLowerCase();
    if (title.includes(q)) return true;
    if (entry.kind !== 'practical') {
      const lead = String(entry.data.leadIn || '').toLowerCase();
      if (lead.includes(q)) return true;
      const terms = ((entry.data.summary && entry.data.summary.keyTerms) || [])
        .join(' ')
        .toLowerCase();
      if (terms.includes(q)) return true;
      if (String(entry.data.number || '') === q) return true;
    }
    return false;
  }

  function buildCourseSectionsHtml(gradeData) {
    const query = String(state.searchQuery || '').trim();
    const onlyUnlearned = !!state.onlyUnlearned;
    let totalMatchedItems = 0;

    const html = gradeData.sections
      .map((sec) => {
        const secParagraphs = (sec.topics || []).flatMap((t) => t.paragraphs || []);
        const secDone = secParagraphs.filter(
          (p) => state.progress.completedParagraphs[pKey(state.grade, p.id)]
        ).length;

        const topicsHtml = (sec.topics || [])
          .map((topic, topicIdx) => {
            const timelineItems = getTopicTimelineItems(sec, topicIdx);
            const filteredItems = timelineItems.filter((entry) =>
              matchesCourseFilter(entry, topic, query, onlyUnlearned)
            );
            if ((query || onlyUnlearned) && filteredItems.length === 0) {
              return '';
            }
            totalMatchedItems += filteredItems.length;

            const topicParagraphs = topic.paragraphs || [];
            const topicDone = topicParagraphs.filter(
              (p) => state.progress.completedParagraphs[pKey(state.grade, p.id)]
            ).length;
            const isCollapsed = !query && !!state.collapsedTopics[topic.id];

            const itemsHtml = filteredItems
              .map((entry) => {
                if (entry.kind === 'practical') {
                  const pw = entry.data;
                  return `
                    <button type="button"
                      class="roadmap-paragraph-btn is-practical-tile"
                      data-action="open-practical"
                      data-section-id="${escapeHtml(sec.id)}"
                      data-item-id="${escapeHtml(pw.id)}">
                      <span class="tile-badge">ПР ${escapeHtml(pw.number)}</span>
                      <span class="tile-content">
                        <strong class="tile-title">Практична робота № ${escapeHtml(pw.number)}. ${escapeHtml(pw.title)}</strong>
                        <span class="tile-meta">с. ${escapeHtml(pw.pages || '—')}</span>
                      </span>
                      <span class="tile-status">Практикум →</span>
                    </button>
                  `;
                }

                const p = entry.data;
                const isDone =
                  !!state.progress.completedParagraphs[pKey(state.grade, p.id)];
                return `
                  <button type="button"
                    class="roadmap-paragraph-btn ${isDone ? 'is-completed' : ''}"
                    data-action="open-paragraph"
                    data-section-id="${escapeHtml(sec.id)}"
                    data-item-id="${escapeHtml(p.id)}">
                    <span class="tile-badge">${escapeHtml(formatUnitBadge(p.number, gradeData))}</span>
                    <span class="tile-content">
                      <strong class="tile-title">${escapeHtml(p.title)}</strong>
                      <span class="tile-meta">с. ${escapeHtml(p.pages || '—')}</span>
                    </span>
                    <span class="tile-status">${isDone ? '✓ Вивчено' : 'Читати →'}</span>
                  </button>
                `;
              })
              .join('');

            const topicThemeStyle =
              topic.theme && topic.theme.primary
                ? ` style="--topic-primary: ${escapeHtml(topic.theme.primary)}; --topic-dark: ${escapeHtml(topic.theme.dark)}; --topic-tint: ${escapeHtml(topic.theme.tint)};"`
                : '';

            return `
              <div class="roadmap-topic-block ${isCollapsed ? 'is-collapsed' : ''}"${topicThemeStyle}>
                <button type="button"
                  class="roadmap-topic-toggle"
                  data-action="toggle-topic"
                  data-topic-id="${escapeHtml(topic.id)}"
                  aria-expanded="${isCollapsed ? 'false' : 'true'}">
                  <span class="roadmap-topic-title">
                    <span class="topic-num-chip">Тема ${escapeHtml(topic.number)}</span>
                    <span>${escapeHtml(topic.title)}</span>
                  </span>
                  <span class="topic-toggle-meta">
                    <span class="topic-done-badge">${topicDone}/${topicParagraphs.length}</span>
                    <span class="topic-chevron" aria-hidden="true">${isCollapsed ? '▸' : '▾'}</span>
                  </span>
                </button>
                <div class="roadmap-paragraphs-grid" ${isCollapsed ? 'hidden' : ''}>${itemsHtml}</div>
              </div>
            `;
          })
          .join('');

        if ((query || onlyUnlearned) && !topicsHtml.trim()) {
          return '';
        }

        const finalBtn = sec.finalWork
          ? `
            <button type="button"
              class="pinned-work-btn pinned-final"
              data-action="open-final"
              data-section-id="${escapeHtml(sec.id)}"
              data-item-id="${escapeHtml(sec.finalWork.id)}">
              ${escapeHtml(sec.finalWork.title)}
            </button>
          `
          : '';

        return `
          <article class="roadmap-section-card ${
            String(sec.id) === String(state.sectionId) ? 'is-active' : ''
          }" data-section="${escapeHtml(sec.number)}">
            <header class="roadmap-card-head">
              <span class="tilted-badge badge-section">Розділ ${escapeHtml(sec.roman)}</span>
              <h2 class="roadmap-section-title">${escapeHtml(sec.title)}</h2>
              <span class="section-progress-pill">${secDone} / ${secParagraphs.length} ${escapeHtml(getUnitLabel(gradeData))}</span>
              <span class="palette-swatch" title="Основний акцент розділу"></span>
            </header>

            ${
              sec.description
                ? `<p class="roadmap-section-desc">${escapeHtml(sec.description)}</p>`
                : ''
            }

            <div class="roadmap-topics-list">
              ${topicsHtml}
            </div>

            ${finalBtn ? `<footer class="roadmap-works-row">${finalBtn}</footer>` : ''}
          </article>
        `;
      })
      .join('');

    if (totalMatchedItems === 0) {
      return `
        <div class="course-empty-filter">
          <p>За вашим фільтром нічого не знайдено.</p>
          <button type="button" class="nav-step-btn" data-action="clear-course-filters">Показати всі теми</button>
        </div>
      `;
    }
    return html;
  }

  function refreshCourseSectionsOnly() {
    const grid = document.getElementById('course-roadmap-grid');
    const gradeData = getGradeData();
    if (!grid || !gradeData) return;
    grid.innerHTML = buildCourseSectionsHtml(gradeData);
  }

    appMain.innerHTML = `
      <section class="course-map-view">
        <header class="hero-wow-banner course-map-header">
          <div class="hero-wow-left">
            <span class="hero-persona-pill">${
              state.grade === 8
                ? '8 клас · Сюжетна подорож'
                : '9 клас · Бізнес та фінтех'
            }</span>
            <h1 class="course-title">${escapeHtml(gradeData.title || `${state.grade} клас`)}</h1>
            <p class="course-subtitle">${escapeHtml(gradeData.subtitle || '')}</p>
            ${continueBtnHtml}
          </div>

          <div class="hero-wow-right">
            <div class="mastery-ring-card">
              <div class="mastery-ring-wrap">
                <svg viewBox="0 0 100 100" class="mastery-ring-svg" aria-hidden="true">
                  <circle class="mastery-ring-track mastery-ring-bg" cx="50" cy="50" r="${RING_RADIUS}" />
                  <circle class="mastery-ring-fill" cx="50" cy="50" r="${RING_RADIUS}"
                    stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}"
                    stroke-dashoffset="${ringOffset.toFixed(2)}" />
                </svg>
                <div class="mastery-percent">${mastery.masteryPct}%</div>
              </div>
              <div class="hero-stats-row">
                <span class="hero-stat-chip">Рівень ${rank.level} • ${escapeHtml(rank.title)}</span>
                <span class="hero-stat-chip">${xp} XP</span>
                <span class="hero-stat-chip">${mastery.doneParagraphs}/${mastery.totalParagraphs} ${escapeHtml(getUnitLabel(gradeData))}</span>
              </div>
            </div>

            <div class="hero-chart-card">
              <div class="hero-chart-title">Прогрес за темами (наведіть курсор)</div>
              ${renderHeroChartSvg(chartBars)}
              <div class="chart-tooltip" hidden></div>
            </div>
          </div>
        </header>

        <div class="course-filter-bar" role="search" aria-label="Пошук та фільтрація курсу">
          <div class="course-search-wrap">
            <span class="course-search-icon" aria-hidden="true">🔍</span>
            <input type="search"
              id="course-search-input"
              class="course-search-input"
              value="${escapeHtml(state.searchQuery)}"
              placeholder="Пошук теми, терміну (напр. фішинг, депозит, SWOT)..."
              autocomplete="off">
            ${
              state.searchQuery
                ? '<button type="button" class="course-search-clear" data-action="clear-course-search" aria-label="Очистити пошук">✕</button>'
                : ''
            }
          </div>

          <div class="course-filter-actions">
            <button type="button"
              class="course-filter-chip ${state.onlyUnlearned ? 'is-active' : ''}"
              data-action="toggle-unlearned"
              aria-pressed="${state.onlyUnlearned ? 'true' : 'false'}">
              ${state.onlyUnlearned ? '✓ Лише невивчені' : 'Лише невивчені'}
            </button>
            <button type="button"
              class="course-filter-chip"
              data-action="toggle-collapse-all">
              ${hasExpanded ? 'Згорнути теми' : 'Розгорнути теми'}
            </button>
          </div>
        </div>

        <div class="course-roadmap-grid" id="course-roadmap-grid">
          ${sectionsHtml}
        </div>
      </section>
    `;

    attachHeroInteractions();
  }

  // ---------------------------------------------------------------------------
  // View 2: Paragraph Reader (All 9 Rubrics + Case + Interactive Quiz)
  // ---------------------------------------------------------------------------

  function renderSubtopic(sub, paragraphId) {
    const theoryHtml = (sub.theory || [])
      .map((t) => `<p>${escapeHtml(t)}</p>`)
      .join('');

    const defHtml = sub.definition
      ? `
        <aside class="rubric-card rubric-definition">
          <div class="rubric-badge-wrap">
            <span class="tilted-badge rubric-badge" aria-hidden="true">!</span>
          </div>
          <div class="rubric-content">
            <h4 class="rubric-title">Означення · Важливо</h4>
            <p>
              ${sub.definition.term ? `<strong>${escapeHtml(sub.definition.term)}</strong> — ` : ''}
              ${escapeHtml(sub.definition.text || '')}
            </p>
          </div>
        </aside>
      `
      : '';

    const reflectionKey = `${state.grade}:${paragraphId}:sub:${sub.num}`;
    const isReflected = !!state.progress.reflections[reflectionKey];
    const questionHtml = sub.question
      ? `
        <aside class="rubric-card rubric-question ${isReflected ? 'is-reflected' : ''}">
          <div class="rubric-badge-wrap">
            <span class="tilted-badge rubric-badge" aria-hidden="true">?</span>
          </div>
          <div class="rubric-content">
            <div class="rubric-title-row">
              <h4 class="rubric-title">Поміркуймо</h4>
              <button type="button"
                class="reflection-toggle-btn ${isReflected ? 'is-active' : ''}"
                data-action="toggle-reflection"
                data-reflection-key="${escapeHtml(reflectionKey)}">
                ${isReflected ? '✓ Обмірковано' : 'Позначити думку'}
              </button>
            </div>
            <p>${escapeHtml(sub.question)}</p>
          </div>
        </aside>
      `
      : '';

    const researchHtml = sub.research
      ? `
        <aside class="rubric-card rubric-research">
          <div class="rubric-badge-wrap">
            <span class="tilted-badge rubric-badge" aria-hidden="true">i</span>
            <svg class="rubric-extra-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/>
              <path d="M14.5 14.5L20 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="rubric-content">
            <h4 class="rubric-title">Міні-дослідження</h4>
            <p>${escapeHtml(sub.research)}</p>
          </div>
        </aside>
      `
      : '';

    const historyHtml = sub.history
      ? `
        <aside class="rubric-card rubric-history">
          <div class="rubric-badge-wrap">
            <span class="round-badge rubric-badge-clock" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="clock-svg">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/>
                <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <div class="rubric-content">
            <h4 class="rubric-title rubric-title-upper">${escapeHtml(
              sub.history.title || 'ЦІКАВИЙ КЕЙС З ІСТОРІЇ'
            )}</h4>
            <p>${escapeHtml(sub.history.text || '')}</p>
          </div>
        </aside>
      `
      : '';

    return `
      <section class="subtopic-block">
        <div class="pill-subheading">
          <span class="tilted-badge pill-num">${escapeHtml(sub.num)}</span>
          <h3 class="pill-label">${escapeHtml(sub.title)}</h3>
        </div>
        ${theoryHtml ? `<div class="theory-block">${theoryHtml}</div>` : ''}
        ${defHtml}
        ${questionHtml}
        ${researchHtml}
        ${historyHtml}
      </section>
    `;
  }

  function renderParagraphView() {
    const gradeData = getGradeData();
    const ctx = findParagraphContext(gradeData, state.activeItemId);
    if (!ctx) {
      renderCourseMap();
      return;
    }

    const { section, topic, paragraph: p } = ctx;
    state.sectionId = section.id;
    state.activeItemId = p.id;

    const allParagraphs = getAllParagraphs(gradeData);
    const currentIndex = allParagraphs.findIndex(
      (item) => String(item.paragraph.id) === String(p.id)
    );
    const prevItem = currentIndex > 0 ? allParagraphs[currentIndex - 1] : null;
    const nextItem =
      currentIndex >= 0 && currentIndex < allParagraphs.length - 1
        ? allParagraphs[currentIndex + 1]
        : null;

    const unitText = formatUnitBadge(p.number, gradeData);
    const runningHeaderText =
      state.grade === 8 || AUTHOR === 'kuzniecova'
        ? `Тема ${topic.number} / ${unitText}. ${p.title}`
        : `Розділ ${section.roman} / ${unitText}. ${p.title}`;

    const breadcrumbHtml = `
      <nav class="context-breadcrumb" aria-label="Шлях до поточного матеріалу">
        <button type="button" class="breadcrumb-step" data-action="open-map">${state.grade} клас</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <button type="button" class="breadcrumb-step" data-action="open-map">Розділ ${escapeHtml(section.roman)}</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <span class="breadcrumb-step">Тема ${escapeHtml(topic.number)}</span>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <span class="breadcrumb-step is-current">${escapeHtml(unitText)}</span>
      </nav>
    `;

    const subtopicsHtml = (p.subtopics || [])
      .map((sub) => renderSubtopic(sub, p.id))
      .join('');

    const dialogueHtml = p.dialogue
      ? `
        <div class="character-dialogue">
          <div class="character-avatar" aria-hidden="true">${escapeHtml(
            (p.dialogue.speaker || 'П').charAt(0).toUpperCase()
          )}</div>
          <div class="speech-bubble">
            ${
              p.dialogue.speaker
                ? `<strong class="dialogue-speaker">${escapeHtml(p.dialogue.speaker)}:</strong> `
                : ''
            }
            <span>${escapeHtml(p.dialogue.line || '')}</span>
          </div>
        </div>
      `
      : '';

    const factsHtml =
      Array.isArray(p.facts5) && p.facts5.length > 0
        ? `
          <aside class="rubric-card rubric-facts">
            <div class="facts-notepad-icon" aria-hidden="true">
              <svg viewBox="0 0 36 42" class="notepad-svg">
                <rect x="6" y="6" width="24" height="32" rx="4" fill="#FFFFFF" stroke="#6B7280" stroke-width="2"/>
                <path d="M12 16h12M12 22h12M12 28h8" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
                <path d="M14 4v6a3 3 0 0 0 6 0V3" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="rubric-content">
              <h4 class="rubric-title rubric-title-upper">5 ЦІКАВИХ ФАКТВ</h4>
              <ol class="facts-list">
                ${p.facts5.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
              </ol>
            </div>
          </aside>
        `
        : '';

    const caseKey = pKey(state.grade, p.id);
    const isCaseSolved = !!state.progress.solvedCases[caseKey];
    const practicalCaseHtml = p.practicalCase
      ? `
        <section class="practical-case-card ${isCaseSolved ? 'is-solved' : ''}" id="practical-case">
          <header class="practical-case-header">
            <span class="case-tag">Практичний кейс</span>
            <h3 class="case-title">${escapeHtml(p.practicalCase.title || 'Задача')}</h3>
          </header>
          ${
            p.practicalCase.scenario
              ? `<p class="case-prompt">${escapeHtml(p.practicalCase.scenario)}</p>`
              : ''
          }
          ${
            p.practicalCase.question
              ? `<p class="case-prompt"><em>${escapeHtml(p.practicalCase.question)}</em></p>`
              : ''
          }
          <div class="case-actions">
            ${
              p.practicalCase.hint
                ? `<button type="button" class="case-hint-btn" id="case-hint-btn" aria-expanded="false" aria-controls="case-hint-box">Підказка</button>`
                : ''
            }
            <button type="button" class="case-reveal-btn" id="case-reveal-btn" aria-expanded="false" aria-controls="case-solution">
              Показати розв’язання
            </button>
            <button type="button" class="case-solved-badge ${isCaseSolved ? 'is-active' : ''}" data-action="toggle-case-solved" data-case-key="${escapeHtml(caseKey)}">
              ${isCaseSolved ? '✓ Кейс розв’язано (+15 XP)' : 'Кейс розв’язано +15 XP'}
            </button>
          </div>
          ${
            p.practicalCase.hint
              ? `<div class="case-hint-box" id="case-hint-box" hidden><p><strong>Підказка:</strong> ${escapeHtml(p.practicalCase.hint)}</p></div>`
              : ''
          }
          <div class="case-solution" id="case-solution" hidden>
            <p><em class="solution-label">Розв’язання:</em> ${escapeHtml(p.practicalCase.solution || '')}</p>
          </div>
        </section>
      `
      : '';

    const summaryHtml = p.summary
      ? `
        <section class="rubric-card rubric-summary">
          <div class="spiral-rings" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="notebook-tabs" aria-hidden="true">
            <span class="nb-tab tab-1"></span>
            <span class="nb-tab tab-2"></span>
            <span class="nb-tab tab-3"></span>
          </div>
          <div class="rubric-content">
            <div class="summary-header-row">
              <h4 class="rubric-title rubric-title-upper">ПІДБИВАЄМО ПІДСУМКИ</h4>
              <span class="key-terms-pill">Ключові терміни</span>
            </div>
            ${
              Array.isArray(p.summary.points) && p.summary.points.length > 0
                ? `<ul class="summary-points">${p.summary.points
                    .map((pt) => `<li>${escapeHtml(pt)}</li>`)
                    .join('')}</ul>`
                : ''
            }
            ${
              Array.isArray(p.summary.keyTerms) && p.summary.keyTerms.length > 0
                ? `<div class="terms-strip">${p.summary.keyTerms
                    .map((term, idx) => {
                      const tKey = `${state.grade}:${p.id}:term:${idx}`;
                      const isMastered = !!state.progress.masteredTerms[tKey];
                      return `<button type="button" class="term-chip ${
                        isMastered ? 'is-mastered' : ''
                      }" data-action="toggle-term" data-term-key="${escapeHtml(tKey)}">${
                        isMastered ? '✓ ' : ''
                      }${escapeHtml(term)}</button>`;
                    })
                    .join('')}</div>`
                : ''
            }
          </div>
        </section>
      `
      : '';

    const controlQuestionsHtml =
      Array.isArray(p.controlQuestions) && p.controlQuestions.length > 0
        ? `
          <section class="rubric-card rubric-control-questions">
            <h4 class="rubric-title rubric-title-upper">КОНТРОЛЬНІ ЗАПИТАННЯ</h4>
            <ol class="control-questions-list">
              ${p.controlQuestions
                .map(
                  (cq, idx) => `
                  <li>
                    <span class="cq-num">${idx + 1}</span>
                    <span>${escapeHtml(cq)}</span>
                  </li>
                `
                )
                .join('')}
            </ol>
          </section>
        `
        : '';

    const quizHtml =
      Array.isArray(p.quiz) && p.quiz.length > 0
        ? renderQuizSection(p.quiz, `${state.grade}:${p.id}`, 'quizAnswers', 'ТЕСТОВІ ЗАВДАННЯ')
        : '';

    const isCompleted = !!state.progress.completedParagraphs[pKey(state.grade, p.id)];

    const firstPracticalInSec =
      section.practicalWorks && section.practicalWorks[0] ? section.practicalWorks[0] : null;

    appMain.innerHTML = `
      <article class="page-canvas" id="paragraph-view">
        ${breadcrumbHtml}

        <div class="running-header">
          <span class="running-header-line" aria-hidden="true"></span>
          <span class="running-header-text">${escapeHtml(runningHeaderText)}</span>
        </div>

        <header class="paragraph-header">
          <div class="paragraph-banner-row">
            <span class="tilted-badge badge-paragraph">${escapeHtml(formatUnitBadge(p.number, gradeData))}</span>
            <h1 class="paragraph-title-banner">${escapeHtml(p.title)}</h1>
            ${p.pages ? `<span class="paragraph-pages-pill">с. ${escapeHtml(p.pages)}</span>` : ''}
          </div>
          ${
            p.leadIn
              ? `<div class="lead-in-card"><p class="lead-in-text">${escapeHtml(p.leadIn)}</p></div>`
              : ''
          }
        </header>

        ${subtopicsHtml}
        ${dialogueHtml}
        ${factsHtml}
        ${practicalCaseHtml}
        ${summaryHtml}
        ${controlQuestionsHtml}
        ${quizHtml}

        <section class="paragraph-footer-nav">
          <button type="button"
            class="complete-paragraph-btn ${isCompleted ? 'is-completed' : ''}"
            data-action="toggle-paragraph-complete"
            data-paragraph-id="${escapeHtml(p.id)}">
            ${
              isCompleted
                ? `✓ ${escapeHtml(getUnitLabel(gradeData) === 'Досвід' ? 'Досвід вивчено' : 'Параграф вивчено')} (+20 XP)`
                : `Позначити ${escapeHtml(getUnitLabel(gradeData))} вивченим (+20 XP)`
            }
          </button>

          <div class="prev-next-group">
            ${
              prevItem
                ? `<button type="button" class="nav-step-btn" data-action="open-paragraph" data-section-id="${escapeHtml(prevItem.section.id)}" data-item-id="${escapeHtml(prevItem.paragraph.id)}">← ${escapeHtml(formatUnitBadge(prevItem.paragraph.number, gradeData))}</button>`
                : `<button type="button" class="nav-step-btn" data-action="open-map">← Карта курсу</button>`
            }
            ${
              nextItem
                ? `<button type="button" class="nav-step-btn nav-step-primary" data-action="open-paragraph" data-section-id="${escapeHtml(nextItem.section.id)}" data-item-id="${escapeHtml(nextItem.paragraph.id)}">Наступний ${escapeHtml(formatUnitBadge(nextItem.paragraph.number, gradeData))} →</button>`
                : firstPracticalInSec
                ? `<button type="button" class="nav-step-btn nav-step-primary" data-action="open-practical" data-section-id="${escapeHtml(section.id)}" data-item-id="${escapeHtml(firstPracticalInSec.id)}">До практикуму →</button>`
                : ''
            }
          </div>
        </section>

        <footer class="running-footer">
          <span class="page-number-ribbon">${escapeHtml(p.pages || '—')}</span>
        </footer>
      </article>
    `;
  }

  function renderQuizSection(questions, scopePrefix, storageBucket, headingTitle) {
    let answered = 0;
    let correctCount = 0;

    const itemsHtml = questions
      .map((item, qIdx) => {
        const answerKey = `${scopePrefix}:${qIdx}`;
        const saved = state.progress[storageBucket][answerKey];
        const isMulti = Boolean(item.multiSelect && Array.isArray(item.correctIndices));
        const isSubmitted = isMulti ? Boolean(saved && saved.submitted) : Boolean(saved);

        if (isSubmitted) {
          answered += 1;
          if (saved.correct) correctCount += 1;
        }

        const selectedList = isMulti
          ? (saved && Array.isArray(saved.selectedList) ? saved.selectedList : [])
          : [];
        const correctSet = isMulti ? new Set(item.correctIndices) : null;

        const optionsHtml = (item.options || [])
          .map((opt, optIdx) => {
            if (isMulti) {
              const isSelected = selectedList.includes(optIdx);
              const isCorrectOpt = isSubmitted && isSelected && correctSet.has(optIdx);
              const isWrongOpt = isSubmitted && isSelected && !correctSet.has(optIdx);
              return `
                <button type="button"
                  class="test-option ${isSelected ? 'is-selected' : ''} ${isCorrectOpt ? 'is-correct' : ''} ${isWrongOpt ? 'is-wrong' : ''}"
                  data-action="toggle-multi-opt"
                  data-bucket="${escapeHtml(storageBucket)}"
                  data-scope="${escapeHtml(scopePrefix)}"
                  data-q-index="${qIdx}"
                  data-opt-index="${optIdx}">
                  <span class="opt-letter">${LETTERS[optIdx] || optIdx + 1}</span>
                  <span class="opt-text">${escapeHtml(stripOptionPrefix(opt))}</span>
                </button>
              `;
            }

            const isSelected = saved && saved.selected === optIdx;
            const isCorrectOpt = isSelected && saved.correct;
            const isWrongOpt = isSelected && !saved.correct;
            return `
              <button type="button"
                class="test-option ${isSelected ? 'is-selected' : ''} ${isCorrectOpt ? 'is-correct' : ''} ${isWrongOpt ? 'is-wrong' : ''}"
                data-action="answer-quiz"
                data-bucket="${escapeHtml(storageBucket)}"
                data-scope="${escapeHtml(scopePrefix)}"
                data-q-index="${qIdx}"
                data-opt-index="${optIdx}"
                data-correct-index="${escapeHtml(item.correctIndex)}"
                data-total-questions="${questions.length}">
                <span class="opt-letter">${LETTERS[optIdx] || optIdx + 1}</span>
                <span class="opt-text">${escapeHtml(stripOptionPrefix(opt))}</span>
              </button>
            `;
          })
          .join('');

        const multiCheckBtnHtml = isMulti
          ? `
            <div class="multi-quiz-actions">
              <span class="test-multi-hint">Оберіть декілька варіантів (${selectedList.length} обрано)</span>
              <button type="button"
                class="multi-quiz-check-btn"
                data-action="check-multi-quiz"
                data-bucket="${escapeHtml(storageBucket)}"
                data-scope="${escapeHtml(scopePrefix)}"
                data-q-index="${qIdx}"
                data-correct-indices="${escapeHtml(item.correctIndices.join(','))}"
                data-total-questions="${questions.length}">
                Перевірити відповідь
              </button>
            </div>
          `
          : '';

        const statusClass = isSubmitted ? (saved.correct ? 'is-correct' : 'is-wrong') : '';
        const statusText = isSubmitted
          ? saved.correct
            ? `Правильно! (+10 XP) ${item.explanation ? `— ${item.explanation}` : ''}`
            : `Спробуйте ще раз. ${item.explanation ? `Підказка: ${item.explanation}` : ''}`
          : '';

        return `
          <article class="test-question-item ${isSubmitted ? (saved.correct ? 'is-answered-correct' : 'is-answered-wrong') : ''}">
            <div class="test-q-head">
              <span class="test-q-num">${qIdx + 1}</span>
              <p class="test-q-text">${escapeHtml(item.q)}</p>
            </div>
            <div class="test-options" role="group">
              ${optionsHtml}
            </div>
            ${multiCheckBtnHtml}
            <p class="test-explanation ${statusClass}" aria-live="polite">${escapeHtml(statusText)}</p>
          </article>
        `;
      })
      .join('');

    const total = questions.length;
    const grade12 = total > 0 ? Math.round((correctCount / total) * 12) : 0;
    const feedbackText =
      answered === 0
        ? `Оберіть варіант відповіді (${total} запитань)`
        : storageBucket === 'finalAnswers'
        ? `Відповідей: ${answered}/${total} · Правильно: ${correctCount}/${total} · Оцінка: ${grade12}/12`
        : `Відповідей: ${answered}/${total} · Правильно: ${correctCount}/${total}`;

    return `
      <section class="rubric-card rubric-test" id="mini-test">
        <header class="test-header">
          <h4 class="rubric-title rubric-title-upper">${escapeHtml(headingTitle)}</h4>
          <span class="test-score-badge ${answered > 0 && correctCount === total ? 'is-complete' : ''}">
            ${escapeHtml(feedbackText)}
          </span>
        </header>
        <div class="test-questions">${itemsHtml}</div>
        <footer class="test-footer">
          <button type="button"
            class="test-reset-btn"
            data-action="reset-quiz"
            data-bucket="${escapeHtml(storageBucket)}"
            data-scope="${escapeHtml(scopePrefix)}">
            Скинути відповіді
          </button>
        </footer>
      </section>
    `;
  }

  // ---------------------------------------------------------------------------
  // View 3: Practical Work & Final Work Interactive Views
  // ---------------------------------------------------------------------------

  function renderPracticalView() {
    const gradeData = getGradeData();
    const ctx = findPracticalContext(gradeData, state.activeItemId);
    if (!ctx) {
      renderCourseMap();
      return;
    }

    const { section, work: pw } = ctx;
    state.sectionId = section.id;
    state.activeItemId = pw.id;

    const checklist = (pw.interactiveTask && pw.interactiveTask.checklist) || [];
    const checkedCount = checklist.filter(
      (_, idx) => !!state.progress.checkedSteps[`${state.grade}:${pw.id}:${idx}`]
    ).length;

    const checklistHtml = checklist
      .map((item, idx) => {
        const stepKey = `${state.grade}:${pw.id}:${idx}`;
        const isChecked = !!state.progress.checkedSteps[stepKey];
        return `
          <label class="lab-step-item ${isChecked ? 'is-checked' : ''}">
            <input type="checkbox"
              data-action="toggle-lab-step"
              data-step-key="${escapeHtml(stepKey)}"
              ${isChecked ? 'checked' : ''}>
            <span>${escapeHtml(item)}</span>
          </label>
        `;
      })
      .join('');

    const breadcrumbHtml = `
      <nav class="context-breadcrumb" aria-label="Шлях до поточного практикуму">
        <button type="button" class="breadcrumb-step" data-action="open-map">${state.grade} клас</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <button type="button" class="breadcrumb-step" data-action="open-map">Розділ ${escapeHtml(section.roman)}</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <span class="breadcrumb-step is-current">Практична робота № ${escapeHtml(pw.number)}</span>
      </nav>
    `;

    appMain.innerHTML = `
      <article class="page-canvas lab-canvas">
        ${breadcrumbHtml}

        <div class="running-header">
          <span class="running-header-line" aria-hidden="true"></span>
          <span class="running-header-text">Розділ ${escapeHtml(section.roman)} · Практикум</span>
        </div>

        <header class="lab-header is-practical">
          <span class="lab-badge">Практична робота № ${escapeHtml(pw.number)}</span>
          <h1 class="lab-title">${escapeHtml(pw.title)}</h1>
          <span class="lab-pages">с. ${escapeHtml(pw.pages || '—')}</span>
        </header>

        <section class="lab-goal-card">
          ${pw.goal ? `<p><strong>Мета:</strong> ${escapeHtml(pw.goal)}</p>` : ''}
          ${
            Array.isArray(pw.steps) && pw.steps.length > 0
              ? `<h3>Хід роботи</h3><ol class="work-steps-list">${pw.steps
                  .map((s) => `<li>${escapeHtml(s)}</li>`)
                  .join('')}</ol>`
              : ''
          }
        </section>

        ${
          pw.sheetUrl
            ? `
            <section class="lab-sheet-card">
              <header class="lab-card-header">
                <h3>Робочий шаблон Google Таблиці</h3>
                <span class="lab-progress-pill">Онлайн-таблиця</span>
              </header>
              <div class="sheet-actions-row">
                <a class="sheet-action-btn is-primary" href="${escapeHtml(pw.sheetCopyUrl || pw.sheetUrl)}" target="_blank" rel="noopener noreferrer">
                  Зробити копію таблиці ↗
                </a>
                <a class="sheet-action-btn" href="${escapeHtml(pw.sheetUrl)}" target="_blank" rel="noopener noreferrer">
                  Переглянути оригінал ↗
                </a>
                ${
                  pw.sourceLink
                    ? `<a class="sheet-action-btn" href="${escapeHtml(pw.sourceLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pw.sourceLabel || 'Джерело даних')} ↗</a>`
                    : ''
                }
                ${
                  pw.sheetEmbedUrl
                    ? `<button type="button" class="sheet-action-btn" id="lab-sheet-toggle-btn" aria-expanded="true" aria-controls="lab-sheet-embed-wrap">Сховати вбудовану таблицю</button>`
                    : ''
                }
              </div>
              ${
                Array.isArray(pw.formulas) && pw.formulas.length > 0
                  ? `
                  <div class="sheet-formulas-grid">
                    ${pw.formulas
                      .map(
                        (f) => `
                        <div class="formula-chip">
                          <span class="formula-label">${escapeHtml(f.label)}</span>
                          <code class="formula-code">${escapeHtml(f.formula)}</code>
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                `
                  : ''
              }
              ${
                pw.sheetEmbedUrl
                  ? `
                  <div class="sheet-embed-wrap" id="lab-sheet-embed-wrap">
                    <iframe class="sheet-iframe" src="${escapeHtml(pw.sheetEmbedUrl)}" title="${escapeHtml(pw.title)}" loading="lazy"></iframe>
                  </div>
                `
                  : ''
              }
            </section>
          `
            : ''
        }

        ${
          pw.formUrl
            ? `
            <section class="lab-sheet-card">
              <header class="lab-card-header">
                <h3>Вбудована форма для виконання практичної роботи</h3>
                <span class="lab-progress-pill">Google Форма</span>
              </header>
              <div class="sheet-actions-row">
                <a class="sheet-action-btn is-primary" href="${escapeHtml(pw.formUrl)}" target="_blank" rel="noopener noreferrer">
                  Відкрити Google Форму в новій вкладці ↗
                </a>
                ${
                  pw.formEmbedUrl
                    ? `<button type="button" class="sheet-action-btn" id="lab-form-toggle-btn" aria-expanded="true" aria-controls="lab-form-embed-wrap">Сховати вбудовану форму</button>`
                    : ''
                }
              </div>
              ${
                pw.formEmbedUrl
                  ? `
                  <div class="sheet-embed-wrap" id="lab-form-embed-wrap">
                    <iframe class="sheet-iframe form-iframe" src="${escapeHtml(pw.formEmbedUrl)}" title="${escapeHtml(pw.title)}" loading="lazy">Завантаження форми…</iframe>
                  </div>
                `
                  : ''
              }
            </section>
          `
            : ''
        }

        ${
          pw.interactiveTask
            ? `
            <section class="lab-checklist-card">
              <div class="lab-interactive-box">
                <header class="lab-card-header">
                  <h3>Інтерактивний чеклист виконання</h3>
                  <span class="lab-progress-pill">${checkedCount} / ${checklist.length} виконано</span>
                </header>
                ${
                  pw.interactiveTask.prompt
                    ? `<p class="lab-prompt">${escapeHtml(pw.interactiveTask.prompt)}</p>`
                    : ''
                }
                <div class="lab-checklist">${checklistHtml}</div>
                ${
                  pw.interactiveTask.sampleResult
                    ? `
                    <div class="lab-sample-actions">
                      <button type="button" class="lab-sample-btn" id="lab-sample-btn" aria-expanded="false" aria-controls="lab-sample-box">
                        Показати зразок результату
                      </button>
                    </div>
                    <div class="lab-sample-result" id="lab-sample-box" hidden>
                      <p><em class="solution-label">Очікуваний результат:</em> ${escapeHtml(
                        pw.interactiveTask.sampleResult
                      )}</p>
                    </div>
                  `
                    : ''
                }
              </div>
            </section>
          `
            : ''
        }

        <section class="paragraph-footer-nav">
          <button type="button" class="nav-step-btn" data-action="open-map">← Карта курсу</button>
          ${
            section.finalWork
              ? `<button type="button" class="nav-step-btn nav-step-primary" data-action="open-final" data-section-id="${escapeHtml(
                  section.id
                )}" data-item-id="${escapeHtml(section.finalWork.id)}">До підсумкової роботи →</button>`
              : ''
          }
        </section>
      </article>
    `;
  }

  function renderFinalView() {
    const gradeData = getGradeData();
    const ctx = findFinalContext(gradeData, state.activeItemId);
    if (!ctx) {
      renderCourseMap();
      return;
    }

    const { section, finalWork: fw } = ctx;
    state.sectionId = section.id;
    state.activeItemId = fw.id;

    const breadcrumbHtml = `
      <nav class="context-breadcrumb" aria-label="Шлях до підсумкової роботи">
        <button type="button" class="breadcrumb-step" data-action="open-map">${state.grade} клас</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <button type="button" class="breadcrumb-step" data-action="open-map">Розділ ${escapeHtml(section.roman)}</button>
        <span class="breadcrumb-sep" aria-hidden="true">→</span>
        <span class="breadcrumb-step is-current">Підсумкова робота</span>
      </nav>
    `;

    const tasksHtml =
      Array.isArray(fw.tasks) && fw.tasks.length > 0
        ? renderQuizSection(
            fw.tasks,
            `${state.grade}:${fw.id}`,
            'finalAnswers',
            'ПІДСУМКОВЕ ТЕСТУВАННЯ'
          )
        : '<p>Завдання підсумкової роботи відсутні.</p>';

    appMain.innerHTML = `
      <article class="page-canvas lab-canvas">
        ${breadcrumbHtml}

        <div class="running-header">
          <span class="running-header-line" aria-hidden="true"></span>
          <span class="running-header-text">Розділ ${escapeHtml(section.roman)} · Підсумковий контроль</span>
        </div>

        <header class="lab-header is-final">
          <span class="lab-badge">Підсумкова робота</span>
          <h1 class="lab-title">${escapeHtml(fw.title)}</h1>
          <span class="lab-pages">с. ${escapeHtml(fw.pages || '—')}</span>
        </header>

        <section class="lab-goal-card">
          <p>Перевірте свої знання за всіма темами розділу «${escapeHtml(section.title)}».</p>
        </section>

        <div class="final-tasks-list">
          ${tasksHtml}
        </div>

        <section class="paragraph-footer-nav">
          <button type="button" class="nav-step-btn" data-action="open-map">← Карта курсу</button>
        </section>
      </article>
    `;
  }

  // ---------------------------------------------------------------------------
  // View 0: Initial Grade-Selector Welcome Screen
  // ---------------------------------------------------------------------------

  function renderWelcomePortal() {
    const gradeConfigs = [
      {
        grade: 8,
        swatches: ['#58AD3A', '#3574B9'],
        fallbackDesc:
          'Гроші, платіжні картки, сімейний бюджет, банки, депозити та відповідальне користування кредитами.'
      },
      {
        grade: 9,
        swatches: ['#B02A7E', '#5E4296', '#0B6FA4'],
        fallbackDesc:
          'Небанківські фінансові установи, власна бізнес-модель, підприємництво та захист від фінансового шахрайства.'
      }
    ];

    const cardsHtml = gradeConfigs
      .map((cfg) => {
        const data = getGradeData(cfg.grade);
        const sections = (data && data.sections) || [];
        const allP = getAllParagraphs(data);
        const doneCount = allP.filter(
          (item) => !!state.progress.completedParagraphs[pKey(cfg.grade, item.paragraph.id)]
        ).length;
        const practicalCount = sections.reduce(
          (acc, s) => acc + ((s.practicalWorks && s.practicalWorks.length) || 0),
          0
        );
        const finalCount = sections.filter((s) => !!s.finalWork).length;

        const swatchesHtml = cfg.swatches
          .map(
            (hex) =>
              `<span class="welcome-swatch-dot" style="background-color: ${hex}" aria-hidden="true"></span>`
          )
          .join('');

        return `
          <article class="welcome-grade-card" data-grade-card="${cfg.grade}" tabindex="0" role="button" aria-label="Відкрити підручник ${cfg.grade} класу">
            <div class="welcome-card-banner">
              <span class="tilted-badge badge-section">${cfg.grade} клас</span>
              <div class="welcome-swatches">${swatchesHtml}</div>
            </div>
            <div class="welcome-card-body">
              <h2 class="welcome-card-title">${escapeHtml((data && data.title) || `${cfg.grade} клас`)}</h2>
              <p class="welcome-card-desc">${escapeHtml((data && data.subtitle) || cfg.fallbackDesc)}</p>
              <div class="welcome-stats">
                <span class="welcome-stat-pill">${sections.length} розділи</span>
                <span class="welcome-stat-pill">${allP.length} ${escapeHtml(getUnitLabel(data))}</span>
                ${practicalCount > 0 ? `<span class="welcome-stat-pill">${practicalCount} практ.</span>` : ''}
                ${finalCount > 0 ? `<span class="welcome-stat-pill">${finalCount} підсумк.</span>` : ''}
              </div>
              <div class="welcome-card-footer">
                <span class="welcome-progress-chip ${doneCount > 0 ? 'has-progress' : ''}">
                  ${doneCount > 0 ? `✓ Вивчено ${doneCount}/${allP.length} ${escapeHtml(getUnitLabel(data))}` : `Почати з ${escapeHtml(formatUnitBadge(1, data))}`}
                </span>
                <button type="button" class="welcome-enter-btn" data-action="enter-grade" data-grade="${cfg.grade}">
                  Відкрити підручник →
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    appMain.innerHTML = `
      <section class="welcome-portal" aria-labelledby="welcome-heading">
        <header class="welcome-header">
          <span class="welcome-kicker tilted-badge">8–9 класи · Інтерактивний підручник</span>
          <h1 id="welcome-heading" class="welcome-title">Обери свій клас, щоб відкрити інтерактивний підручник</h1>
          <p class="welcome-subtitle">
            «Підприємництво і фінансова грамотність» — теорія, практичні кейси, лабораторні роботи та миттєва перевірка знань.
          </p>
        </header>

        <div class="welcome-cards-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
  }

  // ---------------------------------------------------------------------------
  // Master Render & Navigation Actions
  // ---------------------------------------------------------------------------

  function renderApp(scrollTop = false) {
    syncThemeAttributes();
    syncTopBar();
    renderSidebar();

    if (state.view === 'welcome') {
      renderWelcomePortal();
    } else if (state.view === 'paragraph') {
      renderParagraphView();
    } else if (state.view === 'practical') {
      renderPracticalView();
    } else if (state.view === 'final') {
      renderFinalView();
    } else {
      renderCourseMap();
    }

    if (scrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    updateReadingProgress();
  }

  function resolveNavigationDirection(nextView, nextItemId) {
    if (nextView === 'map' && state.view !== 'map') return 'back';
    if (state.view === 'map' && nextView !== 'map') return 'forward';
    if (state.view === 'paragraph' && nextView === 'paragraph' && nextItemId) {
      const gradeData = getGradeData();
      const all = getAllParagraphs(gradeData);
      const oldIdx = all.findIndex((i) => String(i.paragraph.id) === String(state.activeItemId));
      const newIdx = all.findIndex((i) => String(i.paragraph.id) === String(nextItemId));
      if (oldIdx >= 0 && newIdx >= 0) {
        return newIdx < oldIdx ? 'back' : 'forward';
      }
    }
    return 'forward';
  }

  function navigateTo(view, sectionId = null, itemId = null) {
    const gradeData = getGradeData();
    const direction = resolveNavigationDirection(view, itemId);

    transitionView(direction, () => {
      state.view = view;
      if (sectionId !== null) state.sectionId = sectionId;
      if (itemId !== null) state.activeItemId = itemId;

      if (view === 'paragraph' && !state.activeItemId) {
        const ctx = findParagraphContext(gradeData, null);
        if (ctx) {
          state.sectionId = ctx.section.id;
          state.activeItemId = ctx.paragraph.id;
        }
      } else if (view === 'practical' && !state.activeItemId) {
        const ctx = findPracticalContext(gradeData, null);
        if (ctx) {
          state.sectionId = ctx.section.id;
          state.activeItemId = ctx.work.id;
        }
      } else if (view === 'final' && !state.activeItemId) {
        const ctx = findFinalContext(gradeData, null);
        if (ctx) {
          state.sectionId = ctx.section.id;
          state.activeItemId = ctx.finalWork.id;
        }
      }

      closeMobileSidebar();
      renderApp(true);
    });

    playClick();
  }

  function switchGrade(nextGrade) {
    const numericGrade = Number(nextGrade) === 9 ? 9 : 8;
    if (state.grade === numericGrade && state.view !== 'welcome') return;

    transitionView('crossfade', () => {
      state.grade = numericGrade;
      const gradeData = getGradeData(numericGrade);
      const firstSec =
        gradeData && gradeData.sections && gradeData.sections[0]
          ? gradeData.sections[0]
          : null;
      state.sectionId = firstSec ? firstSec.id : '1';
      state.view = 'map';
      state.activeItemId = null;
      closeMobileSidebar();
      renderApp(true);
    });

    playClick();
  }

  function returnToWelcome() {
    if (state.view === 'welcome') return;
    transitionView('back', () => {
      state.view = 'welcome';
      closeMobileSidebar();
      renderApp(true);
    });
    playClick();
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  if (topbarBrand) {
    topbarBrand.setAttribute('role', 'button');
    topbarBrand.setAttribute('tabindex', '0');
    topbarBrand.setAttribute('title', 'Повернутися до вибору класу');
    topbarBrand.addEventListener('click', returnToWelcome);
    topbarBrand.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        returnToWelcome();
      }
    });
  }

  gradeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchGrade(btn.dataset.gradeBtn);
    });
  });

  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode === 'map') {
        navigateTo('map', state.sectionId, null);
      } else if (mode === 'paragraph') {
        const gradeData = getGradeData();
        const sec = findSectionById(gradeData, state.sectionId);
        const firstP =
          sec && sec.topics && sec.topics[0] && sec.topics[0].paragraphs
            ? sec.topics[0].paragraphs[0]
            : null;
        const targetId =
          state.view === 'paragraph' && state.activeItemId
            ? state.activeItemId
            : firstP
            ? firstP.id
            : null;
        navigateTo('paragraph', sec ? sec.id : state.sectionId, targetId);
      } else if (mode === 'lab') {
        if (state.view === 'practical' || state.view === 'final') return;
        const gradeData = getGradeData();
        const sec = findSectionById(gradeData, state.sectionId);
        if (sec && sec.practicalWorks && sec.practicalWorks.length > 0) {
          navigateTo('practical', sec.id, sec.practicalWorks[0].id);
        } else if (sec && sec.finalWork) {
          navigateTo('final', sec.id, sec.finalWork.id);
        } else {
          navigateTo('practical', state.sectionId, null);
        }
      }
    });
  });

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', openMobileSidebar);
  }
  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      state.progress.soundEnabled = !state.progress.soundEnabled;
      saveProgress();
      syncTopBar();
      if (state.progress.soundEnabled) {
        playClick();
      }
    });
  }

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', () => {
      if (!window.confirm('Скинути весь ваш прогрес та XP у цьому підручнику?')) {
        return;
      }
      const keepSound = state.progress.soundEnabled;
      state.progress = defaultProgress();
      state.progress.soundEnabled = keepSound;
      saveProgress();
      playClick();
      renderApp(false);
    });
  }

  if (navigatorTree) {
    navigatorTree.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-nav-action]');
      if (!btn) return;
      const action = btn.dataset.navAction;
      navigateTo(action, btn.dataset.sectionId, btn.dataset.itemId);
    });
  }

  if (appMain) {
    appMain.addEventListener('click', (event) => {
      const hintBtn = event.target.closest('#case-hint-btn');
      if (hintBtn) {
        const box = document.getElementById('case-hint-box');
        if (box) {
          const isHidden = box.hasAttribute('hidden');
          if (isHidden) {
            box.removeAttribute('hidden');
            hintBtn.setAttribute('aria-expanded', 'true');
          } else {
            box.setAttribute('hidden', '');
            hintBtn.setAttribute('aria-expanded', 'false');
          }
          playClick();
        }
        return;
      }

      const revealBtn = event.target.closest('#case-reveal-btn');
      if (revealBtn) {
        const sol = document.getElementById('case-solution');
        const caseCard = document.getElementById('practical-case');
        if (sol) {
          const isHidden = sol.hasAttribute('hidden');
          if (isHidden) {
            sol.removeAttribute('hidden');
            revealBtn.setAttribute('aria-expanded', 'true');
            revealBtn.textContent = 'Сховати розв’язання';
            if (caseCard) caseCard.classList.add('is-revealed');
          } else {
            sol.setAttribute('hidden', '');
            revealBtn.setAttribute('aria-expanded', 'false');
            revealBtn.textContent = 'Показати розв’язання';
            if (caseCard) caseCard.classList.remove('is-revealed');
          }
          playClick();
        }
        return;
      }

      const sampleBtn = event.target.closest('#lab-sample-btn');
      if (sampleBtn) {
        const box = document.getElementById('lab-sample-box');
        if (box) {
          const isHidden = box.hasAttribute('hidden');
          if (isHidden) {
            box.removeAttribute('hidden');
            sampleBtn.setAttribute('aria-expanded', 'true');
            sampleBtn.textContent = 'Сховати зразок результату';
          } else {
            box.setAttribute('hidden', '');
            sampleBtn.setAttribute('aria-expanded', 'false');
            sampleBtn.textContent = 'Показати зразок результату';
          }
          playClick();
        }
        return;
      }

      const sheetToggleBtn = event.target.closest('#lab-sheet-toggle-btn');
      if (sheetToggleBtn) {
        const wrap = document.getElementById('lab-sheet-embed-wrap');
        if (wrap) {
          const isHidden = wrap.hasAttribute('hidden');
          if (isHidden) {
            wrap.removeAttribute('hidden');
            sheetToggleBtn.setAttribute('aria-expanded', 'true');
            sheetToggleBtn.textContent = 'Сховати вбудовану таблицю';
          } else {
            wrap.setAttribute('hidden', '');
            sheetToggleBtn.setAttribute('aria-expanded', 'false');
            sheetToggleBtn.textContent = 'Показати вбудовану таблицю';
          }
          playClick();
        }
        return;
      }

      const formToggleBtn = event.target.closest('#lab-form-toggle-btn');
      if (formToggleBtn) {
        const wrap = document.getElementById('lab-form-embed-wrap');
        if (wrap) {
          const isHidden = wrap.hasAttribute('hidden');
          if (isHidden) {
            wrap.removeAttribute('hidden');
            formToggleBtn.setAttribute('aria-expanded', 'true');
            formToggleBtn.textContent = 'Сховати вбудовану форму';
          } else {
            wrap.setAttribute('hidden', '');
            formToggleBtn.setAttribute('aria-expanded', 'false');
            formToggleBtn.textContent = 'Показати вбудовану форму';
          }
          playClick();
        }
        return;
      }

      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) {
        const gradeCard = event.target.closest('[data-grade-card]');
        if (gradeCard) {
          switchGrade(gradeCard.dataset.gradeCard);
        }
        return;
      }

      const action = actionEl.dataset.action;

      if (action === 'enter-grade') {
        switchGrade(actionEl.dataset.grade);
      } else if (action === 'open-map') {
        navigateTo('map', state.sectionId, null);
      } else if (action === 'open-paragraph') {
        navigateTo('paragraph', actionEl.dataset.sectionId, actionEl.dataset.itemId);
      } else if (action === 'open-practical') {
        navigateTo('practical', actionEl.dataset.sectionId, actionEl.dataset.itemId);
      } else if (action === 'open-final') {
        navigateTo('final', actionEl.dataset.sectionId, actionEl.dataset.itemId);
      } else if (action === 'toggle-paragraph-complete') {
        const key = pKey(state.grade, actionEl.dataset.paragraphId);
        const nowDone = !state.progress.completedParagraphs[key];
        state.progress.completedParagraphs[key] = nowDone;
        saveProgress();
        if (nowDone) {
          playCelebrate();
          showXpToast(20, 'Параграф вивчено!');
          spawnBurst(actionEl);
        } else {
          playClick();
        }
        renderApp(false);
      } else if (action === 'toggle-case-solved') {
        const key = actionEl.dataset.caseKey;
        const nowSolved = !state.progress.solvedCases[key];
        state.progress.solvedCases[key] = nowSolved;
        saveProgress();
        if (nowSolved) {
          playCoin();
          showXpToast(15, 'Кейс розв’язано!');
          spawnBurst(actionEl);
        } else {
          playClick();
        }
        renderApp(false);
      } else if (action === 'toggle-reflection') {
        const key = actionEl.dataset.reflectionKey;
        state.progress.reflections[key] = !state.progress.reflections[key];
        saveProgress();
        playClick();
        renderApp(false);
      } else if (action === 'toggle-term') {
        const key = actionEl.dataset.termKey;
        state.progress.masteredTerms[key] = !state.progress.masteredTerms[key];
        saveProgress();
        playClick();
        renderApp(false);
      } else if (action === 'toggle-multi-opt') {
        const bucket = actionEl.dataset.bucket;
        const scope = actionEl.dataset.scope;
        const qIdx = Number(actionEl.dataset.qIndex);
        const optIdx = Number(actionEl.dataset.optIndex);
        const answerKey = `${scope}:${qIdx}`;
        const prev = state.progress[bucket][answerKey];
        const prevList = prev && Array.isArray(prev.selectedList) ? [...prev.selectedList] : [];
        const pos = prevList.indexOf(optIdx);
        if (pos >= 0) {
          prevList.splice(pos, 1);
        } else {
          prevList.push(optIdx);
        }
        state.progress[bucket][answerKey] = {
          selectedList: prevList,
          submitted: false,
          correct: Boolean(prev && prev.correct && prev.submitted === false)
        };
        saveProgress();
        playClick();
        renderApp(false);
      } else if (action === 'check-multi-quiz') {
        const bucket = actionEl.dataset.bucket;
        const scope = actionEl.dataset.scope;
        const qIdx = Number(actionEl.dataset.qIndex);
        const totalQuestions = Number(actionEl.dataset.totalQuestions) || 0;
        const expected = String(actionEl.dataset.correctIndices || '')
          .split(',')
          .filter(Boolean)
          .map(Number)
          .sort((a, b) => a - b);
        const answerKey = `${scope}:${qIdx}`;
        const prev = state.progress[bucket][answerKey];
        const selected = (prev && Array.isArray(prev.selectedList) ? [...prev.selectedList] : []).sort(
          (a, b) => a - b
        );
        const isCorrect =
          selected.length === expected.length && selected.every((val, i) => val === expected[i]);

        state.progress[bucket][answerKey] = {
          selectedList: selected,
          submitted: true,
          correct: isCorrect
        };
        saveProgress();

        if (isCorrect && !(prev && prev.submitted && prev.correct)) {
          let allCorrect = totalQuestions > 0;
          for (let i = 0; i < totalQuestions; i += 1) {
            const ans = state.progress[bucket][`${scope}:${i}`];
            if (!ans || !ans.correct) {
              allCorrect = false;
              break;
            }
          }
          if (allCorrect) {
            playCelebrate();
            showXpToast(10, 'Усі тести виконано!');
          } else {
            playCoin();
            showXpToast(10, 'Правильна відповідь!');
          }
          spawnBurst(actionEl);
        } else {
          playClick();
        }
        renderApp(false);
      } else if (action === 'answer-quiz') {
        const bucket = actionEl.dataset.bucket;
        const scope = actionEl.dataset.scope;
        const qIdx = Number(actionEl.dataset.qIndex);
        const optIdx = Number(actionEl.dataset.optIndex);
        const correctIdx = Number(actionEl.dataset.correctIndex);
        const totalQuestions = Number(actionEl.dataset.totalQuestions) || 0;
        const answerKey = `${scope}:${qIdx}`;
        const prev = state.progress[bucket][answerKey];
        const isCorrect = optIdx === correctIdx;

        state.progress[bucket][answerKey] = {
          selected: optIdx,
          correct: isCorrect
        };
        saveProgress();

        if (isCorrect && !(prev && prev.correct)) {
          let allCorrect = totalQuestions > 0;
          for (let i = 0; i < totalQuestions; i += 1) {
            const ans = state.progress[bucket][`${scope}:${i}`];
            if (!ans || !ans.correct) {
              allCorrect = false;
              break;
            }
          }
          if (allCorrect) {
            playCelebrate();
            showXpToast(10, 'Усі тести виконано!');
          } else {
            playCoin();
            showXpToast(10, 'Правильна відповідь!');
          }
          spawnBurst(actionEl);
        } else {
          playClick();
        }
        renderApp(false);
      } else if (action === 'toggle-topic') {
        const topicId = actionEl.dataset.topicId;
        state.collapsedTopics[topicId] = !state.collapsedTopics[topicId];
        playClick();
        renderApp(false);
      } else if (action === 'toggle-unlearned') {
        state.onlyUnlearned = !state.onlyUnlearned;
        playClick();
        renderApp(false);
      } else if (action === 'toggle-collapse-all') {
        const gradeData = getGradeData();
        const allTopicIds = gradeData
          ? gradeData.sections.flatMap((s) => (s.topics || []).map((t) => t.id))
          : [];
        const hasExpanded = allTopicIds.some((id) => !state.collapsedTopics[id]);
        allTopicIds.forEach((id) => {
          state.collapsedTopics[id] = hasExpanded;
        });
        playClick();
        renderApp(false);
      } else if (action === 'clear-course-search' || action === 'clear-course-filters') {
        state.searchQuery = '';
        if (action === 'clear-course-filters') {
          state.onlyUnlearned = false;
        }
        playClick();
        renderApp(false);
      } else if (action === 'reset-quiz') {
        const bucket = actionEl.dataset.bucket;
        const scope = actionEl.dataset.scope;
        Object.keys(state.progress[bucket]).forEach((k) => {
          if (k.startsWith(`${scope}:`)) {
            delete state.progress[bucket][k];
          }
        });
        saveProgress();
        playClick();
        renderApp(false);
      }
    });

    appMain.addEventListener('input', (event) => {
      const searchInput = event.target.closest('#course-search-input');
      if (!searchInput) return;
      state.searchQuery = searchInput.value || '';
      refreshCourseSectionsOnly();
    });

    appMain.addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-action="toggle-lab-step"]');
      if (!checkbox) return;
      const key = checkbox.dataset.stepKey;
      state.progress.checkedSteps[key] = checkbox.checked;
      saveProgress();
      if (checkbox.checked) {
        playCoin();
        showXpToast(5, 'Крок практикуму!');
        spawnBurst(checkbox.closest('.lab-step-item') || checkbox);
      } else {
        playClick();
      }
      renderApp(false);
    });
  }

  window.addEventListener('scroll', updateReadingProgress, { passive: true });
  window.addEventListener('resize', updateReadingProgress, { passive: true });

  // Initial Boot
  const urlParams = new URLSearchParams(window.location.search);
  const qGrade = urlParams.get('grade');
  if (qGrade === '8' || qGrade === '9') {
    state.grade = Number(qGrade);
    state.view = 'map';
  }
  const initialGradeData = getGradeData(state.grade);
  if (initialGradeData && initialGradeData.sections && initialGradeData.sections[0]) {
    state.sectionId = initialGradeData.sections[0].id;
  }
  renderApp(false);
})();
