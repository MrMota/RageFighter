import { blankState } from './input.js';

// CPU opponent: makes decisions on a reaction delay and emits scripted
// virtual controller inputs, so it goes through the same input pipeline as humans.
const LEVELS = {
  easy: { react: 26, block: 0.25, anti: 0.15, aggro: 0.35, combo: 0.2 },
  normal: { react: 14, block: 0.55, anti: 0.45, aggro: 0.55, combo: 0.5 },
  hard: { react: 7, block: 0.8, anti: 0.8, aggro: 0.7, combo: 0.85 },
};

export class AI {
  constructor(level = 'normal') { this.lv = LEVELS[level] || LEVELS.normal; this.queue = []; this.cool = 0; this.hold = null; }

  // dirs relative to facing -> absolute state
  frame(f, dir, btn) {
    const s = blankState();
    const fwd = f > 0 ? 'right' : 'left', back = f > 0 ? 'left' : 'right';
    if ([1, 2, 3].includes(dir)) s.down = true;
    if ([7, 8, 9].includes(dir)) s.up = true;
    if ([3, 6, 9].includes(dir)) s[fwd] = true;
    if ([1, 4, 7].includes(dir)) s[back] = true;
    if (btn) for (const b of btn.split('+')) s[b] = true;
    return s;
  }
  seq(f, steps) { for (const [dir, btn, n] of steps) for (let i = 0; i < (n || 2); i++) this.queue.push(this.frame(f, dir, i === 0 ? btn : null)); }

  think(me, opp, game) {
    if (this.queue.length) return this.queue.shift();
    if (this.hold && this.hold.n-- > 0) return this.frame(me.facing, this.hold.dir, null);
    this.hold = null;
    if (!['stand', 'crouch', 'walkF', 'walkB', 'jump', 'attack'].includes(me.state)) {
      // keep blocking while in blockstun
      if (me.state === 'block') return this.frame(me.facing, me.crouchBlock ? 1 : 4);
      return blankState();
    }
    const f = me.facing, lv = this.lv, r = Math.random();
    const dist = Math.abs(opp.x - me.x);
    const oppAttacking = ['attack', 'jattack', 'special'].includes(opp.state);
    const proj = game.projectiles.find((p) => p.owner === opp && (me.x - p.x) * p.vx > 0);

    // Defensive reactions happen every frame but are rolled once per threat.
    if (this.cool > 0) { this.cool--; return this.idleInput(me); }
    this.cool = lv.react + Math.floor(Math.random() * 6);

    if (me.state === 'attack' && me.hasHit && Math.random() < lv.combo) {
      this.seq(f, [[2], [3], [6, 'hp']]); return this.queue.shift();
    }
    if (proj && Math.abs(proj.x - me.x) < 300) {
      if (r < 0.35) { this.seq(f, [[9, null, 2]]); }
      else if (r < 0.35 + lv.block) { this.hold = { dir: proj.ground ? 1 : 4, n: 30 }; }
      else if (me.meter >= 100) { this.seq(f, [[5, 'rage']]); }
      return this.queue.shift() || this.idleInput(me);
    }
    if (opp.y > 30 && dist < 200 && opp.vy < 4 && r < lv.anti) {
      this.cool = 2;
      if (Math.random() < 0.6) this.seq(f, [[6], [2], [3, 'hp']]); else this.seq(f, [[2, 'hp', 3]]);
      return this.queue.shift();
    }
    if (oppAttacking && dist < 230 && r < lv.block) {
      const low = opp.move && opp.move.height === 'low';
      const high = opp.state === 'jattack';
      this.hold = { dir: low || (!high && Math.random() < 0.5) ? 1 : 4, n: 18 };
      return this.idleInput(me);
    }
    if (me.meter >= 100 && dist < 500 && Math.random() < 0.4) { this.seq(f, [[5, 'rage']]); return this.queue.shift(); }

    const a = Math.random();
    if (dist > 380) {
      if (a < 0.35) this.seq(f, [[2], [3], [6, Math.random() < 0.5 ? 'lp' : 'hp']]);
      else if (a < 0.45) this.seq(f, [[9, null, 2]]);
      else this.hold = { dir: 6, n: 20 + Math.floor(Math.random() * 20) };
    } else if (dist > 170) {
      if (a < 0.2 * lv.aggro * 2) this.seq(f, [[2], [3], [6, 'hp']]);
      else if (a < 0.35) this.seq(f, [[9, null, 2], [5, null, 18], [5, 'hk']]);
      else if (a < 0.45) this.seq(f, [[2], [1], [4, Math.random() < 0.5 ? 'lk' : 'hk']]);
      else if (a < 0.85) this.hold = { dir: 6, n: 14 };
      else this.hold = { dir: 4, n: 12 };
    } else {
      if (a < lv.aggro) {
        const pick = Math.floor(Math.random() * 6);
        if (pick === 0) this.seq(f, [[2, 'lk', 3], [2, null, 6], [2, 'lk', 3], [2], [3], [6, 'hp']]);
        else if (pick === 1) this.seq(f, [[5, 'lp', 3], [5, null, 5], [5, 'lp', 3], [2], [3], [6, 'lp']]);
        else if (pick === 2) this.seq(f, [[2, 'hk', 3]]);
        else if (pick === 3) this.seq(f, [[5, 'hk', 3]]);
        else if (pick === 4) this.seq(f, [[5, 'hp', 3], [2], [1], [4, 'hk']]);
        else this.seq(f, [[6, 'lk', 3]]);
      } else if (a < lv.aggro + 0.2) this.hold = { dir: 4, n: 16 };
      else this.hold = { dir: 1, n: 14 };
    }
    return this.queue.shift() || this.idleInput(me);
  }

  idleInput(me) { return this.hold ? this.frame(me.facing, this.hold.dir) : blankState(); }
}
