"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { checkRepliesAction, labelThreadAction, markThreadReadAction } from "@/server/actions/replies";

export function CheckRepliesButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "green" | "danger" | "info"; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await checkRepliesAction();
            setMsg(r.ok ? { tone: r.newReplies ? "green" : "info", text: r.newReplies ? `${r.newReplies} new repl${r.newReplies === 1 ? "y" : "ies"}.` : (r.note ?? "No new replies.") } : { tone: "danger", text: r.error });
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} Check for replies
      </Button>
      {msg ? (
        <Callout tone={msg.tone} className="py-1.5">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
    </div>
  );
}

const options = [
  ["interested", "Interested"],
  ["not_interested", "Not interested"],
  ["out_of_office", "Out of office"],
  ["bounce", "Bounced"],
  ["unclassified", "Needs a look"],
] as const;

export function LabelSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Select
      aria-label="Label this reply"
      value={value}
      disabled={pending}
      className="h-9 w-auto"
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await labelThreadAction(id, v);
          router.refresh();
        });
      }}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );
}

/** Marks the conversation read once it's actually opened (not when prefetched). */
export function MarkRead({ id, unread }: { id: string; unread: boolean }) {
  React.useEffect(() => {
    if (unread) void markThreadReadAction(id);
  }, [id, unread]);
  return null;
}
