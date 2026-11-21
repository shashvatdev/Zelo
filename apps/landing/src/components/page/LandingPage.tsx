import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import type { Landing } from "@/content/landings";
import { breadcrumbLd, faqLd, ldGraph, webPageLd, type Crumb } from "@/lib/seo";
import FlowShowcase from "./FlowShowcase";
import { JsonLd, PageHero, RelatedLinks, SectionHead } from "./PageBits";

/** Shared layout for solution pages and team pages. */
export default function LandingPage({
  page,
  path,
  crumbs,
}: {
  page: Landing;
  path: string;
  crumbs: Crumb[];
}) {
  return (
    <>
      <JsonLd
        data={ldGraph(
          webPageLd(path, page.metaTitle, page.metaDescription),
          breadcrumbLd(crumbs),
          faqLd(page.faqs),
        )}
      />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow={page.eyebrow}
          title={page.title}
          accent={page.accent}
          lede={page.lede}
        >
          <FlowShowcase
            tree={page.visual.tree}
            caption={page.visual.caption}
            label={page.visual.label}
          />
        </PageHero>

        <section className="section">
          <Reveal>
            <SectionHead
              kicker="The problem"
              title={<>Why it&apos;s hard today</>}
            />
          </Reveal>
          <div className="steps">
            {page.problems.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08} className="step">
                <p className="step-n">0{i + 1}</p>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section">
          <Reveal>
            <SectionHead
              kicker="How Zelo does it"
              title={
                <>
                  Built for this, <em>not bolted on</em>.
                </>
              }
            />
          </Reveal>
          <div className="feature-grid">
            {page.features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06} className="feature-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section">
          <Reveal>
            <SectionHead kicker="In practice" title={<>How a team uses it</>} />
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="switch flow-steps">
              {page.steps.map((s, i) => (
                <li key={s.title} className="switch-step">
                  <span className="switch-n">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <RelatedLinks links={page.related} />

        <Faq
          items={page.faqs}
          title={
            <>
              {page.label}, <em>answered</em>.
            </>
          }
        />
      </main>
      <Waitlist />
    </>
  );
}
