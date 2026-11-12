// Procedural Web Audio API Sound Engine for PC Simulator
window.PCSim = window.PCSim || {};

window.PCSim.Audio = (() => {
  let ctx = null;
  let enabled = false;
  let fanOsc = null;
  let fanGain = null;

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function startFanHum() {
    const c = ensureCtx();
    if (!c || fanOsc) return;
    fanOsc = c.createOscillator();
    fanGain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;

    fanOsc.type = 'sawtooth';
    fanOsc.frequency.value = 55;
    fanGain.gain.value = 0.008;

    fanOsc.connect(filter);
    filter.connect(fanGain);
    fanGain.connect(c.destination);
    fanOsc.start();
  }

  function stopFanHum() {
    if (fanOsc) {
      try { fanOsc.stop(); } catch (e) {}
      fanOsc.disconnect();
      fanOsc = null;
    }
    if (fanGain) {
      fanGain.disconnect();
      fanGain = null;
    }
  }

  function setEnabled(val) {
    enabled = val;
    if (enabled) {
      startFanHum();
      play('tick');
    } else {
      stopFanHum();
    }
  }

  function updateFanRpm(rpm) {
    if (!enabled || !fanOsc || !fanGain || !ctx) return;
    const norm = Math.max(0, Math.min(1, (rpm - 800) / 3000));
    fanOsc.frequency.setTargetAtTime(48 + norm * 95, ctx.currentTime, 0.15);
    fanGain.gain.setTargetAtTime(0.006 + norm * 0.022, ctx.currentTime, 0.15);
  }

  function play(type) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900 + Math.random() * 250, now);
      gain.gain.setValueAtTime(0.022, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.04);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === 'launch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.11);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'boot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'warn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.setValueAtTime(135, now + 0.08);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    }
  }

  return {
    setEnabled,
    isEnabled: () => enabled,
    updateFanRpm,
    play
  };
})();
