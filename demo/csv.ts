/**
 * Small RFC 4180-style CSV reader/writer for lead import and export.
 * Handles quoted fields, escaped quotes, CRLF and a header row.
 */

export type ImportRow = { line: number; name: string; website: string; email: string; city: string; phone: string };

const HEADER_ALIASES: Record<keyof Omit<ImportRow, "line">, string[]> = {
  name: ["name", "business", "business name", "company"],
  website: ["website", "domain", "url", "site"],
  email: ["email", "email address", "contact email"],
  city: ["city", "location", "town"],
  phone: ["phone", "phone number", "telephone"],
};

export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseCsv(text: string, maxRows = 500): { rows: ImportRow[]; errors: string[] } {
  const table = splitCsv(text.replace(/^﻿/, ""));
  const errors: string[] = [];
  if (!table.length) return { rows: [], errors: ["The file is empty."] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (key: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  const idx = { name: col("name"), website: col("website"), email: col("email"), city: col("city"), phone: col("phone") };
  if (idx.name < 0) return { rows: [], errors: ["A “name” column is required."] };
  if (idx.website < 0 && idx.email < 0) return { rows: [], errors: ["Include a “website” or “email” column so leads can be deduplicated."] };
  const rows: ImportRow[] = [];
  table.slice(1, maxRows + 1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: keyof typeof idx) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const name = get("name");
    const email = get("email");
    if (!name) {
      errors.push(`Row ${line}: missing name.`);
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Row ${line}: “${email}” is not a valid email address.`);
      return;
    }
    rows.push({ line, name, website: get("website"), email, city: get("city"), phone: get("phone") });
  });
  if (table.length - 1 > maxRows) errors.push(`Only the first ${maxRows} rows were read.`);
  return { rows, errors };
}

function escapeCell(v: string) {
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | number | null)[][]) {
  return [header, ...rows].map((r) => r.map((c) => escapeCell(c === null ? "" : String(c))).join(",")).join("\r\n");
}
