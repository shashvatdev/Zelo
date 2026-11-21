import Reveal from "./Reveal";

const ROWS = [
  "See which ticket belongs to which feature and release",
  "The spec sits next to the tickets it created",
  "Release status without a meeting",
  "Your product's full history, by module",
  "AI that sees how all the work connects",
];

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-label="Yes" role="img">
      <path
        d="M4 12.5 L9.5 18 L20 6"
        fill="none"
        stroke="var(--green)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-label="No" role="img">
      <path
        d="M6 6 L18 18 M18 6 L6 18"
        fill="none"
        stroke="var(--muted-2)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Compare() {
  return (
    <section className="section" id="compare">
      <Reveal>
        <p className="kicker">Lists vs. a map</p>
        <h2 className="display h2">
          Same work. <em>Finally visible.</em>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Capability</span>
              </th>
              <th scope="col">List &amp; board tools</th>
              <th scope="col" className="us">
                Zelo
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r}>
                <th scope="row">{r}</th>
                <td>
                  <Mark yes={false} />
                </td>
                <td className="us">
                  <Mark yes />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </section>
  );
}
