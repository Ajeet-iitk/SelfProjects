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
      <button type="button" data-tool="rod" class="is-active" aria-pressed="true">Fishing rod</button>
      <button type="button" data-tool="food" aria-pressed="false">Fish food</button>
      <button type="button" data-tool="feed" aria-pressed="false">Feed catch <b id="hud-caught">0</b></button>
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

  function set(on) {
    body.classList.toggle("is-watching", on);
    toggles.forEach((b) => b.setAttribute("aria-pressed", String(on)));
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
