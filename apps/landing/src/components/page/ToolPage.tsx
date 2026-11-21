import type { ReactNode } from "react";
import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import type { ToolInfo } from "@/content/tools";
import { breadcrumbLd, faqLd, ldGraph } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { JsonLd, PageHero, RelatedLinks, SectionHead } from "./PageBits";

/** Layout for a free tool: the tool itself, how to use it (HowTo data), FAQ and related links. */
export default function ToolPage({
  tool,
  children,
}: {
  tool: ToolInfo;
  children: ReactNode;
}) {
  const path = `/tools/${tool.slug}`;
  const crumbs = [
    { name: "Free tools", path: "/tools" },
    { name: tool.name, path },
  ];
  const ld = ldGraph(
    {
      "@type": "WebApplication",
      name: `${tool.name} by Zelo`,
      url: `${SITE_URL}${path}`,
      description: tool.metaDescription,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (runs in the browser)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "HowTo",
      name: `How to use the ${tool.name.toLowerCase()}`,
      step: tool.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    breadcrumbLd(crumbs),
    faqLd(tool.faqs),
  );

  return (
    <>
      <JsonLd data={ld} />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow="free tool · runs in your browser"
          title={tool.title}
          accent={tool.accent}
          lede={tool.lede}
          actions={false}
        />
        <section className="section tool-section">{children}</section>
        <section className="section">
          <Reveal>
            <SectionHead kicker="How to use it" title={<>Four steps</>} />
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="switch flow-steps">
              {tool.steps.map((s, i) => (
                <li key={s.name} className="switch-step">
                  <span className="switch-n">0{i + 1}</span>
                  <h3>{s.name}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>
        <RelatedLinks
          links={[...tool.related, { href: "/tools", label: "All free tools" }]}
        />
        <Faq
          items={tool.faqs}
          title={
            <>
              {tool.name}, <em>answered</em>.
            </>
          }
        />
      </main>
      <Waitlist />
    </>
  );
}
