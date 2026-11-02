import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Demo fixtures and simulated logic must never leak into production code paths.
  {
    files: ["server/**", "lib/**", "config/**", "jobs/**", "database/**", "app/app/**", "features/product/**", "features/auth/**", "app/(auth)/**", "features/settings/offer-fields.tsx", "features/settings/offer-profile-form.tsx", "features/onboarding/onboarding-wizard.tsx", "proxy.ts", "app/api/**", "lib/auth/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/demo/*", "@/demo", "**/demo/*"], message: "Production code must not import demo fixtures or simulations." }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "screenshots/**",
  ]),
]);

export default eslintConfig;
