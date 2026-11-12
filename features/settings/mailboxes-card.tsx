"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Plus, Send, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { disconnectMailboxAction, saveMailboxSettingsAction, sendTestEmailAction } from "@/server/actions/mailboxes";
import type { MailboxRow } from "@/server/mailbox-store";
import { hasReadScope } from "@/lib/gmail/oauth";
import { formatDateTime } from "@/lib/utils";
import { ConnectMailboxSheet, type ConnectStart } from "@/features/settings/connect-mailbox";
import type { MailPreset } from "@/lib/mail/presets";

const errorText: Record<string, string> = {
  google_retired: "Locenti no longer connects through Google sign-in. Connect the mailbox with an App Password instead (Add mailbox → Gmail / Google Workspace).",
  not_configured: "Gmail connection isn't set up on this server yet (Google sign-in settings are missing).",
  not_allowed: "Only workspace owners and admins can connect mailboxes.",
  cancelled: "You cancelled on Google's screen. Nothing was connected.",
  google: "Google returned an error. If it says the app isn't verified or you aren't a test user, add this Gmail address as a test user in Google Cloud.",
  state: "The connection link expired or was opened in another browser. Try again.",
  exchange: "Google didn't complete the connection. Check that the Gmail redirect URI is added to the OAuth client, then try again.",
  token: "Google's answer couldn't be verified. Try again.",
  no_send_permission: "The “Send email on your behalf” box was unticked on Google's screen, so Locenti can't send. Connect again and leave it ticked.",
  no_refresh_token: "Google didn't grant lasting access. Remove Locenti at myaccount.google.com/permissions, then connect again.",
  server: "Couldn't save the connection. Try again.",
};

const statusBadge = {
  connected: <Badge tone="green">Connected</Badge>,
  needs_reconnect: <Badge tone="warn">Needs reconnecting</Badge>,
  revoked: <Badge tone="danger">Access removed</Badge>,
  disconnected: <Badge tone="neutral">Disconnected</Badge>,
} as const;

/** Opens the "Add mailbox" panel from anywhere on the card. */
const ConnectContext = React.createContext<(s: ConnectStart) => void>(() => {});

export function MailboxesCard({ mailboxes, canEdit, notice }: { mailboxes: MailboxRow[]; canEdit: boolean; notice: { connected?: string; error?: string; repliesOff?: boolean; openConnect?: boolean } }) {
  const [open, setOpen] = React.useState(!!notice.openConnect && canEdit);
  const [start, setStart] = React.useState<ConnectStart>(null);
  const openWith = React.useCallback((s: ConnectStart) => {
    setStart(s);
    setOpen(true);
  }, []);
  return (
    <ConnectContext.Provider value={openWith}>
    <div className="space-y-4">
      <ConnectMailboxSheet open={open} onOpenChange={setOpen} start={start} />
      {notice.connected ? (
        <Callout tone="green" title="Mailbox connected">
          {notice.connected} is connected. Send a test email to yourself to check it works.
          {notice.repliesOff ? " Reply tracking is off because IMAP didn't work: turn IMAP on in your email settings, then press “Turn on” next to Reply tracking." : ""}
        </Callout>
      ) : null}
      {notice.error ? (
        <Callout tone="danger" title="Couldn't connect the mailbox">
          {errorText[notice.error] ?? "Something went wrong. Try again."}
        </Callout>
      ) : null}

      {mailboxes.length ? (
        <ul className="space-y-3">
          {mailboxes.map((m) => (
            <MailboxItem key={m.id} m={m} canEdit={canEdit} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate">
          No mailbox yet. Connect the email address you send from (Gmail, Google Workspace, Zoho, Hostinger or any IMAP/SMTP mailbox) with an App Password. It takes about two minutes.
        </p>
      )}

      {canEdit ? (
        <Button variant={mailboxes.length ? "secondary" : "primary"} onClick={() => openWith(null)}>
          <Plus aria-hidden /> {mailboxes.length ? "Add another mailbox" : "Add mailbox"}
        </Button>
      ) : (
        <p className="text-xs text-slate">Ask a workspace owner or admin to connect a mailbox.</p>
      )}
      <p className="text-xs leading-5 text-slate">Locenti sends nothing on its own: only campaigns you approve, and the test email to yourself.</p>
    </div>
    </ConnectContext.Provider>
  );
}

function startFor(m: MailboxRow): ConnectStart {
  const preset = (m.preset as MailPreset["id"] | null) ?? (m.provider === "gmail" || /@(gmail|googlemail)\.com$/.test(m.email) ? "google" : null);
  return { preset: preset ?? undefined, email: m.email, senderName: m.sender_name ?? undefined };
}

function MailboxItem({ m, canEdit }: { m: MailboxRow; canEdit: boolean }) {
  const router = useRouter();
  const openConnect = React.useContext(ConnectContext);
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "green" | "danger"; text: string } | null>(null);
  const [cap, setCap] = React.useState(String(m.daily_cap));
  const [name, setName] = React.useState(m.sender_name ?? "");
  const dirty = cap !== String(m.daily_cap) || name !== (m.sender_name ?? "");

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { tone: "green", text: okText } : { tone: "danger", text: r.error });
      router.refresh();
    });

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm text-ink">{m.email}</span>
          <span className="block text-xs text-slate">
            {m.provider === "smtp" ? "App Password · " : "Google sign-in (old) · "}
            {m.last_tested_at ? `last test email ${formatDateTime(m.last_tested_at)} UTC` : "not tested yet"}
          </span>
        </span>
        {statusBadge[m.status]}
      </div>
      {m.last_error ? <p className="mt-2 text-xs text-danger-fg">{m.last_error}</p> : null}
      {m.provider === "gmail" && canEdit ? (
        <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn-fg">
          This mailbox uses the old Google sign-in connection, which is being retired. Switch it to an App Password so sending keeps working.{" "}
          <button type="button" className="font-semibold underline" onClick={() => openConnect(startFor(m))}>
            Switch now
          </button>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
        <span className="text-xs text-slate">
          <span className="font-medium text-ink">Reply tracking: {hasReadScope(m.scopes) ? "on" : "off"}</span>
          {hasReadScope(m.scopes)
            ? ` · ${m.last_synced_at ? `checked ${formatDateTime(m.last_synced_at)} UTC` : "not checked yet"}`
            : " · lets Locenti see replies to campaign emails (over IMAP), sort them and stop emailing people who say no"}
        </span>
        {canEdit && !hasReadScope(m.scopes) && m.status === "connected" ? (
          <Button size="sm" variant="secondary" onClick={() => openConnect(startFor(m))}>
            Turn on
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${m.id}`}>From name</Label>
            <Input id={`name-${m.id}`} value={name} maxLength={80} placeholder="e.g. Sam from Northline" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cap-${m.id}`}>Daily limit</Label>
            <Input id={`cap-${m.id}`} type="number" min={1} max={200} value={cap} onChange={(e) => setCap(e.target.value)} />
          </div>
          <FieldHint className="sm:col-span-2">Keep new mailboxes low (10–25 a day) and raise slowly. Campaigns never send more than this per day from this address.</FieldHint>
        </div>
      ) : null}

      {msg ? (
        <Callout tone={msg.tone} className="mt-3 py-1.5">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {m.status === "connected" ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
            const r = await sendTestEmailAction(m.id);
            setMsg(r.ok ? { tone: "green", text: `Test email sent to ${r.to}. Check that inbox.` } : { tone: "danger", text: r.error });
            router.refresh();
          })}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send test email to myself
          </Button>
        ) : canEdit ? (
          <Button size="sm" onClick={() => openConnect(startFor(m))}>
            <KeyRound aria-hidden /> {m.provider === "smtp" ? "Update password" : "Reconnect with App Password"}
          </Button>
        ) : null}
        {canEdit && dirty ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => saveMailboxSettingsAction(m.id, { dailyCap: Number(cap), senderName: name }), "Saved.")}>
            Save
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (confirm(`Disconnect ${m.email}? Locenti stops sending from it and deletes its saved password.`)) run(() => disconnectMailboxAction(m.id), "Disconnected.");
            }}
          >
            <Unplug aria-hidden /> Disconnect
          </Button>
        ) : null}
      </div>
    </li>
  );
}
