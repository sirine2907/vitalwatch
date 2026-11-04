import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { signOutUser } from "@/app/(auth)/sign-in/actions";
import { Aura } from "@/components/aura";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { alertService } from "@/services/app.factory";
import "./globals.css";

// Archivo has a width axis, so headings can use the condensed cut of the same family.
const sans = Archivo({ variable: "--font-sans", subsets: ["latin"], axes: ["wdth"] });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "VitalWatch", template: "%s | VitalWatch" },
  description: "Test any page's real-user Core Web Vitals, lab metrics and biggest speed fixes.",
};

const NAV_LINK = "inline-flex items-center whitespace-nowrap hover:underline underline-offset-4";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  // The header shouldn't take the whole page down if the count can't load.
  const unread = user ? await alertService().countUnread(user.id).catch(() => 0) : 0;

  return (
    <html lang="en" className={`${sans.variable} ${code.variable}`}>
      <body className="relative isolate flex min-h-svh flex-col overflow-x-clip antialiased">
        <Aura className="top-[-180px] right-[-160px] size-[560px] opacity-80 sm:size-[720px]" />
        <header>
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="text-2xl font-bold tracking-tight [font-stretch:72%]">
              VitalWatch
            </Link>
            <nav className="flex items-center gap-4 text-sm sm:gap-6">
              {user ? (
                <>
                  <Link href="/projects" className={NAV_LINK}>
                    Projects
                  </Link>
                  <Link href="/alerts" className={NAV_LINK}>
                    Alerts
                    {unread > 0 && (
                      <span className="ml-1.5 rounded-full bg-poor px-1.5 py-0.5 text-xs font-medium text-white">
                        {unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </Link>
                  <form action={signOutUser}>
                    <Button type="submit" variant="ghost" size="sm">
                      Sign out
                    </Button>
                  </form>
                </>
              ) : (
                <Link href="/sign-in" className={NAV_LINK}>
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
        <footer className="border-t bg-muted/60">
          <p className="mx-auto w-full max-w-6xl px-4 py-5 text-sm text-muted-foreground sm:px-6">
            Results from Google PageSpeed Insights.
          </p>
        </footer>
      </body>
    </html>
  );
}
