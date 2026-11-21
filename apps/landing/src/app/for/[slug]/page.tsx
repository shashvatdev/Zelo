import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LandingPage from "@/components/page/LandingPage";
import { getTeam, TEAMS } from "@/content/landings";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return TEAMS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  props: PageProps<"/for/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const t = getTeam(slug);
  if (!t) return {};
  return pageMetadata({
    path: `/for/${t.slug}`,
    title: t.metaTitle,
    description: t.metaDescription,
    ownImage: true,
  });
}

export default async function TeamPage(props: PageProps<"/for/[slug]">) {
  const { slug } = await props.params;
  const t = getTeam(slug);
  if (!t) notFound();
  const path = `/for/${t.slug}`;
  return (
    <LandingPage
      page={t}
      path={path}
      crumbs={[
        { name: "Teams", path: "/for" },
        { name: t.label, path },
      ]}
    />
  );
}
