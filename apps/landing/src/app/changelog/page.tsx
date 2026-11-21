import Nav from "@/components/Nav";
import Waitlist from "@/components/Waitlist";
import { JsonLd, PageHero } from "@/components/page/PageBits";
import { breadcrumbLd, ldGraph, pageMetadata, webPageLd } from "@/lib/seo";

const title = "Zelo changelog: what's new";
const description =
  "Everything that has changed in Zelo, newest first: new pages, features and improvements as we build toward launch.";

export const metadata = pageMetadata({
  path: "/changelog",
  title,
  description,
});

/** Newest first. Add an entry for every meaningful change. */
const ENTRIES = [
  {
    date: "2026-11-21",
    title: "Guides, glossary, templates and free tools",
    items: [
      "Three guides: planning a release, tracking bugs across releases, writing a PRD developers read",
      "A glossary of 15 software project terms",
      "Five free templates with copy and download",
      "Free release notes generator and velocity calculator",
      "Solution pages, team pages, pricing, about and security",
    ],
  },
  {
    date: "2026-11-21",
    title: "Comparisons and Ask Zelo",
    items: [
      "Comparisons with Jira, ClickUp, Linear, Asana, monday.com and Notion",
      "Ask Zelo demo: ask about a release and get the answer as a flowchart",
    ],
  },
  {
    date: "2026-11-21",
    title: "Zelo website and waitlist",
    items: [
      "The Zelo website, with the release-tree film and the waitlist",
      "Search-friendly structure and structured data",
    ],
  },
];

const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function ChangelogPage() {
  const crumbs = [{ name: "Changelog", path: "/changelog" }];
  return (
    <>
      <JsonLd
        data={ldGraph(
          webPageLd("/changelog", title, description),
          breadcrumbLd(crumbs),
        )}
      />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow="newest first"
          title="What's new"
          accent="in Zelo."
          lede="A running log of what we ship, as we build toward launch."
          actions={false}
        />
        <section className="section article-section">
          <ol className="changelog">
            {ENTRIES.map((e) => (
              <li key={e.title} className="cl-entry">
                <time dateTime={e.date} className="cl-date">
                  {fmt(e.date)}
                </time>
                <div>
                  <h2 className="display">{e.title}</h2>
                  <ul>
                    {e.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Waitlist />
    </>
  );
}
