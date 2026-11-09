/* ==========================================================================
   Deep-sea whale sounds
   Two whale recordings play now and then as the page is scrolled down, and
   more often the deeper you get. They layer over the main soundtrack, work
   in Marine Watch too, and follow the music player: if the visitor has paused
   or muted the music, the whales stay quiet as well.
   ========================================================================== */

(() => {
  "use strict";

  const bgm = document.getElementById("bgm");
  const FILES = ["assets/audio/whale-song.mp3", "assets/audio/whale-call.mp3"];
  const START_AT = 0.3; // scroll progress where the first calls can be heard

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

  // Whales only sing when the main music is audibly on.
  const musicOn = () => !!bgm && !bgm.paused && !bgm.muted && bgm.volume > 0;

  function targetVolume(p) {
    const base = bgm ? bgm.volume : 0.35;
    // a little louder the deeper we are, never louder than the music + a bit
    return Math.min(1, base * (0.9 + p * 0.9));
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
    if (document.hidden || p < START_AT || !musicOn() || playing) return;

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
  if (bgm) {
    bgm.addEventListener("pause", hush);
    bgm.addEventListener("volumechange", () => {
      if (bgm.muted || bgm.volume === 0) hush();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hush();
  });

  schedule();
})();
