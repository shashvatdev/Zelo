"use client";

import { useMemo, useState } from "react";

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Forecast when a release will be done from recent sprint velocity. */
export default function VelocityTool() {
  const [history, setHistory] = useState("21, 18, 24, 20");
  const [remaining, setRemaining] = useState("62");
  const [weeks, setWeeks] = useState("2");
  const [start, setStart] = useState("");

  const r = useMemo(() => {
    const past = history
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    const left = Math.max(0, Number(remaining) || 0);
    const len = Math.max(1, Number(weeks) || 2);
    if (!past.length) return null;
    const avg = past.reduce((a, b) => a + b, 0) / past.length;
    const lo = Math.min(...past);
    const hi = Math.max(...past);
    const sprints = {
      likely: Math.ceil(left / avg),
      best: Math.ceil(left / hi),
      worst: Math.ceil(left / lo),
    };
    let dates: { likely: string; best: string; worst: string } | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      const base = new Date(`${start}T00:00:00`);
      const at = (n: number) =>
        fmt(new Date(base.getTime() + n * len * 7 * 864e5));
      dates = {
        likely: at(sprints.likely),
        best: at(sprints.best),
        worst: at(sprints.worst),
      };
    }
    return {
      past,
      avg,
      lo,
      hi,
      left,
      len,
      sprints,
      dates,
      max: Math.max(hi, avg),
    };
  }, [history, remaining, weeks, start]);

  return (
    <div className="tool">
      <div className="tool-in">
        <label className="field">
          <span>Points completed in recent sprints (comma separated)</span>
          <input
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <div className="tool-row">
          <label className="field">
            <span>Points left in the release</span>
            <input
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span>Sprint length (weeks)</span>
            <input
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>
        <label className="field">
          <span>Next sprint starts (optional, for dates)</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
      </div>

      <div className="tool-out" aria-live="polite">
        {!r ? (
          <p className="tool-empty">
            Enter at least one sprint&apos;s completed points.
          </p>
        ) : (
          <>
            <div className="vel-stats">
              <div>
                <span>Average velocity</span>
                <strong>{r.avg.toFixed(1)}</strong>
                <em>points / sprint</em>
              </div>
              <div className="vel-main">
                <span>Likely finish</span>
                <strong>{r.sprints.likely}</strong>
                <em>
                  sprints
                  {r.dates
                    ? ` · ${r.dates.likely}`
                    : ` · ${r.sprints.likely * r.len} weeks`}
                </em>
              </div>
              <div>
                <span>Range</span>
                <strong>
                  {r.sprints.best}–{r.sprints.worst}
                </strong>
                <em>
                  {r.dates
                    ? `${r.dates.best} to ${r.dates.worst}`
                    : "sprints, best to worst"}
                </em>
              </div>
            </div>
            <div
              className="vel-chart"
              aria-label="Completed points per recent sprint, with the average"
            >
              {r.past.map((p, i) => (
                <div key={i} className="vel-bar-wrap">
                  <div
                    className="vel-bar"
                    style={{ height: `${(p / r.max) * 100}%` }}
                  >
                    <span>{p}</span>
                  </div>
                  <small>S{i + 1}</small>
                </div>
              ))}
              <div
                className="vel-avg"
                style={{ bottom: `${(r.avg / r.max) * 100}%` }}
              >
                <span>avg {r.avg.toFixed(1)}</span>
              </div>
            </div>
            <p className="tool-note">
              {r.left} points ÷ {r.avg.toFixed(1)} average = {r.sprints.likely}{" "}
              sprints. Best case uses your fastest sprint ({r.hi}), worst case
              your slowest ({r.lo}).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
