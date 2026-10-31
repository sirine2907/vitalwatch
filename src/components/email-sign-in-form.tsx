"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailSignInState {
  error?: string;
  email?: string;
}

export function EmailSignInForm({
  action,
}: {
  action: (state: EmailSignInState, formData: FormData) => Promise<EmailSignInState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <Label htmlFor="email" className="mb-2 block">
        Email
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        placeholder="you@example.com"
        aria-invalid={Boolean(state.error)}
        className="h-11 bg-card text-base"
      />
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-poor">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending} className="mt-3 h-11 w-full text-base">
        {pending ? "Sending..." : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
