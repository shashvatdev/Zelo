import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Waitlist from "@/components/Waitlist";
import { Breadcrumbs, JsonLd, RelatedLinks } from "@/components/page/PageBits";
import { getGuide, GUIDES } from "@/content/guides";
import {
  breadcrumbLd,
  FOUNDER,
  ldGraph,
  pageMetadata,
  PUBLISHED,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(
  props: PageProps<"/guides/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const g = getGuide(slug);
  if (!g) return {};
  return pageMetadata({
    path: `/guides/${g.slug}`,
    title: g.metaTitle,
    description: g.metaDescription,
    ownImage: true,
    type: "article",
  });
}

export default async function GuidePage(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const g = getGuide(slug);
  if (!g) notFound();
  const path = `/guides/${g.slug}`;
  const crumbs = [
    { name: "Guides", path: "/guides" },
    { name: g.title, path },
  ];
  const ld = ldGraph(
    {
      "@type": "Article",
      "@id": `${SITE_URL}${path}#article`,
      headline: g.title,
      description: g.metaDescription,
      url: `${SITE_URL}${path}`,
      mainEntityOfPage: `${SITE_URL}${path}`,
      datePublished: PUBLISHED,
      dateModified: PUBLISHED,
      timeRequired: `PT${g.minutes}M`,
      author: {
        "@type": "Person",
        name: FOUNDER.name,
        jobTitle: `${FOUNDER.role}, Zelo`,
        url: `${SITE_URL}/about`,
      },
      publisher: { "@id": `${SITE_URL}/#org` },
      image: `${SITE_URL}${path}/opengraph-image`,
    },
    breadcrumbLd(crumbs),
  );

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <article className="article">
          <Breadcrumbs crumbs={crumbs} />
          <p className="kicker">Guide</p>
          <h1 className="display article-title">{g.title}</h1>
          <p className="article-meta">
            By {FOUNDER.name} · {g.minutes} min read ·{" "}
            <time dateTime={PUBLISHED}>
              {new Date(PUBLISHED).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </p>
          <p className="definition">{g.intro}</p>

          <nav className="toc" aria-label="Contents">
            <p className="toc-h">Contents</p>
            <ol>
              {g.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.heading.replace(/^\d+\.\s*/, "")}</a>
                </li>
              ))}
            </ol>
          </nav>

          {g.sections.map((s) => (
            <section key={s.id} id={s.id} className="article-part">
              <h2>{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              {s.list && (
                <ul>
                  {s.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
        <RelatedLinks
          links={[...g.related, { href: "/guides", label: "All guides" }]}
        />
      </main>
      <Waitlist />
    </>
  );
}
