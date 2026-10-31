"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { projectService } from "@/services/app.factory";
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
