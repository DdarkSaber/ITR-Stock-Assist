# Working-paper XLSX contract 1.0.0

App version 0.3.1; reviewed 16 October 2026. **Not an official ITR JSON/CSV schema or filing-ready return.** This contract supports a future independent reader; no combined-excel integration or step-by-step filing project is included.

## Human review

Open **Filing review** first. It identifies FY/AY, completeness, rupee units, year-specific CG/112A destinations and unresolved filing questions.

**Filing groups** contains observed groups only, keyed by evidence basis, holding term and transfer period, plus a provisional **Non-equity (Schedule CG A5, slab rate)** group for Groww debt-fund and flagged INF fund/ETF rows. The non-equity group maps to Table F row 3. It separates gross consideration, source/attested cost, confirmed expenses, positive gains, negative losses and net gain. Native fees are blank; native gains are broker-reported, not confirmed gains after allowable expenses. Exact amounts have adjacent informational whole-rupee rounded columns; round the final total only, not individual lots. An empty group set is not a nil-return assertion. Source lookup points to per-lot **Filing map** rows, avoiding oversized/truncated lists in Excel cells.

**Summary**, **Disposed lots**, **Review issues**, **Source rows**, **Import manifest** preserve the original review evidence. **References** records primary sources. No source status is upgraded by formatting.

Groww stock-report summary dividends, when present, are shown on **Filing review**, **Summary**, and the import manifest with the informational note **Report in Schedule OS**. They are not added to Schedule CG groups or calculations.

## Machine-readable sheet: `Filing map`

First row is the exact header. One row is **field evidence for one source disposal lot**, not a return object, final schedule total or upload record. Multiple rows share a `record_id`. Do not sum every `value` column; it contains different metrics and repeated evidence. There are no final annual tax values.

| Columns | Contract |
|---|---|
| `format_version` | String `1.0.0`. Readers must reject unsupported major versions and tolerate additional columns in compatible minor versions. |
| `fy`, `ay` | Selected `YYYY-YY` identifiers; do not infer AY from file name. Supported pairs are 2024-25/2025-26 and 2025-26/2026-27. |
| `record_id` | `lot-000001` etc. Unique within this review snapshot, repeatable for unchanged ordered inputs, **not globally stable across reordered/new imports**. |
| `field_id` | Stable app metric identifier listed below. A missing field is not zero. |
| `schedule` | Human-readable **candidate** Schedule CG/111A or Schedule 112A destination, conditional on eligibility. Blank for excluded lots. |
| `official_container`, `official_field` | Reference names relative to the official schema **definitions**, not a JSON pointer from the ITR root or official upload shape. `ShortTermCapGainFor23.EquityMFonSTT[].EquityMFonSTTDtls[_BE]` selects the ST branch; 112A references `Schedule112A.Schedule112ADtls[]` / `Schedule112A115ADType`. Dot notation denotes nested fields. Official typo `AquisitCost` is intentional. |
| `value`, `unit` | Text decimal **INR rupees, not lakhs**, identifier, enum or blank. Exact source precision retained, not rounded to an official integer-rupee field. Blank Excel cell means **unknown/not computed**, not zero. Explicit `"0"` or `"0.00"` is a known zero. No Excel formulas. |
| `status`, `reason` | See status definitions below; never infer readiness from presence of a value. |
| `basis` | `ATTESTED_CANONICAL` or `BROKER_REPORTED`. These are separate views, not additive income sources; canonical rows can describe the same disposals as native rows. |
| `source_file`, `source_sheet`, `source_row`, `lot_id` | Original imported file label, sheet (blank for CSV), 1-based XLSX row / ending physical CSV line, source disposal ID. Use together for provenance, not global deduplication. |
| `isin`, `scheme_code` | Separate identity types. No fabricated MF ISIN; no folio number exported. These repeat on field rows as provenance. |
| `transfer_period` | FY 2024-25: `BE` = before 2024-07-23, `AE` = on/after. FY 2025-26: `FULL_FY`. Blank for excluded rows. The 112A acquisition flag `AE` means after **2018-01-31** instead, not the July split. |
| `schema_url` | Selected AY's reviewed official V1.2 source. Evidence reference, **not proof of full schema validation**. |

### Field IDs

| ID | Meaning / official candidate field |
|---|---|
| `cg.consideration` | Gross sale consideration: ST `FullConsideration`; LT `TotSaleValue`. |
| `cg.acquisition_cost` | Supplied acquisition cost: ST `DeductSec48.AquisitCost`; LT `CostAcqWithoutIndx`, conditional on supported post-Jan-2018 basis. Native value is source cost, not certified allowable cost. |
| `cg.transfer_expenses` | ST `DeductSec48.ExpOnTrans`; LT `ExpExclCnctTransfer`. Allowable transfer expenses excluding STT. Blank for native reports. |
| `cg.balance_before_adjustments` | Working gain after confirmed cost/expenses: ST `BalanceCG`; LT `Balance`. Blank for native reports. It is **not taxable income** and does not settle all required schema fields or eligibility. |
| `app.broker_reported_gain` | Native reconciliation amount only; **no direct official field mapping**. Never substitute it for a confirmed balance or add it to canonical gains. |
| `cg.non_equity_net` | Groww-reported net for a debt-fund or flagged INF fund/ETF row; provisional candidate for Schedule CG A5, Table F row 3 (`AccruOrRecOfCG`), not a computed tax amount. |
| Groww-reported dividend summary | Informational source-report amount only; report in Schedule OS. Not a Schedule CG amount or field-map value. |
| `cg.section94_adjustment` | ST `LossSec94of7Or94of8`; unknown, blank. |
| `cg.capital_gain_after_adjustments` | ST `CapgainonAssets`; unknown, blank pending final adjustments. |
| `112a.isin` | Actual `ISINCode`, or blank if absent. A scheme code is not an ISIN. |
| `112a.acquisition_period` | `ShareOnOrBefore=AE` only for admitted post-Jan-2018 acquisitions; earlier rows are blocked. |
| `112a.transfer_period` | `ShareTransferredOnOrBefore=BE/AE` **only for AY 2025-26**. Absent for AY 2026-27 because that schema removed it. |
| `app.excluded_lot` | Single BLOCKED marker with reason/provenance; value and official destination blank. Full evidence remains in Source rows / Disposed lots. |

`ImproveCost`, actual-cost versus grandfathering/FMV subfields, final deductions, exemption claims, CG carry-through totals, timing buckets, SI/CYLA/BFLA/CFL and final tax are not assembled. Omission must never be converted into a zero or “not applicable” statement by consumers.

### Status meanings

- **READY_WORKING**: canonical inputs passed this app's attestation/validation gates. Suitable for working-paper review only; not independently verified or ready to file.
- **PROVISIONAL**: source-reported/reconciled native evidence, still missing cost-history/fees/STT confirmations.
- **BLOCKED**: unsupported, duplicate, outside FY or otherwise invalid disposal. No candidate official amount.
- **NOT_COMPUTED**: needed fact/adjustment/identifier is unknown. Its value is blank even if other fields on that lot are known.

Consumers must preserve reasons and provenance and treat unknown versions/statuses/units as blocking. All supplied strings are explicitly XLSX text to prevent formula execution. Source data are sensitive; keep derived workbooks private. Exact values are text because binary Excel numerics cannot preserve all source decimal products. Do not silently parse through binary floats.

## Cross-project alignment recommendation (not implemented)

A future reader of both ITR workbooks could use a shared envelope of format version, FY/AY, field ID, exact value, unit, status, reason and file/sheet/row provenance. Each producer should retain its own documented namespace and distinguish working balances from final return values. Do not change or assume a compatible contract for the existing foreign-assets ITR Assist until that project explicitly adopts one. The future combined step-by-step guide is a separate project.
