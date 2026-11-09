/* ==========================================================================
   Submarine mode (easter egg)
   Press S to dive: the page goes dark and a little submarine
   follows the pointer, lighting the way with a flashlight beam.
   Press S or Escape to surface. Clicks pass straight through to the page.
   ========================================================================== */

(() => {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let canvas = null;
  let ctx = null;
  let toast = null;
  let exitBtn = null;
  let raf = 0;
  let active = false;
  let W = 0;
  let H = 0;
  let DPR = 1;
  let last = 0;

  const ptr = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const sub = { x: ptr.x, y: ptr.y, vx: 0, vy: 0, dir: 1, tilt: 0 };
  let bubbles = [];

  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function drawSub(x, y, dir, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.rotate(tilt);

    // propeller
    ctx.fillStyle = "#8a6f1c";
    ctx.fillRect(-34, -7, 5, 14);
    // hull
    ctx.fillStyle = "#f2b928";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // conning tower
    ctx.fillRect(-9, -23, 16, 11);
    ctx.fillRect(-1, -29, 3, 7);
    ctx.fillRect(-1, -29, 9, 3);
    // porthole
    ctx.fillStyle = "#0b3a4a";
    ctx.beginPath();
    ctx.arc(8, -1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6f1c";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(140, 240, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(6.5, -2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // headlamp
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath();
    ctx.arc(29, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;

    // spring toward the pointer
    const dx = ptr.x - sub.x;
    const dy = ptr.y - sub.y;
    sub.vx += dx * 14 * dt;
    sub.vy += dy * 14 * dt;
    sub.vx *= Math.pow(0.02, dt);
    sub.vy *= Math.pow(0.02, dt);
    sub.x += sub.vx * dt;
    sub.y += sub.vy * dt;
    if (Math.abs(dx) > 18) sub.dir = dx > 0 ? 1 : -1;
    sub.tilt += (Math.max(-0.35, Math.min(0.35, (sub.vy / 700) * sub.dir)) - sub.tilt) * Math.min(1, dt * 6);

    if (Math.random() < 0.3 && Math.hypot(sub.vx, sub.vy) > 40) {
      bubbles.push({ x: sub.x - sub.dir * 34, y: sub.y + (Math.random() - 0.5) * 8, r: 1.5 + Math.random() * 2.5, life: 1 });
    }
    for (const b of bubbles) {
      b.y -= 30 * dt;
      b.life -= dt * 0.6;
    }
    bubbles = bubbles.filter((b) => b.life > 0);

    // darkness
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 5, 9, 0.94)";
    ctx.fillRect(0, 0, W, H);

    // carve out the beam + a soft glow around the hull
    ctx.globalCompositeOperation = "destination-out";
    const ang = sub.tilt * sub.dir + (sub.dir > 0 ? 0 : Math.PI);
    const hx = sub.x + sub.dir * 30;
    const hy = sub.y + 2;
    const len = 520;
    const spread = 0.34;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    const beam = ctx.createRadialGradient(0, 0, 10, 0, 0, len);
    beam.addColorStop(0, "rgba(0,0,0,1)");
    beam.addColorStop(0.6, "rgba(0,0,0,0.75)");
    beam.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, -spread, spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const halo = ctx.createRadialGradient(sub.x, sub.y, 8, sub.x, sub.y, 120);
    halo.addColorStop(0, "rgba(0,0,0,0.95)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sub.x, sub.y, 120, 0, Math.PI * 2);
    ctx.fill();

    // the submarine and its bubbles sit on top of the dark
    ctx.globalCompositeOperation = "source-over";
    for (const b of bubbles) {
      ctx.strokeStyle = `rgba(190, 240, 255, ${Math.max(0, b.life) * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawSub(sub.x, sub.y, sub.dir, sub.tilt);
  }

  function dive() {
    if (active) return;
    active = true;
    canvas = document.createElement("canvas");
    canvas.className = "sub-layer";
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");
    document.body.appendChild(canvas);
    resize();
    window.addEventListener("resize", resize);

    toast = document.createElement("div");
    toast.className = "sub-toast";
    toast.textContent = window.matchMedia("(hover: none)").matches
      ? "Submarine mode — drag your finger to steer"
      : "Submarine mode — press S or Esc to surface";
    document.body.appendChild(toast);
    exitBtn = document.createElement("button");
    exitBtn.type = "button";
    exitBtn.className = "sub-exit";
    exitBtn.textContent = "Surface";
    exitBtn.addEventListener("click", surface);
    document.body.appendChild(exitBtn);
    setTimeout(() => toast && toast.remove(), 3700);

    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function surface() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    if (canvas) canvas.remove();
    if (toast) toast.remove();
    if (exitBtn) exitBtn.remove();
    canvas = ctx = toast = exitBtn = null;
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      ptr.x = e.clientX;
      ptr.y = e.clientY;
    },
    { passive: true }
  );

  // Touch drags keep firing touchmove even while the page scrolls.
  const touchPoint = (e) => {
    const t = e.touches && e.touches[0];
    if (t) {
      ptr.x = t.clientX;
      ptr.y = t.clientY;
    }
  };
  window.addEventListener("touchstart", touchPoint, { passive: true });
  window.addEventListener("touchmove", touchPoint, { passive: true });

  const toggleBtn = document.getElementById("sub-toggle");
  if (toggleBtn) toggleBtn.addEventListener("click", () => (active ? surface() : dive()));

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      surface();
      return;
    }
    if (typing()) return;

    const k = e.key.toLowerCase();
    if (k === "s") {
      if (active) surface();
      else dive();
    }
  });
})();
