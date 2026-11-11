/* ==========================================================================
   Underwater background
   One canvas draws the whole reef:
   - god rays, drifting marine snow and rising bubbles
   - schools of fish, jellyfish and the occasional manta ray
   - a coral reef and a sunken ship along the sea floor
   - deeper visitors (turtles, sharks, a whale, anglerfish) that appear as
     the page is scrolled and react to the pointer
   - ripples and bubble bursts that follow the pointer
   Day = sunlit shallow water, night = deep bioluminescent sea.
   Pauses when the tab is hidden; renders one static frame when the visitor
   prefers reduced motion.
   ========================================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  let ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  // A transparent foreground canvas lets one diver pass in front of the copy.
  const frontCanvas = document.getElementById("diver-front");
  const frontCtx = frontCanvas ? frontCanvas.getContext("2d", { alpha: true }) : null;

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
      whale: "rgba(7, 22, 54, 0.93)",
      whaleLine: "rgba(120, 235, 255, 0.6)",
      shark: "rgba(20, 12, 50, 0.94)",
      sharkLine: "rgba(190, 150, 255, 0.55)",
      turtleShell: "rgba(5, 40, 54, 0.95)",
      turtleSkin: "rgba(8, 52, 66, 0.95)",
      turtleLine: "rgba(110, 255, 214, 0.8)",
      angler: "rgba(32, 10, 46, 0.95)",
      anglerLine: "rgba(255, 140, 230, 0.55)",
      lure: "rgba(150, 255, 220, 0.95)",
      creatureEye: "rgba(200, 250, 255, 0.85)",
      fish: ["#8fe3f2", "#6cc8e8", "#ffd173", "#ff9d7a", "#a8f0d8", "#c9b6ff"],
      fishLine: "rgba(3, 18, 26, 0.55)",
      jelly: ["rgba(120, 232, 255, 0.55)", "rgba(186, 148, 255, 0.5)", "rgba(120, 255, 214, 0.45)"],
      manta: "rgba(5, 26, 34, 0.62)",
      ripple: "150, 240, 255",
      rippleAlpha: 0.45,
      plankton: "150, 255, 225",
      planktonAlpha: 0.95,
      causticAlpha: 0.13,
      starfish: "#ff9d7a",
      urchin: "#0b4450",
      anemone: "rgba(255, 120, 190, 0.85)",
      anemoneTip: "rgba(255, 214, 240, 0.95)",
      diver: "#0a2f3a",
      diverRim: "rgba(126, 240, 228, 0.45)",
      diverTank: "#ffc95c",
      diverTankBand: "rgba(5, 26, 32, 0.85)",
      diverMask: "rgba(190, 250, 255, 0.95)",
      diverHose: "rgba(150, 240, 255, 0.45)",
      torch: "255, 232, 170",
      spark: "255, 224, 140",
      diverPanel: "rgba(6, 34, 42, 0.62)",
      diverPanelLine: "rgba(120, 240, 230, 0.32)",
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
      whale: "rgba(23, 96, 112, 0.42)",
      whaleLine: "rgba(255, 255, 255, 0.5)",
      shark: "rgba(17, 79, 94, 0.52)",
      sharkLine: "rgba(255, 255, 255, 0.45)",
      turtleShell: "rgba(20, 104, 96, 0.6)",
      turtleSkin: "rgba(26, 122, 112, 0.7)",
      turtleLine: "rgba(255, 255, 255, 0.55)",
      angler: "rgba(14, 68, 82, 0.68)",
      anglerLine: "rgba(255, 255, 255, 0.4)",
      lure: "rgba(255, 232, 140, 0.95)",
      creatureEye: "rgba(255, 255, 255, 0.9)",
      fish: ["#1d7f9f", "#2b9cc0", "#e8931f", "#e7653f", "#2f9c84", "#6a74c9"],
      fishLine: "rgba(240, 252, 255, 0.7)",
      jelly: ["rgba(64, 190, 210, 0.6)", "rgba(120, 200, 240, 0.5)", "rgba(230, 150, 190, 0.45)"],
      manta: "rgba(8, 72, 86, 0.38)",
      ripple: "20, 140, 165",
      rippleAlpha: 0.5,
      plankton: "235, 255, 252",
      planktonAlpha: 0.75,
      causticAlpha: 0.3,
      starfish: "#e07a4f",
      urchin: "#3a7f8a",
      anemone: "rgba(210, 90, 140, 0.8)",
      anemoneTip: "rgba(255, 225, 240, 0.95)",
      diver: "#155663",
      diverRim: "rgba(255, 255, 255, 0.5)",
      diverTank: "#e9a94a",
      diverTankBand: "rgba(8, 52, 60, 0.8)",
      diverMask: "rgba(255, 255, 255, 0.95)",
      diverHose: "rgba(255, 255, 255, 0.5)",
      torch: "255, 206, 120",
      spark: "255, 170, 80",
      diverPanel: "rgba(236, 252, 252, 0.7)",
      diverPanelLine: "rgba(20, 110, 120, 0.28)",
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
  let plankton = [];
  let divers = [];
  let frontDivers = []; // two idle scuba cleaners working the foreground canvas

  let deep = [];
  let deepTimer = 1;
  let food = [];
  let watchLight = 1; // 1 = full daylight, falls toward 0 as Marine Watch dives
  let scrollProgress = 0;
  let scrollPx = 0;
  let docStatsTimer = 0;

  const pointer = { x: -9999, y: -9999, active: false, at: 0 };

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

  function drawStarfish(g, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.rotate(rand(-0.5, 0.5));
    g.fillStyle = color;
    g.globalAlpha = 0.9;
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const radius = i % 2 === 0 ? s : s * 0.42;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius * 0.86;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();

    // little bumps along each arm
    g.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      for (let k = 0.35; k < 0.85; k += 0.22) {
        g.beginPath();
        g.arc(Math.cos(a) * s * k, Math.sin(a) * s * k * 0.86, s * 0.055, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function drawUrchin(g, x, y, r, color) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, r * 0.09);
    g.lineCap = "round";
    const n = 15;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + rand(-0.1, 0.1);
      const len = r * rand(1.35, 1.9);
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len * 0.8);
      g.stroke();
    }
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, r * 0.72, r * 0.6, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    g.beginPath();
    g.arc(-r * 0.18, -r * 0.2, r * 0.2, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawAnemone(g, x, y, s, color, tipColor) {
    g.save();
    g.translate(x, y);
    g.lineCap = "round";
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + ((i - (n - 1) / 2) / n) * 2.1;
      const len = s * rand(0.75, 1.15);
      const ex = Math.cos(a) * len;
      const ey = Math.sin(a) * len;
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.4, s * 0.11);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(ex * 0.35, ey * 0.6, ex, ey);
      g.stroke();
      g.fillStyle = tipColor;
      g.beginPath();
      g.arc(ex, ey, Math.max(1.2, s * 0.075), 0, TAU);
      g.fill();
    }
    g.restore();
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

    // floor life: starfish, urchins and swaying anemones
    const decor = W < 640 ? 5 : 9;
    for (let i = 0; i < decor; i += 1) {
      const x = rand(W * 0.02, W * 0.98);
      const y = floor(x) + rand(2, 12);
      const kind = i % 3;

      if (kind === 0) {
        drawStarfish(g, x, y + 6, rand(7, 13), P.starfish);
      } else if (kind === 1) {
        drawUrchin(g, x, y + 2, rand(7, 13), P.urchin);
      } else {
        drawAnemone(g, x, y + 4, rand(14, 26), P.anemone, P.anemoneTip);
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
      vx: 0,
      vy: 0,
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

    // Bioluminescent plankton: tiny drifters that scatter away from the
    // pointer, denser and brighter in the deep-sea palette.
    const planktonN = Math.round(clamp((W * H) / 17000, 36, 120));
    plankton = Array.from({ length: planktonN }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      z: rand(0.3, 1),
      r: rand(0.6, 2.1),
      vx: 0,
      vy: 0,
      phase: rand(0, TAU),
      speed: rand(0.35, 1.1),
      drift: rand(4, 12),
    }));
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
  /* deeper visitors                                                     */
  /* ------------------------------------------------------------------ */

  // Each threshold is the scroll progress at which a creature joins the
  // scene (0 = top of the page, 1 = bottom).
  const DEEP_SPAWN_AT = {
    turtle: [0.14],
    shark: [0.28, 0.64],
    whale: [0.44],
    angler: [0.56, 0.8],
  };

  function targetCount(type, bias = 0) {
    const p = scrollProgress + bias;
    let n = 0;
    for (const at of DEEP_SPAWN_AT[type]) if (p >= at) n += 1;
    return n;
  }

  function pointerIsOn() {
    return !reduce.matches && pointer.active && performance.now() - pointer.at < 4200;
  }

  function makeDeep(type) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const c = {
      type,
      dir,
      phase: rand(0, TAU),
      startle: 0,
      leaving: false,
      speedMul: 1,
      z: 0.6,
      size: 60,
      speed: 20,
      amp: 10,
      w: 0.4,
      x: 0,
      y: 0,
      baseY: 0,
      entering: true,
    };

    if (type === "whale") {
      c.size = rand(170, 250);
      c.z = 0.34;
      c.speed = rand(9, 16);
      c.amp = rand(5, 14);
      c.w = rand(0.2, 0.4);
      c.y = rand(H * 0.24, H * 0.55);
    } else if (type === "shark") {
      c.size = rand(70, 112);
      c.z = rand(0.55, 0.7);
      c.speed = rand(28, 42);
      c.amp = rand(8, 18);
      c.w = rand(0.35, 0.6);
      c.y = rand(H * 0.3, H * 0.68);
    } else if (type === "turtle") {
      c.size = rand(42, 62);
      c.z = 0.82;
      c.speed = rand(14, 20);
      c.amp = rand(5, 11);
      c.w = rand(0.3, 0.55);
      c.y = rand(H * 0.36, H * 0.72);
    } else {
      c.size = rand(26, 38);
      c.z = 0.88;
      c.speed = rand(10, 15);
      c.amp = rand(6, 12);
      c.w = rand(0.4, 0.7);
      c.y = rand(H * 0.44, H * 0.78);
    }

    c.baseY = c.y;
    c.x = dir > 0 ? -c.size * 0.7 : W + c.size * 0.7;
    return c;
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
    // The fish is drawn facing left, so mirror it when it swims right.
    ctx.scale(-f.dir * s, s);
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

  /* ------------------------------------------------------------------ */
  /* deep-sea visitors: drawing                                          */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* bioluminescence: soft aura, glowing body rim, pulsing light spots    */
  /* ------------------------------------------------------------------ */

  // Glow is drawn from small pre-rendered sprites. canvas shadowBlur is far
  // too slow to run on dozens of shapes every frame.
  const glowSprites = new Map();

  function glowSprite(rgb) {
    let sp = glowSprites.get(rgb);
    if (sp) return sp;
    sp = document.createElement("canvas");
    sp.width = sp.height = 48;
    const g = sp.getContext("2d");
    const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, `rgba(${rgb}, 1)`);
    grad.addColorStop(0.25, `rgba(${rgb}, 0.55)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 48, 48);
    glowSprites.set(rgb, sp);
    return sp;
  }

  /** Soft coloured haze behind a creature (local, already-scaled coords). */
  function bioAura(rx, ry, rgb, t, phase) {
    const k = theme === "dark" ? 1 : 0.35;
    const pulse = 0.8 + 0.2 * Math.sin(t * 0.9 + phase);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha *= 0.22 * k * pulse;
    ctx.drawImage(glowSprite(rgb), -rx, -ry, rx * 2, ry * 2);
    ctx.restore();
  }

  // Kept as no-ops so the creature code reads the same; the rim glow now
  // comes from the coloured outline strokes instead of a shadow.
  function bioRim() {}
  function bioRimOff() {}

  /** Glowing dots whose brightness ripples along the body like a wave. */
  function bioDots(dots, rgb, t, phase, r) {
    const k = theme === "dark" ? 1 : 0.5;
    const sp = glowSprite(rgb);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const base = ctx.globalAlpha;
    for (let i = 0; i < dots.length; i += 1) {
      const wave = 0.5 + 0.5 * Math.sin(t * 1.7 - i * 0.55 + phase);
      ctx.globalAlpha = base * (0.3 + 0.7 * wave) * k;
      const d = r * (3.2 + wave * 1.6);
      ctx.drawImage(sp, dots[i][0] - d, dots[i][1] - d, d * 2, d * 2);
    }
    ctx.restore();
  }

  /** A glowing line: a wide faint stroke under a thin bright one. */
  function bioLine(trace, rgb, width, alpha) {
    const k = theme === "dark" ? 1 : 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.beginPath();
    trace();
    ctx.strokeStyle = `rgba(${rgb}, ${0.18 * alpha * k})`;
    ctx.lineWidth = width * 4;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * k})`;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  const FLASH_RGB = { whale: "90, 220, 255", shark: "190, 130, 255", turtle: "110, 255, 214", angler: "255, 120, 220" };

  function drawDeep(c, t) {
    if (c.type === "whale") drawWhale(c, t);
    else if (c.type === "shark") drawShark(c, t);
    else if (c.type === "turtle") drawTurtle(c, t);
    else drawAngler(c, t);

    // A well-fed creature lights up for a moment.
    if (c.flash > 0) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = Math.min(1, c.flash);
      for (let i = 0; i < 3; i += 1) bioAura(c.size * 1.3, c.size * 0.75, FLASH_RGB[c.type] || FLASH_RGB.whale, t, 0);
      ctx.restore();
    }
  }

  function drawWhale(c, t) {
    const s = c.size / 210;
    const bob = Math.sin(t * 0.5 + c.phase) * 4;
    const fluke = Math.sin(t * 0.8 + c.phase);

    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.scale(c.dir * s, s);
    ctx.globalAlpha = theme === "dark" ? 0.9 : 0.72;

    bioAura(170, 80, "80, 210, 255", t, c.phase);
    bioRim("80, 210, 255", 16);
    ctx.fillStyle = P.whale;

    // tail flukes
    ctx.beginPath();
    ctx.moveTo(-86, -2);
    ctx.bezierCurveTo(-108, -10 + fluke * 6, -124, -22 + fluke * 8, -132, -30 + fluke * 8);
    ctx.bezierCurveTo(-116, -16 + fluke * 5, -100, -8 + fluke * 3, -94, 0);
    ctx.bezierCurveTo(-100, 8 + fluke * 3, -116, 16 + fluke * 5, -132, 30 + fluke * 8);
    ctx.bezierCurveTo(-124, 22 + fluke * 8, -108, 10 + fluke * 6, -86, 2);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(98, 1);
    ctx.bezierCurveTo(86, -24, 44, -38, -8, -34);
    ctx.bezierCurveTo(-46, -31, -74, -18, -92, -2);
    ctx.bezierCurveTo(-74, 14, -46, 27, -8, 30);
    ctx.bezierCurveTo(44, 34, 86, 22, 98, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.whaleLine;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // pectoral fin
    ctx.beginPath();
    ctx.moveTo(38, 18);
    ctx.quadraticCurveTo(30, 44, 6, 56);
    ctx.quadraticCurveTo(14, 34, 16, 20);
    ctx.closePath();
    ctx.fill();

    // dorsal fin
    ctx.beginPath();
    ctx.moveTo(-40, -30);
    ctx.quadraticCurveTo(-48, -44, -58, -44);
    ctx.quadraticCurveTo(-54, -34, -56, -26);
    ctx.closePath();
    ctx.fill();

    // mouth line
    ctx.strokeStyle = P.whaleLine;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(96, 6);
    ctx.quadraticCurveTo(70, 14, 48, 10);
    ctx.stroke();

    // eye
    ctx.fillStyle = P.creatureEye;
    ctx.beginPath();
    ctx.arc(66, -6, 2.6, 0, TAU);
    ctx.fill();

    // belly pleats
    ctx.strokeStyle = P.whaleLine;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(92 - i * 8, 10 + i * 5);
      ctx.quadraticCurveTo(58 - i * 10, 22 + i * 5, 20 - i * 8, 20 + i * 5);
      ctx.stroke();
    }

    // back highlight
    ctx.strokeStyle = P.whaleLine;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(80, -22);
    ctx.quadraticCurveTo(36, -34, -20, -30);
    ctx.stroke();
    bioRimOff();

    // glowing markings: a travelling wave of light along flank and back
    const flank = [];
    const back = [];
    for (let i = 0; i < 12; i += 1) {
      const x = 76 - i * 14;
      flank.push([x, 4 + Math.sin(i * 0.6) * 3 + i * 0.4]);
      if (i < 10) back.push([x - 4, -20 - Math.cos(i * 0.28) * 4]);
    }
    bioDots(flank, "110, 235, 255", t, c.phase, 1.9);
    bioDots(back, "150, 190, 255", t, c.phase + 1.2, 1.5);
    bioLine(() => {
      ctx.moveTo(80, -22);
      ctx.quadraticCurveTo(36, -34, -20, -30);
    }, "120, 235, 255", 1.4, 0.55);
    bioLine(() => {
      ctx.moveTo(38, 18);
      ctx.quadraticCurveTo(30, 44, 6, 56);
    }, "120, 235, 255", 1.2, 0.5);
    bioLine(() => {
      ctx.moveTo(-94, 0);
      ctx.bezierCurveTo(-108, -10 + fluke * 6, -124, -22 + fluke * 8, -132, -30 + fluke * 8);
    }, "150, 190, 255", 1.1, 0.5);

    ctx.restore();
  }

  function drawShark(c, t) {
    const s = c.size / 100;
    const sway = Math.sin(t * 1.5 + c.phase);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.dir * s, s);
    ctx.globalAlpha = theme === "dark" ? 0.92 : 0.75;

    bioAura(90, 44, "170, 110, 255", t, c.phase);
    bioRim("170, 110, 255", 12);
    ctx.fillStyle = P.shark;

    // tail
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-54, -2 + sway * 2, -64, -20 + sway * 5);
    ctx.quadraticCurveTo(-50, -8, -44, -1);
    ctx.quadraticCurveTo(-50, 6, -46, 12 + sway * 4);
    ctx.quadraticCurveTo(-54, 8 + sway * 4, -40, 0);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(66, 0);
    ctx.bezierCurveTo(48, -16, 12, -22, -26, -10);
    ctx.quadraticCurveTo(-40, -4, -40, 0);
    ctx.quadraticCurveTo(-40, 5, -26, 10);
    ctx.bezierCurveTo(12, 22, 48, 16, 66, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.sharkLine;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // dorsal fin
    ctx.beginPath();
    ctx.moveTo(-2, -18);
    ctx.lineTo(-12, -46);
    ctx.lineTo(-28, -16);
    ctx.closePath();
    ctx.fill();

    // pectoral fin
    ctx.beginPath();
    ctx.moveTo(16, 8);
    ctx.quadraticCurveTo(10, 26, -8, 30);
    ctx.quadraticCurveTo(2, 16, 2, 9);
    ctx.closePath();
    ctx.fill();

    // gills
    ctx.strokeStyle = P.sharkLine;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(40 - i * 5, -6 + i * 2);
      ctx.quadraticCurveTo(38 - i * 5, 2 + i * 2, 40 - i * 5, 8 + i * 2);
      ctx.stroke();
    }

    // eye
    ctx.fillStyle = P.creatureEye;
    ctx.beginPath();
    ctx.arc(50, -4, 2, 0, TAU);
    ctx.fill();

    // mouth hint
    ctx.strokeStyle = P.sharkLine;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(64, 4);
    ctx.quadraticCurveTo(54, 8, 46, 7);
    ctx.stroke();
    bioRimOff();

    // lateral line of light and glowing fin tips
    const lat = [];
    for (let i = 0; i < 11; i += 1) lat.push([40 - i * 7, -2 + Math.sin(i * 0.5) * 1.6]);
    bioDots(lat, "200, 150, 255", t, c.phase, 1.5);
    bioDots([[-12, -40], [-60, -17], [8, 24]], "120, 235, 255", t, c.phase, 1.7);
    bioLine(() => {
      ctx.moveTo(-2, -18);
      ctx.lineTo(-12, -46);
      ctx.lineTo(-28, -16);
    }, "190, 140, 255", 1.1, 0.5);

    ctx.restore();
  }

  function drawTurtle(c, t) {
    const s = c.size / 50;
    const paddle = Math.sin(t * 1.25 + c.phase);
    const bob = Math.sin(t * 0.8 + c.phase) * 3;

    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.scale(c.dir * s, s);
    ctx.globalAlpha = theme === "dark" ? 0.9 : 0.78;

    bioAura(48, 30, "90, 255, 200", t, c.phase);
    bioRim("90, 255, 200", 10);

    // rear flipper
    ctx.save();
    ctx.translate(-19, 8);
    ctx.rotate(0.5 - paddle * 0.4);
    ctx.fillStyle = P.turtleSkin;
    ctx.beginPath();
    ctx.ellipse(0, 8, 6, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // front flipper (near)
    ctx.save();
    ctx.translate(16, 6);
    ctx.rotate(-0.5 + paddle * 0.5);
    ctx.fillStyle = P.turtleSkin;
    ctx.beginPath();
    ctx.ellipse(0, 13, 9, 18, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // shell
    ctx.fillStyle = P.turtleShell;
    ctx.strokeStyle = P.turtleLine;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 27, 19, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // shell plates
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 12, 9, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(-2 + Math.cos(a) * 12, Math.sin(a) * 9);
      ctx.lineTo(-2 + Math.cos(a) * 26, Math.sin(a) * 18.5);
      ctx.stroke();
    }

    // head + eye
    ctx.fillStyle = P.turtleSkin;
    ctx.beginPath();
    ctx.ellipse(28, -3, 9, 7, -0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.creatureEye;
    ctx.beginPath();
    ctx.arc(31, -6, 1.6, 0, TAU);
    ctx.fill();

    // tail
    ctx.fillStyle = P.turtleSkin;
    ctx.beginPath();
    ctx.moveTo(-28, 3);
    ctx.lineTo(-38, 8);
    ctx.lineTo(-27, 10);
    ctx.closePath();
    ctx.fill();
    bioRimOff();

    // glowing shell plates and speckled flippers
    bioLine(() => {
      ctx.ellipse(-2, 0, 12, 9, 0, 0, TAU);
    }, "110, 255, 214", 1.3, 0.7);
    bioLine(() => {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU + 0.4;
        ctx.moveTo(-2 + Math.cos(a) * 12, Math.sin(a) * 9);
        ctx.lineTo(-2 + Math.cos(a) * 26, Math.sin(a) * 18.5);
      }
    }, "110, 255, 214", 1, 0.5);
    const rim = [];
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * TAU;
      rim.push([-2 + Math.cos(a) * 27, Math.sin(a) * 19]);
    }
    bioDots(rim, "130, 255, 230", t, c.phase, 1.2);
    bioDots([[16, 18], [18, 26], [14, 32], [28, -3], [-19, 14]], "255, 150, 230", t, c.phase + 2, 1.3);

    ctx.restore();
  }

  function drawAngler(c, t) {
    const s = c.size / 40;
    const wag = Math.sin(t * 2.4 + c.phase);
    const bob = Math.sin(t * 1.1 + c.phase) * 2;

    // The lure leans toward the pointer when it is nearby.
    let reachX = 0;
    let reachY = 0;
    if (pointerIsOn()) {
      const dx = pointer.x - c.x;
      const dy = pointer.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 230 && d > 1) {
        const k = 1 - d / 230;
        reachX = c.dir * (dx / d) * 21 * k;
        reachY = (dy / d) * 15 * k;
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.scale(c.dir * s, s);
    ctx.globalAlpha = theme === "dark" ? 0.95 : 0.8;

    bioAura(54, 40, "255, 110, 220", t, c.phase);
    bioRim("255, 110, 220", 10);

    // tail
    ctx.fillStyle = P.angler;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-26, -10 + wag * 3, -34, -16 + wag * 4);
    ctx.quadraticCurveTo(-28, 0, -34, 16 + wag * 4);
    ctx.quadraticCurveTo(-26, 10 + wag * 3, -16, 0);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(26, 4);
    ctx.bezierCurveTo(24, -16, 2, -26, -12, -14);
    ctx.bezierCurveTo(-24, -4, -22, 14, -10, 20);
    ctx.bezierCurveTo(4, 27, 24, 18, 26, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.anglerLine;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // jaw
    ctx.strokeStyle = P.anglerLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, 4);
    ctx.quadraticCurveTo(14, 12, 2, 14);
    ctx.stroke();

    // teeth
    ctx.fillStyle = "rgba(240, 255, 250, 0.85)";
    for (let i = 0; i < 4; i += 1) {
      const x = 20 - i * 5;
      const y = 6 + i * 1.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1.6, y + 3.4);
      ctx.lineTo(x + 1.6, y + 2.4);
      ctx.closePath();
      ctx.fill();
    }

    // eye
    ctx.fillStyle = P.creatureEye;
    ctx.beginPath();
    ctx.arc(10, -7, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(2, 14, 18, 0.85)";
    ctx.beginPath();
    ctx.arc(10.5, -7, 1, 0, TAU);
    ctx.fill();

    // lure rod
    ctx.strokeStyle = P.anglerLine;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(8, -18);
    ctx.quadraticCurveTo(6, -34, 18 + reachX, -36 + reachY);
    ctx.stroke();

    bioRimOff();
    bioDots([[16, -6], [8, 2], [0, 6], [-8, 8], [-14, 2], [-4, -12], [-16, -6]], "255, 150, 230", t, c.phase, 1.1);

    // glowing bulb
    ctx.save();
    ctx.shadowColor = P.lure;
    ctx.shadowBlur = theme === "dark" ? 20 : 10;
    ctx.fillStyle = P.lure;
    ctx.beginPath();
    ctx.arc(18 + reachX, -36 + reachY, 3.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawCaustics(t) {
    const lines = theme === "dark" ? 4 : 3;
    const band = Math.min(H * 0.5, 460);

    ctx.save();
    if (theme === "dark") ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let layer = 0; layer < lines; layer += 1) {
      const baseY = 16 + layer * 27 + band * 0.02;
      ctx.strokeStyle = `rgba(${P.caustic}, ${P.causticAlpha * (1 - layer * 0.17)})`;
      ctx.lineWidth = 1 + (layer % 2) * 0.6;
      ctx.beginPath();

      for (let x = -24; x <= W + 24; x += 24) {
        const y =
          baseY +
          Math.sin(x * 0.011 + t * 0.55 + layer * 1.7) * 13 +
          Math.sin(x * 0.004 - t * 0.32 + layer * 0.8) * 24;
        if (x <= -24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlankton(t) {
    if (!plankton.length) return;

    ctx.save();
    if (theme === "dark") ctx.globalCompositeOperation = "lighter";

    for (const p of plankton) {
      const twinkle = 0.32 + 0.68 * Math.abs(Math.sin(t * p.speed * 1.6 + p.phase));
      const a = P.planktonAlpha * twinkle * p.z;
      const r = p.r * (0.6 + p.z * 0.7);

      // soft halo
      ctx.fillStyle = `rgba(${P.plankton}, ${a * 0.16})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.2, 0, TAU);
      ctx.fill();

      // bright core
      ctx.fillStyle = `rgba(${P.plankton}, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* scuba divers — top-of-page easter egg                               */
  /* ------------------------------------------------------------------ */

  // They work around the hero, repairing a floating card and a gear and
  // herding the fish, then kick upward and vanish once the visitor scrolls
  // past the top of the page.
  const DIVER_EXIT_START = 220;
  const DIVER_EXIT_SPAN = 280;

  function diverExit() {
    return clamp((scrollPx - DIVER_EXIT_START) / DIVER_EXIT_SPAN, 0, 1);
  }

  function diverAlpha() {
    const e = diverExit();
    return clamp(1 - (e - 0.72) / 0.28, 0, 1);
  }

  function diverRise() {
    const e = diverExit();
    return e * e * (3 - 2 * e);
  }

  function buildDivers() {
    if (!W || !H) return;

    const title = document.querySelector(".hero__title");
    const stats = document.querySelector(".stats");
    const tr = title ? title.getBoundingClientRect() : null;
    const sr = stats ? stats.getBoundingClientRect() : null;
    const mobile = W < 640;

    const anchors = [];

    // A welder just past the end of the headline, patching a floating card.
    anchors.push({
      ax: clamp((tr ? tr.right : W * 0.78) + (mobile ? 20 : 42), 70, W - 44),
      ay: mobile
        ? clamp((tr ? tr.bottom : H * 0.36) + 12, H * 0.2, H * 0.56)
        : clamp((tr ? tr.top + tr.height * 0.42 : H * 0.32), H * 0.18, H * 0.56),
      dir: -1,
      baseDir: -1,
      scale: mobile ? 0.72 : 0.92,
      tool: "weld",
      prop: "panel",
    });

    // A mechanic near the stats, tightening a floating gear. On narrower
    // windows the stats sit too close to the headline, so keep it to one
    // welded card there and let the swimmer carry the scene.
    if (W >= 900) {
      anchors.push({
        ax: clamp(W * 0.72, 240, W - 140),
        ay: clamp(sr ? sr.top - 76 : H * 0.62, H * 0.44, H * 0.72),
        dir: -1,
        baseDir: -1,
        scale: 0.8,
        tool: "wrench",
        prop: "gear",
      });
    }

    // A free swimmer that checks on the fish drifting through the open water
    // above the headline, where there is room to be seen.
    anchors.push({
      ax: clamp(W * (mobile ? 0.78 : 0.55), 70, W - 70),
      ay: clamp(H * (mobile ? 0.14 : 0.13), H * 0.1, H * 0.24),
      dir: 1,
      baseDir: 1,
      scale: mobile ? 0.6 : 0.7,
      tool: "wrench",
      prop: null,
      roam: true,
    });

    divers = anchors.map((a) => ({
      ...a,
      x: a.ax,
      y: a.ay,
      phase: rand(0, TAU),
      sparks: [],
      bubbles: [],
      sparkTimer: rand(0.3, 1.6),
      bubbleTimer: rand(0.5, 1.8),
      feedTimer: rand(2.5, 5),
    }));

    // The foreground cleaners. They hover beside the hero, then take turns
    // swimming to a patch of lichen or seagrass on the interface, scraping it
    // off, and drifting back to their idle spot.
    const idle = cleanerIdleSpots();
    if (frontDivers.length !== 2) {
      frontDivers = idle.map((p, i) => ({
        id: i,
        x: p.x,
        y: p.y,
        idleX: p.x,
        idleY: p.y,
        targetX: p.x,
        targetY: p.y,
        state: "idle",
        cooldown: 2.2 + i * 2.4 + rand(0, 1.6),
        spot: null,
        scrubTimer: 0,
        dir: p.x < W / 2 ? 1 : -1,
        scale: mobile ? 0.5 : 0.58,
        phase: rand(0, TAU),
        tool: "brush",
        prop: null,
        torch: true,
        sparks: [],
        bubbles: [],
        bubbleTimer: rand(0.5, 1.4),
      }));
    } else {
      frontDivers.forEach((d, i) => {
        d.idleX = idle[i].x;
        d.idleY = idle[i].y;
        d.scale = mobile ? 0.5 : 0.58;
      });
    }
  }

  function cleanerIdleSpots() {
    const title = document.querySelector(".hero__title");
    const tr = title ? title.getBoundingClientRect() : null;
    const top = tr ? clamp(tr.top + tr.height * 0.14, H * 0.16, H * 0.34) : H * 0.22;
    return [
      { x: clamp(W * 0.075, 52, 116), y: top },
      { x: clamp(W - W * 0.075, W - 116, W - 52), y: clamp(top + H * 0.13, H * 0.3, H * 0.52) },
    ];
  }

  function spawnDiverSparks(d) {
    const s = d.scale;
    const tx = d.x + d.dir * 29.5 * s;
    const ty = d.y + 4.5 * s;
    const n = d.prop ? 8 : 5;

    for (let i = 0; i < n; i += 1) {
      d.sparks.push({
        x: tx + rand(-2, 2),
        y: ty + rand(-2, 2),
        vx: rand(-28, 30),
        vy: rand(-34, 8),
        life: rand(0.24, 0.55),
        age: 0,
      });
    }
  }

  function spawnDiverBubble(d) {
    const s = d.scale;
    d.bubbles.push({
      x: d.x + d.dir * 22 * s + rand(-2, 2),
      y: d.y - 6 * s,
      r: rand(1.1, 2.5),
      vy: rand(14, 26),
      phase: rand(0, TAU),
    });
    if (d.bubbles.length > 9) d.bubbles.shift();
  }

  function updateDivers(dt, t) {
    if (diverExit() >= 0.999) return;

    const rise = diverRise();
    const watchingNow = watching();

    for (const d of divers) {
      let tx = d.ax;
      let ty = d.ay;

      if (d.prop) {
        // Anchored workers stay with the thing they are repairing; the bob
        // in drawDiver keeps them alive without drifting off the prop.
        d.dir = d.baseDir;
      } else {
        d.tool = watchingNow ? "camera" : "wrench";

        let nearest = null;
        let best = 170;

        for (const f of fish) {
          const dist = Math.hypot(f.x - d.x, f.y - d.y);
          if (dist < best) {
            best = dist;
            nearest = f;
          }
        }

        if (d.roam) {
          tx = clamp(d.ax + Math.sin(t * 0.18 + d.phase) * W * 0.16, 60, W - 60);
          ty = clamp(d.ay + Math.sin(t * 0.42 + d.phase * 1.7) * 30, H * 0.09, H * 0.24);
        }

        if (nearest) {
          // Drift toward the fish. In normal mode the swimmer shoos them
          // along; in Marine Watch it lets them gather for the camera.
          tx = clamp(d.ax + (nearest.x - d.ax) * 0.3, d.ax - 80, d.ax + 80);
          ty = clamp(nearest.y, H * 0.09, H * 0.3);

          if (best < 80 && !watchingNow) {
            const dx = nearest.x - d.x;
            const dy = nearest.y - d.y;
            const dist = Math.max(0.001, Math.hypot(dx, dy));
            const k = (1 - dist / 80) * 280;
            nearest.vx += (dx / dist) * k * dt;
            nearest.vy += (dy / dist) * k * dt;
          }

          d.dir = nearest.x >= d.x ? 1 : -1;
        } else {
          d.dir = d.baseDir;
        }

        // Marine Watch: the reef crew drops food for the school.
        if (watchingNow) {
          d.feedTimer -= dt;
          if (d.feedTimer <= 0) {
            if (food.length < 14 && !reduce.matches) {
              dropFood(d.x + d.dir * 14, d.y + 8);
              if (!marine.crewFed) {
                marine.crewFed = true;
                emitMarine("The reef crew is feeding the school. Keep the documentary rolling.");
              }
            }
            d.feedTimer = rand(5.5, 8.5);
          }
        } else {
          d.feedTimer = rand(3, 6);
        }
      }

      // Scrolling away from the top makes the whole crew kick upwards and
      // leave. Scrolling back down brings them back.
      ty -= rise * (d.ay + 160);

      d.x += (tx - d.x) * Math.min(1, dt * 1.1);
      d.y += (ty - d.y) * Math.min(1, dt * 1.1);

      d.sparkTimer -= dt;
      if (d.sparkTimer <= 0) {
        spawnDiverSparks(d);
        d.sparkTimer = rand(1.4, 2.9);
      }

      d.bubbleTimer -= dt;
      if (d.bubbleTimer <= 0) {
        spawnDiverBubble(d);
        d.bubbleTimer = rand(0.9, 2.1);
      }

      for (let i = d.sparks.length - 1; i >= 0; i -= 1) {
        const p = d.sparks[i];
        p.age += dt;
        if (p.age >= p.life) {
          d.sparks.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 26 * dt;
      }

      for (let i = d.bubbles.length - 1; i >= 0; i -= 1) {
        const b = d.bubbles[i];
        b.y -= b.vy * dt;
        b.x += Math.sin(t * 2.1 + b.phase) * 5 * dt;
        if (b.y < -10) d.bubbles.splice(i, 1);
      }
    }
  }

  function growthSpotsInView() {
    const api = window.Growth;
    if (!api || typeof api.list !== "function") return [];
    const out = [];
    for (const spot of api.list()) {
      const r = spot.node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.top < 72 || r.bottom > H - 18) continue;
      if (r.right < 12 || r.left > W - 12) continue;
      out.push(spot);
    }
    return out;
  }

  function pickGrowthSpot(d) {
    const candidates = growthSpotsInView().filter(
      (s) => !frontDivers.some((o) => o !== d && o.spot === s)
    );

    let best = null;
    let bestScore = Infinity;
    for (const s of candidates) {
      const r = s.node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Prefer growth on the cleaner's own side of the page, then the nearest.
      const side = d.id === 0 ? (cx < W * 0.55 ? 0 : 300) : cx > W * 0.45 ? 0 : 300;
      const score = Math.hypot(cx - d.idleX, cy - d.idleY) + side;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  function aimAtSpot(d, spot) {
    const r = spot.node.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    d.dir = cx >= d.x ? 1 : -1;
    d.targetX = cx - d.dir * 22 * d.scale;
    d.targetY = cy - 3;
  }

  function updateFrontDivers(dt, t) {
    if (!frontCtx || reduce.matches || !frontDivers.length) return;
    if (diverExit() >= 0.999) return;

    const exit = diverExit();
    const canClean = !watching() && scrollPx < 300 && exit < 0.45;

    for (const d of frontDivers) {
      d.tool = watching() ? "camera" : "brush";

      if (
        (d.state === "approach" || d.state === "scrub") &&
        (!canClean || !d.spot || !d.spot.node.isConnected)
      ) {
        d.spot = null;
        d.state = "return";
      }

      if (d.state === "idle") {
        d.cooldown -= dt;
        if (canClean && d.cooldown <= 0) {
          const spot = pickGrowthSpot(d);
          if (spot) {
            d.spot = spot;
            d.state = "approach";
            aimAtSpot(d, spot);
          } else {
            d.cooldown = rand(2.5, 5);
          }
        }
        d.targetX = d.idleX + Math.sin(t * 0.32 + d.phase) * 11;
        d.targetY = d.idleY + Math.sin(t * 0.78 + d.phase * 1.4) * 6;
      } else if (d.state === "approach") {
        aimAtSpot(d, d.spot);
        if (Math.hypot(d.targetX - d.x, d.targetY - d.y) < 15) {
          d.state = "scrub";
          d.scrubTimer = rand(1.15, 1.75);
          d.bubbleTimer = 0;
        }
      } else if (d.state === "scrub") {
        aimAtSpot(d, d.spot);
        d.targetX += Math.sin(t * 17 + d.phase) * 1.8;
        d.targetY += Math.cos(t * 15 + d.phase) * 1.4;
        d.scrubTimer -= dt;

        d.bubbleTimer -= dt;
        if (d.bubbleTimer <= 0) {
          spawnDiverBubble(d);
          d.bubbleTimer = rand(0.16, 0.34);
        }

        if (d.scrubTimer <= 0) {
          if (d.spot) window.Growth?.clean(d.spot);
          d.spot = null;
          d.state = "return";
          d.cooldown = rand(7, 12);
        }
      } else if (d.state === "return") {
        d.targetX = d.idleX + Math.sin(t * 0.32 + d.phase) * 8;
        d.targetY = d.idleY + Math.sin(t * 0.78 + d.phase * 1.4) * 5;
        if (Math.hypot(d.targetX - d.x, d.targetY - d.y) < 16) {
          d.state = "idle";
          d.cooldown = rand(3, 6);
        }
      }

      // The whole crew rises out of frame when the page is scrolled away.
      const lift = diverRise() * (d.idleY + 220);
      const speed = d.state === "approach" ? 2.4 : d.state === "scrub" ? 7 : 1.4;
      d.x += (d.targetX - d.x) * Math.min(1, dt * speed);
      d.y += (d.targetY - lift - d.y) * Math.min(1, dt * speed);

      if (d.state !== "scrub") {
        d.bubbleTimer -= dt;
        if (d.bubbleTimer <= 0) {
          spawnDiverBubble(d);
          d.bubbleTimer = rand(1.0, 2.2);
        }
      }

      for (let i = d.bubbles.length - 1; i >= 0; i -= 1) {
        const b = d.bubbles[i];
        b.y -= b.vy * dt;
        b.x += Math.sin(t * 2.1 + b.phase) * 5 * dt;
        if (b.y < -10) d.bubbles.splice(i, 1);
      }
    }
  }

  function clearFrontDiver() {
    if (!frontCtx) return;
    frontCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    frontCtx.clearRect(0, 0, W, H);
  }

  function drawFrontDivers(t) {
    if (!frontCtx) return;
    clearFrontDiver();
    if (!frontDivers.length) return;

    const alpha = diverAlpha();
    if (alpha <= 0.01) return;

    const prev = ctx;
    ctx = frontCtx;
    try {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      for (const d of frontDivers) {
        drawDiver(d, t, alpha);
        drawDiverFX(d, alpha);
      }
    } finally {
      ctx = prev;
    }
  }

  function drawDiverPanel(d, t, alpha) {
    const s = d.scale;
    const w = 62 * s;
    const h = 44 * s;
    const x = d.x - 30 * s - w;
    const y = d.y + 3 * s - h / 2 + Math.sin(t * 0.85 + d.phase) * 2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.translate(x, y);
    ctx.rotate(-0.04 + Math.sin(t * 0.5 + d.phase) * 0.02);

    ctx.fillStyle = P.diverPanel;
    ctx.strokeStyle = P.diverPanelLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 5 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme === "dark" ? "rgba(20, 72, 82, 0.55)" : "rgba(190, 235, 240, 0.7)";
    ctx.beginPath();
    ctx.roundRect(6 * s, 8 * s, 22 * s, h - 16 * s, 2.5 * s);
    ctx.fill();

    ctx.fillStyle = `rgba(${P.spark}, 0.85)`;
    ctx.beginPath();
    ctx.arc(w - 10 * s, 8 * s, 1.7 * s, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = P.diverPanelLine;
    ctx.lineWidth = 1.4 * s;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(34 * s, (13 + i * 6) * s);
      ctx.lineTo((i === 2 ? 48 : 56) * s, (13 + i * 6) * s);
      ctx.stroke();
    }

    ctx.fillStyle = P.diverRim;
    for (const [bx, by] of [[6, 6], [w - 6, 6], [6, h - 6]]) {
      ctx.beginPath();
      ctx.arc(bx * s, by * s, 1.2 * s, 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    if (theme === "dark") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gx = x + w;
      const gy = y + h * 0.5;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 16 * s);
      g.addColorStop(0, `rgba(${P.spark}, ${0.22 * alpha})`);
      g.addColorStop(1, `rgba(${P.spark}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(gx - 20 * s, gy - 20 * s, 40 * s, 40 * s);
      ctx.restore();
    }
  }

  function drawDiverGear(d, t, alpha) {
    const s = d.scale;
    const r = 12 * s;

    ctx.save();
    ctx.translate(d.x - 37 * s, d.y + 3 * s);
    ctx.rotate(t * 0.35 + d.phase);
    ctx.globalAlpha = alpha * 0.8;

    ctx.fillStyle = P.diverRim;
    for (let i = 0; i < 8; i += 1) {
      ctx.rotate(TAU / 8);
      ctx.fillRect(r * 0.82, -2.2 * s, r * 0.34, 4.4 * s);
    }

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.fill();

    ctx.fillStyle = P.diverPanel;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawDiverTorch(d, t, alpha) {
    const flick = 0.82 + 0.18 * Math.sin(t * 7.3 + d.phase) + 0.06 * Math.sin(t * 19 + d.phase * 2);
    const reach = 158;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * 0.9;

    const beam = ctx.createLinearGradient(26, 0, reach, 0);
    beam.addColorStop(0, `rgba(${P.torch}, ${0.34 * flick})`);
    beam.addColorStop(0.55, `rgba(${P.torch}, ${0.12 * flick})`);
    beam.addColorStop(1, `rgba(${P.torch}, 0)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(25, -3);
    ctx.lineTo(reach, -54);
    ctx.lineTo(reach, 52);
    ctx.lineTo(25, 5);
    ctx.closePath();
    ctx.fill();

    const core = ctx.createRadialGradient(28, 1, 0, 28, 1, 26);
    core.addColorStop(0, `rgba(${P.torch}, ${0.5 * flick})`);
    core.addColorStop(1, `rgba(${P.torch}, 0)`);
    ctx.fillStyle = core;
    ctx.fillRect(2, -25, 52, 52);

    ctx.restore();

    // the torch itself, held just ahead of the chest
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(205, 240, 245, 0.92)";
    ctx.beginPath();
    ctx.roundRect(15, 3, 12, 5, 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${P.torch}, 0.95)`;
    ctx.beginPath();
    ctx.arc(27, 5.5, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawDiverTool(d, t) {
    if (d.tool === "camera") {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "rgba(205, 240, 245, 0.92)";
      ctx.beginPath();
      ctx.roundRect(19, -2.5, 11, 7, 1.6);
      ctx.fill();
      ctx.fillStyle = "rgba(6, 30, 38, 0.9)";
      ctx.beginPath();
      ctx.arc(31.5, 1, 2.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ff7a6b";
      ctx.beginPath();
      ctx.arc(22, -2, 1.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (d.tool === "brush") {
      const shake = d.state === "scrub" ? Math.sin(t * 22 + d.phase) * 0.22 : 0;
      ctx.save();
      ctx.translate(23, 4.6);
      ctx.rotate(0.18 + shake);
      ctx.lineCap = "round";

      // handle
      ctx.strokeStyle = "rgba(220, 240, 245, 0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -2);
      ctx.stroke();

      // scraper head
      ctx.fillStyle = "#ffe2a1";
      ctx.beginPath();
      ctx.roundRect(6.5, -6.8, 4.6, 7.2, 1.4);
      ctx.fill();

      // bristles
      ctx.strokeStyle = "#9fe8c2";
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(11, i * 1.5);
        ctx.lineTo(15.5, i * 1.9 - 1);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.strokeStyle = "rgba(220, 240, 245, 0.9)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (d.tool === "weld") {
      ctx.beginPath();
      ctx.moveTo(22, 6.5);
      ctx.lineTo(28, 5.2);
      ctx.stroke();

      const pulse = 0.7 + 0.3 * Math.sin(t * 11 + d.phase);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(${P.spark}, ${0.75 * pulse})`;
      ctx.beginPath();
      ctx.arc(29.5, 4.8, 2.4 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(21, 7);
      ctx.lineTo(29, 3.4);
      ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(29, 3.4);
      ctx.lineTo(32, 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(29, 3.4);
      ctx.lineTo(31.5, 5);
      ctx.stroke();
    }
  }

  function drawDiver(d, t, alpha) {
    const s = d.scale;
    const bob = Math.sin(t * 0.9 + d.phase) * 2.4;
    const kick = Math.sin(t * 3.3 + d.phase);

    ctx.save();
    ctx.translate(d.x, d.y + bob);
    ctx.rotate(Math.sin(t * 0.6 + d.phase) * 0.04);
    ctx.scale(d.dir * s, s);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Night dives get a warm torch beam. It is additive, so it also lights
    // the panel, gear and fish that were painted earlier.
    if (theme === "dark" && d.torch !== false) drawDiverTorch(d, t, alpha);

    // legs and fins
    ctx.strokeStyle = P.diver;
    ctx.fillStyle = P.diver;
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      const lift = kick * 3.5 * side;
      ctx.beginPath();
      ctx.moveTo(-10, 4 + side * 2);
      ctx.quadraticCurveTo(-20, 7 + side * 4, -29, 9 + side * 6 + lift);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-29, 9 + side * 6 + lift);
      ctx.lineTo(-35, 5 + side * 6 + lift);
      ctx.lineTo(-34, 12 + side * 6 + lift);
      ctx.closePath();
      ctx.fill();
    }

    // tank
    ctx.save();
    ctx.rotate(-0.2);
    ctx.fillStyle = P.diverTank;
    ctx.beginPath();
    ctx.roundRect(-18, -17, 27, 11, 5);
    ctx.fill();
    ctx.fillStyle = P.diverTankBand;
    ctx.fillRect(-10, -17, 4.5, 11);
    ctx.fillStyle = P.diverRim;
    ctx.beginPath();
    ctx.arc(-18, -13, 2, 0, TAU);
    ctx.fill();
    ctx.restore();

    // body
    ctx.fillStyle = P.diver;
    ctx.beginPath();
    ctx.ellipse(2, 0, 15.5, 8.4, 0.07, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.diverRim;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(2, 0, 14.6, 7.7, 0.07, Math.PI * 1.08, Math.PI * 1.58);
    ctx.stroke();

    // air hose
    ctx.strokeStyle = P.diverHose;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -9);
    ctx.quadraticCurveTo(8, -18, 18, -7);
    ctx.stroke();

    // head and mask
    ctx.fillStyle = P.diver;
    ctx.beginPath();
    ctx.arc(18, -2, 6.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = P.diverMask;
    ctx.beginPath();
    ctx.ellipse(22, -3.6, 5.1, 3.7, -0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(2, 20, 26, 0.45)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(22, -3.6, 5.1, 3.7, -0.12, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(20, -5.4);
    ctx.lineTo(23.6, -4.3);
    ctx.stroke();

    // arms
    ctx.strokeStyle = P.diver;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.quadraticCurveTo(17, 8, 23, 5.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.quadraticCurveTo(9, 10.5, 14, 9);
    ctx.stroke();

    drawDiverTool(d, t);

    ctx.restore();
  }

  function drawDiverFX(d, alpha) {
    if (d.sparks.length) {
      ctx.save();
      if (theme === "dark") ctx.globalCompositeOperation = "lighter";

      for (const p of d.sparks) {
        const k = 1 - p.age / p.life;
        ctx.strokeStyle = `rgba(${P.spark}, ${0.85 * k})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const b of d.bubbles) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = `rgba(${P.bubble}, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDivers(t) {
    const alpha = diverAlpha();
    if (alpha <= 0.01) return;

    for (const d of divers) {
      if (d.prop === "panel") drawDiverPanel(d, t, alpha);
      else if (d.prop === "gear") drawDiverGear(d, t, alpha);
    }

    for (const d of divers) drawDiver(d, t, alpha);
    for (const d of divers) drawDiverFX(d, alpha);
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

  function measureScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - H);
    scrollPx = window.scrollY || 0;
    scrollProgress = clamp(scrollPx / max, 0, 1);
  }

  function resize() {
    const prevW = W;

    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (frontCanvas && frontCtx) {
      frontCanvas.width = Math.round(W * DPR);
      frontCanvas.height = Math.round(H * DPR);
      frontCanvas.style.width = `${W}px`;
      frontCanvas.style.height = `${H}px`;
      frontCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    buildFish();
    buildReef();
    buildDivers();

    // A big width change means a new layout: let the deep visitors respawn.
    if (Math.abs(W - prevW) > 80) deep = [];
    for (const c of deep) c.baseY = clamp(c.baseY, H * 0.15, H * 0.78);

    measureScroll();
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

  function updateDeep(dt, t) {
    const on = pointerIsOn();

    // Spawn newcomers slowly as the page is scrolled further down.
    deepTimer -= dt;
    if (deepTimer <= 0) {
      let spawned = false;
      for (const type of ["turtle", "shark", "whale", "angler"]) {
        const have = deep.filter((c) => c.type === type && !c.leaving).length;
        if (have < targetCount(type)) {
          deep.push(makeDeep(type));
          spawned = true;
          break;
        }
      }
      deepTimer = spawned ? rand(0.8, 1.8) : 0.5;
    }

    // Retire the newest of each species when scrolling back towards daylight.
    const seen = { turtle: 0, shark: 0, whale: 0, angler: 0 };
    for (const c of deep) {
      const index = seen[c.type]++;
      const want = targetCount(c.type, 0.05);
      if (index >= want && !c.leaving) c.leaving = true;
      if (index < want && c.leaving) c.leaving = false;
    }

    for (let i = deep.length - 1; i >= 0; i -= 1) {
      const c = deep[i];
      const dxp = pointer.x - c.x;
      const dyp = pointer.y - c.y;
      const dist = Math.hypot(dxp, dyp);

      c.startle = Math.max(0, c.startle - dt);
      c.flash = Math.max(0, (c.flash || 0) - dt);
      if (!c.leaving && chaseTreat(c, dt)) continue;

      if (c.leaving) {
        c.dir = c.x < W * 0.5 ? -1 : 1;
        c.speedMul += (2.3 - c.speedMul) * Math.min(1, dt * 3);
      } else if (c.startle > 0) {
        c.speedMul += (1.7 - c.speedMul) * Math.min(1, dt * 4);
      } else if (c.entering) {
        c.speedMul += (1.9 - c.speedMul) * Math.min(1, dt * 3);
      } else {
        c.speedMul += (1 - c.speedMul) * Math.min(1, dt * 2);
      }

      c.x += c.dir * c.speed * c.speedMul * dt;

      if (c.entering) {
        const inside = c.x > c.size * 0.12 && c.x < W - c.size * 0.12;
        if (inside) c.entering = false;
      }

      let ty = c.baseY + Math.sin(t * c.w + c.phase) * c.amp;

      // Each species reacts differently to the pointer.
      if (on && !c.leaving) {
        if (c.type === "whale" && dist < 520) {
          ty += (pointer.y * 0.75 + c.baseY * 0.25 - ty) * 0.55;
        } else if (c.type === "shark" && dist < 360) {
          const wantDir = dist < 100 ? (dxp > 0 ? -1 : 1) : dxp > 0 ? 1 : -1;
          if (Math.abs(dxp) > 26) c.dir = wantDir;
          c.speedMul = Math.max(c.speedMul, 1.35);
          ty += (pointer.y - ty) * 0.4;
        } else if (c.type === "turtle" && dist < 190) {
          c.dir = dxp > 0 ? -1 : 1;
          ty = c.y - Math.sign(dyp || 1) * 46;
          c.speedMul = Math.max(c.speedMul, 1.8);
        } else if (c.type === "angler" && dist < 270) {
          ty += (pointer.y - ty) * 0.35;
        }
      }

      c.y += (ty - c.y) * Math.min(1, dt * 1.6);
      c.y = clamp(c.y, H * 0.12, H * 0.78);

      if (c.leaving) {
        const margin = c.size * 2 + 60;
        if ((c.dir > 0 && c.x > W + margin) || (c.dir < 0 && c.x < -margin)) {
          deep.splice(i, 1);
        }
      }
    }

    if (deep.length > 8) deep.splice(0, deep.length - 8);
  }

  /* ------------------------------------------------------------------ */
  /* fish food: click the water and the fish come to eat                  */
  /* ------------------------------------------------------------------ */

  function dropFood(x, y) {
    for (let i = 0; i < 6; i += 1) {
      food.push({
        x: x + rand(-14, 14),
        y: y + rand(-10, 10),
        vy: rand(18, 32),
        phase: rand(0, TAU),
        age: 0,
        r: rand(2, 3.2),
        taken: false,
      });
    }
    if (food.length > 60) food.splice(0, food.length - 60);
  }

  function updateFood(dt, t) {
    for (let i = food.length - 1; i >= 0; i -= 1) {
      const p = food[i];
      p.age += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(t * 1.6 + p.phase) * 9 * dt;
      if (p.taken || p.age > 16 || p.y > H * 0.93) food.splice(i, 1);
    }
  }

  function chaseFood(f, dt) {
    // Hooked fish stay on the line, wriggling.
    if (rod && rod.state === "bite" && rod.fish === f) {
      const k = Math.min(1, dt * 8);
      f.x += (rod.x - f.x) * k;
      f.y += (rod.y + 4 - f.y) * k;
      f.baseY = f.y;
      return true;
    }

    const hookLive = rod && rod.state === "cast";
    if (!food.length && !hookLive) return false;
    let best = null;
    let bestD = 420 + f.size * 6;
    for (const p of food) {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (hookLive) {
      const d = Math.hypot(rod.x - f.x, rod.y - f.y);
      if (d < bestD) {
        bestD = d;
        best = rod;
      }
    }
    if (!best) return false;

    if (best === rod && bestD < f.size * 0.7 + 8) {
      rod.state = "bite";
      rod.fish = f;
      rod.biteAge = 0;
      emitMarine("Bite! Click now to reel it in.");
      return true;
    }

    if (best !== rod && bestD < f.size * 0.7 + 5) {
      best.taken = true;
      addRipple(best.x, best.y, 0.45);
      return true;
    }

    const dx = best.x - f.x;
    const dy = best.y - f.y;
    if (Math.abs(dx) > 14) f.dir = dx > 0 ? 1 : -1;
    const sp = (70 + f.size * 4) * f.z;
    f.x += (dx / bestD) * sp * dt;
    f.y += (dy / bestD) * sp * dt;
    f.baseY = f.y;
    f.vx = 0;
    f.vy = 0;
    return true;
  }

  function drawFood() {
    if (!food.length) return;
    ctx.save();
    ctx.fillStyle = theme === "dark" ? "#ffd9a0" : "#c9772b";
    for (const p of food) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (16 - p.age) / 3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Marine Watch game: catch fish with a rod, feed the deep with them    */
  /* ------------------------------------------------------------------ */

  const marine = (window.Marine = {
    tool: "rod",
    caught: 0,
    fed: 0,
    fish: 0,
    deep: 0,
    depth: 0,
    species: "reef fish",
    crewFed: false,
  });
  let rod = null; // { x, y, state: "cast" | "bite", age, biteAge, fish }
  let treats = [];

  const watching = () => document.body.classList.contains("is-watching");

  function emitMarine(msg) {
    document.dispatchEvent(new CustomEvent("marine:update", { detail: { msg: msg || "" } }));
  }

  function castRod(x, y) {
    rod = { x, y, state: "cast", age: 0, biteAge: 0, fish: null };
    addRipple(x, y, 1);
    emitMarine("Line cast. Wait for a fish to bite.");
  }

  function reelIn() {
    if (!rod) return;
    const hooked = rod.state === "bite" && rod.fish;
    const spot = { x: rod.x, y: rod.y };
    if (hooked) {
      const f = rod.fish;
      const idx = fish.indexOf(f);
      if (idx >= 0) fish.splice(idx, 1);
      marine.caught += 1;
      addRipple(spot.x, spot.y, 1.6);
      // A new fish swims in from off-screen a few seconds later.
      setTimeout(() => {
        f.x = f.dir > 0 ? -90 : W + 90;
        f.y = rand(H * 0.1, H * 0.85);
        f.baseY = f.y;
        f.vx = f.vy = 0;
        fish.push(f);
      }, 6000);
      emitMarine("Caught one! Pick Feed catch, then scroll down to the deep sea.");
    } else {
      emitMarine("Reeled in. Nothing yet.");
    }
    rod = null;
  }

  function updateRod(dt) {
    if (!rod) return;
    rod.age += dt;
    if (rod.state === "cast") {
      if (rod.y < H * 0.72) rod.y += 6 * dt;
      if (rod.age > 30) rod = null;
    } else {
      rod.biteAge += dt;
      if (rod.biteAge > 2.8) {
        const f = rod.fish;
        if (f) f.vx = f.dir * -120;
        rod = null;
        emitMarine("It got away! Cast again.");
      }
    }
  }

  function drawRod(t) {
    if (!rod) return;
    const jig = rod.state === "bite" ? Math.sin(t * 38) * 2.2 : Math.sin(t * 2) * 0.6;
    const hx = rod.x + jig * 0.4;
    const hy = rod.y + jig;
    const tipX = W * 0.5 + (rod.x - W * 0.5) * 0.18;

    ctx.save();
    ctx.strokeStyle = theme === "dark" ? "rgba(220, 245, 255, 0.55)" : "rgba(20, 90, 110, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tipX, -8);
    ctx.quadraticCurveTo((tipX + hx) / 2 + 18, hy * 0.45, hx, hy - 6);
    ctx.stroke();

    // bait + hook
    ctx.fillStyle = "#ffb86b";
    ctx.beginPath();
    ctx.arc(hx, hy, 3.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#e8f6ff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(hx, hy + 5, 3, 0.2, Math.PI * 1.2);
    ctx.stroke();

    if (rod.state === "bite") {
      ctx.fillStyle = "#58f5c8";
      ctx.font = "700 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", hx, hy - 16);
    }
    ctx.restore();
  }

  function dropTreat(x, y) {
    if (marine.caught < 1) {
      emitMarine("Catch a fish with the rod first.");
      return;
    }
    marine.caught -= 1;
    treats.push({ x, y, vy: 28, age: 0, taken: false, phase: rand(0, TAU) });
    emitMarine("Treat dropped. Deep creatures nearby will come for it.");
  }

  function updateTreats(dt) {
    for (let i = treats.length - 1; i >= 0; i -= 1) {
      const p = treats[i];
      p.age += dt;
      if (p.y < H * 0.74) p.y += p.vy * dt;
      if (p.taken || p.age > 40) treats.splice(i, 1);
    }
  }

  const FED_MSG = {
    whale: "The whale is delighted!",
    shark: "The shark gulped it down!",
    turtle: "The turtle nibbles happily.",
    angler: "The anglerfish glows with joy!",
  };

  function chaseTreat(c, dt) {
    if (!treats.length) return false;
    let best = null;
    let bestD = 1e9;
    for (const p of treats) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best || bestD > 1100) return false;

    if (bestD < c.size * 0.35 + 12) {
      best.taken = true;
      c.flash = 2.4;
      marine.fed += 1;
      addRipple(best.x, best.y, 1.4);
      emitMarine(FED_MSG[c.type] || "Yum!");
      return true;
    }

    const dx = best.x - c.x;
    const dy = best.y - c.y;
    if (Math.abs(dx) > 10) c.dir = dx > 0 ? 1 : -1;
    c.entering = false;
    const sp = c.speed * 2.6 + 26;
    c.x += (dx / bestD) * sp * dt;
    c.y += (dy / bestD) * sp * dt;
    c.baseY = c.y;
    return true;
  }

  function drawTreats(t) {
    if (!treats.length) return;
    const sp = glowSprite("255, 170, 90");
    ctx.save();
    for (const p of treats) {
      const bob = Math.sin(t * 2 + p.phase) * 2;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6;
      ctx.drawImage(sp, p.x - 22, p.y + bob - 22, 44, 44);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffb86b";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + bob, 9, 4.6, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y + bob);
      ctx.lineTo(p.x - 15, p.y + bob - 5);
      ctx.lineTo(p.x - 15, p.y + bob + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function handleWatchClick(x, y) {
    if (marine.tool === "rod") {
      if (rod) reelIn();
      else castRod(x, y);
    } else if (marine.tool === "feed") {
      dropTreat(x, y);
    } else {
      dropFood(x, y);
    }
  }

  document.addEventListener("marine:tool", (e) => {
    marine.tool = e.detail;
    if (marine.tool !== "rod" && rod) rod = null;
    emitMarine(
      marine.tool === "rod"
        ? "Click the water to cast your line."
        : marine.tool === "feed"
        ? marine.caught
          ? "Click to drop a fish. Scroll down for sharks and whales."
          : "Catch a fish with the rod first."
        : "Click the water to scatter fish food."
    );
  });

  // Leaving Marine Watch reels the line in.
  new MutationObserver(() => {
    if (!watching() && rod) rod = null;
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  function update(dt, t) {
    const on = pointerIsOn();

    updateFood(dt, t);
    const lightTarget = watching() ? 1 - scrollProgress * 0.94 : 1;
    watchLight += (lightTarget - watchLight) * Math.min(1, dt * 2.2);
    updateRod(dt);
    updateTreats(dt);

    for (const f of fish) {
      if (chaseFood(f, dt)) continue;

      // Fish scatter away from the pointer but never swim backwards.
      if (on) {
        const dx = f.x - pointer.x;
        const dy = f.y - pointer.y;
        const d = Math.hypot(dx, dy);
        const radius = 110 + f.size * 2;
        if (d < radius && d > 0.5) {
          const k = (1 - d / radius) * 620;
          f.vx += (dx / d) * k * dt;
          f.vy += (dy / d) * k * dt;
        }
      }

      f.vx *= Math.pow(0.14, dt);
      f.vy *= Math.pow(0.2, dt);

      const base = f.dir * f.speed * f.z;
      let move = base + f.vx;
      // Keep at least a little forward motion so the sprite never faces
      // against its travel direction.
      if (f.dir > 0) move = Math.max(move, base * 0.3);
      else move = Math.min(move, base * 0.3);

      f.x += move * dt;
      f.y += f.vy * dt;
      f.y += (f.baseY - f.y) * Math.min(1, dt * 0.7);
      f.y = clamp(f.y, H * 0.05, H * 0.9);

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

    updateDeep(dt, t);
    updateDivers(dt, t);
    updateFrontDivers(dt, t);

    // Facts for the Marine Watch documentary overlay. Updating once a second
    // keeps DOM reads cheap while the captions stay current.
    docStatsTimer -= dt;
    if (docStatsTimer <= 0) {
      docStatsTimer = 1;
      marine.fish = fish.length;
      marine.deep = deep.length;
      marine.depth = Math.round(scrollProgress * 10900);
      marine.species = deep.length
        ? [...new Set(deep.map((c) => c.type))].join(", ")
        : "reef fish";
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

    // Plankton drift on the current and scatter from the pointer.
    for (const p of plankton) {
      p.x += Math.sin(t * p.speed + p.phase) * p.drift * dt;
      p.y += Math.cos(t * p.speed * 0.7 + p.phase) * p.drift * 0.6 * dt;

      if (on) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        const radius = 90 + p.z * 60;
        if (d < radius && d > 0.5) {
          const k = (1 - d / radius) * 90;
          p.vx += (dx / d) * k;
          p.vy += (dy / d) * k;
        }
      }

      p.vx *= Math.pow(0.12, dt);
      p.vy *= Math.pow(0.12, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < -6) p.x = W + 6;
      else if (p.x > W + 6) p.x = -6;
      if (p.y < -6) p.y = H + 6;
      else if (p.y > H + 6) p.y = -6;
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

    // going down the page feels deeper
    if (scrollProgress > 0.015) {
      const d = scrollProgress;
      const depth = ctx.createLinearGradient(0, 0, 0, H);
      if (theme === "dark") {
        depth.addColorStop(0, `rgba(2, 18, 26, ${0.03 + d * 0.18})`);
        depth.addColorStop(1, `rgba(0, 7, 11, ${0.06 + d * 0.2})`);
      } else {
        depth.addColorStop(0, `rgba(30, 110, 135, ${0.03 + d * 0.1})`);
        depth.addColorStop(1, `rgba(12, 66, 88, ${0.05 + d * 0.16})`);
      }
      ctx.fillStyle = depth;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0.06, watchLight * watchLight);
    drawRays(t);
    drawCaustics(t);
    ctx.restore();

    // Marine Watch night: less light the deeper you scroll. Drawn before the
    // creatures so their bioluminescence stands out against it.
    if (watchLight < 0.995) {
      const dark = 1 - watchLight;
      const night = ctx.createLinearGradient(0, 0, 0, H);
      night.addColorStop(0, `rgba(2, 8, 22, ${0.62 * dark})`);
      night.addColorStop(1, `rgba(0, 2, 10, ${0.82 * dark})`);
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, W, H);
    }

    // the distant giants drift behind everything else
    for (const c of deep) if (c.z < 0.45) drawDeep(c, t);

    drawManta(t);
    drawJellyfishAll(t);

    for (const c of deep) if (c.z >= 0.45 && c.z < 0.75) drawDeep(c, t);

    // fish behind the reef
    for (const f of fish) drawFish(f, t);
    drawFood();
    drawRod(t);
    drawTreats(t);
    drawDivers(t);

    for (const c of deep) if (c.z >= 0.75) drawDeep(c, t);

    drawKelp(t);

    if (reefSprite) {
      ctx.globalAlpha = theme === "dark" ? 0.92 : 0.8;
      ctx.drawImage(reefSprite, 0, H - reefH, W, reefH);
      ctx.globalAlpha = 1;
    }

    drawPlankton(t);

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

  let errorCount = 0;

  function frame(now) {
    // Always queue the next frame first. One bad frame must never end the
    // animation for good, which is what an uncaught error used to do.
    raf = requestAnimationFrame(frame);

    const dt = Math.min(64, Math.max(0, now - last)) / 1000;
    last = now;
    const t = now / 1000;

    try {
      update(dt, t);
    } catch (err) {
      if (errorCount++ < 3) console.warn("background update error", err);
    }

    try {
      // Reset canvas state in case an earlier failed frame left it unbalanced.
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      paint(t);
    } catch (err) {
      if (errorCount++ < 3) console.warn("background paint error", err);
    }

    try {
      drawFrontDivers(t);
    } catch (err) {
      if (errorCount++ < 3) console.warn("foreground diver paint error", err);
    }
  }

  function renderStatic() {
    clearFrontDiver();
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

  // Pointer state drives both the ripples and the creatures' reactions.
  let lastX = 0;
  let lastY = 0;
  let travel = 0;
  let lastRipple = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.at = performance.now();

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

  const onPress = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.at = performance.now();

      if (reduce.matches) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      addRipple(e.clientX, e.clientY, 1.7);

      // Clicking open water feeds the fish; clicking UI still startles them.
      const tg = e.target;
      const onUi = tg && tg.closest && tg.closest("a, button, input, select, textarea, label, .card, .note, .stat, .cta__box, .player, .lightbox, .topbar");
      if (watching()) {
        if (!onUi && !(tg.closest && tg.closest(".watch-hud, .watch-exit"))) handleWatchClick(e.clientX, e.clientY);
        lastRipple = performance.now();
        travel = 0;
        return;
      }

      if (!onUi) {
        dropFood(e.clientX, e.clientY);
        lastRipple = performance.now();
        travel = 0;
        return;
      }

      // Nearby residents get a fright.
      for (const f of fish) {
        const dx = f.x - e.clientX;
        const dy = f.y - e.clientY;
        const d = Math.hypot(dx, dy);
        if (d < 230 && d > 1) {
          f.vx += (dx / d) * 150;
          f.vy += (dy / d) * 150;
        }
      }

      for (const c of deep) {
        const d = Math.hypot(c.x - e.clientX, c.y - e.clientY);
        if (d < 150 + c.size * 0.8) {
          c.startle = 1.8;
          addRipple(c.x, c.y, 0.8);
        }
      }

      lastRipple = performance.now();
      travel = 0;
  };

  // Mouse and pen act on press. A finger might be starting a scroll, so a
  // touch only counts as a tap when it lifts without the browser taking
  // the gesture over (which fires pointercancel).
  let tapStart = null;

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") {
        tapStart = { x: e.clientX, y: e.clientY, target: e.target, at: performance.now() };
        return;
      }
      onPress(e);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerType !== "touch" || !tapStart) return;
      const s0 = tapStart;
      tapStart = null;
      if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 12 || performance.now() - s0.at > 500) return;
      onPress({ clientX: e.clientX, clientY: e.clientY, target: s0.target, pointerType: "mouse", button: 0 });
    },
    { passive: true }
  );

  window.addEventListener("pointercancel", () => {
    tapStart = null;
  });

  // The music player drops a ripple into the water as it plays.
  document.addEventListener("bgm:pulse", (e) => {
    if (reduce.matches || !e.detail) return;
    addRipple(e.detail.x, e.detail.y, 1.2);
  });

  document.documentElement.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  window.addEventListener("blur", () => {
    pointer.active = false;
  });

  window.addEventListener("scroll", measureScroll, { passive: true });

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
      frontDivers.forEach((d) => {
        d.spot = null;
        d.state = "idle";
        d.cooldown = rand(2, 4);
      });
      clearFrontDiver();
      renderStatic();
    } else {
      start();
    }
  });

  resize();
  renderStatic();
  start();
  setTimeout(measureScroll, 500);
  window.addEventListener("load", () => {
    setTimeout(measureScroll, 250);
    // Fonts and the rendered shelf can move the hero, so re-anchor the
    // divers once the layout has settled.
    setTimeout(buildDivers, 600);
  });
})();
