// Original RageFighter roster. All characters, names and looks are original.
// Hitbox coordinates: x forward from the fighter's centre, y up from the floor.

const N = (o) => Object.assign({ kind: 'normal', startup: 4, active: 3, recovery: 8, dmg: 5, hitstun: 14, blockstun: 9, push: 6, height: 'mid' }, o);

export const BASE_MOVES = {
  // standing
  lp: N({ pose: 'jab', startup: 3, active: 3, recovery: 6, dmg: 4, hitstun: 13, blockstun: 8, box: [20, 105, 56, 18] }),
  hp: N({ pose: 'cross', startup: 6, active: 4, recovery: 15, dmg: 10, hitstun: 19, blockstun: 13, push: 10, box: [20, 108, 68, 22] }),
  lk: N({ pose: 'kickMid', startup: 5, active: 3, recovery: 9, dmg: 6, hitstun: 14, blockstun: 9, box: [20, 60, 66, 20] }),
  hk: N({ pose: 'kickHigh', startup: 8, active: 4, recovery: 18, dmg: 12, hitstun: 20, blockstun: 14, push: 12, box: [24, 100, 74, 30] }),
  // crouching
  clp: N({ pose: 'cJab', startup: 3, active: 3, recovery: 6, dmg: 4, hitstun: 12, blockstun: 8, box: [20, 62, 54, 18] }),
  chp: N({ pose: 'cUpper', startup: 6, active: 5, recovery: 16, dmg: 10, hitstun: 19, blockstun: 12, box: [10, 90, 50, 60], antiAir: true }),
  clk: N({ pose: 'cKick', startup: 4, active: 3, recovery: 8, dmg: 5, hitstun: 13, blockstun: 8, height: 'low', box: [20, 14, 68, 18] }),
  chk: N({ pose: 'sweep', startup: 8, active: 4, recovery: 22, dmg: 11, hitstun: 22, blockstun: 12, height: 'low', knockdown: true, box: [24, 14, 86, 20] }),
  // jumping (overheads)
  jlp: N({ pose: 'jPunch', startup: 4, active: 8, recovery: 4, dmg: 6, hitstun: 15, blockstun: 10, height: 'high', box: [16, 50, 50, 30] }),
  jhp: N({ pose: 'jPunch', startup: 6, active: 6, recovery: 6, dmg: 11, hitstun: 19, blockstun: 12, height: 'high', box: [16, 40, 60, 36] }),
  jlk: N({ pose: 'jKick', startup: 4, active: 9, recovery: 4, dmg: 7, hitstun: 15, blockstun: 10, height: 'high', box: [10, 20, 56, 30] }),
  jhk: N({ pose: 'jKick', startup: 6, active: 7, recovery: 6, dmg: 12, hitstun: 20, blockstun: 12, height: 'high', box: [10, 10, 74, 34] }),
};

export const ROSTER = [
  {
    id: 'kael', name: 'KAEL', title: 'The Ember Monk',
    blurb: 'Balanced fighter who turns inner heat into fireballs.',
    health: 1000, walk: 3.4, jumpV: 15.5, jumpX: 4.4, scale: 1.0,
    colors: { skin: '#e7b48a', top: '#ff7a1a', bottom: '#2b2b38', belt: '#ffd23f', hair: '#c4231b', accent: '#ffd23f', fx: '#ff8a1f', fx2: '#ffe066' },
    look: { hair: 'spiky', topless: false, sleeves: false, band: false, mask: false, beard: false },
    stage: 'temple',
    specials: {
      projectile: { name: 'Ember Shot', speed: 8, dmg: 12, size: 20 },
      rising: { name: 'Phoenix Rise', dmg: 16, rise: 15, fwd: 3 },
      rush: { name: 'Blaze Step', dmg: 12, speed: 10, frames: 18 },
      super: { name: 'Inferno Rage', dmg: 30 },
    },
  },
  {
    id: 'brakka', name: 'BRAKKA', title: 'The Mountain',
    blurb: 'Slow, huge and hits like a landslide. Takes punishment well.',
    health: 1150, walk: 2.5, jumpV: 14.0, jumpX: 3.6, scale: 1.15,
    colors: { skin: '#a8714f', top: '#6a3fb5', bottom: '#3a2a1c', belt: '#c9c9c9', hair: '#2a1a12', accent: '#ffa94d', fx: '#c48b4a', fx2: '#f5d29a' },
    look: { hair: 'bald', topless: false, sleeves: false, band: false, mask: false, beard: true },
    stage: 'harbor',
    dmgMul: 1.15, speedMul: 0.9,
    specials: {
      projectile: { name: 'Quake Wave', speed: 6, dmg: 13, size: 18, ground: true },
      rising: { name: 'Ram Rise', dmg: 18, rise: 12, fwd: 2 },
      rush: { name: 'Bull Charge', dmg: 15, speed: 9, frames: 24 },
      super: { name: 'Avalanche', dmg: 34 },
    },
  },
  {
    id: 'nyx', name: 'NYX', title: 'The Night Blade',
    blurb: 'Lightning-fast skirmisher. Fragile, but never stops moving.',
    health: 900, walk: 4.3, jumpV: 16.5, jumpX: 5.2, scale: 0.95,
    colors: { skin: '#f1c9a5', top: '#13a89e', bottom: '#11212b', belt: '#d6f5f2', hair: '#1b1b2f', accent: '#7af0e4', fx: '#5ff2e2', fx2: '#ffffff' },
    look: { hair: 'ponytail', topless: false, sleeves: true, band: false, mask: true, beard: false },
    stage: 'harbor',
    dmgMul: 0.9,
    specials: {
      projectile: { name: 'Shard Toss', speed: 11, dmg: 9, size: 13 },
      rising: { name: 'Crescent Flip', dmg: 14, rise: 17, fwd: 4 },
      rush: { name: 'Shadow Dive', dmg: 11, speed: 13, frames: 15 },
      super: { name: 'Thousand Cuts', dmg: 28 },
    },
  },
  {
    id: 'volta', name: 'VOLTA', title: 'The Storm Boxer',
    blurb: 'Hard-hitting boxer charged with raw electricity.',
    health: 1000, walk: 3.6, jumpV: 15.0, jumpX: 4.2, scale: 1.03,
    colors: { skin: '#7b5136', top: '#1f4fd1', bottom: '#1f4fd1', belt: '#ffe23f', hair: '#f4f4f4', accent: '#ffe23f', fx: '#8fd8ff', fx2: '#ffffff' },
    look: { hair: 'flat', topless: true, sleeves: false, band: true, mask: false, beard: false, gloves: '#ffe23f' },
    stage: 'temple',
    specials: {
      projectile: { name: 'Arc Bolt', speed: 6.5, dmg: 14, size: 24 },
      rising: { name: 'Thunder Hook', dmg: 17, rise: 13, fwd: 3 },
      rush: { name: 'Spark Rush', dmg: 13, speed: 11, frames: 18 },
      super: { name: 'Storm Breaker', dmg: 32 },
    },
  },
];
