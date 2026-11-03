import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { signOutUser } from "@/app/(auth)/sign-in/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { alertService } from "@/services/app.factory";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "VitalWatch", template: "%s | VitalWatch" },
  description: "Test any page's real-user Core Web Vitals, lab metrics and biggest speed fixes.",
};

const NAV_LINK =
  "inline-flex items-center font-mono text-[0.7rem] tracking-wide whitespace-nowrap uppercase hover:text-mark hover:underline sm:text-xs sm:tracking-wider";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  // The header shouldn't take the whole page down if the count can't load.
  const unread = user ? await alertService().countUnread(user.id).catch(() => 0) : 0;

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${code.variable}`}>
      <body className="flex min-h-svh flex-col antialiased">
        <header className="border-b-4 border-double border-foreground bg-background">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">VitalWatch</span>
              <span className="hidden font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase sm:inline">
                Web performance lab
              </span>
            </Link>
            <nav className="flex items-center gap-3 sm:gap-5">
              {user ? (
                <>
                  <Link href="/projects" className={NAV_LINK}>
                    Projects
                  </Link>
                  <Link href="/alerts" className={NAV_LINK}>
                    Alerts
                    {unread > 0 && (
                      <span className="ml-1.5 bg-mark px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                        {unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </Link>
                  <form action={signOutUser}>
                    <Button type="submit" variant="ghost" size="sm" className="px-1.5 sm:px-2.5">
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
        <footer className="border-t border-foreground bg-background">
          <p className="mx-auto w-full max-w-5xl px-4 py-5 font-mono text-xs text-muted-foreground sm:px-6">
            Results from Google PageSpeed Insights.
          </p>
        </footer>
      </body>
    </html>
  );
}
