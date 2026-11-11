/* ==========================================================================
   Marine Watch
   Fades out every piece of text, card and control (except the music player)
   so only the ocean background remains. Music keeps playing and the page
   still scrolls, because the faded content simply stops catching pointer
   events. Toggle with any [data-watch-toggle] button, the W key, or Esc to
   leave.
   ========================================================================== */

(() => {
  "use strict";

  const body = document.body;
  const toggles = document.querySelectorAll("[data-watch-toggle]");

  const exit = document.createElement("button");
  exit.type = "button";
  exit.className = "watch-exit";
  exit.textContent = "Exit Marine Watch";
  body.appendChild(exit);

  // ----- fishing HUD (tool picker, counters, messages) -------------------
  const hud = document.createElement("div");
  hud.className = "watch-hud";
  hud.innerHTML = `
    <div class="watch-hud__tools" role="group" aria-label="Marine Watch tools">
      <button type="button" data-tool="rod" class="is-active" aria-pressed="true"><span class="lbl-full">Fishing rod</span><span class="lbl-short">Rod</span></button>
      <button type="button" data-tool="food" aria-pressed="false"><span class="lbl-full">Fish food</span><span class="lbl-short">Food</span></button>
      <button type="button" data-tool="feed" aria-pressed="false"><span class="lbl-full">Feed catch</span><span class="lbl-short">Feed</span><b id="hud-caught">0</b></button>
    </div>
    <p class="watch-hud__msg" id="hud-msg" aria-live="polite">Click the water to cast your line.</p>`;
  body.appendChild(hud);

  const msgEl = hud.querySelector("#hud-msg");
  const caughtEl = hud.querySelector("#hud-caught");
  let msgTimer = 0;

  hud.querySelectorAll("[data-tool]").forEach((b) => {
    b.addEventListener("click", () => {
      hud.querySelectorAll("[data-tool]").forEach((o) => {
        const on = o === b;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-pressed", String(on));
      });
      document.dispatchEvent(new CustomEvent("marine:tool", { detail: b.dataset.tool }));
    });
  });

  document.addEventListener("marine:update", (e) => {
    const m = window.Marine || { caught: 0 };
    caughtEl.textContent = String(m.caught);
    const text = e.detail && e.detail.msg;
    if (text) {
      msgEl.textContent = text;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => {
        msgEl.textContent = "";
      }, 5000);
    }
  });

  // ----- documentary overlay (field notes, timecode, REC frame) ----------
  const film = document.createElement("div");
  film.className = "watch-film";
  film.setAttribute("aria-hidden", "true");
  film.innerHTML = `
    <i class="watch-film__corner watch-film__corner--tl"></i>
    <i class="watch-film__corner watch-film__corner--tr"></i>
    <i class="watch-film__corner watch-film__corner--bl"></i>
    <i class="watch-film__corner watch-film__corner--br"></i>
    <div class="watch-film__panel">
      <div class="watch-film__head">
        <span class="watch-film__rec"><i></i>REC</span>
        <span class="watch-film__sep">/</span>
        <span>Marine Watch · Field Notes</span>
        <span class="watch-film__sep">/</span>
        <span id="film-meta">00:00:00 · 0 m</span>
      </div>
      <p class="watch-film__caption" id="film-caption">The reef crew is setting up the camera.</p>
    </div>`;
  body.appendChild(film);

  const filmMeta = film.querySelector("#film-meta");
  const filmCaption = film.querySelector("#film-caption");
  let filmTimer = 0;
  let filmStart = 0;
  let filmLine = 0;
  let filmTick = 0;
  let filmTemplate = 0;
  let filmZone = "";

  const text = (sel, fallback) => {
    const el = document.querySelector(sel);
    return (el && el.textContent.trim()) || fallback;
  };

  function filmNotes() {
    const m = window.Marine || {};
    const depth = text("#depth-value", "0 m");
    const zone = text("#depth-zone", "Sunlight zone");
    const total = text("#stat-total", "42");
    const live = text("#stat-live", "29");
    const fish = Number(m.fish) || 0;
    const deepCount = Number(m.deep) || 0;
    const species = m.species || "reef fish";
    const fed = Number(m.fed) || 0;
    const crewFed = Boolean(m.crewFed);

    const lines = [
      `Depth ${depth} · ${zone}. The crew is filming a school of ${fish} fish.`,
      `Field note: marine snow drifts down from the sunlit zone, feeding everything below.`,
      `A ${species} drifts past the lens${deepCount ? ` with ${deepCount} deep visitor${deepCount === 1 ? "" : "s"} nearby` : ""}.`,
      crewFed
        ? `The diver has dropped food and the school is closing in. ${fed ? `${fed} fish delivered to the deep so far.` : "The camera keeps rolling."}`
        : `The diver drops a little food and waits for the school to gather.`,
      `Survey tally: ${fish} fish in frame, ${deepCount} deep-sea visitors, zero nets.`,
      `Field note: ${total} builds on the shelf, ${live} playable right now.`,
    ];

    const elapsed = Math.max(0, Math.floor((Date.now() - filmStart) / 1000));
    const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    filmMeta.textContent = `${hh}:${mm}:${ss} · ${depth}`;
    filmTick += 1;
    // Entering a new depth zone interrupts the rotation with the live depth
    // line, so the narration always matches how deep the dive currently is.
    if (zone !== filmZone) {
      filmZone = zone;
      filmTemplate = 0;
      filmLine = 1;
    } else if (filmTick === 1 || filmTick % 6 === 1) {
      filmTemplate = filmLine % lines.length;
      filmLine += 1;
    }
    // Rebuild the chosen line every second so the depth line stays live
    // between caption rotations.
    filmCaption.textContent = lines[filmTemplate];
  }

  function startFilm() {
    filmStart = Date.now();
    filmLine = 0;
    filmTick = 0;
    filmTemplate = 0;
    filmZone = "";
    filmNotes();
    clearInterval(filmTimer);
    filmTimer = setInterval(filmNotes, 1000);
  }

  function stopFilm() {
    clearInterval(filmTimer);
    filmTimer = 0;
  }

  function set(on) {
    body.classList.toggle("is-watching", on);
    toggles.forEach((b) => b.setAttribute("aria-pressed", String(on)));
    if (on) startFilm();
    else stopFilm();
    // Keep keyboard focus from sitting on something that just disappeared.
    if (on && document.activeElement && document.activeElement !== body && !exit.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  const isOn = () => body.classList.contains("is-watching");

  toggles.forEach((b) => b.addEventListener("click", () => set(!isOn())));
  exit.addEventListener("click", () => set(false));

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && isOn()) {
      set(false);
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key.toLowerCase() === "w") set(!isOn());
  });
})();
