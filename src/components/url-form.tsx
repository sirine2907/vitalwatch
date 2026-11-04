"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUrl } from "@/domain/url/validate";
import { cn } from "@/lib/utils";

export function UrlForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read from the form, not React state, so text typed before the page's
    // JavaScript loaded still counts.
    const value = String(new FormData(event.currentTarget).get("url") ?? "");
    const validation = validateUrl(value);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    router.push(`/analyze?url=${encodeURIComponent(validation.url)}`);
  }

  return (
    // action and method make this a normal form until JavaScript has loaded.
    <form action="/analyze" method="get" onSubmit={submit} noValidate className="w-full">
      {/* Dashed "ticket" fields: the URL to fill in, then a summary of what runs. */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div
            className={cn(
              "flex-[2] rounded-xl border border-dashed border-input px-5 py-4 focus-within:border-solid focus-within:border-foreground",
              error && "border-solid border-poor",
            )}
          >
            <Label htmlFor="url" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Page URL
            </Label>
            <Input
              id="url"
              name="url"
              defaultValue={defaultValue}
              placeholder="example.com"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              aria-invalid={error !== null}
              aria-describedby={error ? "url-error url-hint" : "url-hint"}
              className="mt-1 h-auto rounded-none border-0 bg-transparent p-0 text-2xl font-semibold placeholder:text-foreground/30 focus-visible:ring-0 aria-invalid:ring-0 md:text-2xl dark:bg-transparent"
            />
            <p id="url-hint" className="mt-1 text-xs text-muted-foreground">
              Any public page, with or without https://
            </p>
          </div>

          <span
            className="z-10 -mx-[26px] hidden size-11 shrink-0 place-items-center self-center rounded-full border border-dashed border-input bg-card sm:grid"
            aria-hidden
          >
            <ArrowRight className="size-4" />
          </span>

          <div className="flex-1 rounded-xl border border-dashed border-input bg-muted/40 px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tested on</p>
            <p className="mt-1 text-2xl font-semibold">Mobile &amp; Desktop</p>
            <p className="mt-1 text-xs text-muted-foreground">Side by side, from Google&apos;s servers</p>
          </div>
        </div>

        <Button type="submit" className="h-14 gap-2 rounded-xl px-8 text-base lg:h-auto lg:w-44">
          Test page
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      {error && (
        <p id="url-error" role="alert" className="mt-2 text-sm text-poor">
          {error}
        </p>
      )}
    </form>
  );
}
