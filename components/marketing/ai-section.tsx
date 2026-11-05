import { Bot, Check, Sparkles } from "lucide-react";

/** Landing section: the two ways AI writes in Locenti. */
export function AiSection() {
  return (
    <section id="ai" className="on-dark relative overflow-hidden bg-midnight py-20 text-white sm:py-28">
      <div aria-hidden className="hero-aurora pointer-events-none absolute -inset-[10%] opacity-60" />
      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="eyebrow text-mint">AI, your way</p>
          <h2 className="display-2 mt-4 text-white">Every email written for one business. By AI you choose.</h2>
          <p className="mt-5 text-[17px] leading-8 text-white/70">Use the AI writer built into Locenti, or plug in the agent you already pay for. Both write only from facts found on the business&apos;s own website, and neither can send without your approval.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2" data-stagger="120">
          <article data-reveal className="card-dark relative overflow-hidden p-7">
            <span className="flex size-11 items-center justify-center rounded-xl bg-mint/15 text-mint">
              <Sparkles aria-hidden className="size-5" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-white">Built-in AI writer</h3>
            <p className="mt-2 text-[15px] leading-7 text-white/70">One click on a lead, or &ldquo;Write all&rdquo; on a campaign. It reads the Opportunity Brief and your pitch, then writes a short, specific first email.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/80">
              {["Uses only facts with sources", "No placeholders, no invented claims", "Edit anything before you approve"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check aria-hidden className="size-4 text-mint" /> {t}
                </li>
              ))}
            </ul>
          </article>
          <article data-reveal className="card-dark relative overflow-hidden p-7">
            <span className="flex size-11 items-center justify-center rounded-xl bg-mint/15 text-mint">
              <Bot aria-hidden className="size-5" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-white">Bring your own agent</h3>
            <p className="mt-2 text-[15px] leading-7 text-white/70">Connect Claude, Cursor or any MCP client with a personal token. Ask it to &ldquo;find dentists in Austin and draft emails for the best five&rdquo; and watch it work in your workspace.</p>
            <pre className="mt-5 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11.5px] leading-5 text-mint/90">{`search_google_maps → research_lead
→ get_lead → save_draft
→ create_campaign_draft`}</pre>
            <p className="mt-3 text-xs text-white/50">Your agent, your AI account. Approving and sending stay with you in Locenti.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
