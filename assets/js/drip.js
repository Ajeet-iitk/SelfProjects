/* ==========================================================================
   Water-drip click sound
   A droplet plays on every mouse click and every finger tap. A touch that
   turns into a scroll does not count. Several drips can overlap, and there is
   an on/off button in the music panel (remembered between visits).
   ========================================================================== */

(() => {
  "use strict";

  const SRC = "assets/audio/drip.mp3";
  const KEY = "hobby-arcade:drip:on";
  const POOL = 4;

  const toggle = document.getElementById("drip-toggle");

  let enabled = true;
  try {
    enabled = localStorage.getItem(KEY) !== "0";
  } catch {
    /* ignore */
  }

  const pool = Array.from({ length: POOL }, () => {
    const a = new Audio(SRC);
    a.preload = "auto";
    a.volume = 0.55;
    return a;
  });
  let next = 0;

  function drip() {
    if (!enabled) return;
    const a = pool[next];
    next = (next + 1) % POOL;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function paint() {
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", enabled ? "Click sound on" : "Click sound off");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      enabled = !enabled;
      try {
        localStorage.setItem(KEY, enabled ? "1" : "0");
      } catch {
        /* ignore */
      }
      paint();
    });
  }
  paint();

  // mouse / pen: on press. touch: on a clean tap only.
  let tap = null;

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") {
        tap = { x: e.clientX, y: e.clientY, at: performance.now() };
        return;
      }
      if (e.button === 0) drip();
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerType !== "touch" || !tap) return;
      const t = tap;
      tap = null;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 12 && performance.now() - t.at <= 500) drip();
    },
    { passive: true }
  );

  window.addEventListener("pointercancel", () => {
    tap = null;
  });
})();
