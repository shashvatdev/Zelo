import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LandingPage from "@/components/page/LandingPage";
import { getSolution, SOLUTIONS } from "@/content/landings";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(
  props: PageProps<"/solutions/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const s = getSolution(slug);
  if (!s) return {};
  return pageMetadata({
    path: `/solutions/${s.slug}`,
    title: s.metaTitle,
    description: s.metaDescription,
    ownImage: true,
  });
}

export default async function SolutionPage(
  props: PageProps<"/solutions/[slug]">,
) {
  const { slug } = await props.params;
  const s = getSolution(slug);
  if (!s) notFound();
  const path = `/solutions/${s.slug}`;
  return (
    <LandingPage
      page={s}
      path={path}
      crumbs={[
        { name: "Solutions", path: "/solutions" },
        { name: s.label, path },
      ]}
    />
  );
}
