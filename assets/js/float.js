/* ==========================================================================
   Floating interface
   Gives headings, copy, buttons, tiles and project cards a slow underwater
   bob, then lets them lean away from the pointer like drifting debris.

   The effect uses the independent `translate` and `rotate` CSS properties,
   so the existing hover transforms in style.css keep working. Nothing moves
   when the visitor prefers reduced motion.
   ========================================================================== */

(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  // amp: bob height (px) · rot: idle sway (deg)
  // push: how far the pointer shoves it (px) · radius: reaction distance (px)
  const GROUPS = [
    { sel: ".hero__title, .section__title, .cta__title", amp: 3.2, rot: 0.2, push: 10, radius: 230 },
    { sel: ".hero__lede, .section__sub, .cta__sub", amp: 2.4, rot: 0.12, push: 7, radius: 200 },
    { sel: ".eyebrow, .section__count, .note__num", amp: 2.4, rot: 0.18, push: 8, radius: 190 },
    { sel: ".hero__actions .btn, .cta__box .btn", amp: 2, rot: 0.12, push: 7, radius: 170 },
    { sel: ".stat", amp: 3.6, rot: 0.22, push: 12, radius: 220 },
    { sel: ".search, .segmented, .sort", amp: 2, rot: 0.1, push: 6, radius: 180 },
    { sel: ".chip", amp: 1.5, rot: 0.08, push: 6, radius: 150 },
    { sel: ".card", amp: 4.2, rot: 0.25, push: 18, radius: 300 },
    { sel: ".note", amp: 4, rot: 0.24, push: 16, radius: 280 },
    { sel: ".cta__box", amp: 4.6, rot: 0.26, push: 20, radius: 320 },
    { sel: ".footer__inner > p", amp: 2, rot: 0.1, push: 6, radius: 180 },
    { sel: ".brand, .nav > a, .theme-toggle", amp: 1.2, rot: 0, push: 4, radius: 140, fixed: true },
  ];

  const items = new Set();
  const byEl = new WeakMap();
  const pointer = { x: -9999, y: -9999, active: false, at: 0 };

  let raf = 0;
  let lastT = 0;
  let scrollY = window.scrollY || 0;
  let scanQueued = false;

  /* ------------------------------------------------------------------ */
  /* registration + measurement                                          */
  /* ------------------------------------------------------------------ */

  function measure(s) {
    const rect = s.el.getBoundingClientRect();
    s.cx = rect.left + rect.width / 2;
    s.cy = rect.top + rect.height / 2;
    s.w = rect.width;
    // Fixed elements keep viewport coordinates; everything else is stored
    // in document space so scrolling never needs a fresh layout read.
    s.baseY = s.fixed ? s.cy : s.cy + scrollY;
    s.ready = true;
  }

  function measureAll() {
    scrollY = window.scrollY || 0;
    for (const s of items) measure(s);
  }

  function register(el, cfg) {
    if (!el || byEl.has(el)) return;
    if (el.closest(".lightbox")) return;

    const s = {
      el,
      cfg,
      fixed: !!cfg.fixed,
      phase: Math.random() * Math.PI * 2,
      speed: 0.23 + Math.random() * 0.35, // rad/s
      ampMul: 0.7 + Math.random() * 0.6,
      rotMul: 0.7 + Math.random() * 0.7,
      x: 0,
      y: 0,
      r: 0,
      tx: 0,
      ty: 0,
      tr: 0,
      hover: false,
      ready: false,
      cx: 0,
      cy: 0,
      baseY: 0,
      w: 0,
    };

    if (!reduce.matches) el.setAttribute("data-float", "on");
    el.addEventListener("pointerenter", () => {
      s.hover = true;
    });
    el.addEventListener("pointerleave", () => {
      s.hover = false;
    });

    items.add(s);
    byEl.set(el, s);
    if (ro) ro.observe(el);
  }

  function scan(root) {
    const scope = root || document;
    for (const cfg of GROUPS) {
      const found = scope.querySelectorAll(cfg.sel);
      for (const el of found) register(el, cfg);
    }
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    // Timers rather than rAF: cards can land while the tab is backgrounded.
    setTimeout(() => {
      scanQueued = false;
      scan(document);
    }, 60);
  }

  const ro =
    "ResizeObserver" in window
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const s = byEl.get(entry.target);
            if (s) measure(s);
          }
        })
      : null;

  /* ------------------------------------------------------------------ */
  /* animation                                                           */
  /* ------------------------------------------------------------------ */

  function frame(now) {
    raf = requestAnimationFrame(frame);

    const t = now / 1000;
    const dt = lastT ? Math.min(0.05, t - lastT) : 0.016;
    lastT = t;
    scrollY = window.scrollY || 0;

    const pointerOn = pointer.active && t - pointer.at < 3;
    const ease = 1 - Math.exp(-dt * 7);
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    for (const s of items) {
      if (!s.ready) measure(s);

      const cy = s.fixed ? s.baseY : s.baseY - scrollY;
      const cx = s.cx;

      // Do not touch elements that are far outside the viewport.
      if (cy < -260 || cy > vh + 280 || cx < -360 || cx > vw + 360) continue;

      const cfg = s.cfg;
      const amp = cfg.amp * s.ampMul;

      let tx = Math.cos(t * s.speed * 0.63 + s.phase * 1.4) * amp * 0.55;
      let ty = Math.sin(t * s.speed + s.phase) * amp;
      let tr = Math.sin(t * s.speed * 0.82 + s.phase) * cfg.rot * s.rotMul;

      if (pointerOn) {
        const dx = cx - pointer.x;
        const dy = cy - pointer.y;
        const d = Math.hypot(dx, dy);
        const R = cfg.radius;

        if (d < R && d > 0.5) {
          const f = 1 - d / R;
          const k = f * f;
          // Water pushed aside by the cursor.
          tx += (dx / d) * cfg.push * k;
          ty += (dy / d) * cfg.push * k;
          tr += (dx / d) * cfg.rot * 8 * k;
        }
      }

      if (s.hover) {
        // Hovered pieces lift a little and tilt toward the cursor.
        const lean = s.w ? Math.max(-1, Math.min(1, (pointer.x - cx) / (s.w * 0.5))) : 0;
        ty -= 2.5;
        tr += lean * cfg.rot * 5;
      }

      s.tx = tx;
      s.ty = ty;
      s.tr = tr;
      s.x += (tx - s.x) * ease;
      s.y += (ty - s.y) * ease;
      s.r += (tr - s.r) * ease;

      const el = s.el;
      el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
      el.style.rotate = `${s.r.toFixed(3)}deg`;
    }
  }

  function start() {
    if (raf || reduce.matches || document.hidden) return;
    for (const s of items) s.el.setAttribute("data-float", "on");
    lastT = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function settle() {
    for (const s of items) {
      s.el.style.translate = "";
      s.el.style.rotate = "";
      s.el.removeAttribute("data-float");
      s.x = s.y = s.r = 0;
    }
  }

  /* ------------------------------------------------------------------ */
  /* pointer                                                             */
  /* ------------------------------------------------------------------ */

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.at = performance.now() / 1000;
    },
    { passive: true }
  );

  document.documentElement.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("blur", () => {
    pointer.active = false;
  });

  /* ------------------------------------------------------------------ */
  /* wiring                                                              */
  /* ------------------------------------------------------------------ */

  function applyMotionPreference() {
    if (reduce.matches) {
      stop();
      settle();
    } else {
      start();
    }
  }

  reduce.addEventListener("change", applyMotionPreference);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("resize", measureAll);
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY || 0;
  }, { passive: true });
  window.addEventListener("load", () => {
    measureAll();
    start();
  });

  const grid = document.getElementById("grid");
  if (grid) {
    const mo = new MutationObserver(queueScan);
    mo.observe(grid, { childList: true, subtree: true, characterData: true });
  }

  scan(document);
  measureAll();
  applyMotionPreference();
})();
