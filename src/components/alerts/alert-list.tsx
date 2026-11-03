import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { alertDetail, alertTitle, type AlertDescription } from "@/domain/monitoring/alert-text";

export interface AlertItem extends AlertDescription {
  id: string;
  projectId: string;
  projectName: string;
  urlId: string;
  url: string;
  urlLabel: string | null;
  status: "open" | "resolved";
  readAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export function AlertList({ alerts, showProject = true }: { alerts: AlertItem[]; showProject?: boolean }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        No alerts. Alerts appear here when a scheduled test finds a confirmed drop.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {alerts.map((alert) => (
        <li key={alert.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={alert.status === "open" ? "destructive" : "secondary"}>
              {alert.status === "open" ? "Open" : "Resolved"}
            </Badge>
            {!alert.readAt && <span className="text-xs font-medium text-primary">New</span>}
            <span className="text-sm text-muted-foreground">
              <LocalTime iso={alert.createdAt.toISOString()} />
            </span>
          </div>
          <p className="mt-2 font-medium">{alertTitle(alert)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{alertDetail(alert)}</p>
          <Link
            href={`/projects/${alert.projectId}/urls/${alert.urlId}`}
            className="mt-2 inline-block text-sm break-all underline underline-offset-2"
          >
            {showProject && `${alert.projectName}: `}
            {alert.urlLabel ?? alert.url}
          </Link>
        </li>
      ))}
    </ul>
  );
}
