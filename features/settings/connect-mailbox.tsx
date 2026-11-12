"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Eye, EyeOff, KeyRound, Loader2, Mail, Plus, RefreshCw, Server, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Dialog, SheetCloseButton, SheetContent } from "@/components/ui/sheet";
import { MAIL_PRESETS, findPreset, type MailPreset } from "@/lib/mail/presets";
import { cn } from "@/lib/utils";
import { addSmtpMailboxAction, testMailboxConnectionAction } from "@/server/actions/mailboxes";

/**
 * "Add mailbox": connect the address campaigns send from with an App Password
 * (SMTP to send, IMAP to see replies). For Google, Zoho and Hostinger the
 * server names are filled in; "Custom" takes any IMAP/SMTP server.
 */

export type ConnectStart = { preset?: MailPreset["id"]; email?: string; senderName?: string } | null;

const ICON: Record<MailPreset["id"], React.ReactNode> = {
  google: <span className="text-lg font-bold text-[#EA4335]">G</span>,
  zoho: <Mail aria-hidden className="size-5 text-[#E42527]" />,
  hostinger: <Mail aria-hidden className="size-5 text-[#673DE6]" />,
  custom: <Server aria-hidden className="size-5 text-slate" />,
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-medium text-green underline-offset-2 hover:underline">
    {children}
  </a>
);

function Steps({ preset }: { preset: MailPreset["id"] }) {
  if (preset === "google")
    return (
      <>
        <div className="rounded-2xl border border-green/30 bg-mint-soft/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles aria-hidden className="size-4 text-green" /> Two things make a Google mailbox work
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-green/30 bg-surface p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-green">
                <CheckCircle2 aria-hidden className="size-4" /> Server names: we handle these
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate">
                Google uses one address for sending and another for receiving. We fill in both (<code className="font-mono">smtp.gmail.com</code> to send, <code className="font-mono">imap.gmail.com</code> to receive). Nothing for you to type.
              </p>
            </div>
            <div className="rounded-xl border border-warn-fg/30 bg-surface p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-warn-fg">
                <KeyRound aria-hidden className="size-4" /> App Password: you create this
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate">Google won&apos;t accept your normal password. Turn on 2-Step Verification, then create a 16-character App Password and paste it below. Steps are right underneath.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-canvas/60 p-4">
          <p className="text-sm font-semibold text-ink">Gmail / Google Workspace setup</p>
          <p className="mt-0.5 text-xs text-slate">Do these in your Google account first:</p>
          <ol className="mt-3 space-y-2.5 text-sm text-ink">
            <li>
              <span className="font-semibold">1. Turn on IMAP:</span> <A href="https://mail.google.com/mail/u/0/#settings/fwdandpop">Gmail Settings → Forwarding and POP/IMAP</A>
            </li>
            <li>
              <span className="font-semibold">2. Turn on 2-Step Verification (needed first):</span> <A href="https://myaccount.google.com/signinoptions/two-step-verification">Google Account → 2-Step Verification</A>
            </li>
            <li>
              <span className="font-semibold">3. Create an App Password:</span> <A href="https://myaccount.google.com/apppasswords">Google Account → App passwords</A> (any name, e.g. “Locenti”)
            </li>
          </ol>
          <div className="mt-3 rounded-xl border border-warn-fg/30 bg-warn-bg/60 p-3 text-xs leading-5 text-ink">
            <p className="font-semibold text-warn-fg">Seeing “setting not available” or a blank page on step 3?</p>
            <p className="mt-1">
              Do step 2 first: Google only shows App Passwords once 2-Step Verification is on. Open <A href="https://myaccount.google.com/signinoptions/two-step-verification">2-Step Verification</A>, turn it on, then try step 3 again.
            </p>
            <p className="mt-1">Google Workspace: your admin may need to allow App Passwords. Ask them if it still doesn&apos;t show after turning on 2-Step Verification.</p>
          </div>
        </div>
      </>
    );
  if (preset === "zoho")
    return (
      <div className="rounded-2xl border border-line bg-canvas/60 p-4">
        <p className="text-sm font-semibold text-ink">Zoho Mail setup</p>
        <p className="mt-0.5 text-xs text-slate">We fill in smtp.zoho.com and imap.zoho.com. In Zoho:</p>
        <ol className="mt-3 space-y-2.5 text-sm text-ink">
          <li>
            <span className="font-semibold">1. Turn on IMAP:</span> Zoho Mail → Settings → Mail Accounts → IMAP Access.
          </li>
          <li>
            <span className="font-semibold">2. Two-factor sign-in on?</span> Create an App Password: <A href="https://accounts.zoho.com/home#security/app_password">Zoho Accounts → Security → App Passwords</A>, and use it below.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate">Account in Europe or India (zoho.eu / zoho.in)? Use “Custom IMAP/SMTP” with smtp.zoho.eu / imap.zoho.eu (or .in).</p>
      </div>
    );
  if (preset === "hostinger")
    return (
      <div className="rounded-2xl border border-line bg-canvas/60 p-4">
        <p className="text-sm font-semibold text-ink">Hostinger Email setup</p>
        <p className="mt-0.5 text-xs text-slate">We fill in smtp.hostinger.com and imap.hostinger.com.</p>
        <p className="mt-3 text-sm text-ink">Use the email account&apos;s own password. Forgot it? Reset it in Hostinger hPanel → Emails → your domain → Email accounts.</p>
      </div>
    );
  return (
    <div className="rounded-2xl border border-line bg-canvas/60 p-4 text-sm text-ink">
      <p className="font-semibold">Any IMAP/SMTP mailbox</p>
      <p className="mt-1 text-xs leading-5 text-slate">Your email provider&apos;s help pages list these as “IMAP/SMTP settings” or “email client settings” (cPanel: Email Accounts → Connect Devices).</p>
    </div>
  );
}

type Check = { smtp: "ok" | string; imap: "ok" | string } | null;

export function ConnectMailboxSheet({ open, onOpenChange, start }: { open: boolean; onOpenChange: (v: boolean) => void; start: ConnectStart }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Add mailbox" className="max-w-[min(100vw,560px)]">
        {open ? <ConnectFlow key={JSON.stringify(start)} start={start} close={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Dialog>
  );
}

function ConnectFlow({ start, close }: { start: ConnectStart; close: () => void }) {
  const router = useRouter();
  const [preset, setPreset] = React.useState<MailPreset["id"] | null>(start?.preset ?? null);
  const p = preset ? findPreset(preset) : null;
  const [email, setEmail] = React.useState(start?.email ?? "");
  const [name, setName] = React.useState(start?.senderName ?? "");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [smtpHost, setSmtpHost] = React.useState("");
  const [smtpPort, setSmtpPort] = React.useState("465");
  const [imapHost, setImapHost] = React.useState("");
  const [imapPort, setImapPort] = React.useState("993");
  const [username, setUsername] = React.useState("");
  const [check, setCheck] = React.useState<Check>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"test" | "add" | null>(null);
  const updating = !!start?.email;

  const input = () => ({
    preset,
    email,
    senderName: name,
    password,
    username: username || undefined,
    smtp: preset === "custom" ? { host: smtpHost, port: Number(smtpPort), secure: smtpPort !== "587" && smtpPort !== "25" && smtpPort !== "2525" } : undefined,
    imap: preset === "custom" ? (imapHost ? { host: imapHost, port: Number(imapPort), secure: imapPort !== "143" } : null) : undefined,
  });

  const test = async () => {
    setBusy("test");
    setError(null);
    setCheck(null);
    const r = await testMailboxConnectionAction(input());
    setBusy(null);
    if (!r.ok) {
      setCheck({ smtp: r.error, imap: "Not checked" });
      return;
    }
    setCheck({ smtp: "ok", imap: r.imap.ok ? "ok" : r.imap.message });
  };

  const add = async () => {
    setBusy("add");
    setError(null);
    const r = await addSmtpMailboxAction(input());
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    close();
    const q = new URLSearchParams({ mailbox: "connected", email: r.email });
    if (!r.replies) q.set("replies", "off");
    router.push(`/app/mailboxes?${q.toString()}`);
    router.refresh();
  };

  const ready = email.includes("@") && password.length > 0 && (preset !== "custom" || smtpHost.length > 3);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{updating ? "Update mailbox password" : "Add mailbox"}</h2>
          <p className="mt-0.5 text-sm text-slate">{updating ? `Enter a new password for ${start?.email}.` : "Connect the email address your campaigns send from."}</p>
        </div>
        <SheetCloseButton />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!p ? (
          <>
            <p className="text-sm font-semibold text-ink">Choose your email provider</p>
            <ul className="space-y-2.5">
              {MAIL_PRESETS.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setPreset(m.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-green/50 hover:bg-mint-soft/30"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas">{ICON[m.id]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{m.label}</span>
                      <span className="block text-xs text-slate">{m.hint}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-slate" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-5 text-slate">Microsoft 365 / Outlook: use “Custom IMAP/SMTP” (smtp.office365.com, port 587) if your admin allows it.</p>
          </>
        ) : (
          <>
            {!updating ? (
              <button type="button" onClick={() => (setPreset(null), setCheck(null), setError(null))} className="inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-ink">
                <ArrowLeft aria-hidden className="size-3.5" /> Other providers
              </button>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-canvas">{ICON[p.id]}</span>
              <span className="text-sm font-semibold text-ink">{p.label}</span>
            </div>
            <Steps preset={p.id} />

            <form
              className="space-y-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="mb-email">{p.id === "google" ? "Gmail address" : "Email address"}</Label>
                <Input id="mb-email" type="email" autoComplete="off" value={email} readOnly={updating} onChange={(e) => setEmail(e.target.value)} placeholder={p.id === "google" ? "you@gmail.com or you@yourdomain.com" : "you@yourdomain.com"} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mb-name">From name (optional)</Label>
                <Input id="mb-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mb-pass">{p.passwordLabel}</Label>
                <div className="relative">
                  <Input
                    id="mb-pass"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={p.id === "google" ? "Your 16-character App Password" : ""}
                    className="pr-10 font-mono"
                    required
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </button>
                </div>
                <FieldHint>{p.passwordHint}</FieldHint>
              </div>

              {p.id === "custom" ? (
                <div className="space-y-3 rounded-2xl border border-line p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate">Sending (SMTP)</p>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <Input aria-label="SMTP server" placeholder="smtp.yourdomain.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                    <Select aria-label="SMTP port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)}>
                      <option value="465">465 · SSL/TLS</option>
                      <option value="587">587 · STARTTLS</option>
                      <option value="2525">2525 · STARTTLS</option>
                    </Select>
                  </div>
                  <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate">Replies (IMAP, optional)</p>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <Input aria-label="IMAP server" placeholder="imap.yourdomain.com" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                    <Select aria-label="IMAP port" value={imapPort} onChange={(e) => setImapPort(e.target.value)}>
                      <option value="993">993 · SSL/TLS</option>
                      <option value="143">143 · STARTTLS</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="mb-user">Username (if not the email address)</Label>
                    <Input id="mb-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={email || "you@yourdomain.com"} />
                  </div>
                </div>
              ) : null}

              {check ? (
                <div className="space-y-1.5 rounded-2xl border border-line p-3 text-sm" role="status">
                  <Row ok={check.smtp === "ok"} label="Sending (SMTP)" detail={check.smtp === "ok" ? "Works" : check.smtp} />
                  <Row ok={check.imap === "ok"} warn={check.smtp === "ok" && check.imap !== "ok"} label="Replies (IMAP)" detail={check.imap === "ok" ? "Works: replies will show in your Inbox" : check.imap} />
                </div>
              ) : null}
              {error ? (
                <p className="flex gap-2 rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
                  <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" disabled={!ready || !!busy} onClick={() => void test()}>
                  {busy === "test" ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} Test connection
                </Button>
                <Button type="submit" disabled={!ready || !!busy}>
                  {busy === "add" ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />} {updating ? "Save password" : "Add mailbox"}
                </Button>
              </div>
              <p className="text-xs leading-5 text-slate">Your password is encrypted and only used to send your approved campaigns and read replies to them. Remove it any time by disconnecting the mailbox.</p>
            </form>
          </>
        )}
        <p className="text-center text-xs text-slate">
          Need help?{" "}
          <Link href="/app/support" onClick={close} className="font-medium text-green hover:underline">
            Ask our team
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail: string }) {
  return (
    <p className="flex gap-2">
      {ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> : warn ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-fg" /> : <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" />}
      <span>
        <span className="font-medium text-ink">{label}:</span> <span className={cn(ok ? "text-slate" : warn ? "text-warn-fg" : "text-danger-fg")}>{detail}</span>
      </span>
    </p>
  );
}
