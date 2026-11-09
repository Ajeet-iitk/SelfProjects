/* ==========================================================================
   Depth meter
   A slim gauge on the right edge. Scrolling the page "dives" from the surface
   to the bottom of the Mariana Trench (about 10,900 m), and the label names
   the ocean zone you are in.
   ========================================================================== */

(() => {
  "use strict";

  const MAX_DEPTH = 10900;

  const ZONES = [
    [0, "Sunlight zone"],
    [200, "Twilight zone"],
    [1000, "Midnight zone"],
    [4000, "Abyssal zone"],
    [6000, "Hadal zone"],
  ];

  const TICKS = [0, 200, 1000, 4000, 6000, 10900];

  const meter = document.createElement("aside");
  meter.className = "depth";
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", "Depth meter");
  meter.innerHTML = `
    <div class="depth__track">
      ${TICKS.map((m) => `<span class="depth__tick" style="--p:${depthToRatio(m)}"><i>${m.toLocaleString()}</i></span>`).join("")}
      <span class="depth__marker" id="depth-marker"></span>
    </div>
    <div class="depth__read">
      <strong id="depth-value">0 m</strong>
      <span id="depth-zone">Sunlight zone</span>
    </div>`;
  document.body.appendChild(meter);

  const marker = meter.querySelector("#depth-marker");
  const value = meter.querySelector("#depth-value");
  const zone = meter.querySelector("#depth-zone");

  // Shallow water gets more of the page so the early zones feel gradual.
  function ratioToDepth(p) {
    return MAX_DEPTH * Math.pow(p, 1.7);
  }

  function depthToRatio(m) {
    return Math.pow(m / MAX_DEPTH, 1 / 1.7).toFixed(4);
  }

  let queued = false;
  let lastText = "";

  function update() {
    queued = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.min(1, Math.max(0, window.scrollY / max));
    const depth = Math.round(ratioToDepth(p) / 5) * 5;

    marker.style.setProperty("--p", p.toFixed(4));

    const text = `${depth.toLocaleString()} m`;
    if (text !== lastText) {
      value.textContent = text;
      lastText = text;
    }

    let name = ZONES[0][1];
    for (const [from, label] of ZONES) if (depth >= from) name = label;
    if (zone.textContent !== name) zone.textContent = name;

    meter.style.setProperty("--dark", p.toFixed(3));
    meter.setAttribute("aria-label", `Depth ${text}, ${name}`);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  window.addEventListener("load", queue);
  // Cards arrive after GitHub loads and change the page height.
  if ("ResizeObserver" in window) new ResizeObserver(queue).observe(document.body);
  update();
})();
