"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormState {
  error?: string;
  values?: Record<string, string>;
}

interface Field {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  grow?: boolean;
}

export function SimpleForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  variant = "default",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {fields.map((field, index) => (
          <div key={field.name} className={field.grow ? "min-w-0 flex-[2]" : "min-w-0 flex-1"}>
            <Label htmlFor={field.name} className="mb-2 block">
              {field.label}
            </Label>
            <Input
              // Keeps what was typed after an error, because React resets forms.
              key={state.values?.[field.name] ?? field.defaultValue ?? ""}
              id={field.name}
              name={field.name}
              defaultValue={state.values?.[field.name] ?? field.defaultValue}
              placeholder={field.placeholder}
              // Later fields are optional, so errors are about the first one.
              aria-invalid={index === 0 && Boolean(state.error)}
              className="h-10 bg-card"
            />
          </div>
        ))}
        <Button type="submit" variant={variant} disabled={pending} className="h-10 px-5">
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-poor">
          {state.error}
        </p>
      )}
    </form>
  );
}
