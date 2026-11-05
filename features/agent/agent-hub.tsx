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
import { createTokenAction, revokeTokenAction } from "@/server/actions/tokens";
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

export function AgentHub(p: AgentHubProps) {
  const [fresh, setFresh] = React.useState<string | null>(null);
  const token = fresh ?? "YOUR_TOKEN";
  return (
    <div className="space-y-16 pb-10">
      <Hero toolCount={p.toolNames.length} />
      <HowItWorks />
      <Connect endpoint={p.endpoint} tokens={p.tokens} fresh={fresh} setFresh={setFresh} toolCount={p.toolNames.length} />
      <Usage tokens={p.tokens} ai={p.ai} google={p.google} />
      <Clients endpoint={p.endpoint} token={token} hasFresh={!!fresh} />
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

function Connect({ endpoint, tokens, fresh, setFresh, toolCount }: { endpoint: string; tokens: TokenRow[]; fresh: string | null; setFresh: (t: string | null) => void; toolCount: number }) {
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
                setFresh(r.token);
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
              <code className="min-w-0 flex-1 break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-ink">{fresh}</code>
              <CopyButton id="fresh" text={fresh} label="Copy token" />
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
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">{google.configured ? (google.left ?? "–") : "–"}</p>
          <p className="text-xs text-slate">{google.configured ? "searches left, shared by the app and agents" : "Not set up on this server"}</p>
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

type Client = { id: string; name: string; initial: string; color: string; blurb: string; where: string; snippet: (url: string, token: string) => string; popular?: boolean };

const CLIENTS: Client[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    initial: "C",
    color: "bg-[#d97757]",
    blurb: "Anthropic's terminal agent. One command and it's connected.",
    where: "Run in your terminal",
    popular: true,
    snippet: (u, t) => `claude mcp add --transport http locenti ${u} --header "Authorization: Bearer ${t}"`,
  },
  {
    id: "cursor",
    name: "Cursor",
    initial: "✦",
    color: "bg-ink",
    blurb: "Add Locenti to Cursor's MCP settings and use it from the agent chat.",
    where: "Paste into .cursor/mcp.json (project) or ~/.cursor/mcp.json (all projects)",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { url: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    initial: "C",
    color: "bg-[#a855f7]",
    blurb: "Claude's desktop app, through the mcp-remote bridge (needs Node.js).",
    where: "Settings → Developer → Edit config (claude_desktop_config.json), then restart Claude",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { command: "npx", args: ["-y", "mcp-remote", u, "--header", `Authorization:Bearer ${t}`] } } }, null, 2),
  },
  {
    id: "vscode",
    name: "VS Code",
    initial: "V",
    color: "bg-[#2f80ed]",
    blurb: "Use Locenti from GitHub Copilot's agent mode.",
    where: "Paste into .vscode/mcp.json in your project",
    snippet: (u, t) => JSON.stringify({ servers: { locenti: { type: "http", url: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "windsurf",
    name: "Windsurf",
    initial: "W",
    color: "bg-[#0ea5a4]",
    blurb: "Connect Windsurf's Cascade agent to your workspace.",
    where: "Paste into ~/.codeium/windsurf/mcp_config.json",
    snippet: (u, t) => JSON.stringify({ mcpServers: { locenti: { serverUrl: u, headers: { Authorization: `Bearer ${t}` } } } }, null, 2),
  },
  {
    id: "other",
    name: "Any MCP client",
    initial: "+",
    color: "bg-green",
    blurb: "Anything that supports remote MCP servers with a header, or local ones via mcp-remote.",
    where: "Server URL plus an Authorization header; or run the bridge command",
    snippet: (u, t) => `URL:    ${u}\nHeader: Authorization: Bearer ${t}\n\nLocal-only clients (stdio):\nnpx -y mcp-remote ${u} --header "Authorization:Bearer ${t}"`,
  },
];

function Clients({ endpoint, token, hasFresh }: { endpoint: string; token: string; hasFresh: boolean }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const client = CLIENTS.find((c) => c.id === open);
  return (
    <section>
      <SectionTitle title="Connect your AI agent" sub="Pick a client, paste one snippet, and your agent is live." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CLIENTS.map((c) => (
          <article key={c.id} className={cn("card relative flex flex-col p-6 transition-shadow hover:shadow-float", open === c.id && "ring-2 ring-green/50")}>
            {c.popular ? <span className="absolute right-4 top-4 rounded-full border border-green/30 bg-mint-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-green">Quickest</span> : null}
            <span className={cn("flex size-12 items-center justify-center rounded-full text-lg font-bold text-white", c.color)}>{c.initial}</span>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">{c.name}</h3>
            <p className="mt-1 flex-1 text-sm leading-6 text-slate">{c.blurb}</p>
            <div className="mt-5 flex justify-end">
              <Button size="sm" variant={open === c.id ? "secondary" : "primary"} onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                {open === c.id ? "Close" : "Set up"} {open === c.id ? null : <ArrowRight aria-hidden />}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {client ? (
        <div className="card mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-ink">Set up {client.name}</h3>
              <p className="mt-0.5 text-sm text-slate">{client.where}</p>
            </div>
            <CopyButton id={`snip-${client.id}`} text={client.snippet(endpoint, token)} label="Copy snippet" />
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-canvas p-4 font-mono text-[12.5px] leading-6 text-ink scrollbar-thin">{client.snippet(endpoint, token)}</pre>
          {!hasFresh ? (
            <p className="mt-3 text-xs text-slate">
              Replace <code className="font-mono">YOUR_TOKEN</code> with a token, or <a href="#connect">create one above</a> and this snippet fills it in.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
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

