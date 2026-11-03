import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { AlertList } from "@/components/alerts/alert-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { alertService } from "@/services/app.factory";

export const metadata: Metadata = { title: "Alerts", robots: { index: false } };

async function markAllRead() {
  "use server";
  const user = await requireUser();
  await alertService().markAllRead(user.id);
  revalidatePath("/", "layout");
}

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await alertService().list(user.id);
  const unread = alerts.some((alert) => !alert.readAt);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Alerts</h1>
        {unread && (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">
        Confirmed drops from scheduled tests, newest first. Alerts close on their own once a page recovers.
      </p>
      <div className="mt-8">
        <AlertList alerts={alerts} />
      </div>
    </div>
  );
}
