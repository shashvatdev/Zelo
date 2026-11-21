import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import {
  JsonLd,
  PageHero,
  RelatedLinks,
  SectionHead,
} from "@/components/page/PageBits";
import { breadcrumbLd, FOUNDER, ldGraph, pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const title = "About Zelo: why we're turning work into a map";
const description =
  "Zelo started with a simple frustration: tickets nobody could trace to a feature or release. Meet the founder and the principles behind Zelo.";

export const metadata = pageMetadata({ path: "/about", title, description });

const PRINCIPLES = [
  {
    title: "Work is a map",
    body: "Software work has structure: products, modules, releases, features, tickets. Tools should show that structure, not flatten it into rows.",
  },
  {
    title: "Context lives with the work",
    body: "The spec, the decision and the design belong on the thing they describe, one tap from the ticket.",
  },
  {
    title: "AI that suggests, people who decide",
    body: "AI should read the whole picture and do the busywork, but every change it proposes is approved by a person.",
  },
  {
    title: "Honest by default",
    body: "Clear about what is built and what is planned, fair to the tools we compare ourselves with, and careful with customer data.",
  },
];

export default function AboutPage() {
  const crumbs = [{ name: "About", path: "/about" }];
  const ld = ldGraph(
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about`,
      url: `${SITE_URL}/about`,
      name: title,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Zelo",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      founder: { "@type": "Person", name: FOUNDER.name, jobTitle: "Founder" },
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
          eyebrow="about zelo"
          title="We got tired of tickets"
          accent="nobody could place."
          lede="Zelo started inside a real release. Four features were going out, tickets were being created everywhere, and nobody could say which ticket belonged to which feature, or how close the release was. So we started building the tool we wanted."
          actions={false}
        />

        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="The story"
              title={<>From a messy release to a map</>}
            />
          </Reveal>
          <div className="prose">
            <p>
              Most teams run releases in list and board tools. Developers create
              tickets, move them to testing, then to done. But the tool never
              shows how those tickets connect to the features they build, the
              release they ship in, or the spec behind them. That picture lives
              in people&apos;s heads and in status meetings.
            </p>
            <p>
              Zelo turns that picture into the product itself: a living canvas
              where the product, its modules, releases, features and tickets are
              connected nodes, with docs on the work and AI that can read the
              whole map. We are building it for product managers, developers, QA
              and the business team, so they can all look at the same thing.
            </p>
          </div>
        </section>

        <section className="section">
          <Reveal>
            <SectionHead
              kicker="What we believe"
              title={<>Four principles</>}
            />
          </Reveal>
          <div className="feature-grid">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06} className="feature-card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section">
          <Reveal>
            <SectionHead kicker="Team" title={<>Who&apos;s building it</>} />
          </Reveal>
          <Reveal delay={0.08} className="founder">
            <span className="founder-avatar" aria-hidden="true">
              S
            </span>
            <div>
              <h3 className="display">{FOUNDER.name}</h3>
              <p className="founder-role">Founder</p>
              <p>
                Shashvat works on software releases and kept running into the
                same problem on every one: work that couldn&apos;t be seen as a
                whole. Zelo is Shashvat&apos;s answer to that problem.
              </p>
            </div>
          </Reveal>
        </section>

        <RelatedLinks
          links={[
            { href: "/#how", label: "How Zelo works" },
            { href: "/pricing", label: "Pricing" },
            { href: "/security", label: "Security" },
            { href: "/changelog", label: "Changelog" },
          ]}
        />
      </main>
      <Waitlist />
    </>
  );
}
