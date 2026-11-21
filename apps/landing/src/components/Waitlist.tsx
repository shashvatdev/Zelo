"use client";

import Link from "next/link";
import { ALTERNATIVES } from "@/content/alternatives";
import { SOLUTIONS, TEAMS } from "@/content/landings";
import { COMPETITORS } from "@/lib/competitors";
import { useState, type FormEvent } from "react";
import { Logo } from "./Nav";
import Reveal from "./Reveal";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: (string[] | [string, string])[];
}) {
  return (
    <nav className="footer-col" aria-label={title}>
      <p className="footer-h">{title}</p>
      {links.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default function Waitlist() {
  const [done, setDone] = useState(false);

  // TODO: send the email to a real waitlist backend (none is connected yet).
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDone(true);
  };

  return (
    <>
      <section className="cta" id="waitlist">
        <Reveal>
          <h2 className="display cta-h">
            Stop managing lists.
            <br />
            <em>Start seeing your product.</em>
          </h2>
          {done ? (
            <p className="cta-done hand">
              You&apos;re on the list. We&apos;ll be in touch.
            </p>
          ) : (
            <form className="cta-form" onSubmit={onSubmit}>
              <label htmlFor="email" className="sr-only">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
              <button type="submit" className="btn btn-paper">
                Join the waitlist
              </button>
            </form>
          )}
          <p className="cta-fine">
            Early access for software teams. Free while in beta.
          </p>
        </Reveal>
      </section>
      <footer className="footer">
        <div className="footer-brand">
          <Logo />
          <p>Work isn&apos;t a list. It&apos;s a map.</p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/#how", "How it works"],
            ["/#ai", "AI"],
            ["/pricing", "Pricing"],
            ["/changelog", "Changelog"],
            ["/#waitlist", "Join the waitlist"],
          ]}
        />
        <FooterCol
          title="Solutions"
          links={SOLUTIONS.map((x) => [`/solutions/${x.slug}`, x.label])}
        />
        <FooterCol
          title="Teams"
          links={TEAMS.map((x) => [`/for/${x.slug}`, x.label])}
        />
        <FooterCol
          title="Compare"
          links={[
            ["/compare", "Switching to Zelo"],
            ...COMPETITORS.map(
              (c) => [`/vs/${c.slug}`, `Zelo vs ${c.name}`] as [string, string],
            ),
            ...ALTERNATIVES.map(
              (a) =>
                [`/alternatives/${a.slug}`, `${a.tool} alternatives`] as [
                  string,
                  string,
                ],
            ),
          ]}
        />
        <FooterCol
          title="Resources"
          links={[
            ["/templates", "Templates"],
            ["/guides", "Guides"],
            ["/glossary", "Glossary"],
            ["/tools", "Free tools"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["/about", "About"],
            ["/security", "Security"],
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
          ]}
        />
        <p className="footer-c">© 2026 Zelo</p>
      </footer>
    </>
  );
}
