/* ==========================================================================
   Bubble burst
   Two gestures fill the screen with rising bubbles and play a short
   underwater rush:

     - shaking a phone (devicemotion, with iOS permission requested on the
       first clean tap)
     - whipping the cursor across the water while Marine Watch is on

   The canvas sits above the page but below the controls, never catches a
   pointer event, and pauses itself the moment the last bubble leaves.
   The sound follows the click-sound switch and volume in the music panel,
   so muting effects silences this too.
   ========================================================================== */

(() => {
  "use strict";

  const SRC = "assets/audio/bubbles.mp3";
  const SFX_ON_KEY = "hobby-arcade:drip:on";
  const SFX_VOL_KEY = "hobby-arcade:drip:vol";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const body = document.body;
  const watching = () => body.classList.contains("is-watching");
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ------------------------------------------------------------------ */
  /* sound                                                               */
  /* ------------------------------------------------------------------ */

  // The burst rides the same "click sound" switch and level as the drip,
  // so one control mutes every effect on the page.
  function sfxLevel() {
    let on = true;
    let level = 0.55;
    try {
      on = localStorage.getItem(SFX_ON_KEY) !== "0";
      const stored = parseFloat(localStorage.getItem(SFX_VOL_KEY));
      if (Number.isFinite(stored)) level = Math.min(1, Math.max(0, stored));
    } catch {
      /* private mode */
    }
    return on ? level : 0;
  }

  let actx = null;
  let buffer = null;
  const fallback = new Audio(SRC);
  fallback.preload = "auto";

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      actx = new AC();
      // Decoding up front keeps the very first burst instant.
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

  function play() {
    const level = sfxLevel();
    if (level <= 0) return;
    const gain = Math.min(1.5, level * level * 2.4);

    if (actx && buffer) {
      try {
        if (actx.state === "suspended") actx.resume();
        const src = actx.createBufferSource();
        const node = actx.createGain();
        src.buffer = buffer;
        node.gain.value = gain;
        src.connect(node).connect(actx.destination);
        src.start(0);
        return;
      } catch {
        /* fall through to the element */
      }
    }

    try {
      fallback.currentTime = 0;
      fallback.volume = Math.min(1, gain);
      const p = fallback.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  // Browsers only allow audible Web Audio after a gesture. Unlock on the
  // first interaction anywhere; the marine-watch click and every tap cover it.
  const unlock = () => {
    if (actx && actx.state === "suspended") actx.resume().catch(() => {});
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* bubbles on a dedicated overlay canvas                               */
  /* ------------------------------------------------------------------ */

  let canvas = null;
  let ctx = null;
  let DPR = 1;
  let W = 0;
  let H = 0;
  let particles = [];
  let raf = 0;
  let lastFrame = 0;
  let lastBurst = 0;

  function makeLayer() {
    canvas = document.createElement("canvas");
    canvas.className = "bubble-burst";
    canvas.setAttribute("aria-hidden", "true");
    body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    sizeLayer();
  }

  function sizeLayer() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn(count) {
    for (let i = 0; i < count; i += 1) {
      // A few oversized bubbles carry the burst; the rest are fine fizz.
      const big = Math.random() < 0.12;
      const r = rand(2.2, 6.4) * (big ? rand(1.6, 2.5) : 1);
      particles.push({
        baseX: rand(-24, W + 24),
        x: 0,
        y: rand(H * 0.32, H + r * 2),
        r,
        vy: rand(150, 320) + r * 16,
        sway: rand(4, 20),
        freq: rand(0.7, 2.1),
        phase: rand(0, Math.PI * 2),
        born: performance.now(),
        life: rand(2.4, 4.2) * 1000,
        alpha: 0,
      });
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    ctx.clearRect(0, 0, W, H);

    const light = document.documentElement.getAttribute("data-theme") === "light";
    const rim = light ? "18, 86, 108" : "214, 247, 255";
    const rimAlpha = light ? 0.55 : 0.78;

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      const age = now - p.born;

      p.y -= p.vy * dt;
      const swing = age / 1000;
      p.x = p.baseX + Math.sin(swing * p.freq * Math.PI * 2 + p.phase) * p.sway;

      if (p.y < -p.r * 2 || age > p.life) {
        particles.splice(i, 1);
        continue;
      }

      const fadeIn = Math.min(1, age / 160);
      const fadeOut = Math.min(1, (p.life - age) / 700);
      p.alpha = Math.max(0, Math.min(fadeIn, fadeOut));

      ctx.globalAlpha = p.alpha * rimAlpha;
      ctx.strokeStyle = `rgb(${rim})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();

      // The little highlight that makes a circle read as a bubble.
      ctx.globalAlpha = p.alpha * (light ? 0.7 : 0.5);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.34, Math.max(0.8, p.r * 0.26), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (particles.length) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function burst() {
    const now = performance.now();
    if (now - lastBurst < 900) return;
    lastBurst = now;

    play();

    // Reduced motion keeps the sound but skips the full-screen storm.
    if (reduce.matches) return;

    if (!canvas) makeLayer();
    else if (W !== window.innerWidth || H !== window.innerHeight) sizeLayer();

    spawn(Math.round(Math.min(150, Math.max(70, W / 8))));

    if (!raf) {
      lastFrame = now;
      raf = requestAnimationFrame(tick);
    }
  }

  window.addEventListener("resize", () => {
    if (canvas) sizeLayer();
  });

  /* ------------------------------------------------------------------ */
  /* shake a phone                                                       */
  /* ------------------------------------------------------------------ */

  const motion = { last: null, spikes: [], armed: false };

  function onMotion(e) {
    if (document.hidden) return;
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;

    const now = performance.now();
    if (!motion.last) {
      motion.last = { x: a.x, y: a.y, z: a.z, t: now };
      return;
    }

    // Jerk (change of acceleration per second) ignores both gravity and the
    // slow tilt of walking around, but jumps when the phone is shaken.
    const dt = Math.max(0.008, Math.min(0.12, (now - motion.last.t) / 1000));
    const dx = a.x - motion.last.x;
    const dy = a.y - motion.last.y;
    const dz = a.z - motion.last.z;
    motion.last = { x: a.x, y: a.y, z: a.z, t: now };

    if (Math.hypot(dx, dy, dz) / dt < 180) return;

    motion.spikes.push(now);
    while (motion.spikes.length && now - motion.spikes[0] > 1200) motion.spikes.shift();

    if (motion.spikes.length >= 3) {
      motion.spikes.length = 0;
      burst();
    }
  }

  function armShake() {
    if (motion.armed || typeof window.DeviceMotionEvent === "undefined") return;
    motion.armed = true;
    window.addEventListener("devicemotion", onMotion, { passive: true });
  }

  const touchy = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const needsPermission =
    typeof window.DeviceMotionEvent !== "undefined" &&
    typeof window.DeviceMotionEvent.requestPermission === "function";

  if (touchy) {
    let state = "idle"; // idle | pending | denied | granted
    let retried = false;

    const request = () => {
      if (motion.armed || state === "pending" || state === "granted") return;
      state = "pending";
      try {
        const p = window.DeviceMotionEvent.requestPermission();
        if (!p || !p.then) {
          state = "granted";
          armShake();
          return;
        }
        p.then((answer) => {
          state = answer === "granted" ? "granted" : "denied";
          if (state === "granted") armShake();
        }).catch(() => {
          state = "denied";
        });
      } catch {
        state = "denied";
      }
    };

    if (!needsPermission) {
      armShake();
    } else {
      // Browsers that already remember a "yes" arm silently. Safari refuses
      // the unattended call, so the first clean tap asks once more.
      request();

      let tap = null;
      window.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "touch") tap = { x: e.clientX, y: e.clientY, t: performance.now() };
        },
        { passive: true }
      );

      window.addEventListener(
        "pointerup",
        (e) => {
          if (motion.armed || retried || e.pointerType !== "touch" || !tap) return;
          const start = tap;
          tap = null;
          // Ignore scrolls and long presses; a small tap is the cue.
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14 || performance.now() - start.t > 500) return;
          retried = true;
          state = "idle";
          request();
        },
        { passive: true }
      );
    }
  }

  // Fast cursor sweep while Marine Watch is on. Touch drags are ignored, so
  // scrolling a phone never fires it.
  let px = 0;
  let py = 0;
  let pt = 0;
  let speed = 0;
  let fast = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch" || !watching()) {
        px = py = pt = 0;
        speed = 0;
        fast = 0;
        return;
      }

      const now = performance.now();
      if (!pt) {
        px = e.clientX;
        py = e.clientY;
        pt = now;
        return;
      }

      const dt = Math.max(1, now - pt);
      const dist = Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
      pt = now;

      // px per second, smoothed so one jittery sample cannot fire it.
      const v = (dist / dt) * 1000;
      speed = dt > 90 ? 0 : speed * 0.65 + v * 0.35;

      if (speed < 2000) {
        fast = Math.max(0, fast - 1);
        return;
      }

      fast += 1;
      if (fast >= 2) {
        fast = 0;
        burst();
      }
    },
    { passive: true }
  );

  // Small hook for tests and for anything else that wants the effect.
  window.BubbleBurst = {
    burst,
    get active() {
      return particles.length;
    },
  };
})();
