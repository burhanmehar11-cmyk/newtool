"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { replySupportAction, resolveSupportAction } from "@/server/actions/support";

/** Reply box and "Mark as solved" on a request. */
export function ReplyBox({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={resolved ? "Write to reopen this request…" : "Write a reply…"} aria-label="Your reply" maxLength={10000} />
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || body.trim().length < 2}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await replySupportAction(id, body);
              if (r.ok) {
                setBody("");
                router.refresh();
              } else setError(r.error);
            })
          }
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send reply
        </Button>
        {!resolved ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await resolveSupportAction(id);
                router.refresh();
              })
            }
          >
            <CheckCircle2 aria-hidden /> Mark as solved
          </Button>
        ) : null}
        <Link href="/app/support" className="ml-auto text-sm font-medium">
          All requests
        </Link>
      </div>
    </div>
  );
}
