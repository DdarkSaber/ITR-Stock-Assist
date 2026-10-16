# ITR Stock Assist

A separate, local-first Indian listed-equity / equity-oriented mutual-fund capital-gains helper. The web app follows ITR Assist's Solar Copper visual language: dark warm panels, copper/gold accents, filing-year selection, upload cards, review KPIs and an Excel working paper.

**Version 0.3 supports Groww Stock Capital Gains and Mutual Fund Capital Gains XLSX reports, plus canonical CSV, with an ITR-2-focused filing review and field-evidence map.** The adapters follow actual locally inspected Groww schemas, with synthetic regression fixtures. This is not a complete tax filing engine. P&L statements are deliberately rejected, including renamed P&L workbooks: their realised trades overlap capital-gains reports and their unrealised/aggregated tables are not disposal lots. Other broker-native formats, PDF and legacy XLS remain unsupported.

## Launch the web app

Python 3.11+ is sufficient to serve the static app; no pip install is needed for browser use:

```powershell
Set-Location F:\Dev\MyWorkspace\ITR-Stock-Assist
python -m http.server 8744 --bind 127.0.0.1
```

Open **http://127.0.0.1:8744**. Serve the project root, not just `web`, and do not open `index.html` with `file://`.

1. Select FY 2025-26 or FY 2024-25.
2. Choose Groww capital-gains XLSX or canonical CSV files, or click **Try synthetic sample**, then **Review capital gains**.
3. Inspect included and blocked lots. Download the XLSX; resolve issues against the source and re-import corrected CSVs.

The sample is entirely synthetic (including format-only ISINs), not a broker export. For FY 2025-26 it produces **STCG INR 1,965.20**, **LTCG INR 7,500.00**, three included lots and one intentionally blocked lot.

## Privacy and runtime

CSV/XLSX parsing, Decimal arithmetic, classification and workbook generation run **inside the browser** using Pyodide 0.26.2 and openpyxl. No financial data is sent to a server. No telemetry, analytics, browser storage, external fonts or account system. The local Python server only serves static files.

Internet is required to download the public Python runtime from `cdn.jsdelivr.net` on first review and its micropip installer on first XLSX import/export. Pinned openpyxl 3.1.5 and et-xmlfile 2.0.0 wheels are bundled under `web\vendor`, including upstream licenses; no runtime PyPI queries are needed. This is **not a guaranteed fully offline app**: browser caches may be evicted, and no service worker is installed. Dependencies are third-party executable code, so only use a trusted runtime source. Reset clears application state and rendered records; this is not a secure memory-erasure guarantee. Downloaded workbooks are not deleted by reset.

Keep real reports outside the project, or in ignored `private`. When serving this directory, use the documented loopback binding and do not expose the static server publicly; the development server does not implement access control. Nothing has been published or deployed.

## Groww native import

Use **Stocks Capital Gains Report** or **Mutual Funds Capital Gains Report** downloaded as XLSX. Both layouts use header/section detection, not fixed row offsets. Up to ten uniquely named input files, 2 MB each and 10,000 total disposal rows. Single-sheet original reports only; malformed, ambiguous, formula-containing or excessively expanded XLSX files fail explicitly. Empty report sections are normal; an entirely empty report gets an explicit **EMPTY** outcome, not a fabricated transaction or certification of no gains.

Stock columns: `Stock name`, `ISIN`, `Quantity`, `Buy date`, `Buy price`, `Buy value`, `Sell date`, `Sell price`, `Sell value`, `Realised P&L`, `Remark`. Stock buy/sell **values are already lot totals**. Dates are `DD-MM-YYYY`. Intraday and other sections remain visible but excluded. Remarks requiring interpretation also block the provisional summary.

Fund columns: `Scheme Name`, `Scheme Code`, `Category`, `Folio Number`, `Purchase Transaction Id`, `Purchase Date`, `Matched Quantity`, `Purchase Price`, `Redeem Transaction Id`, `Redeem Date`, `Grandfathered Nav`, `Redeem Price`, `Short Term-Capital Gain`, `Long Term-Capital Gain`. Fund prices are **per unit**, so exact Decimal products with matched quantity derive gross cost/proceeds. Dates are `YYYY-MM-DD`. Excel date cells are accepted for both layouts. The fund scheme code identifies the scheme; **no ISIN is invented**. Folio numbers are not copied into normalized output. Debt (specified/unspecified) and unknown categories remain visible but excluded; no debt-fund tax rules are implemented. Reference grandfathered NAV is preserved but never substituted for actual cost; pre-Feb-2018 acquisitions remain blocked.

### Two distinct sets of figures

**Provisional Groww-reported gains:** the broker's reported STCG/LTCG values, only for in-year supported equity lots with valid dates/identity, matching calendar holding period and gross-gain reconciliation within **INR 0.01**. Negative and zero gains are retained. These are displayed separately and never added into verified canonical totals. Mismatches, duplicate reports, unsupported assets/sections and out-of-year rows are excluded. Each native row preserves its reported gain, raw unit/value fields, exact gross gain, reconciliation, and sheet+row reference, even when blocked.

**Verified working-paper totals:** canonical CSV rows with explicit cost/expense/eligibility confirmations. **All native lots remain pending verification and excluded from these totals.** A capital-gains report does not establish per-lot allowable transfer expenses, STT conditions or corporate-action history; absence of those fields is not a zero expense or a confirmation. For inclusion, reconcile the original source and prepare verified canonical lots using the contract below. Native broker figures are useful for reconciliation, not certified taxable income.

Repeated copies of the same native disposal in different files are all blocked. Equal lots within one report keep occurrence identities rather than being silently collapsed. Identity uses stock ISIN/date/quantity/value fields, or fund scheme/purchase/redemption/matched-lot fields; broker exports have no globally unique stock lot ID. Matching is conservative and cannot prove that separately altered or overlapping exports are disjoint. **Do not add native broker figures and canonical figures for the same disposals.** Do not combine reports from different accounts without checking identities.

No early rounding of fund unit products; the reconciliation tolerance is one paise. Broker-reported gains with sub-paise precision are excluded rather than silently rounded. Excel numeric values are converted using their decimal string representation, not used in binary floating-point arithmetic; precision already lost in a broker spreadsheet cannot be reconstructed. Source numeric representations and gross products remain in the exported evidence. Canonical money still requires whole paise. FY 2023-24 / ongoing FY 2026-27 files can be inspected, but out-of-selected-year rows cannot enter either set of totals; only FY 2024-25 and FY 2025-26 are selectable.

## Canonical input contract

Use `samples\canonical-demo.csv` as a template: UTF-8 (BOM accepted), comma-separated, header names exactly as below (column order may differ). Limits above also apply to mixed CSV/XLSX batches; fields up to 2,000 characters. Quoted commas and line breaks are supported.

| Field | Meaning / validation |
|---|---|
| `lot_id` | Required unique disposal-lot identifier **within broker** across all files. For partial disposals use separate IDs, e.g. `purchase123-sale456`. All duplicate copies are blocked, not counted once arbitrarily. |
| `broker` | Required source broker/account label. Include an account identifier if needed to avoid colliding lot IDs across accounts; avoid unnecessary personal data. |
| `asset_name` | Required security/scheme name. |
| `isin` | Indian ISIN: `IN` + nine uppercase alphanumeric characters + final digit. Format only, not a checksum or security-master verification. |
| `asset_type` | Exactly `listed_equity` (Indian exchange-listed delivery equity) or `equity_mf` (verified equity-oriented fund). Do not infer this from a scheme name. Unknown, hybrid, international, debt funds and ETFs without verified classification need manual review. |
| `buy_date`, `sell_date` | Actual acquisition and disposal dates, strict `YYYY-MM-DD`. Buy must precede sale. Original acquisition date, not a broker-transfer date. |
| `quantity` | Positive disposed units, up to six decimals. Used for traceability; amounts are **lot totals**, not unit prices. |
| `cost_inr` | Confirmed allowable INR acquisition cost allocated to this disposed lot, including only allowable acquisition charges, **excluding STT**. Explicit zero allowed when genuinely verified; blank is never zero. |
| `proceeds_inr` | Gross INR sale consideration for the disposed lot, before transfer expenses. Do not pass net proceeds and deduct expenses a second time. |
| `transfer_expenses_inr` | Verified allowable transfer expenses, **excluding STT**. Explicit `0` is required if none. |
| `stt_paid` | `yes` only when the relevant STT conditions are confirmed: equity-share acquisition/transfer and equity-fund transfer. Exempt acquisitions and other exceptions are not resolved by this MVP. Other values block the lot. |
| `corporate_action` | `none` only when no bonus, split, merger, gift, inheritance or other date/cost adjustment is involved. Anything else, including missing data, blocks the lot. |
| `cost_basis_confirmed` | `yes` only after confirming the matched acquisition lot, allocated cost, expense eligibility and exclusion of STT. This is a user attestation, not an engine verification. |

Money: non-negative ordinary decimal strings, at most 12 integer digits and two decimal digits, no currency symbols, commas, exponents or automatic rounding. Negative **gains** are calculated and retained. Whitespace around fields is trimmed. `Source rows` preserves these parsed values, not the byte-for-byte original CSV. CSV source references use the **ending physical line** of a record (important for multiline quoted cells).

File-level schema, malformed CSV and size failures stop the entire import. Row-level missing costs, dates, unsupported classifications, duplicate IDs, STT/corporate-action uncertainties and out-of-year disposals remain visible, **without a gain**, and are excluded from totals. All exclusion reasons go into the workbook. There is no silent fallback or fabricated missing value.

## Calculation and tax-rule boundaries

Implemented for **FY 2024-25 / AY 2025-26** and **FY 2025-26 / AY 2026-27** only:

- Gain/loss = gross proceeds minus confirmed allowable cost minus confirmed allowable transfer expenses (excluding STT).
- Supported listed equity and equity-oriented funds: holding period **greater than 12 calendar months** is LTCG, otherwise STCG. Months are calendar months (General Clauses Act s.3(35)); per Delhi HC (ITA 1234/2011) 12 months from acquisition on day D end on D-1 of the next year, so a sale **on** the one-year anniversary is LTCG, matching Groww's "on or after 1 year". Not a fixed 365-day threshold. The 29-Feb to 28-Feb next-year boundary is blocked for advice rather than guessed.
- Acquisitions on or before **31 January 2018** are conservatively blocked for grandfathering review, not calculated with an assumed fair-market value.
- Only disposals within the selected 1 April through 31 March financial year contribute.

Authoritative grounding, reviewed 16 October 2026:

- [CBDT capital-gains FAQ, PIB, 24 July 2024, Q3-Q6](https://pib.gov.in/PressReleasePage.aspx?PRID=2036604&reg=3&lang=2): listed-security holding periods and the 23 July 2024 regime change. The official page was retrieved and its holding-period text checked during implementation.
- Income-tax Act, 1961, **section 2(42A)**: 12-month short-term threshold for listed equity / units of an equity-oriented fund; **section 48**: consideration less allowable cost/transfer expenses, excluding STT; **section 55(2)(ac)**: pre-February-2018 grandfathering. Refer to the applicable year's text through the [Income Tax Department Acts](https://incometaxindia.gov.in/Pages/acts/income-tax-act.aspx).

This app **does not calculate tax rates or final tax liability**, certify section 111A/112A eligibility, apply the annual LTCG threshold, perform loss set-off/carry-forward, compute cess/surcharge, determine residency, reconcile AIS, or produce official Schedule CG/112A upload JSON. FY 2024-25's before/on-after 23 July reporting split is shown in filing groups, **not used to calculate tax**; FY 2025-26 uses the AY 2026-27 schema without that split. No FIFO lot matching, corporate actions, grandfathering, debt funds, business income, F&O or intraday. STCG/LTCG here are transparent working-paper holding-period classifications, not certified return schedule entries. Reconcile against broker reports and get tax advice before filing.

The dated [research/source ledger](docs/research-2026-10-16.md) records official AY-specific schemas and validation PDFs, broker documentation, recent tax-blog/forum sources, access limitations and disagreements. No rule was adopted solely from a forum/blog or search summary; verified Reddit content was unavailable. Statutory exceptions not directly reverified remain unresolved, not guessed.

## Workbook

Nine sheets: **Filing review**, **Filing groups**, **Filing map**, **References**, **Summary**, **Disposed lots**, **Review issues**, **Source rows**, **Import manifest**. Open Filing review first: selected FY/AY, amounts in **INR rupees, not lakhs**, readiness, unknowns, final-return limitations and source references.

Filing groups separates candidate Schedule CG/111A and Schedule 112A destinations, evidence basis and year-specific reporting period. Positive gains, negative losses and net gain are separate; **net gain is not taxable income**. Only observed groups are created. Empty imports or missing groups are not proof of nil gains, and the zero contribution in Summary is not a verified zero return. Native expenses remain blank. Do not add broker and canonical views of the same lots.

Filing map is a documented, versioned **field-evidence contract 1.0.0**, not an official upload. It includes app field ID, AY-specific official field reference, exact value/unit, status/reason and file/sheet/row provenance. `READY_WORKING` means attested canonical inputs, never filing-ready; `PROVISIONAL` means native broker evidence; `BLOCKED` means excluded; `NOT_COMPUTED` means unknown. Unknowns remain blank, not zero. Final section-94-adjusted STCG, annual exemptions, loss schedules and period-wise taxable income are not filled in. Missing MF ISIN stays missing; official post-Jan-2018 consolidation guidance is described without fabricating identifiers. See [machine-readable contract](docs/workbook-contract.md), including safeguards for any future independent consumer.

The original evidence sheets retain source file/sheet/row/lot, supplied fields, scheme identity, holding days, classification, exact gain/loss, provisional broker figures/reconciliation and all exclusions. The manifest distinguishes an empty native report from a failed import.

**Money is exported as exact decimal text**, not binary Excel numbers (two decimals for summary totals; source precision retained for native unit products). This deliberately preserves Decimal results without spreadsheet rounding; Excel SUM does not automatically sum these text cells. Summary totals are computed by the engine. Convert a copy to numeric cells only if needed for your own spreadsheet analysis. Supplied text is explicitly written as text, never as an Excel formula. Workbooks with any excluded/blocked/pending rows are labelled **INCOMPLETE**; empty native-only batches are labelled **EMPTY** in the Summary and download filename.

## Development and verification

The existing ITR Assist project is not a dependency and is unchanged.

```powershell
Set-Location F:\Dev\MyWorkspace\ITR-Stock-Assist
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest -q -m "not browser"
.\.venv\Scripts\python.exe -m playwright install chromium
.\.venv\Scripts\python.exe -m pytest -q -m browser
.\.venv\Scripts\python.exe -m compileall -q stock_assist
```

The browser smoke check starts and stops its own loopback server, uploads the sample and synthetic Groww workbooks via the file picker, runs Python in Chromium, downloads and reopens the XLSX, checks canonical/provisional totals, all nine sheets, mapping statuses/unknowns, AY-specific review, empty reports, P&L rejection, year invalidation, reset, errors, mobile overflow and outbound requests. It needs internet access to the runtime CDN. No frontend compilation or TypeScript step is needed: this is plain static HTML/CSS/JavaScript with a Python engine. Browser execution checks JavaScript syntax and wiring. Regression workbooks are generated entirely from synthetic data; no private broker files are fixtures.

Export formats appended cells by explicit row/column coordinates, avoiding repeated whole-sheet bounds scans as rows grow. Scale regressions check fixed scan-count budgets at 10 and 1,000 lots, source/mapping row indices, exact values and literal-text safety; the browser also downloads and reopens a 1,000-lot workbook. Export still runs in the tab's main Python runtime, so large workbooks can temporarily occupy the UI thread. A worker remains a future responsiveness improvement, not a substitute for bounded export work.

## Architecture and future Windows direction

`stock_assist\core.py` owns import dispatch, review and workbook output; `stock_assist\groww.py` detects and normalizes verified Groww layouts; `stock_assist\filing.py` owns AY-specific candidate destinations and the working-paper mapping contract. All three have no DOM or browser dependencies. `web\app.js` orchestrates file selection and calls the same modules through Pyodide. Native Python callers can use `review(files, fy)` and `workbook_bytes(result)` without a web UI. A CSV input is `{"name": "...csv", "text": "..."}`; an XLSX input is `{"name": "...xlsx", "base64": "..."}`.

A future Windows wrapper can reuse the static frontend in a WebView (e.g. pywebview with bundled CPython/openpyxl), or bundle the current Pyodide runtime in a desktop shell. Route bridge calls to this same core, bundle/pin dependencies for offline use, add explicit file-save permissions and signed builds. No installer or desktop packaging is included now.

Future broker adapters require user-authorized actual schemas, local verification and synthetic fixtures. Native Groww support is limited to the layouts above, not every export or every asset class.
