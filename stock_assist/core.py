"""Disposed-lot import/review and working papers; never infer absent tax inputs."""

import calendar
import csv
import io
import json
import re
from collections import Counter
from datetime import date
from decimal import Decimal, localcontext

YEARS = {"2024-25": 2024, "2025-26": 2025}
HEADERS = [
    "lot_id", "broker", "asset_name", "isin", "asset_type", "buy_date",
    "sell_date", "quantity", "cost_inr", "proceeds_inr", "transfer_expenses_inr",
    "stt_paid", "corporate_action", "cost_basis_confirmed",
]
RULE_SOURCE = "https://pib.gov.in/PressReleasePage.aspx?PRID=2036604&reg=3&lang=2"
DISCLAIMER = (
    "Capital-gains working paper only, not final tax liability or an official ITR "
    "upload file. Review all exclusions and reconcile against broker reports. "
    "No exemptions, tax rates, loss set-off, carry-forward, surcharge or cess computed."
)
BUSINESS_INCOME_WARNING = "Intraday = speculative business income; ITR-3 likely required."
MAX_BYTES = 2_000_000
MAX_ROWS = 10_000


class ImportProblem(ValueError):
    """Actionable file-level error; no partial import on malformed CSV."""


def parse_csv(text, filename):
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise ImportProblem(f"{filename}: file exceeds the 2 MB limit.")
    if not filename.lower().endswith(".csv"):
        raise ImportProblem(
            f"{filename}: only canonical UTF-8 CSV is supported. Broker-native "
            "XLSX/PDF reports (including Groww) need a verified adapter."
        )
    try:
        reader = csv.reader(io.StringIO(text.lstrip("\ufeff"), newline=""), strict=True)
        header = next(reader, [])
        if len(header) != len(set(header)) or set(header) != set(HEADERS):
            raise ImportProblem(
                f"{filename}: headers must match the canonical template exactly. "
                "Download the sample CSV and map one disposed acquisition lot per row."
            )
        records = []
        for values in reader:
            line = reader.line_num
            if not values or all(not value.strip() for value in values):
                continue
            if len(values) != len(header):
                raise ImportProblem(f"{filename}, line {line}: expected {len(header)} fields.")
            if any(len(value) > 2000 or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", value)
                   for value in values):
                raise ImportProblem(
                    f"{filename}, line {line}: fields must be at most 2,000 characters "
                    "and contain no control characters."
                )
            records.append({
                "source_file": filename, "source_line": line,
                "raw": {key: value.strip() for key, value in zip(header, values)},
            })
            if len(records) > MAX_ROWS:
                raise ImportProblem(f"{filename}: maximum {MAX_ROWS} disposed lots per file.")
        if not records:
            raise ImportProblem(f"{filename}: no disposed lots found.")
        return records
    except csv.Error as exc:
        raise ImportProblem(f"{filename}: malformed CSV near line {reader.line_num}: {exc}") from exc


def _money(value, field):
    if not re.fullmatch(r"\d{1,12}(?:\.\d{1,2})?", value):
        raise ValueError(f"{field}: supply a non-negative INR amount, up to 2 decimals; no commas.")
    return Decimal(value)


def _date(value, field):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{field}: use an actual date in YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field}: invalid calendar date.") from exc


def anniversary(value):
    day = min(value.day, calendar.monthrange(value.year + 1, value.month)[1])
    return value.replace(year=value.year + 1, day=day)


def holding_term(buy, sell):
    # Delhi HC (ITA 1234/2011, 12-Apr-2012): 12 months from an acquisition on day D end on
    # D-1 of the next year, so a sale on the anniversary already follows more than 12 months.
    return "LTCG" if sell >= anniversary(buy) else "STCG"


def review(files, fy):
    with localcontext() as context:
        context.prec = 80
        return _review(files, fy)


def _review(files, fy):
    if fy not in YEARS:
        raise ImportProblem("Choose FY 2024-25 or FY 2025-26; other years are not validated.")
    if not files or len(files) > 10:
        raise ImportProblem("Select between 1 and 10 canonical CSV or Groww capital-gains XLSX files.")
    if len({file["name"] for file in files}) != len(files):
        raise ImportProblem("File names must be unique. Rename same-named reports before importing.")
    records = []
    imports = []
    for file in files:
        if file["name"].lower().endswith(".xlsx"):
            from stock_assist.groww import parse_groww
            loaded, manifest = parse_groww(file.get("base64", ""), file["name"])
            records.extend(loaded)
            imports.append(manifest)
        else:
            loaded = parse_csv(file.get("text", ""), file["name"])
            records.extend(loaded)
            imports.append({"source_file": file["name"], "source_sheet": "", "format": "canonical_csv",
                            "rows": len(loaded), "outcome": "Imported"})
    if len(records) > MAX_ROWS:
        raise ImportProblem(f"Maximum {MAX_ROWS} disposed lots per review.")
    def identity(record):
        if record.get("native"):
            return record["duplicate_key"]
        return (record["raw"]["broker"].casefold(), record["raw"]["lot_id"])

    identities = Counter(identity(r) for r in records)
    start = date(YEARS[fy], 4, 1)
    end = date(YEARS[fy] + 1, 3, 31)
    totals = {"STCG": Decimal(0), "LTCG": Decimal(0)}
    broker_totals = {"STCG": Decimal(0), "LTCG": Decimal(0)}
    for record in records:
        raw = record["raw"]
        native = record.get("native", False)
        issues = list(record.get("adapter_issues", []))
        for field in ("lot_id", "broker", "asset_name"):
            if not raw[field]:
                issues.append(f"{field}: required; copy from the source report.")
        if not (native and record.get("scheme_code")) and not re.fullmatch(r"IN[A-Z0-9]{9}\d", raw["isin"]):
            issues.append("isin: supply a 12-character Indian ISIN (format check only).")
        if raw["asset_type"] not in ("listed_equity", "equity_mf"):
            issues.append("asset_type: only listed_equity and verified equity_mf are supported.")
        if not native and raw["stt_paid"] != "yes":
            issues.append("stt_paid: eligibility not confirmed. Verify relevant STT conditions; "
                          "share acquisitions and transfers, fund transfers. Exceptions need expert review.")
        if not native and raw["corporate_action"] != "none":
            issues.append("corporate_action: missing or affected by a bonus, split, merger, gift "
                          "or other adjustment; reconcile acquisition date and cost manually.")
        if not native and raw["cost_basis_confirmed"] != "yes":
            issues.append("cost_basis_confirmed: confirm matched acquisition lot, allowable cost "
                          "and expenses; STT must not be deducted.")
        if identities[identity(record)] > 1:
            issues.append(
                "Duplicate matched Groww disposal across reports; all copies blocked. "
                "Remove overlapping report files and re-import."
                if native else
                "Duplicate broker + lot_id across inputs; all matching rows blocked. "
                "Use a unique disposal-lot ID, including for partial sales."
            )
        buy = sell = None
        for field in ("buy_date", "sell_date"):
            try:
                parsed = _date(raw[field], field)
                if field == "buy_date":
                    buy = parsed
                else:
                    sell = parsed
            except ValueError as exc:
                issues.append(str(exc))
        if buy and sell and buy >= sell:
            issues.append("buy_date must precede sell_date; intraday and reversed dates unsupported.")
        if buy and buy <= date(2018, 1, 31):
            issues.append("Acquisition on/before 2018-01-31: grandfathering review required; "
                          "no gain calculated without a verified cost-basis adapter.")
        # Leap-day anniversaries vary in interpretation; do not silently choose a boundary.
        if buy and sell and buy.month == 2 and buy.day == 29 and sell == anniversary(buy):
            issues.append("Leap-day anniversary boundary: obtain holding-period advice.")
        quantity_valid = re.fullmatch(r"\d{1,12}(?:\.\d{1,6})?", raw["quantity"])
        if not quantity_valid or Decimal(raw["quantity"]) <= 0:
            issues.append("quantity: supply positive units, up to 6 decimals; no commas.")
        amounts = {}
        for field in (() if native else ("cost_inr", "proceeds_inr", "transfer_expenses_inr")):
            try:
                amounts[field] = _money(raw[field], field)
            except ValueError as exc:
                issues.append(str(exc))
        outside = sell is not None and not start <= sell <= end
        if outside:
            issues.append(f"Sale outside FY {fy}; excluded from this year's totals.")
        term = ""
        if (buy and sell and buy < sell and (not native or not outside)
                and raw["asset_type"] in ("listed_equity", "equity_mf")):
            term = holding_term(buy, sell)
            record["holding_days"] = (sell - buy).days
        if native and term and record["broker_term"] and term != record["broker_term"]:
            issues.append("Broker STCG/LTCG classification differs from the calendar holding period.")
        eligible_broker = native and not issues and record["broker_gain"] != ""
        if eligible_broker:
            broker_totals[term] += Decimal(record["broker_gain"])
        if native:
            from stock_assist.groww import PENDING
            issues.append(PENDING)
        record.update(status="BLOCKED" if issues else "INCLUDED",
                      issues=issues, term=term if native else "", gain="",
                      holding_days=record.get("holding_days", ""))
        record["broker_summary_included"] = eligible_broker
        if eligible_broker:
            record["status"] = "REVIEW_REQUIRED"
        if not issues:
            term = holding_term(buy, sell)
            gain = amounts["proceeds_inr"] - amounts["cost_inr"] - amounts["transfer_expenses_inr"]
            totals[term] += gain
            record.update(term=term, gain=f"{gain:.2f}", holding_days=(sell - buy).days)
    blocked = sum(r["status"] != "INCLUDED" for r in records)
    result = {
        "fy": fy, "ay": f"{YEARS[fy] + 1}-{str(YEARS[fy] + 2)[2:]}",
        "records": records, "included": len(records) - blocked, "blocked": blocked,
        "totals": {key: f"{value:.2f}" for key, value in totals.items()},
        "broker_totals": {key: f"{value:.2f}" for key, value in broker_totals.items()},
        "broker_review": sum(r["broker_summary_included"] for r in records),
        "imports": imports,
        "intraday_present": any(record.get("intraday", False) for record in records),
        "business_income_warning": (
            BUSINESS_INCOME_WARNING if any(record.get("intraday", False) for record in records) else ""
        ),
        "disclaimer": DISCLAIMER, "rule_source": RULE_SOURCE,
    }
    from stock_assist.filing import filing_review
    result["filing"] = filing_review(result)
    return result


def workbook_bytes(result):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    book = Workbook()
    book.remove(book.active)
    metadata = [
        ["ITR Stock Assist", "Capital-gains working paper v0.3"],
        ["Financial year", result["fy"]], ["Assessment year", result["ay"]],
        ["Review state", "EMPTY - no disposed lots" if not result["records"] else
         "INCOMPLETE - blocked / pending rows" if result["blocked"] else "Review required"],
        ["Included lots", result["included"]], ["Blocked / excluded lots", result["blocked"]],
        ["STCG net gain / loss (INR)", result["totals"]["STCG"]],
        ["LTCG net gain / loss (INR)", result["totals"]["LTCG"]],
        ["Important", DISCLAIMER],
        ["Money representation", "Exact decimal text in INR; not Excel numeric cells."],
        ["Calculation", "Gross proceeds - confirmed allowable acquisition cost - allowable "
         "transfer expenses excluding STT. No rounding before summation."],
        ["Holding period", "For supported equity only: >12 calendar months = LTCG (a sale on the one-year anniversary already qualifies); otherwise STCG."],
        ["Rule scope", "FY 2024-25 and FY 2025-26 only. No tax-rate calculation."],
        ["Official reference", RULE_SOURCE],
        ["Source reviewed", "CBDT capital-gains FAQ, 24 July 2024, holding period question."],
        ["Eligibility", "Asset type, STT and matched cost basis are user attestations, not verification."],
        ["Broker-reported STCG (provisional INR)", result["broker_totals"]["STCG"]],
        ["Broker-reported LTCG (provisional INR)", result["broker_totals"]["LTCG"]],
        ["Broker reconciliation rows", result["broker_review"]],
        ["Broker summary scope", "Non-duplicate equity rows within selected FY, matching holding "
         "period and gross gain within INR 0.01; not verified costs/fees/STT. Excluded from "
         "working-paper totals above. Canonical and native representations of the same lots "
         "must not be added together."],
    ]
    if result["intraday_present"]:
        metadata.append(["Intraday warning", result["business_income_warning"]])
    from stock_assist.filing import workbook_sheets
    sheets = {
        **workbook_sheets(result),
        "Summary": metadata,
        "Disposed lots": [[
            "Source file", "Source row / CSV end line", *HEADERS, "Status", "Holding days", "Term",
            "Gain INR (exact text)", "Review notes",
        ]],
        "Review issues": [["Source file", "Source row / CSV end line", "Lot ID", "Issue", "Source sheet"]],
        "Source rows": [["Source file", "Source row / CSV end line", *HEADERS, "Source sheet", "Native source fields"]],
        "Import manifest": [["Source file", "Source sheet", "Format", "Disposed rows", "Outcome"]],
    }
    sheets["Disposed lots"][0].extend([
        "Source sheet", "Scheme code (not ISIN)", "Broker term", "Broker gain INR",
        "Gross gain INR before expenses", "Reconciliation", "Provisional broker summary",
    ])
    for imported in result["imports"]:
        sheets["Import manifest"].append([imported[k] for k in
                                         ("source_file", "source_sheet", "format", "rows", "outcome")])
    for r in result["records"]:
        values = [r["raw"][key] for key in HEADERS]
        sheets["Disposed lots"].append([
            r["source_file"], r["source_line"], *values, r["status"], r["holding_days"],
            r["term"], r["gain"], " | ".join(r["issues"]),
            r.get("source_sheet", ""), r.get("scheme_code", ""), r.get("broker_term", ""),
            r.get("broker_gain", ""), r.get("gross_gain", ""), r.get("reconciliation", ""),
            "YES - provisional only" if r["broker_summary_included"] else "NO",
        ])
        sheets["Source rows"].append([r["source_file"], r["source_line"], *values,
                                     r.get("source_sheet", ""),
                                     json.dumps(r.get("source_values", {}), ensure_ascii=True)])
        for issue in r["issues"]:
            sheets["Review issues"].append([
                r["source_file"], r["source_line"], r["raw"]["lot_id"], issue, r.get("source_sheet", ""),
            ])
    alignment = Alignment(vertical="top", wrap_text=True)
    for name, rows in sheets.items():
        sheet = book.create_sheet(name)
        for row_index, values in enumerate(rows, 1):
            sheet.append(values)
            for column_index in range(1, len(values) + 1):
                cell = sheet.cell(row=row_index, column=column_index)
                # Explicit text cells prevent spreadsheet formula injection from source data.
                if isinstance(cell.value, str):
                    cell.data_type = "s"
                cell.alignment = alignment
        for cell in sheet[1]:
            cell.font = Font(color="FFFFFF", bold=True)
            cell.fill = PatternFill("solid", fgColor="8F4828")
        sheet.freeze_panes = "A2"
        if name not in ("Summary", "Filing review"):
            sheet.auto_filter.ref = sheet.dimensions
        for column in sheet.columns:
            sheet.column_dimensions[column[0].column_letter].width = min(
                60, max(18, max(len(str(c.value or "")) for c in column) + 2)
            )
        if name in ("Summary", "Filing review"):
            sheet.column_dimensions["A"].width = 32
            sheet.column_dimensions["B"].width = 110
            sheet.sheet_view.showGridLines = False
            for row in sheet.iter_rows(min_row=2):
                lines = max((len(str(cell.value or "")) + width - 1) // width
                            for cell, width in zip(row, (28, 95)))
                sheet.row_dimensions[row[0].row].height = 16 * max(2, lines) + 12
        if name in ("Filing groups", "Filing map"):
            status_column = (sheets[name][0].index("Status" if name == "Filing groups" else "status") + 1)
            colors = {"READY_WORKING": "D8EBD8", "PROVISIONAL": "FFF0C2",
                      "BLOCKED": "F6D4D4", "NOT_COMPUTED": "ECE5DE"}
            for row in sheet.iter_rows(min_row=2):
                status = row[status_column - 1]
                status.fill = PatternFill("solid", fgColor=colors[status.value])
                status.font = Font(bold=True, color="24201A")
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()
