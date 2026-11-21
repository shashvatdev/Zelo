import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import {
  JsonLd,
  PageHero,
  RelatedLinks,
  SectionHead,
} from "@/components/page/PageBits";
import { ALTERNATIVES, getAlternatives } from "@/content/alternatives";
import {
  breadcrumbLd,
  faqLd,
  FOUNDER,
  ldGraph,
  pageMetadata,
  PUBLISHED,
} from "@/lib/seo";
import { SITE, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return ALTERNATIVES.map((a) => ({ tool: a.slug }));
}

export async function generateMetadata(
  props: PageProps<"/alternatives/[tool]">,
): Promise<Metadata> {
  const { tool } = await props.params;
  const a = getAlternatives(tool);
  if (!a) return {};
  return pageMetadata({
    path: `/alternatives/${a.slug}`,
    title: a.metaTitle,
    description: a.metaDescription,
    ownImage: true,
    type: "article",
  });
}

export default async function AlternativesPage(
  props: PageProps<"/alternatives/[tool]">,
) {
  const { tool } = await props.params;
  const a = getAlternatives(tool);
  if (!a) notFound();
  const path = `/alternatives/${a.slug}`;
  const crumbs = [
    { name: "Compare", path: "/compare" },
    { name: `${a.tool} alternatives`, path },
  ];
  const ld = ldGraph(
    {
      "@type": "Article",
      headline: a.metaTitle,
      description: a.metaDescription,
      url: `${SITE_URL}${path}`,
      datePublished: PUBLISHED,
      dateModified: PUBLISHED,
      author: { "@type": "Person", name: FOUNDER.name },
      publisher: { "@id": `${SITE_URL}/#org` },
      image: `${SITE_URL}${path}/opengraph-image`,
    },
    {
      "@type": "ItemList",
      name: a.metaTitle,
      itemListElement: a.picks.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: p.site.startsWith("/") ? `${SITE_URL}${p.site}` : p.site,
      })),
    },
    breadcrumbLd(crumbs),
    faqLd(a.faqs),
  );

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow={`updated ${new Date(PUBLISHED).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`}
          title={`${a.picks.length} ${a.tool} alternatives`}
          accent="for software teams."
          lede={a.intro}
          actions={false}
        />

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="Why teams look elsewhere"
              title={<>Signs it&apos;s time to switch</>}
            />
            <ul className="ticks article-ticks">
              {a.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="The list"
              title={<>The alternatives, compared</>}
            />
          </Reveal>
          <ol className="alt-list">
            {a.picks.map((p, i) => (
              <li key={p.name} className="alt-item">
                <div className="alt-head">
                  <span className="alt-n">{i + 1}</span>
                  <div>
                    <h3 className="display">{p.name}</h3>
                    <p className="alt-best">Best for: {p.bestFor}</p>
                  </div>
                </div>
                <p className="alt-summary">{p.summary}</p>
                <div className="alt-cols">
                  <div>
                    <p className="alt-label">Strengths</p>
                    <ul className="ticks">
                      {p.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="alt-label">Consider</p>
                    <ul className="alt-cons">
                      {p.considerations.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="alt-links">
                  {p.compare && (
                    <Link href={p.compare} className="more-link">
                      {p.name === SITE.name
                        ? `Zelo vs ${a.tool}`
                        : `Zelo vs ${p.name}`}{" "}
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  )}
                  {!p.site.startsWith("/") && (
                    <a
                      href={p.site}
                      className="alt-ext"
                      rel="noopener nofollow"
                      target="_blank"
                    >
                      {p.name} website
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="How to choose"
              title={<>Pick by what hurts most</>}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="vs-table-wrap">
              <table className="vs-table choose-table">
                <thead>
                  <tr>
                    <th scope="col">If you…</th>
                    <th scope="col" className="us">
                      Consider
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.choose.map((c) => (
                    <tr key={c.if}>
                      <td>{c.if}</td>
                      <td className="us">{c.then}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <p className="fine">
            Written by the Zelo team. We included our own product and tried to
            describe every tool fairly; check each product&apos;s site for
            current features and pricing.
          </p>
        </section>

        <RelatedLinks
          links={[
            { href: `/vs/${a.slug}`, label: `Zelo vs ${a.tool}` },
            ...ALTERNATIVES.filter((o) => o.slug !== a.slug).map((o) => ({
              href: `/alternatives/${o.slug}`,
              label: `${o.tool} alternatives`,
            })),
            { href: "/compare", label: "All comparisons" },
          ]}
        />
        <Faq
          items={a.faqs}
          title={
            <>
              {a.tool} alternatives, <em>answered</em>.
            </>
          }
        />
        <p className="tm">
          All product names are trademarks of their respective owners. Zelo is
          not affiliated with them.
        </p>
      </main>
      <Waitlist />
    </>
  );
}
