/* ==========================================================================
   Bubble burst
   Two gestures fill the screen with rising bubbles and play a short
   underwater rush:

     - shaking a phone (devicemotion, with iOS permission requested on the
       first clean tap)
     - a heavy, fast sweep of the mouse anywhere on the page

   The canvas sits above the page but below the controls, never catches a
   pointer event, and pauses itself the moment the last bubble leaves.
   assets/audio/bubbles.mp3 is trimmed to BURST_MS so it ends exactly as the
   bubbles fade, with a short gain ramp so the cut is never audible.
   The sound follows the click-sound switch and volume in the music panel,
   so muting effects silences this too.
   ========================================================================== */

(() => {
  "use strict";

  const SRC = "assets/audio/bubbles.mp3";
  const SFX_ON_KEY = "hobby-arcade:drip:on";
  const SFX_VOL_KEY = "hobby-arcade:drip:vol";
  // Matches the trimmed mp3 (3.213 s). Bubbles fade out over FADE_MS.
  const BURST_MS = 3200;
  const FADE_MS = 650;
  const COOLDOWN_MS = 4000;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const body = document.body;
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
    const fade = FADE_MS / 1000;

    if (actx && buffer) {
      try {
        if (actx.state === "suspended") actx.resume();
        const now = actx.currentTime + 0.01;
        const end = now + buffer.duration;
        const src = actx.createBufferSource();
        const node = actx.createGain();
        src.buffer = buffer;
        // Hold the level, then ramp to silence across the last FADE_MS so
        // the trimmed tail and the fading bubbles end together.
        node.gain.setValueAtTime(gain, now);
        node.gain.setValueAtTime(gain, Math.max(now, end - fade));
        node.gain.linearRampToValueAtTime(0.0001, end);
        src.connect(node).connect(actx.destination);
        src.start(now);
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
      fadeElement(fallback, FADE_MS / 1000);
    } catch {
      /* ignore */
    }
  }

  // The <audio> fallback has no gain envelope, so ramp its volume by hand.
  let fadeTimer = 0;
  function fadeElement(el, seconds) {
    clearTimeout(fadeTimer);
    const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : BURST_MS / 1000;
    const wait = Math.max(0, total - seconds) * 1000;
    fadeTimer = setTimeout(() => {
      const from = el.volume;
      const started = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - started) / (seconds * 1000));
        el.volume = from * (1 - p);
        if (p < 1) fadeTimer = setTimeout(step, 40);
        else el.pause();
      };
      step();
    }, wait);
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
        y: rand(H * 0.25, H + r * 2),
        r,
        // Slower than a real bubble plume so the screen stays full for the
        // whole 3.2 s rather than emptying through the top early.
        vy: rand(110, 235) + r * 12,
        sway: rand(4, 20),
        freq: rand(0.7, 2.1),
        phase: rand(0, Math.PI * 2),
        born: performance.now(),
        // Every bubble is released at the same moment and fades out
        // together, exactly when the trimmed sound ends.
        life: BURST_MS + rand(-40, 40),
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
      const fadeOut = Math.min(1, (p.life - age) / FADE_MS);
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
    if (now - lastBurst < COOLDOWN_MS) return;
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

  // Heavy cursor movement anywhere on a desktop: a genuine shake. Quick flicks
  // and normal navigating never fire it. The pointer has to stay very fast for
  // about half a second AND change direction several times, like wiggling the
  // mouse back and forth. Touch drags are ignored so scrolling never fires it.
  const FAST_PX_S = 2600; // px/s that counts as "violent"
  const ENERGY_NEEDED = 520; // ms of sustained violent movement
  const REVERSALS_NEEDED = 4; // direction flips within that time

  let px = 0;
  let py = 0;
  let pt = 0;
  let lvx = 0;
  let lvy = 0;
  let speed = 0;
  let energy = 0;
  let reversals = 0;

  function resetShake() {
    energy = 0;
    reversals = 0;
    speed = 0;
    lvx = lvy = 0;
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") {
        px = py = pt = 0;
        resetShake();
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
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      pt = now;

      if (dt > 90) {
        resetShake();
        return;
      }

      // px per second, smoothed so one jittery sample cannot fire it.
      const v = (Math.hypot(dx, dy) / dt) * 1000;
      speed = speed * 0.6 + v * 0.4;

      if (speed < FAST_PX_S) {
        // calm movement drains the built-up energy quickly
        energy = Math.max(0, energy - dt * 2.5);
        if (energy === 0) reversals = 0;
        return;
      }

      energy += dt;

      // a direction flip: this move points against the previous fast move
      if (lvx * dx + lvy * dy < 0) reversals += 1;
      lvx = dx;
      lvy = dy;

      if (energy >= ENERGY_NEEDED && reversals >= REVERSALS_NEEDED) {
        resetShake();
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
