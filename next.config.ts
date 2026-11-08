import type { NextConfig } from "next";

/**
 * Once the site has its own domain (NEXT_PUBLIC_SITE_URL, e.g. https://locenti.com),
 * production visits to the old *.vercel.app address, and to www., go to it with the
 * same path. /api is left alone so Google sign-ins and Gmail connections already
 * under way, webhooks and scheduled jobs keep working. Temporary (307) redirects,
 * so a mistake is undone by changing the setting.
 */
function domainRedirects() {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (process.env.VERCEL_ENV !== "production" || !site) return [];
  let host: string;
  try {
    host = new URL(site).hostname;
  } catch {
    return [];
  }
  if (host.endsWith(".vercel.app") || host === "localhost") return [];
  const keepApi = "/:path((?!api/).*)";
  return [
    { source: keepApi, has: [{ type: "host" as const, value: "(?<deployment>.+)\\.vercel\\.app" }], destination: `${site}/:path`, permanent: false },
    ...(host.startsWith("www.") ? [] : [{ source: keepApi, has: [{ type: "host" as const, value: `www.${host}` }], destination: `${site}/:path`, permanent: false }]),
  ];
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The interactive demo is retired: Locenti is the real product now.
  redirects() {
    return [
      { source: "/demo", destination: "/", permanent: false },
      { source: "/demo/:path*", destination: "/", permanent: false },
      ...domainRedirects(),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
