/* ==========================================================================
   Clinging octopuses
   A fixed, transparent canvas draws a handful of pseudo-3D octopuses that
   hold on to headings and project cards. Each one reads the accent colour of
   the card it sits on (or the theme's mint for text), so it blends with its
   surroundings, and its eyes follow the pointer.

   The canvas sits above the page but below the topbar and lightbox, and is
   pointer-events: none, so links, buttons and the lightbox keep working.
   Nothing animates when the visitor prefers reduced motion — a single static
   frame is drawn instead.
   ========================================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("octo-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let W = 0;
  let H = 0;
  let DPR = 1;
  let theme = root.getAttribute("data-theme") === "light" ? "light" : "dark";

  let raf = 0;
  let last = 0;
  let measureAt = 0;
  let scanQueued = false;
  let resizeTimer = 0;

  const pointer = { x: -9999, y: -9999, active: false };
  const octs = [];
  const seen = new WeakSet();

  // Where octopuses like to hold on. Cards are placed separately so they are
  // spread evenly down the whole shelf instead of clustering at the top.
  const CARD_CFG = { sel: ".card", kind: "card", size: 31, cap: 4 };
  const SELECTORS = [
    { sel: ".hero__title", kind: "text", size: 27, every: 1, cap: 1 },
    { sel: ".section__title", kind: "text", size: 22, every: 2, cap: 2 },
    { sel: ".note", kind: "card", size: 24, every: 2, cap: 2 },
    { sel: ".cta__title", kind: "text", size: 24, every: 1, cap: 1 },
  ];

  const THEME_COLOUR = {
    dark: { r: 96, g: 244, b: 206 },
    light: { r: 16, g: 124, b: 116 },
  };

  /* ------------------------------------------------------------------ */
  /* colour helpers                                                      */
  /* ------------------------------------------------------------------ */

  function parseColour(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    let m = raw.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let hex = m[1];
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    }

    m = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
    return null;
  }

  function mix(a, b, t) {
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  function css(c, alpha = 1) {
    return `rgba(${Math.round(clamp(c.r, 0, 255))}, ${Math.round(clamp(c.g, 0, 255))}, ${Math.round(
      clamp(c.b, 0, 255)
    )}, ${alpha})`;
  }

  function targetColour(o) {
    const fallback = THEME_COLOUR[theme] || THEME_COLOUR.dark;

    if (o.kind === "card" && o.el) {
      const accent = parseColour(getComputedStyle(o.el).getPropertyValue("--accent"));
      if (accent) {
        return theme === "light"
          ? mix(accent, { r: 18, g: 78, b: 76 }, 0.38)
          : mix(accent, { r: 200, g: 255, b: 242 }, 0.16);
      }
    }

    const mint = parseColour(getComputedStyle(root).getPropertyValue("--mint"));
    if (mint) {
      return theme === "light" ? mix(mint, { r: 255, g: 255, b: 255 }, 0.12) : mix(mint, { r: 220, g: 255, b: 245 }, 0.12);
    }
    return fallback;
  }

  function refreshColours() {
    for (const o of octs) o.target = targetColour(o);
  }

  /* ------------------------------------------------------------------ */
  /* registration + measurement                                          */
  /* ------------------------------------------------------------------ */

  function add(el, cfg) {
    seen.add(el);
    octs.push({
      el,
      kind: cfg.kind,
      cfgSel: cfg.sel,
      size: cfg.size,
      phase: rand(0, TAU),
      bobSpeed: rand(0.7, 1.2),
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      scale: 1,
      ready: false,
      visible: false,
      near: 0,
      blink: 0,
      nextBlink: rand(1.5, 5),
      col: { ...THEME_COLOUR[theme] },
      target: { ...THEME_COLOUR[theme] },
    });
  }

  function maxOctos() {
    return W < 560 ? 5 : W < 900 ? 7 : 8;
  }

  function cardSlots() {
    return W < 560 ? 2 : W < 900 ? 3 : 4;
  }

  function forget(o) {
    o.el.removeAttribute("data-octo");
    seen.delete(o.el);
    octs.splice(octs.indexOf(o), 1);
  }

  function prune() {
    for (let i = octs.length - 1; i >= 0; i -= 1) {
      if (!octs[i].el.isConnected) forget(octs[i]);
    }
  }

  function trim(max) {
    // When the viewport shrinks, give up the least important anchors first.
    for (const sel of [".cta__title", ".note", ".section__title", ".card"]) {
      for (let i = octs.length - 1; i >= 0 && octs.length > max; i -= 1) {
        if (octs[i].cfgSel === sel) forget(octs[i]);
      }
    }
  }

  function takeGroup(cfg, max) {
    let taken = octs.filter((o) => o.cfgSel === cfg.sel).length;
    let i = 0;

    for (const el of document.querySelectorAll(cfg.sel)) {
      if (octs.length >= max || taken >= cfg.cap) break;
      if (seen.has(el) || el.closest(".lightbox") || el.closest(".topbar")) continue;

      if (i % cfg.every === 0) {
        el.setAttribute("data-octo", "on");
        add(el, cfg);
        taken += 1;
      }
      i += 1;
    }
  }

  function placeCards(max) {
    const cards = Array.from(document.querySelectorAll("#grid .card")).filter((el) => !el.hidden);
    const slots = Math.min(cardSlots(), cards.length);
    const picks = new Set();

    for (let s = 0; s < slots; s += 1) {
      picks.add(cards[Math.min(cards.length - 1, Math.floor(((s + 0.5) / slots) * cards.length))]);
    }

    // Drop anchors whose card is no longer one of the evenly-spaced picks.
    for (let i = octs.length - 1; i >= 0; i -= 1) {
      const o = octs[i];
      if (o.cfgSel === CARD_CFG.sel && !picks.has(o.el)) forget(o);
    }

    const have = new Set(octs.filter((o) => o.cfgSel === CARD_CFG.sel).map((o) => o.el));
    for (const el of picks) {
      if (octs.length >= max) break;
      if (have.has(el)) continue;
      el.setAttribute("data-octo", "on");
      add(el, CARD_CFG);
    }
  }

  function scan() {
    const max = maxOctos();
    prune();
    trim(max);
    takeGroup(SELECTORS[0], max); // hero title
    placeCards(max);
    takeGroup(SELECTORS[1], max); // section titles
    takeGroup(SELECTORS[2], max); // notes
    takeGroup(SELECTORS[3], max); // cta title

    refreshColours();
    if (reduce.matches) renderStatic();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    // Timers rather than rAF: cards can arrive while the tab is backgrounded.
    setTimeout(() => {
      scanQueued = false;
      scan();
    }, 140);
  }

  /* The end of the last word on the longest line, so an octopus clings to the
     text itself rather than to the invisible edge of a full-width block. */
  function textEnd(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      let best = null;

      for (const r of range.getClientRects()) {
        if (r.width < 6 || r.height < 6) continue;
        if (!best || r.right > best.right) best = r;
      }
      if (!best) return null;
      return { right: best.right, center: best.top + best.height / 2, width: best.width };
    } catch {
      return null;
    }
  }

  function measure(o) {
    const r = o.el.getBoundingClientRect();

    if (r.width < 2 && r.height < 2) {
      o.visible = false;
      return;
    }

    if (o.kind === "card") {
      o.tx = r.right - Math.min(24, Math.max(14, r.width * 0.08));
      o.ty = r.top + 1;
      o.scale = clamp(r.width / 340, 0.62, 1);
    } else {
      const end = textEnd(o.el);
      o.scale = clamp((end ? end.width : r.width) / 380, 0.68, 1);
      // Nudge the body just past the last glyph so it clings without hiding
      // the letters, while tentacles still curl back over the word.
      o.tx = (end ? end.right : r.right) + o.size * o.scale * 0.42;
      o.ty = end ? end.center : r.top + r.height * 0.52;
    }

    const on = r.bottom > -140 && r.top < H + 140 && r.right > -80 && r.left < W + 80;
    if (on && (!o.visible || !o.ready)) {
      o.x = o.tx;
      o.y = o.ty;
      o.ready = true;
    }
    o.visible = on;
  }

  /* ------------------------------------------------------------------ */
  /* drawing                                                             */
  /* ------------------------------------------------------------------ */

  function bezier(sx, sy, c1x, c1y, c2x, c2y, ex, ey, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * sx + b * c1x + c * c2x + d * ex,
      y: a * sy + b * c1y + c * c2y + d * ey,
    };
  }

  function drawOcto(o, t) {
    const s = o.size * o.scale;
    const bob = Math.sin(t * 0.9 * o.bobSpeed + o.phase) * 2.2;
    const x = o.x;
    const y = o.y + bob;
    const col = o.col;
    const R = s * (0.62 + o.near * 0.04);

    const light = {
      r: Math.min(255, col.r + 72),
      g: Math.min(255, col.g + 58),
      b: Math.min(255, col.b + 48),
    };
    const dark = { r: col.r * 0.42, g: col.g * 0.4, b: col.b * 0.5 };
    const sucker = {
      r: Math.min(255, col.r * 1.35 + 42),
      g: Math.min(255, col.g * 1.25 + 40),
      b: Math.min(255, col.b * 1.2 + 40),
    };

    // shadow in the water
    ctx.save();
    ctx.fillStyle = theme === "dark" ? "rgba(0, 0, 0, 0.3)" : "rgba(8, 58, 68, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x + s * 0.12, y + s * 0.62, R * 1.3, R * 0.55, 0.08, 0, TAU);
    ctx.fill();
    ctx.restore();

    // soft bioluminescent halo
    if (theme === "dark") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 2.1);
      glow.addColorStop(0, css(col, 0.22 + o.near * 0.18));
      glow.addColorStop(1, css(col, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, s * 2.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // tentacles
    const n = 8;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i += 1) {
      const spread = (i - (n - 1) / 2) / ((n - 1) / 2);
      const sway = Math.sin(t * (0.9 + i * 0.05) + o.phase + i * 0.7);

      const sx = x + spread * s * 0.32;
      const sy = y + s * 0.38;
      const ex = x + spread * s * 1.45 + sway * s * 0.3;
      const ey = y + s * (1.5 + 0.2 * Math.cos(i * 1.3 + o.phase)) + Math.cos(t * 0.8 + i) * s * 0.1;
      const c1x = sx + spread * s * 0.72 + Math.sin(t * 0.7 + i) * s * 0.14;
      const c1y = sy + s * 0.7;
      const c2x = ex - spread * s * 0.55;
      const c2y = ey - s * 0.45;

      ctx.strokeStyle = css(dark, 0.88);
      ctx.lineWidth = s * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
      ctx.stroke();

      ctx.strokeStyle = css(col, 0.96);
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
      ctx.stroke();

      ctx.fillStyle = css(sucker, 0.9);
      for (const at of [0.3, 0.46, 0.62, 0.78]) {
        const p = bezier(sx, sy, c1x, c1y, c2x, c2y, ex, ey, at);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.7, s * 0.044), 0, TAU);
        ctx.fill();
      }
    }

    // body / mantle
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.5 + o.phase) * 0.06);

    const body = ctx.createRadialGradient(-R * 0.38, -R * 0.45, R * 0.08, 0, 0, R * 1.28);
    body.addColorStop(0, css(light, 0.99));
    body.addColorStop(0.55, css(col, 0.99));
    body.addColorStop(1, css(dark, 0.98));
    ctx.fillStyle = body;

    ctx.beginPath();
    ctx.ellipse(0, R * 0.04, R, R * 0.93, 0, 0, TAU);
    ctx.fill();

    // mantle bump, gives the silhouette a little 3D volume
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.42, R * 0.74, R * 0.62, 0, 0, TAU);
    ctx.fill();

    // rim light
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    ctx.ellipse(0, R * 0.05, R * 0.87, R * 0.8, 0, Math.PI * 1.06, Math.PI * 1.6);
    ctx.stroke();

    // eyes with pointer-following pupils
    const eyeY = -R * 0.16;
    const open = o.blink > 0 ? 0.14 : 1;
    const lookX = pointer.active ? pointer.x : x + Math.sin(t * 0.7 + o.phase) * 40;
    const lookY = pointer.active ? pointer.y : y + 24;
    const angle = Math.atan2(lookY - (y + eyeY), lookX - x);
    const pupilX = Math.cos(angle) * R * 0.085;
    const pupilY = Math.sin(angle) * R * 0.085;

    for (const side of [-1, 1]) {
      const ex = side * R * 0.34;

      ctx.fillStyle = css(dark, 0.95);
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, R * 0.27, R * 0.25 * open, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(244, 255, 252, 0.96)";
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, R * 0.22, R * 0.2 * open, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = theme === "dark" ? "rgba(2, 24, 30, 0.96)" : "rgba(8, 42, 46, 0.96)";
      ctx.beginPath();
      ctx.arc(ex + pupilX, eyeY + pupilY, Math.max(0.7, R * 0.1 * open), 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(ex + pupilX - R * 0.045, eyeY + pupilY - R * 0.045, Math.max(0.4, R * 0.033), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function paint(t) {
    ctx.clearRect(0, 0, W, H);
    for (const o of octs) if (o.ready && o.visible) drawOcto(o, t);
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                */
  /* ------------------------------------------------------------------ */

  function frame(now) {
    raf = requestAnimationFrame(frame);

    const t = now / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;

    if (t - measureAt > 0.12) {
      measureAt = t;
      for (const o of octs) measure(o);
    }

    const colourEase = 1 - Math.exp(-dt * 2.4);
    const moveEase = 1 - Math.exp(-dt * 6);
    const nearEase = 1 - Math.exp(-dt * 5);

    for (const o of octs) {
      if (!o.ready || !o.visible) continue;

      o.x += (o.tx - o.x) * moveEase;
      o.y += (o.ty - o.y) * moveEase;

      o.col.r += (o.target.r - o.col.r) * colourEase;
      o.col.g += (o.target.g - o.col.g) * colourEase;
      o.col.b += (o.target.b - o.col.b) * colourEase;

      o.nextBlink -= dt;
      if (o.nextBlink <= 0) {
        o.blink = 0.12;
        o.nextBlink = rand(2.4, 6);
      }
      if (o.blink > 0) o.blink -= dt;

      const reach = o.size * o.scale * 3.4;
      const d = pointer.active ? Math.hypot(pointer.x - o.x, pointer.y - o.y) : Infinity;
      const near = d < reach ? 1 - d / reach : 0;
      o.near += (near - o.near) * nearEase;
    }

    paint(t);
  }

  function renderStatic() {
    for (const o of octs) {
      measure(o);
      if (!o.ready) {
        o.x = o.tx;
        o.y = o.ty;
        o.ready = true;
      }
    }
    paint(0);
  }

  function start() {
    if (reduce.matches) {
      renderStatic();
      return;
    }
    if (raf || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function applyMotion() {
    if (reduce.matches) {
      stop();
      renderStatic();
    } else {
      start();
    }
  }

  /* ------------------------------------------------------------------ */
  /* sizing + wiring                                                     */
  /* ------------------------------------------------------------------ */

  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    for (const o of octs) o.ready = false;
    measureAt = 0;

    if (reduce.matches) renderStatic();
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );

  document.documentElement.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("blur", () => {
    pointer.active = false;
  });

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeCanvas();
      queueScan();
    }, 140);
  });

  document.addEventListener("themechange", (e) => {
    theme = e.detail && e.detail.theme === "light" ? "light" : "dark";
    refreshColours();
    if (reduce.matches) renderStatic();
  });

  reduce.addEventListener("change", applyMotion);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!reduce.matches) start();
  });

  const grid = document.getElementById("grid");
  if (grid) {
    const observer = new MutationObserver(queueScan);
    observer.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  sizeCanvas();
  applyMotion();

  // The shelf is built on DOMContentLoaded, so wait one beat before choosing
  // anchors. Grid mutations then re-spread the octopuses when filters or
  // newly discovered repositories change the card set.
  const firstScan = () => {
    setTimeout(() => {
      scan();
      if (reduce.matches) renderStatic();
    }, 220);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", firstScan, { once: true });
  } else {
    firstScan();
  }

  window.addEventListener("load", () => {
    scan();
    if (reduce.matches) renderStatic();
  });
})();
