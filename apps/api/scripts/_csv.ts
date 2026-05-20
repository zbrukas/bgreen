// Minimal CSV parser used by seed scripts. Handles quoted fields with
// embedded commas + doubled-quote escapes; auto-detects "," vs ";" and
// UTF-16 LE/BE / UTF-8 BOM encodings. Good enough for the INE / CTT
// open-data files we ingest.

import { readFileSync } from "node:fs";

export function readCsv(path: string): string[][] {
  const buffer = readFileSync(path);
  const text = decodeText(buffer);
  const firstLine = text.split("\n", 1)[0] ?? "";
  const sep = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  return text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line, sep))
    .filter((row) => row.some((cell) => cell.trim() !== ""));
}

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

function parseCsvLine(line: string, sep: string): string[] {
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
    } else if (ch === sep) {
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
