"use strict";
const $ = id => document.getElementById(id);
const RUNTIME = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";
let inputs = [];
let result = null;
let runtimePromise = null;
let workbookToolsPromise = null;
let busy = false;
let revision = 0;

function controls() {
  $("review").disabled = busy || inputs.length === 0;
  $("export").disabled = busy || result === null;
  $("sample").disabled = busy;
  $("files").disabled = busy;
  $("fy").disabled = busy;
  $("reset").disabled = busy;
}
function invalidate() {
  revision++;
  result = null;
  $("results").hidden = true;
  $("intraday-warning").hidden = true;
  $("intraday-warning").textContent = "";
  $("lots").replaceChildren();
  $("manifest").replaceChildren();
  $("filing-groups").replaceChildren();
  $("filing-year").textContent = "";
  for (const id of ["stcg", "ltcg", "included", "blocked", "broker-stcg", "broker-ltcg", "broker-count", "review-state"]) {
    $(id).textContent = "";
  }
  $("error").hidden = true;
  $("status").textContent = "";
  controls();
}
function fail(error) {
  console.error(error);
  $("error").textContent = error.message || String(error);
  $("error").hidden = false;
}
async function textResource(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}. Serve the project root over HTTP.`);
  return response.text();
}
async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      $("status").textContent = "Loading the public Python runtime. Your financial data stays in this tab...";
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `${RUNTIME}pyodide.js`;
          script.onload = resolve;
          script.onerror = () => { script.remove(); reject(new Error("Runtime download failed. Check internet access to cdn.jsdelivr.net, then retry.")); };
          document.head.append(script);
        });
      }
      const py = await window.loadPyodide({ indexURL: RUNTIME });
      const [core, groww, filing] = await Promise.all([
        textResource("./stock_assist/core.py"), textResource("./stock_assist/groww.py"),
        textResource("./stock_assist/filing.py"),
      ]);
      py.FS.mkdirTree("/home/pyodide/stock_assist");
      py.FS.writeFile("/home/pyodide/stock_assist/__init__.py", "");
      py.FS.writeFile("/home/pyodide/stock_assist/core.py", core);
      py.FS.writeFile("/home/pyodide/stock_assist/groww.py", groww);
      py.FS.writeFile("/home/pyodide/stock_assist/filing.py", filing);
      await py.runPythonAsync("from stock_assist.core import review, workbook_bytes");
      return py;
    })().catch(error => { runtimePromise = null; throw error; });
  }
  return runtimePromise;
}
async function workbookTools(py) {
  if (!workbookToolsPromise) {
    workbookToolsPromise = (async () => {
      await py.loadPackage("micropip");
      py.globals.set("wheel_urls", JSON.stringify([
        new URL("./web/vendor/et_xmlfile-2.0.0-py3-none-any.whl", document.baseURI).href,
        new URL("./web/vendor/openpyxl-3.1.5-py2.py3-none-any.whl", document.baseURI).href,
      ]));
      await py.runPythonAsync(`
import micropip
import json
try:
    await micropip.install(json.loads(wheel_urls), deps=False)
finally:
    wheel_urls = None
`);
    })().catch(error => { workbookToolsPromise = null; throw error; });
  }
  return workbookToolsPromise;
}
function render(data) {
  $("stcg").textContent = data.totals.STCG;
  $("ltcg").textContent = data.totals.LTCG;
  $("included").textContent = data.included;
  $("blocked").textContent = data.blocked;
  $("broker-stcg").textContent = data.broker_totals.STCG;
  $("broker-ltcg").textContent = data.broker_totals.LTCG;
  $("broker-count").textContent = data.broker_review;
  $("broker-summary").hidden = !data.imports.some(item => item.format !== "canonical_csv");
  $("filing-year").textContent = data.filing.year_note;
  $("intraday-warning").textContent = data.business_income_warning;
  $("intraday-warning").hidden = !data.intraday_present;
  $("filing-groups").replaceChildren(...data.filing.groups.map(group => {
    const tr = document.createElement("tr");
    for (const value of [group.schedule, group.period, group.basis, group.status,
      group.proceeds, group.cost, group.expenses ?? "Not reported",
      group.positive_gains, group.losses, group.net]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    return tr;
  }));
  const empty = data.records.length === 0;
  $("review-state").textContent = `FY ${data.fy} / AY ${data.ay}. ${empty ? "EMPTY REPORT: no disposed lots found. This is not evidence of a complete financial-year reconciliation." : data.blocked ? "INCOMPLETE: pending verification, unsupported and out-of-year lots are excluded from working-paper totals. See separate provisional broker summary." : "All rows included, subject to verification against your broker report."} Net gains are not final tax liability.`;
  $("manifest").replaceChildren(...data.imports.map(item => {
    const li = document.createElement("li");
    li.textContent = `${item.source_file}${item.source_sheet ? ` / ${item.source_sheet}` : ""}: ${item.rows} disposal rows / ${item.outcome}`;
    return li;
  }));
  const fragment = document.createDocumentFragment();
  for (const record of data.records.slice(0, 200)) {
    const tr = document.createElement("tr");
    const values = [
      [record.raw.asset_name, `${record.source_file} / ${record.source_sheet ? `${record.source_sheet} row` : "line"} ${record.source_line}${record.scheme_code ? ` / scheme ${record.scheme_code}` : ""}`],
      [record.raw.buy_date, record.raw.sell_date],
      [record.status, record.term || "Not calculated"],
      [record.gain || "--", record.broker_gain !== undefined ? `Broker: ${record.broker_gain || "missing"} / Gross: ${record.gross_gain || "unavailable"}` : ""],
      [record.issues.join(" ") || "Confirmed cost and expenses; verify source allocations.", record.reconciliation || ""],
    ];
    values.forEach(([main, detail], index) => {
      const td = document.createElement("td");
      const label = document.createElement("span");
      label.textContent = main;
      if (index === 2) label.className = `tag ${record.status !== "INCLUDED" ? "blocked" : ""}`;
      td.append(label);
      if (detail) {
        const small = document.createElement("small");
        small.textContent = detail;
        td.append(small);
      }
      tr.append(td);
    });
    fragment.append(tr);
  }
  $("lots").replaceChildren(fragment);
  $("results").hidden = false;
}
$("files").addEventListener("change", async event => {
  invalidate();
  inputs = [];
  const version = revision;
  const files = [...event.target.files];
  busy = true;
  controls();
  try {
    if (files.length > 10) throw new Error("Select no more than 10 files.");
    if (files.some(file => file.size > 2000000)) throw new Error("Each file must be at most 2 MB.");
    if (files.some(file => !/\.(csv|xlsx)$/i.test(file.name))) throw new Error("Select canonical CSV or Groww capital-gains XLSX. PDF, legacy XLS and P&L reports are unsupported.");
    const loaded = await Promise.all(files.map(async file => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 32768) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        }
        return { name: file.name, base64: btoa(binary) };
      }
      return { name: file.name, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    }));
    if (version !== revision) return;
    inputs = loaded;
    $("file-summary").textContent = files.length ? files.map(file => file.name).join(" / ") : "No files selected.";
  } catch (error) {
    $("file-summary").textContent = "Import failed. Choose canonical CSV or Groww capital-gains XLSX files again.";
    fail(error);
  } finally { busy = false; controls(); }
});
$("fy").addEventListener("change", invalidate);
$("reset").addEventListener("click", () => {
  inputs = [];
  $("files").value = "";
  $("file-summary").textContent = "Session cleared. No financial data is persisted by this app.";
  invalidate();
});
$("sample").addEventListener("click", async () => {
  invalidate();
  inputs = [];
  busy = true;
  controls();
  try {
    inputs = [{ name: "canonical-demo.csv", text: await textResource("./samples/canonical-demo.csv") }];
    $("files").value = "";
    $("fy").value = "2025-26";
    $("file-summary").textContent = "Synthetic demonstration loaded / 3 included lots and 1 intentionally blocked lot. Click Review capital gains.";
  } catch (error) { fail(error); }
  finally { busy = false; controls(); }
});
$("review").addEventListener("click", async () => {
  invalidate();
  busy = true;
  controls();
  try {
    const py = await runtime();
    if (inputs.some(file => file.base64 !== undefined)) await workbookTools(py);
    py.globals.set("input_json", JSON.stringify(inputs));
    py.globals.set("selected_fy", $("fy").value);
    const output = await py.runPythonAsync(`
import json
try:
    reviewed = review(json.loads(input_json), selected_fy)
    output_json = json.dumps(reviewed)
finally:
    input_json = None
output_json
`);
    result = JSON.parse(output);
    py.globals.delete("reviewed");
    py.globals.delete("output_json");
    render(result);
    $("status").textContent = "Review ready. Blocked rows remain visible and are preserved in the workbook.";
  } catch (error) { fail(error); }
  finally { busy = false; controls(); }
});
$("export").addEventListener("click", async () => {
  busy = true;
  controls();
  $("error").hidden = true;
  try {
    const py = await runtime();
    $("status").textContent = "Loading workbook tools and preparing your local XLSX...";
    await workbookTools(py);
    py.globals.set("result_json", JSON.stringify(result));
    const proxy = await py.runPythonAsync(`
try:
    export_data = workbook_bytes(json.loads(result_json))
finally:
    result_json = None
export_data
`);
    let bytes;
    try { bytes = proxy.toJs(); } finally { proxy.destroy(); py.globals.delete("export_data"); }
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ITR-Stock-Assist-FY-${result.fy}${result.records.length === 0 ? "-EMPTY" : result.blocked ? "-INCOMPLETE" : ""}.xlsx`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("status").textContent = "Workbook downloaded. It is a working paper, not a filing-ready tax return.";
  } catch (error) { fail(error); }
  finally { busy = false; controls(); }
});
