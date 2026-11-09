// Input sources (keyboard, gamepad, touch) feeding a per-player button state,
// plus a history buffer used for motion-input special detection.

export const BUTTONS = ['lp', 'hp', 'lk', 'hk', 'rage'];

const KEYMAPS = [
  { // Player 1
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyU: 'lp', KeyI: 'hp', KeyJ: 'lk', KeyK: 'hk', KeyL: 'rage',
    Space: 'up',
  },
  { // Player 2
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Numpad4: 'lp', Numpad5: 'hp', Numpad1: 'lk', Numpad2: 'hk', Numpad6: 'rage',
    Digit7: 'lp', Digit8: 'hp', Digit9: 'lk', Digit0: 'hk', Minus: 'rage',
  },
];

const keysDown = new Set();
const taps = new Set(); // keys pressed and released between frames still count once
const menuPresses = [];

export function blankState() {
  return { up: false, down: false, left: false, right: false, lp: false, hp: false, lk: false, hk: false, rage: false };
}

export const touchState = blankState();
export let touchActive = false;

export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) menuPresses.push(e.code);
    keysDown.add(e.code); taps.add(e.code);
  });
  window.addEventListener('keyup', (e) => keysDown.delete(e.code));
  window.addEventListener('blur', () => keysDown.clear());
}

export function takeMenuPresses() {
  const out = menuPresses.splice(0);
  return out;
}

function keyboardState(player) {
  const s = blankState();
  const map = KEYMAPS[player];
  for (const code of keysDown) if (map[code]) s[map[code]] = true;
  for (const code of taps) if (map[code]) { s[map[code]] = true; taps.delete(code); }
  return s;
}

function gamepadState(index) {
  const s = blankState();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const list = Array.from(pads || []).filter(Boolean);
  const gp = list[index];
  if (!gp) return s;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  s.left = ax < -0.4 || b(14); s.right = ax > 0.4 || b(15);
  s.up = ay < -0.5 || b(12); s.down = ay > 0.5 || b(13);
  s.lp = b(2); s.hp = b(3); s.lk = b(0); s.hk = b(1);
  s.rage = b(5) || b(7);
  return s;
}

export function readGamepadMenu() {
  // Returns a merged state across all pads for menu navigation.
  const s = blankState();
  for (let i = 0; i < 4; i++) {
    const g = gamepadState(i);
    for (const k in s) s[k] = s[k] || g[k];
  }
  return s;
}

export function humanState(player, useTouch) {
  const k = keyboardState(player);
  const g = gamepadState(player);
  const s = blankState();
  for (const key in s) s[key] = k[key] || g[key] || (useTouch && touchState[key]);
  return s;
}

// ---------------- Touch controls ----------------
export function initTouch(root) {
  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#knob');
  let stickId = null, cx = 0, cy = 0;

  const setDir = (dx, dy) => {
    const dead = 18;
    touchState.left = dx < -dead; touchState.right = dx > dead;
    touchState.up = dy < -dead * 1.4; touchState.down = dy > dead * 1.2;
    const len = Math.hypot(dx, dy), max = 46;
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const clearDir = () => {
    touchState.left = touchState.right = touchState.up = touchState.down = false;
    knob.style.transform = 'translate(0,0)';
  };

  stick.addEventListener('touchstart', (e) => {
    e.preventDefault(); touchActive = true;
    const t = e.changedTouches[0]; stickId = t.identifier;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    setDir(t.clientX - cx, t.clientY - cy);
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stickId) setDir(t.clientX - cx, t.clientY - cy);
  }, { passive: false });
  const endStick = (e) => {
    for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; clearDir(); }
  };
  stick.addEventListener('touchend', endStick);
  stick.addEventListener('touchcancel', endStick);

  root.querySelectorAll('[data-btn]').forEach((el) => {
    const name = el.dataset.btn;
    const on = (e) => { e.preventDefault(); touchActive = true; touchState[name] = true; el.classList.add('down'); };
    const off = (e) => { e.preventDefault(); touchState[name] = false; el.classList.remove('down'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  });
}

// ---------------- Motion input history ----------------
// Directions use numpad notation relative to facing: 6 = forward, 4 = back, 2 = down, 8 = up.
export function toNumpad(s, facing) {
  const fwd = facing > 0 ? s.right : s.left;
  const back = facing > 0 ? s.left : s.right;
  const h = fwd && !back ? 1 : back && !fwd ? -1 : 0;
  const v = s.up && !s.down ? 1 : s.down && !s.up ? -1 : 0;
  return 5 + h + v * 3;
}

export class InputTracker {
  constructor() {
    this.history = []; // {dir, frame}
    this.prev = blankState();
    this.cur = blankState();
    this.pressedAt = { lp: -99, hp: -99, lk: -99, hk: -99, rage: -99 };
    this.frame = 0;
  }
  update(state, facing) {
    this.frame++;
    this.prev = this.cur;
    this.cur = state;
    for (const b of BUTTONS) if (state[b] && !this.prev[b]) this.pressedAt[b] = this.frame;
    const d = toNumpad(state, facing);
    const last = this.history[this.history.length - 1];
    if (!last || last.dir !== d) this.history.push({ dir: d, frame: this.frame });
    if (this.history.length > 32) this.history.shift();
  }
  // Was the button freshly pressed within the last `buffer` frames?
  pressed(b, buffer = 1) { return this.frame - this.pressedAt[b] < buffer; }
  consume(b) { this.pressedAt[b] = -99; }
  anyPunch(buffer = 1) { return this.pressed('lp', buffer) || this.pressed('hp', buffer); }
  anyKick(buffer = 1) { return this.pressed('lk', buffer) || this.pressed('hk', buffer); }
  // Did the directions in `seq` occur in order within `window` frames?
  // Directions are re-mapped to the current facing on the fly by the caller.
  motion(seq, window = 18) {
    let i = seq.length - 1;
    for (let h = this.history.length - 1; h >= 0 && i >= 0; h--) {
      const e = this.history[h];
      if (this.frame - e.frame > window) break;
      if (matchDir(e.dir, seq[i])) i--;
    }
    return i < 0;
  }
}

// Allow small leniency: a "3" also counts for "2" or "6" endings, etc.
function matchDir(actual, wanted) {
  if (actual === wanted) return true;
  return false;
}
