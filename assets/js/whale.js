/* ==========================================================================
   Deep-sea whale sounds
   Two whale recordings play now and then as the page is scrolled down, and
   more often the deeper you get. They are independent of the main soundtrack
   (they play even if the music is paused or muted) and work in Marine Watch
   too. Their own on/off button and volume slider live in the music panel.
   ========================================================================== */

(() => {
  "use strict";

  const FILES = ["assets/audio/whale-song.mp3", "assets/audio/whale-call.mp3"];
  const START_AT = 0.3; // scroll progress where the first calls can be heard

  const toggle = document.getElementById("whale-toggle");
  const slider = document.getElementById("whale-volume");
  const KEY = "hobby-arcade:whale";

  const read = (k, d) => {
    try {
      const v = localStorage.getItem(`${KEY}:${k}`);
      return v === null ? d : v;
    } catch {
      return d;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(`${KEY}:${k}`, v);
    } catch {
      /* ignore */
    }
  };

  let enabled = read("on", "1") !== "0";
  let level = Math.min(1, Math.max(0, parseFloat(read("vol", "0.6")) || 0));

  const clips = FILES.map((src) => {
    const a = new Audio();
    a.src = src;
    a.preload = "none";
    a.volume = 0;
    return a;
  });

  let timer = 0;
  let last = -1;
  let playing = null;
  let fadeRaf = 0;

  const progress = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, window.scrollY / max));
  };

  const audible = () => enabled && level > 0;

  function targetVolume(p) {
    // the whale slider sets the level; it swells a little the deeper we are
    return Math.min(1, level * (0.7 + p * 0.5));
  }

  function fade(a, to, seconds, done) {
    cancelAnimationFrame(fadeRaf);
    const from = a.volume;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / (seconds * 1000));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else if (done) done();
    };
    fadeRaf = requestAnimationFrame(step);
  }

  function sing() {
    const p = progress();
    if (document.hidden || p < START_AT || !audible() || playing) return;

    // alternate between the two recordings
    last = (last + 1 + (Math.random() < 0.3 ? 1 : 0)) % clips.length;
    const a = clips[last];
    a.currentTime = 0;
    a.volume = 0;
    playing = a;

    a.play()
      .then(() => {
        fade(a, targetVolume(p), 2.5);
        const hold = Math.max(1000, (a.duration || 10) * 1000 - 3200);
        setTimeout(() => {
          fade(a, 0, 3, () => {
            a.pause();
            if (playing === a) playing = null;
          });
        }, hold);
      })
      .catch(() => {
        playing = null; // blocked until the visitor interacts; try again later
      });

    a.onended = () => {
      if (playing === a) playing = null;
    };
  }

  function schedule() {
    clearTimeout(timer);
    const p = progress();
    // 28-50 s near the top of the deep, 12-24 s at the very bottom
    const min = 28 - p * 16;
    const span = 22 - p * 10;
    timer = setTimeout(() => {
      sing();
      schedule();
    }, (min + Math.random() * span) * 1000);
  }

  // The first call arrives soon after crossing into the deep.
  let announced = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!announced && progress() >= START_AT) {
        announced = true;
        setTimeout(sing, 1800);
      }
    },
    { passive: true }
  );

  // Silence everything if the music is paused or the tab is hidden.
  const hush = () => {
    if (playing) {
      const a = playing;
      fade(a, 0, 0.6, () => {
        a.pause();
        if (playing === a) playing = null;
      });
    }
  };
  function paintControls() {
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.setAttribute("aria-label", enabled ? "Whale songs on" : "Whale songs off");
    }
    if (slider) {
      slider.value = String(Math.round(level * 100));
      slider.style.setProperty("--fill", `${Math.round(level * 100)}%`);
    }
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      enabled = !enabled;
      write("on", enabled ? "1" : "0");
      paintControls();
      if (!enabled) hush();
    });
  }

  if (slider) {
    slider.addEventListener("input", () => {
      level = Math.min(1, Math.max(0, Number(slider.value) / 100));
      write("vol", String(level));
      if (level > 0 && !enabled) {
        enabled = true;
        write("on", "1");
      }
      paintControls();
      if (playing) playing.volume = targetVolume(progress());
      if (level === 0) hush();
    });
  }

  paintControls();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hush();
  });

  schedule();
})();
