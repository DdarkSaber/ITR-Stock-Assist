# Handover prompt — ITR Stock Assist UI build (paste into a new chat / Claude Code)

You are working in `F:\Dev\MyWorkspace\ITR-Stock-Assist` on branch **`fix/review-2026-10-22`** (do NOT merge, do NOT touch `main`).
Task: port the **approved prototype UI exactly** into the real app, fully responsive, with zero regressions.

## 0. Before anything
```
git status                      # must be clean, on fix/review-2026-10-22
git checkout -b ui/redesign-2026-10   # work on a child branch
pytest -q -m "not browser"      # baseline: 92 passed
pytest -q -m browser            # baseline: 1 passed (needs cdn.jsdelivr.net)
```
Commit in small steps (markup → css → ui.js → forms ring → overlay). Run both suites after each step.

## 1. Design source (the "exact UI")
All in `design-reference/` (copied from the approved prototype — read them first):
- `Main.prototype.html` — the full approved page (design-canvas format: `{{holes}}`, `sc-for`, `sc-if`, a `Component` class). **Do not ship this file.** Port its markup/CSS/behaviour to plain HTML + `web/style.css` + a new `web/ui.js`.
- `p4_forms.html` — results page, 8-card forms ring.
- `p4_overlay.html` — form overlay (paper form left, "Your values" right).
- `p4_js.js`, `p6_data.js` — ring logic, sync logic, form definitions (fields `[letter,label,act,mine,note]`, pages `{left,right,items}`). **Demo numbers in these files (ITR_DEMO_LOTS) must never appear in the app** — replace with real data from `render(data)`.
- `p5_css.css` — paper-form CSS (.paperbox .page .pghead .prow .pnum .plabel .pbox .ftable .listbox).
- `ribbons.png`, `contours.png` — white alpha masks tinted via CSS `mask-image` + gradient. Move to `web/assets/`.

### Page 1 — Home (before upload)
1. Hero with the **6-card rotating 3D ring** (LTCG, STCG, Multiple accounts, Source trace, Working paper, ITR walkthrough). Info cards only — clicking rotates to front / shows info panel; **no popups/overlays on home**.
   - Orb billboarded above front card; halo uses `scaleY(.22)` (NOT rotateX — causes dark patch).
   - Drag to rotate (pointer capture only after 6px so clicks still work), auto-rotate 3.6s, pause on hover/focus, shortest-path `go(i)`, `idx = ((round(-angle/step) % n)+n)%n`.
2. Upload panel — restyle existing elements, keep IDs: `#fy #files #file-summary #sample #review #reset #status #error`. Explain which documents to upload (Groww Stock CG XLSX, Groww MF CG XLSX, canonical CSV; multiple accounts allowed; not P&L).
3. Holding lab (illustrative, pure JS, mirrors core rule: LTCG if sale ≥ anniversary of purchase).
4. "How it works" 3D step deck (opaque cards: `linear-gradient(var(--panel),var(--panel)),var(--bg)`).
5. Privacy "Show where my data goes" toggle.
6. Themes `.t-aurora/.t-ember/.t-glacier` via CSS vars `--bg --panel --panel2 --ink --mut --line --a1 --a2 --a3 --on --warn`.

### Page 2 — "Your forms" (only after Review succeeds; shown inside `#results`)
- **8-card ring**: A2 STCG 111A · A5 Other STCG (slab) · 112A + B3 LTCG · E set-off · F quarters · Excel · Accounts · Lots.
- Clicking side card → rotates to front; clicking front card → opens overlay. Excel card triggers existing `#export` click.
- **Overlay** (`role="dialog" aria-modal="true"`): left = static paper recreation of the official form, page by page with official numbering, auto-scroll synced to the right list and highlighting the current field (2.1s step); manual wheel/touch on paper pauses autoplay. Optional "My portal screenshots" slot (multiple images via `<input type=file accept=image/*>` → `URL.createObjectURL`, in-memory only; `img-src 'self'` does NOT allow blob: → **flag to user** before adding `blob:` to img-src, else skip this slot). Right = "Your values": FILL / SKIP / AUTO / CHECK tags with real values + "Only what I fill" toggle. Esc / click-outside closes; focus to close button on open, back to card on close.
- Keep existing tables/KPIs below the ring (restyled): `#review-state #intraday-warning #dividend-info #manifest #filing-year #filing-groups #broker-summary #broker-stcg #broker-ltcg #broker-count #stcg #ltcg #included #blocked #lots #export`.

### Card → real data mapping (from `render(data)` only)
- A2: `data.filing.groups` where term=STCG (111A). A5: term=`NON_EQUITY` (schedule text "Non-equity (Schedule CG A5, slab rate)"). 112A/B3: term=LTCG. Use proceeds/cost/expenses(null → "Not reported")/positive_gains/losses/net/status/period.
- E set-off: show STCG/LTCG positives & losses side by side; app does NOT compute set-off → mark CHECK.
- F quarters: bucket `data.records` (included or broker_summary_included) by `raw.sell_date` into Upto 15/6, 16/6–15/9, 16/9–15/12, 16/12–15/3, 16/3–31/3.
- Accounts: group records by `raw.broker` (+ source_file). Lots: count/status summary, link to `#lots` table.
- FY 2024-25: show BE/AE split note (`data.filing.year_note`). FY 2025-26 = FULL_FY.
- Expected real FY 2025-26 values (user's own reports, verify locally only): 111A STCG **32,264.78**; 112A LTCG **1,499.79**; A5 non-equity STCG **16,635.14**; dividends **8,577.47** (Schedule OS, not in CG totals); intraday warning visible.

### Official ITR-2 AY 2026-27 structure (for the paper forms)
- CG A(I): A1 land/building; **A2** 111A rows 2a, 2b(i)–(iv), 2c, 2d, 2e; A3/A4 non-resident (N/A residents); **A5** other assets 5a(i)(ia/ib/ic), 5a(ii), 5a(iii), 5b(i)–(iv), 5c, 5d, 5e; A6–A9.
- B(I): **B3** 112A — 3a (col 14 of Sch 112A), 3b 54F, 3c; B8 other; B12 total. C, D (54/54B/54EC/54F/115F).
- **E** set-off: cols 1 Type, 2 current-year gain, 3–6 STCL 20%/30%/applicable/DTAA, 7 LTCL 12.5%+DTAA, 8 remaining; rows i–ix.
- **F**: rows 1 STCG 20%, 2 30%, 3 applicable, 4 DTAA, 5 LTCG 12.5%, 6 DTAA, 7 VDA; 5 quarter columns.
- **Sch 112A** cols: 1a, 1b (CHECK), 2 ISIN, 3 Name, 4 shares, 5 price, 6 FVC, 7 cost (higher of 8,9), 8 COA, 9 lower of 11 & 6, 10 FMV/share 31-Jan-2018, 11 total FMV, 12 expenditure, 13 = 7+12, 14 = 6−13. Post-Jan-2018 consolidated: 2=INNOTREQUIRD, 3=CONSOLIDATED.

## 2. RESPONSIVE — no hard-coded sizes (phone, tablet, laptop, 27"/29" ultrawide/32")
- Use `clamp()`, `min()/max()`, `rem`, `vw/vh/svh/dvh`, `%`, CSS grid `auto-fit minmax()`, container queries (`container-type: inline-size`) — no fixed px widths for layout.
- Ring: card size `--card-w: clamp(150px, 16vw, 260px)`, `--card-h: calc(var(--card-w)*1.3)`; radius computed in ui.js from container width: `r = (cardW/2)/Math.tan(Math.PI/n) * 1.15`, written as CSS var via `el.style.setProperty('--r', r+'px')` (CSSOM is CSP-safe); recompute on `ResizeObserver`. Perspective as `calc(var(--r)*4)`.
- Page max width `min(100% - 2rem, 1600px)`; on ≥2200px (32"/ultrawide) widen to `min(92vw, 2000px)` and scale type with `clamp(1rem, .9rem + .3vw, 1.35rem)`.
- Phone (<640px): ring becomes flat swipe carousel (scroll-snap) or smaller ring with reduced tilt; overlay stacks (paper on top, values below, each scrollable) using `100dvh`; tap targets ≥44px.
- Tablet (640–1100px): 2-col upload grid → 1-col where tight; overlay 2-col only from 900px.
- Tables stay in `.table-scroll` (horizontal scroll inside, never page). Test asserts `scrollWidth <= innerWidth` at 390px.
- `@media (prefers-reduced-motion: reduce)`: no auto-rotate/autoplay, no transitions.
- Verify with Playwright screenshots at 390×844, 820×1180, 1440×900, 2560×1440, 3440×1440, 3840×2160.

## 3. Hard security rules (CSP is asserted by tests — do not change it)
`default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`
- No inline `style=""`, no `<style>`, no `setAttribute('style')`. CSSOM (`el.style.x = …`, `setProperty`) is fine.
- No Google Fonts / font CDNs (system font stacks). No data:/external images. No three.js or other CDN libs (CSS 3D only).
- Build DOM with `createElement` + `textContent`; never `innerHTML` with data.
- Keep Pyodide 0.26.2 loader + SRI `sha384-tVslJOEkg7nVRW3Y3/ReGX0NnonNrbcmt1R5qFbQXQdGa2chRkoJYHAjAsv3zoTq` + `crossOrigin="anonymous"`.
- If CSP really needs widening, STOP and ask the user.

## 4. Integration rules
- Keep every ID app.js uses; restyle, don't rename/remove. Keep `fail()` (error shows only the message) and footer `v0.3.1`.
- Minimal app.js change: end of `render(data)` → `document.dispatchEvent(new CustomEvent("itr:render",{detail:data}))`; end of `invalidate()` → `document.dispatchEvent(new Event("itr:clear"))`. All new UI lives in `web/ui.js` (`<script src="./web/ui.js" defer>` after app.js).
- `#intraday-warning` stays red, `role="alert"`, text exactly "Intraday = speculative business income; ITR-3 likely required." — prominent above the ring.
- Never edit `output/` or `D:\Downloads\Groww`. Synthetic fixtures only in tests. Never put PAN/name/mobile anywhere.
- Add a browser test: after sample review, `.forms-ring` has 8 cards, clicking A2 front card opens dialog, Esc closes, no console CSP errors.

## 5. Done =
- `pytest -q -m "not browser"` 92+ pass, `pytest -q -m browser` pass.
- Local real-report check shows 32,264.78 / 1,499.79 / 16,635.14, intraday warning, dividend 8,577.47.
- Screenshots at all 6 viewports, no horizontal scroll, no console errors.
- Commit on `ui/redesign-2026-10` with a clear message; report diff summary. Do not merge.
