import Link from "next/link";
import { brand } from "@/config/brand";
import { Logo } from "@/components/brand/logo";

const cols = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Product" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/demo", label: "Interactive demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#agencies", label: "For agencies" },
      { href: "/#faq", label: "FAQ" },
      { href: "/brand", label: "Brand guide" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    title: "Legal (drafts)",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/acceptable-use", label: "Acceptable use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="on-dark border-t border-white/[0.08] bg-midnight text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <Logo tone="dark" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-fog">{brand.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-fog">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/80 transition-colors duration-200 hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/[0.08]">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {brand.copyrightYear} {brand.legalEntity ?? brand.name}. {brand.name} is a provisional product name.
          </p>
          <p>Demo businesses, people and results are fictional.</p>
        </div>
      </div>
    </footer>
  );
}
