import { RoughShape, roughBox } from "@/lib/rough";
import Reveal from "./Reveal";

const NOTES = [
  {
    q: "Which feature is TKT-4821 even for?",
    body: "Tickets float in a flat list with no parent. Nobody can tell what a ticket is part of, or what's left for a feature.",
    tilt: -2,
    color: "var(--note-yellow)",
  },
  {
    q: "Where's the spec?",
    body: "The PRD is in one tool, tasks in another, decisions in a chat thread. So developers stop and ask, again and again.",
    tilt: 1.5,
    color: "var(--note-blue)",
  },
  {
    q: "Is v2.3 on track?",
    body: "Release status lives in someone's head until the next standup. By then, the slip has already happened.",
    tilt: -1,
    color: "var(--note-pink)",
  },
];

export default function Problem() {
  return (
    <section className="section" id="problem">
      <Reveal>
        <p className="kicker">The problem</p>
        <h2 className="display h2">
          Four features. Forty tickets.
          <br />
          <span className="muted-serif">
            Zero idea where the release stands.
          </span>
        </h2>
      </Reveal>
      <div className="notes">
        {NOTES.map((n, i) => (
          <Reveal key={n.q} delay={i * 0.08} className="note-wrap">
            <div className="note" style={{ transform: `rotate(${n.tilt}deg)` }}>
              <svg
                className="note-bg"
                viewBox="0 0 320 260"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <RoughShape
                  shape={roughBox(160, 130, 312, 252, 40 + i * 9, {
                    fill: n.color,
                    stroke: "var(--ink)",
                    strokeWidth: 1.2,
                  })}
                />
              </svg>
              <p className="note-q hand">{n.q}</p>
              <p className="note-body">{n.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <p className="problem-punch">
          The tools aren&apos;t broken. They just store work as{" "}
          <span className="hl">rows of text</span>, and real work is a tree.
        </p>
      </Reveal>
    </section>
  );
}
