import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project/ProjectDetail";
import { projectBySlug, projectsWithPages } from "@/data/projects";
import { labViewQuery } from "@/lib/lab-v2-pages";

/**
 * M1.4L.2: project pages of the experimental lab, `/lab-v2/projects/[slug]`.
 * Only projects with approved detail content have one (SQLOrbit for now);
 * every other slug is a 404. Not linked from the homepage and not indexed,
 * like `/lab-v2` itself. The 3D scene is not mounted here.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return projectsWithPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lab-v2/projects/[slug]">): Promise<Metadata> {
  const project = projectBySlug((await params).slug);
  if (!project?.detail) return {};
  return {
    title: `${project.name} — Lab v2 (experimental)`,
    description: project.detail.tagline,
    robots: { index: false, follow: false },
  };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/lab-v2/projects/[slug]">) {
  const project = projectBySlug((await params).slug);
  if (!project?.detail) notFound();
  return <ProjectDetail project={{ ...project, detail: project.detail }} view={labViewQuery(await searchParams)} />;
}
