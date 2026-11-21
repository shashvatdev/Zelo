import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Waitlist from "@/components/Waitlist";
import { Breadcrumbs, JsonLd, RelatedLinks } from "@/components/page/PageBits";
import { getTerm, QUESTIONS, TERMS } from "@/content/glossary";
import { breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return TERMS.map((t) => ({ term: t.slug }));
}

const question = (slug: string, term: string) =>
  QUESTIONS[slug] ?? `What is ${term}?`;
const titleFor = (slug: string, term: string) =>
  `${question(slug, term)} Definition and examples | Zelo`;

export async function generateMetadata(
  props: PageProps<"/glossary/[term]">,
): Promise<Metadata> {
  const { term } = await props.params;
  const t = getTerm(term);
  if (!t) return {};
  return pageMetadata({
    path: `/glossary/${t.slug}`,
    title: titleFor(t.slug, t.term),
    description: t.short,
    ownImage: true,
  });
}

export default async function TermPage(props: PageProps<"/glossary/[term]">) {
  const { term } = await props.params;
  const t = getTerm(term);
  if (!t) notFound();
  const path = `/glossary/${t.slug}`;
  const crumbs = [
    { name: "Glossary", path: "/glossary" },
    { name: t.term, path },
  ];
  const ld = ldGraph(
    {
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}${path}#term`,
      name: t.term,
      description: t.short,
      url: `${SITE_URL}${path}`,
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        name: "Zelo glossary",
        url: `${SITE_URL}/glossary`,
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}${path}`,
      url: `${SITE_URL}${path}`,
      name: titleFor(t.slug, t.term),
      description: t.short,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: { "@id": `${SITE_URL}${path}#term` },
    },
    breadcrumbLd(crumbs),
  );
  const related = t.related
    .map((slug) => getTerm(slug))
    .filter((r) => r !== undefined);

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <article className="article">
          <Breadcrumbs crumbs={crumbs} />
          <p className="kicker">Glossary</p>
          <h1 className="display article-title">{question(t.slug, t.term)}</h1>
          <p className="definition">{t.short}</p>
          {t.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <h2>Example</h2>
          <p>{t.example}</p>
          <h2>{t.term.replace(/ \(.*\)$/, "")} in Zelo</h2>
          <p>{t.inZelo}</p>
          <h2>Related terms</h2>
          <ul className="term-links">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/glossary/${r.slug}`}>{r.term}</Link>
              </li>
            ))}
          </ul>
        </article>
        <RelatedLinks
          links={[
            { href: "/glossary", label: "All glossary terms" },
            { href: "/templates", label: "Free templates" },
            { href: "/guides", label: "Guides" },
          ]}
        />
      </main>
      <Waitlist />
    </>
  );
}
