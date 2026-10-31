import { notFound, unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export interface FormState {
  error?: string;
  values?: Record<string, string>;
}

/** Shows the 404 page for missing data and for anything another user owns. */
export async function orNotFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }
}

/** Runs a form action as the signed-in user and returns errors for the form to show. */
export async function runFormAction(
  formData: FormData,
  action: (userId: string, values: Record<string, string>) => Promise<void>,
): Promise<FormState> {
  const values = Object.fromEntries(
    [...formData.entries()]
      .filter(([key, value]) => typeof value === "string" && !key.startsWith("$"))
      .map(([key, value]) => [key, value as string]),
  );

  try {
    const user = await requireUser();
    await action(user.id, values);
    return {};
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return { error: error.message, values };
    console.error("[vitalwatch] form action failed:", error instanceof Error ? error.name : "unknown");
    return { error: "Something went wrong. Please try again.", values };
  }
}
