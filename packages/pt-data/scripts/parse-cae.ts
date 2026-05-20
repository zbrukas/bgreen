// Parse the raw INE CAE spreadsheet (or CSV) into a canonical JSON catalog
// committed at src/cae-data.json.
//
// CSV files are parsed as raw text so leading-zero codes (01, 011, 0111…)
// survive — xlsx's CSV reader silently coerces "01" → 1, which would
// drop entire sections of the CAE hierarchy.
//
// XLSX/XLS files use the xlsx package's normal binary reader. The
// (code, description) heuristic mirrors the CSV path.
//
// Run via: pnpm --filter @bgreen/pt-data parse-cae

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = resolve(here, "../raw");
const outPath = resolve(here, "../src/cae-data.json");

const candidates = readdirSync(rawDir)
  .filter((name) => /\.(xls|xlsx|csv)$/i.test(name))
  .map((name) => resolve(rawDir, name))
  .filter((path) => statSync(path).isFile());

if (candidates.length === 0) {
  console.error(
    "No CAE source file in packages/pt-data/raw/. Drop the INE CAE XLSX/CSV there and re-run.",
  );
  process.exit(1);
}

const inputPath = candidates[0];
if (!inputPath) {
  console.error("Failed to resolve input path.");
  process.exit(1);
}
console.log(`Parsing ${inputPath}…`);

function decodeText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  }
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch ?? "";
      }
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else if (ch === '"' && current === "") {
      inQuotes = true;
    } else {
      current += ch ?? "";
    }
  }
  fields.push(current);
  return fields;
}

function rowsFromInput(path: string): string[][] {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") {
    const text = decodeText(readFileSync(path));
    return text
      .split(/\r?\n/)
      .map((line) => parseCsvLine(line.trim()))
      .filter((row) => row.some((cell) => cell !== ""));
  }
  const workbook = XLSX.readFile(path);
  const result: string[][] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
    for (const row of rows) {
      if (Array.isArray(row)) {
        result.push(row.map((c) => (c == null ? "" : String(c))));
      }
    }
  }
  return result;
}

const entries = new Map<string, string>();
const rows = rowsFromInput(inputPath);

for (const row of rows) {
  let code: string | null = null;
  let description: string | null = null;
  for (const cell of row) {
    const value = cell.trim();
    if (value === "") continue;
    if (code === null && /^\d{2,5}$/.test(value)) {
      code = value;
    } else if (description === null && value.length > 5 && /[A-Za-zÀ-ÿ]/.test(value)) {
      description = value;
    }
    if (code !== null && description !== null) break;
  }
  if (code && description && !entries.has(code)) {
    entries.set(code, description);
  }
}

const sorted = [...entries.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, description]) => ({ code, description }));

writeFileSync(outPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Wrote ${sorted.length} CAE entries → ${outPath}`);
