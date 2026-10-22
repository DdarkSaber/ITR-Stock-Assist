"use strict";
/* ITR Stock Assist UI layer: 3D rings, holding lab, deck, privacy toggle, forms walkthrough.
   CSP-safe: DOM is built with createElement/textContent; styles only through CSSOM. */
(() => {
  const $ = id => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const flatQuery = window.matchMedia("(max-width: 639.98px)");
  const isReduced = () => reducedMotion.matches;
  const isFlat = () => flatQuery.matches;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function svgIcon(paths, cls) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    for (const d of paths) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  }

  /* ---------- Themes (in memory only: the app promises no local storage) ---------- */
  for (const swatch of qsa(".swatch")) {
    swatch.addEventListener("click", () => {
      const root = document.documentElement;
      root.classList.remove("t-aurora", "t-ember", "t-glacier");
      root.classList.add(`t-${swatch.dataset.theme}`);
      for (const other of qsa(".swatch")) {
        const on = other === swatch;
        other.classList.toggle("on", on);
        other.setAttribute("aria-pressed", String(on));
      }
    });
  }

  /* ---------- 3D ring ---------- */
  class Ring {
    constructor(wrap, onFront) {
      this.wrap = wrap;
      this.onFront = onFront;
      this.stage = qs(".stage", wrap);
      this.tilt = qs(".tilt", wrap);
      this.ring = qs(".ring", wrap);
      this.orb = qs(".orb", wrap);
      this.cards = qsa(".card3", wrap);
      this.n = this.cards.length;
      this.step = 360 / this.n;
      this.angle = 0;
      this.tiltX = -8;
      this.tiltY = 0;
      this.scale = 1;
      this.paused = isReduced();
      this.hover = false;
      this.focus = false;
      this.blocked = false;
      this.drag = null;
      this.moved = false;
      this.kicker = qs(".ring-kicker", wrap);
      this.desc = qs(".ring-desc", wrap);
      this.pauseBtn = qs(".ring-pause", wrap);
      this.dotsBox = qs(".dots", wrap);
      this.dots = this.cards.map((card, i) => {
        const span = el("span", "dotwrap");
        const dot = el("button", "dot");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show card ${i + 1}: ${card.dataset.k}`);
        dot.addEventListener("click", () => this.go(i));
        span.append(dot);
        this.dotsBox.append(span);
        return dot;
      });
      this.cards.forEach((card, i) => {
        card.style.transform = `rotateY(${i * this.step}deg) translateZ(var(--r))`;
        qs(".cardbtn", card).addEventListener("click", () => this.cardClick(i));
      });
      qs(".ring-prev", wrap).addEventListener("click", () => this.go((this.idx() + this.n - 1) % this.n));
      qs(".ring-next", wrap).addEventListener("click", () => this.go((this.idx() + 1) % this.n));
      this.pauseBtn.addEventListener("click", () => { this.paused = !this.paused; this.render(); });
      this.bindPointer();
      this.stage.addEventListener("keydown", event => this.key(event));
      wrap.addEventListener("focusin", () => { this.focus = true; });
      wrap.addEventListener("focusout", event => { if (!wrap.contains(event.relatedTarget)) this.focus = false; });
      this.ring.addEventListener("scroll", () => this.flatScroll(), { passive: true });
      new ResizeObserver(() => this.layout()).observe(this.stage);
      flatQuery.addEventListener("change", () => { this.layout(); this.go(this.idx(), true); });
      reducedMotion.addEventListener("change", () => { if (isReduced()) this.paused = true; this.render(); });
      this.timer = setInterval(() => this.auto(), 3600);
      this.layout();
      this.render();
    }
    idx() {
      if (isFlat()) return this.flatIdx ?? 0;
      return ((Math.round(-this.angle / this.step) % this.n) + this.n) % this.n;
    }
    visible() { return this.stage.offsetParent !== null; }
    layout() {
      if (isFlat()) {
        this.tilt.style.transform = "";
        this.stage.style.setProperty("--ring-scale", "1");
        return;
      }
      const cardW = this.cards[0].offsetWidth;
      const width = this.stage.clientWidth;
      if (!cardW || !width) return;
      const r = (cardW / 2) / Math.tan(Math.PI / this.n) * 1.15;
      this.wrap.style.setProperty("--r", `${r.toFixed(1)}px`);
      this.scale = Math.min(1, (width * 1.06) / (2 * r + cardW));
      this.stage.style.setProperty("--ring-scale", this.scale.toFixed(3));
      this.applyTilt();
    }
    applyTilt() {
      if (isFlat()) return;
      this.tilt.style.transform = `scale(${this.scale.toFixed(3)}) rotateX(${this.tiltX}deg) rotateY(${this.tiltY}deg)`;
    }
    render() {
      const i = this.idx();
      if (!isFlat()) {
        this.ring.style.transform = `rotateY(${this.angle}deg)`;
        if (this.orb) this.orb.style.transform = `rotateY(${-this.angle}deg)`;
      }
      this.cards.forEach((card, k) => card.classList.toggle("on", k === i));
      this.dots.forEach((dot, k) => {
        dot.classList.toggle("on", k === i);
        dot.setAttribute("aria-pressed", String(k === i));
      });
      this.kicker.textContent = this.cards[i].dataset.k;
      this.desc.textContent = this.cards[i].dataset.d;
      this.pauseBtn.classList.toggle("is-paused", this.paused);
      this.pauseBtn.setAttribute("aria-label", this.paused ? "Resume rotation" : "Pause rotation");
    }
    go(i, instant) {
      if (isFlat()) {
        const card = this.cards[i];
        this.flatIdx = i;
        this.ring.scrollTo({
          left: card.offsetLeft - (this.ring.clientWidth - card.offsetWidth) / 2,
          behavior: instant || isReduced() ? "auto" : "smooth",
        });
        this.render();
        return;
      }
      let d = i - this.idx();
      if (d > this.n / 2) d -= this.n;
      if (d < -this.n / 2) d += this.n;
      this.angle = Math.round(this.angle / this.step) * this.step - d * this.step;
      this.render();
    }
    flatScroll() {
      if (!isFlat()) return;
      const mid = this.ring.scrollLeft + this.ring.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      this.cards.forEach((card, k) => {
        const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = k; }
      });
      if (best !== this.flatIdx) { this.flatIdx = best; this.render(); }
    }
    auto() {
      if (this.paused || this.hover || this.focus || this.drag || this.blocked || isFlat() || isReduced()) return;
      if (document.hidden || !this.visible()) return;
      this.angle = Math.round(this.angle / this.step) * this.step - this.step;
      this.render();
    }
    cardClick(i) {
      if (this.moved) { this.moved = false; return; }
      if (this.idx() !== i) { this.go(i); return; }
      if (this.onFront) this.onFront(i, this.cards[i]);
    }
    key(event) {
      if (event.target !== this.stage) return;
      const i = this.idx();
      if (event.key === "ArrowRight") { event.preventDefault(); this.go((i + 1) % this.n); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); this.go((i + this.n - 1) % this.n); }
      else if ((event.key === "Enter" || event.key === " ") && this.onFront) {
        event.preventDefault();
        this.moved = false;
        this.onFront(i, this.cards[i]);
      }
    }
    bindPointer() {
      const stage = this.stage;
      stage.addEventListener("pointerdown", event => {
        if (isFlat() || event.button !== 0) return;
        this.drag = { x: event.clientX, a: this.angle, captured: false, id: event.pointerId };
        this.moved = false;
      });
      stage.addEventListener("pointermove", event => {
        if (isFlat()) return;
        const rect = stage.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = (event.clientY - rect.top) / rect.height - 0.5;
        if (!isReduced()) {
          this.tiltY = Math.round(nx * 160) / 10;
          this.tiltX = Math.round((-8 - ny * 12) * 10) / 10;
          this.applyTilt();
        }
        if (!this.drag) return;
        const dx = event.clientX - this.drag.x;
        if (!this.drag.captured && Math.abs(dx) > 6) {
          this.drag.captured = true;
          this.moved = true;
          stage.classList.add("dragging");
          try { stage.setPointerCapture(this.drag.id); } catch (error) { /* pointer already gone */ }
        }
        if (this.drag.captured) {
          this.angle = this.drag.a + dx * 0.35;
          this.render();
        }
      });
      const up = () => {
        if (!this.drag) return;
        const was = this.drag.captured;
        this.drag = null;
        if (was) {
          stage.classList.remove("dragging");
          this.angle = Math.round(this.angle / this.step) * this.step;
          this.render();
        }
      };
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
      stage.addEventListener("pointerenter", () => { this.hover = true; });
      stage.addEventListener("pointerleave", () => {
        if (this.drag) return;
        this.hover = false;
        this.tiltX = -8;
        this.tiltY = 0;
        this.applyTilt();
      });
    }
  }

  const homeRing = new Ring(qs('[data-ring="home"]'), null);

  /* ---------- Upload: drop zone and file list ---------- */
  const filesInput = $("files");
  const drop = qs("label.drop");
  const fileList = $("file-list");
  function sizeLabel(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${Math.round(bytes / 104857.6) / 10} MB`;
  }
  function kindNote(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".csv")) return ["Canonical CSV lots", "st-mut"];
    if (!lower.endsWith(".xlsx")) return ["Unsupported type: use .xlsx or .csv", "st-bad"];
    if (/p&l|pnl|p_l|profit/.test(lower)) return ["Looks like a P&L report: these are rejected", "st-warn"];
    if (/mutual/.test(lower)) return ["Groww mutual-fund capital gains", "st-mut"];
    if (/stock|capital/.test(lower)) return ["Groww stock capital gains", "st-mut"];
    return ["Groww capital-gains .xlsx", "st-mut"];
  }
  function showFiles() {
    const files = [...filesInput.files];
    fileList.replaceChildren(...files.map(file => {
      const row = el("div", "frow");
      row.append(svgIcon(["M6 2h9l5 5v15H6z", "M14 2v6h6"]));
      const text = el("div", "frow-text");
      const [note, cls] = kindNote(file.name);
      text.append(el("div", "frow-name", file.name), el("div", `mono frow-note ${cls}`, `${sizeLabel(file.size)} / ${note}`));
      row.append(text);
      return row;
    }));
    fileList.hidden = files.length === 0;
  }
  filesInput.addEventListener("change", showFiles);
  $("sample").addEventListener("click", () => { fileList.hidden = true; fileList.replaceChildren(); });
  $("reset").addEventListener("click", () => { fileList.hidden = true; fileList.replaceChildren(); });
  drop.addEventListener("dragover", event => { event.preventDefault(); drop.classList.add("hot"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("hot"));
  drop.addEventListener("drop", event => {
    event.preventDefault();
    drop.classList.remove("hot");
    const dropped = event.dataTransfer && event.dataTransfer.files;
    if (!dropped || !dropped.length || filesInput.disabled) return;
    filesInput.files = dropped;
    filesInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  /* ---------- Holding lab (mirrors the core rule: LTCG if sale >= anniversary) ---------- */
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  function anchor(y, m, d, add) {
    const t = new Date(Date.UTC(y, m - 1 + add, 1));
    const ty = t.getUTCFullYear();
    const tm = t.getUTCMonth();
    return Date.UTC(ty, tm, Math.min(d, daysInMonth(ty, tm)));
  }
  function classify(buy, sell, kind) {
    const re = /^(\d{4})-(\d{2})-(\d{2})$/;
    const b = re.exec(buy || "");
    const s = re.exec(sell || "");
    const out = { term: "—", status: "CHECK DATES", cls: "st-mut", reason: "Pick both a buy date and a sell date.", held: "—", days: "—", fy: "—", barW: 0, markL: 50 };
    if (!b || !s) return out;
    const by = +b[1], bm = +b[2], bd = +b[3], sy = +s[1], sm = +s[2], sd = +s[3];
    const bt = Date.UTC(by, bm - 1, bd);
    const st = Date.UTC(sy, sm - 1, sd);
    if (Number.isNaN(bt) || Number.isNaN(st)) return out;
    if (st <= bt) { out.reason = "The sale has to come after the purchase."; return out; }
    const days = Math.round((st - bt) / 864e5);
    let months = (sy - by) * 12 + (sm - bm);
    while (months > 0 && anchor(by, bm, bd, months) > st) months--;
    const rem = Math.round((st - anchor(by, bm, bd, months)) / 864e5);
    const leap = bm === 2 && bd === 29;
    const anniv = leap ? Date.UTC(by + 1, 2, 1) : Date.UTC(by + 1, bm - 1, bd);
    const annivDays = Math.round((anniv - bt) / 864e5);
    const fyStart = sm >= 4 ? sy : sy - 1;
    const fyLabel = `FY ${fyStart}-${String(fyStart + 1).slice(2)}`;
    const scale = 730;
    out.days = days.toLocaleString("en-IN") + (days === 1 ? " day" : " days");
    const yrs = Math.floor(months / 12);
    const mo = months % 12;
    out.held = (yrs ? `${yrs}${yrs === 1 ? " year, " : " years, "}` : "") + mo + (mo === 1 ? " month, " : " months, ") + rem + (rem === 1 ? " day" : " days");
    out.fy = fyLabel;
    out.barW = Math.round(Math.min(days / scale, 1) * 1000) / 10;
    out.markL = Math.round(Math.min(annivDays / scale, 1) * 1000) / 10;
    out.term = st >= anniv ? "LTCG" : "STCG";
    out.status = "CLASSIFIED";
    out.cls = "st-ok";
    out.reason = out.term === "LTCG"
      ? "Sold on or after the one-year anniversary, so it is long-term."
      : "Sold before the one-year anniversary, so it is short-term.";
    if (kind === "debt") { Object.assign(out, { term: "—", status: "BLOCKED", cls: "st-warn", reason: "Debt funds stay visible but excluded: no debt-fund rules are implemented." }); return out; }
    if (bt <= Date.UTC(2018, 0, 31)) { Object.assign(out, { status: "BLOCKED", cls: "st-warn", reason: "Bought on or before 31 Jan 2018: blocked for grandfathering review, not guessed." }); return out; }
    if (leap && sy === by + 1 && sm === 2 && sd === 28) { Object.assign(out, { term: "—", status: "BLOCKED", cls: "st-warn", reason: "The 29 Feb to 28 Feb boundary is blocked for advice rather than guessed." }); return out; }
    if (fyStart !== 2024 && fyStart !== 2025) { Object.assign(out, { status: "EXCLUDED", cls: "st-mut", reason: `${fyLabel} is outside the validated years (FY 2024-25, FY 2025-26), so it never enters totals.` }); return out; }
    return out;
  }
  const PRESETS = [
    { label: "Exactly one year", buy: "2024-06-14", sell: "2025-06-14", kind: "listed_equity" },
    { label: "One day short", buy: "2024-06-14", sell: "2025-06-13", kind: "listed_equity" },
    { label: "Leap-day trap", buy: "2024-02-29", sell: "2025-02-28", kind: "listed_equity" },
    { label: "Bought before 2018", buy: "2017-11-20", sell: "2024-09-10", kind: "listed_equity" },
    { label: "Outside valid years", buy: "2022-05-02", sell: "2023-08-01", kind: "equity_mf" },
    { label: "Debt fund", buy: "2024-06-14", sell: "2025-08-01", kind: "debt" },
  ];
  const lab = { buy: $("lab-buy"), sell: $("lab-sell"), kind: $("lab-kind"), result: $("lab-result") };
  let flip = false;
  const presetButtons = PRESETS.map(preset => {
    const chip = el("button", "chip", preset.label);
    chip.type = "button";
    chip.addEventListener("click", () => {
      lab.buy.value = preset.buy;
      lab.sell.value = preset.sell;
      lab.kind.value = preset.kind;
      renderLab(true);
    });
    $("lab-presets").append(chip);
    return chip;
  });
  function renderLab(animate) {
    const r = classify(lab.buy.value, lab.sell.value, lab.kind.value);
    const term = $("lab-term");
    term.textContent = r.term;
    term.className = `disp lab-term term-${r.term}`;
    const status = $("lab-status");
    status.textContent = r.status;
    status.className = `mono lab-status ${r.cls}`;
    $("lab-reason").textContent = r.reason;
    $("lab-held").textContent = r.held;
    $("lab-days").textContent = r.days;
    $("lab-fy").textContent = r.fy;
    $("lab-fill").style.width = `${r.barW}%`;
    $("lab-mark").style.left = `${r.markL}%`;
    PRESETS.forEach((preset, i) => {
      const on = preset.buy === lab.buy.value && preset.sell === lab.sell.value && preset.kind === lab.kind.value;
      presetButtons[i].classList.toggle("on", on);
      presetButtons[i].setAttribute("aria-pressed", String(on));
    });
    if (animate) {
      flip = !flip;
      lab.result.classList.remove("fa", "fb");
      lab.result.classList.add(flip ? "fa" : "fb");
    }
  }
  for (const input of [lab.buy, lab.sell, lab.kind]) input.addEventListener("change", () => renderLab(true));
  renderLab(false);

  /* ---------- How it works: 3D step deck ---------- */
  const tabs = qsa('#how [role="tab"]');
  const deckCards = qsa("#how .deckcard");
  let deckStep = 0;
  function renderDeck() {
    deckCards.forEach((card, j) => {
      const d = j - deckStep;
      let transform = "translateY(0) translateZ(0) rotateX(0deg)";
      let opacity = "1";
      let z = "3";
      if (d > 0) {
        transform = `translateY(${d * 24}px) translateZ(${-d * 110}px) rotateX(-8deg)`;
        opacity = String(1 - d * 0.35);
        z = String(3 - d);
      } else if (d < 0) {
        transform = "translateY(-60px) translateZ(80px) rotateX(70deg)";
        opacity = "0";
        z = "4";
      }
      card.style.transform = transform;
      card.style.opacity = opacity;
      card.style.zIndex = z;
      card.style.pointerEvents = d === 0 ? "auto" : "none";
      card.inert = d !== 0;
      card.setAttribute("aria-hidden", String(d !== 0));
    });
    tabs.forEach((tab, j) => {
      const on = j === deckStep;
      tab.classList.toggle("on", on);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    $("step-next").textContent = deckStep === 2 ? "Back to step 1" : "Next step";
  }
  tabs.forEach((tab, j) => {
    tab.addEventListener("click", () => { deckStep = j; renderDeck(); });
    tab.addEventListener("keydown", event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      deckStep = (deckStep + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      renderDeck();
      tabs[deckStep].focus();
    });
  });
  $("step-next").addEventListener("click", () => { deckStep = (deckStep + 1) % 3; renderDeck(); });
  renderDeck();

  /* ---------- Privacy: show where my data goes ---------- */
  const flowSwitch = $("flow-switch");
  flowSwitch.addEventListener("click", () => {
    const on = flowSwitch.getAttribute("aria-checked") !== "true";
    flowSwitch.setAttribute("aria-checked", String(on));
    flowSwitch.classList.toggle("on", on);
    $("flow").hidden = !on;
    $("flow-msg").textContent = on ? "Your files stay on this device, start to finish." : "Flip it to trace the path your files take.";
  });

  /* RESULTS */
})();
