import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Activity } from "lucide-react";
import "./globals.css";

const sans = Schibsted_Grotesk({ variable: "--font-sans", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "VitalWatch", template: "%s | VitalWatch" },
  description: "Test any page's real-user Core Web Vitals, lab metrics and biggest speed fixes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${code.variable}`}>
      <body className="flex min-h-svh flex-col antialiased">
        <header className="border-b">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Activity className="size-5 text-primary" aria-hidden />
              VitalWatch
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
        <footer className="border-t">
          <p className="mx-auto w-full max-w-5xl px-4 py-5 text-sm text-muted-foreground sm:px-6">
            Results from Google PageSpeed Insights. Inspired by{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://github.com/youssefsz/speed-insight"
              target="_blank"
              rel="noreferrer"
            >
              speed-insight
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
