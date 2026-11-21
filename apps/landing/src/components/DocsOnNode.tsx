import Reveal from "./Reveal";

export default function DocsOnNode() {
  return (
    <section className="section split" id="docs">
      <Reveal className="split-copy">
        <p className="kicker">Docs live on the work</p>
        <h2 className="display h2">
          The spec sits <em>inside</em> the feature.
        </h2>
        <p className="body-lg">
          Business writes the PRD on the feature node. Designs, API notes and
          decisions sit right beside it. Developers open the node and everything
          they need is already there.
        </p>
        <ul className="ticks">
          <li>One click from ticket to the spec it came from</li>
          <li>Comments and decisions stay on the node, not in chat</li>
          <li>Every change is in the activity log</li>
        </ul>
      </Reveal>

      <Reveal className="panel" delay={0.1}>
        <div className="panel-head">
          <span className="chip chip-mod">Payments</span>
          <span className="chip">Release v2.3</span>
          <span className="panel-x" aria-hidden="true">
            ×
          </span>
        </div>
        <h3 className="panel-title">Refunds</h3>
        <div className="panel-progress">
          <span style={{ width: "33%" }} />
        </div>
        <p className="panel-meta">
          1 of 3 tickets done · Bhumika Saxena owns this feature
        </p>

        <div className="panel-tabs" aria-hidden="true">
          <span className="on">Spec</span>
          <span>Tickets 3</span>
          <span>Activity</span>
        </div>

        <div className="doc">
          <p className="doc-h">Goal</p>
          <p>
            Let customers request a refund from the order page, without
            contacting support.
          </p>
          <p className="doc-h">Acceptance</p>
          <ul>
            <li>Refund button on orders younger than 30 days</li>
            <li>Partial refunds for multi-item orders</li>
            <li>Webhook updates the order status</li>
          </ul>
          <div className="doc-embed">
            <span className="fig" aria-hidden="true" />
            Refund flow · Figma
          </div>
        </div>

        <div className="comment">
          <span className="avatar" style={{ background: "var(--blue)" }}>
            S
          </span>
          <div>
            <p className="comment-who">
              Shashvat Singh <span>on Webhook</span>
            </p>
            <p>
              Retry on 5xx, or fail fast? The spec says &ldquo;updates
              status&rdquo;.
            </p>
          </div>
        </div>
        <div className="comment">
          <span className="avatar" style={{ background: "var(--coral)" }}>
            B
          </span>
          <div>
            <p className="comment-who">Bhumika Saxena</p>
            <p>Retry 3 times, then flag it. Added to the spec.</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
