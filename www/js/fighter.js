import { BASE_MOVES } from './characters.js';
import { POSES, lerpPose } from './render.js';
import { sfx } from './audio.js';

export const GRAV = 0.8;
const NEUTRAL = new Set(['stand', 'crouch', 'walkF', 'walkB']);

export class Fighter {
  constructor(ch, side, game) {
    this.ch = ch; this.side = side; this.game = game;
    this.s = ch.scale || 1;
    this.maxHealth = ch.health;
    this.meter = 0;
    this.reset(side);
  }

  reset(side) {
    this.x = this.game.stageW / 2 + (side === 0 ? -170 : 170);
    this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = side === 0 ? 1 : -1;
    this.health = this.maxHealth;
    this.state = 'stand'; this.t = 0;
    this.move = null; this.moveName = ''; this.hasHit = false; this.airUsed = false;
    this.pose = { ...POSES.idle };
    this.combo = 0; this.stun = 0; this.invuln = 0; this.flash = 0;
    this.blocking = false; this.jumpDir = 0; this.special = null;
    this.displayHealth = this.health;
  }

  get grounded() { return this.y <= 0 && this.vy <= 0; }
  get neutral() { return NEUTRAL.has(this.state); }

  setState(st) { this.state = st; this.t = 0; }

  hurtbox() {
    const s = this.s;
    let h = 150 * s, y0 = this.y, w = 44 * s;
    if (this.state === 'crouch' || (this.move && this.move.crouch) || (this.state === 'block' && this.crouchBlock)) h = 92 * s;
    if (!this.grounded) { y0 = this.y + 10; h = 120 * s; }
    if (this.state === 'down' || this.state === 'ko') return null;
    if (this.state === 'special' && this.special && this.special.kind === 'rush') h = 110 * s;
    return { x1: this.x - w / 2, x2: this.x + w / 2, y1: y0, y2: y0 + h };
  }

  hitbox() {
    const m = this.move;
    if (!m || this.hasHit) return null;
    if (m.kind === 'normal') {
      if (this.t < m.startup || this.t >= m.startup + m.active) return null;
      return this.box(m.box);
    }
    return null;
  }

  box([fx, fy, w, h]) {
    const s = this.s;
    const a = this.x + this.facing * fx * s, b = this.x + this.facing * (fx + w) * s;
    const cy = this.y + fy * s;
    return { x1: Math.min(a, b), x2: Math.max(a, b), y1: cy - (h * s) / 2, y2: cy + (h * s) / 2 };
  }

  // ------------------------------------------------------------------
  update(inp, opp) {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    const s = inp.cur;
    const fwdHeld = this.facing > 0 ? s.right : s.left;
    const backHeld = this.facing > 0 ? s.left : s.right;
    this.backHeld = backHeld && !s.up;
    this.downHeld = s.down;

    switch (this.state) {
      case 'intro': case 'win': break;
      case 'stand': case 'crouch': case 'walkF': case 'walkB': {
        this.combo = 0;
        if (this.facingUpdate(opp)) break;
        if (this.trySpecial(inp, opp)) break;
        if (this.tryNormal(inp)) break;
        if (s.up) { this.jumpDir = fwdHeld ? 1 : backHeld ? -1 : 0; this.setState('prejump'); this.vx = 0; break; }
        if (s.down) { this.state = 'crouch'; this.vx = 0; break; }
        const threat = this.threatened(opp);
        this.threatClose = threat;
        if (fwdHeld) { this.state = 'walkF'; this.vx = this.ch.walk * this.facing; }
        else if (backHeld) { this.state = 'walkB'; this.vx = threat ? 0 : -this.ch.walk * 0.8 * this.facing; }
        else { this.state = 'stand'; this.vx = 0; }
        break;
      }
      case 'prejump':
        if (this.t >= 3) {
          this.vy = this.ch.jumpV; this.vx = this.jumpDir * this.ch.jumpX * this.facing;
          this.y = 0.1; this.airUsed = false; this.setState('jump'); sfx('jump');
        }
        break;
      case 'jump':
        if (!this.airUsed && this.trySpecialAir(inp)) break;
        if (!this.airUsed) {
          const b = ['hk', 'hp', 'lk', 'lp'].find((k) => inp.pressed(k, 3));
          if (b) { inp.consume(b); this.startMove('j' + b); this.airUsed = true; this.state = 'jattack'; this.t = 0; }
        }
        break;
      case 'jattack':
        if (this.move && this.t >= this.move.startup + this.move.active + this.move.recovery) { this.move = null; this.state = 'jump'; }
        break;
      case 'attack': {
        const m = this.move;
        if (this.hasHitOrBlocked && this.t > m.startup && this.trySpecial(inp, opp)) break;
        // chain light attacks
        if (this.hasHitOrBlocked && (this.moveName === 'lp' || this.moveName === 'clp' || this.moveName === 'clk') && this.t > m.startup + 1) {
          if (this.tryNormal(inp, true)) break;
        }
        if (this.t >= m.startup + m.active + m.recovery) { this.move = null; this.setState(s.down ? 'crouch' : 'stand'); }
        break;
      }
      case 'special': this.updateSpecial(opp); break;
      case 'land': if (this.t >= this.landTime) this.setState('stand'); break;
      case 'hit': case 'block':
        if (this.t >= this.stun) { this.setState(this.state === 'block' && this.crouchBlock ? 'crouch' : 'stand'); }
        break;
      case 'air': break;
      case 'down':
        if (this.t >= 40) { if (this.health <= 0) this.setState('ko'); else { this.setState('getup'); this.invuln = 18; } }
        break;
      case 'getup': if (this.t >= 16) this.setState('stand'); break;
      case 'ko': break;
    }

    this.physics();
    this.updatePose();
  }

  get hasHitOrBlocked() { return this.hasHit; }

  threatened(opp) {
    const d = Math.abs(opp.x - this.x);
    if ((opp.state === 'attack' || opp.state === 'jattack' || opp.state === 'special') && d < 260) return true;
    return this.game.projectiles.some((p) => p.owner !== this && Math.abs(p.x - this.x) < 260 && (this.x - p.x) * p.vx > 0);
  }

  facingUpdate(opp) {
    const want = opp.x >= this.x ? 1 : -1;
    if (want !== this.facing && Math.abs(opp.x - this.x) > 4) this.facing = want;
    return false;
  }

  startMove(name) {
    this.move = BASE_MOVES[name]; this.moveName = name; this.hasHit = false; this.t = 0;
    sfx('whiff');
  }

  tryNormal(inp, chain = false) {
    const order = ['hk', 'hp', 'lk', 'lp'];
    const b = order.find((k) => inp.pressed(k, chain ? 4 : 3));
    if (!b) return false;
    inp.consume(b);
    const crouch = inp.cur.down;
    this.startMove((crouch ? 'c' : '') + b);
    if (crouch) this.move = { ...this.move, crouch: true };
    this.state = 'attack'; this.vx = 0;
    return true;
  }

  trySpecial(inp, opp) {
    const sp = this.ch.specials;
    const buf = 5;
    const superPress = inp.pressed('rage', buf) || (inp.pressed('hp', buf) && inp.pressed('hk', buf));
    if (superPress && this.meter >= 100) {
      inp.consume('rage'); inp.consume('hp'); inp.consume('hk');
      this.meter = 0; this.beginSpecial('super', sp.super, 'hp');
      return true;
    }
    const punch = inp.pressed('hp', buf) ? 'hp' : inp.pressed('lp', buf) ? 'lp' : null;
    const kick = inp.pressed('hk', buf) ? 'hk' : inp.pressed('lk', buf) ? 'lk' : null;
    if (punch && inp.motion([6, 2, 3], 20)) { inp.consume(punch); this.beginSpecial('rising', sp.rising, punch); return true; }
    if (punch && inp.motion([2, 3, 6], 16) && !this.game.projectiles.some((p) => p.owner === this)) {
      inp.consume(punch); this.beginSpecial('projectile', sp.projectile, punch); return true;
    }
    if (kick && inp.motion([2, 1, 4], 16)) { inp.consume(kick); this.beginSpecial('rush', sp.rush, kick); return true; }
    return false;
  }

  trySpecialAir() { return false; }

  beginSpecial(kind, data, btn) {
    this.special = { kind, data, heavy: btn === 'hp' || btn === 'hk' };
    this.move = { kind: 'special', height: 'mid' };
    this.hasHit = false; this.state = 'special'; this.t = 0; this.vx = 0;
    this.game.callout(this, data.name);
    if (kind === 'super') { this.game.superFreeze(this); this.invuln = 30; sfx('super'); }
    else sfx('special');
    if (kind === 'rising') this.invuln = 7;
  }

  updateSpecial(opp) {
    const sp = this.special, d = sp.data, t = this.t;
    if (sp.kind === 'projectile') {
      if (t === 11) this.game.spawnProjectile(this, { speed: d.speed * (sp.heavy ? 1.25 : 0.9), dmg: d.dmg, size: d.size, ground: d.ground });
      if (t >= 40) this.endSpecial();
    } else if (sp.kind === 'super') {
      if (t === 10) this.game.spawnProjectile(this, { speed: 9, dmg: d.dmg, size: 44, super: true, ground: false });
      if (t >= 48) this.endSpecial();
    } else if (sp.kind === 'rising') {
      if (t === 4) { this.vy = d.rise * (sp.heavy ? 1.1 : 0.9); this.vx = d.fwd * this.facing; this.y = 0.1; }
      if (t > 4 && this.vy > 0 && !this.hasHit) this.activeBox = this.box([0, 100, 46, 90]);
      else this.activeBox = null;
      if (t > 4 && this.y <= 0) { this.y = 0; this.vy = 0; this.vx = 0; this.landTime = 18; this.setState('land'); this.special = null; this.move = null; this.activeBox = null; }
    } else if (sp.kind === 'rush') {
      const frames = d.frames + (sp.heavy ? 6 : 0);
      if (t >= 6 && t < 6 + frames && !this.hasHit) { this.vx = d.speed * this.facing; this.activeBox = this.box([6, 70, 52, 60]); }
      else { this.vx *= 0.7; this.activeBox = null; }
      if (t >= 6 + frames + 16 || (this.hasHit && t >= this.hitAt + 12)) this.endSpecial();
    }
  }

  endSpecial() { this.special = null; this.move = null; this.activeBox = null; this.setState('stand'); }

  // ------------------------------------------------------------------
  physics() {
    const air = this.y > 0 || this.vy > 0;
    if (air) {
      this.vy -= GRAV;
      this.y += this.vy;
      this.x += this.vx;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (this.state === 'jump' || this.state === 'jattack') { this.move = null; this.vx = 0; this.landTime = 4; this.setState('land'); sfx('land'); }
        else if (this.state === 'air') { this.vx = 0; this.setState('down'); this.invuln = 60; sfx('knockdown'); this.game.shake(6); }
      }
    } else {
      this.x += this.vx;
      if (this.state === 'hit' || this.state === 'block') this.vx *= 0.82;
    }
  }

  updatePose() {
    const st = this.state;
    let name = 'idle', k = 0.35;
    const t = this.game.frame;
    switch (st) {
      case 'stand': case 'intro': name = this.backHeld && this.threatClose ? 'block' : (Math.floor(t / 20) % 2 ? 'idle2' : 'idle'); break;
      case 'walkF': name = Math.floor(t / 9) % 2 ? 'walkA' : 'walkB'; k = 0.25; break;
      case 'walkB': name = this.vx === 0 ? 'block' : (Math.floor(t / 11) % 2 ? 'walkB' : 'back'); k = 0.25; break;
      case 'crouch': name = this.backHeld && this.vx === 0 && this.threatClose ? 'cBlock' : 'crouch'; break;
      case 'prejump': name = 'crouch'; k = 0.6; break;
      case 'jump': name = this.vy > 4 ? 'jumpUp' : 'jump'; break;
      case 'attack': case 'jattack': name = this.move.pose; k = this.t < this.move.startup + this.move.active ? 0.7 : 0.25; break;
      case 'special': {
        const kind = this.special.kind;
        name = kind === 'rising' ? (this.t < 4 ? 'crouch' : 'rising') : kind === 'rush' ? (this.ch.id === 'nyx' || this.ch.id === 'kael' ? 'rushK' : 'rush') : (this.t < 8 ? 'back' : 'shoot');
        k = 0.6; break;
      }
      case 'land': name = 'crouch'; break;
      case 'hit': name = this.lowHit ? 'hitLow' : 'hit'; k = 0.7; break;
      case 'block': name = this.crouchBlock ? 'cBlock' : 'block'; k = 0.7; break;
      case 'air': name = 'air'; k = 0.5; break;
      case 'down': name = 'down'; k = 0.5; break;
      case 'getup': name = 'crouch'; k = 0.3; break;
      case 'ko': name = 'ko'; break;
      case 'win': name = Math.floor(t / 30) % 2 ? 'win' : 'taunt'; k = 0.15; break;
    }
    const target = POSES[name] || POSES.idle;
    this.pose = target.lying || this.pose.lying ? (target.lying && this.pose.lying ? lerpPose(this.pose, target, k) : { ...target }) : lerpPose(this.pose, target, k);
  }

  // Called by the game when one of our attacks connects.
  onHitConfirm() { this.hasHit = true; this.hitAt = this.t; }

  takeHit(att, info) {
    // info: { dmg, hitstun, blockstun, push, height, knockdown, chip, launch }
    const canBlock = (this.neutral || this.state === 'block') && this.grounded && this.backHeld;
    let blocked = false;
    if (canBlock) {
      const crouching = this.downHeld;
      if (info.height === 'low' && !crouching) blocked = false;
      else if (info.height === 'high' && crouching) blocked = false;
      else blocked = true;
      this.crouchBlock = crouching;
    }
    const dir = att.x <= this.x ? 1 : -1;
    if (blocked) {
      this.setState('block'); this.stun = info.blockstun; this.vx = dir * info.push * 0.9;
      if (info.chip) this.health = Math.max(1, this.health - Math.round(info.dmg * 0.25));
      this.meter = Math.min(100, this.meter + info.dmg * 0.03);
      att.meter = Math.min(100, att.meter + info.dmg * 0.02);
      return 'block';
    }
    this.combo++;
    const scale = Math.max(0.35, 1 - 0.12 * (this.combo - 1));
    const dmg = Math.round(info.dmg * scale);
    this.health = Math.max(0, this.health - dmg);
    this.flash = 4;
    this.meter = Math.min(100, this.meter + dmg * 0.05);
    att.meter = Math.min(100, att.meter + dmg * 0.08);
    this.move = null; this.special = null; this.activeBox = null;
    this.lowHit = info.height === 'low';
    if (this.health <= 0 || info.knockdown || !this.grounded || this.state === 'air') {
      this.setState('air');
      this.vy = this.health <= 0 ? 11 : Math.max(this.vy, info.launch || 8);
      this.y = Math.max(this.y, 0.1);
      this.vx = dir * (this.health <= 0 ? 5 : 3.5);
    } else {
      this.setState('hit'); this.stun = info.hitstun; this.vx = dir * info.push;
    }
    return 'hit';
  }
}
