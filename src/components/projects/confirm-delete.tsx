"use client";

import { Button } from "@/components/ui/button";

export function ConfirmDelete({
  action,
  label,
  message,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  message: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="text-poor">
        {label}
      </Button>
    </form>
  );
}
