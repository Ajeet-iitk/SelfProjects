/* ==========================================================================
   PROJECT LIST — this is the only file you edit to add a project.
   ==========================================================================

   Shortest form (everything else is pulled from GitHub automatically):

       "Ajeet-iitk/SomeRepo",

   Full form (override anything GitHub doesn't know):

       {
         repo:      "Ajeet-iitk/SomeRepo",   // required — "owner/repo" or full URL
         title:     "Nice Name",             // optional — defaults to the repo name
         blurb:     "One or two lines.",     // optional — otherwise uses the GitHub description
         tags:      ["three.js", "game"],    // optional
         type:      "game",                  // game | web | app | experiment
         featured:  true,                    // optional — sorts to the top
         demo:      "https://...",           // optional — otherwise detected from GitHub Pages
         thumb:     "thumbnails/x.png",      // optional — otherwise auto-detected
         year:      2025                     // optional
       }

   Thumbnails are automatic: the shelf uses screenshots/website.jpg from the
   project repository itself. To override it, save an image as
   thumbnails/<repo-name>.png  (or .jpg / .webp) and you don't need `thumb`.
   ========================================================================== */

window.PORTFOLIO = {
  owner: "Ajeet-iitk",
  name: "Ajeet",
  tagline: "Hobby arcade",
  github: "https://github.com/Ajeet-iitk",

  /* Where screenshots live, relative to index.html. */
  thumbDir: "thumbnails",

  /* How long GitHub metadata is cached in the visitor's browser (hours). */
  cacheHours: 12,

  /* Every other public, non-fork, non-empty repository on this account is
     discovered automatically. Add repository names here to leave one out. */
  exclude: [],

  /* Safety cap for automatic discovery (curated entries are always shown). */
  maxAutoProjects: 300,

  projects: [
    {
      repo: "Ajeet-iitk/IndianParliament",
      title: "Sansad",
      blurb:
        "Draft a bill, whip the votes and survive a joint sitting in this interactive mock-Parliament simulator built for UPSC prep.",
      tags: ["upsc", "simulator", "politics", "vanilla-js"],
      type: "game",
      featured: true,
      demo: "https://ajeet-iitk.github.io/IndianParliament/",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/OneWishWillow",
      title: "One Wish Willow",
      blurb:
        "A cinematic wish-granting willow. Write a wish, snap a branch, and meet the spiral.",
      tags: ["three.js", "webgl", "story", "cinematic"],
      type: "game",
      featured: true,
      demo: "https://ajeet-iitk.github.io/OneWishWillow/",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/MathuraTrip1",
      title: "Bhai, Dheere Chala!",
      blurb:
        "Five friends, one shaky Innova, 84 km to Mathura. A first-person comedy drive with terrible suspension.",
      tags: ["three.js", "webgl", "driving", "comedy"],
      type: "game",
      featured: true,
      demo: "https://ajeet-iitk.github.io/MathuraTrip1/",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/movie-theme1",
      title: "Blind Reel",
      blurb:
        "118 films and series described only by their plots. Read the story, then reveal the title.",
      tags: ["movies", "quiz", "vanilla-js", "data"],
      type: "web",
      featured: true,
      demo: "https://ajeet-iitk.github.io/movie-theme1/",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/F1.1",
      title: "Apex GP",
      blurb:
        "A browser Formula racer — 3D circuits, late braking, and lap times you will absolutely want to beat.",
      tags: ["three.js", "webgl", "racing"],
      type: "game",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/Raavan1",
      title: "Shri Ram's Arrow",
      blurb:
        "Draw, aim and loose the arrow — a Ramayana archery duel rendered in 3D.",
      tags: ["three.js", "webgl", "archery", "mythology"],
      type: "game",
      demo: "https://ajeet-iitk.github.io/Raavan1/ram-arrow-game.html",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/DelhiSmog1",
      title: "Delhi Smog Run",
      blurb:
        "A 3D first-person endless runner through Delhi's smog-choked streets. Grab a mask and go.",
      tags: ["three.js", "webgl", "endless-runner"],
      type: "game",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/JantarMantar3",
      title: "Chalo Jantar Mantar",
      blurb:
        "A satirical protest-march runner set on Delhi's favourite protest mile.",
      tags: ["runner", "satire", "vanilla-js"],
      type: "game",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/Boiling-Milk1",
      title: "Boiling Milk",
      blurb:
        "A frantic kitchen reflex game: keep the milk in the pot and off the stove.",
      tags: ["arcade", "reflex", "vanilla-js"],
      type: "game",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/kaancha-mela",
      title: "Kaanch Ka Mela",
      blurb:
        "Three balls, one teddy. A physics-driven marble-shooting carnival stall in the browser.",
      tags: ["three.js", "physics", "carnival"],
      type: "game",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/duo1",
      title: "Bhasha",
      blurb:
        "A Duolingo-style static site for learning Tamil, Telugu and Gujarati — from English or Hindi.",
      tags: ["education", "language", "static-site"],
      type: "web",
      year: 2025,
    },
    {
      repo: "Ajeet-iitk/kushwaha1",
      title: "The Kushwaha Family",
      blurb:
        "An animated, scroll-driven introduction to the family — hand-tuned frame by frame.",
      tags: ["animation", "vanilla-js"],
      type: "web",
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/SlotAlarmClock",
      title: "Slot Alarm Clock",
      blurb:
        "A 24-hour Android alarm clock built like a machined slot machine: four dials, real motion blur, one rocker switch.",
      tags: ["android", "kotlin", "hardware-ui"],
      type: "app",
      // No web preview exists for an Android app — show the on-brand
      // placeholder until a real screenshot is dropped into /thumbnails.
      skipOg: true,
      year: 2026,
    },
    {
      repo: "Ajeet-iitk/Vision1810",
      title: "UPSC Prelims 2018",
      blurb:
        "A question-by-question breakdown of the Vision IAS Prelims 2018 paper, with explanations.",
      tags: ["upsc", "analysis", "education"],
      type: "web",
      skipOg: true,
      year: 2024,
    },
  ],
};
