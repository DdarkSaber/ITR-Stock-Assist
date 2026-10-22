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

  /* ---------- Exact decimal helpers (engine values are decimal strings) ---------- */
  const SCALE = 1000000n;
  function dec(value) {
    if (value === null || value === undefined || value === "") return null;
    const m = /^\s*(-)?(\d*)(?:\.(\d*))?\s*$/.exec(String(value));
    if (!m || (m[2] === "" && !m[3])) return null;
    const frac = (m[3] || "").padEnd(7, "0");
    let micro = BigInt(m[2] || "0") * SCALE + BigInt(frac.slice(0, 6));
    if (+frac[6] >= 5) micro += 1n;
    return m[1] ? -micro : micro;
  }
  const inr = new Intl.NumberFormat("en-IN");
  function fmt(micro) {
    if (micro === null || micro === undefined) return "";
    const neg = micro < 0n;
    const paise = ((neg ? -micro : micro) + 5000n) / 10000n;
    const rupees = paise / 100n;
    const rest = String(paise % 100n).padStart(2, "0");
    return `${neg && paise !== 0n ? "-" : ""}${inr.format(rupees)}.${rest}`;
  }
  const sum = list => list.reduce((a, b) => a + b, 0n);

  /* ---------- Model built only from render(data) ---------- */
  const TERM_KEY = { STCG: "S", NON_EQUITY: "O", LTCG: "L" };
  function quarterOf(iso) {
    const md = Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
    if (md >= 401 && md <= 615) return 0;
    if (md >= 616 && md <= 915) return 1;
    if (md >= 916 && md <= 1215) return 2;
    if (md >= 316 && md <= 331) return 4;
    return 3;
  }
  function recordKey(file, sheet, row, lot) { return [file, sheet || "", String(row), lot].join("\u0001"); }
  function buildModel(data) {
    const byKey = new Map();
    for (const record of data.records) {
      byKey.set(recordKey(record.source_file, record.source_sheet, record.source_line, record.raw.lot_id), record);
    }
    const blank = () => ({ lots: 0, proceeds: 0n, cost: 0n, expenses: 0n, expMissing: false, pos: 0n, loss: 0n, net: 0n, provisional: false, periods: {}, q: [0n, 0n, 0n, 0n, 0n] });
    const T = { S: blank(), O: blank(), L: blank() };
    const accounts = new Map();
    for (const group of data.filing.groups) {
      const k = TERM_KEY[group.term];
      if (!k) continue;
      const t = T[k];
      t.lots += group.lots;
      t.proceeds += dec(group.proceeds) ?? 0n;
      t.cost += dec(group.cost) ?? 0n;
      if (group.expenses === null || group.expenses === undefined) t.expMissing = true;
      else t.expenses += dec(group.expenses) ?? 0n;
      t.pos += dec(group.positive_gains) ?? 0n;
      t.loss += dec(group.losses) ?? 0n;
      t.net += dec(group.net) ?? 0n;
      if (group.status === "PROVISIONAL") t.provisional = true;
      t.periods[group.period] = (t.periods[group.period] ?? 0n) + (dec(group.net) ?? 0n);
      const native = group.basis === "BROKER_REPORTED";
      for (const prov of group.provenance || []) {
        const record = byKey.get(recordKey(prov.file, prov.sheet, prov.row, prov.lot_id));
        if (!record) continue;
        const gain = dec(native ? record.broker_gain : record.gain) ?? 0n;
        if (record.raw.sell_date) t.q[quarterOf(record.raw.sell_date)] += gain;
        const broker = record.raw.broker || "Unknown broker";
        const aKey = `${broker}\u0001${record.source_file}`;
        if (!accounts.has(aKey)) accounts.set(aKey, { broker, file: record.source_file, S: 0n, O: 0n, L: 0n, n: 0 });
        const acct = accounts.get(aKey);
        acct[k] += gain;
        acct.n += 1;
      }
    }
    const status = {};
    for (const record of data.records) status[record.status] = (status[record.status] || 0) + 1;
    return { data, T, accounts: [...accounts.values()], status, brokers: new Set([...accounts.values()].map(a => a.broker)).size };
  }

  /* ---------- Form definitions (official ITR-2 AY 2026-27 numbering) ---------- */
  const HEAD = "FORM ITR-2 / AY 2026-27";
  const row = (num, text, f, ind, dim, nobox) => ({ t: "row", num, text, f, ind: ind || "", dim: !!dim, nobox: !!nobox });
  const A_HEAD = { t: "h", text: "A(I). Short-term Capital Gains (sub-items 3 and 4 are not applicable for residents)" };
  const B_HEAD = { t: "h", text: "B(I). Long-term capital gain (LTCG) (sub-items 4, 5, 6 and 7 are not applicable for residents)" };
  const NONE = "No lots observed for this group. That is not a verified zero: check your reports.";
  function periodNote(t, fy) {
    if (fy !== "2024-25") return "";
    const parts = Object.entries(t.periods).map(([p, v]) => `${p} ${fmt(v)}`);
    return parts.length ? ` AY 2025-26 keeps the 23 July 2024 split: ${parts.join(" / ")}.` : "";
  }
  function moneyFields(t, prefix) {
    const has = t.lots > 0;
    const v = x => (has ? fmt(x) : "");
    const exp = t.expMissing
      ? ["CHECK", "Not reported", "The broker report has no verified brokerage or charges. Confirm from contract notes; STT is not deductible."]
      : ["FILL", v(t.expenses), "Verified brokerage and charges. STT is not deductible."];
    const total = t.expMissing
      ? ["CHECK", v(t.cost), "Cost only, until transfer expenses are confirmed. The portal adds this up."]
      : ["AUTO", v(t.cost + t.expenses), "The portal adds this up; check it matches."];
    const netNote = t.provisional
      ? "Broker-reported net (PROVISIONAL). The portal computes the balance; it should match once costs and fees are verified."
      : "Should match your net gain for this item.";
    return { has, v, exp, total, netNote, prefix };
  }
  function buildForms(model) {
    const { T, data } = model;
    const S = T.S, O = T.O, L = T.L;
    const fy = data.fy;
    const skipIfNone = (t, field) => (t.lots > 0 ? field : [field[0], field[1], "SKIP", "", NONE]);

    const ms = moneyFields(S);
    const stcgFields = [
      ["2a", "Full value of consideration", "FILL", ms.v(S.proceeds), "Total sale value of all short-term equity lots, every account combined"],
      ["2b(i)", "Cost of acquisition without indexation", "FILL", ms.v(S.cost), "Total purchase cost of those lots"],
      ["2b(ii)", "Cost of Improvement without indexation", "SKIP", "", "Not applicable to shares or fund units"],
      ["2b(iii)", "Expenditure wholly and exclusively in connection with transfer", ...ms.exp],
      ["2b(iv)", "Total (i + ii + iii)", ...ms.total],
      ["2c", "Balance (2a - biv)", "AUTO", ms.v(S.net), ms.netNote],
      ["2d", "Loss to be disallowed u/s 94(7) or 94(8)", "CHECK", "Usually blank", "Only for dividend or bonus stripping; the Excel leaves it unknown"],
      ["2e", "Short-term capital gain on equity share or equity oriented MF (STT paid) (2c + 2d)", "AUTO", ms.v(S.net), "Carried into A9 and the set-off table E"],
    ].map(f => (f[2] === "SKIP" || f[0] === "2d" ? f : skipIfNone(S, f)));

    const mo = moneyFields(O);
    const otherFields = [
      ["5a(i)", "Full value of consideration in respect of unquoted shares (ia, ib, ic)", "SKIP", "", "Only for unquoted shares"],
      ["5a(ii)", "Full value of consideration in respect of assets other than unquoted shares", "FILL", mo.v(O.proceeds), "Total sale value of these non-equity lots, every account combined"],
      ["5a(iii)", "Total (ic + ii)", "AUTO", mo.v(O.proceeds), "The portal adds this up"],
      ["5b(i)", "Cost of acquisition without indexation", "FILL", mo.v(O.cost), "Total purchase cost of those lots"],
      ["5b(ii)", "Cost of Improvement without indexation", "SKIP", "", "Not applicable to fund units"],
      ["5b(iii)", "Expenditure wholly and exclusively in connection with transfer", ...mo.exp],
      ["5b(iv)", "Total (i + ii + iii)", ...mo.total],
      ["5c", "Balance (5aiii - biv)", "AUTO", mo.v(O.net), "Gains and losses inside this item net off here. " + mo.netNote],
      ["5d", "Loss to be disallowed u/s 94(7) or 94(8)", "CHECK", "Usually blank", "Only for dividend or bonus stripping"],
      ["5e", "Short-term capital gain on assets at A5 above (5c + 5d)", "AUTO", mo.v(O.net), "Taxed at your slab rate"],
    ].map(f => (f[2] === "SKIP" || f[0] === "5d" ? f : skipIfNone(O, f)));

    const ml = moneyFields(L);
    const be = fy === "2024-25";
    const ltcgFields = [
      ["1a", "Share/Unit acquired (on or before / after 31st Jan 2018)", "FILL", "After 31st Jan 2018", "Earlier buys need their own scrip-wise rows; the app blocks them"],
      ["1b", "Share/Unit transferred (before / on or after 23rd July 2024)", "CHECK", be ? "Split BE / AE" : "On or after 23 July 2024", be ? "AY 2025-26: keep before and on/after 23 July 2024 rows separate" : "On the notified form; dropped in the later schema. Pick this only if the portal asks"],
      ["2", "ISIN Code", "FILL", "INNOTREQUIRD", "Code for one consolidated row of post-January-2018 buys"],
      ["3", "Name of the Share/Unit", "FILL", "CONSOLIDATED", "Name for the consolidated row"],
      ["4", "No. of Shares/Units", "SKIP", "", "Left blank for a consolidated row"],
      ["5", "Sale price per Share/Unit", "SKIP", "", "Left blank for a consolidated row"],
      ["6", "Full Value of Consideration", "FILL", ml.v(L.proceeds), "Total sale value of all long-term equity lots, every account combined"],
      ["7", "Cost of acquisition without indexation", "AUTO", ml.v(L.cost), "Higher of 8 and 9; equals 8 for post-January-2018 buys"],
      ["8", "Cost of acquisition", "FILL", ml.v(L.cost), "Total purchase cost"],
      ["9", "If acquired before 01.02.2018, lower of 11 and 6", "SKIP", "", "Only for pre-February-2018 buys"],
      ["10", "Fair Market Value per share/unit as on 31st January 2018", "SKIP", "", "Left blank for a consolidated row"],
      ["11", "Total Fair Market Value of capital asset as per section 55(2)(ac)", "SKIP", "", "Only for pre-February-2018 buys"],
      ["12", "Expenditure wholly and exclusively in connection with transfer", ...ml.exp],
      ["13", "Total deductions (7 + 12)", ...ml.total],
      ["14", "Balance (6 - 13)", "AUTO", ml.v(L.net), "Flows into Schedule CG B(I) item 3. " + ml.netNote],
      ["B3a", "LTCG u/s 112A (column 14 of Schedule 112A)", "AUTO", ml.v(L.net), "Copied in from Schedule 112A"],
      ["B3b", "Deduction under section 54F", "SKIP", "", "Only if you reinvested in a house"],
      ["B3c", "Long-term capital gains on sale of capital assets at B3 above (3a - 3b)", "AUTO", ml.v(L.net), "The ₹1.25 lakh exemption is applied in the tax computation, not here"],
    ].map(f => (f[2] === "SKIP" || ["1a", "1b", "2", "3"].includes(f[0]) ? f : skipIfNone(L, f)));
    if (L.lots === 0) for (const f of ltcgFields) if (["1a", "1b", "2", "3"].includes(f[0])) { f[2] = "SKIP"; f[3] = ""; f[4] = NONE; }

    const side = t => (t.lots ? `+${fmt(t.pos)} / ${fmt(t.loss)}` : "");
    const sideNote = (label, t) => (t.lots ? `${label}: gains +${fmt(t.pos)}, losses ${fmt(t.loss)}, net ${fmt(t.net)}. Check the set-off the portal applies.` : NONE);
    const lossTotal = S.loss + O.loss + L.loss;
    const setoffFields = [
      ["i", "Capital loss to be set off", "CHECK", fmt(-lossTotal), "Total losses inside your items. The app does not compute set-off"],
      ["ii", "Gains taxable at 20% (STCG on shares, A2e)", S.lots ? "CHECK" : "SKIP", side(S), sideNote("111A", S)],
      ["iii", "Gains taxable at 30%", "SKIP", "", "Not used for listed shares, funds or ETFs"],
      ["iv", "Gains taxable at applicable rate (A5e)", O.lots ? "CHECK" : "SKIP", side(O), sideNote("A5", O)],
      ["v", "Gains taxable at DTAA rates", "SKIP", "", "Not used for residents"],
      ["vi", "Gains taxable at 12.50% (LTCG on shares, B3c)", L.lots ? "CHECK" : "SKIP", side(L), sideNote("112A", L)],
      ["vii", "Gains at DTAA rates", "SKIP", "", "Not used for residents"],
      ["viii", "Total loss set off (ii + iii + iv + v + vi + vii)", "CHECK", "Portal computes", "Not computed by the app"],
      ["ix", "Loss remaining after set off (i - viii)", "CHECK", "Portal computes", "Carried forward only if positive"],
    ];

    const Q = ["(i) upto 15/6", "(ii) 16/6 to 15/9", "(iii) 16/9 to 15/12", "(iv) 16/12 to 15/3", "(v) 16/3 to 31/3"];
    const qf = (num, label, v, i) => {
      const act = v > 0n ? "FILL" : v < 0n ? "CHECK" : "SKIP";
      return [num + Q[i].split(" ")[0], `${label} ${Q[i].slice(Q[i].indexOf(" ") + 1)}`, act, v === 0n ? "" : fmt(v),
        act === "FILL" ? "Gain from your sales in this quarter" : act === "CHECK" ? "A net loss in this quarter; set it off before entering" : "No net gain from sales in this quarter"];
    };
    const tf = [];
    S.q.forEach((v, i) => tf.push(qf("1", "STCG taxable at 20%", v, i)));
    tf.push(["2", "STCG taxable at 30%", "SKIP", "", "Not used for listed shares, funds or ETFs"]);
    O.q.forEach((v, i) => tf.push(qf("3", "STCG at applicable rates", v, i)));
    tf.push(["4", "STCG taxable at DTAA rates", "SKIP", "", "Not used for residents"]);
    L.q.forEach((v, i) => tf.push(qf("5", "LTCG taxable at 12.5%", v, i)));
    tf.push(["6", "LTCG taxable at DTAA rates", "SKIP", "", "Not used for residents"]);
    tf.push(["7", "Virtual Digital Assets at 30%", "SKIP", "", "Not applicable"]);

    const status = t => (t.lots ? (t.provisional ? " Status: PROVISIONAL broker figures; verify before filing." : " Status: READY_WORKING from attested lots.") : "");
    const titleVal = t => (t.lots ? `₹${fmt(t.net)}` : "no lots");
    return {
      stcg: {
        kicker: "SCHEDULE CG / A(I) ITEM 2 / SECTION 111A", title: `Short-term gains on shares: ${titleVal(S)}`,
        sub: "Listed shares and equity funds with STT paid, held 12 months or less. Taxed at 20%. One entry for all your accounts combined." + status(S) + periodNote(S, fy),
        formTitle: "Schedule CG, item A2", fields: stcgFields,
        pages: [
          { left: HEAD, right: "Schedule Capital Gains / page 1", items: [
            { t: "title", text: "Schedule Capital Gains" }, A_HEAD,
            row("1", "From sale of land or building or both", -1, "", true, true),
            row("2", "From sale of equity share or unit of equity oriented Mutual Fund (MF) or unit of a business trust on which STT is paid under section 111A or 115AD(1)(ii) proviso (for FII)", -1, "", false, true),
            row("a", "Full value of consideration", 0, "ind1"),
            row("b", "Deductions under section 48", -1, "ind1", false, true),
            row("i", "Cost of acquisition without indexation", 1, "ind2"),
            row("ii", "Cost of Improvement without indexation", 2, "ind2"),
            row("iii", "Expenditure wholly and exclusively in connection with transfer", 3, "ind2"),
            row("iv", "Total (i + ii + iii)", 4, "ind2"),
            row("c", "Balance (2a - biv)", 5, "ind1"),
            row("d", "Loss to be disallowed u/s 94(7) or 94(8)", 6, "ind1"),
            row("e", "Short-term capital gain on equity share or equity oriented MF (STT paid) (2c + 2d)", 7, "ind1"),
            row("3, 4", "For non-residents only", -1, "", true, true),
            row("5", "From sale of assets other than at A1 or A2 or A3 or A4 above (see the Other STCG card)", -1, "", true, true),
            row("6 - 9", "Deemed STCG, pass-through income, DTAA items, Total STCG (A9)", -1, "", true, true),
          ] },
          { left: HEAD, right: "Schedule Capital Gains / page 2", items: [
            B_HEAD,
            { t: "note", text: "Item 3 receives your Schedule 112A total automatically. See the LTCG card." },
            { t: "h", text: "C1. Sum of Capital Gain Incomes / C2. Virtual Digital Assets / C3. Income chargeable under the head Capital Gains" },
            { t: "note", text: "Calculated by the portal from table E." },
            { t: "h", text: "D. Information about deduction claimed against Capital Gains" },
            { t: "note", text: "Only for sections 54 / 54B / 54EC / 54F / 115F, such as reinvesting in a house. Usually skipped for share trading." },
            { t: "h", text: "E. Set-off of current year capital losses with current year capital gains" },
            { t: "note", text: "See the Set-off card." },
            { t: "h", text: "F. Information about accrual/receipt of capital gain" },
            { t: "note", text: "See the Quarter breakup card." },
          ] },
        ],
        footer: "Gold or silver funds, debt funds and non-equity ETFs do not go here. They go in item A5 (Other STCG card).",
      },
      other: {
        kicker: "SCHEDULE CG / A(I) ITEM 5 / SLAB RATE", title: `Other short-term gains: ${titleVal(O)}`,
        sub: "Gold and silver fund-of-funds, non-equity ETFs and other non-equity funds held for a short period. Taxed at your slab rate, not 20%. Confirm the treatment with your adviser." + status(O) + periodNote(O, fy),
        formTitle: "Schedule CG, item A5", fields: otherFields,
        pages: [
          { left: HEAD, right: "Schedule Capital Gains / page 1", items: [
            { t: "title", text: "Schedule Capital Gains" }, A_HEAD,
            row("1 - 4", "Land or building, equity under 111A (STCG card), non-resident items", -1, "", true, true),
            row("5", "From sale of assets other than at A1 or A2 or A3 or A4 above", -1, "", false, true),
            row("a", "Full value of consideration", -1, "ind1", false, true),
            row("i", "In case assets sold include unquoted shares (ia, ib, ic)", 0, "ind2"),
            row("ii", "Full value of consideration in respect of assets other than unquoted shares", 1, "ind2"),
            row("iii", "Total (ic + ii)", 2, "ind2"),
            row("b", "Deductions under section 48", -1, "ind1", false, true),
            row("i", "Cost of acquisition without indexation", 3, "ind2"),
            row("ii", "Cost of Improvement without indexation", 4, "ind2"),
            row("iii", "Expenditure wholly and exclusively in connection with transfer", 5, "ind2"),
            row("iv", "Total (i + ii + iii)", 6, "ind2"),
            row("c", "Balance (5aiii - biv)", 7, "ind1"),
            row("d", "Loss to be disallowed u/s 94(7) or 94(8)", 8, "ind1"),
            row("e", "STCG on assets at A5 above (5c + 5d)", 9, "ind1"),
          ] },
        ],
        footer: "These broker-reported non-equity lots stay outside the equity working-paper totals, but they still have to be reported here.",
      },
      ltcg: {
        kicker: "SCHEDULE 112A AND SCHEDULE CG B(I) ITEM 3", title: `Long-term gains on shares: ${titleVal(L)}`,
        sub: "Listed shares and equity funds with STT paid, held over 12 months. One consolidated row covers every post-January-2018 buy from all your accounts." + status(L) + periodNote(L, fy),
        formTitle: "Schedule 112A", fields: ltcgFields,
        pages: [
          { left: HEAD, right: "Schedule 112A / page 1", items: [
            { t: "title", text: "Schedule 112A" },
            { t: "note", text: "From sale of equity share in a company or unit of equity oriented fund or unit of a business trust on which STT is paid. One row per entry, columns shown top to bottom." },
            { t: "h", text: "Row 1" },
            row("1a", "Share/Unit acquired (on or before / after 31st Jan 2018)", 0),
            row("1b", "Share/Unit transferred (before / on or after 23rd July 2024)", 1),
            row("2", "ISIN Code", 2), row("3", "Name of the Share/Unit", 3), row("4", "No. of Shares/Units", 4),
            row("5", "Sale price per Share/Unit", 5), row("6", "Full Value of Consideration", 6),
            row("7", "Cost of acquisition without indexation (higher of 8 and 9)", 7),
          ] },
          { left: HEAD, right: "Schedule 112A / page 2", items: [
            { t: "h", text: "Row 1 (continued)" },
            row("8", "Cost of acquisition", 8),
            row("9", "If the long-term capital asset was acquired before 01.02.2018, lower of 11 and 6", 9),
            row("10", "Fair Market Value per share/unit as on 31st January 2018", 10),
            row("11", "Total Fair Market Value of capital asset as per section 55(2)(ac)", 11),
            row("12", "Expenditure wholly and exclusively in connection with transfer", 12),
            row("13", "Total deductions (7 + 12)", 13), row("14", "Balance (6 - 13)", 14),
          ] },
          { left: HEAD, right: "Schedule Capital Gains / B(I)", items: [
            B_HEAD,
            row("1, 2", "Land or building; listed securities other than units u/s 112(1)", -1, "", true, true),
            row("3", "From sale of equity share in a company or unit of equity oriented fund or unit of a business trust on which STT is paid under section 112A", -1, "", false, true),
            row("a", "LTCG u/s 112A (column 14 of Schedule 112A)", 15, "ind1"),
            row("b", "Deduction under section 54F", 16, "ind1"),
            row("c", "Long-term capital gains on sale of capital assets at B3 above (3a - 3b)", 17, "ind1"),
            row("4 - 12", "Non-resident items, other assets, deemed LTCG, pass-through, DTAA, Total LTCG (B12)", -1, "", true, true),
          ] },
        ],
        footer: "Bought before 1 Feb 2018? Each such holding needs its own row. The app blocks those lots for review.",
      },
      setoff: {
        kicker: "SCHEDULE CG / E", title: "Set-off of losses (table E)",
        sub: "Your gains and losses side by side, item by item. The app does not compute set-off, so every row here is CHECK: compare with what the portal fills from A and B.",
        formTitle: "Schedule CG, item E", fields: setoffFields,
        pages: [
          { left: HEAD, right: "Schedule Capital Gains / E", items: [
            { t: "title", text: "E. Set-off of current year capital losses with current year capital gains" },
            { t: "note", text: "Columns: 1 Type of capital gain, 2 Capital gain of current year, 3 to 6 Short-term capital loss at 20% / 30% / applicable rate / DTAA rates, 7 Long-term capital loss at 12.50% and DTAA rates, 8 Current year capital gains remaining after set off." },
            row("i", "Capital loss to be set off", 0),
            row("ii", "20%", 1), row("iii", "30%", 2), row("iv", "Applicable rate", 3), row("v", "DTAA rates", 4),
            row("vi", "12.50%", 5), row("vii", "DTAA rates", 6),
            row("viii", "Total loss set off (ii + iii + iv + v + vi + vii)", 7),
            row("ix", "Loss remaining after set off (i - viii)", 8),
          ] },
        ],
        footer: "Short-term losses can be set against short- or long-term gains; long-term losses only against long-term gains. The portal applies this.",
      },
      tablef: {
        kicker: "SCHEDULE CG / F", title: "Quarter breakup (table F)",
        sub: "Which quarter each gain arose in, by sale date. Shares short-term go in row 1 (20%), other short-term in row 3 (applicable rates), shares long-term in row 5 (12.5%).",
        formTitle: "Schedule CG, item F", fields: tf,
        pages: [
          { left: HEAD, right: "Schedule Capital Gains / F", items: [
            { t: "title", text: "F. Information about accrual/receipt of capital gain" },
            { t: "grid" },
            { t: "note", text: "Raw gains by sale date from your lots. If you have losses to set off, adjust first; the app does not compute final Table F figures." },
          ] },
        ],
        footer: "Raw gains by sale date. If you have losses to set off, adjust first; the app does not compute final Table F figures.",
      },
    };
  }
  const GRID = [
    { label: "1  Short-term capital gains taxable at the rate of 20%", fs: [0, 1, 2, 3, 4] },
    { label: "2  Short-term capital gains taxable at the rate of 30%", fs: [5, 5, 5, 5, 5] },
    { label: "3  Short-term capital gains taxable at applicable rates", fs: [6, 7, 8, 9, 10] },
    { label: "4  Short-term capital gains taxable at DTAA rates", fs: [11, 11, 11, 11, 11] },
    { label: "5  Long-term capital gains taxable at the rate of 12.5%", fs: [12, 13, 14, 15, 16] },
    { label: "6  Long-term capital gains taxable at DTAA rates", fs: [17, 17, 17, 17, 17] },
    { label: "7  Capital gains on transfer of Virtual Digital Asset taxable at 30%", fs: [18, 18, 18, 18, 18] },
  ];

  /* ---------- Forms ring ---------- */
  let model = null;
  let forms = null;
  const formsRing = new Ring(qs('[data-ring="forms"]'), (i, card) => {
    const kind = card.dataset.card;
    if (kind === "excel") { if (!$("export").disabled) $("export").click(); return; }
    openDialog(kind, card);
  });
  function setSlot(name, text) {
    const slot = qs(`.forms-ring [data-slot="${name}"]`);
    if (slot) slot.textContent = text;
  }
  function renderForms(data) {
    model = buildModel(data);
    forms = buildForms(model);
    const { T } = model;
    const money = t => (t.lots ? fmt(t.net) : "No lots");
    setSlot("stcg", T.S.lots ? `₹${fmt(T.S.net)}` : "no lots");
    setSlot("other", T.O.lots ? `₹${fmt(T.O.net)}` : "no lots");
    setSlot("ltcg", T.L.lots ? `₹${fmt(T.L.net)}` : "no lots");
    const n = model.accounts.length;
    setSlot("accounts", `${n} ${n === 1 ? "file" : "files"} / ${model.brokers} ${model.brokers === 1 ? "broker" : "brokers"}`);
    setSlot("lots", `${data.records.length} ${data.records.length === 1 ? "lot" : "lots"}`);
    $("kpi-stcg").textContent = money(T.S);
    $("kpi-ltcg").textContent = money(T.L);
    $("kpi-other").textContent = money(T.O);
    $("forms-fy").textContent = `FY ${data.fy} / AY ${data.ay}`;
    const seen = new Set();
    $("forms-files").replaceChildren(...data.imports.filter(item => !seen.has(item.source_file) && seen.add(item.source_file)).map(item => {
      const pill = el("span", "pill");
      pill.append(svgIcon(["M5 12l5 5 9-11"], "ic-sm c-a2"), document.createTextNode(item.source_file));
      return pill;
    }));
    requestAnimationFrame(() => {
      formsRing.layout();
      formsRing.go(0, true);
      const target = $("results");
      if (target.getBoundingClientRect().top > window.innerHeight * 0.6) {
        target.scrollIntoView({ behavior: isReduced() ? "auto" : "smooth", block: "start" });
      }
    });
  }
  function clearForms() {
    closeDialog(false);
    model = null;
    forms = null;
    for (const slot of qsa(".forms-ring [data-slot]")) slot.textContent = "";
    for (const id of ["kpi-stcg", "kpi-ltcg", "kpi-other", "forms-fy"]) $(id).textContent = "";
    $("forms-files").replaceChildren();
  }
  document.addEventListener("itr:render", event => renderForms(event.detail));
  document.addEventListener("itr:clear", clearForms);

  /* ---------- Dialog: paper form (left) + your values (right) ---------- */
  const overlay = $("dlg-overlay");
  const dialog = qs(".dlg", overlay);
  const paperbox = $("paperbox");
  const listbox = $("listbox");
  const ORDER = ["stcg", "other", "ltcg", "setoff", "tablef", "accounts", "lots"];
  const NAMES = { stcg: "STCG (A2, 111A)", other: "Other STCG (A5)", ltcg: "LTCG (112A)", setoff: "Set-off (E)", tablef: "Quarter breakup (F)", accounts: "Your accounts", lots: "Your lots" };
  const INFO = {
    accounts: { kicker: "BY ACCOUNT", title: "Your accounts", sub: "Totals for each broker and file. The ITR has no per-account rows, so only the combined row goes in." },
    lots: { kicker: "EVERY SALE", title: "Your lots", sub: "Every disposed lot from your files, by review status. The full table with source rows is on the page below." },
  };
  const dlg = { kind: null, opener: null, step: 0, play: false, onlyFill: false };

  function visibleFields() {
    const all = forms[dlg.kind].fields.map((x, i) => ({ x, i }));
    if (!dlg.onlyFill) return all;
    const some = all.filter(o => o.x[2] === "FILL" || o.x[2] === "CHECK");
    return some.length ? some : all;
  }
  function buildPaper(form) {
    const isSkip = f => form.fields[f] && form.fields[f][2] === "SKIP";
    paperbox.replaceChildren(...form.pages.map(pg => {
      const page = el("div", "page");
      const head = el("div", "pghead");
      head.append(el("span", null, pg.left), el("span", null, pg.right));
      page.append(head);
      for (const it of pg.items) {
        if (it.t === "title") page.append(el("div", "ptitle", it.text));
        else if (it.t === "h") page.append(el("div", "ph", it.text));
        else if (it.t === "note") page.append(el("div", "pnote", it.text));
        else if (it.t === "row") {
          const r = el("div", `prow${it.dim ? " dim" : ""}`);
          r.dataset.f = String(it.f);
          const box = el("span", `pbox${it.nobox ? " nobox" : isSkip(it.f) ? " skipbox" : ""}`);
          r.append(el("span", "pnum", it.num), el("span", `plabel ${it.ind}`.trim(), it.text), box);
          page.append(r);
        } else if (it.t === "grid") {
          const wrap = el("div", "ftable-wrap");
          const table = el("table", "ftable");
          const thead = el("thead");
          const tr = el("tr");
          for (const h of ["Type of capital gain / Date", "Upto 15/6 (i)", "16/6 to 15/9 (ii)", "16/9 to 15/12 (iii)", "16/12 to 15/3 (iv)", "16/3 to 31/3 (v)"]) tr.append(el("th", null, h));
          thead.append(tr);
          const tbody = el("tbody");
          for (const g of GRID) {
            const gr = el("tr");
            gr.dataset.fs = g.fs.join(",");
            gr.append(el("td", null, g.label));
            for (const f of g.fs) {
              const td = el("td", isSkip(f) ? "skipbox" : "");
              td.dataset.f = String(f);
              gr.append(td);
            }
            tbody.append(gr);
          }
          table.append(thead, tbody);
          wrap.append(table);
          page.append(wrap);
        }
      }
      return page;
    }));
  }
  function buildList() {
    const vis = visibleFields();
    listbox.replaceChildren(...vis.map((o, k) => {
      const [letter, label, act, mine, note] = o.x;
      const button = el("button", `fl${act === "SKIP" ? " dim" : ""}`);
      button.type = "button";
      button.id = `gl-${k}`;
      const text = el("span", "fl-text");
      text.append(el("span", "fl-label", label), el("span", "fl-note", note));
      const right = el("span", "fl-right");
      const valCls = act === "FILL" ? "st-ok" : act === "CHECK" ? "st-warn" : "st-mut";
      right.append(el("span", `tag act-${act}`, act), el("span", `fl-val ${valCls}`, act === "SKIP" ? "—" : (mine || "—")));
      button.append(el("span", "letter", letter), text, right);
      button.addEventListener("click", () => { dlg.play = false; setStep(k); });
      return button;
    }));
  }
  function scrollInto(box, target, center) {
    if (!box || !target) return;
    const br = box.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    box.scrollTo({
      top: Math.max(0, tr.top - br.top + box.scrollTop - box.clientHeight * 0.32),
      left: center ? Math.max(0, tr.left - br.left + box.scrollLeft - 60) : box.scrollLeft,
      behavior: isReduced() ? "auto" : "smooth",
    });
  }
  function setStep(k) {
    const vis = visibleFields();
    dlg.step = Math.max(0, Math.min(k, vis.length - 1));
    const active = vis[dlg.step].i;
    qsa(".fl", listbox).forEach((button, j) => {
      const on = j === dlg.step;
      button.classList.toggle("on", on);
      if (on) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
    });
    $("walk-count").textContent = `Field ${dlg.step + 1} of ${vis.length}`;
    $("walk-prog").style.width = `${Math.round((dlg.step + 1) / vis.length * 100)}%`;
    for (const node of qsa(".hl, .rowon", paperbox)) node.classList.remove("hl", "rowon");
    const target = qs(`[data-f="${active}"]`, paperbox);
    if (target) {
      target.classList.add("hl");
      const gridRow = target.closest("tr[data-fs]");
      if (gridRow) gridRow.classList.add("rowon");
    }
    const current = vis[dlg.step].x;
    paperbox.setAttribute("aria-label", `Recreated ${forms[dlg.kind].formTitle} form, current field ${current[0]}: ${current[1]}`);
    renderPlay();
    scrollInto(paperbox, target, true);
    const gridWrap = target && target.closest(".ftable-wrap");
    if (gridWrap) scrollInto(gridWrap, target, true);
    scrollInto(listbox, $(`gl-${dlg.step}`), false);
  }
  function renderPlay() {
    const button = $("walk-play");
    button.classList.toggle("is-paused", !dlg.play);
    button.setAttribute("aria-label", dlg.play ? "Pause walkthrough" : "Play walkthrough");
  }
  function setOnlyFill(on) {
    dlg.onlyFill = on;
    $("seg-all").classList.toggle("on", !on);
    $("seg-fill").classList.toggle("on", on);
    $("seg-all").setAttribute("aria-pressed", String(!on));
    $("seg-fill").setAttribute("aria-pressed", String(on));
    dlg.play = !isReduced();
    buildList();
    setStep(0);
  }
  function infoTable(caption, heads, rows) {
    const scroll = el("div", "table-scroll");
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", caption);
    const table = el("table", "tbl");
    table.append(el("caption", null, caption));
    const thead = el("thead");
    const htr = el("tr");
    heads.forEach(([h, right]) => htr.append(el("th", right ? "r" : "", h)));
    thead.append(htr);
    const tbody = el("tbody");
    for (const cells of rows) {
      const tr = el("tr", cells.cls || "");
      for (const cell of cells) {
        const td = el("td", cell.cls || "");
        if (cell.main !== undefined) {
          td.append(el("span", null, cell.main));
          if (cell.small) td.append(el("small", null, cell.small));
        } else td.textContent = cell.text;
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    scroll.append(table);
    return scroll;
  }
  function buildInfo(kind) {
    const box = $("dlg-info");
    const { T } = model;
    const money = (v, has) => ({ text: has ? fmt(v) : "—", cls: `r${v < 0n ? " st-bad" : ""}` });
    if (kind === "accounts") {
      const rows = model.accounts.map(a => [
        { main: a.broker, small: a.file },
        money(a.S, T.S.lots), money(a.O, T.O.lots), money(a.L, T.L.lots), { text: String(a.n), cls: "r" },
      ]);
      const total = [{ text: "Combined, goes in the ITR" }, money(T.S.net, T.S.lots), money(T.O.net, T.O.lots), money(T.L.net, T.L.lots), { text: String(T.S.lots + T.O.lots + T.L.lots), cls: "r" }];
      total.cls = "total";
      rows.push(total);
      box.replaceChildren(infoTable(
        "For checking against each broker. Lots in a filing group only; the ITR takes the combined row.",
        [["ACCOUNT / FILE"], ["STCG 111A / INR", true], ["OTHER STCG / INR", true], ["LTCG 112A / INR", true], ["LOTS", true]],
        rows,
      ));
      if (!model.accounts.length) box.append(el("p", "notice", "No lots entered a filing group, so there is nothing to split by account. See the lots table below."));
    } else {
      const grid = el("div", "status-grid");
      const meanings = {
        INCLUDED: "Attested canonical lots in the working-paper totals",
        REVIEW_REQUIRED: "Broker-reported; in the provisional broker summary",
        BLOCKED: "Excluded until the listed issues are resolved",
      };
      const statuses = Object.keys(model.status).sort();
      for (const status of statuses.length ? statuses : ["INCLUDED"]) {
        const card = el("div", "kpi");
        card.append(el("div", "mono kpi-label", status), el("div", "mono kpi-val", String(model.status[status] || 0)), el("small", null, meanings[status] || "See review notes"));
        grid.append(card);
      }
      const go = el("button", "btn btn-main", "Go to the lots table");
      go.type = "button";
      go.addEventListener("click", () => {
        closeDialog(false);
        $("lots-panel").scrollIntoView({ behavior: isReduced() ? "auto" : "smooth", block: "start" });
        const scroll = qs(".table-scroll", $("lots-panel"));
        if (scroll) scroll.focus({ preventScroll: true });
      });
      const row = el("div", "btn-row");
      row.append(go);
      box.replaceChildren(el("p", "muted", `${model.data.records.length} disposed lots across ${model.data.imports.length} imported ${model.data.imports.length === 1 ? "sheet" : "sheets"}. The table below lists the first 200; the workbook keeps every row.`), grid, row);
    }
  }
  function openDialog(kind, card) {
    if (!forms || !model) return;
    const form = forms[kind];
    const meta = form || INFO[kind];
    if (!meta) return;
    if (card) dlg.opener = qs(".cardbtn", card);
    dlg.kind = kind;
    $("dlg-kicker").textContent = `ITR-2 / AY ${model.data.ay} / ${meta.kicker}`;
    $("dlg-title").textContent = meta.title;
    $("dlg-sub").textContent = meta.sub;
    $("dlg-form").hidden = !form;
    $("dlg-info").hidden = !!form;
    const next = ORDER[(ORDER.indexOf(kind) + 1) % ORDER.length];
    $("dlg-next").textContent = `Next: ${NAMES[next]}`;
    $("dlg-next").dataset.next = next;
    const wasOpen = !overlay.hidden;
    overlay.hidden = false;
    document.body.classList.add("dlg-open");
    formsRing.blocked = true;
    if (form) {
      $("dlg-footer").textContent = form.footer;
      buildPaper(form);
      dlg.onlyFill = false;
      $("seg-all").classList.add("on");
      $("seg-fill").classList.remove("on");
      $("seg-all").setAttribute("aria-pressed", "true");
      $("seg-fill").setAttribute("aria-pressed", "false");
      dlg.play = !isReduced();
      buildList();
      paperbox.scrollTop = 0;
      listbox.scrollTop = 0;
      requestAnimationFrame(() => setStep(0));
    } else {
      dlg.play = false;
      buildInfo(kind);
    }
    overlay.scrollTop = 0;
    if (!wasOpen) setTimeout(() => $("dlg-close").focus({ preventScroll: true }), 60);
  }
  function closeDialog(restoreFocus = true) {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("dlg-open");
    formsRing.blocked = false;
    dlg.play = false;
    dlg.kind = null;
    paperbox.replaceChildren();
    listbox.replaceChildren();
    $("dlg-info").replaceChildren();
    if (restoreFocus && dlg.opener && dlg.opener.isConnected) dlg.opener.focus({ preventScroll: true });
  }
  setInterval(() => {
    if (overlay.hidden || !dlg.kind || !forms || !forms[dlg.kind] || !dlg.play) return;
    const n = visibleFields().length;
    if (dlg.step < n - 1) setStep(dlg.step + 1);
    else { dlg.play = false; renderPlay(); }
  }, 2100);
  $("dlg-close").addEventListener("click", () => closeDialog());
  overlay.addEventListener("click", event => { if (event.target === overlay) closeDialog(); });
  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
    if (event.key !== "Tab") return;
    const focusable = qsa('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"]), select, input', dialog)
      .filter(node => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  const pauseOnUser = () => { if (dlg.play) { dlg.play = false; renderPlay(); } };
  paperbox.addEventListener("wheel", pauseOnUser, { passive: true });
  paperbox.addEventListener("touchstart", pauseOnUser, { passive: true });
  $("walk-play").addEventListener("click", () => {
    const n = visibleFields().length;
    if (!dlg.play && dlg.step >= n - 1) { dlg.play = true; setStep(0); return; }
    dlg.play = !dlg.play;
    renderPlay();
  });
  $("walk-prev").addEventListener("click", () => { dlg.play = false; setStep(dlg.step - 1); });
  $("walk-next").addEventListener("click", () => { dlg.play = false; setStep(dlg.step + 1); });
  $("seg-all").addEventListener("click", () => setOnlyFill(false));
  $("seg-fill").addEventListener("click", () => setOnlyFill(true));
  $("dlg-next").addEventListener("click", event => openDialog(event.currentTarget.dataset.next));
})();
