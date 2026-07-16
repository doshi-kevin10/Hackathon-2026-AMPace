/** Generates the sample .xlsx fixtures into fixtures/. Run: npm run fixtures */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
mkdirSync(OUT, { recursive: true });

const money = "$#,##0.00";
const pct = "0.0%";
const dmy = "yyyy-mm-dd";

const setZ = (ws, addrs, z) => addrs.forEach((a) => { if (ws[a]) ws[a].z = z; });

const save = (name, wb) => {
  writeFileSync(join(OUT, name), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`wrote fixtures/${name}`);
};

// 1. Simple sales report
{
  const rows = [["Date", "Product", "Region", "Units", "Unit Price", "Revenue"]];
  const products = ["Widget", "Gadget", "Doohickey"];
  const regions = ["East", "West", "North", "South"];
  for (let i = 0; i < 20; i++) {
    const units = 5 + ((i * 7) % 40);
    const price = 9.99 + (i % 4) * 5;
    rows.push([
      new Date(2026, 0, 1 + i),
      products[i % 3],
      regions[i % 4],
      units,
      price,
      Math.round(units * price * 100) / 100,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 2; r <= 21; r++) setZ(ws, [`A${r}`], dmy), setZ(ws, [`E${r}`, `F${r}`], money);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  save("simple-sales.xlsx", wb);
}

// 2. Multi-sheet finance workbook (incl. a hidden sheet)
{
  const wb = XLSX.utils.book_new();
  const rev = XLSX.utils.aoa_to_sheet([
    ["Month", "Product Revenue", "Services Revenue", "Growth"],
    ["Jan", 120000, 45000, 0.05],
    ["Feb", 135000, 47000, 0.08],
    ["Mar", 150000, 52000, 0.11],
    ["Apr", 149000, 55500, -0.01],
  ]);
  setZ(rev, ["B2", "B3", "B4", "B5", "C2", "C3", "C4", "C5"], money);
  setZ(rev, ["D2", "D3", "D4", "D5"], pct);
  XLSX.utils.book_append_sheet(wb, rev, "Revenue");

  const exp = XLSX.utils.aoa_to_sheet([
    ["Category", "Q1 Budget", "Q1 Actual", "Variance"],
    ["Payroll", 300000, 310250.5, -10250.5],
    ["Marketing", 80000, 72300, 7700],
    ["Infrastructure", 45000, 47125.25, -2125.25],
    ["Travel", 20000, 8990, 11010],
  ]);
  setZ(exp, ["B2","B3","B4","B5","C2","C3","C4","C5","D2","D3","D4","D5"], money);
  XLSX.utils.book_append_sheet(wb, exp, "Expenses");

  const sum = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Total Revenue", 753500],
    ["Total Expenses", 438665.75],
    ["Net", 314834.25],
  ]);
  sum["B2"].f = "SUM(Revenue!B2:C5)";
  sum["B3"].f = "SUM(Expenses!C2:C5)";
  sum["B4"].f = "B2-B3";
  setZ(sum, ["B2", "B3", "B4"], money);
  XLSX.utils.book_append_sheet(wb, sum, "Summary");

  const notes = XLSX.utils.aoa_to_sheet([["Internal", "Do not distribute"], ["Draft v3", true]]);
  XLSX.utils.book_append_sheet(wb, notes, "InternalNotes");
  wb.Workbook = { Sheets: [{}, {}, {}, { Hidden: 1 }].map((s, i) => ({ name: wb.SheetNames[i], ...s })) };
  save("finance-multi-sheet.xlsx", wb);
}

// 3. Two tables on one sheet (blank rows) + two side by side (blank columns)
{
  const wb = XLSX.utils.book_new();
  const stacked = XLSX.utils.aoa_to_sheet([
    ["Product", "Units", "Revenue"],
    ["Widget", 120, 1188],
    ["Gadget", 80, 1592],
    ["Doohickey", 45, 675],
    [],
    [],
    ["Region", "Salespeople", "Quota Met"],
    ["East", 12, true],
    ["West", 9, false],
    ["North", 7, true],
  ]);
  XLSX.utils.book_append_sheet(wb, stacked, "Stacked");

  const sideBySide = XLSX.utils.aoa_to_sheet([
    ["Team", "Wins", null, "Player", "Goals"],
    ["Reds", 14, null, "Ana", 21],
    ["Blues", 11, null, "Bo", 17],
    ["Greens", 9, null, "Cy", 12],
    ["Golds", 7, null, null, null],
  ]);
  XLSX.utils.book_append_sheet(wb, sideBySide, "SideBySide");
  save("two-tables-one-sheet.xlsx", wb);
}

// 4. Messy workbook: titles, notes, blank rows, offset origin, irregular rows, hidden row/col
{
  const ws = XLSX.utils.aoa_to_sheet([
    [],
    [null, "ACME Corp — Regional Performance"],
    [null, "Prepared by Finance, confidential"],
    [],
    [null, "Region", "Jan", "Feb", "Mar", "Total"],
    [null, "East", 100, 110, 120, 330],
    [null, "West", 90, null, 105, 195],
    [null, "North", 80, 85, null, 165],
    [null, "South", null, null, 60, 60],
    [],
    [null, "* March numbers preliminary"],
  ]);
  ws["!rows"] = [{}, {}, {}, {}, {}, {}, { hidden: true }];
  ws["!cols"] = [{ hidden: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  save("messy-report.xlsx", wb);
}

// 5. Merged cells: merged title + two-row header with merged group cells
{
  const ws = XLSX.utils.aoa_to_sheet([
    ["FY2026 Plan", null, null, null, null],
    ["Department", "H1", null, "H2", null],
    [null, "Budget", "Actual", "Budget", "Actual"],
    ["Engineering", 500000, 480000, 520000, 0],
    ["Sales", 300000, 310000, 305000, 0],
    ["Support", 150000, 149000, 155000, 0],
  ]);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // title across all columns
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }, // H1 group
    { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } }, // H2 group
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }, // Department spans both header rows
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan");
  save("merged-cells.xlsx", wb);
}

// 6. Formulas (cached values only — never evaluated by the parser)
{
  const ws = XLSX.utils.aoa_to_sheet([
    ["Item", "Qty", "Price", "Line Total"],
    ["Paper", 10, 4.5, 45],
    ["Toner", 2, 89.99, 179.98],
    ["Stapler", 5, 12.25, 61.25],
    ["TOTAL", null, null, 286.23],
  ]);
  ["D2", "D3", "D4"].forEach((a, i) => (ws[a].f = `B${i + 2}*C${i + 2}`));
  ws["D5"].f = "SUM(D2:D4)";
  setZ(ws, ["C2", "C3", "C4", "D2", "D3", "D4", "D5"], money);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  save("formulas.xlsx", wb);
}

// 0. Ad performance report (canonical columns demo: derives Day, CPC, ROAS, CVR)
{
  const rows = [["Date", "Spend", "Clicks", "Revenue", "Conversions"]];
  for (let i = 0; i < 14; i++) {
    const clicks = 800 + ((i * 137) % 600);
    const spend = Math.round(clicks * (0.45 + (i % 5) * 0.06) * 100) / 100;
    const conv = 20 + ((i * 7) % 30);
    const revenue = Math.round(conv * (38 + (i % 4) * 6) * 100) / 100;
    rows.push([new Date(2026, 6, 1 + i), spend, clicks, revenue, conv]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 2; r <= 15; r++) {
    setZ(ws, [`A${r}`], dmy);
    setZ(ws, [`B${r}`, `D${r}`], money);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daily Performance");
  save("ad-performance.xlsx", wb);
}

// 7. Duplicate headers
{
  const ws = XLSX.utils.aoa_to_sheet([
    ["Revenue", "Revenue", "", "Margin", "Margin"],
    [1200, 1300, "note a", 0.21, 0.22],
    [1500, 1250, "note b", 0.24, 0.19],
    [1100, 1400, "note c", 0.18, 0.25],
  ]);
  setZ(ws, ["D2", "D3", "D4", "E2", "E3", "E4"], pct);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Metrics");
  save("duplicate-headers.xlsx", wb);
}
