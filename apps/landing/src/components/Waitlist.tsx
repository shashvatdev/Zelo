"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Logo } from "./Nav";
import Reveal from "./Reveal";

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
        <nav className="footer-col" aria-label="Product">
          <p className="footer-h">Product</p>
          <Link href="/#how">How it works</Link>
          <Link href="/#ai">AI</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/#waitlist">Join the waitlist</Link>
        </nav>
        <nav className="footer-col" aria-label="Compare">
          <p className="footer-h">Compare</p>
          <Link href="/compare">Switching to Zelo</Link>
          <Link href="/vs/jira">Zelo vs Jira</Link>
          <Link href="/vs/clickup">Zelo vs ClickUp</Link>
        </nav>
        <p className="footer-c">© 2026 Zelo</p>
      </footer>
    </>
  );
}
