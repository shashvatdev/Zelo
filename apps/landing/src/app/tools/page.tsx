import HubPage from "@/components/page/HubPage";
import { TOOLS } from "@/content/tools";
import { pageMetadata } from "@/lib/seo";

const title = "Free tools for software teams: release notes, velocity | Zelo";
const description =
  "Free browser tools for software teams: turn commits into release notes and forecast a release from sprint velocity. No sign-up.";

export const metadata = pageMetadata({ path: "/tools", title, description });

export default function ToolsHub() {
  return (
    <HubPage
      path="/tools"
      name={title}
      description={description}
      crumbs={[{ name: "Free tools", path: "/tools" }]}
      eyebrow="free, no sign-up"
      title="Small tools,"
      accent="real time saved."
      lede="Free tools that run in your browser. Nothing you type leaves your computer."
      items={TOOLS.map((t) => ({
        href: `/tools/${t.slug}`,
        kicker: "Free tool",
        title: t.name,
        body: t.lede,
      }))}
    />
  );
}
