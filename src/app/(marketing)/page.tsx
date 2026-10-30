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
    <div className="mx-auto max-w-3xl sm:pt-10">
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Find out what&apos;s slowing your site down.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Test any public page on mobile and desktop, then see how it performs for real visitors and
        what to fix first.
      </p>

      <div className="mt-8">
        <UrlForm />
      </div>

      <dl className="mt-14 grid gap-8 border-t pt-8 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title}>
            <dt className="font-medium">{feature.title}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{feature.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
