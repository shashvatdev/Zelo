import Link from "next/link";
import type { ReactNode } from "react";
import type { Crumb } from "@/lib/seo";

/** Structured data as a script tag; `<` is escaped so content can't break out of it. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      <Link href="/">Zelo</Link>
      {crumbs.map((c, i) => (
        <span key={c.path}>
          {" "}
          <span aria-hidden="true">/</span>{" "}
          {i === crumbs.length - 1 ? (
            <span aria-current="page">{c.name}</span>
          ) : (
            <Link href={c.path}>{c.name}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({
  crumbs,
  eyebrow,
  title,
  accent,
  lede,
  actions = true,
  children,
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  accent?: ReactNode;
  lede?: ReactNode;
  actions?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="vs-hero">
      <Breadcrumbs crumbs={crumbs} />
      {eyebrow && <p className="eyebrow hand">{eyebrow}</p>}
      <h1 className="display vs-title">
        {title}
        {accent && (
          <>
            <br />
            <em>{accent}</em>
          </>
        )}
      </h1>
      {lede && <p className="lede">{lede}</p>}
      {actions && (
        <div className="hero-ctas">
          <a href="#waitlist" className="btn btn-ink">
            Join the waitlist
          </a>
          <Link href="/#how" className="btn btn-ghost">
            See how it works
          </Link>
        </div>
      )}
      {children}
    </section>
  );
}

export function RelatedLinks({
  title = "Keep exploring",
  links,
}: {
  title?: string;
  links: { href: string; label: string }[];
}) {
  return (
    <section className="section more-compare" aria-label={title}>
      <p className="kicker">{title}</p>
      <div className="more-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="more-link">
            {l.label} <span aria-hidden="true">&rarr;</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SectionHead({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <p className="kicker">{kicker}</p>
      <h2 className="display h2">{title}</h2>
      {children && <p className="body-lg narrow">{children}</p>}
    </>
  );
}
