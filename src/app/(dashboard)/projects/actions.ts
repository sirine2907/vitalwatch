"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appUrl, readEnv } from "@/lib/env";
import { projectService, reportService } from "@/services/app.factory";
import { runFormAction, type FormState } from "../helpers";

export async function createProjectAction(_state: FormState, formData: FormData) {
  let createdId: string | undefined;
  const state = await runFormAction(formData, async (userId, values) => {
    const project = await projectService().create(userId, values.name ?? "");
    createdId = project.id;
  });
  if (createdId) redirect(`/projects/${createdId}`);
  return state;
}

export async function renameProjectAction(
  projectId: string,
  _state: FormState,
  formData: FormData,
) {
  const state = await runFormAction(formData, (userId, values) =>
    projectService().rename(userId, projectId, values.name ?? ""),
  );
  revalidatePath(`/projects/${projectId}`);
  return state.error ? state : { values: state.values };
}

export async function deleteProjectAction(projectId: string, formData: FormData) {
  const { error } = await runFormAction(formData, (userId) =>
    projectService().remove(userId, projectId),
  );
  if (error) throw new Error(error);
  redirect("/projects");
}

export async function addUrlAction(projectId: string, _state: FormState, formData: FormData) {
  const state = await runFormAction(formData, async (userId, values) => {
    await projectService().addUrl(userId, projectId, values.url ?? "", values.label ?? "");
  });
  revalidatePath(`/projects/${projectId}`);
  return state;
}

export async function deleteUrlAction(projectId: string, urlId: string, formData: FormData) {
  const { error } = await runFormAction(formData, (userId) =>
    projectService().removeUrl(userId, urlId),
  );
  if (error) throw new Error(error);
  redirect(`/projects/${projectId}`);
}

export async function updateMonitoringAction(
  projectId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState & { saved?: boolean }> {
  const emailAlerts = formData.get("emailAlerts") === "on";
  const state = await runFormAction(formData, (userId, values) =>
    projectService().updateMonitoring(userId, projectId, {
      schedule: values.schedule ?? "",
      scoreDropThreshold: values.scoreDropThreshold ?? "",
      emailAlerts,
    }),
  );
  revalidatePath(`/projects/${projectId}`);
  return state.error ? state : { saved: true };
}

export async function addCompetitorAction(projectId: string, _state: FormState, formData: FormData) {
  const state = await runFormAction(formData, async (userId, values) => {
    await projectService().addUrl(userId, projectId, values.url ?? "", values.label ?? "", "competitor");
  });
  revalidatePath(`/projects/${projectId}`);
  return state;
}

export async function setBrandColorAction(projectId: string, _state: FormState, formData: FormData) {
  const state = await runFormAction(formData, (userId, values) =>
    reportService().setBrandColor(userId, projectId, values.brandColor ?? ""),
  );
  revalidatePath(`/projects/${projectId}`);
  return state.error ? state : { values: state.values };
}

export interface ShareState {
  error?: string;
  link?: string;
}

export async function createShareLinkAction(
  projectId: string,
  _state: ShareState,
  formData: FormData,
): Promise<ShareState> {
  let token: string | undefined;
  const state = await runFormAction(formData, async (userId, values) => {
    token = await reportService().createShareLink(userId, projectId, values.expiry ?? "");
  });
  revalidatePath(`/projects/${projectId}`);
  if (state.error || !token) return { error: state.error };
  return { link: `${appUrl(readEnv())}/r/${token}` };
}

export async function revokeShareLinkAction(projectId: string, reportId: string, formData: FormData) {
  const { error } = await runFormAction(formData, (userId) => reportService().revokeShareLink(userId, reportId));
  if (error) throw new Error(error);
  revalidatePath(`/projects/${projectId}`);
}
