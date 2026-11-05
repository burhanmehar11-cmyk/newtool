import { connection } from "next/server";
import { DatabaseZap } from "lucide-react";
import { missingMigrations } from "@/server/schema-check";

/** Shown at the top of the app when the database is behind the code. */
export async function SchemaBanner() {
  await connection(); // reflects the live database: render at request time
  const missing = await missingMigrations();
  if (!missing.length) return null;
  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-warn-fg/30 bg-warn-bg px-4 py-3 text-sm text-warn-fg">
      <DatabaseZap aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">Database update needed</p>
        <p className="mt-0.5">
          Some pages won&apos;t work until you run {missing.length === 1 ? "this file" : "these files, in order,"} in Neon&apos;s SQL Editor (from <code className="font-mono">database/migrations/</code>):{" "}
          {missing.map((f, i) => (
            <span key={f}>
              <code className="rounded bg-surface/60 px-1 font-mono">{f}</code>
              {i < missing.length - 1 ? ", " : ""}
            </span>
          ))}
          . Each one only adds things, so it&apos;s safe to run on top of earlier ones.
        </p>
      </div>
    </div>
  );
}
