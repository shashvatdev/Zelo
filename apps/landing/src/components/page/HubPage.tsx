import Link from "next/link";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import { SITE_URL } from "@/lib/site";
import { breadcrumbLd, ldGraph, type Crumb } from "@/lib/seo";
import { JsonLd, PageHero } from "./PageBits";

export type HubItem = {
  href: string;
  kicker: string;
  title: string;
  body: string;
};

/** A listing page (solutions, teams, templates, glossary, guides, tools) with CollectionPage data. */
export default function HubPage({
  path,
  name,
  description,
  crumbs,
  eyebrow,
  title,
  accent,
  lede,
  items,
  children,
}: {
  path: string;
  name: string;
  description: string;
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  items: HubItem[];
  children?: ReactNode;
}) {
  const ld = ldGraph(
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}${path}`,
      url: `${SITE_URL}${path}`,
      name,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.title,
          url: `${SITE_URL}${it.href}`,
        })),
      },
    },
    breadcrumbLd(crumbs),
  );

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow={eyebrow}
          title={title}
          accent={accent}
          lede={lede}
          actions={false}
        />
        <section className="section compare-hub">
          <div className="hub-grid">
            {items.map((it, i) => (
              <Reveal key={it.href} delay={Math.min(i, 6) * 0.05}>
                <Link href={it.href} className="hub-card hub-card-sm">
                  <p className="hub-vs">{it.kicker}</p>
                  <h2 className="display">{it.title}</h2>
                  <p className="hub-lede">{it.body}</p>
                  <span className="hub-go">Open &rarr;</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
        {children}
      </main>
      <Waitlist />
    </>
  );
}
