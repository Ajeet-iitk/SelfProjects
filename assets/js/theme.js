/* ==========================================================================
   Theme — day / night
   Persists the choice, updates the toggle + browser chrome colour, and uses
   the View Transitions API for a circular water-ripple wipe out of the toggle
   button. Three expanding rings sell the "stone dropped in water" feel.
   ========================================================================== */

(() => {
  "use strict";

  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  const meta = document.getElementById("theme-color");
  const STORE = "hobby-arcade:theme";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const current = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");

  function syncUI(theme) {
    if (meta) meta.setAttribute("content", theme === "light" ? "#eaf7fa" : "#04121a");

    if (btn) {
      const light = theme === "light";
      btn.setAttribute("aria-pressed", String(light));
      btn.setAttribute("aria-label", light ? "Switch to night mode" : "Switch to day mode");
      btn.title = light ? "Switch to night mode" : "Switch to day mode";
    }
  }

  function commit(theme) {
    root.setAttribute("data-theme", theme);
    syncUI(theme);

    try {
      localStorage.setItem(STORE, theme);
    } catch {
      /* private mode */
    }

    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function apply(theme, animate) {
    if (!animate || reduce.matches) {
      commit(theme);
      return;
    }

    const rect = btn ? btn.getBoundingClientRect() : { left: innerWidth / 2, top: 0, width: 0, height: 0 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Water rings spread from the toggle after the snapshots are taken, so
    // they are not frozen into the old page.
    function ripple() {
      if (reduce.matches) return;
      const layer = document.createElement("div");
      layer.className = "theme-ripple";
      layer.setAttribute("aria-hidden", "true");
      layer.style.setProperty("--rx", `${cx}px`);
      layer.style.setProperty("--ry", `${cy}px`);
      layer.innerHTML = "<i></i><i></i><i></i>";
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 1800);
    }

    if (typeof document.startViewTransition !== "function") {
      commit(theme);
      ripple();
      return;
    }

    // The wipe grows from the middle of the toggle button.
    root.style.setProperty("--vt-x", `${(cx / innerWidth) * 100}%`);
    root.style.setProperty("--vt-y", `${(cy / innerHeight) * 100}%`);

    const cleanup = () => {
      root.style.removeProperty("--vt-x");
      root.style.removeProperty("--vt-y");
    };

    // The callback normally runs on the next frame. If the browser never
    // gets to it (hidden tab, no compositing), fall back to a plain switch.
    let committed = false;
    const once = () => {
      if (committed) return;
      committed = true;
      commit(theme);
    };

    let transition;
    try {
      transition = document.startViewTransition(once);
    } catch {
      cleanup();
      once();
      ripple();
      return;
    }

    const guard = setTimeout(() => {
      if (!committed) {
        once();
        cleanup();
      }
    }, 250);

    transition.ready
      .then(() => {
        clearTimeout(guard);
        ripple();
      })
      .catch(() => {});
    transition.finished.finally(() => {
      clearTimeout(guard);
      once();
      cleanup();
    });
  }

  btn?.addEventListener("click", () => {
    apply(current() === "light" ? "dark" : "light", true);
  });

  // Keep two open tabs in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORE && (e.newValue === "dark" || e.newValue === "light")) {
      apply(e.newValue, false);
    }
  });

  syncUI(current());
})();
