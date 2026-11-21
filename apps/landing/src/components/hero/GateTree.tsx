"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { RoughShape, roughBox, roughLine } from "@/lib/rough";

/**
 * The living release tree behind the entry screen.
 * Each cycle: the tree builds fast, the team works it live (tickets move To do → Dev → QA → Done,
 * cursors jump between them, bars fill, pulses run down the edges), the release gets stamped
 * SHIPPED, then it fades and the next release builds. The whole scene drifts and follows the mouse.
 */

type Status = "todo" | "dev" | "qa" | "done";
type Spec = {
  release: string;
  features: { name: string; tickets: Status[] }[];
};

const SETS: Spec[] = [
  {
    release: "Release v2.3",
    features: [
      { name: "Refunds", tickets: ["done", "qa", "dev"] },
      { name: "OTP login", tickets: ["dev", "todo", "todo"] },
      { name: "Export CSV", tickets: ["done", "qa", "todo", "todo"] },
      { name: "Dark mode", tickets: ["dev", "qa", "todo"] },
      { name: "Webhooks", tickets: ["todo", "todo", "dev"] },
    ],
  },
  {
    release: "Release v2.4",
    features: [
      { name: "Saved cards", tickets: ["dev", "todo", "todo"] },
      { name: "Audit log", tickets: ["qa", "dev", "todo", "todo"] },
      { name: "Search", tickets: ["done", "todo", "dev"] },
      { name: "SSO", tickets: ["todo", "todo", "dev"] },
      { name: "Onboarding", tickets: ["qa", "todo", "todo"] },
    ],
  },
];

const NEXT: Record<Status, Status> = {
  todo: "dev",
  dev: "qa",
  qa: "done",
  done: "done",
};
const STROKE: Record<Status, string> = {
  done: "var(--green)",
  qa: "var(--amber)",
  dev: "var(--blue)",
  todo: "var(--muted-2)",
};
const FILL: Record<Status, string> = {
  done: "var(--green-soft)",
  qa: "var(--amber-soft)",
  dev: "var(--blue-soft)",
  todo: "var(--card)",
};
const LABEL: Record<Status, string> = {
  todo: "To do",
  dev: "In dev",
  qa: "In QA",
  done: "Done",
};

const W = 1600;
const XS = [180, 490, 800, 1110, 1420];
const RY = 120;
const FY = 330;
const FW = 236;
const TW = 196;
const TH = 52;
const TGAP = 74;
const BUILD_DONE = 1.7; // seconds until the team starts working
const TICK_MS = 150;

const ticketPos = (fi: number, j: number) => {
  const spine = XS[fi] - FW / 2 + 18;
  return { x: spine + 18 + TW / 2, y: FY + 36 + 60 + j * TGAP, spine };
};

function build(spec: Spec, seedBase: number) {
  let seed = seedBase;
  const next = () => (seed += 11);
  const busY = RY + 33 + 70;
  let t = 0.9;
  const features = spec.features.map((f, i) => {
    const x = XS[i];
    const tickets = f.tickets.map((_, j) => {
      const { x: tx, y, spine } = ticketPos(i, j);
      const ticket = {
        x: tx,
        y,
        delay: t,
        box: roughBox(tx, y, TW, TH, next(), {
          fill: "var(--tk-fill)",
          stroke: "var(--tk-stroke)",
          strokeWidth: 1.7,
        }),
        edge: roughLine(
          [
            [spine, FY + 36],
            [spine, y],
            [spine + 16, y],
          ],
          next(),
          { stroke: "var(--muted-2)" },
        ),
      };
      t += 0.04;
      return ticket;
    });
    const edgePts: [number, number][] = [
      [W / 2, RY + 33],
      [W / 2, busY],
      [x, busY],
      [x, FY - 38],
    ];
    return {
      name: f.name,
      x,
      delay: 0.4 + i * 0.07,
      box: roughBox(x, FY, FW, 72, next(), { strokeWidth: 1.7 }),
      edge: roughLine(edgePts, next(), { strokeWidth: 1.6 }),
      edgePath: `M${edgePts.map((p) => p.join(" ")).join(" L")}`,
      tickets,
    };
  });
  return {
    release: roughBox(W / 2, RY, 290, 68, next(), {
      fill: "var(--ink)",
      stroke: "var(--ink)",
    }),
    stamp: roughBox(0, 0, 210, 54, next(), {
      fill: "var(--paper)",
      stroke: "var(--green)",
      strokeWidth: 3,
    }),
    features,
  };
}

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default function GateTree() {
  const [cycle, setCycle] = useState(0);
  const spec = SETS[cycle % SETS.length];
  const [statuses, setStatuses] = useState<Status[][]>(() =>
    SETS[0].features.map((f) => [...f.tickets]),
  );
  const [working, setWorking] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [cursors, setCursors] = useState({
    b: { x: 1700, y: 120 },
    s: { x: -100, y: 800 },
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  const shapes = useMemo(
    () => build(spec, 300 + (cycle % SETS.length) * 97),
    [spec, cycle],
  );

  // One cycle: build → work the tickets → ship → next release.
  useEffect(() => {
    const current = SETS[cycle % SETS.length].features.map((f) => [
      ...f.tickets,
    ]);
    const reset = () => {
      setStatuses(current.map((r) => [...r]));
      setWorking(false);
      setShipped(false);
      setCursors({ b: { x: 1700, y: 120 }, s: { x: -100, y: 800 } });
    };
    reset();
    let interval: ReturnType<typeof setInterval> | undefined;
    let nextTimer: ReturnType<typeof setTimeout> | undefined;
    let turn = 0;
    const start = setTimeout(() => {
      setWorking(true);
      interval = setInterval(() => {
        const open: [number, number][] = [];
        current.forEach((row, fi) =>
          row.forEach((s, j) => s !== "done" && open.push([fi, j])),
        );
        if (!open.length) {
          clearInterval(interval);
          setShipped(true);
          nextTimer = setTimeout(() => setCycle((c) => c + 1), 2300);
          return;
        }
        const [fi, j] = open[Math.floor(Math.random() * open.length)];
        current[fi][j] = NEXT[current[fi][j]];
        setStatuses(current.map((r) => [...r]));
        const p = ticketPos(fi, j);
        const who = turn++ % 2 === 0 ? "b" : "s";
        setCursors((c) => ({
          ...c,
          [who]: { x: p.x + TW / 2 - 30, y: p.y + 6 },
        }));
      }, TICK_MS);
    }, BUILD_DONE * 1000);
    return () => {
      clearTimeout(start);
      clearTimeout(nextTimer);
      clearInterval(interval);
    };
  }, [cycle]);

  // Mouse parallax: the scene leans gently toward the pointer.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty("--px", `${cx.toFixed(2)}px`);
      el.style.setProperty("--py", `${cy.toFixed(2)}px`);
      raf =
        Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05
          ? requestAnimationFrame(loop)
          : 0;
    };
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -28;
      ty = (e.clientY / window.innerHeight - 0.5) * -18;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const doneAll = statuses.flat().filter((s) => s === "done").length;
  const totalAll = statuses.flat().length;

  return (
    <div className="gate-tree" aria-hidden="true" ref={wrapRef}>
      <div className="gate-tree-cam">
        <svg
          key={cycle}
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          className={shipped ? "gt-fade" : undefined}
        >
          {shapes.features.map((f) => (
            <g key={`e-${f.name}`} className="draw" style={d(0.28)}>
              <RoughShape shape={f.edge} draw />
            </g>
          ))}

          {/* Pulses running from the release down to each feature */}
          {!shipped &&
            shapes.features.map((f, i) => (
              <circle
                key={`p-${f.name}`}
                r="6"
                opacity="0"
                className="gt-pulse"
              >
                <set
                  attributeName="opacity"
                  to="1"
                  begin={`${0.75 + i * 0.12}s`}
                />
                <animateMotion
                  path={f.edgePath}
                  dur="1.3s"
                  begin={`${0.75 + i * 0.12}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}

          <g className="pop" style={d(0.12)}>
            <RoughShape shape={shapes.release} />
            <text
              x={W / 2}
              y={RY - 2}
              textAnchor="middle"
              className="gt-release"
            >
              {spec.release}
            </text>
            <text
              x={W / 2}
              y={RY + 20}
              textAnchor="middle"
              className="gt-release-sub"
            >
              {doneAll}/{totalAll} done
            </text>
          </g>

          {shapes.features.map((f, fi) => {
            const x0 = f.x - FW / 2 + 18;
            const barW = FW - 36;
            const row = statuses[fi] ?? [];
            const done = row.filter((s) => s === "done").length;
            const pct = working && row.length ? done / row.length : 0;
            return (
              <g key={f.name}>
                {f.tickets.map((tk, j) => {
                  const s = row[j] ?? "todo";
                  return (
                    <g key={j}>
                      <g className="draw" style={d(tk.delay - 0.05)}>
                        <RoughShape shape={tk.edge} draw />
                      </g>
                      <g className="pop pop-sm" style={d(tk.delay)}>
                        <g
                          key={s}
                          className="gt-bump"
                          style={
                            {
                              "--tk-fill": FILL[s],
                              "--tk-stroke": STROKE[s],
                            } as CSSProperties
                          }
                        >
                          <RoughShape shape={tk.box} />
                          {s === "done" ? (
                            <path
                              d={`M${x0 + 42} ${tk.y} l5 5 l10 -11`}
                              fill="none"
                              stroke="var(--green)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : (
                            <circle
                              cx={x0 + 48}
                              cy={tk.y}
                              r={5.5}
                              fill="var(--tk-stroke)"
                            />
                          )}
                          <rect
                            x={x0 + 66}
                            y={tk.y - 4}
                            width={76 - j * 10}
                            height={8}
                            rx={4}
                            fill="var(--line-strong)"
                          />
                          <text
                            x={tk.x + TW / 2 - 14}
                            y={tk.y + 5}
                            textAnchor="end"
                            className="gt-status"
                          >
                            {LABEL[s]}
                          </text>
                        </g>
                      </g>
                    </g>
                  );
                })}
                <g className="pop" style={d(f.delay)}>
                  <RoughShape shape={f.box} />
                  <text x={x0} y={FY - 6} className="gt-feature">
                    {f.name}
                  </text>
                  <text
                    x={x0 + barW}
                    y={FY - 6}
                    textAnchor="end"
                    className="gt-count"
                  >
                    {done}/{row.length}
                  </text>
                  <rect
                    x={x0}
                    y={FY + 12}
                    width={barW}
                    height={8}
                    rx={4}
                    fill="var(--line)"
                  />
                  <rect
                    x={x0}
                    y={FY + 12}
                    width={barW}
                    height={8}
                    rx={4}
                    className="gt-bar"
                    fill={pct === 1 ? "var(--green)" : "var(--coral)"}
                    style={{ transform: `scaleX(${pct})` }}
                  />
                </g>
              </g>
            );
          })}

          {/* The team, live */}
          {working && (
            <>
              <g
                className="gt-cursor"
                style={{
                  transform: `translate(${cursors.b.x}px, ${cursors.b.y}px)`,
                }}
              >
                <path
                  d="M0 0 L0 22 L6 16.5 L10.5 26 L14.5 24.2 L10.2 15 L18 15 Z"
                  fill="var(--coral)"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <rect
                  x={16}
                  y={26}
                  width={84}
                  height={26}
                  rx={13}
                  fill="var(--coral)"
                />
                <text
                  x={58}
                  y={44}
                  textAnchor="middle"
                  className="gt-cursor-name"
                >
                  Bhumika
                </text>
              </g>
              <g
                className="gt-cursor"
                style={{
                  transform: `translate(${cursors.s.x}px, ${cursors.s.y}px)`,
                }}
              >
                <path
                  d="M0 0 L0 22 L6 16.5 L10.5 26 L14.5 24.2 L10.2 15 L18 15 Z"
                  fill="var(--blue)"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <rect
                  x={16}
                  y={26}
                  width={88}
                  height={26}
                  rx={13}
                  fill="var(--blue)"
                />
                <text
                  x={60}
                  y={44}
                  textAnchor="middle"
                  className="gt-cursor-name"
                >
                  Shashvat
                </text>
              </g>
            </>
          )}

          {shipped && (
            <g transform={`translate(${W / 2 + 190} ${RY + 6}) rotate(-8)`}>
              <g className="gt-stamp">
                <RoughShape shape={shapes.stamp} />
                <text x={0} y={9} textAnchor="middle" className="gt-stamp-text">
                  SHIPPED
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
      <div className="gate-veil" />
    </div>
  );
}
