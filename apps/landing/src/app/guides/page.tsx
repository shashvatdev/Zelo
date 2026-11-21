import HubPage from "@/components/page/HubPage";
import { GUIDES } from "@/content/guides";
import { pageMetadata } from "@/lib/seo";

const title = "Guides for software teams: releases, bugs and PRDs | Zelo";
const description =
  "Practical guides for software teams: how to plan a release, track bugs across releases and write PRDs developers actually read.";

export const metadata = pageMetadata({ path: "/guides", title, description });

export default function GuidesHub() {
  return (
    <HubPage
      path="/guides"
      name={title}
      description={description}
      crumbs={[{ name: "Guides", path: "/guides" }]}
      eyebrow="practical, no fluff"
      title="Guides for"
      accent="teams that ship."
      lede="Step-by-step guides on planning releases, tracking bugs and writing specs, from the team building Zelo."
      items={GUIDES.map((g) => ({
        href: `/guides/${g.slug}`,
        kicker: `${g.minutes} min read`,
        title: g.title,
        body: g.intro,
      }))}
    />
  );
}
