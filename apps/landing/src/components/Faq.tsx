import { FAQS } from "@/lib/site";
import Reveal from "./Reveal";

/**
 * Plain, literal answers that search engines and AI assistants can quote directly.
 * <details> keeps every answer in the HTML even while it is collapsed.
 */
export default function Faq() {
  return (
    <section className="section" id="faq">
      <Reveal>
        <p className="kicker">Questions</p>
        <h2 className="display h2">
          Before you <em>switch</em>.
        </h2>
      </Reveal>
      <div className="faq">
        {FAQS.map((f, i) => (
          <details key={f.q} className="faq-item" open={i === 0}>
            <summary>
              <h3>{f.q}</h3>
              <span className="faq-mark" aria-hidden="true" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
