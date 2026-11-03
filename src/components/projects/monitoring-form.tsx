"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormState {
  error?: string;
  saved?: boolean;
}

export interface MonitoringValues {
  schedule: string;
  scoreDropThreshold: number;
  emailAlerts: boolean;
}

const SCHEDULE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
];

export function MonitoringForm({
  action,
  values,
  emailNote,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: MonitoringValues;
  emailNote: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div>
        <Label htmlFor="schedule" className="mb-2 block">
          Automatic tests
        </Label>
        <select
          id="schedule"
          name="schedule"
          defaultValue={values.schedule}
          className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
        >
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="scoreDropThreshold" className="mb-2 block">
          Alert when the score drops by more than
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="scoreDropThreshold"
            name="scoreDropThreshold"
            type="number"
            min={1}
            max={50}
            defaultValue={values.scoreDropThreshold}
            className="h-10 w-24 bg-card"
          />
          <span className="text-sm text-muted-foreground">points below the usual score</span>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="emailAlerts"
          defaultChecked={values.emailAlerts}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          Email me when an alert opens
          {emailNote && <span className="block text-muted-foreground">{emailNote}</span>}
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending} className="h-10 px-5">
          {pending ? "Saving..." : "Save monitoring"}
        </Button>
        {state.saved && !pending && (
          <span role="status" className="text-sm text-good">
            Saved
          </span>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-poor">
          {state.error}
        </p>
      )}
    </form>
  );
}
