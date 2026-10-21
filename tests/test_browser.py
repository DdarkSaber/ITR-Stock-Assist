"""Real Chromium + Pyodide import/export smoke check; requires CDN access."""

import io
import base64
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from openpyxl import load_workbook
from playwright.sync_api import sync_playwright, expect
from tests.test_groww import payload, stock_book, stock_row, mf_book, mf_row
from tests.test_export_scale import scale_input

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@pytest.mark.browser
def test_browser_import_download_and_reset(tmp_path):
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            failures = []
            requests = []
            page.on("pageerror", lambda error: failures.append(str(error)))
            page.on("request", lambda request: requests.append((request.url, request.method, request.post_data)))
            page.goto(f"http://127.0.0.1:{server.server_port}", wait_until="networkidle")
            cold_file = payload(stock_book({"Short Term trades": [stock_row()]}), "first-native.xlsx")
            page.locator("#files").set_input_files({
                "name": cold_file["name"], "mimeType": "application/octet-stream",
                "buffer": base64.b64decode(cold_file["base64"]),
            })
            page.locator("#review").click()
            expect(page.locator("#broker-stcg")).to_have_text("100.20", timeout=180000)
            page.locator("#reset").click()
            page.locator("#files").set_input_files(str(ROOT / "samples" / "canonical-demo.csv"))
            expect(page.locator("#review")).to_be_enabled()
            page.locator("#review").click()
            expect(page.locator("#results")).to_be_visible(timeout=180000)
            expect(page.locator("#stcg")).to_have_text("1965.20")
            expect(page.locator("#ltcg")).to_have_text("7500.00")
            expect(page.locator("#blocked")).to_have_text("1")
            expect(page.locator("#lots tr")).to_have_count(4)
            with page.expect_download(timeout=120000) as download_event:
                page.locator("#export").click()
            download = download_event.value
            assert download.suggested_filename == "ITR-Stock-Assist-FY-2025-26-INCOMPLETE.xlsx"
            content = Path(download.path()).read_bytes()
            book = load_workbook(io.BytesIO(content))
            assert book["Summary"]["B7"].value == "1965.20"
            assert book["Source rows"].max_row == 5
            assert len(book.sheetnames) == 9
            assert book.sheetnames[0] == "Filing review"
            assert book["Filing review"]["B3"].value == "2026-27"
            assert "FULL_FY" in page.locator("#filing-year").inner_text()
            expect(page.locator("#filing-groups")).to_contain_text("READY_WORKING")
            assert not failures
            assert all(method == "GET" and body is None for _, method, body in requests)
            assert all(url.startswith(("http://127.0.0.1:", "https://cdn.jsdelivr.net/")) for url, _, _ in requests)
            page.screenshot(path=str(tmp_path / "desktop.png"), full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.screenshot(path=str(tmp_path / "mobile.png"), full_page=True)
            page.locator("#fy").select_option("2024-25")
            expect(page.locator("#results")).to_be_hidden()
            expect(page.locator("#export")).to_be_disabled()
            page.locator("#review").click()
            expect(page.locator("#results")).to_be_visible(timeout=30000)
            expect(page.locator("#included")).to_have_text("0")
            expect(page.locator("#blocked")).to_have_text("4")
            expect(page.locator("#filing-year")).to_contain_text("before 23 July 2024")
            expect(page.locator("#filing-groups tr")).to_have_count(0)
            page.locator("#reset").click()
            expect(page.locator("#results")).to_be_hidden()
            expect(page.locator("#review")).to_be_disabled()
            page.locator("#sample").click()
            expect(page.locator("#review")).to_be_enabled()
            expect(page.locator("#fy")).to_have_value("2025-26")
            page.locator("#files").set_input_files({
                "name": "wrong.csv", "mimeType": "text/csv", "buffer": b"name,value\nx,2\n",
            })
            page.locator("#review").click()
            expect(page.locator("#error")).to_contain_text("headers must match", timeout=30000)
            expect(page.locator("#results")).to_be_hidden()
            stock_file = payload(stock_book({"Short Term trades": [stock_row()]}), "stock.xlsx")
            fund_file = payload(mf_book({"Equity Category": [mf_row()]}), "fund.xlsx")
            page.locator("#files").set_input_files([{
                "name": f["name"],
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "buffer": base64.b64decode(f["base64"]),
            } for f in (stock_file, fund_file)])
            page.locator("#review").click()
            expect(page.locator("#results")).to_be_visible(timeout=30000)
            expect(page.locator("#broker-summary")).to_be_visible()
            expect(page.locator("#broker-stcg")).to_have_text("100.20")
            expect(page.locator("#broker-ltcg")).to_have_text("123.46")
            expect(page.locator("#broker-count")).to_have_text("2")
            expect(page.locator("#stcg")).to_have_text("0.00")
            expect(page.locator("#included")).to_have_text("0")
            expect(page.locator("#lots")).to_contain_text("scheme SYNTH123")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.screenshot(path=str(tmp_path / "native-desktop.png"), full_page=True)
            with page.expect_download(timeout=30000) as native_download:
                page.locator("#export").click()
            native_book = load_workbook(io.BytesIO(Path(native_download.value.path()).read_bytes()))
            assert native_book["Source rows"].max_row == 3
            assert native_book["Import manifest"].max_row == 3
            expect(page.locator("#filing-groups")).to_contain_text("PROVISIONAL")
            mapping = list(native_book["Filing map"].values)
            headings = mapping[0]
            mapped = [dict(zip(headings, row)) for row in mapping[1:]]
            assert all(row["status"] != "READY_WORKING" for row in mapped)
            assert all(row["value"] is None for row in mapped if row["field_id"] == "cg.transfer_expenses")
            assert any(row["field_id"] == "112a.isin" and row["value"] is None for row in mapped)
            etf_file = payload(stock_book({"Short Term trades": [
                stock_row(**{"ISIN": "INF000A01001"}),
            ]}), "synthetic-etf.xlsx")
            debt_file = payload(mf_book({"Debt (Specified - Other than Equity) Category": [
                mf_row(Category="Debt"),
            ]}), "synthetic-debt.xlsx")
            page.locator("#files").set_input_files([{
                "name": f["name"], "mimeType": "application/octet-stream",
                "buffer": base64.b64decode(f["base64"]),
            } for f in (etf_file, debt_file)])
            page.locator("#review").click()
            expect(page.locator("#filing-groups")).to_contain_text(
                "Non-equity (Schedule CG A5, slab rate)", timeout=30000)
            expect(page.locator("#filing-groups")).to_contain_text("Not reported")
            with page.expect_download(timeout=30000) as non_equity_download:
                page.locator("#export").click()
            non_equity_book = load_workbook(io.BytesIO(
                Path(non_equity_download.value.path()).read_bytes()))
            assert non_equity_book["Filing groups"]["A2"].value == \
                "Non-equity (Schedule CG A5, slab rate)"
            assert non_equity_book["Filing groups"]["H2"].value is None
            non_equity_map = list(non_equity_book["Filing map"].values)
            assert {row[4] for row in non_equity_map[1:]} >= {
                "cg.consideration", "cg.acquisition_cost", "cg.transfer_expenses",
                "cg.non_equity_net",
            }
            empty_file = payload(stock_book(), "empty.xlsx")
            page.locator("#files").set_input_files({
                "name": empty_file["name"], "mimeType": "application/octet-stream",
                "buffer": base64.b64decode(empty_file["base64"]),
            })
            page.locator("#review").click()
            expect(page.locator("#review-state")).to_contain_text("EMPTY REPORT", timeout=30000)
            expect(page.locator("#manifest")).to_contain_text("no disposal rows")
            page.locator("#files").set_input_files({
                "name": "renamed.xlsx", "mimeType": "application/octet-stream",
                "buffer": base64.b64decode(payload(stock_book(title="P&L Statement for stocks"))["base64"]),
            })
            page.locator("#review").click()
            expect(page.locator("#error")).to_contain_text("P&L reports are not supported", timeout=30000)
            expect(page.locator("#results")).to_be_hidden()
            page.locator("#reset").click()
            assert page.locator("#manifest").text_content() == ""
            assert page.locator("#broker-stcg").text_content() == ""
            assert page.locator("#filing-groups").text_content() == ""
            assert page.locator("#filing-year").text_content() == ""
            scaled = scale_input(1000)
            page.locator("#files").set_input_files({
                "name": scaled["name"], "mimeType": "text/csv",
                "buffer": scaled["text"].encode("utf-8"),
            })
            page.locator("#review").click()
            expect(page.locator("#included")).to_have_text("1000", timeout=30000)
            with page.expect_download(timeout=120000) as scaled_download:
                page.locator("#export").click()
            scaled_book = load_workbook(io.BytesIO(Path(scaled_download.value.path()).read_bytes()))
            assert scaled_book["Disposed lots"].max_row == 1001
            assert scaled_book["Filing map"].max_row == 6001
            assert scaled_book["Source rows"]["C1001"].value == "scale-00999"
            assert scaled_book["Source rows"]["B1001"].value == 1001
            assert scaled_book["Source rows"]["E1001"].data_type == "s"
            assert scaled_book["Summary"]["B7"].value == "-800.00"
            expect(page.locator("#review")).to_be_enabled()
            expect(page.locator("#export")).to_be_enabled()
            assert not failures
            assert all(method == "GET" and body is None for _, method, body in requests)
            assert all(url.startswith(("http://127.0.0.1:", "https://cdn.jsdelivr.net/")) for url, _, _ in requests)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
