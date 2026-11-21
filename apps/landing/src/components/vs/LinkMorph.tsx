"use client";

import { useInView } from "motion/react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { RoughShape, roughBox, roughCurve, roughLine } from "@/lib/rough";

/**
 * Left: a flat list of tickets, the way list tools show them.
 * Right: the same tickets' features and release in Zelo.
 * One by one, each ticket draws a line to the feature it belongs to, and pulses keep flowing.
 */

const FEATURES = [
  { name: "Refunds", color: "var(--coral)" },
  { name: "OTP login", color: "var(--blue)" },
  { name: "Export CSV", color: "var(--green)" },
  { name: "Dark mode", color: "var(--amber)" },
];

const ROWS = [
  { id: "TKT-4821", title: "Fix refund webhook retries", f: 0 },
  { id: "TKT-4822", title: "OTP screen copy changes", f: 1 },
  { id: "TKT-4790", title: "Theme toggle follow-up", f: 3 },
  { id: "TKT-4835", title: "CSV download button", f: 2 },
  { id: "TKT-4802", title: "Refund UI empty state", f: 0 },
  { id: "TKT-4841", title: "Audit all screens", f: 3 },
  { id: "TKT-4811", title: "Switch SMS provider", f: 1 },
  { id: "TKT-4799", title: "Refund API endpoint", f: 0 },
];

const ROW_X = 40;
const ROW_W = 420;
const ROW_H = 40;
const ROW_Y0 = 92;
const ROW_STEP = 50;
const F_CX = 900;
const F_W = 176;
const F_H = 58;
const F_YS = [128, 228, 328, 428];
const R_CX = 1112;
const R_Y = 278;
const LINK_START = 1.25;
const LINK_STEP = 0.32;

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

function buildShapes() {
  let seed = 500;
  const next = () => (seed += 9);
  return {
    rows: ROWS.map((_, i) =>
      roughBox(ROW_X + ROW_W / 2, ROW_Y0 + i * ROW_STEP, ROW_W, ROW_H, next(), {
        stroke: "var(--line-strong)",
        strokeWidth: 1.3,
        roughness: 0.5,
      }),
    ),
    features: FEATURES.map((f, i) =>
      roughBox(F_CX, F_YS[i], F_W, F_H, next(), {
        stroke: f.color,
        strokeWidth: 2,
      }),
    ),
    release: roughBox(R_CX, R_Y, 136, 64, next(), {
      fill: "var(--ink)",
      stroke: "var(--ink)",
    }),
    fEdges: F_YS.map((y) =>
      roughLine(
        [
          [F_CX + F_W / 2, y],
          [1010, y],
          [1010, R_Y],
          [R_CX - 68, R_Y],
        ],
        next(),
      ),
    ),
    links: ROWS.map((r, i) => {
      const y0 = ROW_Y0 + i * ROW_STEP;
      const y1 = F_YS[r.f] + (i % 3) * 8 - 8;
      const dpath = `M${ROW_X + ROW_W} ${y0} C ${ROW_X + ROW_W + 190} ${y0}, ${F_CX - F_W / 2 - 190} ${y1}, ${F_CX - F_W / 2} ${y1}`;
      return {
        d: dpath,
        shape: roughCurve(dpath, next(), {
          stroke: FEATURES[r.f].color,
          strokeWidth: 1.8,
          roughness: 0.6,
        }),
      };
    }),
  };
}

function Scene() {
  const shapes = useMemo(() => buildShapes(), []);

  const counts = FEATURES.map((_, fi) => ROWS.filter((r) => r.f === fi).length);

  return (
    <svg
      className="morph"
      viewBox="0 0 1200 500"
      role="img"
      aria-label="Eight loose tickets from a list each draw a line to the feature they belong to, and the features connect to one release."
    >
      <text x={ROW_X} y={44} className="mo-head">
        In a list
      </text>
      <text x={F_CX - F_W / 2} y={44} className="mo-head mo-head-z">
        In Zelo
      </text>

      {ROWS.map((r, i) => {
        const y = ROW_Y0 + i * ROW_STEP;
        return (
          <g key={r.id} className="list-row" style={d(0.1 + i * 0.06)}>
            <RoughShape shape={shapes.rows[i]} />
            <rect
              x={ROW_X + 1}
              y={y - ROW_H / 2 + 6}
              width={5}
              height={ROW_H - 12}
              rx={2.5}
              fill={FEATURES[r.f].color}
              className="mo-tag"
              style={d(LINK_START + i * LINK_STEP)}
            />
            <text x={ROW_X + 18} y={y + 5} className="t-mono">
              {r.id}
            </text>
            <text x={ROW_X + 108} y={y + 5} className="t-row">
              {r.title}
            </text>
          </g>
        );
      })}

      {shapes.fEdges.map((e, i) => (
        <g key={`fe${i}`} className="draw" style={d(0.95)}>
          <RoughShape shape={e} draw />
        </g>
      ))}
      <g className="pop" style={d(0.85)}>
        <RoughShape shape={shapes.release} />
        <text
          x={R_CX}
          y={R_Y - 2}
          textAnchor="middle"
          className="t-release"
          style={{ fontSize: 17 }}
        >
          v2.3
        </text>
        <text
          x={R_CX}
          y={R_Y + 18}
          textAnchor="middle"
          className="t-release-sub"
        >
          release
        </text>
      </g>
      {FEATURES.map((f, i) => (
        <g key={f.name} className="pop" style={d(0.6 + i * 0.07)}>
          <RoughShape shape={shapes.features[i]} />
          <text x={F_CX - F_W / 2 + 16} y={F_YS[i] - 2} className="t-feature">
            {f.name}
          </text>
          <text x={F_CX - F_W / 2 + 16} y={F_YS[i] + 17} className="t-count">
            {counts[i]} {counts[i] === 1 ? "ticket" : "tickets"}
          </text>
        </g>
      ))}

      {shapes.links.map((l, i) => (
        <g key={`l${i}`}>
          <g className="draw draw-slow" style={d(LINK_START + i * LINK_STEP)}>
            <RoughShape shape={l.shape} draw />
          </g>
          {/* Hidden until its motion starts, so it never flashes at the SVG origin. */}
          <circle
            r="5"
            opacity="0"
            className="mo-pulse"
            style={{ fill: FEATURES[ROWS[i].f].color }}
          >
            <set
              attributeName="opacity"
              to="1"
              begin={`${LINK_START + i * LINK_STEP + 0.45}s`}
            />
            <animateMotion
              path={l.d}
              dur="1.6s"
              begin={`${LINK_START + i * LINK_STEP + 0.45}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
    </svg>
  );
}

export default function LinkMorph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [run, setRun] = useState(0);

  return (
    <div className="morph-wrap" ref={ref}>
      <div className="morph-canvas">{inView && <Scene key={run} />}</div>
      <div className="morph-foot">
        <p>
          8 loose tickets, 4 features, 1 release. Now everyone can see where
          each piece of work belongs.
        </p>
        <button
          type="button"
          className="replay"
          onClick={() => setRun((r) => r + 1)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Replay
        </button>
      </div>
    </div>
  );
}
