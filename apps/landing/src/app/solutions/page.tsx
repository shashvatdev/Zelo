import HubPage from "@/components/page/HubPage";
import { SOLUTIONS } from "@/content/landings";
import { pageMetadata } from "@/lib/seo";

const title = "Solutions: release management, bug tracking and roadmaps | Zelo";
const description =
  "How Zelo handles release management, bug tracking, product roadmaps and visual project management for software teams.";

export const metadata = pageMetadata({
  path: "/solutions",
  title,
  description,
});

export default function SolutionsHub() {
  return (
    <HubPage
      path="/solutions"
      name={title}
      description={description}
      crumbs={[{ name: "Solutions", path: "/solutions" }]}
      eyebrow="what teams use Zelo for"
      title="One map,"
      accent="many jobs."
      lede="Release management, bug tracking, roadmaps and day-to-day project work, all on the same connected map of your product."
      items={SOLUTIONS.map((s) => ({
        href: `/solutions/${s.slug}`,
        kicker: "Solution",
        title: s.label,
        body: s.lede,
      }))}
    />
  );
}
