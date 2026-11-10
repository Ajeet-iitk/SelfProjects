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
  const slider = document.getElementById("drip-volume");
  const VOL_KEY = "hobby-arcade:drip:vol";
  let level = 0.55;
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v)) level = Math.min(1, Math.max(0, v));
  } catch {
    /* ignore */
  }

  let enabled = true;
  try {
    enabled = localStorage.getItem(KEY) !== "0";
  } catch {
    /* ignore */
  }

  const pool = Array.from({ length: POOL }, () => {
    const a = new Audio(SRC);
    a.preload = "auto";
    a.volume = level;
    return a;
  });
  let next = 0;

  // Web Audio gives a true 0-100% range (HTML audio volume is ignored on
  // iPhones and can only attenuate). 100% plays at double the recording's
  // level, 0% is silent, and it falls back to <audio> if decoding fails.
  const GAIN_AT_FULL = 2;
  let actx = null;
  let buffer = null;
  let gainNode = null;

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      actx = new AC();
      gainNode = actx.createGain();
      gainNode.gain.value = level * GAIN_AT_FULL;
      gainNode.connect(actx.destination);
      fetch(SRC)
        .then((res) => res.arrayBuffer())
        .then((data) => new Promise((ok, fail) => actx.decodeAudioData(data, ok, fail)))
        .then((buf) => {
          buffer = buf;
        })
        .catch(() => {
          buffer = null;
        });
    }
  } catch {
    actx = null;
  }

  function dripWeb() {
    if (actx.state === "suspended") actx.resume();
    const src = actx.createBufferSource();
    src.buffer = buffer;
    src.connect(gainNode);
    src.start(0);
  }

  function drip() {
    if (!enabled || level === 0) return;
    if (actx && buffer && gainNode) {
      dripWeb();
      return;
    }
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
    if (slider) {
      slider.value = String(Math.round(level * 100));
      slider.style.setProperty("--fill", `${Math.round(level * 100)}%`);
    }
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
  if (slider) {
    slider.addEventListener("input", () => {
      level = Math.min(1, Math.max(0, Number(slider.value) / 100));
      for (const a of pool) a.volume = level;
      if (gainNode) gainNode.gain.value = level * GAIN_AT_FULL;
      if (level > 0 && !enabled) {
        enabled = true;
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.setItem(VOL_KEY, String(level));
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
