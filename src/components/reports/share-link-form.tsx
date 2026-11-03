"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShareState {
  error?: string;
  link?: string;
}

export function ShareLinkForm({
  action,
}: {
  action: (state: ShareState, formData: FormData) => Promise<ShareState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <Label htmlFor="expiry" className="mb-2 block">
            Link expires
          </Label>
          <select
            id="expiry"
            name="expiry"
            defaultValue="30"
            className="h-10 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="7">In 7 days</option>
            <option value="30">In 30 days</option>
            <option value="never">Never</option>
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={pending} className="h-10 px-5">
          {pending ? "Creating..." : "Create share link"}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-poor">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="mt-4 rounded-lg border bg-card p-3">
          <Label htmlFor="share-link" className="mb-2 block">
            Copy this link now. For security it won&apos;t be shown again.
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="share-link" readOnly value={state.link} className="h-10 bg-background font-mono text-xs" />
            <Button
              type="button"
              className="h-10 px-5"
              onClick={() => {
                void navigator.clipboard?.writeText(state.link!).then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
