/**
 * MYSTIC MOTION - VFX Engine
 * Faithful 1:1 mathematical port of Python OpenCV vfx.py and config.py
 * Optimized for high-performance HTML5 Canvas 2D with additive blending.
 */

// ============================================================================
// Character Definitions
// ============================================================================
const CHARACTERS = {
  "1": {
    key: "1",
    name: "DOCTOR STRANGE",
    color: "#ff9b00",
    accent: "#ffdc50",
    rgbColor: [255, 155, 0],
    rgbAccent: [255, 220, 80],
    glow: "rgba(255, 155, 0, 0.45)"
  },
  "2": {
    key: "2",
    name: "SCARLET WITCH",
    color: "#eb0000",
    accent: "#ff2346",
    rgbColor: [235, 0, 0],
    rgbAccent: [255, 35, 70],
    glow: "rgba(235, 0, 0, 0.45)"
  },
  "3": {
    key: "3",
    name: "AGATHA HARKNESS",
    color: "#eb23dc",
    accent: "#ff91f5",
    rgbColor: [235, 35, 220],
    rgbAccent: [255, 145, 245],
    glow: "rgba(235, 35, 220, 0.45)"
  },
  "4": {
    key: "4",
    name: "LOKI",
    color: "#37cd2d",
    accent: "#9bff91",
    rgbColor: [55, 205, 45],
    rgbAccent: [155, 255, 145],
    glow: "rgba(55, 205, 45, 0.45)"
  },
  "5": {
    key: "5",
    name: "THOR",
    color: "#41cdff",
    accent: "#e1faff",
    rgbColor: [65, 205, 255],
    rgbAccent: [225, 250, 255],
    glow: "rgba(65, 205, 255, 0.45)"
  }
};

// ============================================================================
// Math & Vector Utilities (Matching Python NumPy methods)
// ============================================================================
function palmCenter(points) {
  // landmarks: [0: wrist, 5: index MCP, 9: middle MCP, 13: ring MCP, 17: pinky MCP]
  const indices = [0, 5, 9, 13, 17];
  let sumX = 0, sumY = 0;
  for (const idx of indices) {
    sumX += points[idx].x;
    sumY += points[idx].y;
  }
  return { x: sumX / indices.length, y: sumY / indices.length };
}

function palmCenter3D(points) {
  const indices = [0, 5, 9, 13, 17];
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const idx of indices) {
    sumX += points[idx].x;
    sumY += points[idx].y;
    sumZ += points[idx].z || 0;
  }
  const len = indices.length;
  return { x: sumX / len, y: sumY / len, z: sumZ / len };
}

function palmNormal(points) {
  const wrist = points[0];
  const indexBase = points[5];
  const pinkyBase = points[17];

  const v1 = {
    x: indexBase.x - wrist.x,
    y: indexBase.y - wrist.y,
    z: (indexBase.z || 0) - (wrist.z || 0)
  };
  const v2 = {
    x: pinkyBase.x - wrist.x,
    y: pinkyBase.y - wrist.y,
    z: (pinkyBase.z || 0) - (wrist.z || 0)
  };

  // Cross product: v1 x v2
  const normal = {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };

  const len = Math.hypot(normal.x, normal.y, normal.z);
  if (len < 1e-7) return null;
  return { x: normal.x / len, y: normal.y / len, z: normal.z / len };
}

function facingEachOther(handA, handB) {
  const normA = palmNormal(handA.points);
  const normB = palmNormal(handB.points);
  if (!normA || !normB) return false;

  const cA = palmCenter3D(handA.points);
  const cB = palmCenter3D(handB.points);

  const dirAB = { x: cB.x - cA.x, y: cB.y - cA.y, z: cB.z - cA.z };
  const dist = Math.hypot(dirAB.x, dirAB.y, dirAB.z);
  if (dist < 1e-6) return false;

  dirAB.x /= dist;
  dirAB.y /= dist;
  dirAB.z /= dist;

  const dirBA = { x: -dirAB.x, y: -dirAB.y, z: -dirAB.z };

  const alignmentA = Math.abs(normA.x * dirAB.x + normA.y * dirAB.y + normA.z * dirAB.z);
  const alignmentB = Math.abs(normB.x * dirBA.x + normB.y * dirBA.y + normB.z * dirBA.z);

  return alignmentA > 0.16 && alignmentB > 0.16;
}

function palmsFaceCamera(handA, handB, threshold = 0.55) {
  const normA = palmNormal(handA.points);
  const normB = palmNormal(handB.points);
  if (!normA || !normB) return false;
  return Math.abs(normA.z) > threshold && Math.abs(normB.z) > threshold;
}

// Pseudo-random generator with seed matching Python random.Random(seed)
function pseudoRandom(seed) {
  let s = Math.sin(seed) * 10000;
  return s - Math.floor(s);
}

// ============================================================================
// Core Visual Effects Rendering Helpers
// ============================================================================
function glow(ctx, x, y, radius, color, core = "#ffffff") {
  const r = Math.max(2, radius);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
  grad.addColorStop(0, core);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, x, y, radius, color, thickness = 2, startAngle = 0, endAngle = Math.PI * 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, radius), startAngle, endAngle);
  ctx.stroke();
}

function palmArcs(ctx, x, y, radius, color, accent, t, count = 9) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const startDeg = (t * 80 + (i * 360) / count) % 360;
    const start = (startDeg * Math.PI) / 180;
    const extent = ((22 + (i % 3) * 12) * Math.PI) / 180;
    const r = radius * (0.72 + 0.28 * (i % 2));

    ctx.strokeStyle = i % 2 === 0 ? color : accent;
    ctx.lineWidth = i % 3 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(2, r), Math.max(2, r * 0.78), 0, start, start + extent);
    ctx.stroke();
  }
  ctx.restore();
}

function particleCloud(ctx, x, y, radius, color, accent, t, count = 100, seed = 0) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const rngVal = pseudoRandom(Math.floor(t * 15) + seed * 997 + i * 37);
    const rngVal2 = pseudoRandom(Math.floor(t * 15) + seed * 997 + i * 37 + 101);
    const a = rngVal * Math.PI * 2 + t * 0.08;
    const r = radius * (0.2 + 0.85 * Math.sqrt(rngVal2));

    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    const pSize = (i % 5 === 0) ? 2.5 : 1.2;

    ctx.fillStyle = (i % 5 === 0) ? accent : color;
    ctx.beginPath();
    ctx.arc(px, py, pSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function mandala(ctx, cx, cy, radius, color, accent, t, dense = 1.0) {
  ctx.save();
  const rad = Math.max(25, radius);
  const scales = [1.0, 0.91, 0.79, 0.66, 0.53, 0.39, 0.25];

  // Concentric segmented rings
  for (let i = 0; i < scales.length; i++) {
    const r = rad * scales[i];
    const speed = i % 2 === 0 ? -17 : 22;
    const startDeg = (t * speed + i * 19) % 360;
    const start = (startDeg * Math.PI) / 180;
    const end = start + (342 * Math.PI) / 180;

    ring(ctx, cx, cy, r, i % 2 === 0 ? color : accent, i < 2 ? 3 : 1.5, start, end);
  }

  // Radial tick marks
  const tickCount = Math.floor(48 * dense);
  for (let i = 0; i < tickCount; i++) {
    const a = (Math.PI * 2 * i) / tickCount + t * 0.035;
    const r = rad * (i % 4 === 0 ? 0.72 : 0.82);
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const length = i % 3 === 0 ? 12 : 5;

    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;

    ctx.strokeStyle = i % 4 === 0 ? accent : color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - tx * length, y - ty * length);
    ctx.lineTo(x + tx * length, y + ty * length);
    ctx.stroke();
  }

  // Mystic Polygons (8-sided, 4-sided, 6-sided)
  const polygons = [
    { sides: 8, scale: 0.58, rotation: 22.5 },
    { sides: 4, scale: 0.40, rotation: 45.0 },
    { sides: 6, scale: 0.29, rotation: 0.0 }
  ];

  for (const poly of polygons) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < poly.sides; i++) {
      const a = (Math.PI * 2 * i) / poly.sides + (poly.rotation * Math.PI) / 180 + t * 0.025;
      const px = cx + Math.cos(a) * rad * poly.scale;
      const py = cy + Math.sin(a) * rad * poly.scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Glowing center glyph
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(5, rad * 0.12), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, rad * 0.055), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// MagicRenderer Class
// ============================================================================
class MagicRenderer {
  constructor() {
    this.motion = new Map();
    this.centralMotion = null;
  }

  motionScale(points, width, height, handId, elapsed) {
    const center = palmCenter(points);
    const centerPx = { x: center.x * width, y: center.y * height };

    const p5 = points[5];
    const p17 = points[17];
    const p0 = points[0];
    const p9 = points[9];

    const palmWidth = Math.hypot((p5.x - p17.x) * width, (p5.y - p17.y) * height);
    const palmHeight = Math.hypot((p0.x - p9.x) * width, (p0.y - p9.y) * height);
    const handSize = Math.max(18.0, (palmWidth + palmHeight) * 0.5);

    let smoothSpeed = 0.0;
    const old = this.motion.get(handId);
    if (old) {
      const dt = Math.max(1 / 120, Math.min(0.20, elapsed - old.time));
      const speed = Math.hypot(centerPx.x - old.center.x, centerPx.y - old.center.y) / dt;
      smoothSpeed = 0.70 * old.speed + 0.30 * speed;
    }

    this.motion.set(handId, { center: centerPx, time: elapsed, speed: smoothSpeed });

    const radius = Math.min(Math.max(handSize * 1.55, 38.0), 180.0);
    const motionBoost = Math.min(smoothSpeed / 850.0, 0.45);
    return { radius: radius * (1.0 + motionBoost * 0.35), motionBoost };
  }

  renderHand(ctx, character, hand, elapsed, handId = 0, width, height) {
    const points = hand.points;
    const center = palmCenter(points);
    const palm = { x: center.x * width, y: center.y * height };

    const { radius, motionBoost } = this.motionScale(points, width, height, handId, elapsed);
    const pulse = 1.0 + 0.08 * Math.sin(elapsed * 7.0);
    const r = radius * pulse;
    const name = character.name;

    ctx.save();
    // Use additive blending for realistic luminous glow
    ctx.globalCompositeOperation = "lighter";

    if (name === "DOCTOR STRANGE") {
      mandala(ctx, palm.x, palm.y, r * 1.30, character.color, character.accent, elapsed, 1.25);
      palmArcs(ctx, palm.x, palm.y, r * 0.83, "#ffaf00", "#64ebff", elapsed, 12);
      particleCloud(ctx, palm.x, palm.y, r * 0.85, character.color, "#82ebff", elapsed, 65, 1);
      glow(ctx, palm.x, palm.y, 9, "#ffaf00", "#fffae1");
    } 
    else if (name === "SCARLET WITCH") {
      glow(ctx, palm.x, palm.y, r * 0.82, "#cd0000", "#fff5ff");

      // Chaos magic orbiting ellipses
      for (let i = 0; i < 7; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.4 : 1.8) + (i * Math.PI * 2) / 7;
        const rx = r * (0.72 + i * 0.045);
        const ry = r * (0.48 + i * 0.035);

        ctx.strokeStyle = i % 2 === 0 ? "#be0000" : "#eb2346";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(palm.x, palm.y, rx, ry, a, 0, Math.PI * 1.85);
        ctx.stroke();
      }

      palmArcs(ctx, palm.x, palm.y, r * 0.95, "#dc0000", "#ff465f", elapsed, 14);
      particleCloud(ctx, palm.x, palm.y, r * 1.15, "#dc0000", "#ff5064", elapsed, 145, 2);
      glow(ctx, palm.x, palm.y, r * 0.22, "#f50000", "#ffffff");
    } 
    else if (name === "AGATHA HARKNESS") {
      glow(ctx, palm.x, palm.y, r * 0.88, "#af14cd", "#ffebff");

      for (let i = 0; i < 9; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.5 : 1.2) + (i * 20 * Math.PI) / 180;
        const rx = r * (0.62 + i * 0.055);
        const ry = r * (0.42 + i * 0.045);

        ctx.strokeStyle = i % 2 === 0 ? "#c323eb" : "#f591ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(palm.x, palm.y, rx, ry, a, 0, Math.PI * 1.85);
        ctx.stroke();
      }

      palmArcs(ctx, palm.x, palm.y, r * 0.95, "#b919dc", "#ff87ff", elapsed, 16);
      particleCloud(ctx, palm.x, palm.y, r * 1.18, "#b919dc", "#ff96ff", elapsed, 155, 3);
      glow(ctx, palm.x, palm.y, r * 0.24, "#cd2df0", "#ffffff");
    } 
    else if (name === "LOKI") {
      glow(ctx, palm.x, palm.y, r * 0.75, "#199114", "#dcffdc");

      for (let i = 0; i < 8; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.1 : 1.35) + (i * 23 * Math.PI) / 180;
        const rx = r * (0.58 + i * 0.06);
        const ry = r * (0.35 + i * 0.045);

        ctx.strokeStyle = i % 2 === 0 ? "#1eb419" : "#9bff91";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(palm.x, palm.y, rx, ry, a, 0.1, Math.PI * 1.8);
        ctx.stroke();
      }

      particleCloud(ctx, palm.x, palm.y, r * 1.12, "#1ea519", "#9bff91", elapsed, 125, 4);
      palmArcs(ctx, palm.x, palm.y, r * 0.90, "#1eb423", "#9bff91", elapsed, 10);
      glow(ctx, palm.x, palm.y, r * 0.20, "#2dc32d", "#ffffff");
    } 
    else if (name === "THOR") {
      glow(ctx, palm.x, palm.y, r * 0.72, "#1e96ff", "#ffffff");
      palmArcs(ctx, palm.x, palm.y, r * 1.05, "#41cdff", "#e1faff", elapsed, 13);

      // Procedural lightning bolts
      const boltSeed = Math.floor(elapsed * 28);
      for (let i = 0; i < 12; i++) {
        const a = elapsed * 0.9 + (i * Math.PI * 2) / 12;
        const rngReach = pseudoRandom(boltSeed + i * 17);
        const reach = r * (0.65 + 0.40 * rngReach);

        const endX = palm.x + Math.cos(a) * reach;
        const endY = palm.y + Math.sin(a) * reach * 0.78;

        const rngJitterX = (pseudoRandom(boltSeed + i * 31) - 0.5) * 16;
        const rngJitterY = (pseudoRandom(boltSeed + i * 47) - 0.5) * 16;
        const midX = (palm.x + endX) / 2 + rngJitterX;
        const midY = (palm.y + endY) / 2 + rngJitterY;

        ctx.strokeStyle = "#ffd769";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(palm.x, palm.y);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(endX, endY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      particleCloud(ctx, palm.x, palm.y, r * 1.10, "#41cdff", "#ffffff", elapsed, 100, 5);
    }

    ctx.restore();
  }

  renderTwoHandField(ctx, character, hands, elapsed, width, height) {
    if (hands.length < 2) return;

    const centerA = palmCenter(hands[0].points);
    const centerB = palmCenter(hands[1].points);

    const ax = centerA.x * width;
    const ay = centerA.y * height;
    const bx = centerB.x * width;
    const by = centerB.y * height;

    const midpoint = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    const distance = Math.hypot(bx - ax, by - ay);

    let centerSpeed = 0.0;
    let gapSpeed = 0.0;

    if (this.centralMotion) {
      const dt = Math.max(1 / 120, Math.min(0.20, elapsed - this.centralMotion.time));
      const speedNow = Math.hypot(midpoint.x - this.centralMotion.midpoint.x, midpoint.y - this.centralMotion.midpoint.y) / dt;
      const gapNow = (distance - this.centralMotion.distance) / dt;

      centerSpeed = 0.68 * this.centralMotion.centerSpeed + 0.32 * speedNow;
      gapSpeed = 0.68 * this.centralMotion.gapSpeed + 0.32 * gapNow;
    }

    this.centralMotion = {
      midpoint,
      distance,
      time: elapsed,
      centerSpeed,
      gapSpeed
    };

    const baseRadius = Math.min(Math.max(distance * 0.25, 32.0), 135.0);
    const spreadBoost = Math.min(Math.max(0.0, gapSpeed) / 650.0, 0.55);
    const motionBoost = Math.min(centerSpeed / 1100.0, 0.38);

    const pulse = 1.0 + 0.10 * Math.sin(elapsed * 6.0);
    const radius = Math.min(Math.max(baseRadius * (1.0 + spreadBoost + motionBoost) * pulse, 30.0), 190.0);

    const name = character.name;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (name === "DOCTOR STRANGE") {
      mandala(ctx, midpoint.x, midpoint.y, radius * 1.35, character.color, character.accent, elapsed, 1.7);
      particleCloud(ctx, midpoint.x, midpoint.y, radius * 1.20, character.color, "#64e6ff", elapsed, 180, 20);
      glow(ctx, midpoint.x, midpoint.y, radius * 0.30, "#ffaa00", "#ffffff");
    } 
    else if (name === "SCARLET WITCH") {
      glow(ctx, midpoint.x, midpoint.y, radius, "#d20000", "#fff5ff");

      for (let i = 0; i < 12; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.5 : 1.4) + (i * 30 * Math.PI) / 180;
        const rx = radius * (0.68 + i * 0.05);
        const ry = radius * (0.45 + i * 0.035);

        ctx.strokeStyle = i % 2 === 0 ? "#ba0000" : "#eb2346";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(midpoint.x, midpoint.y, rx, ry, a, 0, Math.PI * 1.9);
        ctx.stroke();
      }

      particleCloud(ctx, midpoint.x, midpoint.y, radius * 1.40, "#c80000", "#ff6478", elapsed, 210, 21);
      glow(ctx, midpoint.x, midpoint.y, radius * 0.35, "#f50000", "#ffffff");
    } 
    else if (name === "AGATHA HARKNESS") {
      glow(ctx, midpoint.x, midpoint.y, radius, "#b919dc", "#ffffff");

      for (let i = 0; i < 14; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.3 : 1.5) + (i * 22 * Math.PI) / 180;
        const rx = radius * (0.65 + i * 0.05);
        const ry = radius * (0.40 + i * 0.04);

        ctx.strokeStyle = "#c323eb";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(midpoint.x, midpoint.y, rx, ry, a, 0, Math.PI * 1.9);
        ctx.stroke();
      }

      particleCloud(ctx, midpoint.x, midpoint.y, radius * 1.40, "#b919dc", "#ff91f5", elapsed, 220, 22);
    } 
    else if (name === "LOKI") {
      glow(ctx, midpoint.x, midpoint.y, radius, "#199114", "#dcffdc");

      for (let i = 0; i < 12; i++) {
        const a = elapsed * (i % 2 === 0 ? -1.1 : 1.3) + (i * 25 * Math.PI) / 180;
        const rx = radius * (0.60 + i * 0.05);
        const ry = radius * (0.40 + i * 0.04);

        ctx.strokeStyle = "#23af23";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(midpoint.x, midpoint.y, rx, ry, a, 0, Math.PI * 1.9);
        ctx.stroke();
      }

      particleCloud(ctx, midpoint.x, midpoint.y, radius * 1.40, "#1ea519", "#9bff91", elapsed, 190, 23);
    } 
    else if (name === "THOR") {
      glow(ctx, midpoint.x, midpoint.y, radius, "#23a5ff", "#ffffff");

      const seed = Math.floor(elapsed * 30);
      for (let i = 0; i < 18; i++) {
        const a = elapsed * 0.8 + (i * Math.PI * 2) / 18;
        const rngReach = pseudoRandom(seed + i * 29);
        const reach = radius * (0.65 + rngReach * 0.45);

        const endX = midpoint.x + Math.cos(a) * reach;
        const endY = midpoint.y + Math.sin(a) * reach;

        const jitterX = (pseudoRandom(seed + i * 53) - 0.5) * 24;
        const jitterY = (pseudoRandom(seed + i * 71) - 0.5) * 24;
        const midX = (midpoint.x + endX) / 2 + jitterX;
        const midY = (midpoint.y + endY) / 2 + jitterY;

        ctx.strokeStyle = "#ffd769";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(midpoint.x, midpoint.y);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      particleCloud(ctx, midpoint.x, midpoint.y, radius * 1.30, "#41cdff", "#ffffff", elapsed, 160, 24);
    }

    ctx.restore();
  }
}
