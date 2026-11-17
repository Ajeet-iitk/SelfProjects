/* ==========================================================================
   Things to explore: the dive chart
   Instead of a wall of text, every trick is a glowing bubble grouped by the
   ocean zone it belongs to. Hover a bubble to read a short note in the pinned
   panel; click or tap it to read the note and launch the trick (the panel's
   "Try it" button does the same).

   TO ADD A FEATURE: add one object to ITEMS below (zone, icon, title, key,
   text, optional action). Nothing else needs touching.
   ========================================================================== */

(() => {
  "use strict";

  const host = document.getElementById("dive");
  if (!host) return;

  const ZONES = [
    { id: "surface", depth: "0 m", name: "Sunlight zone", color: "#58f5c8" },
    { id: "reef", depth: "200 m", name: "Reef", color: "#4cc9f0" },
    { id: "midnight", depth: "1,000 m", name: "Midnight zone", color: "#9d8bff" },
    { id: "abyss", depth: "4,000 m", name: "Abyss", color: "#ff6b9d" },
  ];

  const ICONS = {
    daynight: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/><path d="M17 3v3M15.5 4.5h3"/>',
    drift: '<path d="M2 9c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3-1 4 0"/>',
    depth: '<path d="M12 3v18M8 7h4M8 11h6M8 15h4M8 19h6"/>',
    more: '<path d="m6 8 6 5 6-5M6 14l6 5 6-5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    sonar: '<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15"/>',
    fish: '<path d="M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2Z"/><circle cx="8.5" cy="11" r=".6"/>',
    food: '<circle cx="7" cy="7" r="1.6"/><circle cx="14" cy="9" r="1.6"/><circle cx="10" cy="15" r="1.6"/><circle cx="17" cy="17" r="1.6"/>',
    crew: '<circle cx="12" cy="8" r="4"/><path d="M8.5 7.5h7M9 14c-3 1-4 4-4 7M15 14c3 1 4 4 4 7M10 14l2 7 2-7"/>',
    grow: '<path d="M12 21V9M12 15c-4 0-6-3-6-7 4 0 6 3 6 7ZM12 12c3 0 5-2 5-5-3 0-5 2-5 5Z"/>',
    drip: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    frame: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.5"/>',
    hook: '<path d="M12 3v10a4.5 4.5 0 1 0 4.5-4.5"/><path d="m14 6.5 2.5 2-2.5 2"/>',
    sub: '<ellipse cx="11" cy="14" rx="8" ry="4.5"/><path d="M8 9.5h6V6h3M19 14h2M3.5 14H2"/><circle cx="14" cy="14" r="1"/>',
    night: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/><path d="M16 4v2M15 5h2M19 9v2M18 10h2"/>',
    whale: '<path d="M2 13c0-3.3 3.2-6 7.5-6 2.6 0 4.7 1 6 2.5L20 6l-.8 5.2c1 .7 1.8 1.7 1.8 2.8 0 2.8-3.6 5-8.5 5C7 19 2 17.2 2 13Z"/><circle cx="7.5" cy="12.8" r=".7"/>',
    shark: '<path d="M3 17c4-1 7-5 9-12 1 5 4 9 9 11-5 2-12 3-18 1Z"/>',
    sound: '<path d="M4 12h0M8 8v8M12 5v14M16 8v8M20 11v2"/>',
    bubbles: '<circle cx="8" cy="15" r="4"/><circle cx="17" cy="9" r="3"/><circle cx="14" cy="19" r="1.8"/><circle cx="6" cy="6" r="1.5"/>',
    dive: '<path d="M12 3v14m0 0 5-5m-5 5-5-5M5 21h14"/>',
    squid: '<path d="M12 2c-4 0-6 3-6 7 0 2 1 3 2 4M12 2c4 0 6 3 6 7 0 2-1 3-2 4M12 13v8M9 14l-1 7M15 14l1 7M7 12l-3 6M17 12l3 6"/><circle cx="10" cy="8" r=".8"/><circle cx="14" cy="8" r=".8"/>',
  };

  // action: what the "Try it" button does (omit when there is nothing to launch)
  const ITEMS = [
    // ---- sunlight zone -------------------------------------------------
    { zone: "surface", icon: "daynight", title: "Day & night", key: "Toggle", text: "Flip the sun/moon switch. The new light ripples out from it.", action: "theme" },
    { zone: "surface", icon: "drift", title: "Drifting UI", key: "Hover", text: "Everything bobs on the current and leans away from your cursor." },
    { zone: "surface", icon: "depth", title: "Depth meter", key: "Scroll", text: "The gauge on the right counts your dive down to the Mariana Trench.", action: "dive" },
    { zone: "surface", icon: "sonar", title: "Sonar search", key: "/", text: "Start typing. A sonar ping lights the matches and fades the rest.", action: "sonar" },
    { zone: "surface", icon: "image", title: "Screenshots", key: "Click", text: "Open any card's picture large, then flip through with the arrow keys.", action: "shelf" },
    { zone: "surface", icon: "grid", title: "Grid or list", key: "Filter", text: "Switch the layout, sort the shelf, or filter by tag.", action: "shelf" },
    { zone: "surface", icon: "more", title: "Show more", key: "Click", text: "Float the rest of the shelf into view, or tuck it back away.", action: "shelf" },

    // ---- reef ----------------------------------------------------------
    { zone: "reef", icon: "food", title: "Feed the fish", key: "Click", text: "Click empty water. Food sinks and nearby fish swim over to eat it." },
    { zone: "reef", icon: "fish", title: "Spooked fish", key: "Hover", text: "Sweep your cursor through the water and the school scatters." },
    { zone: "reef", icon: "crew", title: "Scuba crew", key: "Watch", text: "Divers patch cards and scrape reef growth off the page." },
    { zone: "reef", icon: "grow", title: "Growing reef", key: "Wait", text: "Lichen, barnacles and seagrass slowly creep over the page until the cleaners scrape them off." },
    { zone: "reef", icon: "drip", title: "Water drips", key: "Click", text: "Every click or tap plays a drip. Switch it off in the music panel." },
    { zone: "reef", icon: "music", title: "Music", key: "Player", text: "Seek, mute, and set separate volumes for music, whales and drips.", action: "music" },

    // ---- midnight zone -------------------------------------------------
    { zone: "midnight", icon: "eye", title: "Marine Watch", key: "W", text: "The page fades away. Just the ocean, with the music still playing.", action: "watch" },
    { zone: "midnight", icon: "frame", title: "Camera frame", key: "Watch", text: "A cinema frame: a diver drops food for the school as you descend.", action: "watch" },
    { zone: "midnight", icon: "hook", title: "Go fishing", key: "Rod", text: "In Marine Watch, cast a line and reel in whatever bites.", action: "watch" },
    { zone: "midnight", icon: "sub", title: "Submarine", key: "S", text: "Lights out. A little sub lights the way with its flashlight.", action: "sub" },
    { zone: "midnight", icon: "night", title: "Night dive", key: "Scroll", text: "In Marine Watch, the deeper you scroll the darker the water gets.", action: "watch" },

    // ---- abyss ---------------------------------------------------------
    { zone: "abyss", icon: "whale", title: "Meet the deep", key: "Scroll", text: "Glowing turtles, sharks, a whale, a manta and an anglerfish drift by.", action: "dive" },
    { zone: "abyss", icon: "shark", title: "Feed the deep", key: "Feed", text: "Catch a fish, drop it deep, and the giants swim over to eat it.", action: "watch" },
    { zone: "abyss", icon: "sound", title: "Whale songs", key: "Listen", text: "Whale calls drift over the music, more often the deeper you go.", action: "dive" },
    { zone: "abyss", icon: "squid", title: "Giant squid", key: "Click", text: "Now and then a tentacle swipes a bubble away. Click its glowing eye if you dare." },
    { zone: "abyss", icon: "bubbles", title: "Bubble storm", key: "Shake", text: "Shake your phone and the whole screen fills with rising bubbles." },
  ];

  const svg = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ----- actions: launch the real feature ------------------------------ */
  const click = (sel) => {
    const el = document.querySelector(sel);
    if (el) el.click();
  };

  const toShelf = () => {
    const el = document.getElementById("projects");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ACTIONS = {
    theme: () => click("#theme-toggle"),
    music: () => click("#player-open"),
    watch: () => click("[data-watch-toggle]"),
    sub: () => click("#sub-toggle"),
    shelf: toShelf,
    dive: () =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
    sonar: () => {
      toShelf();
      setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
      }, 600);
    },
  };

  const LABEL = {
    theme: "Try it",
    music: "Open player",
    watch: "Enter Marine Watch",
    sub: "Dive in the sub",
    shelf: "Go to the shelf",
    dive: "Dive to the bottom",
    sonar: "Try the sonar",
  };

  /* ----- build ---------------------------------------------------------- */
  host.innerHTML = `
    <div class="dive__panel" id="dive-panel" aria-live="polite">
      <span class="dive__picon" id="dive-picon"></span>
      <div class="dive__ptext">
        <div class="dive__pline"><strong id="dive-ptitle"></strong><kbd id="dive-pkey"></kbd></div>
        <p id="dive-pdesc"></p>
      </div>
      <button type="button" class="dive__go" id="dive-go" hidden></button>
    </div>
    ${ZONES.map(
      (z) => `
    <section class="dive__zone" data-zone="${z.id}" style="--z:${z.color}" aria-label="${esc(z.name)}">
      <header class="dive__head"><span class="dive__depth">${z.depth}</span><span class="dive__zname">${esc(z.name)}</span></header>
      <div class="dive__orbs"></div>
      <span class="dive__bubble" style="--x:12%;--s:6px;--t:11s;--d:0s"></span>
      <span class="dive__bubble" style="--x:38%;--s:9px;--t:14s;--d:3s"></span>
      <span class="dive__bubble" style="--x:64%;--s:5px;--t:10s;--d:6s"></span>
      <span class="dive__bubble" style="--x:86%;--s:8px;--t:13s;--d:1.5s"></span>
    </section>`
    ).join("")}`;

  const orbs = [];
  ITEMS.forEach((item, i) => {
    const zoneEl = host.querySelector(`[data-zone="${item.zone}"] .dive__orbs`);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "orb";
    b.style.setProperty("--d", `${(i * 0.37) % 3}s`);
    b.style.setProperty("--i", String(i % 8));
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-controls", "dive-panel");
    b.innerHTML = `<span class="orb__bubble">${svg(item.icon)}</span><span class="orb__label">${esc(item.title)}</span>`;
    // Hover only previews. A click shows the note AND launches the trick.
    b.addEventListener("click", () => {
      select(i);
      const act = ITEMS[i].action;
      if (act && ACTIONS[act]) ACTIONS[act]();
    });
    if (window.matchMedia("(hover: hover)").matches) b.addEventListener("pointerenter", () => select(i, false));
    zoneEl.appendChild(b);
    orbs.push(b);
  });

  const panel = host.querySelector("#dive-panel");
  const pIcon = host.querySelector("#dive-picon");
  const pTitle = host.querySelector("#dive-ptitle");
  const pKey = host.querySelector("#dive-pkey");
  const pDesc = host.querySelector("#dive-pdesc");
  const go = host.querySelector("#dive-go");
  let current = -1;

  function select(i) {
    if (i === current) return;
    current = i;
    const item = ITEMS[i];
    const zone = ZONES.find((z) => z.id === item.zone);

    orbs.forEach((o, n) => {
      const on = n === i;
      o.classList.toggle("is-on", on);
      o.setAttribute("aria-pressed", String(on));
    });

    panel.style.setProperty("--z", zone.color);
    pIcon.innerHTML = svg(item.icon);
    pTitle.textContent = item.title;
    pKey.textContent = item.key;
    pDesc.textContent = item.text;

    if (item.action && ACTIONS[item.action]) {
      go.hidden = false;
      go.textContent = LABEL[item.action] || "Try it";
      go.onclick = ACTIONS[item.action];
    } else {
      go.hidden = true;
      go.onclick = null;
    }

    panel.classList.remove("is-swap");
    void panel.offsetWidth;
    panel.classList.add("is-swap");
  }

  // show a one-off message in the panel without changing the selection
  function flashPanel(title, key, text, icon) {
    current = -1;
    orbs.forEach((o) => {
      o.classList.remove("is-on");
      o.setAttribute("aria-pressed", "false");
    });
    panel.style.setProperty("--z", "#ff6b9d");
    pIcon.innerHTML = svg(icon);
    pTitle.textContent = title;
    pKey.textContent = key;
    pDesc.textContent = text;
    go.hidden = true;
    panel.classList.remove("is-swap");
    void panel.offsetWidth;
    panel.classList.add("is-swap");
  }

  select(0);


  /* ----- the giant squid ------------------------------------------------
     Now and then, while the Abyss band is on screen, a squid slides in from
     the right edge, a tentacle sweeps across and swipes one bubble away (it
     floats back after a few seconds). Click its glowing eye while it is out
     and it lets off an ink cloud that fades the page out and back. */
  const abyss = host.querySelector('[data-zone="abyss"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (abyss && !reduceMotion.matches) {
    const NS = "http://www.w3.org/2000/svg";
    const layer = document.createElement("div");
    layer.className = "squid";
    layer.innerHTML = `
      <div class="squid__body"></div>
      <button type="button" class="squid__eye" tabindex="-1" aria-label="Giant squid eye. Click to be inked."></button>
      <svg class="squid__arm" aria-hidden="true"></svg>`;
    abyss.appendChild(layer);

    const eye = layer.querySelector(".squid__eye");
    const arm = layer.querySelector(".squid__arm");
    const abyssOrbs = [...abyss.querySelectorAll(".orb")];

    let inView = false;
    let busy = false;
    let timer = 0;
    let armPath = null;
    let dotPath = null;

    new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        if (inView && !busy) schedule(4500);
      },
      { threshold: 0.35 }
    ).observe(abyss);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer);
      else if (inView && !busy) schedule(3000);
    });

    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          if (inView && !document.hidden && !busy) attack();
          else if (inView) schedule(6000);
        },
        ms == null ? 16000 + Math.random() * 12000 : ms
      );
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function attack() {
      const free = abyssOrbs.filter((o) => !o.classList.contains("is-swiped") && !o.classList.contains("is-back"));
      if (!free.length) return schedule();

      busy = true;
      const target = free[Math.floor(Math.random() * free.length)];
      const zr = abyss.getBoundingClientRect();
      const tr = target.querySelector(".orb__bubble").getBoundingClientRect();
      const tx = tr.left + tr.width / 2 - zr.left;
      const ty = tr.top + tr.height / 2 - zr.top;

      const sx = zr.width + 30;
      const sy = Math.min(zr.height - 40, Math.max(40, ty + (Math.random() * 120 - 60)));
      const ex = tx - 80;
      const ey = ty + (Math.random() * 40 - 20);
      const dx = sx - ex;

      arm.setAttribute("viewBox", `0 0 ${zr.width} ${zr.height}`);
      arm.innerHTML = "";
      armPath = document.createElementNS(NS, "path");
      dotPath = document.createElementNS(NS, "path");
      const d = `M ${sx} ${sy} C ${sx - dx * 0.3} ${sy - 90}, ${ex + dx * 0.4} ${ey + 90}, ${ex} ${ey}`;
      armPath.setAttribute("d", d);
      dotPath.setAttribute("d", d);
      armPath.setAttribute("class", "squid__skin");
      dotPath.setAttribute("class", "squid__suckers");
      arm.append(armPath, dotPath);

      const len = armPath.getTotalLength();
      for (const p of [armPath, dotPath]) p.style.strokeDasharray = p === dotPath ? "1 11" : `${len}`;
      armPath.style.strokeDashoffset = String(len);
      dotPath.style.opacity = "0";

      eye.style.top = `${sy}px`;
      layer.classList.add("is-out");
      await wait(520);

      // reach across
      armPath.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 950, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
      dotPath.style.opacity = "1";
      dotPath.animate([{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 950, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
      await wait(760);

      // the swipe
      target.classList.remove("is-on");
      target.classList.add("is-swiped");
      await wait(500);

      // pull back
      armPath.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -len }], { duration: 800, easing: "ease-in", fill: "forwards" });
      dotPath.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], { duration: 800, easing: "ease-in", fill: "forwards" });
      await wait(700);

      layer.classList.remove("is-out");
      busy = false;
      schedule();

      // the bubble floats back after a few seconds
      await wait(3500);
      target.classList.remove("is-swiped");
      target.classList.add("is-back");
      setTimeout(() => target.classList.remove("is-back"), 800);
    }

    /* ----- ink ---------------------------------------------------------- */
    let inking = false;

    function ink() {
      if (inking) return;
      inking = true;
      layer.classList.remove("is-out");

      const cloud = document.createElement("div");
      cloud.className = "ink";
      cloud.setAttribute("aria-hidden", "true");
      cloud.innerHTML = Array.from({ length: 7 }, (_, i) =>
        `<span style="--x:${(i * 17 + 8) % 100}%;--y:${(i * 29 + 12) % 100}%;--s:${48 + (i * 13) % 34}vmax;--d:${(i % 4) * 0.08}s"></span>`
      ).join("");
      document.body.appendChild(cloud);
      requestAnimationFrame(() => cloud.classList.add("is-on"));

      flashPanel("Giant squid", "Ink!", "You startled it. It vanishes into the dark.", "squid");

      setTimeout(() => {
        cloud.remove();
        inking = false;
      }, 3000);
    }

    eye.addEventListener("click", ink);
  }

  /* ----- rise in as the zone scrolls into view ------------------------ */
  const zones = host.querySelectorAll(".dive__zone");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    zones.forEach((z) => io.observe(z));
  } else {
    zones.forEach((z) => z.classList.add("is-in"));
  }
})();
