"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { addAdminAction, removeAdminAction } from "@/server/actions/admin";

/** Owners: add someone as an admin by email. */
export function AddAdminForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="space-y-2 border-t border-line px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addAdminAction(email);
          setMsg(r.ok ? { ok: true, text: `${email} is now an admin.${r.emailed ? " We emailed them the link." : " Send them the link: locenti.com/admin."}` } : { ok: false, text: r.error });
          if (r.ok) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <label htmlFor="add-admin" className="text-sm font-medium text-ink">
        Give admin access
      </label>
      <div className="flex gap-2">
        <Input id="add-admin" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" required />
        <Button type="submit" disabled={pending || !email.includes("@")}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <UserPlus aria-hidden />} Add
        </Button>
      </div>
      <p className="text-xs text-slate">They get everything in this panel except adding or removing admins. They sign in to Locenti with this email, then open locenti.com/admin.</p>
      {msg ? (
        <p role="status" className={msg.ok ? "text-sm text-green" : "text-sm text-danger-fg"}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveAdminButton({ email }: { email: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Remove admin access from ${email}`}
      onClick={() => {
        if (!confirm(`Remove admin access from ${email}?`)) return;
        start(async () => {
          const r = await removeAdminAction(email);
          if (!r.ok) alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <X aria-hidden />} Remove
    </Button>
  );
}
