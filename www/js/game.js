import { ROSTER } from './characters.js';
import { Fighter } from './fighter.js';
import { AI } from './ai.js';
import { drawFighter, drawStage, POSES } from './render.js';
import { InputTracker, initKeyboard, initTouch, humanState, takeMenuPresses, readGamepadMenu, blankState, touchState } from './input.js';
import { unlockAudio, sfx, startMusic, stopMusic, settings } from './audio.js';

const W = 960, H = 540, GROUND = 470, STAGE_W = 1500, ROUND_TIME = 99;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const touchUI = document.getElementById('touch');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const save = (() => { try { return JSON.parse(localStorage.getItem('ragefighter') || '{}'); } catch { return {}; } })();
const persist = () => { try { localStorage.setItem('ragefighter', JSON.stringify(save)); } catch {} };
settings.sfx = save.sfx !== false; settings.music = save.music !== false;

const game = {
  scene: 'title', frame: 0, stageW: STAGE_W,
  mode: 'cpu', difficulty: save.difficulty || 'normal',
  projectiles: [], particles: [], texts: [],
  camX: (STAGE_W - W) / 2, shakeT: 0, hitstop: 0, freeze: 0, freezeOwner: null, slowmo: 0,
  menuIndex: 0, sel: [0, 1], selDone: [false, false],
  callout(f, name) { this.texts.push({ text: name, x: f.side === 0 ? 40 : W - 40, y: 150, side: f.side, t: 0, life: 70, color: f.ch.colors.fx }); },
  shake(n) { this.shakeT = Math.max(this.shakeT, n); },
  superFreeze(f) { this.freeze = 40; this.freezeOwner = f; },
  spawnProjectile(owner, o) {
    const sz = o.size * owner.s;
    this.projectiles.push({
      owner, x: owner.x + owner.facing * 50 * owner.s, y: o.ground ? 12 : 110 * owner.s,
      vx: owner.facing * o.speed, r: sz, dmg: o.dmg, ground: o.ground, super: o.super, life: 200, t: 0,
      color: owner.ch.colors.fx, color2: owner.ch.colors.fx2, hits: o.super ? 1 : 1,
    });
    sfx('fireball');
  },
};

// ---------------- canvas sizing ----------------
let scale = 1;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const fit = Math.min(vw / W, vh / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = fit * dpr;
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  canvas.style.width = `${Math.round(W * fit)}px`; canvas.style.height = `${Math.round(H * fit)}px`;
  document.body.classList.toggle('portrait', vh > vw && isTouch);
}
window.addEventListener('resize', resize);
resize();

initKeyboard();
initTouch(touchUI);
const unlock = () => unlockAudio();
window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); window.addEventListener('touchstart', unlock);

// ---------------- menus ----------------
const MENU = [
  { label: 'VS CPU', act: () => { game.mode = 'cpu'; toSelect(); } },
  { label: '2P VERSUS', act: () => { game.mode = 'pvp'; toSelect(); } },
  { label: 'TRAINING', act: () => { game.mode = 'training'; toSelect(); } },
  { label: () => `DIFFICULTY: ${game.difficulty.toUpperCase()}`, act: () => { const l = ['easy', 'normal', 'hard']; game.difficulty = l[(l.indexOf(game.difficulty) + 1) % 3]; save.difficulty = game.difficulty; persist(); } },
  { label: () => `MUSIC: ${settings.music ? 'ON' : 'OFF'}`, act: () => { settings.music = !settings.music; save.music = settings.music; persist(); } },
  { label: () => `SOUND: ${settings.sfx ? 'ON' : 'OFF'}`, act: () => { settings.sfx = !settings.sfx; save.sfx = settings.sfx; persist(); } },
  { label: 'HOW TO PLAY', act: () => { game.scene = 'help'; } },
];

function toSelect() {
  game.scene = 'select'; game.selDone = [false, game.mode !== 'pvp' ? false : false];
  game.sel = [save.lastPick || 0, 1];
}

// Unified menu input: keyboard edges + gamepad edges + touch buttons (edges)
let prevMenu = blankState();
let prevPadMenu = [blankState(), blankState()];
function menuInput() {
  const ev = [];
  const codes = takeMenuPresses();
  const map = { ArrowUp: ['up', 1], ArrowDown: ['down', 1], ArrowLeft: ['left', 1], ArrowRight: ['right', 1], Enter: ['ok', 0], NumpadEnter: ['ok', 1], Escape: ['back', 0], Backspace: ['back', 0],
    KeyW: ['up', 0], KeyS: ['down', 0], KeyA: ['left', 0], KeyD: ['right', 0], KeyU: ['ok', 0], KeyJ: ['ok', 0], KeyI: ['back', 0], Space: ['ok', 0], Numpad4: ['ok', 1], Digit7: ['ok', 1], Numpad5: ['back', 1], KeyP: ['pause', 0] };
  for (const c of codes) { if (map[c]) ev.push({ a: map[c][0], p: map[c][1], c }); if (c === 'Escape') ev.push({ a: 'pause', p: 0, c }); }
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  pads.slice(0, 2).forEach((gp, i) => {
    const b = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
    const s = { up: gp.axes[1] < -0.5 || b(12), down: gp.axes[1] > 0.5 || b(13), left: gp.axes[0] < -0.5 || b(14), right: gp.axes[0] > 0.5 || b(15), ok: b(0), back: b(1), pause: b(9) };
    for (const k in s) if (s[k] && !prevPadMenu[i][k]) ev.push({ a: k, p: i });
    prevPadMenu[i] = s;
  });
  const t = { up: touchState.up, down: touchState.down, left: touchState.left, right: touchState.right, ok: touchState.lp || touchState.lk, back: touchState.hp };
  for (const k in t) if (t[k] && !prevMenu[k]) ev.push({ a: k, p: 0 });
  prevMenu = t;
  return ev;
}

// Clickable regions for mouse/touch on menus
const hotspots = [];
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  for (const h of hotspots) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.fn(); break; }
});

// ---------------- match control ----------------
let P = [], trackers = [], ai = null, match = null;

function startMatch() {
  const c1 = ROSTER[game.sel[0]], c2 = ROSTER[game.sel[1]];
  P = [new Fighter(c1, 0, game), new Fighter(c2, 1, game)];
  trackers = [new InputTracker(), new InputTracker()];
  ai = game.mode === 'cpu' ? new AI(game.difficulty) : null;
  match = { round: 1, wins: [0, 0], timer: ROUND_TIME, timerF: 0, phase: 'intro', phaseT: 0, stage: c2.stage, winner: -1, perfect: false };
  game.scene = 'fight';
  startRound();
  startMusic(game.mode === 'training' ? 120 : 152);
}

function startRound() {
  P.forEach((f, i) => { f.reset(i); f.state = 'intro'; if (game.mode === 'training') f.meter = 100; });
  game.projectiles = []; game.particles = []; game.texts = [];
  game.camX = (STAGE_W - W) / 2;
  match.timer = ROUND_TIME; match.timerF = 0; match.phase = 'intro'; match.phaseT = 0;
  sfx('round');
}

function endRound(winner, reason) {
  match.phase = 'ko'; match.phaseT = 0; match.reason = reason; match.roundWinner = winner;
  if (winner >= 0) { match.wins[winner]++; match.perfect = P[winner].health === P[winner].maxHealth; }
  game.slowmo = reason === 'ko' ? 60 : 0;
  if (reason === 'ko') sfx('ko');
}

// ---------------- combat ----------------
const overlap = (a, b) => a && b && a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

function spark(x, y, color, n = 12, big = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (big ? 6 : 4) * (0.4 + Math.random());
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + Math.random() * 10, t: 0, color, size: big ? 5 : 3 });
  }
  game.particles.push({ ring: true, x, y, t: 0, life: 12, color, size: big ? 50 : 30 });
}

function resolveHit(att, def, info, where) {
  const res = def.takeHit(att, info);
  att.onHitConfirm();
  const sy = GROUND - where;
  const sx = (Math.max(att.x, def.x) + Math.min(att.x, def.x)) / 2 + def.facing * -10;
  if (res === 'block') { sfx('block'); spark(def.x - def.facing * -20, sy, '#bfe3ff', 6); game.hitstop = 5; }
  else {
    const heavy = info.dmg >= 90;
    sfx(heavy ? 'hitH' : 'hitL'); spark(def.x - (def.x - att.x) * 0.3, sy, heavy ? '#fff2a8' : '#ffffff', heavy ? 18 : 10, heavy);
    game.hitstop = heavy ? 10 : 6; if (heavy) game.shake(5);
    if (def.combo >= 2) game.texts.push({ text: `${def.combo} HITS`, x: att.side === 0 ? 40 : W - 40, y: 200, side: att.side, t: 0, life: 60, color: '#ffe066', combo: true });
  }
  void sx;
}

function combat() {
  for (let i = 0; i < 2; i++) {
    const a = P[i], d = P[1 - i];
    if (d.invuln > 0 && !(a.special && a.special.kind === 'super')) { /* invulnerable */ }
    const hb = a.hitbox();
    const hurt = d.hurtbox();
    if (hb && d.invuln <= 0 && overlap(hb, hurt)) {
      const m = a.move, mul = a.ch.dmgMul || 1;
      resolveHit(a, d, { dmg: Math.round(m.dmg * 10 * mul), hitstun: m.hitstun, blockstun: m.blockstun, push: m.push, height: m.height, knockdown: m.knockdown || (m.antiAir && !d.grounded) }, (hb.y1 + hb.y2) / 2);
    }
    if (a.activeBox && !a.hasHit && d.invuln <= 0 && overlap(a.activeBox, hurt)) {
      const sp = a.special, mul = a.ch.dmgMul || 1;
      const dmg = Math.round(sp.data.dmg * 10 * mul * (sp.heavy ? 1.1 : 1));
      resolveHit(a, d, { dmg, hitstun: 24, blockstun: 16, push: 9, height: 'mid', knockdown: true, chip: true, launch: sp.kind === 'rising' ? 10 : 7 }, (a.activeBox.y1 + a.activeBox.y2) / 2);
    }
  }
  // projectiles
  for (const p of game.projectiles) {
    p.t++; p.x += p.vx; p.life--;
    if (p.x < game.camX - 80 || p.x > game.camX + W + 80) p.life = 0;
    const def = P[1 - p.owner.side];
    const hurt = def.hurtbox();
    const box = { x1: p.x - p.r, x2: p.x + p.r, y1: p.y - p.r, y2: p.y + p.r };
    if (p.life > 0 && hurt && def.invuln <= 0 && overlap(box, hurt)) {
      const mul = p.owner.ch.dmgMul || 1;
      resolveHit(p.owner, def, { dmg: Math.round(p.dmg * 10 * mul), hitstun: 20, blockstun: 14, push: 8, height: p.ground ? 'low' : 'mid', knockdown: !!p.super, chip: true, launch: 9 }, p.y);
      p.life = 0;
    }
  }
  // projectile vs projectile
  for (const a of game.projectiles) for (const b of game.projectiles) {
    if (a !== b && a.owner !== b.owner && a.life > 0 && b.life > 0 && Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.y - b.y) < a.r + b.r) {
      if (a.super && !b.super) b.life = 0; else if (b.super && !a.super) a.life = 0; else { a.life = 0; b.life = 0; }
      spark((a.x + b.x) / 2, GROUND - a.y, '#fff', 14, true); sfx('block');
    }
  }
  game.projectiles = game.projectiles.filter((p) => p.life > 0);
}

function pushApart() {
  const [a, b] = P;
  const wa = 22 * a.s, wb = 22 * b.s;
  const minD = wa + wb;
  const vert = Math.abs(a.y - b.y) < 90;
  if (vert && a.state !== 'down' && b.state !== 'down' && a.state !== 'ko' && b.state !== 'ko') {
    const dx = b.x - a.x;
    if (Math.abs(dx) < minD) {
      const push = (minD - Math.abs(dx)) / 2;
      const dir = dx === 0 ? (a.facing) : Math.sign(dx);
      a.x -= dir * push; b.x += dir * push;
    }
  }
  // camera & bounds
  const mid = (a.x + b.x) / 2;
  const target = Math.max(0, Math.min(STAGE_W - W, mid - W / 2));
  game.camX += (target - game.camX) * 0.15;
  for (const f of P) {
    const lo = Math.max(30, game.camX + 36), hi = Math.min(STAGE_W - 30, game.camX + W - 36);
    if (f.x < lo) { f.x = lo; if (f.state === 'hit' || f.state === 'block') P[1 - f.side].x += 2 * P[1 - f.side].facing * -1; }
    if (f.x > hi) { f.x = hi; if (f.state === 'hit' || f.state === 'block') P[1 - f.side].x -= 2 * P[1 - f.side].facing; }
  }
}

// ---------------- update ----------------
function updateFight() {
  const m = match;
  m.phaseT++;
  // inputs
  const states = [
    humanState(0, isTouch),
    game.mode === 'pvp' ? humanState(1, false) : game.mode === 'cpu' && m.phase === 'fight' ? ai.think(P[1], P[0], game) : blankState(),
  ];
  for (let i = 0; i < 2; i++) trackers[i].update(states[i], P[i].facing);

  if (m.phase === 'intro') {
    if (m.phaseT === 70) sfx('fight');
    if (m.phaseT >= 100) { m.phase = 'fight'; P.forEach((f) => f.setState('stand')); }
  }
  if (game.freeze > 0) { game.freeze--; return; }
  if (game.hitstop > 0) { game.hitstop--; return; }
  if (game.slowmo > 0) { game.slowmo--; if (game.slowmo % 3) return; }

  for (let i = 0; i < 2; i++) P[i].update(trackers[i], P[1 - i]);
  if (m.phase === 'fight' || m.phase === 'ko') combat();
  pushApart();
  for (const f of P) f.displayHealth += (f.health - f.displayHealth) * (f.state === 'hit' || f.state === 'air' ? 0.02 : 0.08);

  if (game.mode === 'training') {
    for (const f of P) if (f.neutral && f.t > 60) { f.health = Math.min(f.maxHealth, f.health + 20); f.meter = 100; }
  }

  if (m.phase === 'fight') {
    if (game.mode !== 'training' && ++m.timerF >= 60) { m.timerF = 0; m.timer--; }
    const dead = P.map((f) => f.health <= 0);
    if (dead[0] || dead[1]) endRound(dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0, 'ko');
    else if (m.timer <= 0) {
      const r = P[0].health / P[0].maxHealth, r2 = P[1].health / P[1].maxHealth;
      endRound(r === r2 ? -1 : r > r2 ? 0 : 1, 'time');
      P.forEach((f) => { if (f.neutral) f.setState('stand'); });
    }
  } else if (m.phase === 'ko') {
    const settled = P.every((f) => !['air', 'down', 'hit', 'attack', 'special', 'jump', 'jattack', 'block', 'land', 'getup'].includes(f.state));
    if (m.phaseT > 90 && settled && m.roundWinner >= 0 && P[m.roundWinner].state !== 'win') P[m.roundWinner].setState('win');
    if (m.phaseT > 260) {
      if (m.wins[0] >= 2 || m.wins[1] >= 2) {
        m.winner = m.wins[0] >= 2 ? 0 : 1; game.scene = 'results'; game.resultT = 0; stopMusic(); sfx('confirm');
        if (game.mode === 'cpu' && m.winner === 0) { save.wins = (save.wins || 0) + 1; persist(); }
      } else { m.round++; startRound(); }
    }
  }
  // particles & texts
  for (const p of game.particles) { p.t++; if (!p.ring) { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.vx *= 0.95; } }
  game.particles = game.particles.filter((p) => p.t < p.life);
  for (const t of game.texts) t.t++;
  game.texts = game.texts.filter((t) => t.t < t.life);
  if (game.shakeT > 0) game.shakeT--;
}

let paused = false;
function update() {
  game.frame++;
  const ev = menuInput();
  if (game.scene === 'title') {
    for (const e of ev) {
      if (e.a === 'up') { game.menuIndex = (game.menuIndex + MENU.length - 1) % MENU.length; sfx('select'); }
      if (e.a === 'down') { game.menuIndex = (game.menuIndex + 1) % MENU.length; sfx('select'); }
      if (e.a === 'ok') { sfx('confirm'); MENU[game.menuIndex].act(); }
    }
  } else if (game.scene === 'help') {
    if (ev.some((e) => e.a === 'ok' || e.a === 'back')) game.scene = 'title';
  } else if (game.scene === 'select') {
    for (const e of ev) {
      const p = game.mode === 'pvp' ? e.p : (game.selDone[0] ? 1 : 0);
      if (p > 1) continue;
      if (e.a === 'back') { if (game.selDone[p]) game.selDone[p] = false; else if (p === 1 && game.selDone[0]) game.selDone[0] = false; else game.scene = 'title'; sfx('select'); continue; }
      if (game.selDone[p]) continue;
      if (e.a === 'left') { game.sel[p] = (game.sel[p] + ROSTER.length - 1) % ROSTER.length; sfx('select'); }
      if (e.a === 'right') { game.sel[p] = (game.sel[p] + 1) % ROSTER.length; sfx('select'); }
      if (e.a === 'ok') { game.selDone[p] = true; sfx('confirm'); if (p === 0) { save.lastPick = game.sel[0]; persist(); } }
    }
    if (game.mode !== 'pvp' && game.selDone[0] && !game.selDone[1] && !game.cpuPicking) {
      // CPU picks a random opponent with a short roulette
      game.cpuPicking = 40;
    }
    if (game.cpuPicking) {
      game.cpuPicking--;
      if (game.cpuPicking % 5 === 0) { game.sel[1] = Math.floor(Math.random() * ROSTER.length); sfx('select'); }
      if (game.cpuPicking === 0) { if (game.sel[1] === game.sel[0]) game.sel[1] = (game.sel[0] + 1 + Math.floor(Math.random() * 3)) % 4; game.selDone[1] = true; sfx('confirm'); }
    }
    if (game.selDone[0] && game.selDone[1]) { game.selT = (game.selT || 0) + 1; if (game.selT > 50) { game.selT = 0; game.cpuPicking = 0; startMatch(); } }
  } else if (game.scene === 'fight') {
    if (ev.some((e) => e.a === 'pause')) { paused = !paused; sfx('select'); }
    if (paused) {
      for (const e of ev) if (e.a === 'ok') { paused = false; }
      return;
    }
    updateFight();
  } else if (game.scene === 'results') {
    game.resultT++;
    if (game.resultT > 60 && ev.some((e) => e.a === 'ok')) { game.scene = 'select'; game.selDone = [false, false]; }
    if (game.resultT > 60 && ev.some((e) => e.a === 'back')) game.scene = 'title';
  }
}

// ---------------- drawing ----------------
function text(str, x, y, size, color = '#fff', align = 'center', stroke = true) {
  ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = '#0d0d14'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

function drawProjectile(p) {
  const x = p.x - game.camX, y = GROUND - p.y;
  ctx.save();
  if (p.ground) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? p.color2 : p.color;
      const hgt = p.r * (1.6 - i * 0.3) * (1 + Math.sin(p.t / 2 + i) * 0.15);
      ctx.beginPath(); ctx.moveTo(x - p.vx * i * 2 - 14, GROUND); ctx.lineTo(x - p.vx * i * 2, GROUND - hgt); ctx.lineTo(x - p.vx * i * 2 + 14, GROUND); ctx.fill();
    }
  } else {
    ctx.shadowColor = p.color; ctx.shadowBlur = p.super ? 40 : 20;
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x - p.vx * i * 1.6, y, p.r * (1 - i * 0.12), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x, y, p.r * (1 + Math.sin(p.t / 3) * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color2; ctx.beginPath(); ctx.arc(x + p.vx * 0.6, y, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
    if (p.owner.ch.id === 'volta') { // lightning crackle
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - p.r, y);
      for (let i = 0; i < 6; i++) ctx.lineTo(x - p.r + (i * p.r) / 2.5, y + (Math.random() - 0.5) * p.r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHUD() {
  const m = match;
  const barW = 380, barH = 24, top = 22;
  for (let i = 0; i < 2; i++) {
    const f = P[i], left = i === 0;
    const x = left ? 40 : W - 40 - barW;
    ctx.fillStyle = '#0d0d14'; ctx.fillRect(x - 4, top - 4, barW + 8, barH + 8);
    ctx.fillStyle = '#5a0f12'; ctx.fillRect(x, top, barW, barH);
    const dw = (f.displayHealth / f.maxHealth) * barW, hw = (f.health / f.maxHealth) * barW;
    ctx.fillStyle = '#ff3b3b';
    if (left) ctx.fillRect(x + barW - dw, top, dw, barH); else ctx.fillRect(x, top, dw, barH);
    const g = ctx.createLinearGradient(0, top, 0, top + barH);
    const low = f.health / f.maxHealth < 0.25;
    g.addColorStop(0, low ? '#ff9d4a' : '#ffe14a'); g.addColorStop(1, low ? '#e04a1b' : '#f2a516');
    ctx.fillStyle = g;
    if (left) ctx.fillRect(x + barW - hw, top, hw, barH); else ctx.fillRect(x, top, hw, barH);
    text(f.ch.name, left ? x : x + barW, top + barH + 18, 20, '#fff', left ? 'left' : 'right');
    // round wins
    for (let r = 0; r < 2; r++) {
      const cx = left ? x + barW - 14 - r * 24 : x + 14 + r * 24;
      ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.arc(cx, top + barH + 18, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = m.wins[i] > r ? '#ffd23f' : '#333'; ctx.beginPath(); ctx.arc(cx, top + barH + 18, 6, 0, Math.PI * 2); ctx.fill();
    }
    // rage meter
    const mw = 220, mx = left ? 40 : W - 40 - mw, my = H - 34;
    ctx.fillStyle = '#0d0d14'; ctx.fillRect(mx - 3, my - 3, mw + 6, 18);
    ctx.fillStyle = '#201a33'; ctx.fillRect(mx, my, mw, 12);
    const full = f.meter >= 100;
    ctx.fillStyle = full ? `hsl(${(game.frame * 8) % 360},100%,60%)` : '#6c5cff';
    const fw = (f.meter / 100) * mw;
    if (left) ctx.fillRect(mx, my, fw, 12); else ctx.fillRect(mx + mw - fw, my, fw, 12);
    text(full ? 'RAGE READY!' : 'RAGE', left ? mx : mx + mw, my - 12, 13, full ? '#fff' : '#aaa', left ? 'left' : 'right');
  }
  // timer
  ctx.fillStyle = '#0d0d14'; ctx.fillRect(W / 2 - 34, 12, 68, 52);
  text(game.mode === 'training' ? '∞' : String(Math.max(0, m.timer)).padStart(2, '0'), W / 2, 40, 38, m.timer <= 10 ? '#ff5050' : '#fff');
}

function drawTexts() {
  for (const t of game.texts) {
    const a = Math.min(1, (t.life - t.t) / 15);
    ctx.globalAlpha = a;
    text(t.text, t.x + (t.side === 0 ? 1 : -1) * Math.min(0, -40 + t.t * 6), t.y, t.combo ? 30 : 22, t.color, t.side === 0 ? 'left' : 'right');
    ctx.globalAlpha = 1;
  }
}

function drawFightScene() {
  const m = match;
  ctx.save();
  if (game.shakeT > 0) ctx.translate((Math.random() - 0.5) * game.shakeT * 2, (Math.random() - 0.5) * game.shakeT * 2);
  drawStage(ctx, m.stage, game.camX, W, H, GROUND, game.frame);
  if (game.freeze > 0) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); }
  // shadows
  for (const f of P) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(f.x - game.camX, GROUND + 4, 40 * f.s * Math.max(0.4, 1 - f.y / 300), 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  // draw the attacking fighter on top
  const order = [...P].sort((a, b) => (a.state === 'attack' || a.state === 'special' ? 1 : 0) - (b.state === 'attack' || b.state === 'special' ? 1 : 0));
  for (const f of order) {
    if (f.invuln > 0 && f.state === 'getup' && game.frame % 4 < 2) continue;
    if (game.freeze > 0 && game.freezeOwner === f) {
      ctx.save(); ctx.shadowColor = f.ch.colors.fx; ctx.shadowBlur = 30;
      drawFighter(ctx, f.ch, f.pose, f.x - game.camX, GROUND - f.y, f.facing, { t: game.frame });
      ctx.restore();
    } else drawFighter(ctx, f.ch, f.pose, f.x - game.camX, GROUND - f.y, f.facing, { flash: f.flash > 0, t: game.frame });
  }
  for (const p of game.projectiles) drawProjectile(p);
  for (const p of game.particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x - game.camX, p.y, p.size * (p.t / p.life) + 6, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = p.color; ctx.fillRect(p.x - game.camX - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (game.freeze > 30) { ctx.fillStyle = `rgba(255,255,255,${(game.freeze - 30) / 10})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  drawTexts();

  // announcements
  if (m.phase === 'intro') {
    if (m.phaseT < 70) text(`ROUND ${m.round}`, W / 2, H / 2 - 40, 72, '#fff');
    else text('FIGHT!', W / 2, H / 2 - 40, 96 + (m.phaseT - 70), '#ffd23f');
  } else if (m.phase === 'ko' && m.phaseT < 240) {
    const label = m.reason === 'ko' ? 'K.O.' : 'TIME';
    if (m.phaseT < 120) text(label, W / 2, H / 2 - 40, 110, m.reason === 'ko' ? '#ff3b3b' : '#ffd23f');
    else if (m.roundWinner >= 0) {
      text(`${P[m.roundWinner].ch.name} WINS`, W / 2, H / 2 - 50, 64, '#fff');
      if (m.perfect) text('PERFECT!', W / 2, H / 2 + 20, 48, '#ffd23f');
    } else text('DRAW', W / 2, H / 2 - 40, 72, '#fff');
  }
  if (game.mode === 'training') text('TRAINING', W / 2, 122, 14, '#aaa');
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, H / 2 - 60, 64);
    text('RESUME', W / 2, H / 2 + 10, 28, '#ffd23f');
    text('QUIT TO MENU', W / 2, H / 2 + 60, 28, '#fff');
    hotspots.push({ x: W / 2 - 120, y: H / 2 - 10, w: 240, h: 40, fn: () => { paused = false; } });
    hotspots.push({ x: W / 2 - 140, y: H / 2 + 40, w: 280, h: 40, fn: () => { paused = false; stopMusic(); game.scene = 'title'; } });
  }
}

function drawLogo(y) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 40);
  g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff7a1a'); g.addColorStop(1, '#c4231b');
  ctx.font = '900 96px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 14; ctx.strokeStyle = '#0d0d14'; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(W / 2, y); ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.strokeText('RAGEFIGHTER', 0, 0); ctx.fillStyle = g; ctx.fillText('RAGEFIGHTER', 0, 0);
  ctx.restore(); ctx.restore();
}

function drawTitle() {
  drawStage(ctx, Math.floor(game.frame / 600) % 2 ? 'temple' : 'harbor', (Math.sin(game.frame / 300) + 1) * 270, W, H, GROUND, game.frame);
  ctx.fillStyle = 'rgba(8,6,20,0.55)'; ctx.fillRect(0, 0, W, H);
  // show two fighters
  const a = ROSTER[Math.floor(game.frame / 240) % 4], b = ROSTER[(Math.floor(game.frame / 240) + 2) % 4];
  drawFighter(ctx, a, Math.floor(game.frame / 20) % 2 ? POSES.idle : POSES.idle2, 170, GROUND, 1, { t: game.frame });
  drawFighter(ctx, b, Math.floor(game.frame / 20) % 2 ? POSES.idle2 : POSES.idle, W - 170, GROUND, -1, { t: game.frame });
  drawLogo(110);
  text('AN ORIGINAL ARCADE FIGHTER', W / 2, 172, 16, '#ffd9a8');
  MENU.forEach((it, i) => {
    const y = 225 + i * 38, sel = i === game.menuIndex;
    const label = typeof it.label === 'function' ? it.label() : it.label;
    if (sel) { ctx.fillStyle = 'rgba(255,122,26,0.25)'; ctx.fillRect(W / 2 - 180, y - 17, 360, 34); }
    text((sel ? '▶ ' : '') + label, W / 2, y, sel ? 26 : 22, sel ? '#ffd23f' : '#fff');
    hotspots.push({ x: W / 2 - 180, y: y - 17, w: 360, h: 34, fn: () => { game.menuIndex = i; sfx('confirm'); unlockAudio(); it.act(); } });
  });
  if (save.wins) text(`CPU WINS: ${save.wins}`, W - 20, H - 20, 14, '#aaa', 'right');
  text(isTouch ? 'TAP TO SELECT' : 'ARROWS/WASD + ENTER', 20, H - 20, 14, '#aaa', 'left');
}

function drawHelp() {
  ctx.fillStyle = '#120c24'; ctx.fillRect(0, 0, W, H);
  text('HOW TO PLAY', W / 2, 50, 44, '#ffd23f');
  const lines = [
    ['MOVE', 'P1: W A S D    P2: Arrow keys    Touch: left stick'],
    ['ATTACK', 'P1: U light punch, I heavy punch, J light kick, K heavy kick, L rage'],
    ['', 'P2: Numpad 4 5 1 2 (or 7 8 9 0), Numpad 6 rage    Gamepads supported'],
    ['BLOCK', 'Hold BACK. Crouch-block lows, stand-block jump attacks.'],
    ['PROJECTILE', 'Down, Down-Forward, Forward + Punch'],
    ['RISING', 'Forward, Down, Down-Forward + Punch  (anti-air, briefly invincible)'],
    ['RUSH', 'Down, Down-Back, Back + Kick'],
    ['RAGE', 'When the meter is full: Rage button (or Heavy Punch + Heavy Kick)'],
    ['COMBOS', 'Cancel normals into specials on contact. Chain light attacks.'],
    ['PAUSE', 'Esc / P / Start'],
  ];
  lines.forEach(([k, v], i) => { text(k, 150, 110 + i * 38, 18, '#ff9a3c', 'right', false); text(v, 170, 110 + i * 38, 17, '#fff', 'left', false); });
  text('PRESS ENTER / TAP', W / 2, H - 30, 20, '#aaa');
  hotspots.push({ x: 0, y: 0, w: W, h: H, fn: () => { game.scene = 'title'; } });
}

function drawSelect() {
  drawStage(ctx, 'harbor', game.frame * 0.5 % 600, W, H, GROUND, game.frame);
  ctx.fillStyle = 'rgba(8,6,20,0.75)'; ctx.fillRect(0, 0, W, H);
  text('CHOOSE YOUR FIGHTER', W / 2, 40, 40, '#ffd23f');
  const cw = 150, gap = 18, x0 = W / 2 - (ROSTER.length * cw + (ROSTER.length - 1) * gap) / 2, y0 = 300;
  ROSTER.forEach((ch, i) => {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = '#1c1433'; ctx.fillRect(x, y0, cw, 150);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, cw, 150); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 150); g.addColorStop(0, ch.colors.top); g.addColorStop(1, '#0d0d14');
    ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.fillRect(x, y0, cw, 150); ctx.globalAlpha = 1;
    drawFighter(ctx, ch, POSES.idle, x + cw / 2, y0 + 210, 1, { t: game.frame });
    ctx.restore();
    text(ch.name, x + cw / 2, y0 + 138, 20);
    for (let p = 0; p < 2; p++) {
      if (game.sel[p] === i && (p === 0 || game.mode === 'pvp' || game.selDone[0])) {
        ctx.strokeStyle = p === 0 ? '#3fa9ff' : '#ff4f4f'; ctx.lineWidth = game.selDone[p] ? 6 : 3 + Math.sin(game.frame / 5) * 1.5;
        ctx.strokeRect(x - 4 - p * 5, y0 - 4 - p * 5, cw + 8 + p * 10, 158 + p * 10);
        text(p === 0 ? '1P' : game.mode === 'pvp' ? '2P' : 'CPU', x + (p === 0 ? 18 : cw - 22), y0 - 14 - p * 5, 16, p === 0 ? '#3fa9ff' : '#ff4f4f');
      }
    }
    hotspots.push({ x, y: y0, w: cw, h: 150, fn: () => {
      const p = game.mode === 'pvp' ? (game.selDone[0] ? 1 : 0) : 0;
      if (game.selDone[p]) return;
      if (game.sel[p] === i) { game.selDone[p] = true; sfx('confirm'); if (p === 0) { save.lastPick = i; persist(); } }
      else { game.sel[p] = i; sfx('select'); }
    } });
  });
  // big previews
  for (let p = 0; p < 2; p++) {
    if (p === 1 && game.mode !== 'pvp' && !game.selDone[0]) continue;
    const ch = ROSTER[game.sel[p]];
    const px = p === 0 ? 150 : W - 150;
    drawFighter(ctx, ch, game.selDone[p] ? POSES.win : (Math.floor(game.frame / 20) % 2 ? POSES.idle : POSES.idle2), px, 238, p === 0 ? 1 : -1, { t: game.frame });
    text(ch.name, px, 262, 26, p === 0 ? '#3fa9ff' : '#ff4f4f');
    text(ch.title, px, 284, 13, '#ffd9a8');
  }
  const cur = ROSTER[game.sel[game.selDone[0] && game.mode === 'pvp' ? 1 : 0]];
  text(cur.blurb, W / 2, 255, 15, '#ddd', 'center', false);
  const sp = cur.specials;
  text(`${sp.projectile.name} · ${sp.rising.name} · ${sp.rush.name} · ${sp.super.name}`, W / 2, 278, 13, '#ff9a3c', 'center', false);
  text(isTouch ? 'TAP TWICE TO PICK' : 'LEFT/RIGHT + ENTER    ESC: BACK', W / 2, H - 22, 15, '#aaa');
  if (game.selDone[0] && game.selDone[1]) text('GET READY!', W / 2, 180, 50, '#fff');
}

function drawResults() {
  drawFightScene();
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  const w = P[match.winner];
  const who = game.mode === 'cpu' ? (match.winner === 0 ? 'YOU WIN!' : 'YOU LOSE') : `PLAYER ${match.winner + 1} WINS!`;
  text(who, W / 2, 110, 72, match.winner === 0 || game.mode !== 'cpu' ? '#ffd23f' : '#ff5050');
  drawFighter(ctx, w.ch, POSES.win, W / 2, 400, 1, { t: game.frame });
  text(`${w.ch.name} — ${w.ch.title}`, W / 2, 430, 24);
  if (game.resultT > 60) {
    text('REMATCH / CHANGE FIGHTER', W / 2, 475, 22, '#fff');
    text('MAIN MENU', W / 2, 510, 18, '#aaa');
    hotspots.push({ x: W / 2 - 200, y: 458, w: 400, h: 34, fn: () => { game.scene = 'select'; game.selDone = [false, false]; } });
    hotspots.push({ x: W / 2 - 120, y: 496, w: 240, h: 30, fn: () => { game.scene = 'title'; } });
  }
}

function draw() {
  hotspots.length = 0;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (game.scene === 'title') drawTitle();
  else if (game.scene === 'help') drawHelp();
  else if (game.scene === 'select') drawSelect();
  else if (game.scene === 'fight') drawFightScene();
  else if (game.scene === 'results') drawResults();
  touchUI.classList.toggle('show', isTouch && game.scene === 'fight');
  document.body.classList.toggle('fighting', game.scene === 'fight');
}

document.getElementById('pauseBtn').addEventListener('click', () => { if (game.scene === 'fight') paused = !paused; });

// fixed timestep loop
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// expose for debugging/tests
window.__rf = { game, get P() { return P; }, get match() { return match; } };
