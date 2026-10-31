"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl sm:pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t load this page. Your data is safe, so please try again.
      </p>
      <Button variant="outline" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
