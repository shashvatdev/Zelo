import { RoughShape, roughBox, roughLine } from "@/lib/rough";
import Reveal from "./Reveal";

function Node({
  x,
  y,
  w,
  label,
  seed,
  fill,
  stroke,
  ink,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  seed: number;
  fill?: string;
  stroke?: string;
  ink?: string;
}) {
  return (
    <g>
      <RoughShape
        shape={roughBox(x, y, w, 34, seed, {
          fill: fill ?? "var(--card)",
          stroke: stroke ?? "var(--ink)",
          strokeWidth: 1.3,
        })}
      />
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        className="t-mini"
        fill={ink ?? "var(--ink)"}
      >
        {label}
      </text>
    </g>
  );
}

function Line({
  pts,
  seed,
  dashed,
  color,
}: {
  pts: [number, number][];
  seed: number;
  dashed?: boolean;
  color?: string;
}) {
  return (
    <RoughShape
      shape={roughLine(pts, seed, { stroke: color ?? "var(--muted-2)" })}
      dashed={dashed}
    />
  );
}

function MapArt() {
  return (
    <svg viewBox="0 0 300 190" aria-hidden="true">
      <Line
        pts={[
          [150, 58],
          [62, 132],
        ]}
        seed={1}
      />
      <Line
        pts={[
          [150, 58],
          [150, 132],
        ]}
        seed={2}
      />
      <Line
        pts={[
          [150, 58],
          [238, 132],
        ]}
        seed={3}
      />
      <Node
        x={150}
        y={44}
        w={110}
        label="Acme app"
        seed={4}
        fill="var(--ink)"
        ink="var(--paper)"
      />
      <Node x={62} y={146} w={96} label="Payments" seed={5} />
      <Node x={150} y={146} w={70} label="Auth" seed={6} />
      <Node x={238} y={146} w={96} label="Dashboard" seed={7} />
    </svg>
  );
}

function PlanArt() {
  return (
    <svg viewBox="0 0 300 190" aria-hidden="true">
      <Line
        pts={[
          [78, 58],
          [78, 88],
          [200, 88],
          [200, 108],
        ]}
        seed={11}
      />
      <Line
        pts={[
          [78, 58],
          [78, 108],
        ]}
        seed={12}
      />
      <Node
        x={78}
        y={40}
        w={108}
        label="Release v2.4"
        seed={13}
        fill="var(--ink)"
        ink="var(--paper)"
      />
      <Node x={78} y={126} w={100} label="Refunds" seed={14} />
      <Node x={200} y={126} w={110} label="Saved cards" seed={15} />
      <Line
        pts={[
          [38, 143],
          [38, 170],
          [52, 170],
        ]}
        seed={16}
      />
      <g>
        <RoughShape
          shape={roughBox(110, 170, 112, 28, 17, {
            fill: "var(--paper)",
            stroke: "var(--coral)",
            strokeWidth: 1.3,
          })}
          dashed
        />
        <text
          x={110}
          y={175}
          textAnchor="middle"
          className="t-mini"
          fill="var(--coral)"
        >
          + New ticket
        </text>
      </g>
    </svg>
  );
}

function ShipArt() {
  const green = { fill: "var(--green-soft)", stroke: "var(--green)" };
  return (
    <svg viewBox="0 0 300 190" aria-hidden="true">
      <Line
        pts={[
          [150, 56],
          [150, 76],
          [60, 76],
          [60, 96],
        ]}
        seed={21}
        color="var(--green)"
      />
      <Line
        pts={[
          [150, 56],
          [150, 96],
        ]}
        seed={22}
        color="var(--green)"
      />
      <Line
        pts={[
          [150, 56],
          [150, 76],
          [240, 76],
          [240, 96],
        ]}
        seed={23}
        color="var(--green)"
      />
      <Node x={150} y={40} w={108} label="Release v2.3" seed={24} {...green} />
      <Node x={60} y={113} w={84} label="Refunds" seed={25} {...green} />
      <Node x={150} y={113} w={60} label="OTP" seed={26} {...green} />
      <Node x={240} y={113} w={80} label="Export" seed={27} {...green} />
      <g transform="translate(150 162) rotate(-6)">
        <RoughShape
          shape={roughBox(0, 0, 118, 32, 28, {
            fill: "none",
            stroke: "var(--green)",
            strokeWidth: 2,
          })}
        />
        <text x={0} y={6} textAnchor="middle" className="t-stamp">
          SHIPPED
        </text>
      </g>
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Lay out your product",
    body: "Add your modules once. Payments, Auth, Dashboard: the map of what you've built, from day zero.",
    art: <MapArt />,
  },
  {
    n: "02",
    title: "Branch a release",
    body: "Hang features off a release. Tap a feature and write tickets right there, next to the spec they come from.",
    art: <PlanArt />,
  },
  {
    n: "03",
    title: "Watch it turn green",
    body: "Status rolls up the tree on its own. When every branch is green, the release is ready. No status meeting.",
    art: <ShipArt />,
  },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <Reveal>
        <p className="kicker">How it works</p>
        <h2 className="display h2">
          Map it. Branch it. <em>Ship it.</em>
        </h2>
      </Reveal>
      <div className="steps">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1} className="step">
            <div className="step-art">{s.art}</div>
            <p className="step-n">{s.n}</p>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
