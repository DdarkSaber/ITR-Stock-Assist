"""ITR-2 working-paper destinations, not return assembly or tax calculation.

Evidence and AY-specific schema references: docs/research-2026-10-16.md.
The exported mapping contract is documented in docs/workbook-contract.md.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal, localcontext

FORMAT_VERSION = "1.0.0"
RESEARCH_DATE = "2026-10-16"
SCHEMAS = {
    "2025-26": "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-09/ITR-2_2025_Main_V1.2.json",
    "2026-27": "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-08/ITR-2_2026_Main_V1.2.json",
}
CAUTION = (
    "Candidate destinations only; section eligibility is not certified. READY_WORKING "
    "means an attested working-paper input, never a filing-ready return. Provisional "
    "Groww figures and canonical figures must not be added for the same disposals."
)
UNRESOLVED = (
    "Confirm STT/section eligibility, all brokers and off-market disposals, acquisition "
    "history and allowable charges excluding STT. Review dividend/bonus stripping, "
    "buybacks, exemptions and current/brought-forward losses separately. No unknown "
    "filing value is assumed to be zero."
)
NON_EQUITY_SCHEDULE = "Non-equity (Schedule CG A5, slab rate)"
NON_EQUITY_CONTAINER = "ScheduleCG.A5.TableF[3]"
NON_EQUITY_ALLOWED_ISSUES = {
    "Fund/ETF unit: confirm equity-oriented status",
    "Debt fund: Schedule CG A5 slab-rate review.",
    "asset_type: only listed_equity and verified equity_mf are supported.",
    "Broker report only: verify STT, acquisition/corporate-action history and "
    "allowable costs/fees. Transfer expenses are not supplied per lot; no zero "
    "expense or tax-eligibility confirmation has been invented. Use a verified "
    "canonical CSV for working-paper inclusion.",
}
MAP_HEADERS = [
    "format_version", "fy", "ay", "record_id", "field_id", "schedule",
    "official_container", "official_field", "value", "unit", "status", "reason",
    "basis", "source_file", "source_sheet", "source_row", "lot_id", "isin",
    "scheme_code", "transfer_period", "schema_url",
]


def period(fy, sell):
    if fy == "2024-25":
        return "BE" if sell < "2024-07-23" else "AE"
    return "FULL_FY"


def destination(term, transfer_period):
    if term == "STCG":
        detail = "EquityMFonSTTDtls_BE" if transfer_period == "BE" else "EquityMFonSTTDtls"
        return "Schedule CG / 111A candidate", f"ShortTermCapGainFor23.EquityMFonSTT[].{detail}"
    return "Schedule 112A / 112A candidate", "Schedule112A.Schedule112ADtls[]"


def _provenance(record):
    return {
        "file": record["source_file"], "sheet": record.get("source_sheet", ""),
        "row": record["source_line"], "lot_id": record["raw"]["lot_id"],
    }


def _non_equity_candidate(record, result):
    if record.get("filing_group") != "non_equity" or not record.get("native"):
        return False
    if not record.get("broker_gain") or not record["raw"]["cost_inr"] or not record["raw"]["proceeds_inr"]:
        return False
    try:
        sold = date.fromisoformat(record["raw"]["sell_date"])
    except ValueError:
        return False
    year_start = int(result["fy"][:4])
    start = date(year_start, 4, 1)
    end = date(year_start + 1, 3, 31)
    if not start <= sold <= end:
        return False
    return all(issue in NON_EQUITY_ALLOWED_ISSUES for issue in record["issues"])


def filing_review(result):
    """Separate observed canonical and broker groups; never synthesize empty zeros."""
    grouped = defaultdict(list)
    for record in result["records"]:
        non_equity = _non_equity_candidate(record, result)
        if record["status"] == "INCLUDED" or record["broker_summary_included"] or non_equity:
            basis = "BROKER_REPORTED" if record.get("native") else "ATTESTED_CANONICAL"
            term = "NON_EQUITY" if non_equity else record["term"]
            grouped[(basis, term, period(result["fy"], record["raw"]["sell_date"]))].append(record)
    groups = []
    with localcontext() as context:
        context.prec = 80
        for (basis, term, transfer_period), records in sorted(grouped.items()):
            native = basis == "BROKER_REPORTED"
            gains = [Decimal(r["broker_gain"] if native else r["gain"]) for r in records]
            def total(field):
                return format(sum((Decimal(r["raw"][field]) for r in records), Decimal(0)), "f")
            schedule, container = (
                (NON_EQUITY_SCHEDULE, NON_EQUITY_CONTAINER)
                if term == "NON_EQUITY" else destination(term, transfer_period)
            )
            groups.append({
                "basis": basis, "term": term, "period": transfer_period,
                "schedule": schedule, "container": container, "lots": len(records),
                "proceeds": total("proceeds_inr"), "cost": total("cost_inr"),
                "expenses": None if native else total("transfer_expenses_inr"),
                "positive_gains": format(sum((g for g in gains if g > 0), Decimal(0)), "f"),
                "losses": format(sum((g for g in gains if g < 0), Decimal(0)), "f"),
                "net": format(sum(gains, Decimal(0)), "f"),
                "status": "PROVISIONAL" if native else "READY_WORKING",
                "provenance": [_provenance(r) for r in records],
            })
    return {
        "format_version": FORMAT_VERSION, "schema_url": SCHEMAS[result["ay"]],
        "groups": groups, "caution": CAUTION,
        "year_note": (
            "AY 2025-26: BE = transfer before 23 July 2024; AE = on/after 23 July 2024. "
            "Keep separate for the official CG/112A reporting split."
            if result["fy"] == "2024-25" else
            "AY 2026-27: FULL_FY. This year's ITR-2 removes the before/on-after "
            "23 July 2024 transfer split."
        ),
    }


def mapping_rows(result):
    """Yield exact-text candidate field evidence, with unknown final values blank."""
    for index, record in enumerate(result["records"], 1):
        raw = record["raw"]
        native = record.get("native", False)
        non_equity = _non_equity_candidate(record, result)
        eligible = record["status"] == "INCLUDED" or record["broker_summary_included"] or non_equity
        status = "PROVISIONAL" if native else "READY_WORKING"
        transfer_period = period(result["fy"], raw["sell_date"]) if eligible else ""
        schedule, container = (
            (NON_EQUITY_SCHEDULE, NON_EQUITY_CONTAINER)
            if non_equity else destination(record["term"], transfer_period) if eligible else ("", "")
        )
        reason = " | ".join(record["issues"]) if native or not eligible else CAUTION
        basis = "BROKER_REPORTED" if native else "ATTESTED_CANONICAL"
        def row(field_id, official_field, value, unit="INR", state=status, note=reason):
            return [
                FORMAT_VERSION, result["fy"], result["ay"], f"lot-{index:06d}", field_id,
                schedule, container, official_field, value, unit, state, note, basis,
                record["source_file"], record.get("source_sheet", ""), record["source_line"],
                raw["lot_id"], raw["isin"], record.get("scheme_code", ""), transfer_period,
                SCHEMAS[result["ay"]],
            ]
        if not eligible:
            yield row("app.excluded_lot", "", None, "", "BLOCKED", reason)
            continue
        if non_equity:
            yield row("cg.consideration", "FullValueOfConsideration", raw["proceeds_inr"], note=reason)
            yield row("cg.acquisition_cost", "CostOfAcquisition", raw["cost_inr"], note=reason)
            yield row(
                "cg.transfer_expenses", "ExpenditureOnTransfer", None,
                state="NOT_COMPUTED", note="Groww does not report allowable transfer expenses per lot.",
            )
            yield row(
                "cg.non_equity_net", "AccruOrRecOfCG", record["broker_gain"],
                note="Broker-reported net; provisional and before independent tax review. " + reason,
            )
            continue
        short = record["term"] == "STCG"
        yield row("cg.consideration", "FullConsideration" if short else "TotSaleValue", raw["proceeds_inr"])
        yield row("cg.acquisition_cost", "DeductSec48.AquisitCost" if short else "CostAcqWithoutIndx", raw["cost_inr"])
        yield row(
            "cg.transfer_expenses", "DeductSec48.ExpOnTrans" if short else "ExpExclCnctTransfer",
            None if native else raw["transfer_expenses_inr"],
            state="NOT_COMPUTED" if native else status,
            note="Allowable transfer expenses excluding STT; missing is not zero. " + reason,
        )
        yield row(
            "cg.balance_before_adjustments", "BalanceCG" if short else "Balance",
            None if native else record["gain"], state="NOT_COMPUTED" if native else status,
            note="Working balance only, before annual exemptions/loss adjustment. " + reason,
        )
        if native:
            yield row("app.broker_reported_gain", "", record["broker_gain"])
        if short:
            yield row(
                "cg.section94_adjustment", "LossSec94of7Or94of8", None,
                state="NOT_COMPUTED", note="Dividend/bonus stripping not determined; do not assume zero.",
            )
            yield row(
                "cg.capital_gain_after_adjustments", "CapgainonAssets", None,
                state="NOT_COMPUTED", note="Final schedule amount blocked pending section 94 and full-return review.",
            )
        else:
            yield row(
                "112a.isin", "ISINCode", raw["isin"] or None, "identifier",
                state=status if raw["isin"] else "NOT_COMPUTED",
                note="Actual ISIN only. Scheme code is separate, not an ISIN. Current schema "
                "permits post-Jan-2018 consolidation; no placeholder is substituted by this app.",
            )
            yield row(
                "112a.acquisition_period", "ShareOnOrBefore", "AE", "enum",
                note="After 31 January 2018 only; earlier acquisitions remain blocked. " + reason,
            )
            if result["ay"] == "2025-26":
                yield row("112a.transfer_period", "ShareTransferredOnOrBefore", transfer_period, "enum")


def workbook_sheets(result):
    filing = result["filing"]
    overview = [
        ["ITR-2 filing review", "Read this before copying any figures"],
        ["Financial year", result["fy"]], ["Assessment year", result["ay"]],
        ["State", "EMPTY" if not result["records"] else "INCOMPLETE" if result["blocked"] else "WORKING PAPER - final return not computed"],
        ["Purpose", "Human-review inputs for ITR-2 Schedule CG and Schedule 112A; NOT an official upload file."],
        ["Amounts and units", "INR rupees, NOT lakhs. Exact decimal text; quantity means disposed shares/units. No return-level rounding applied."],
        ["Readiness", CAUTION],
        ["Year-specific reporting", filing["year_note"]],
        ["Where to start", "Filing groups separates CG/112A candidates and evidence bases. Then resolve Review issues and inspect Disposed lots / Source rows."],
        ["Unknown versus zero", "Blank = unknown/not computed, never zero. An absent group does not mean no gains. Summary 0.00 means no included contribution, not a verified nil return."],
        ["Losses / annual aggregation", "Positive gains and negative losses are separate in Filing groups. Net gain is not taxable gain. No current-year or brought-forward set-off, carry-forward or Schedule SI tax computation."],
        ["112A annual threshold", "No threshold deducted per lot, broker, file or reporting period. Any annual exemption/tax computation requires eligible aggregate income and full-return loss review."],
        ["Rounding", "Official schemas mix integer-rupee fields and decimal fields. This working paper retains exact source precision; reconcile at final aggregate/utility stage, not by rounding each lot."],
        ["Acquisition / STT / charges", UNRESOLVED],
        ["ISIN / scheme identity", "Actual ISIN and scheme code are distinct. Groww MF has no ISIN. For post-Jan-2018 acquisitions official schemas describe CONSOLIDATED / INNOTREQUIRD; app does not fabricate an ISIN or build an upload."],
        ["Grandfathering", "Acquisitions on/before 31 Jan 2018 remain blocked: actual cost, 31 Jan 2018 FMV and proceeds must be verified; no automatic grandfathering."],
        ["CG timing / Table F", "Transfer dates preserved, but final period-wise taxable gains after losses are NOT computed. Do not copy raw broker gains into Table F / AccruOrRecOfCG."],
        ["ITR-2 scope", "Individuals/HUF without business/professional income, subject to full eligibility review. Intraday, F&O, debt/unknown assets and business-income filing are excluded, not resolved."],
        ["Completeness", "Reconcile all brokers, demat/RTA records and AIS/TIS; imported files alone cannot prove completeness. P&L reports overlap CG reports and must not be added."],
        ["Machine-readable contract", f"Filing map format {FORMAT_VERSION}; see docs/workbook-contract.md. Stable app field IDs with official schema field references, not official JSON."],
        ["Schema evidence", filing["schema_url"]],
        ["References reviewed", RESEARCH_DATE + "; docs/research-2026-10-16.md"],
    ]
    groups = [[
        "Candidate destination", "Transfer period", "Evidence basis", "Status", "Lots",
        "Gross consideration INR", "Source / attested cost INR", "Confirmed transfer expenses INR",
        "Positive gains INR", "Losses INR (negative)", "Net gain INR (not taxable income)",
        "Official candidate container", "Source lookup", "Important",
    ]]
    for group in filing["groups"]:
        groups.append([
            group[k] for k in (
                "schedule", "period", "basis", "status", "lots", "proceeds", "cost",
                "expenses", "positive_gains", "losses", "net", "container",
            )
        ] + [f"Filing map: basis={group['basis']}, transfer_period={group['period']}, "
             f"schedule={group['schedule']}. Each lot retains file/sheet/row.", CAUTION])
    references = [
        ["Source", "Date / version", "Applicable AY", "URL", "Use / limitation"],
        ["Official ITR-2 JSON schema", "V1.2; URL release folder Sep 2026", "2025-26",
         SCHEMAS["2025-26"], "Verified field names and pre/post 23 July split; not app upload compatibility."],
        ["Official ITR-2 JSON schema", "V1.2; URL release folder Aug 2026", "2026-27",
         SCHEMAS["2026-27"], "Verified field names; removed before/after transfer flag."],
        ["ITR-2 official FAQ", "Undated; accessed " + RESEARCH_DATE, "2026-27",
         "https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/itr-2/itr-2-faqs",
         "Q24 confirms removal of transfer-date split; ITR-2 excludes business/professional income."],
        ["CBDT capital-gains FAQ", "24 July 2024; accessed " + RESEARCH_DATE, "Both supported AYs",
         "https://pib.gov.in/PressReleasePage.aspx?PRID=2036604&reg=3&lang=2",
         "Holding periods and FY 2024-25 changes; no app threshold or tax computation."],
        ["Groww stocks CG help", "Undated; accessed " + RESEARCH_DATE, "Source reports",
         "https://groww.in/help/stocks,-f&o,-ipo-&-mtf/sx-reports/what-is-a-capital-gain-or-tax-p-l-report--20",
         "Report semantics only. Its on-or-after-one-year wording does not override the legal holding-period boundary."],
        ["Research and output contract", RESEARCH_DATE, "Both supported AYs",
         "docs/research-2026-10-16.md; docs/workbook-contract.md",
         "Project documents include validation PDF links, secondary sources, conflicts, exclusions and schema mapping contract."],
    ]
    return {
        "Filing review": overview, "Filing groups": groups,
        "Filing map": [MAP_HEADERS, *mapping_rows(result)],
        "References": references,
    }
