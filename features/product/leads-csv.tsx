"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportLeadsAction, importLeadsAction } from "@/server/actions/leads-io";

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export all leads as CSV, or import leads from a CSV (name + website and/or email). */
export function LeadsCsvButtons({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const file = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<null | "export" | "import">(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!!busy}
          onClick={async () => {
            setBusy("export");
            setMsg(null);
            const r = await exportLeadsAction();
            setBusy(null);
            if (r.ok) download(r.filename, r.csv);
            else setMsg({ ok: false, text: r.error });
          }}
        >
          {busy === "export" ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />} Export CSV
        </Button>
        {canImport ? (
          <>
            <Button variant="secondary" disabled={!!busy} onClick={() => file.current?.click()}>
              {busy === "import" ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />} Import CSV
            </Button>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="CSV file to import"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 2_000_000) return setMsg({ ok: false, text: "The file is too large (2 MB at most)." });
                setBusy("import");
                setMsg(null);
                const r = await importLeadsAction(await f.text());
                setBusy(null);
                if (r.ok) {
                  setMsg({ ok: true, text: `Imported ${r.added} lead${r.added === 1 ? "" : "s"}${r.skipped ? `, ${r.skipped} already in Leads` : ""}${r.errors.length ? `; ${r.errors.length} row${r.errors.length === 1 ? "" : "s"} skipped (${r.errors[0]})` : ""}.` });
                  router.refresh();
                } else setMsg({ ok: false, text: r.error });
              }}
            />
          </>
        ) : null}
      </div>
      {msg ? <p className={`max-w-sm text-right text-xs ${msg.ok ? "text-green" : "text-danger-fg"}`}>{msg.text}</p> : null}
      {canImport ? <p className="text-[11px] text-slate">CSV columns: name, website and/or email (optional: type, city)</p> : null}
    </div>
  );
}
