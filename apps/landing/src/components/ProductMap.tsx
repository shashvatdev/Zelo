import Reveal from "./Reveal";

const RELEASES = [
  { v: "v1.0", when: "Jan" },
  { v: "v1.4", when: "Apr" },
  { v: "v2.0", when: "Jul" },
  { v: "v2.3", when: "Now" },
];

const MODULES: { name: string; cells: (string | null)[] }[] = [
  { name: "Payments", cells: ["Cards", "UPI", "Invoices", "Refunds"] },
  { name: "Auth", cells: ["Email login", null, "Google SSO", "OTP login"] },
  { name: "Dashboard", cells: ["Overview", "Filters", null, "Export CSV"] },
  { name: "App UI", cells: [null, "Onboarding", "Mobile web", "Dark mode"] },
];

export default function ProductMap() {
  return (
    <section className="section" id="map">
      <Reveal>
        <p className="kicker">Day zero to today</p>
        <h2 className="display h2">
          Every release you&apos;ve ever shipped,
          <br />
          <span className="muted-serif">by module.</span>
        </h2>
        <p className="body-lg narrow">
          Zoom out and the canvas becomes your product&apos;s history. New
          teammate? Hand them the map instead of a hundred tickets.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="pmap-scroll">
          <div
            className="pmap"
            role="table"
            aria-label="Features shipped per module and release"
          >
            <div className="pmap-row pmap-headrow" role="row">
              <span role="columnheader" className="pmap-corner">
                Module
              </span>
              {RELEASES.map((r, i) => (
                <span
                  key={r.v}
                  role="columnheader"
                  className={
                    i === RELEASES.length - 1 ? "pmap-rel now" : "pmap-rel"
                  }
                >
                  <b>{r.v}</b> {r.when}
                </span>
              ))}
            </div>
            {MODULES.map((m) => (
              <div key={m.name} className="pmap-row" role="row">
                <span role="rowheader" className="pmap-mod">
                  {m.name}
                </span>
                {m.cells.map((c, i) => (
                  <span
                    key={i}
                    role="cell"
                    className={
                      i === RELEASES.length - 1 ? "pmap-cell now" : "pmap-cell"
                    }
                  >
                    {c && (
                      <span
                        className={
                          i === RELEASES.length - 1 ? "fchip live" : "fchip"
                        }
                      >
                        {c}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
