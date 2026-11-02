import type { Metadata } from "next";
import { DemoShell } from "@/components/app/demo-shell";

export const metadata: Metadata = {
  title: { default: "Demo", template: "%s · Demo" },
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return <DemoShell>{children}</DemoShell>;
}
