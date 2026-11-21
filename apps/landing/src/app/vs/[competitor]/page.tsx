import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import AskZelo from "@/components/vs/AskZelo";
import LinkMorph from "@/components/vs/LinkMorph";
import { COMPETITORS, getCompetitor } from "@/lib/competitors";
import { SITE, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/vs/[competitor]">,
): Promise<Metadata> {
  const { competitor } = await props.params;
  const c = getCompetitor(competitor);
  if (!c) return {};
  const path = `/vs/${c.slug}`;
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE.name,
      title: c.metaTitle,
      description: c.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: c.metaTitle,
      description: c.metaDescription,
    },
  };
}

export default async function VsPage(props: PageProps<"/vs/[competitor]">) {
  const { competitor } = await props.params;
  const c = getCompetitor(competitor);
  if (!c) notFound();

  const url = `${SITE_URL}/vs/${c.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: c.metaTitle,
        description: c.metaDescription,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        primaryImageOfPage: `${url}/opengraph-image`,
        about: [
          {
            "@type": "SoftwareApplication",
            name: SITE.name,
            url: SITE_URL,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
          },
          {
            "@type": "SoftwareApplication",
            name: c.name,
            url: c.site,
            sameAs: c.site,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
          },
        ],
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
          {
            "@type": "ListItem",
            position: 3,
            name: `Zelo vs ${c.name}`,
            item: url,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

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
            <Link href="/compare">Compare</Link>{" "}
            <span aria-hidden="true">/</span> <span>vs {c.name}</span>
          </nav>
          <p className="eyebrow hand">
            a {c.name} alternative that shows the whole picture
          </p>
          <h1 className="display vs-title">
            {c.headline[0]}
            <br />
            <em>{c.headline[1]}</em>
          </h1>
          <p className="lede">{c.lede}</p>
          <div className="hero-ctas">
            <a href="#waitlist" className="btn btn-ink">
              Join the waitlist
            </a>
            <a href="#ask" className="btn btn-ghost">
              Try Ask Zelo
            </a>
          </div>
          <div className="window vs-window">
            <div className="window-bar">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="crumbs">
                Same 8 tickets <b>/</b> <strong>two ways to see them</strong>
              </span>
            </div>
            <LinkMorph />
          </div>
        </section>

        <section className="section" id="ask">
          <Reveal>
            <p className="kicker">AI that answers in pictures</p>
            <h2 className="display h2">
              Ask in plain words.
              <br />
              <em>Get a map back.</em>
            </h2>
            <p className="body-lg narrow">
              How much work is in this release? How much is done? What has one
              person finished? Ask in plain words and Zelo draws the answer from
              the release graph in a second.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <AskZelo />
          </Reveal>
          <p className="fine">
            Demo runs on a sample release in your browser. In the product, the
            same answers come from your live data.
          </p>
        </section>

        <section className="section" id="compare">
          <Reveal>
            <p className="kicker">Side by side</p>
            <h2 className="display h2">
              {c.name} and Zelo, <em>honestly</em>.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="vs-table-wrap">
              <table className="vs-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Topic</span>
                    </th>
                    <th scope="col">{c.name}</th>
                    <th scope="col" className="us">
                      Zelo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r.topic}>
                      <th scope="row">{r.topic}</th>
                      <td>{r.them}</td>
                      <td className="us">{r.zelo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        <section className="section" id="switch">
          <Reveal>
            <p className="kicker">Switching</p>
            <h2 className="display h2">
              From {c.name} to a map in <em>three steps</em>.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="switch">
              {c.switchSteps.map((s, i) => (
                <li key={s.title} className="switch-step">
                  <span className="switch-n">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
          <p className="fine">Importers are planned for the beta.</p>
        </section>

        <section
          className="section more-compare"
          aria-labelledby="more-compare"
        >
          <p className="kicker" id="more-compare">
            More comparisons
          </p>
          <div className="more-links">
            {COMPETITORS.filter((o) => o.slug !== c.slug).map((o) => (
              <Link key={o.slug} href={`/vs/${o.slug}`} className="more-link">
                Zelo vs {o.name} <span aria-hidden="true">&rarr;</span>
              </Link>
            ))}
            <Link href="/compare" className="more-link">
              All comparisons <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>

        <Faq
          items={c.faqs}
          title={
            <>
              Zelo vs {c.name}, <em>answered</em>.
            </>
          }
        />
        <p className="tm">
          Jira and ClickUp are trademarks of their respective owners. Zelo is
          not affiliated with or endorsed by them.
        </p>
      </main>
      <Waitlist />
    </>
  );
}
