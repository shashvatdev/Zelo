import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import CopyTemplate from "@/components/page/CopyTemplate";
import {
  JsonLd,
  PageHero,
  RelatedLinks,
  SectionHead,
} from "@/components/page/PageBits";
import { getTemplate, templateMarkdown, TEMPLATES } from "@/content/templates";
import {
  breadcrumbLd,
  faqLd,
  ldGraph,
  pageMetadata,
  PUBLISHED,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  props: PageProps<"/templates/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const t = getTemplate(slug);
  if (!t) return {};
  return pageMetadata({
    path: `/templates/${t.slug}`,
    title: t.metaTitle,
    description: t.metaDescription,
    ownImage: true,
  });
}

export default async function TemplatePage(
  props: PageProps<"/templates/[slug]">,
) {
  const { slug } = await props.params;
  const t = getTemplate(slug);
  if (!t) notFound();
  const path = `/templates/${t.slug}`;
  const crumbs = [
    { name: "Templates", path: "/templates" },
    { name: t.name, path },
  ];
  const ld = ldGraph(
    {
      "@type": "CreativeWork",
      "@id": `${SITE_URL}${path}#template`,
      name: t.name,
      description: t.metaDescription,
      url: `${SITE_URL}${path}`,
      isAccessibleForFree: true,
      learningResourceType: "Template",
      encodingFormat: "text/markdown",
      datePublished: PUBLISHED,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    breadcrumbLd(crumbs),
    faqLd(t.faqs),
  );

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow="free template"
          title={t.name.replace(/ template$/i, "")}
          accent="template, free."
          lede={t.summary}
          actions={false}
        >
          <CopyTemplate
            markdown={templateMarkdown(t)}
            filename={`${t.slug}-template.md`}
          />
        </PageHero>

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="When to use it"
              title={<>Use this template when</>}
            />
            <ul className="ticks article-ticks">
              {t.whenToUse.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="The template"
              title={<>Section by section</>}
            />
          </Reveal>
          <div className="tpl-doc">
            {t.sections.map((s, i) => (
              <div key={s.heading} className="tpl-section">
                <h3>
                  <span className="tpl-n">{i + 1}</span> {s.heading}
                </h3>
                <p className="tpl-guide">{s.guidance}</p>
                <pre className="tpl-example">{s.example}</pre>
              </div>
            ))}
          </div>
          <div className="tpl-zelo">
            <p>
              <strong>In Zelo,</strong> this template lives on the node it
              describes, so the plan, the spec and the tickets stay connected as
              the work moves.
            </p>
          </div>
        </section>

        <RelatedLinks
          links={[...t.related, { href: "/templates", label: "All templates" }]}
        />
        <Faq
          items={t.faqs}
          title={
            <>
              {t.name}, <em>answered</em>.
            </>
          }
        />
      </main>
      <Waitlist />
    </>
  );
}
