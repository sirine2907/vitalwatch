import Link from "next/link";
import { ArrowRight, BellRing, Gauge, GitCompareArrows } from "lucide-react";
import { Aura } from "@/components/aura";
import { UrlForm } from "@/components/url-form";

const FEATURES = [
  {
    title: "What real visitors feel",
    text: "LCP, INP and CLS from Chrome's field data, clearly labelled as page-level or site-wide.",
  },
  {
    title: "A controlled lab test",
    text: "Lighthouse metrics on mobile and desktop, to see what's slow and why.",
  },
  {
    title: "Fixes in priority order",
    text: "Opportunities ranked by the time they could save, so you know where to start.",
  },
];

const MODES = [
  { label: "Test a page", icon: Gauge, href: null },
  { label: "Monitor a site", icon: BellRing, href: "/projects" },
  { label: "Compare rivals", icon: GitCompareArrows, href: "/projects" },
];

const MODE_TAB = "flex h-12 items-center gap-2 rounded-t-xl px-4 text-sm whitespace-nowrap sm:px-6";

export default function HomePage() {
  return (
    <div className="relative">
      <Aura blend="cool" className="top-56 -left-40 size-[480px] opacity-70 sm:size-[560px]" />

      <section className="max-w-4xl sm:pt-4">
        <h1 className="text-5xl leading-[0.95] font-bold text-balance sm:text-7xl">
          Find Out What&apos;s Slowing Your Site Down
        </h1>
        <p className="mt-6 flex items-start gap-1.5">
          <span className="mt-1.5 text-sm font-medium">Results in</span>
          <span className="text-5xl font-semibold tracking-tight tabular-nums">20 – 60 s</span>
        </p>
        <a href="#how-it-works" className="mt-8 inline-flex items-center gap-2 font-medium hover:underline">
          How it works
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </section>

      <section aria-label="Test a page" className="mt-12 sm:mt-16">
        <nav aria-label="What you can do" className="flex overflow-x-auto">
          {MODES.map(({ label, icon: Icon, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                className={`${MODE_TAB} bg-muted/80 text-foreground/70 backdrop-blur-sm hover:text-foreground`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ) : (
              <span key={label} aria-current="page" className={`${MODE_TAB} bg-card font-semibold shadow-[0_-10px_24px_-14px_rgb(20_20_22/0.25)]`}>
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
            ),
          )}
        </nav>
        <div className="rounded-tr-2xl rounded-b-2xl bg-card p-5 shadow-panel sm:p-7">
          <ul className="mb-5 flex flex-wrap gap-x-8 gap-y-1 text-sm font-medium">
            <li>Mobile + Desktop</li>
            <li>Real-user data, last 28 days</li>
            <li>Lighthouse lab run</li>
          </ul>
          <UrlForm />
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="mt-20 scroll-mt-8">
        <h2 id="how-heading" className="text-4xl font-bold sm:text-5xl">How It Works</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Test any public page on mobile and desktop, then see how it performs for real visitors and
          what to fix first.
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <div key={feature.title} className="rounded-xl border border-dashed border-input p-5">
              <dt>
                <span className="block text-3xl font-semibold tabular-nums">0{index + 1}</span>
                <span className="mt-3 block text-lg font-semibold">{feature.title}</span>
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{feature.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
