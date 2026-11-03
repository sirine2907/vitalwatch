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

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl sm:pt-6">
      <p className="font-mono text-xs tracking-widest text-mark uppercase">Page speed test</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        Find out what&apos;s slowing your site down.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        Test any public page on mobile and desktop, then see how it performs for real visitors and
        what to fix first.
      </p>

      <div className="mt-10 border border-foreground bg-card p-5 sm:p-6">
        <UrlForm />
      </div>

      <dl className="mt-14 grid border-t border-foreground sm:grid-cols-3 sm:divide-x sm:divide-border">
        {FEATURES.map((feature, index) => (
          <div key={feature.title} className="border-b py-5 sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <dt>
              <span className="block font-mono text-xs text-mark">0{index + 1}</span>
              <span className="mt-2 block font-heading text-lg font-semibold">{feature.title}</span>
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{feature.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
