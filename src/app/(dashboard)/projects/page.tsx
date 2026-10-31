import type { Metadata } from "next";
import Link from "next/link";
import { SimpleForm } from "@/components/projects/simple-form";
import { MAX_PROJECT_NAME_LENGTH } from "@/domain/projects/limits";
import { requireUser } from "@/lib/session";
import { projectService } from "@/services/app.factory";
import { createProjectAction } from "./actions";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await projectService().list(user.id);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-2 text-muted-foreground">A project is one site and the pages you track on it.</p>

      <div className="mt-8 rounded-lg border bg-card p-4">
        <SimpleForm
          action={createProjectAction}
          fields={[
            {
              name: "name",
              label: "New project",
              placeholder: `My site (up to ${MAX_PROJECT_NAME_LENGTH} characters)`,
              grow: true,
            },
          ]}
          submitLabel="Create project"
          pendingLabel="Creating..."
        />
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No projects yet. Create your first one above.</p>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border bg-card">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-accent"
              >
                <span className="min-w-0 font-medium break-words">{project.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {project.urlCount} {project.urlCount === 1 ? "URL" : "URLs"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
