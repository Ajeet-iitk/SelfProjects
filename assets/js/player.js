/* ==========================================================================
   Background music player
   Lives in the navbar as a compact pill and expands into a small panel only
   while it is being used. Volume, mute and on/off state persist between
   visits; OS media controls work through the Media Session API.
   Music starts by default. Browsers usually block sound until the visitor
   interacts, so a blocked autoplay quietly retries on the first click, tap
   or keypress anywhere outside the player.
   ========================================================================== */

(() => {
  "use strict";

  const audio = document.getElementById("bgm");
  const player = document.getElementById("player");
  if (!audio || !player) return;

  const toggle = document.getElementById("player-toggle");
  const openBtn = document.getElementById("player-open");
  const muteBtn = document.getElementById("player-mute");
  const vol = document.getElementById("player-volume");
  const seek = document.getElementById("player-seek");
  const KEY = "hobby-arcade:music";

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const read = (k, fallback) => {
    try {
      const v = localStorage.getItem(`${KEY}:${k}`);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const write = (k, v) => {
    try {
      localStorage.setItem(`${KEY}:${k}`, v);
    } catch {
      /* ignore */
    }
  };

  let seeking = false;
  let idleTimer = 0;
  let closeTimer = 0;
  let wantsMusic = false;
  let unlockArmed = false;

  // ----- initial state -------------------------------------------------
  const storedVol = parseFloat(read("volume", "0.35"));
  audio.volume = Number.isFinite(storedVol) ? clamp01(storedVol) : 0.35;
  audio.muted = read("muted", "0") === "1";

  const enabled = read("on", "1") !== "0"; // was music on last time?

  // ----- compact / expanded panel --------------------------------------
  const isOpen = () => player.dataset.open === "true";

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (player.matches(":hover") || player.contains(document.activeElement)) return;
      closePanel();
    }, 7000);
  }

  function openPanel() {
    clearTimeout(closeTimer);
    player.dataset.open = "true";
    openBtn.setAttribute("aria-expanded", "true");
    armIdle();
  }

  function closePanel() {
    clearTimeout(closeTimer);
    clearTimeout(idleTimer);
    player.dataset.open = "false";
    openBtn.setAttribute("aria-expanded", "false");
  }

  function scheduleClose(delay) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (player.contains(document.activeElement) || player.matches(":hover")) return;
      closePanel();
    }, delay);
  }

  openBtn.addEventListener("click", () => {
    if (isOpen()) closePanel();
    else openPanel();
  });

  if (window.matchMedia("(hover: hover)").matches) {
    player.addEventListener("pointerenter", openPanel);
  }
  player.addEventListener("pointerleave", () => scheduleClose(450));
  player.addEventListener("focusin", openPanel);
  player.addEventListener("focusout", (e) => {
    if (!player.contains(e.relatedTarget)) scheduleClose(350);
  });

  document.addEventListener("pointerdown", (e) => {
    if (!player.contains(e.target)) closePanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      closePanel();
      openBtn.focus();
    }
  });

  // ----- painting helpers ----------------------------------------------
  function fillRange(el, ratio) {
    el.style.setProperty("--fill", `${(clamp01(ratio) * 100).toFixed(2)}%`);
  }

  function paintVolume() {
    const level = clamp01(audio.volume);
    vol.value = String(Math.round(level * 100));
    fillRange(vol, level);

    player.classList.toggle("is-muted", audio.muted || level === 0);
    muteBtn.setAttribute("aria-label", audio.muted ? "Unmute background music" : "Mute background music");
    muteBtn.setAttribute("aria-pressed", String(audio.muted));
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function paintProgress() {
    const duration = audio.duration;
    const ratio = Number.isFinite(duration) && duration > 0 ? audio.currentTime / duration : 0;

    if (!seeking) {
      seek.value = String(Math.round(ratio * 1000));
      fillRange(seek, ratio);
    }
    seek.setAttribute("aria-valuetext", `${fmt(audio.currentTime)} of ${fmt(duration)}`);
    seek.title = `${fmt(audio.currentTime)} / ${fmt(duration)}`;
  }

  function sync() {
    const playing = !audio.paused && !audio.ended;
    player.dataset.state = playing ? "playing" : "paused";
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
    player.classList.remove("is-loading");
  }

  // ----- transport ------------------------------------------------------
  async function play() {
    if (audio.error) return;
    wantsMusic = true;
    player.classList.add("is-loading");
    toggle.title = "";

    try {
      await audio.play();
      write("on", "1");
      sync();
      armIdle();
    } catch (err) {
      player.classList.remove("is-loading");
      // A blocked autoplay attempt is not a user pause. Retry as soon as
      // there is a real gesture the browser will accept.
      if (err && err.name === "NotAllowedError") {
        armUnlock();
      } else if (err) {
        write("on", "0");
      }
      sync();
      toggle.title = "Press play to start the music";
    }
  }

  function pause() {
    wantsMusic = false;
    audio.pause();
    write("on", "0");
    sync();
  }

  // Browser autoplay policies require a gesture before audible playback.
  // Start on the first one anywhere outside the player controls.
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;

    const events = ["pointerdown", "keydown", "touchend"];
    const cleanup = () => {
      unlockArmed = false;
      for (const ev of events) document.removeEventListener(ev, onGesture, true);
    };

    function onGesture(e) {
      if (!wantsMusic || !audio.paused) {
        cleanup();
        return;
      }
      // The player's own buttons already know what to do.
      if (e.target instanceof Node && player.contains(e.target)) return;
      cleanup();
      play();
    }

    for (const ev of events) document.addEventListener(ev, onGesture, true);
  }

  toggle.addEventListener("click", () => {
    if (audio.paused) play();
    else pause();
    armIdle();
  });

  // ----- volume ---------------------------------------------------------
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    write("muted", audio.muted ? "1" : "0");
    paintVolume();
    armIdle();
  });

  vol.addEventListener("input", () => {
    const level = clamp01(Number(vol.value) / 100);
    audio.volume = level;
    if (level > 0 && audio.muted) {
      audio.muted = false;
      write("muted", "0");
    }
    write("volume", String(level));
    paintVolume();
    armIdle();
  });

  // ----- seek -----------------------------------------------------------
  seek.addEventListener("input", () => {
    seeking = true;
    fillRange(seek, Number(seek.value) / 1000);
  });

  function commitSeek() {
    if (!seeking) return;
    seeking = false;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    }
    paintProgress();
  }

  seek.addEventListener("change", commitSeek);
  seek.addEventListener("pointerup", commitSeek);

  // ----- audio events ---------------------------------------------------
  audio.addEventListener("play", sync);
  audio.addEventListener("pause", sync);
  audio.addEventListener("playing", () => {
    player.classList.remove("is-loading");
    sync();
  });
  audio.addEventListener("waiting", () => player.classList.add("is-loading"));
  audio.addEventListener("timeupdate", paintProgress);
  audio.addEventListener("durationchange", paintProgress);
  audio.addEventListener("ended", sync);
  audio.addEventListener("error", () => {
    player.hidden = true;
  });

  // ----- OS media controls ---------------------------------------------
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Tu Mil Jaaye King",
        artist: "Background soundtrack",
        album: "Ajeet — Hobby Arcade",
      });
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", pause);
      navigator.mediaSession.setActionHandler("seekto", (e) => {
        if (typeof e.seekTime === "number") audio.currentTime = e.seekTime;
      });
    } catch {
      /* unsupported */
    }
  }

  // ----- boot -----------------------------------------------------------
  paintVolume();
  paintProgress();
  sync();

  if (enabled) {
    wantsMusic = true;
    // Autoplay may be blocked; armUnlock() takes over from there.
    play();
  } else {
    wantsMusic = false;
  }
})();
