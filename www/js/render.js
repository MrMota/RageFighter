// Procedural fighter rendering (forward kinematics stick-puppet with chunky outlines)
// and procedural stage backgrounds. No external images are used.

const P = (lean, fa, ba, fl, bl, extra = {}) => ({ lean, fa, ba, fl, bl, ...extra });

// Angles in degrees: 0 = straight down, 90 = straight forward, 180 = straight up, negative = backward.
export const POSES = {
  idle: P(6, [35, 135], [15, 150], [24, 8], [-26, -8]),
  idle2: P(8, [38, 130], [18, 146], [26, 10], [-24, -10]),
  walkA: P(8, [30, 135], [20, 150], [32, 10], [-18, -22]),
  walkB: P(8, [40, 135], [10, 150], [-8, -20], [20, 6]),
  back: P(-2, [25, 150], [10, 155], [20, 5], [-30, -12]),
  crouch: P(18, [55, 130], [35, 150], [80, -10], [20, -40]),
  block: P(-4, [70, 165], [55, 170], [22, 6], [-28, -12]),
  cBlock: P(10, [75, 165], [60, 170], [80, -10], [20, -40]),
  jump: P(5, [60, 150], [30, 160], [75, -15], [40, -40], { air: true }),
  jumpUp: P(0, [140, 160], [120, 170], [15, -10], [-5, -20], { air: true }),
  jab: P(10, [90, 90], [20, 150], [26, 8], [-26, -10]),
  cross: P(22, [92, 92], [-30, 60], [32, 10], [-30, -18]),
  kickMid: P(-10, [50, 140], [-20, 120], [85, 92], [-6, -6]),
  kickHigh: P(-28, [40, 150], [-40, 120], [112, 118], [-4, -4]),
  cJab: P(18, [85, 88], [35, 150], [80, -10], [20, -40]),
  cUpper: P(10, [150, 170], [30, 150], [70, -10], [10, -40]),
  cKick: P(10, [60, 140], [35, 150], [88, 90], [20, -45]),
  sweep: P(30, [70, 90], [-40, 20], [92, 93], [30, -40]),
  jPunch: P(20, [110, 105], [20, 60], [70, -10], [30, -40], { air: true }),
  jKick: P(-10, [60, 150], [10, 140], [72, 78], [10, -45], { air: true }),
  throwP: P(25, [90, 90], [70, 75], [28, 10], [-30, -18]),
  rising: P(-5, [175, 178], [20, 120], [30, -20], [-10, -30], { air: true }),
  rush: P(28, [95, 95], [-50, -40], [45, 20], [-55, -30], { air: true }),
  rushK: P(-20, [50, 130], [10, 150], [95, 96], [-10, -20], { air: true }),
  shoot: P(18, [92, 94], [88, 92], [34, 12], [-32, -20]),
  hit: P(-22, [-20, 30], [-40, 10], [20, 5], [-20, -15]),
  hitLow: P(25, [40, 60], [10, 30], [80, -15], [25, -40]),
  air: P(-30, [-60, -30], [-80, -40], [40, 10], [10, -10], { air: true }),
  down: P(0, [160, 175], [140, 170], [6, 2], [-4, -2], { lying: true }),
  win: P(-4, [168, 175], [20, 150], [22, 6], [-26, -8]),
  ko: P(-6, [170, 178], [120, 150], [10, 0], [-8, 4], { lying: true }),
  taunt: P(5, [90, 175], [-30, 30], [24, 8], [-26, -8]),
};

const L = { torso: 48, uArm: 28, fArm: 27, thigh: 37, shin: 37, head: 13 };
const rad = (d) => (d * Math.PI) / 180;
const vec = (deg, len) => [Math.sin(rad(deg)) * len, Math.cos(rad(deg)) * len];

export function lerpPose(a, b, t) {
  const l = (x, y) => x + (y - x) * t;
  const la = (p, q) => [l(p[0], q[0]), l(p[1], q[1])];
  return { lean: l(a.lean, b.lean), fa: la(a.fa, b.fa), ba: la(a.ba, b.ba), fl: la(a.fl, b.fl), bl: la(a.bl, b.bl), air: b.air, lying: b.lying };
}

function solve(pose) {
  const hip = [0, 0];
  const fk = vec(pose.fl[0], L.thigh), ff = vec(pose.fl[1], L.shin);
  const bk = vec(pose.bl[0], L.thigh), bf = vec(pose.bl[1], L.shin);
  const fKnee = [fk[0], fk[1]], fFoot = [fk[0] + ff[0], fk[1] + ff[1]];
  const bKnee = [bk[0], bk[1]], bFoot = [bk[0] + bf[0], bk[1] + bf[1]];
  const neck = [Math.sin(rad(pose.lean)) * L.torso, -Math.cos(rad(pose.lean)) * L.torso];
  const sh = [neck[0] * 0.92, neck[1] * 0.92];
  const fe = vec(pose.fa[0], L.uArm), fh = vec(pose.fa[1], L.fArm);
  const be = vec(pose.ba[0], L.uArm), bh = vec(pose.ba[1], L.fArm);
  const fElbow = [sh[0] + fe[0], sh[1] + fe[1]], fHand = [fElbow[0] + fh[0], fElbow[1] + fh[1]];
  const bElbow = [sh[0] + be[0], sh[1] + be[1]], bHand = [bElbow[0] + bh[0], bElbow[1] + bh[1]];
  const headC = [neck[0] + Math.sin(rad(pose.lean)) * 14, neck[1] - Math.cos(rad(pose.lean)) * 14];
  return { hip, fKnee, fFoot, bKnee, bFoot, neck, sh, fElbow, fHand, bElbow, bHand, headC };
}

function seg(ctx, a, b, w, color) {
  ctx.lineWidth = w; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function chain(ctx, pts, w, color) {
  ctx.lineWidth = w; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function dot(ctx, p, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); }

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// Draws a fighter with feet at (x, groundY - height). facing: 1 right, -1 left.
export function drawFighter(ctx, ch, pose, x, footY, facing, opts = {}) {
  const j = solve(pose);
  const c = ch.colors, look = ch.look;
  const s = ch.scale || 1;
  // ground the pose: lowest foot touches footY unless airborne
  const lowest = Math.max(j.fFoot[1], j.bFoot[1]);
  const hipY = pose.air ? -78 : -lowest;

  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(facing * s, s);
  if (pose.lying) { ctx.translate(0, -11); ctx.rotate(rad(-90)); }
  else ctx.translate(0, hipY);
  if (opts.flash) ctx.filter = 'brightness(3)';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const OUT = '#0d0d14', O = 5;
  const skin = c.skin, skinD = shade(c.skin, -35);
  const topC = look.topless ? skin : c.top;
  const armC = look.sleeves ? c.top : skin;
  const armCD = look.sleeves ? shade(c.top, -35) : skinD;
  const legC = c.bottom, legD = shade(c.bottom, -30);
  const handC = look.gloves || skin;

  // back limbs (darker)
  const backArm = [j.sh, j.bElbow, j.bHand];
  const backLeg = [j.hip, j.bKnee, j.bFoot];
  chain(ctx, backLeg, 15 + O, OUT); chain(ctx, backLeg, 15, legD);
  chain(ctx, backArm, 11 + O, OUT); chain(ctx, backArm, 11, armCD);
  dot(ctx, j.bHand, 8 + O / 2, OUT); dot(ctx, j.bHand, 8, look.gloves ? shade(look.gloves, -40) : skinD);
  dot(ctx, j.bFoot, 7 + O / 2, OUT); dot(ctx, j.bFoot, 7, look.topless ? '#222' : skinD);

  // torso
  seg(ctx, j.hip, j.sh, 28 + O, OUT); seg(ctx, j.hip, j.sh, 28, topC);
  if (look.topless) { // chest lines
    ctx.strokeStyle = skinD; ctx.lineWidth = 2;
    const m = [(j.hip[0] + j.sh[0]) / 2, (j.hip[1] + j.sh[1]) / 2];
    ctx.beginPath(); ctx.moveTo(m[0] - 6, m[1] - 10); ctx.lineTo(m[0] + 6, m[1] - 10); ctx.stroke();
  } else { // collar
    seg(ctx, [j.sh[0] - 4, j.sh[1] + 2], [j.sh[0] + 6, j.sh[1] + 12], 4, shade(c.top, 40));
  }
  // belt / waistband
  seg(ctx, [j.hip[0] - 13, j.hip[1] - 4], [j.hip[0] + 13, j.hip[1] - 4], 7, c.belt);
  // front leg
  const frontLeg = [j.hip, j.fKnee, j.fFoot];
  chain(ctx, frontLeg, 16 + O, OUT); chain(ctx, frontLeg, 16, legC);
  dot(ctx, j.fFoot, 7 + O / 2, OUT); dot(ctx, j.fFoot, 7, look.topless ? '#333' : skin);

  // head
  const hc = j.headC;
  dot(ctx, hc, L.head + O / 2, OUT); dot(ctx, hc, L.head, skin);
  // hair styles (original designs)
  ctx.fillStyle = c.hair;
  if (look.hair === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(hc[0] - 14, hc[1] - 2);
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      ctx.lineTo(hc[0] + Math.cos(a) * 15 - 4, hc[1] + Math.sin(a) * 15 - 2);
      ctx.lineTo(hc[0] + Math.cos(a + 0.3) * 24 - 8, hc[1] + Math.sin(a + 0.3) * 22 - 4);
    }
    ctx.lineTo(hc[0] + 13, hc[1] - 3); ctx.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
  } else if (look.hair === 'ponytail') {
    ctx.beginPath(); ctx.arc(hc[0], hc[1] - 2, L.head + 1, Math.PI, Math.PI * 2); ctx.fill();
    const t = opts.t || 0;
    chain(ctx, [[hc[0] - 10, hc[1] - 8], [hc[0] - 24, hc[1] - 2 + Math.sin(t / 6) * 3], [hc[0] - 34, hc[1] + 10 + Math.sin(t / 5) * 4]], 7 + 3, OUT);
    chain(ctx, [[hc[0] - 10, hc[1] - 8], [hc[0] - 24, hc[1] - 2 + Math.sin(t / 6) * 3], [hc[0] - 34, hc[1] + 10 + Math.sin(t / 5) * 4]], 7, c.hair);
  } else if (look.hair === 'flat') {
    ctx.beginPath(); ctx.rect(hc[0] - 12, hc[1] - 16, 23, 8); ctx.fill();
  }
  if (look.beard) {
    ctx.fillStyle = c.hair;
    ctx.beginPath(); ctx.arc(hc[0] + 3, hc[1] + 6, 10, 0.1, Math.PI - 0.4); ctx.fill();
  }
  if (look.mask) {
    ctx.fillStyle = c.top;
    ctx.beginPath(); ctx.arc(hc[0], hc[1], L.head, -0.1, Math.PI * 0.9); ctx.fill();
  }
  if (look.band) {
    seg(ctx, [hc[0] - 12, hc[1] - 7], [hc[0] + 12, hc[1] - 7], 4, c.accent);
  }
  // eye
  dot(ctx, [hc[0] + 7, hc[1] - 2], 2.2, '#111');

  // front arm
  const frontArm = [j.sh, j.fElbow, j.fHand];
  chain(ctx, frontArm, 12 + O, OUT); chain(ctx, frontArm, 12, armC);
  dot(ctx, j.fHand, 8.5 + O / 2, OUT); dot(ctx, j.fHand, 8.5, handC);
  if (!look.sleeves && !look.topless) { // short sleeve cuff
    const m = [j.sh[0] + (j.fElbow[0] - j.sh[0]) * 0.35, j.sh[1] + (j.fElbow[1] - j.sh[1]) * 0.35];
    seg(ctx, j.sh, m, 15, c.top);
  }
  ctx.restore();
}

// ---------------- Stages ----------------
const starCache = [];
for (let i = 0; i < 80; i++) starCache.push([Math.random(), Math.random() * 0.6, Math.random() * 1.5 + 0.3]);

export function drawStage(ctx, stage, camX, W, H, groundY, t) {
  if (stage === 'harbor') drawHarbor(ctx, camX, W, H, groundY, t);
  else drawTemple(ctx, camX, W, H, groundY, t);
}

function drawHarbor(ctx, camX, W, H, gy, t) {
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#0b0726'); g.addColorStop(0.6, '#2a1250'); g.addColorStop(1, '#6b1f63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy);
  ctx.fillStyle = '#fff';
  for (const [sx, sy, r] of starCache) {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t / 30 + sx * 50);
    ctx.fillRect(((sx * 2000 - camX * 0.05) % W + W) % W, sy * gy, r, r);
  }
  ctx.globalAlpha = 1;
  // moon
  ctx.fillStyle = '#ffd9f4'; ctx.beginPath(); ctx.arc(W * 0.78 - camX * 0.03, 90, 38, 0, Math.PI * 2); ctx.fill();
  // far skyline
  const layer = (par, color, base, seed, hMax, windows) => {
    ctx.fillStyle = color;
    const off = camX * par;
    for (let i = -2; i < 30; i++) {
      const bx = i * 70 - (off % 70) ;
      const idx = i + Math.floor(off / 70);
      const h = 60 + ((Math.sin(idx * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * hMax;
      ctx.fillRect(bx, base - h, 62, h);
      if (windows) {
        for (let wy = base - h + 10; wy < base - 10; wy += 16) for (let wx = bx + 8; wx < bx + 56; wx += 14) {
          const on = ((Math.sin(idx * 7 + wy * 3 + wx) * 999) % 1 + 1) % 1 > 0.55;
          if (on) { ctx.fillStyle = (idx % 3 === 0) ? '#ff5fd2' : '#5fe7ff'; ctx.fillRect(wx, wy, 6, 8); ctx.fillStyle = color; }
        }
      }
    }
  };
  layer(0.15, '#1c0f3a', gy - 60, 1, 160, false);
  layer(0.35, '#130a2a', gy - 30, 7, 120, true);
  // water
  const wg = ctx.createLinearGradient(0, gy - 30, 0, gy);
  wg.addColorStop(0, '#1b0d3a'); wg.addColorStop(1, '#3a1660');
  ctx.fillStyle = wg; ctx.fillRect(0, gy - 30, W, 30);
  ctx.strokeStyle = 'rgba(255,120,220,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = gy - 26 + i * 2.2;
    ctx.beginPath(); ctx.moveTo(((i * 97 + t * 0.6) % W), y); ctx.lineTo(((i * 97 + t * 0.6) % W) + 40, y); ctx.stroke();
  }
  // dock floor
  ctx.fillStyle = '#3b2a22'; ctx.fillRect(0, gy, W, H - gy);
  ctx.strokeStyle = '#24170f'; ctx.lineWidth = 3;
  for (let i = -1; i < 25; i++) {
    const x = i * 60 - (camX % 60);
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - (x - W / 2) * 0.5, H); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, gy, W, 6);
  // neon sign
  const sx = 600 - camX * 0.6;
  ctx.save(); ctx.font = 'bold 28px system-ui, sans-serif'; ctx.fillStyle = '#ff5fd2';
  ctx.shadowColor = '#ff5fd2'; ctx.shadowBlur = 16 + Math.sin(t / 10) * 6;
  ctx.fillText('RAGE', sx, gy - 120); ctx.restore();
}

function drawTemple(ctx, camX, W, H, gy, t) {
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.55, '#ff6b4a'); g.addColorStop(1, '#ffcf7a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy);
  // sun
  ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.beginPath(); ctx.arc(W * 0.3 - camX * 0.03, gy - 140, 70, 0, Math.PI * 2); ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255,230,210,0.5)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 260 + t * 0.2 - camX * 0.08) % (W + 300) + W + 300) % (W + 300) - 150;
    ctx.beginPath(); ctx.ellipse(cx, 60 + i * 18, 90, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
  // mountains
  const mtn = (par, color, base, amp, freq) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 10) {
      const wx = x + camX * par;
      ctx.lineTo(x, base - Math.abs(Math.sin(wx * freq)) * amp - Math.sin(wx * freq * 2.7) * amp * 0.3);
    }
    ctx.lineTo(W, gy); ctx.fill();
  };
  mtn(0.1, '#c9564d', gy - 90, 110, 0.004);
  mtn(0.25, '#8f3a3f', gy - 40, 80, 0.007);
  // temple
  const tx = 700 - camX * 0.45;
  ctx.fillStyle = '#4a2329';
  ctx.fillRect(tx, gy - 170, 220, 170);
  ctx.beginPath(); ctx.moveTo(tx - 40, gy - 170); ctx.lineTo(tx + 110, gy - 230); ctx.lineTo(tx + 260, gy - 170); ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx - 20, gy - 100); ctx.lineTo(tx + 110, gy - 140); ctx.lineTo(tx + 240, gy - 100); ctx.fill();
  ctx.fillStyle = '#ffcf7a';
  for (let i = 0; i < 4; i++) ctx.fillRect(tx + 25 + i * 50, gy - 80, 18, 50);
  // lanterns
  for (let i = 0; i < 5; i++) {
    const lx = i * 300 + 80 - camX * 0.8;
    ctx.strokeStyle = '#2a1416'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(lx, gy); ctx.lineTo(lx, gy - 110); ctx.stroke();
    ctx.fillStyle = '#ffdf6b'; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 14 + Math.sin(t / 12 + i) * 5;
    ctx.fillRect(lx - 10, gy - 128, 20, 22); ctx.shadowBlur = 0;
  }
  // floor stones
  ctx.fillStyle = '#b5835a'; ctx.fillRect(0, gy, W, H - gy);
  ctx.strokeStyle = '#8b6142'; ctx.lineWidth = 2;
  for (let r = 0; r < 5; r++) {
    const y = gy + r * ((H - gy) / 5);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let i = -1; i < 20; i++) {
      const x = i * 90 - (camX * (1 + r * 0.1)) % 90 + (r % 2) * 45;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (H - gy) / 5); ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, gy, W, 6);
}
