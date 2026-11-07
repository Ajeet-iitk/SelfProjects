/* ==========================================================================
   Underwater background
   One canvas draws the whole reef:
   - god rays, drifting marine snow and rising bubbles
   - schools of fish, jellyfish and the occasional manta ray
   - a coral reef and a sunken ship along the sea floor
   - ripples and bubble bursts that follow the pointer
   Day = sunlit shallow water, night = deep bioluminescent sea.
   Pauses when the tab is hidden; renders one static frame when the visitor
   prefers reduced motion.
   ========================================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let W = 0;
  let H = 0;
  let DPR = 1;

  let theme = root.getAttribute("data-theme") === "light" ? "light" : "dark";

  /* ------------------------------------------------------------------ */
  /* palettes                                                            */
  /* ------------------------------------------------------------------ */

  const PALETTES = {
    dark: {
      ray: "150, 235, 255",
      rayAlpha: 0.07,
      caustic: "120, 230, 250",
      snow: "200, 240, 255",
      snowAlpha: 0.5,
      bubble: "185, 240, 255",
      reefTop: "#0a3a46",
      reef: "#052730",
      reefMid: "#083843",
      reefLight: "#0d5560",
      reefEdge: "rgba(80, 205, 220, 0.28)",
      wreck: "#051f28",
      fish: ["#8fe3f2", "#6cc8e8", "#ffd173", "#ff9d7a", "#a8f0d8", "#c9b6ff"],
      fishLine: "rgba(3, 18, 26, 0.55)",
      jelly: ["rgba(120, 232, 255, 0.55)", "rgba(186, 148, 255, 0.5)", "rgba(120, 255, 214, 0.45)"],
      manta: "rgba(5, 26, 34, 0.62)",
      ripple: "150, 240, 255",
      rippleAlpha: 0.45,
    },
    light: {
      ray: "255, 255, 255",
      rayAlpha: 0.35,
      caustic: "255, 255, 255",
      snow: "255, 255, 255",
      snowAlpha: 0.65,
      bubble: "255, 255, 255",
      reefTop: "#c2e8ee",
      reef: "#8fc9d4",
      reefMid: "#7cbcc9",
      reefLight: "#2f9aa8",
      reefEdge: "rgba(255, 255, 255, 0.5)",
      wreck: "#2c7f8c",
      fish: ["#1d7f9f", "#2b9cc0", "#e8931f", "#e7653f", "#2f9c84", "#6a74c9"],
      fishLine: "rgba(240, 252, 255, 0.7)",
      jelly: ["rgba(64, 190, 210, 0.6)", "rgba(120, 200, 240, 0.5)", "rgba(230, 150, 190, 0.45)"],
      manta: "rgba(8, 72, 86, 0.38)",
      ripple: "20, 140, 165",
      rippleAlpha: 0.5,
    },
  };

  let P = PALETTES[theme];

  /* ------------------------------------------------------------------ */
  /* scene state                                                         */
  /* ------------------------------------------------------------------ */

  let fish = [];
  let jellies = [];
  let bubbles = [];
  let ripples = [];
  let snow = [];
  let rays = [];
  let kelp = [];
  let manta = null;
  let mantaTimer = 12;
  let reefSprite = null;
  let reefH = 0;

  let raf = 0;
  let last = 0;

  /* ------------------------------------------------------------------ */
  /* sea floor sprite                                                    */
  /* ------------------------------------------------------------------ */

  function coralBranch(g, x, y, len, angle, width, depth, color) {
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;

    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();

    if (depth <= 0) return;

    const spread = rand(0.35, 0.75);
    coralBranch(g, x2, y2, len * rand(0.55, 0.75), angle - spread, width * 0.68, depth - 1, color);
    coralBranch(g, x2, y2, len * rand(0.5, 0.72), angle + spread * 0.85, width * 0.62, depth - 1, color);
    if (Math.random() < 0.4) {
      coralBranch(g, x2, y2, len * 0.45, angle + rand(-0.2, 0.2), width * 0.5, depth - 1, color);
    }
  }

  function fanCoral(g, x, y, r, color) {
    g.strokeStyle = color;
    g.lineWidth = 1.2;
    g.lineCap = "round";

    // ribs
    for (let i = 0; i <= 8; i += 1) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(
        x + Math.cos(a) * r * 0.6,
        y + Math.sin(a) * r * 0.85,
        x + Math.cos(a) * r,
        y + Math.sin(a) * r
      );
      g.stroke();
    }

    // cross webs
    for (let ring = 0.35; ring < 1; ring += 0.28) {
      g.beginPath();
      for (let i = 0; i <= 8; i += 1) {
        const a = Math.PI + (i / 8) * Math.PI;
        const px = x + Math.cos(a) * r * ring;
        const py = y + Math.sin(a) * r * ring * 0.92;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
  }

  function tubeCoral(g, x, y, color) {
    const n = 3 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i += 1) {
      const h = rand(16, 46);
      const w = rand(5, 9);
      const ox = x + i * rand(6, 10) - n * 3;
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(ox, y - h, w, h + 6, w / 2);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.18)";
      g.beginPath();
      g.ellipse(ox + w / 2, y - h + 2, w * 0.4, w * 0.28, 0, 0, TAU);
      g.fill();
    }
  }

  function drawWreck(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.rotate(-0.06);
    g.scale(s, s);

    // hull
    g.fillStyle = P.wreck;
    g.strokeStyle = P.reefEdge;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-86, -10);
    g.lineTo(80, -10);
    g.quadraticCurveTo(96, 8, 66, 24);
    g.lineTo(-62, 24);
    g.quadraticCurveTo(-94, 12, -86, -10);
    g.closePath();
    g.fill();
    g.stroke();

    // broken deck line
    g.beginPath();
    g.moveTo(-84, -6);
    g.lineTo(80, -6);
    g.stroke();

    // portholes
    g.fillStyle = "rgba(120, 235, 250, 0.28)";
    for (let i = 0; i < 4; i += 1) {
      g.beginPath();
      g.arc(-46 + i * 30, 6, 4.2, 0, TAU);
      g.fill();
    }

    // masts + torn sails
    g.strokeStyle = P.wreck;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-18, -8);
    g.lineTo(-18, -96);
    g.moveTo(-56, -70);
    g.lineTo(22, -70);
    g.moveTo(44, -8);
    g.lineTo(50, -66);
    g.stroke();

    g.fillStyle = "rgba(255, 255, 255, 0.05)";
    g.beginPath();
    g.moveTo(-18, -92);
    g.lineTo(20, -74);
    g.lineTo(-18, -56);
    g.closePath();
    g.fill();

    g.beginPath();
    g.moveTo(50, -62);
    g.lineTo(20, -44);
    g.lineTo(50, -30);
    g.closePath();
    g.fill();

    // seaweed on the hull
    g.strokeStyle = P.reefLight;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(-60 + i * 44, -8);
      g.quadraticCurveTo(-64 + i * 44, -24, -54 + i * 44, -34);
      g.stroke();
    }

    g.restore();
  }

  function buildReef() {
    reefH = clamp(H * 0.28, 170, 320);

    const sprite = document.createElement("canvas");
    sprite.width = Math.max(1, Math.round(W * DPR));
    sprite.height = Math.max(1, Math.round(reefH * DPR));
    const g = sprite.getContext("2d");
    g.scale(DPR, DPR);

    const baseY = reefH;
    const floor = (x) =>
      reefH * 0.62 +
      Math.sin((x / W) * 4.2 + 1.2) * 22 +
      Math.sin((x / W) * 9.5) * 8;

    // sand / rock bank
    const sand = g.createLinearGradient(0, reefH * 0.45, 0, reefH);
    sand.addColorStop(0, P.reefTop);
    sand.addColorStop(1, P.reef);

    g.fillStyle = sand;
    g.beginPath();
    g.moveTo(0, baseY);
    g.lineTo(0, floor(0));
    for (let x = 0; x <= W; x += 18) g.lineTo(x, floor(x));
    g.lineTo(W, baseY);
    g.closePath();
    g.fill();
    g.fillStyle = P.reef;

    // distant rocks
    g.fillStyle = P.reefMid;
    for (let i = 0; i < 7; i += 1) {
      const x = (i / 7) * W + rand(-30, 30);
      const r = rand(30, 86);
      const y = floor(x) + rand(-6, 14);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.42, rand(-0.2, 0.2), 0, TAU);
      g.fill();
    }

    // coral clusters
    const clusters = W < 640 ? 5 : 9;
    for (let i = 0; i < clusters; i += 1) {
      const x = ((i + 0.5) / clusters) * W + rand(-26, 26);
      const y = floor(x) + rand(0, 8);
      const kind = i % 3;

      if (kind === 0) {
        g.fillStyle = pick([P.reefLight, P.reefMid]);
        g.globalAlpha = 0.95;
        for (let b = 0; b < 4; b += 1) {
          coralBranch(
            g,
            x + rand(-10, 10),
            y,
            rand(18, 30),
            -Math.PI / 2 + rand(-0.4, 0.4),
            rand(4, 6),
            4,
            pick([P.reefLight, P.reefMid])
          );
        }
        g.globalAlpha = 1;
      } else if (kind === 1) {
        g.globalAlpha = 0.9;
        fanCoral(g, x, y, rand(30, 52), P.reefLight);
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = 1;
        tubeCoral(g, x, y, pick([P.reefMid, P.reefLight]));
      }
    }

    // the wreck, offset from the busiest coral
    drawWreck(g, W > 900 ? W * 0.78 : W * 0.8, floor(W * 0.8) + 30, W < 640 ? 0.78 : 1.12);

    // fine speckles
    g.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let i = 0; i < 70; i += 1) {
      g.beginPath();
      g.arc(rand(0, W), rand(reefH * 0.5, reefH), rand(0.6, 1.7), 0, TAU);
      g.fill();
    }

    reefSprite = sprite;
  }

  /* ------------------------------------------------------------------ */
  /* inhabitants                                                         */
  /* ------------------------------------------------------------------ */

  function makeFish(sizeRange, zRange, alphaRange) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      x: rand(-80, W + 80),
      y: rand(H * 0.08, H * 0.9),
      baseY: 0,
      size: rand(sizeRange[0], sizeRange[1]),
      dir,
      speed: rand(9, 26),
      phase: rand(0, TAU),
      wobble: rand(4, 16),
      z: rand(zRange[0], zRange[1]),
      alpha: rand(alphaRange[0], alphaRange[1]),
      color: pick(P.fish),
      kind: Math.random() < 0.18 ? "clown" : Math.random() < 0.3 ? "tang" : "plain",
    };
  }

  function buildFish() {
    fish = [];

    // far school
    const schoolN = W < 640 ? 12 : 20;
    for (let i = 0; i < schoolN; i += 1) {
      const f = makeFish([3.4, 6.5], [0.45, 0.7], [0.35, 0.6]);
      f.speed = rand(12, 22);
      fish.push(f);
    }

    // mid fish
    const midN = W < 640 ? 5 : 8;
    for (let i = 0; i < midN; i += 1) fish.push(makeFish([8, 15], [0.7, 1], [0.6, 0.9]));

    // close-up fish
    const nearN = W < 640 ? 1 : 2;
    for (let i = 0; i < nearN; i += 1) fish.push(makeFish([18, 26], [1, 1.15], [0.75, 0.95]));

    for (const f of fish) f.baseY = f.y;

    fish.sort((a, b) => a.z - b.z);

    jellies = Array.from({ length: W < 640 ? 2 : 4 }, () => ({
      x: rand(W * 0.1, W * 0.9),
      y: rand(0, H),
      r: rand(14, 30),
      phase: rand(0, TAU),
      speed: rand(5, 13),
      drift: rand(6, 16),
      color: pick(P.jelly),
    }));

    bubbles = Array.from({ length: W < 640 ? 16 : 30 }, () => makeBubble(rand(0, H)));

    snow = Array.from({ length: W < 640 ? 26 : 60 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.4, 1.6),
      speed: rand(2, 9),
      phase: rand(0, TAU),
    }));

    rays = Array.from({ length: 7 }, (_, i) => ({
      x: ((i + 0.5) / 7) * W + rand(-40, 40),
      w: rand(60, 190),
      sway: rand(0.1, 0.3),
      phase: rand(0, TAU),
      angle: rand(-0.18, 0.18),
    }));

    kelp = Array.from({ length: W < 640 ? 5 : 9 }, () => ({
      x: rand(0, W),
      h: rand(50, 150),
      w: rand(3, 7),
      phase: rand(0, TAU),
      speed: rand(0.4, 0.9),
      color: pick([P.reefLight, P.reefMid]),
    }));

    manta = null;
    mantaTimer = rand(6, 14);
  }

  function makeBubble(y) {
    return {
      x: rand(0, W),
      y: y === undefined ? H + rand(0, 80) : y,
      r: rand(1.4, 4.6),
      vy: rand(14, 34),
      phase: rand(0, TAU),
      alpha: rand(0.25, 0.65),
    };
  }

  /* ------------------------------------------------------------------ */
  /* drawing helpers                                                     */
  /* ------------------------------------------------------------------ */

  function drawRays(t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const r of rays) {
      const sway = Math.sin(t * 0.22 + r.phase) * r.sway;
      const x = r.x + sway * 90;
      const w = r.w * (0.85 + 0.15 * Math.sin(t * 0.4 + r.phase));
      const len = H * (0.62 + 0.16 * Math.sin(t * 0.16 + r.phase));

      ctx.save();
      ctx.translate(x, -60);
      ctx.rotate(r.angle + sway * 0.25);

      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, `rgba(${P.ray}, ${P.rayAlpha})`);
      grad.addColorStop(0.45, `rgba(${P.ray}, ${P.rayAlpha * 0.4})`);
      grad.addColorStop(1, `rgba(${P.ray}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);
      ctx.lineTo(w * 0.5, 0);
      ctx.lineTo(w * 1.5, len);
      ctx.lineTo(-w * 1.1, len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFish(f, t) {
    const s = f.size / 20;
    const wag = Math.sin(t * (5 + f.z * 3) + f.phase);

    ctx.save();
    ctx.translate(f.x, f.y + Math.sin(t * (0.6 + f.z * 0.5) + f.phase) * f.wobble);
    ctx.rotate(Math.sin(t * 0.7 + f.phase) * 0.05 * f.dir);
    ctx.scale(f.dir * s, s);
    ctx.globalAlpha = f.alpha;

    // tail
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(17, -6.5 + wag * 3.6);
    ctx.lineTo(17, 6.5 + wag * 3.6);
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.globalAlpha = f.alpha * 0.82;
    ctx.fill();

    // dorsal fin
    ctx.globalAlpha = f.alpha * 0.75;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.quadraticCurveTo(-1, -10, 5, -5.4);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.globalAlpha = f.alpha;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5.6, 0, 0, TAU);
    ctx.fillStyle = f.color;
    ctx.fill();

    // belly sheen
    ctx.globalAlpha = f.alpha * 0.35;
    ctx.beginPath();
    ctx.ellipse(0.5, 2, 7.2, 2.6, 0, 0, TAU);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    // stripes
    if (f.kind === "clown") {
      ctx.save();
      ctx.globalAlpha = f.alpha * 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5.6, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(-4.5, -6, 2.6, 12);
      ctx.fillRect(2.5, -6, 2.6, 12);
      ctx.restore();
    } else if (f.kind === "tang") {
      ctx.save();
      ctx.globalAlpha = f.alpha * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5.6, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = "rgba(4, 24, 32, 0.55)";
      ctx.fillRect(3, -6, 7, 12);
      ctx.restore();
    }

    // eye
    ctx.globalAlpha = Math.min(1, f.alpha + 0.2);
    ctx.beginPath();
    ctx.arc(-6.2, -1.5, 1.25, 0, TAU);
    ctx.fillStyle = P.fishLine;
    ctx.fill();

    ctx.restore();
  }

  function drawJelly(j, t) {
    const bob = Math.sin(t * 0.7 + j.phase);
    const y = j.y + bob * 6;

    ctx.save();
    ctx.translate(j.x + Math.sin(t * 0.3 + j.phase) * j.drift, y);
    ctx.globalAlpha = 0.9;

    ctx.shadowColor = j.color;
    ctx.shadowBlur = 22;

    const grad = ctx.createRadialGradient(0, -j.r * 0.35, j.r * 0.15, 0, 0, j.r * 1.1);
    grad.addColorStop(0, j.color);
    grad.addColorStop(1, "rgba(255, 255, 255, 0.02)");

    // bell
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, j.r, j.r * 0.82, 0, Math.PI, 0);
    ctx.quadraticCurveTo(j.r * 0.6, j.r * 0.24, 0, j.r * 0.26);
    ctx.quadraticCurveTo(-j.r * 0.6, j.r * 0.24, -j.r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // tentacles
    ctx.strokeStyle = j.color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i += 1) {
      const ox = (i - 2) * j.r * 0.34;
      ctx.beginPath();
      ctx.moveTo(ox, j.r * 0.18);
      ctx.bezierCurveTo(
        ox + Math.sin(t * 1.1 + i + j.phase) * 7,
        j.r * 1.1,
        ox - Math.sin(t * 0.9 + i + j.phase) * 9,
        j.r * 1.8,
        ox + Math.sin(t * 1.3 + i) * 6,
        j.r * 2.5
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawManta(t) {
    if (!manta) return;
    const { x, y, size, dir, phase, alpha } = manta;
    const flap = Math.sin(t * 1.4 + phase);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = P.manta;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.1);
    ctx.bezierCurveTo(
      size * 0.45,
      -size * 0.34 - flap * size * 0.16,
      size * 0.9,
      -size * 0.1 - flap * size * 0.2,
      size * 0.34,
      size * 0.16
    );
    ctx.quadraticCurveTo(size * 0.15, size * 0.3, 0, size * 0.3);
    ctx.quadraticCurveTo(-size * 0.15, size * 0.3, -size * 0.34, size * 0.16);
    ctx.bezierCurveTo(
      -size * 0.9,
      -size * 0.1 - flap * size * 0.2,
      -size * 0.45,
      -size * 0.34 - flap * size * 0.16,
      0,
      -size * 0.1
    );
    ctx.closePath();
    ctx.fill();

    // tail
    ctx.strokeStyle = P.manta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.28);
    ctx.quadraticCurveTo(size * 0.06, size * 0.7, -size * 0.02, size * 1.05);
    ctx.stroke();

    ctx.restore();
  }

  function drawBubbles() {
    for (const b of bubbles) {
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = `rgba(${P.bubble}, 0.7)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = `rgba(${P.bubble}, 0.22)`;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRipples() {
    if (!ripples.length) return;

    ctx.save();
    if (theme === "dark") ctx.globalCompositeOperation = "lighter";

    for (const r of ripples) {
      const p = r.age / r.life;
      const a = (1 - p) * P.rippleAlpha;

      for (let i = 0; i < 3; i += 1) {
        const rr = r.radius * (p + i * 0.22);
        if (rr <= 0.5 || rr > r.max) continue;
        ctx.strokeStyle = `rgba(${P.ripple}, ${a * (1 - i * 0.28)})`;
        ctx.lineWidth = 1.6 - i * 0.35;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rr, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawKelp(t) {
    ctx.save();
    ctx.globalAlpha = theme === "dark" ? 0.55 : 0.35;
    ctx.lineCap = "round";

    for (const k of kelp) {
      const sway = Math.sin(t * k.speed + k.phase) * 16;
      const base = H - 10;

      ctx.strokeStyle = k.color;
      ctx.lineWidth = k.w;
      ctx.beginPath();
      ctx.moveTo(k.x, base);
      ctx.bezierCurveTo(
        k.x + sway * 0.3,
        base - k.h * 0.4,
        k.x - sway * 0.6,
        base - k.h * 0.72,
        k.x + sway,
        base - k.h
      );
      ctx.stroke();

      // leaves
      ctx.lineWidth = Math.max(1, k.w * 0.4);
      for (let i = 1; i <= 3; i += 1) {
        const yy = base - (k.h * i) / 4;
        const xx = k.x + sway * (i / 4) * 0.9;
        const side = i % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.quadraticCurveTo(xx + side * 16, yy - 8, xx + side * 26, yy - 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* sizing                                                              */
  /* ------------------------------------------------------------------ */

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    buildFish();
    buildReef();
  }

  /* ------------------------------------------------------------------ */
  /* updates                                                             */
  /* ------------------------------------------------------------------ */

  function addRipple(x, y, scale) {
    if (reduce.matches) return;
    ripples.push({
      x,
      y,
      age: 0,
      life: rand(0.8, 1.3),
      radius: rand(26, 40) * scale,
      max: rand(90, 150) * scale,
    });
    if (ripples.length > 34) ripples.shift();

    const n = Math.round(3 * scale) + 1;
    for (let i = 0; i < n; i += 1) {
      const b = makeBubble(y);
      b.x = x + rand(-10, 10) * scale;
      b.y = y + rand(-8, 8);
      b.r = rand(1, 3.4);
      b.alpha = rand(0.2, 0.6);
      bubbles.push(b);
      if (bubbles.length > 90) bubbles.shift();
    }
  }

  function update(dt, t) {
    for (const f of fish) {
      f.x += f.dir * f.speed * f.z * dt;
      const margin = 90;
      if (f.dir > 0 && f.x > W + margin) {
        f.x = -margin;
        f.y = rand(H * 0.08, H * 0.9);
        f.baseY = f.y;
      } else if (f.dir < 0 && f.x < -margin) {
        f.x = W + margin;
        f.y = rand(H * 0.08, H * 0.9);
        f.baseY = f.y;
      }
    }

    for (const j of jellies) {
      j.y -= j.speed * dt;
      if (j.y < -j.r * 4) {
        j.y = H + rand(20, 140);
        j.x = rand(W * 0.08, W * 0.92);
      }
    }

    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      b.y -= b.vy * dt;
      b.x += Math.sin(t * 1.4 + b.phase) * 8 * dt;
      if (b.y < -12) {
        if (bubbles.length > 40) bubbles.splice(i, 1);
        else {
          b.y = H + rand(10, 80);
          b.x = rand(0, W);
        }
      }
    }

    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.age += dt;
      if (r.age >= r.life) ripples.splice(i, 1);
    }

    for (const s of snow) {
      s.y += s.speed * dt;
      s.x += Math.sin(t * 0.5 + s.phase) * 4 * dt;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = rand(0, W);
      }
    }

    if (manta) {
      manta.x += manta.speed * manta.dir * dt;
      if (manta.dir > 0 && manta.x > W + manta.size * 2) manta = null;
      if (manta.dir < 0 && manta.x < -manta.size * 2) manta = null;
    } else {
      mantaTimer -= dt;
      if (mantaTimer <= 0) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        manta = {
          x: dir > 0 ? -140 : W + 140,
          y: rand(H * 0.42, H * 0.78),
          size: rand(80, 150),
          dir,
          speed: rand(16, 30),
          phase: rand(0, TAU),
          alpha: theme === "dark" ? rand(0.45, 0.7) : rand(0.3, 0.5),
        };
        mantaTimer = rand(22, 40);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                */
  /* ------------------------------------------------------------------ */

  function paint(t) {
    ctx.clearRect(0, 0, W, H);

    // deep-water tint
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    if (theme === "dark") {
      tint.addColorStop(0, "rgba(10, 54, 68, 0.28)");
      tint.addColorStop(0.55, "rgba(3, 18, 26, 0.12)");
      tint.addColorStop(1, "rgba(1, 8, 12, 0.35)");
    } else {
      tint.addColorStop(0, "rgba(255, 255, 255, 0.1)");
      tint.addColorStop(0.6, "rgba(190, 235, 245, 0.04)");
      tint.addColorStop(1, "rgba(120, 200, 218, 0.16)");
    }
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);

    drawRays(t);
    drawManta(t);
    drawJellyfishAll(t);

    // fish behind the reef
    for (const f of fish) drawFish(f, t);

    drawKelp(t);

    if (reefSprite) {
      ctx.globalAlpha = theme === "dark" ? 0.92 : 0.8;
      ctx.drawImage(reefSprite, 0, H - reefH, W, reefH);
      ctx.globalAlpha = 1;
    }

    // marine snow
    ctx.fillStyle = `rgba(${P.snow}, ${P.snowAlpha})`;
    for (const s of snow) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawBubbles();
    drawRipples();
  }

  function drawJellyfishAll(t) {
    for (const j of jellies) drawJelly(j, t);
  }

  function frame(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const t = now / 1000;

    update(dt, t);
    paint(t);
    raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    paint(performance.now() / 1000);
  }

  function start() {
    if (raf) return;
    if (reduce.matches) {
      renderStatic();
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------------------------------------------ */
  /* wiring                                                              */
  /* ------------------------------------------------------------------ */

  function applyTheme(next) {
    theme = next;
    P = PALETTES[theme];

    // Repaint the residents in the new palette.
    const school = P.fish;
    fish.forEach((f, i) => {
      f.color = school[i % school.length];
    });
    jellies.forEach((j, i) => {
      j.color = P.jelly[i % P.jelly.length];
    });
    kelp.forEach((k, i) => {
      k.color = i % 2 ? P.reefMid : P.reefLight;
    });

    buildReef();
    if (reduce.matches) renderStatic();
  }

  document.addEventListener("themechange", (e) => {
    applyTheme(e.detail && e.detail.theme === "light" ? "light" : "dark");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  // Ripples follow the pointer; clicks make a bigger splash.
  let lastX = 0;
  let lastY = 0;
  let travel = 0;
  let lastRipple = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (reduce.matches) return;
      const now = performance.now();
      travel += Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;

      if (now - lastRipple > 70 && travel > 26) {
        addRipple(e.clientX, e.clientY, 1);
        travel = 0;
        lastRipple = now;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (reduce.matches) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      addRipple(e.clientX, e.clientY, 1.7);
      lastRipple = performance.now();
      travel = 0;
    },
    { passive: true }
  );

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reduce.matches) renderStatic();
    }, 160);
  });

  reduce.addEventListener?.("change", () => {
    stop();
    if (reduce.matches) {
      ripples = [];
      renderStatic();
    } else {
      start();
    }
  });

  resize();
  renderStatic();
  start();
})();
