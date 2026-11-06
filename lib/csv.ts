/** CSV reading and writing (RFC 4180 quoting; formula-injection safe on export). */

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

/** Spreadsheets run cells starting with = + - @ (or tab/CR) as formulas: prefix them so they stay text. */
function escapeCell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map((c) => escapeCell(c === null || c === undefined ? "" : String(c))).join(",")).join("\r\n");
}

export type ImportedLead = { line: number; name: string; website: string | null; email: string | null; niche: string | null; place: string | null };

const ALIASES: Record<"name" | "website" | "email" | "niche" | "place", string[]> = {
  name: ["name", "business", "business name", "company", "company name"],
  website: ["website", "url", "site", "web", "domain"],
  email: ["email", "e-mail", "email address", "contact email"],
  niche: ["niche", "type", "business type", "category", "industry"],
  place: ["city", "location", "place", "area", "address"],
};

/** Reads an uploaded leads file. Needs a name and either a website or an email on each row. */
export function parseLeadsCsv(text: string, maxRows = 1000): { rows: ImportedLead[]; errors: string[] } {
  const table = splitCsv(text.replace(/^﻿/, ""));
  if (!table.length) return { rows: [], errors: ["The file is empty."] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (k: keyof typeof ALIASES) => header.findIndex((h) => ALIASES[k].includes(h));
  const idx = { name: col("name"), website: col("website"), email: col("email"), niche: col("niche"), place: col("place") };
  if (idx.name < 0) return { rows: [], errors: ['Add a "name" column (the business name).'] };
  if (idx.website < 0 && idx.email < 0) return { rows: [], errors: ['Add a "website" or "email" column.'] };
  const rows: ImportedLead[] = [];
  const errors: string[] = [];
  const body = table.slice(1);
  if (body.length > maxRows) errors.push(`Only the first ${maxRows} rows are imported.`);
  body.slice(0, maxRows).forEach((r, i) => {
    const line = i + 2;
    const get = (k: number) => (k >= 0 ? (r[k] ?? "").trim() : "");
    const name = get(idx.name).replace(/^'(?=[=+\-@])/, "").slice(0, 200);
    let website: string | null = get(idx.website) || null;
    const emailRaw = get(idx.email).toLowerCase();
    const email = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(emailRaw) ? emailRaw : null;
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    if (website) {
      try {
        const u = new URL(website);
        website = u.hostname.includes(".") ? `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname}` : null;
      } catch {
        website = null;
      }
    }
    if (!name) return void errors.push(`Line ${line}: no name.`);
    if (!website && !email) return void errors.push(`Line ${line}: needs a website or a valid email.`);
    rows.push({ line, name, website, email, niche: get(idx.niche).slice(0, 80) || null, place: get(idx.place).slice(0, 200) || null });
  });
  return { rows, errors };
}
