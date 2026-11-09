/* ==========================================================================
   Ajeet — Hobby Arcade
   Renders the shelf from projects.js, then discovers every other relevant
   public repository on the owner's GitHub account and adds it automatically.
   A single list request supplies description, language, stars, topics,
   homepage and Pages state, so no per-repository API calls are needed.

   Screenshots use a fallback chain:

     1. explicit `thumb:` in projects.js
     2. thumbnails/<slug>.{webp,png,jpg,jpeg,gif}
     3. thumbnails/<repo-name>.{...}
     4. GitHub's own social preview image for the repo
     5. generated gradient placeholder with initials

   No dependencies. Works from file:// and from GitHub Pages.
   ========================================================================== */

(() => {
  "use strict";

  const CFG = window.PORTFOLIO || {};
  const OWNER = CFG.owner || "Ajeet-iitk";
  const THUMB_DIR = (CFG.thumbDir || "thumbnails").replace(/\/+$/, "");
  const CACHE_HOURS = Number(CFG.cacheHours) || 12;
  const CACHE_PREFIX = "hobby-arcade:repo:v1:";
  const MAX_DISCOVERED = Number(CFG.maxAutoProjects) || 300;
  const REPOS_PER_PAGE = 100;
  const MAX_REPO_PAGES = 5; // up to 500 public repositories

  /* Repositories the visitor (or the owner) does not want auto-added. */
  const EXCLUDE = new Set(
    (CFG.exclude || []).map((name) => String(name).replace(/^.*\//, "").toLowerCase())
  );

  /* Set when GitHub says 403/429 so the queue stops instead of hammering it. */
  let apiBlocked = false;

  const PRODUCTS = Array.isArray(CFG.projects) ? CFG.projects : [];

  const TYPE_META = {
    game: { label: "Game", plural: "Games" },
    web: { label: "Web", plural: "Web" },
    app: { label: "App", plural: "Apps" },
    experiment: { label: "Experiment", plural: "Experiments" },
    project: { label: "Project", plural: "Projects" },
  };

  const ACCENTS = ["#58f5c8", "#8b7cff", "#ff6b9d", "#ffc857", "#4cc9f0", "#b6f36b"];

  const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    HTML: "#e34c26",
    CSS: "#663399",
    Kotlin: "#a97bff",
    Java: "#b07219",
    Python: "#3572a5",
    "C++": "#f34b7d",
    C: "#555555",
    "Jupyter Notebook": "#da5b0b",
    GLSL: "#5686a5",
    Shell: "#89e051",
    Ruby: "#701516",
    Go: "#00add8",
    Rust: "#dea584",
    Swift: "#f05138",
    Dart: "#00b4ab",
    Vue: "#41b883",
  };

  const ICON = {
    arrow: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 17 17 7M9 7h8v8"/></svg>',
    star: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3Z"/></svg>',
    code: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>',
    play: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>',
    expand:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6"/></svg>',
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  const dom = {
    grid: $("#grid"),
    chips: $("#chips"),
    search: $("#search"),
    sort: $("#sort"),
    resultline: $("#resultline"),
    empty: $("#empty"),
    clear: $("#clear-filters"),
    heroCount: $("#hero-count"),
    statTotal: $("#stat-total"),
    statLive: $("#stat-live"),
    statSince: $("#stat-since"),
    topbar: $("#topbar"),
    year: $("#year"),
    lightbox: $("#lightbox"),
    lbImg: $("#lightbox-img"),
    lbTitle: $("#lightbox-title"),
    lbLink: $("#lightbox-link"),
    lbClose: $(".lightbox__close"),
    lbPrev: $("[data-prev]"),
    lbNext: $("[data-next]"),
  };

  const state = {
    projects: [],
    q: "",
    filter: "all",
    sort: "featured",
    view: "grid",
  };

  const lightbox = {
    items: [],
    index: 0,
    lastFocus: null,
    open: false,
  };

  /* ------------------------------------------------------------------ */
  /* helpers                                                            */
  /* ------------------------------------------------------------------ */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const slugify = (s) =>
    String(s)
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const stripExt = (s) => String(s).replace(/\.git$/i, "").replace(/\/+$/, "");

  /** Parse "owner/repo", a full github.com URL, or a git remote. */
  function parseRepo(input, fallbackOwner) {
    const raw = stripExt(String(input || "").trim());
    let owner = "";
    let repo = "";

    const urlMatch = raw.match(/(?:github\.com[/:])([^/]+)\/([^/]+)/i);
    if (urlMatch) {
      owner = urlMatch[1];
      repo = urlMatch[2];
    } else if (/^[^/\s]+\/[^/\s]+$/.test(raw)) {
      owner = raw.split("/")[0];
      repo = raw.split("/")[1];
    } else {
      owner = fallbackOwner;
      repo = raw;
    }

    return { owner, repo: stripExt(repo) };
  }

  function prettyName(repo) {
    return String(repo)
      .replace(/[-_.]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, " ")
      .trim();
  }

  function initials(title) {
    const words = String(title).replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) return "AK";
    return (words[0][0] + (words[1] ? words[1][0] : words[0][1] || "")).toUpperCase();
  }

  function relativeTime(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const diff = Date.now() - then;
    const mins = Math.round(diff / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days}d ago`;
    const months = Math.round(days / 30.4);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.t || Date.now() - parsed.t > CACHE_HOURS * 3600e3) return null;
      return parsed.d;
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
    } catch {
      /* storage full or blocked — not important */
    }
  }

  /* ------------------------------------------------------------------ */
  /* normalise the project list                                          */
  /* ------------------------------------------------------------------ */

  function normalise(item, index) {
    const source = typeof item === "string" ? { repo: item } : { ...item };
    const { owner, repo } = parseRepo(source.repo, OWNER);
    const type = String(source.type || "project").toLowerCase();

    return {
      owner,
      repo,
      slug: source.slug || slugify(repo),
      title: source.title || prettyName(repo),
      blurb: source.blurb || "",
      tags: (source.tags || []).map(String),
      type,
      featured: Boolean(source.featured),
      year: source.year || "",
      thumb: source.thumb || "",
      skipOg: Boolean(source.skipOg),
      demoUrl: source.demo || "",
      repoUrl: `https://github.com/${owner}/${repo}`,
      language: "",
      stars: 0,
      pushedAt: "",
      order: index,
      shot: "",
      card: null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* automatic repository discovery                                      */
  /* ------------------------------------------------------------------ */

  /** Public, non-fork, non-empty repositories worth showing on the shelf. */
  function repoIsRelevant(d) {
    if (!d || !d.name) return false;
    const name = String(d.name).toLowerCase();

    return (
      !d.fork &&
      !d.archived &&
      !d.private &&
      Number(d.size) > 0 &&
      name !== OWNER.toLowerCase() &&
      name !== "selfprojects" &&
      name !== ".github" &&
      !EXCLUDE.has(name)
    );
  }

  function inferType(d) {
    const words = `${d.name || ""} ${d.description || ""} ${(d.topics || []).join(" ")}`.toLowerCase();

    if (/\b(game|games|gaming|arcade|racer|racing|runner|puzzle|threejs|three\.js|webgl|unity|godot|simulator)\b/.test(words)) {
      return "game";
    }
    if (/\b(android|kotlin|ios|swift|flutter|apk|alarm)\b/.test(words)) {
      return "app";
    }
    if (/\b(experiment|demo|prototype|playground|toy|art|visuali[sz]er)\b/.test(words)) {
      return "experiment";
    }
    if (d.has_pages || /\b(web|site|website|portfolio|blog)\b/.test(words)) {
      return "web";
    }
    return "experiment";
  }

  function listDemo(d) {
    const home = String(d.homepage || "").trim();
    if (home) return /^https?:\/\//i.test(home) ? home : `https://${home}`;

    if (d.has_pages && !/\.github\.io$/i.test(String(d.name || ""))) {
      return `https://${OWNER.toLowerCase()}.github.io/${d.name}/`;
    }
    return "";
  }

  function listTags(d) {
    const topics = (d.topics || []).map(String).filter(Boolean).slice(0, 4);
    if (topics.length) return topics;
    return d.language ? [String(d.language)] : [];
  }

  function discoveredTitle(name) {
    return prettyName(name)
      .replace(/(\d)\s+(\d+)$/, "$1.$2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2");
  }

  function discoveredItem(d) {
    const base = discoveredTitle(d.name);
    const title = /^[a-z]{2,4}$/.test(String(d.name)) ? String(d.name).toUpperCase() : base;

    return {
      repo: `${OWNER}/${d.name}`,
      title,
      blurb:
        String(d.description || "").trim() ||
        `A public ${d.language || "code"} project — source and history on GitHub.`,
      tags: listTags(d),
      type: inferType(d),
      demo: listDemo(d),
    };
  }

  /* ------------------------------------------------------------------ */
  /* card construction                                                    */
  /* ------------------------------------------------------------------ */

  function buildCard(p, index) {
    const el = document.createElement("article");
    el.className = "card";
    el.dataset.slug = p.slug;
    el.dataset.type = p.type;
    el.style.setProperty("--i", String(Math.min(index, 9)));
    el.style.setProperty("--accent", ACCENTS[index % ACCENTS.length]);

    const typeLabel = (TYPE_META[p.type] || TYPE_META.project).label;
    const isLive = Boolean(p.demoUrl);
    const tagHtml = p.tags
      .slice(0, 4)
      .map((t) => `<li>${esc(t)}</li>`)
      .join("");

    el.innerHTML = `
      <div class="card__media">
        <button class="card__shot" type="button" aria-label="View a larger screenshot of ${esc(p.title)}">
          <span class="card__skeleton" aria-hidden="true"></span>
          <span class="card__ph" aria-hidden="true"><span>${esc(initials(p.title))}</span></span>
          <img alt="Screenshot of ${esc(p.title)}" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" />
        </button>
        <span class="card__scrim" aria-hidden="true"></span>
        <span class="badge badge--live"${isLive ? "" : " hidden"}><i aria-hidden="true"></i>Live</span>
        <span class="badge badge--type">${esc(typeLabel)}</span>
        <span class="card__zoom" aria-hidden="true">${ICON.expand}</span>
      </div>
      <div class="card__body">
        <div class="card__top">
          <h3 class="card__title"><a href="${p.repoUrl}" target="_blank" rel="noopener">${esc(p.title)}${ICON.arrow}</a></h3>
          ${p.year ? `<span class="card__year">${esc(p.year)}</span>` : ""}
        </div>
        <p class="card__blurb">${esc(p.blurb)}</p>
        ${tagHtml ? `<ul class="card__tags">${tagHtml}</ul>` : ""}
        <div class="card__foot">
          <div class="card__meta"><span class="updated">${esc(p.repo)}</span></div>
          <div class="card__actions">
            <a class="btn btn--primary btn--sm card__play" href="${esc(p.demoUrl || "#")}" target="_blank" rel="noopener"${isLive ? "" : " hidden"}>Play${ICON.play}</a>
            <a class="btn btn--ghost btn--sm" href="${p.repoUrl}" target="_blank" rel="noopener">Code${ICON.code}</a>
          </div>
        </div>
      </div>`;

    p.card = {
      el,
      img: $(".card__shot img", el),
      shotButton: $(".card__shot", el),
      blur: $(".card__blurb", el),
      meta: $(".card__meta", el),
      play: $(".card__play", el),
      liveBadge: $(".badge--live", el),
      titleLink: $(".card__title a", el),
    };

    p.card.shotButton.addEventListener("click", () => {
      if (!p.shot) return;
      openLightbox(p);
    });

    return el;
  }

  function applyMeta(p) {
    const c = p.card;
    if (!c) return;

    const bits = [];
    if (p.language) {
      const color = LANG_COLORS[p.language] || "#8b949e";
      bits.push(
        `<span class="lang" style="--lang-color:${color}"><i class="lang__dot" aria-hidden="true"></i>${esc(p.language)}</span>`
      );
    }
    if (p.stars > 0) {
      bits.push(`<span class="stars" aria-label="${p.stars} stars">${ICON.star}${p.stars}</span>`);
    }
    if (p.pushedAt) {
      bits.push(
        `<span class="updated" title="Last push: ${esc(new Date(p.pushedAt).toLocaleDateString())}">${esc(relativeTime(p.pushedAt))}</span>`
      );
    }
    if (!bits.length) bits.push(`<span class="updated">${esc(p.repo)}</span>`);
    c.meta.innerHTML = bits.join("");
  }

  function applyDemo(p) {
    if (!p.card) return;
    const url = p.demoUrl;

    if (url) {
      p.card.play.href = url;
      p.card.play.hidden = false;
      p.card.liveBadge.hidden = false;
      p.card.titleLink.href = url;
    } else {
      p.card.play.hidden = true;
      p.card.liveBadge.hidden = true;
      p.card.titleLink.href = p.repoUrl;
    }
    updateStats();
  }

  /* ------------------------------------------------------------------ */
  /* thumbnails                                                          */
  /* ------------------------------------------------------------------ */

  function thumbCandidates(p) {
    const urls = [];
    if (p.thumb) urls.push(p.thumb);

    const exts = ["jpg", "png", "webp", "gif"];
    const names = Array.from(new Set([p.slug, p.repo.toLowerCase(), p.repo]));

    for (const name of names) {
      for (const ext of exts) urls.push(`${THUMB_DIR}/${name}.${ext}`);
    }

    // GitHub's generated social preview — always exists for public repos.
    if (!p.skipOg) {
      urls.push(`https://opengraph.githubassets.com/1/${p.owner}/${p.repo}`);
    }

    return Array.from(new Set(urls));
  }

  const OG_HOST = "opengraph.githubassets.com";

  /* GitHub generates a plain, near-white 2:1 card for repositories without a
     custom social preview. Those look like broken images inside the deep-sea
     theme, so they are detected and replaced by the generated gradient tile. */
  function isGenericPreview(img) {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    if (Math.abs(img.naturalWidth / img.naturalHeight - 2) > 0.02) return false;

    try {
      const probe = document.createElement("canvas");
      probe.width = 24;
      probe.height = 12;
      const g = probe.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, 24, 12);
      const px = g.getImageData(0, 0, 24, 12).data;

      let lum = 0;
      let sat = 0;
      let n = 0;

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const gg = px[i + 1];
        const b = px[i + 2];
        lum += (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
        const mx = Math.max(r, gg, b);
        const mn = Math.min(r, gg, b);
        sat += mx ? (mx - mn) / mx : 0;
        n += 1;
      }

      return lum / n > 0.78 && sat / n < 0.14;
    } catch {
      // Cross-origin pixels unavailable: trust the image.
      return false;
    }
  }

  function firstImage(urls) {
    return new Promise((resolve) => {
      let i = 0;

      const next = () => {
        if (i >= urls.length) return resolve("");
        const url = urls[i];
        const img = new Image();

        // Only GitHub's preview needs CORS, so file:// previews keep working.
        if (url.includes(OG_HOST)) img.crossOrigin = "anonymous";

        img.onload = () => {
          if (url.includes(OG_HOST) && isGenericPreview(img)) {
            i += 1;
            next();
            return;
          }
          resolve(img.naturalWidth > 1 ? url : "");
        };
        img.onerror = () => {
          i += 1;
          next();
        };
        img.src = url;
      };

      next();
    });
  }

  async function loadThumbnail(p) {
    const url = await firstImage(thumbCandidates(p));
    const c = p.card;
    if (!c) return;

    if (!url) {
      c.el.classList.add("no-shot");
      c.el.classList.remove("has-shot");
      c.shotButton.disabled = true;
      return;
    }

    p.shot = url;
    c.img.addEventListener(
      "load",
      () => {
        c.img.classList.add("is-loaded");
        c.el.classList.add("has-shot");
      },
      { once: true }
    );
    c.img.src = url;
  }

  /* Discovered repositories resolve their social preview only when their
     card is near the viewport, two at a time. Forty simultaneous requests
     would otherwise hit GitHub's image rate limit. */
  const thumbQueue = [];
  let thumbActive = 0;

  function pumpThumbQueue() {
    while (thumbActive < 2 && thumbQueue.length) {
      const p = thumbQueue.shift();
      thumbActive += 1;
      Promise.resolve(loadThumbnail(p)).finally(() => {
        thumbActive -= 1;
        setTimeout(pumpThumbQueue, 180);
      });
    }
  }

  const thumbObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const p = entry.target.__portfolio;
              thumbObserver.unobserve(entry.target);
              if (!p) continue;
              thumbQueue.push(p);
              pumpThumbQueue();
            }
          },
          { rootMargin: "600px 0px" }
        )
      : null;

  function loadThumbnailWhenNear(p) {
    if (!p.card) return;
    if (!thumbObserver) {
      thumbQueue.push(p);
      pumpThumbQueue();
      return;
    }
    p.card.el.__portfolio = p;
    thumbObserver.observe(p.card.el);
  }

  /* ------------------------------------------------------------------ */
  /* GitHub metadata                                                     */
  /* ------------------------------------------------------------------ */

  async function hydrate(p) {
    const key = `${p.owner}/${p.repo}`;

    const cached = readCache(key);
    if (cached) applyGitHub(p, cached);
    if (apiBlocked) return;

    try {
      const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}`, {
        headers: { Accept: "application/vnd.github+json" },
      });

      // Rate limited (60/hour per visitor IP) or blocked — stop asking.
      if (res.status === 403 || res.status === 429) {
        apiBlocked = true;
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      if (!data || data.message) return;
      writeCache(key, data);
      applyGitHub(p, data);
    } catch {
      /* offline or blocked — curated data still renders */
    }
  }

  async function hydrateAll() {
    for (const p of state.projects) {
      if (apiBlocked) break;
      await hydrate(p);
    }
  }

  function applyGitHub(p, d) {
    p.language = d.language || p.language;
    p.stars = Number(d.stargazers_count) || 0;
    p.pushedAt = d.pushed_at || p.pushedAt;

    if (!p.blurb && d.description && p.card) {
      p.blurb = d.description;
      p.card.blur.textContent = d.description;
    }

    if (!p.demoUrl) {
      const home = String(d.homepage || "").trim();
      if (home) {
        p.demoUrl = /^https?:\/\//i.test(home) ? home : `https://${home}`;
      } else if (d.has_pages && !/\.github\.io$/i.test(p.repo)) {
        p.demoUrl = `https://${p.owner.toLowerCase()}.github.io/${p.repo}/`;
      }
    }

    applyMeta(p);
    applyDemo(p);
  }

  /* ------------------------------------------------------------------ */
  /* discovery + merge                                                   */
  /* ------------------------------------------------------------------ */

  let discovered = false;
  let discoveryStarted = false;

  function mergeRepoList(list) {
    if (discovered || !Array.isArray(list) || !list.length) return;
    discovered = true;

    const byName = new Map();
    for (const d of list) {
      if (d && d.name) byName.set(String(d.name).toLowerCase(), d);
    }

    // Curated entries take their metadata from the same list, so the old
    // per-repository requests are no longer needed on a normal visit.
    let enriched = false;
    for (const p of state.projects) {
      const d = byName.get(p.repo.toLowerCase());
      if (!d) continue;
      applyGitHub(p, d);
      enriched = true;
    }

    const known = new Set(state.projects.map((p) => p.repo.toLowerCase()));
    let added = 0;

    for (const d of list) {
      if (added >= MAX_DISCOVERED) break;
      if (!repoIsRelevant(d)) continue;

      const key = String(d.name).toLowerCase();
      if (known.has(key)) continue;
      known.add(key);

      const p = normalise(discoveredItem(d), state.projects.length);
      if (!p.repo) continue;

      p.language = d.language || "";
      p.stars = Number(d.stargazers_count) || 0;
      p.pushedAt = d.pushed_at || "";
      p.discovered = true;

      state.projects.push(p);
      dom.grid.appendChild(buildCard(p, state.projects.length - 1));
      p.card.el.classList.add("in");
      applyMeta(p);
      loadThumbnailWhenNear(p);
      added += 1;
    }

    if (!added && !enriched) return;

    sortProjects();
    buildChips();
    updateStats();
    applyFilters();
  }

  async function discoverRepos() {
    if (discoveryStarted) return;
    discoveryStarted = true;

    // The list is cached for CACHE_HOURS, so returning visitors make no
    // request at all. One list call covers every repository.
    const cached = readCache("list");
    if (Array.isArray(cached)) {
      mergeRepoList(cached);
      return;
    }

    try {
      const list = [];
      for (let page = 1; page <= MAX_REPO_PAGES; page++) {
        const res = await fetch(
          `https://api.github.com/users/${encodeURIComponent(OWNER)}/repos?per_page=${REPOS_PER_PAGE}&page=${page}&sort=updated`,
          { headers: { Accept: "application/vnd.github+json" } }
        );

        if (res.status === 403 || res.status === 429) {
          apiBlocked = true;
          break;
        }
        if (!res.ok) break;

        const chunk = await res.json();
        if (!Array.isArray(chunk)) break;
        list.push(...chunk);
        if (chunk.length < REPOS_PER_PAGE) break;
      }

      if (list.length) {
        writeCache("list", list);
        mergeRepoList(list);
      }
    } catch {
      // Offline or blocked: the curated shelf still renders, and the
      // per-repository cache path can fill in a little detail.
      hydrateAll();
    }
  }

  /* ------------------------------------------------------------------ */
  /* chips / filters                                                     */
  /* ------------------------------------------------------------------ */

  function buildChips() {
    const types = new Map();
    const tags = new Map();

    for (const p of state.projects) {
      const key = TYPE_META[p.type] ? p.type : "project";
      types.set(key, (types.get(key) || 0) + 1);
      for (const t of p.tags) tags.set(t, (tags.get(t) || 0) + 1);
    }

    const orderedTypes = ["game", "web", "app", "experiment", "project"].filter((t) => types.has(t));
    const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);

    const chip = (value, label, count) =>
      `<button type="button" class="chip${state.filter === value ? " is-active" : ""}" data-filter="${esc(
        value
      )}" aria-pressed="${state.filter === value}">${esc(label)}<span class="chip__n">${count}</span></button>`;

    dom.chips.innerHTML = [
      chip("all", "All", state.projects.length),
      ...orderedTypes.map((t) => chip(`type:${t}`, (TYPE_META[t] || TYPE_META.project).plural, types.get(t))),
      topTags.length ? '<span class="chip chip--divider" aria-hidden="true"></span>' : "",
      ...topTags.map(([t, n]) => chip(`tag:${t}`, t, n)),
    ].join("");

    dom.chips.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.filter;
        state.filter = state.filter === value && value !== "all" ? "all" : value;
        dom.chips.querySelectorAll("[data-filter]").forEach((b) => {
          const on = b.dataset.filter === state.filter;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", String(on));
        });
        applyFilters();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* sorting / filtering                                                 */
  /* ------------------------------------------------------------------ */

  function sortProjects() {
    const list = [...state.projects];

    if (state.sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (state.sort === "newest") {
      list.sort((a, b) => new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0) || a.order - b.order);
    } else {
      list.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0) ||
          a.order - b.order
      );
    }

    list.forEach((p) => dom.grid.appendChild(p.card.el));
  }

  function applyFilters() {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;

    for (const p of state.projects) {
      const haystack = [
        p.title,
        p.blurb,
        p.repo,
        p.owner,
        p.language,
        p.type,
        (TYPE_META[p.type] || TYPE_META.project).label,
        ...p.tags,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = terms.every((t) => haystack.includes(t));
      const matchesFilter =
        state.filter === "all" ||
        (state.filter.startsWith("type:") && p.type === state.filter.slice(5)) ||
        (state.filter.startsWith("tag:") && p.tags.includes(state.filter.slice(4)));

      const show = matchesQuery && matchesFilter;
      p.card.el.hidden = !show;
      if (show) visible += 1;
    }

    const total = state.projects.length;
    dom.resultline.textContent =
      visible === total ? `${total} project${total === 1 ? "" : "s"}` : `${visible} of ${total} projects`;
    dom.empty.hidden = visible !== 0;
    dom.grid.hidden = visible === 0;
  }

  /* ------------------------------------------------------------------ */
  /* stats                                                               */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    const total = state.projects.length;
    const live = state.projects.filter((p) => p.demoUrl).length;
    const years = state.projects.map((p) => Number(p.year)).filter((y) => Number.isFinite(y) && y > 2000);
    const since = years.length ? Math.min(...years) : new Date().getFullYear();

    dom.statTotal.textContent = String(total);
    dom.statLive.textContent = String(live);
    dom.statSince.textContent = String(since);
    dom.heroCount.textContent = `${total} build${total === 1 ? "" : "s"}`;
  }

  /* ------------------------------------------------------------------ */
  /* lightbox                                                            */
  /* ------------------------------------------------------------------ */

  function refreshLightbox() {
    const p = lightbox.items[lightbox.index];
    if (!p) return;

    dom.lbImg.src = p.shot;
    dom.lbImg.alt = `Screenshot of ${p.title}`;
    dom.lbTitle.textContent = p.title;
    dom.lbLink.href = p.demoUrl || p.repoUrl;
    dom.lbPrev.disabled = lightbox.items.length < 2;
    dom.lbNext.disabled = lightbox.items.length < 2;
  }

  function openLightbox(current) {
    lightbox.items = state.projects.filter((p) => p.shot && !p.card.el.hidden);
    lightbox.index = Math.max(0, lightbox.items.indexOf(current));
    lightbox.lastFocus = document.activeElement;
    lightbox.open = true;

    dom.lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    refreshLightbox();
    dom.lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox.open) return;
    lightbox.open = false;
    dom.lightbox.hidden = true;
    document.body.classList.remove("no-scroll");
    dom.lbImg.removeAttribute("src");
    if (lightbox.lastFocus && typeof lightbox.lastFocus.focus === "function") {
      lightbox.lastFocus.focus();
    }
  }

  function stepLightbox(dir) {
    if (lightbox.items.length < 2) return;
    lightbox.index = (lightbox.index + dir + lightbox.items.length) % lightbox.items.length;
    refreshLightbox();
  }

  /* ------------------------------------------------------------------ */
  /* wiring                                                              */
  /* ------------------------------------------------------------------ */

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initReveal() {
    if (reduceMotion) {
      state.projects.forEach((p) => p.card.el.classList.add("in"));
      return;
    }

    // Stagger the cards in on load. Deliberately not scroll-triggered: a card
    // should never be stuck invisible because it was outside the viewport.
    requestAnimationFrame(() => {
      state.projects.forEach((p) => p.card.el.classList.add("in"));
    });
  }

  function setView(view) {
    state.view = view === "list" ? "list" : "grid";
    dom.grid.classList.toggle("is-list", state.view === "list");
    document.querySelectorAll("[data-view]").forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    try {
      localStorage.setItem("hobby-arcade:view", state.view);
    } catch {
      /* ignore */
    }
  }

  function bindEvents() {
    let debounce;
    dom.search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.q = dom.search.value;
        applyFilters();
      }, 90);
    });

    dom.sort.addEventListener("change", () => {
      state.sort = dom.sort.value;
      sortProjects();
      applyFilters();
    });

    dom.clear.addEventListener("click", () => {
      state.q = "";
      state.filter = "all";
      dom.search.value = "";
      dom.chips.querySelectorAll("[data-filter]").forEach((b) => {
        const on = b.dataset.filter === "all";
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      applyFilters();
      dom.search.focus();
    });

    document.querySelectorAll("[data-view]").forEach((b) => {
      b.addEventListener("click", () => setView(b.dataset.view));
    });

    /* lightbox */
    dom.lightbox.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeLightbox));
    dom.lbPrev.addEventListener("click", () => stepLightbox(-1));
    dom.lbNext.addEventListener("click", () => stepLightbox(1));

    document.addEventListener("keydown", (e) => {
      if (lightbox.open) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          stepLightbox(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          stepLightbox(1);
        }
        return;
      }

      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        dom.search.focus();
      }
    });

    /* topbar state */
    const onScroll = () => dom.topbar.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    state.projects = PRODUCTS.map(normalise).filter((p) => p.repo);

    state.projects.forEach((p, i) => {
      dom.grid.appendChild(buildCard(p, i));
    });

    sortProjects();
    buildChips();
    updateStats();
    applyFilters();
    initReveal();
    bindEvents();

    dom.year.textContent = String(new Date().getFullYear());

    try {
      const saved = localStorage.getItem("hobby-arcade:view");
      if (saved) setView(saved);
    } catch {
      /* ignore */
    }

    updateStats();

    /* Thumbnails resolve in parallel. One list request discovers every
       relevant public repository; the cache keeps repeat visits quiet. */
    state.projects.forEach(loadThumbnail);
    discoverRepos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
