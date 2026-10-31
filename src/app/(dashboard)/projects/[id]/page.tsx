import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmDelete } from "@/components/projects/confirm-delete";
import { SimpleForm } from "@/components/projects/simple-form";
import { ScoreLabel } from "@/components/results/score-label";
import { requireUser } from "@/lib/session";
import { projectService } from "@/services/app.factory";
import { orNotFound } from "../../helpers";
import { addUrlAction, deleteProjectAction, renameProjectAction } from "../actions";

export const metadata: Metadata = { title: "Project", robots: { index: false } };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { project, urls } = await orNotFound(projectService().getOverview(user.id, id));

  return (
    <div>
      <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
        Projects
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-3xl font-semibold tracking-tight break-words">{project.name}</h1>
        <ConfirmDelete
          action={deleteProjectAction.bind(null, project.id)}
          label="Delete project"
          message={`Delete "${project.name}" and all of its test history? This can't be undone.`}
        />
      </div>

      <div className="mt-8 rounded-lg border bg-card p-4">
        <SimpleForm
          action={addUrlAction.bind(null, project.id)}
          fields={[
            { name: "url", label: "Page URL", placeholder: "example.com/pricing", grow: true },
            { name: "label", label: "Label (optional)", placeholder: "Pricing page" },
          ]}
          submitLabel="Add URL"
          pendingLabel="Adding..."
        />
      </div>

      {urls.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No URLs yet. Add the pages you want to track, starting with your home page.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th scope="col" className="p-4 font-medium">Page</th>
                <th scope="col" className="p-4 font-medium">Mobile</th>
                <th scope="col" className="p-4 font-medium">Desktop</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {urls.map((url) => (
                <tr key={url.id}>
                  <td className="p-4">
                    <Link
                      href={`/projects/${project.id}/urls/${url.id}`}
                      className="font-medium break-all hover:underline"
                    >
                      {url.label ?? url.url}
                    </Link>
                    {url.label && <p className="break-all text-muted-foreground">{url.url}</p>}
                  </td>
                  <td className="p-4"><ScoreLabel score={url.mobile} /></td>
                  <td className="p-4"><ScoreLabel score={url.desktop} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="settings-heading" className="mt-12 border-t pt-8">
        <h2 id="settings-heading" className="text-lg font-semibold">Settings</h2>
        <div className="mt-4 max-w-xl">
          <SimpleForm
            action={renameProjectAction.bind(null, project.id)}
            fields={[{ name: "name", label: "Project name", defaultValue: project.name, grow: true }]}
            submitLabel="Rename"
            pendingLabel="Saving..."
            variant="outline"
          />
        </div>
      </section>
    </div>
  );
}
