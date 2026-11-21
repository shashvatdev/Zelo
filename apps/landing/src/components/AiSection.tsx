"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import Reveal from "./Reveal";

const QUESTION = "What's blocking v2.3?";
const ANSWER =
  "5 of 10 tickets are done. Refunds is waiting on the Webhook ticket, which needs the API endpoint (done) and a retry rule (added to the spec today). Dark mode has one ticket nobody owns: Audit screens.";

const CAPS = [
  {
    t: "Doc → tickets",
    d: "Drop a PRD on a feature. Zelo drafts the tickets and acceptance criteria. You approve.",
  },
  {
    t: "Ask the map",
    d: "Developers ask how something should work, and get the answer from that feature's spec.",
  },
  {
    t: "Release notes",
    d: "When a release turns green, the changelog and customer notes are already written.",
  },
];

export default function AiSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(0);
  const shown = reduce ? ANSWER.length : typed;

  useEffect(() => {
    if (!inView || reduce) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 2;
      setTyped(Math.min(i, ANSWER.length));
      // Soft keyboard ticks while the answer types out, when sound is on.
      if (sound?.enabled && i % 6 === 0) {
        sound.play([
          { t: 0, kind: "tick", pitch: 1.3 + Math.random() * 0.3, vol: 0.05 },
        ]);
      }
      if (i < ANSWER.length) timer = setTimeout(tick, 18);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [inView, reduce]);

  return (
    <section className="section ai" id="ai">
      <div className="ai-grid">
        <Reveal>
          <p className="kicker">AI that reads the map</p>
          <h2 className="display h2">
            It knows which ticket
            <br />
            belongs to <em>what</em>.
          </h2>
          <p className="body-lg narrow">
            Other tools give AI a pile of rows. Zelo gives it the whole graph:
            every ticket&apos;s feature, every feature&apos;s release, every
            spec. So its answers are about your product, not guesses.
          </p>
        </Reveal>

        <div className="chat" ref={ref}>
          <div className="msg msg-q">
            <span className="avatar" style={{ background: "var(--coral)" }}>
              B
            </span>
            <p>{QUESTION}</p>
          </div>
          <div className="msg msg-a" aria-live="polite">
            <span className="avatar avatar-ai" aria-hidden="true">
              <svg width="14" height="14" viewBox="-10 -10 20 20">
                <path
                  d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <p>
              {ANSWER.slice(0, shown)}
              {shown < ANSWER.length && <span className="caret" />}
            </p>
          </div>
          {shown >= ANSWER.length && (
            <div className="msg-actions">
              <span className="chip">Assign Audit screens</span>
              <span className="chip">Open Refunds</span>
            </div>
          )}
        </div>
      </div>

      <div className="caps">
        {CAPS.map((c, i) => (
          <Reveal key={c.t} delay={i * 0.08} className="cap">
            <h3>{c.t}</h3>
            <p>{c.d}</p>
          </Reveal>
        ))}
      </div>
      <p className="fine">
        AI suggests, people approve. Your data is never used to train models.
      </p>
    </section>
  );
}
