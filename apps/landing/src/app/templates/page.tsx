import HubPage from "@/components/page/HubPage";
import { TEMPLATES } from "@/content/templates";
import { pageMetadata } from "@/lib/seo";

const title = "Free templates for software teams: release plan, PRD | Zelo";
const description =
  "Free, copy-ready templates for software teams: release plan, PRD, bug triage, sprint retrospective and release notes, in Markdown.";

export const metadata = pageMetadata({
  path: "/templates",
  title,
  description,
});

export default function TemplatesHub() {
  return (
    <HubPage
      path="/templates"
      name={title}
      description={description}
      crumbs={[{ name: "Templates", path: "/templates" }]}
      eyebrow="free, copy-ready"
      title="Templates for"
      accent="shipping software."
      lede="Plans, specs, triage, retros and release notes. Copy any of them as Markdown, or download the file, and use them anywhere."
      items={TEMPLATES.map((t) => ({
        href: `/templates/${t.slug}`,
        kicker: "Template",
        title: t.name,
        body: t.summary,
      }))}
    />
  );
}
