"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUrl } from "@/domain/url/validate";

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
      <Label htmlFor="url" className="mb-2 block">
        Page URL
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="url"
          name="url"
          defaultValue={defaultValue}
          placeholder="example.com"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? "url-error" : undefined}
          className="h-11 bg-card text-base"
        />
        <Button type="submit" className="h-11 px-6 text-base">
          Test page
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
