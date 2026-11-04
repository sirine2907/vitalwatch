import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-sm sm:pt-8">
      <h1 className="text-4xl leading-none font-bold sm:text-5xl">Check your email</h1>
      <p className="mt-2 text-muted-foreground">
        We sent you a sign-in link. It works once and expires in 24 hours.
      </p>
    </div>
  );
}
