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
