"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, MailPlus, Trash2, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { changeRoleAction, inviteAction, removeMemberAction, revokeInviteAction } from "@/server/actions/team";
import type { InviteRow, MemberRow } from "@/server/team-store";
import { formatDate } from "@/lib/utils";

const roleTone = { owner: "green", admin: "info", member: "outline", viewer: "neutral" } as const;
const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink scrollbar-thin">{link}</code>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          navigator.clipboard?.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
        }
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

export function InviteForm({ emailOn }: { emailOn: boolean }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"member" | "admin" | "viewer">("member");
  const [error, setError] = React.useState<string | null>(null);
  const [made, setMade] = React.useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <div>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await inviteAction({ email, role });
            if (r.ok) {
              setMade({ email, ...r.value });
              setEmail("");
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <div>
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" type="email" required autoComplete="off" placeholder="teammate@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin" | "viewer")}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer (read-only)</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending || !email}>
          <MailPlus aria-hidden /> {pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
      {error ? <FieldError className="mt-2">{error}</FieldError> : null}
      {made ? (
        <Callout tone="info" title={made.emailed ? `Invite emailed to ${made.email}` : `Invite link for ${made.email}`} className="mt-4">
          <p className="mb-2">
            {made.emailed ? "You can also share this link yourself." : emailOn ? "The email couldn't be sent, so share this link yourself." : "Send them this link. It works once, for that email address, for 7 days."}
          </p>
          <CopyLink link={made.link} />
        </Callout>
      ) : null}
    </div>
  );
}

export function MemberList({ members, me, canManage }: { members: MemberRow[]; me: string; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else after?.();
      router.refresh();
    });
  return (
    <div>
      {error ? <FieldError className="px-5 pt-3">{error}</FieldError> : null}
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const self = m.user_id === me;
          const editable = canManage && m.role !== "owner";
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-soft font-display text-sm font-semibold uppercase text-green">
                {(m.full_name || m.email || "?").charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {m.full_name || m.email} {self ? <span className="font-normal text-slate">(you)</span> : null}
                </span>
                <span className="block truncate text-xs text-slate">
                  {m.full_name ? `${m.email} · ` : ""}joined {formatDate(m.joined_at)}
                </span>
              </span>
              {editable ? (
                <Select
                  aria-label={`Role for ${m.email}`}
                  className="h-9 w-auto"
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => {
                    const role = e.target.value;
                    run(() => changeRoleAction(m.user_id, role));
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </Select>
              ) : (
                <Badge tone={roleTone[m.role as keyof typeof roleTone] ?? "outline"}>{roleLabel(m.role)}</Badge>
              )}
              {self && m.role !== "owner" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Leave this workspace? You'll lose access until someone invites you again.")) run(() => removeMemberAction(m.user_id), () => router.push("/app"));
                  }}
                >
                  <LogOut aria-hidden /> Leave
                </Button>
              ) : editable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Remove ${m.email}`}
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove ${m.email} from this workspace? Their personal agent tokens stop working too.`)) run(() => removeMemberAction(m.user_id));
                  }}
                >
                  <UserMinus aria-hidden /> Remove
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InviteList({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (!invites.length) return <p className="px-5 py-5 text-sm text-slate">No open invites.</p>;
  return (
    <ul className="divide-y divide-line">
      {invites.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{i.email}</span>
            <span className="block text-xs text-slate">
              {roleLabel(i.role)} · sent {formatDate(i.created_at)} · expires {formatDate(i.expires_at)}
            </span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            aria-label={`Revoke invite for ${i.email}`}
            onClick={() =>
              start(async () => {
                await revokeInviteAction(i.id);
                router.refresh();
              })
            }
          >
            <Trash2 aria-hidden /> Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}
