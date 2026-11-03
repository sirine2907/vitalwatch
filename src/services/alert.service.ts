import type { Db } from "@/data/db";
import * as repo from "@/data/repositories/alerts.repository";
import type { JobContext } from "@/data/repositories/monitoring.repository";
import { canReceiveEmail } from "@/domain/auth/email-policy";
import { alertDetail, alertTitle } from "@/domain/monitoring/alert-text";
import type { Check } from "@/domain/monitoring/regression";
import type { Strategy } from "@/domain/psi/types";
import type { Email } from "@/integrations/resend";

export interface AlertDependencies {
  db: Db;
  /** Null when email isn't configured; alerts then only appear in the app. */
  sendEmail: ((email: Email) => Promise<void>) | null;
  ownerAddress?: string;
  appUrl: string;
}

const FEED_LIMIT = 100;

export function createAlertService(deps: AlertDependencies) {
  const { db } = deps;

  async function notify(context: JobContext, alertId: string, subject: string, body: string) {
    const to = context.userEmail;
    if (!deps.sendEmail || !context.emailAlerts || !to) return;
    if (!canReceiveEmail(to, deps.ownerAddress)) return;

    try {
      await deps.sendEmail({ to, subject, text: body });
      await repo.markEmailed(db, alertId);
    } catch (error) {
      // The alert is already in the app, so a failed email is logged, not retried.
      console.error("[vitalwatch] alert email failed:", error instanceof Error ? error.message : "unknown");
    }
  }

  return {
    /** Opens an alert unless one is already open for this problem. Returns true if new. */
    async raise(context: JobContext, strategy: Strategy, check: Check, runId: string) {
      const alert = {
        projectId: context.projectId,
        urlId: context.urlId,
        triggerRunId: runId,
        type: check.type,
        metric: check.metric,
        source: check.source,
        strategy,
        baselineValue: check.baseline,
        currentValue: check.current,
        threshold: check.threshold,
      };
      const alertId = await repo.insertAlert(db, alert);
      if (!alertId) return false;

      const description = { ...alert };
      const title = alertTitle(description);
      const page = context.label ?? context.url;
      const link = `${deps.appUrl}/projects/${context.projectId}/urls/${context.urlId}`;
      await notify(
        context,
        alertId,
        `${title} on ${page}`,
        [
          `${title} on ${context.url} (${context.projectName}).`,
          alertDetail(description),
          `See the history: ${link}`,
          `You get these emails because alerts are on for this project. You can turn them off in its settings.`,
        ].join("\n\n"),
      );
      return true;
    },

    resolve: (urlId: string, strategy: Strategy, check: Check) =>
      repo.resolveAlert(db, { urlId, strategy, type: check.type, metric: check.metric }),

    list: (userId: string, projectId?: string) =>
      repo.listAlerts(db, userId, { projectId, limit: FEED_LIMIT }),

    countUnread: (userId: string) => repo.countUnread(db, userId),

    markAllRead: (userId: string) => repo.markAllRead(db, userId),
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
