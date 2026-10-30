"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUrl } from "@/domain/url/validate";

export function UrlForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateUrl(value);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    router.push(`/analyze?url=${encodeURIComponent(validation.url)}`);
  }

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <Label htmlFor="url" className="mb-2 block">
        Page URL
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
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
