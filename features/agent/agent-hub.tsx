"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileSearch,
  Gauge,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  MapPinned,
  MessageSquare,
  PenLine,
  Plug,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/sheet";
import { createTokenAction, revokeTokenAction, tokenStatusAction } from "@/server/actions/tokens";
import type { TokenRow } from "@/server/token-store";
import { cn, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ helpers */

function useCopy() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (key: string, text: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    });
  return { copied, copy };
}

function CopyButton({ text, label = "Copy", id, className }: { text: string; label?: string; id: string; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(id, text)}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-canvas", className)}
    >
      {copied === id ? <Check aria-hidden className="size-3.5 text-green" /> : <Copy aria-hidden className="size-3.5" />}
      {copied === id ? "Copied" : label}
    </button>
  );
}

function SectionTitle({ eyebrow, icon: Icon, title, sub }: { eyebrow?: string; icon?: typeof Sparkles; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      {eyebrow ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-slate">
          {Icon ? <Icon aria-hidden className="size-3.5 text-green" /> : null} {eyebrow}
        </span>
      ) : null}
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-2 text-[15px] leading-7 text-slate">{sub}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- the page */

export type AgentHubProps = {
  tokens: TokenRow[];
  endpoint: string;
  toolNames: string[];
  ai: { configured: boolean; model: string; left: number | null; allowance: number | null };
  google: { configured: boolean; left: number | null };
  canManage: boolean;
};

/** A token created on this page: its value is shown once, its id lets the setup check for the first agent call. */
type Fresh = { token: string; id: string };

export function AgentHub(p: AgentHubProps) {
  const [fresh, setFresh] = React.useState<Fresh | null>(null);
  return (
    <div className="space-y-16 pb-10">
      <Hero toolCount={p.toolNames.length} />
      <HowItWorks />
      <Connect endpoint={p.endpoint} tokens={p.tokens} fresh={fresh} setFresh={setFresh} toolCount={p.toolNames.length} />
      <Usage tokens={p.tokens} ai={p.ai} google={p.google} />
      <Clients endpoint={p.endpoint} fresh={fresh} setFresh={setFresh} />
      <Prompts />
      <Capabilities toolNames={p.toolNames} />
      <Limits />
      <BuiltIn ai={p.ai} />
      <Faq />
    </div>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero({ toolCount }: { toolCount: number }) {
  return (
    <section className="on-dark relative -mx-4 overflow-hidden bg-midnight px-6 py-14 text-center text-white sm:-mx-6 sm:rounded-2xl lg:mx-0 lg:py-20">
      <div aria-hidden className="hero-aurora pointer-events-none absolute -inset-[15%] opacity-80" />
      <div className="relative mx-auto max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] py-1 pl-1 pr-3 text-[13px] text-white/80">
          <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-bold text-midnight">MCP</span> Your AI, connected to your prospecting
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Run Locenti from <span className="text-shine">your own AI agent</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-8 text-white/70">
          Connect Claude Code, Cursor, Claude Desktop, VS Code, Windsurf or any client that speaks MCP. Ask in plain language to find businesses on Google Maps, research their websites, write
          personal first emails and prepare campaigns. {toolCount} tools, all scoped to your workspace. Your agent can&apos;t send or approve anything: that stays with you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="mint" size="lg">
            <a href="#connect">
              Connect your first agent <ArrowRight aria-hidden />
            </a>
          </Button>
          <a href="https://modelcontextprotocol.io/introduction" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75 hover:text-white">
            What is MCP? <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps = [
    { icon: Plug, title: "Connect your agent", text: "Create a personal token below and paste one snippet into your AI app. No code, no SDK." },
    { icon: MessageSquare, title: "Ask in plain language", text: "“Find roofers in Denver with a website, research the top ten and draft an email for each.”" },
    { icon: ShieldCheck, title: "You approve, Locenti sends", text: "Your agent prepares a draft campaign. You review every message and approve; Locenti sends within your limits." },
  ];
  return (
    <section className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green/30 bg-mint-soft px-3 py-1 text-xs font-medium text-green">
          <Sparkles aria-hidden className="size-3.5" /> How it works
        </span>
        <span className="text-sm text-slate">Live in three steps</span>
      </div>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-full border-2 border-green/40 font-display text-sm font-bold text-green">{i + 1}</span>
              <span className="flex size-10 items-center justify-center rounded-xl bg-mint-soft text-green">
                <s.icon aria-hidden className="size-5" />
              </span>
              {i < 2 ? <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-r from-green/40 to-transparent md:block" /> : null}
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-slate">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------- connect */

function Connect({ endpoint, tokens, fresh, setFresh, toolCount }: { endpoint: string; tokens: TokenRow[]; fresh: Fresh | null; setFresh: (t: Fresh | null) => void; toolCount: number }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <section id="connect" className="card scroll-mt-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
            <Plug aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Use Locenti from your own AI app</h2>
            <p className="mt-0.5 text-sm text-slate">Point any MCP client at this server with a personal token.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green/30 bg-mint-soft px-2.5 py-1 text-xs font-medium text-green">
          <span className="size-1.5 rounded-full bg-green" /> Live
        </span>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">MCP server URL</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-canvas px-4 py-2.5 font-mono text-sm text-ink scrollbar-thin">{endpoint}</code>
          <CopyButton id="url" text={endpoint} label="Copy URL" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Authentication</p>
          <p className="mt-2 font-mono text-sm text-ink">Bearer loc_…</p>
          <p className="mt-1 text-xs text-slate">A personal token, created below</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Protocol</p>
          <p className="mt-2 font-mono text-sm text-ink">Streamable HTTP</p>
          <p className="mt-1 text-xs text-slate">MCP 2024-11-05 to 2025-11-25</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Tools</p>
          <p className="mt-2 text-sm text-ink">
            <span className="font-mono">{toolCount}</span> · Google Maps · Research · Drafts · Campaigns
          </p>
          <p className="mt-1 text-xs text-slate">Everything except sending and approving</p>
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await createTokenAction(name);
              if (r.ok) {
                setFresh({ token: r.token, id: r.id });
                setName("");
              } else setError(r.error);
              router.refresh();
            });
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="tok-name">Create an access token</Label>
            <Input id="tok-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it after where you'll use it, e.g. “Claude Code on my laptop”" maxLength={60} />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />} Create token
          </Button>
        </form>
        {error ? <Callout tone="danger" className="mt-3">{error}</Callout> : null}
        {fresh ? (
          <Callout tone="green" title="Copy your token now" className="mt-3">
            It won&apos;t be shown again, and the setup snippets below now include it. Anyone with it can act as you in this workspace (except sending), so keep it private.
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-ink">{fresh.token}</code>
              <CopyButton id="fresh" text={fresh.token} label="Copy token" />
            </span>
          </Callout>
        ) : null}
        <TokenList tokens={tokens} />
      </div>
    </section>
  );
}

function TokenList({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (!tokens.length) return <p className="mt-4 text-sm text-slate">No tokens yet. Tokens are personal: each person in the workspace creates their own.</p>;
  return (
    <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
      {tokens.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-canvas text-slate">
            <KeyRound aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
            <span className="block text-xs text-slate">
              <span className="font-mono">{t.prefix}…</span> · created {formatDate(t.created_at)} · {t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : "never used"}
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (confirm(`Revoke “${t.name}”? Agents using it stop working immediately.`))
                start(async () => {
                  await revokeTokenAction(t.id);
                  router.refresh();
                });
            }}
          >
            <Trash2 aria-hidden /> Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ usage */

function Usage({ tokens, ai, google }: Pick<AgentHubProps, "tokens" | "ai" | "google">) {
  const last = tokens.map((t) => t.last_used_at).filter(Boolean).sort().at(-1) ?? null;
  const pct = ai.allowance && ai.left !== null ? Math.round(((ai.allowance - ai.left) / ai.allowance) * 100) : 0;
  return (
    <section className="card p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <Gauge aria-hidden className="size-5 text-slate" />
        <h2 className="font-display text-lg font-semibold text-ink">Usage</h2>
      </div>
      {ai.allowance !== null && ai.left !== null ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{ai.allowance - ai.left} AI-written emails</span>
            <span className="text-slate">of {ai.allowance} this period (built-in writer)</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-gradient-to-r from-green to-mint" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Your tokens</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">{tokens.length}</p>
          <p className="text-xs text-slate">{last ? `Last agent call ${formatDate(last)}` : "No agent calls yet"}</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Google Maps today</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">{google.configured ? (google.left ?? "No cap") : "–"}</p>
          <p className="text-xs text-slate">{google.configured ? (google.left === null ? "limited only by Google's quota" : "searches left, shared by the app and agents") : "Not set up on this server"}</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Agent AI costs</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">Yours</p>
          <p className="text-xs text-slate">Agents use your own AI account, not Locenti&apos;s allowance</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- clients */

type Client = {
  id: string;
  name: string;
  initial: string;
  color: string;
  blurb: string;
  where: string;
  /** What to do with the snippet, in order. */
  steps: string[];
  /** How to see it worked inside that app. */
  verify: string;
  snippet: (url: string, token: string) => string;
  popular?: boolean;
};

const MERGE = "If the file already has other servers, add the locenti entry next to them instead of replacing the file.";

const CLIENTS: Client[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    initial: "C",
    color: "bg-[#d97757]",
    blurb: "Anthropic's terminal agent. One command and it's connected.",
    where: "Run in your terminal",
    popular: true,
    steps: ["Open a terminal on the computer where you use Claude Code.", "Paste the command below and press Enter."],
    verify: "Start Claude Code (run claude) and type /mcp: locenti should be listed as connected.",
    snippet: (u, t) => `claude mcp add --transport http locenti ${u} --header "Authorization: Bearer ${t}"`,
  },
  {
    id: "cursor",
    name: "Cursor",
    initial: "✦",
    color: "bg-ink",
    blurb: "Add Locenti to Cursor's MCP settings and use it from the agent chat.",
    where: "Paste into .cursor/mcp.json (project) or ~/.cursor/mcp.json (all projects)",
    steps: ["Open (or create) .cursor/mcp.json in your project, or ~/.cursor/mcp.json for all projects.", "Paste the snippet and save. " + MERGE],
    verify: "In Cursor Settings → MCP, locenti should show as enabled with its tools.",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { url: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    initial: "C",
    color: "bg-[#a855f7]",
    blurb: "Claude's desktop app, through the mcp-remote bridge (needs Node.js).",
    where: "Settings → Developer → Edit config (claude_desktop_config.json), then restart Claude",
    steps: ["Install Node.js if you don't have it (the bridge runs with npx).", "In Claude Desktop: Settings → Developer → Edit config.", "Paste the snippet into claude_desktop_config.json and save. " + MERGE, "Quit and reopen Claude Desktop."],
    verify: "Locenti's tools appear under the tools (search and tools) menu in a new chat.",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { command: "npx", args: ["-y", "mcp-remote", u, "--header", `Authorization:Bearer ${t}`] } } }, null, 2),
  },
  {
    id: "vscode",
    name: "VS Code",
    initial: "V",
    color: "bg-[#2f80ed]",
    blurb: "Use Locenti from GitHub Copilot's agent mode.",
    where: "Paste into .vscode/mcp.json in your project",
    steps: ["Create .vscode/mcp.json in your project.", "Paste the snippet and save. " + MERGE, "Click Start above the locenti entry if VS Code doesn't start it on its own."],
    verify: "Open Copilot Chat in Agent mode: the Locenti tools are listed under the tools button.",
    snippet: (u, t) => JSON.stringify({ servers: { locenti: { type: "http", url: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "windsurf",
    name: "Windsurf",
    initial: "W",
    color: "bg-[#0ea5a4]",
    blurb: "Connect Windsurf's Cascade agent to your workspace.",
    where: "Paste into ~/.codeium/windsurf/mcp_config.json",
    steps: ["Open ~/.codeium/windsurf/mcp_config.json.", "Paste the snippet and save. " + MERGE, "Refresh the MCP servers in Cascade."],
    verify: "Cascade lists locenti among its MCP servers with its tools.",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { serverUrl: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "other",
    name: "Any MCP client",
    initial: "+",
    color: "bg-green",
    blurb: "Anything that supports remote MCP servers with a header, or local ones via mcp-remote.",
    where: "Server URL plus an Authorization header; or run the bridge command",
    steps: ["Add a remote (HTTP) MCP server with the URL and Authorization header below.", "If your app only runs local (stdio) servers, use the mcp-remote command instead (needs Node.js)."],
    verify: "Your app should list Locenti's tools once it connects.",
    snippet: (u, t) => `URL:    ${u}\nHeader: Authorization: Bearer ${t}\n\nLocal-only clients (stdio):\nnpx -y mcp-remote ${u} --header "Authorization:Bearer ${t}"`,
  },
];

function Clients({ endpoint, fresh, setFresh }: { endpoint: string; fresh: Fresh | null; setFresh: (t: Fresh | null) => void }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const client = CLIENTS.find((c) => c.id === open) ?? null;
  return (
    <section>
      <SectionTitle title="Connect your AI agent" sub="Pick your app: Locenti makes the token and the exact snippet, then checks that your agent got through." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CLIENTS.map((c) => (
          <article key={c.id} className="card relative flex flex-col p-6 transition-shadow hover:shadow-float">
            {c.popular ? <span className="absolute right-4 top-4 rounded-full border border-green/30 bg-mint-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-green">Quickest</span> : null}
            <span className={cn("flex size-12 items-center justify-center rounded-full text-lg font-bold text-white", c.color)}>{c.initial}</span>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">
              {/* The whole card opens the setup. */}
              <button type="button" onClick={() => setOpen(c.id)} className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none">
                {c.name}
              </button>
            </h3>
            <p className="mt-1 flex-1 text-sm leading-6 text-slate">{c.blurb}</p>
            <div className="mt-5 flex justify-end">
              <span className="pointer-events-none inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-white" aria-hidden>
                Set up <ArrowRight className="size-3.5" />
              </span>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={!!client} onOpenChange={(o) => !o && setOpen(null)}>
        {client ? <SetupDialog client={client} endpoint={endpoint} fresh={fresh} setFresh={setFresh} /> : null}
      </Dialog>
    </section>
  );
}

function StepHead({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2.5 text-sm font-semibold text-ink">
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-green text-white" : "border-2 border-green/40 text-green")}>{done ? <Check aria-hidden className="size-3.5" /> : n}</span>
      {children}
    </h4>
  );
}

function SetupDialog({ client, endpoint, fresh, setFresh }: { client: Client; endpoint: string; fresh: Fresh | null; setFresh: (t: Fresh | null) => void }) {
  const router = useRouter();
  const [name, setName] = React.useState(`${client.name} on my computer`);
  const [own, setOwn] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [status, setStatus] = React.useState<{ connected: boolean; at: string | null; checked: boolean }>({ connected: false, at: null, checked: false });
  const pasted = own.trim().startsWith("loc_") ? own.trim() : null;
  const token = fresh?.token ?? pasted;
  const snippet = client.snippet(endpoint, token ?? "YOUR_TOKEN");

  const check = React.useCallback(async () => {
    if (!fresh) return;
    const r = await tokenStatusAction(fresh.id);
    setStatus({ connected: !!r.lastUsedAt, at: r.lastUsedAt, checked: true });
  }, [fresh]);

  // Once there's a token, watch for the agent's first call (every 4 s, for up to 10 minutes).
  React.useEffect(() => {
    if (!fresh || status.connected) return;
    let n = 0;
    const t = setInterval(() => {
      if (++n > 150) clearInterval(t);
      else void check();
    }, 4000);
    return () => clearInterval(t);
  }, [fresh, status.connected, check]);

  return (
    <DialogContent title={`Connect ${client.name}`} description={client.blurb} className="max-w-2xl">
      <ol className="space-y-6">
        <li className="space-y-3">
          <StepHead n={1} done={!!token}>
            Get a token
          </StepHead>
          {token ? (
            <p className="pl-8 text-sm text-slate">
              {fresh ? "Token created and filled into the snippet below. It's shown only on this page, so finish setup before you leave." : "Using the token you pasted."}
            </p>
          ) : (
            <div className="space-y-3 pl-8">
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  start(async () => {
                    const r = await createTokenAction(name);
                    if (r.ok) setFresh({ token: r.token, id: r.id });
                    else setError(r.error);
                    router.refresh();
                  });
                }}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="setup-tok">Token name</Label>
                  <Input id="setup-tok" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                </div>
                <Button type="submit" disabled={pending || !name.trim()}>
                  {pending ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />} Create token
                </Button>
              </form>
              {error ? <Callout tone="danger">{error}</Callout> : null}
              <details className="text-sm text-slate">
                <summary className="cursor-pointer">I already have a token</summary>
                <Input className="mt-2 font-mono" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="loc_…" aria-label="Paste your token" autoComplete="off" />
              </details>
            </div>
          )}
        </li>

        <li className="space-y-3">
          <StepHead n={2}>Add Locenti to {client.name}</StepHead>
          <ol className="list-decimal space-y-1 pl-12 text-sm leading-6 text-ink">
            {client.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <div className="pl-8">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate">{client.where}</span>
              <CopyButton id={`snip-${client.id}`} text={snippet} label={client.id === "claude-code" ? "Copy command" : "Copy snippet"} />
            </div>
            <pre className={cn("mt-2 overflow-x-auto rounded-lg border border-line bg-canvas p-4 font-mono text-[12.5px] leading-6 text-ink scrollbar-thin", client.id === "claude-code" && "whitespace-pre-wrap break-all")}>{snippet}</pre>
            {!token ? <p className="mt-2 text-xs text-slate">Create a token in step 1 and it&apos;s filled in here.</p> : null}
          </div>
        </li>

        <li className="space-y-3">
          <StepHead n={3} done={status.connected}>
            Check it works
          </StepHead>
          <div className="space-y-3 pl-8 text-sm">
            <p className="text-slate">{client.verify} Then ask your agent something like:</p>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
              <MessageSquare aria-hidden className="size-4 shrink-0 text-slate" />
              <span className="flex-1 text-ink">“Use Locenti to show my workspace and my latest leads.”</span>
              <CopyButton id={`ask-${client.id}`} text="Use Locenti to show my workspace and my latest leads." className="px-2 py-1" />
            </div>
            {fresh ? (
              status.connected ? (
                <Callout tone="green" title="Connected">
                  Your agent reached Locenti{status.at ? ` at ${new Date(status.at).toLocaleTimeString()}` : ""}. You&apos;re all set.
                </Callout>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-slate">
                    <Loader2 aria-hidden className="size-4 animate-spin text-green" /> Waiting for your agent&apos;s first call…
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => void check()}>
                    Check now
                  </Button>
                  {status.checked ? <span className="text-xs text-slate">Nothing yet. Make sure the app was restarted after saving.</span> : null}
                </div>
              )
            ) : (
              <p className="text-xs text-slate">With a token created here, this step confirms the moment your agent connects.</p>
            )}
          </div>
        </li>
      </ol>
    </DialogContent>
  );
}

/* ---------------------------------------------------------------- prompts */

const PROMPTS = [
  { cat: "Prospecting", text: "Find dental clinics in Austin, TX on Google Maps with 4.5+ stars and a website. Save the best 20." },
  { cat: "Research", text: "Research my five newest leads and tell me which ones have no online booking." },
  { cat: "Writing", text: "Write a short first email for each researched lead, using only facts from its brief." },
  { cat: "Campaigns", text: "Create a draft campaign called “Austin dentists” from the leads that have drafts." },
  { cat: "Results", text: "Which campaign has the most interested replies, and who replied?" },
  { cat: "Follow-through", text: "List leads that replied as interested and summarise what each one asked." },
];

function Prompts() {
  const { copied, copy } = useCopy();
  return (
    <section>
      <SectionTitle eyebrow="Try these prompts" icon={Lightbulb} title="What you can ask" sub="Plain language in, careful actions out. Click a prompt to copy it." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROMPTS.map((p, i) => (
          <button key={p.text} type="button" onClick={() => copy(`p${i}`, p.text)} className="card group relative p-5 text-left transition-colors hover:border-green/40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-green">{p.cat}</span>
            <span className="mt-2 flex gap-2 text-[15px] leading-6 text-ink">
              <MessageSquare aria-hidden className="mt-1 size-4 shrink-0 text-slate" />“{p.text}”
            </span>
            <span className="absolute right-4 top-4 text-slate opacity-0 transition-opacity group-hover:opacity-100">
              {copied === `p${i}` ? <Check aria-hidden className="size-4 text-green" /> : <Copy aria-hidden className="size-4" />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- capabilities */

const GROUPS = [
  { icon: MapPinned, title: "Find businesses", text: "Search Google Maps by business type, area, rating and website, then save the ones worth working on. Results are live and follow Google's rules.", tools: ["search_google_maps", "save_google_leads"] },
  { icon: FileSearch, title: "Research leads", text: "Read each business's own website (respecting robots.txt) and get an Opportunity Brief: facts with source links, unknowns and fit for your offer.", tools: ["list_leads", "research_lead", "get_lead"] },
  { icon: PenLine, title: "Write first emails", text: "Read your offer and signature, then save a personal draft for each lead. Every draft is a new version you can review and edit.", tools: ["get_workspace", "save_draft"] },
  { icon: Send, title: "Prepare campaigns", text: "Bundle leads with drafts into a draft campaign on one of your mailboxes. It waits for your review and approval.", tools: ["create_campaign_draft"] },
  { icon: BarChart3, title: "Read results", text: "See who was sent, queued or stopped, who replied, and how replies were labelled (interested, not interested, out of office).", tools: ["list_campaigns", "get_campaign"] },
];

function Capabilities({ toolNames }: { toolNames: string[] }) {
  return (
    <section>
      <SectionTitle title="What your agent can do" sub={`All ${toolNames.length} tools run as you, inside this workspace only.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => {
          const tools = g.tools.filter((t) => toolNames.includes(t));
          return (
            <article key={g.title} className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
                  <g.icon aria-hidden className="size-5" />
                </span>
                <h3 className="font-display text-lg font-semibold text-ink">{g.title}</h3>
                <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold tabular-nums text-slate">{tools.length}</span>
              </div>
              <p className="mt-4 flex-1 text-sm leading-6 text-slate">{g.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tools.map((t) => (
                  <code key={t} className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-xs text-ink">
                    {t}
                  </code>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- limits */

const LIMITS = [
  { icon: Lock, title: "Workspace-scoped tokens", text: "A token acts as you in one workspace. It stops working the moment it's revoked or you leave the workspace." },
  { icon: Ban, title: "No sending, no approving", text: "Agents prepare drafts and draft campaigns. Only a person can approve and launch, in Locenti." },
  { icon: Timer, title: "Same limits as the app", text: "Google Maps daily searches, mailbox daily limits, sending hours and the do-not-contact list all apply. Agents can't raise them." },
  { icon: ShieldCheck, title: "Facts stay facts", text: "Research comes from the business's own website with sources. Agents can't edit research; drafts are reviewed before use." },
];

function Limits() {
  return (
    <section>
      <SectionTitle title="Limits your agent can't override" sub="Every agent call goes through the same rules as the web app." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LIMITS.map((l) => (
          <article key={l.title} className="card p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
              <l.icon aria-hidden className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold text-ink">{l.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate">{l.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- built-in writer */

function BuiltIn({ ai }: Pick<AgentHubProps, "ai">) {
  return (
    <section className="card grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-slate">
          <Sparkles aria-hidden className="size-3.5 text-green" /> No agent? No problem
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Built-in AI writer</h2>
        <p className="mt-2 text-[15px] leading-7 text-slate">
          Don&apos;t use an AI agent? Locenti writes first emails for you. Click <strong className="text-ink">Write with AI</strong> on a researched lead, or <strong className="text-ink">Write all with AI</strong> on a draft campaign. It uses
          only the lead&apos;s Opportunity Brief and your offer, and checks every result for placeholders and stray links.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          {["One AI email per click, from facts with sources", "Edit anything before you approve", "Failed attempts don't count against your allowance"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check aria-hidden className="size-4 text-green" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-line bg-canvas p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Status</p>
        <p className="mt-2 flex items-center gap-2 font-medium text-ink">
          <span className={cn("size-2 rounded-full", ai.configured ? "bg-green" : "bg-slate")} /> {ai.configured ? "Ready" : "Not set up"}
        </p>
        <p className="mt-1 text-sm text-slate">{ai.configured ? `Google Gemini · ${ai.model}` : "Add a Gemini API key on the server (GEMINI_API_KEY)."}</p>
        {ai.left !== null ? <p className="mt-3 text-sm text-ink">{ai.left} AI emails left this period</p> : null}
        <p className="mt-4 text-xs leading-5 text-slate">On Gemini&apos;s free tier, Google may use what&apos;s sent (lead research and your offer) to improve its products. A paid Gemini plan, or your own agent, avoids that.</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

const FAQ = [
  { q: "Can my agent send emails for me?", a: "No. Agents can write drafts and create draft campaigns, but approving and launching a campaign is always done by a person in Locenti. Sending then follows your mailbox's daily limit and sending hours." },
  { q: "Which AI agents can I connect?", a: "Any client that supports remote MCP servers with an Authorization header: Claude Code, Cursor, VS Code (Copilot agent mode) and Windsurf work directly. Claude Desktop and other local-only clients connect through the free mcp-remote bridge. Apps that only support MCP sign-in (OAuth), such as claude.ai connectors, aren't supported yet." },
  { q: "What can my agent actually do once connected?", a: "Search Google Maps and save leads, research websites, read Opportunity Briefs, read your offer profile, save drafts, create draft campaigns, and read campaign results and reply labels." },
  { q: "Does it use Locenti's AI allowance?", a: "No. Your agent thinks with your own AI account. Google Maps searches it runs count against the same daily limit as searches in the app." },
  { q: "Is my data safe?", a: "A token only reaches the workspace it was created in, with your permissions. Tokens are stored as hashes, shown once, and can be revoked instantly. Data your agent reads is shared with your agent's AI provider under your own agreement with them." },
  { q: "Who can create tokens?", a: "Anyone in the workspace can create their own token. Saving drafts and creating campaigns through an agent needs an owner or admin role, as in the app." },
  { q: "How do I revoke access?", a: "Click Revoke next to the token above. Any agent using it is disconnected immediately." },
];

function Faq() {
  return (
    <section>
      <SectionTitle title="Frequently asked questions" />
      <div className="card mx-auto max-w-3xl divide-y divide-line">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-6 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
              {f.q}
              <ChevronDown aria-hidden className="size-4 shrink-0 text-slate transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

