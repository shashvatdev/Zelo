import Nav from "@/components/Nav";
import Waitlist from "@/components/Waitlist";
import { breadcrumbLd, ldGraph, webPageLd } from "@/lib/seo";
import { Breadcrumbs, JsonLd } from "./PageBits";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
};

/**
 * Privacy policy and terms layout. Text in [square brackets] is a placeholder that must be
 * replaced with the real company details, and the documents reviewed by a lawyer, before launch.
 */
export default function LegalPage({
  path,
  name,
  title,
  description,
  updated,
  intro,
  sections,
}: {
  path: string;
  name: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const crumbs = [{ name, path }];
  return (
    <>
      <JsonLd
        data={ldGraph(
          webPageLd(path, title, description),
          breadcrumbLd(crumbs),
        )}
      />
      <Nav />
      <main>
        <article className="article legal">
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="display article-title">{name}</h1>
          <p className="article-meta">
            Last updated{" "}
            <time dateTime={updated}>
              {new Date(`${updated}T00:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </p>
          <p className="definition">{intro}</p>
          {sections.map((s, i) => (
            <section key={s.heading} className="article-part">
              <h2>
                {i + 1}. {s.heading}
              </h2>
              {s.paragraphs?.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
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
      </main>
      <Waitlist />
    </>
  );
}
