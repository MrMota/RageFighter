// Fully synthesized sound effects and music (no audio files).
let ctx = null, master = null, musicGain = null, sfxGain = null;
let musicTimer = null, step = 0;
export const settings = { sfx: true, music: true };

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
}

function noiseBuffer(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function tone(type, f0, f1, dur, vol, dest = sfxGain, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq = 1200, q = 1, dest = sfxGain, when = 0) {
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t);
}

export function sfx(name) {
  if (!ctx || !settings.sfx) return;
  switch (name) {
    case 'whiff': noise(0.09, 0.25, 2500, 0.8); break;
    case 'hitL': noise(0.08, 0.6, 1400, 1.2); tone('square', 220, 70, 0.08, 0.25); break;
    case 'hitH': noise(0.16, 0.9, 900, 1); tone('square', 160, 40, 0.18, 0.4); break;
    case 'block': tone('triangle', 900, 500, 0.06, 0.3); noise(0.05, 0.3, 3000, 3); break;
    case 'jump': tone('sine', 300, 600, 0.12, 0.12); break;
    case 'land': noise(0.06, 0.2, 400, 1); break;
    case 'fireball': tone('sawtooth', 500, 120, 0.35, 0.22); noise(0.3, 0.3, 700, 0.7); break;
    case 'special': tone('sawtooth', 200, 800, 0.2, 0.2); break;
    case 'super': tone('sawtooth', 100, 1200, 0.6, 0.3); tone('square', 50, 400, 0.6, 0.2); break;
    case 'ko': tone('sawtooth', 300, 40, 1.2, 0.4); noise(0.8, 0.5, 300, 0.5); break;
    case 'select': tone('square', 660, 880, 0.07, 0.15); break;
    case 'confirm': tone('square', 523, 523, 0.08, 0.15); tone('square', 784, 784, 0.12, 0.15, sfxGain, 0.08); break;
    case 'round': tone('square', 392, 392, 0.12, 0.2); tone('square', 523, 523, 0.2, 0.2, sfxGain, 0.13); break;
    case 'fight': tone('sawtooth', 262, 523, 0.3, 0.25); noise(0.3, 0.3, 1500, 0.5); break;
    case 'knockdown': noise(0.25, 0.6, 250, 0.8); tone('sine', 120, 40, 0.25, 0.4); break;
  }
}

// Simple procedural battle loop: bass + drums + arpeggio, original composition.
const BASS = [40, 40, 52, 40, 43, 43, 55, 43, 38, 38, 50, 38, 45, 45, 57, 47];
const ARP = [64, 67, 71, 67, 62, 67, 71, 74, 64, 67, 69, 72, 69, 66, 69, 71];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function startMusic(tempo = 150) {
  stopMusic();
  if (!ctx) return;
  const stepDur = 60 / tempo / 2;
  step = 0;
  musicTimer = setInterval(() => {
    if (!settings.music || ctx.state !== 'running') { step++; return; }
    const i = step % 32, bar = Math.floor(step / 32) % 4;
    const b = BASS[Math.floor(i / 2) % 16] + (bar === 3 ? 2 : 0);
    if (i % 2 === 0) tone('sawtooth', midi(b), midi(b), stepDur * 0.9, 0.5, musicGain);
    if (i % 8 === 0) tone('sine', 120, 40, 0.18, 0.9, musicGain);
    if (i % 8 === 4) noise(0.12, 0.5, 1800, 0.6, musicGain);
    if (i % 2 === 1) noise(0.03, 0.15, 7000, 1, musicGain);
    if (bar >= 2) tone('square', midi(ARP[i % 16] + 12), midi(ARP[i % 16] + 12), stepDur * 0.5, 0.12, musicGain);
    step++;
  }, stepDur * 1000);
}

export function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
