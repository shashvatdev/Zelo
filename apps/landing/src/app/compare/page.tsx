import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import { COMPETITORS } from "@/lib/competitors";
import { SITE, SITE_URL } from "@/lib/site";

const title = "Switching to Zelo: how it compares to Jira and ClickUp";
const description =
  "Coming from Jira or ClickUp? See what changes when your work becomes one connected map of releases, features and tickets, and what comes with you.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/compare" },
  openGraph: {
    type: "website",
    url: "/compare",
    siteName: SITE.name,
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

const PROMISES = [
  {
    title: "Your work comes with you",
    body: "Importers bring tickets, epics, lists and versions across and place them on the map. Planned for the beta.",
  },
  {
    title: "Your process keeps its steps",
    body: "Bring your workflow states, from To do to Done. Zelo maps each one to a category, so reports still make sense.",
  },
  {
    title: "You gain the whole picture",
    body: "Every ticket under its feature, every feature in its release, and the spec right beside the work.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/compare`,
      url: `${SITE_URL}/compare`,
      name: title,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: COMPETITORS.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Zelo vs ${c.name}`,
          url: `${SITE_URL}/vs/${c.slug}`,
        })),
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE.name, item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Compare",
          item: `${SITE_URL}/compare`,
        },
      ],
    },
  ],
};

export default function ComparePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Nav />
      <main>
        <section className="vs-hero">
          <nav className="crumb" aria-label="Breadcrumb">
            <Link href="/">Zelo</Link> <span aria-hidden="true">/</span>{" "}
            <span>Compare</span>
          </nav>
          <p className="eyebrow hand">coming from another tool?</p>
          <h1 className="display vs-title">
            Switching to Zelo,
            <br />
            <em>without starting over.</em>
          </h1>
          <p className="lede">
            Most teams arrive from a list or board tool. Here is how Zelo
            compares, and what changes when your work becomes a map.
          </p>
        </section>

        <section className="section compare-hub">
          <div className="hub-cards">
            {COMPETITORS.map((c, i) => (
              <Reveal key={c.slug} delay={i * 0.08}>
                <Link href={`/vs/${c.slug}`} className="hub-card">
                  <p className="hub-vs">Zelo vs {c.name}</p>
                  <h2 className="display">
                    {c.headline[0]} <em>{c.headline[1]}</em>
                  </h2>
                  <p className="hub-lede">{c.lede}</p>
                  <span className="hub-go">Read the comparison &rarr;</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section">
          <Reveal>
            <p className="kicker">What switching means</p>
            <h2 className="display h2">
              Same work. <em>New view.</em>
            </h2>
          </Reveal>
          <div className="steps hub-promises">
            {PROMISES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08} className="step">
                <p className="step-n">0{i + 1}</p>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
        <p className="tm">
          Jira and ClickUp are trademarks of their respective owners. Zelo is
          not affiliated with or endorsed by them.
        </p>
      </main>
      <Waitlist />
    </>
  );
}
