/* ==========================================================================
   Reef growth
   Lichen, barnacles and seagrass slowly colonise the interface: headlines,
   buttons, stats, cards, notes and the footer. The scuba crew scrapes a
   spot clean when it swims past, and it slowly grows back after a while.
   Growth is decorative (aria-hidden) and never catches pointer events.
   ========================================================================== */

(() => {
  "use strict";

  const MAX_SPOTS = 32;
  const REGROW_MIN = 65000;
  const REGROW_MAX = 110000;

  const spots = [];
  const hostKeys = new WeakMap();

  const SEAGRASS_SVG = `
    <svg viewBox="0 0 60 34" aria-hidden="true" focusable="false">
      <path class="blade blade--a" d="M9 34 C8 25 11 16 17 7" />
      <path class="blade blade--b" d="M19 34 C20 26 19 18 25 12" />
      <path class="blade blade--c" d="M29 34 C29 22 33 15 39 9" />
      <path class="blade blade--b" d="M40 34 C39 27 42 21 48 16" />
      <path class="blade blade--a" d="M50 34 C52 28 50 24 57 19" />
    </svg>`;

  // Each group lists the surface it grows on and the clusters to place.
  // `max` limits how many matches in a group get growth (keeps cards calm).
  const LAYOUTS = [
    {
      sel: ".hero__title",
      items: [
        { type: "film", key: "film" },
        { type: "seagrass", key: "grass", left: "0%", bottom: "-10px", w: 62, h: 36 },
        { type: "lichen", key: "lichen", right: "-14px", top: "16%", w: 48, h: 56, rot: -7 },
      ],
    },
    {
      sel: ".hero__lede",
      items: [
        { type: "lichen", key: "lichen", left: "-11px", bottom: "-7px", w: 42, h: 22, rot: 4 },
        { type: "barnacle", key: "barnacle", right: "6%", bottom: "-4px", w: 34, h: 12 },
      ],
    },
    {
      sel: ".hero__actions .btn--primary",
      items: [{ type: "seagrass", key: "grass", left: "8%", bottom: "-10px", w: 36, h: 23, flip: true }],
    },
    {
      sel: ".hero__actions .btn--ghost",
      items: [{ type: "barnacle", key: "barnacle", right: "14px", bottom: "0px", w: 38, h: 13 }],
    },
    {
      sel: ".eyebrow",
      items: [{ type: "lichen", key: "lichen", right: "-18px", top: "-8px", w: 30, h: 17, rot: 12 }],
    },
    {
      sel: ".stats",
      items: [
        { type: "seagrass", key: "grass", left: "1.5%", bottom: "-15px", w: 42, h: 27 },
        { type: "lichen", key: "lichen", right: "3%", bottom: "-6px", w: 34, h: 18, rot: -8 },
      ],
    },
    {
      sel: "#projects .section__title",
      items: [
        { type: "film", key: "film" },
        { type: "seagrass", key: "grass", left: "-7px", bottom: "-15px", w: 44, h: 28 },
      ],
    },
    {
      sel: "#explore .section__title",
      items: [{ type: "seagrass", key: "grass", left: "-7px", bottom: "-15px", w: 44, h: 28, flip: true }],
    },
    {
      sel: ".footer",
      items: [
        { type: "lichen", key: "lichen", right: "8%", top: "-9px", w: 48, h: 24, rot: 5 },
        { type: "barnacle", key: "barnacle", left: "4%", top: "-3px", w: 40, h: 12 },
      ],
    },
  ];

  function hostReady(host) {
    if (!host || !document.contains(host)) return false;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    return true;
  }

  function makeNode(cfg) {
    const node = document.createElement("span");
    node.className = `reef-growth reef-growth--${cfg.type}`;
    node.setAttribute("aria-hidden", "true");
    node.style.setProperty("--gdelay", `${(-Math.random() * 5).toFixed(2)}s`);
    if (cfg.rot) node.style.setProperty("--grot", `${cfg.rot}deg`);
    if (cfg.flip) node.style.setProperty("--gflip", "-1");

    if (cfg.type === "film") {
      node.classList.add("reef-growth--inset");
    } else {
      if (cfg.w) node.style.width = `${cfg.w}px`;
      if (cfg.h) node.style.height = `${cfg.h}px`;
      if (cfg.left != null) node.style.left = cfg.left;
      if (cfg.right != null) node.style.right = cfg.right;
      if (cfg.top != null) node.style.top = cfg.top;
      if (cfg.bottom != null) node.style.bottom = cfg.bottom;
    }

    if (cfg.type === "seagrass") node.innerHTML = SEAGRASS_SVG;
    return node;
  }

  function liveCount() {
    let n = 0;
    for (const s of spots) if (!s.cleaned && s.node.isConnected) n += 1;
    return n;
  }

  function spawn(host, cfg, key) {
    if (!hostReady(host)) return null;

    let keys = hostKeys.get(host);
    if (!keys) {
      keys = new Set();
      hostKeys.set(host, keys);
    }
    if (keys.has(key)) return null;
    if (liveCount() >= MAX_SPOTS) return null;

    keys.add(key);
    const node = makeNode(cfg);
    host.appendChild(node);

    const spot = { cfg, key, host, node, cleaned: false };
    spots.push(spot);
    return spot;
  }

  function scheduleRegrow(spot) {
    const wait = REGROW_MIN + Math.random() * (REGROW_MAX - REGROW_MIN);
    setTimeout(() => {
      const keys = hostKeys.get(spot.host);
      if (keys) keys.delete(spot.key);

      const i = spots.indexOf(spot);
      if (i >= 0) spots.splice(i, 1);

      if (!spot.host.isConnected) return;
      // Another cluster may already have regrown on the same host while this
      // timer was waiting (for example after a resize or a re-render).
      if (liveCount() >= MAX_SPOTS) return;
      spawn(spot.host, spot.cfg, spot.key);
    }, wait);
  }

  function clean(spot) {
    if (!spot || spot.cleaned || !spot.node.isConnected) return false;
    spot.cleaned = true;

    const r = spot.node.getBoundingClientRect();
    spot.node.classList.add("is-cleaned");

    document.dispatchEvent(
      new CustomEvent("growth:clean", {
        detail: {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          type: spot.cfg.type,
        },
      })
    );

    const node = spot.node;
    setTimeout(() => node.remove(), 620);
    scheduleRegrow(spot);
    return true;
  }

  function scan(selector, limit, makeCfg) {
    document.querySelectorAll(selector).forEach((host, i) => {
      if (i >= limit) return;
      const cfg = makeCfg(i, host);
      if (cfg) spawn(host, cfg, `surface-${i}-${cfg.key}`);
    });
  }

  function refresh() {
    // Drop spots whose host was re-rendered away.
    for (let i = spots.length - 1; i >= 0; i -= 1) {
      if (!spots[i].host.isConnected) spots.splice(i, 1);
    }

    for (const group of LAYOUTS) {
      document.querySelectorAll(group.sel).forEach((host, i) => {
        if (group.max != null && i >= group.max) return;
        for (const item of group.items) {
          const key = `${group.sel}:${i}:${item.key}`;
          spawn(host, item, key);
        }
      });
    }

    // A little growth on the shelf and the field notes. Alternating types
    // keeps the texture varied without covering the actual content.
    scan("#grid .card", 8, (i, host) =>
      i % 2 === 0
        ? { type: "seagrass", key: "card-grass", left: "10px", bottom: "5px", w: 30, h: 20 }
        : { type: "lichen", key: "card-lichen", right: "9px", top: "54%", w: 30, h: 19, rot: i % 3 ? 6 : -7 }
    );

    scan("#explore .note", 6, (i, host) =>
      i % 2 === 0
        ? { type: "barnacle", key: "note-barnacle", left: "12px", bottom: "6px", w: 34, h: 12 }
        : { type: "seagrass", key: "note-grass", right: "14px", bottom: "2px", w: 28, h: 19, flip: i % 3 === 1 }
    );
  }

  window.Growth = {
    list() {
      return spots.filter((s) => !s.cleaned && s.node.isConnected && document.contains(s.host));
    },
    clean,
    refresh,
    count: liveCount,
  };

  refresh();
  setTimeout(refresh, 1400);

  const grid = document.getElementById("grid");
  if (grid && typeof MutationObserver === "function") {
    let queued = 0;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = setTimeout(() => {
        queued = 0;
        refresh();
      }, 140);
    });
    observer.observe(grid, { childList: true });
  }
})();
