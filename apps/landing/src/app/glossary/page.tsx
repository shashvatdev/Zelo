import HubPage from "@/components/page/HubPage";
import { TERMS } from "@/content/glossary";
import { pageMetadata } from "@/lib/seo";

const title = "Software project glossary: release, sprint, PRD and more | Zelo";
const description =
  "Plain-English definitions of release management, release trains, epics, story points, velocity, PRDs, bug triage and other software project terms.";

export const metadata = pageMetadata({ path: "/glossary", title, description });

export default function GlossaryHub() {
  const items = [...TERMS]
    .sort((a, b) => a.term.localeCompare(b.term))
    .map((t) => ({
      href: `/glossary/${t.slug}`,
      kicker: "Term",
      title: t.term,
      body: t.short,
    }));
  return (
    <HubPage
      path="/glossary"
      name={title}
      description={description}
      crumbs={[{ name: "Glossary", path: "/glossary" }]}
      eyebrow="plain-English definitions"
      title="The words of"
      accent="shipping software."
      lede="Short, clear definitions of the terms software teams use every day, with an example and how each one looks in Zelo."
      items={items}
    />
  );
}
