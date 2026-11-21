import HubPage from "@/components/page/HubPage";
import { TEAMS } from "@/content/landings";
import { pageMetadata } from "@/lib/seo";

const title = "Zelo for product, engineering, QA and agency teams";
const description =
  "How product managers, engineering teams, QA and agencies use Zelo to plan, build and ship software releases on one map.";

export const metadata = pageMetadata({ path: "/for", title, description });

export default function TeamsHub() {
  return (
    <HubPage
      path="/for"
      name={title}
      description={description}
      crumbs={[{ name: "Teams", path: "/for" }]}
      eyebrow="built for the whole release team"
      title="Everyone on the release,"
      accent="on the same map."
      lede="Product, engineering, QA and the business team each get the view they need, from the same connected work."
      items={TEAMS.map((t) => ({
        href: `/for/${t.slug}`,
        kicker: "For",
        title: t.label,
        body: t.lede,
      }))}
    />
  );
}
