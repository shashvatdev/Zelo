"use client";

import { useMemo, type CSSProperties } from "react";
import { RoughShape, roughBox, roughLine } from "@/lib/rough";
import { LIST_ROWS, STATUS_LABEL, T, type Layout, type Status } from "./tree";

const STATUS_COLOR: Record<Status, string> = {
  done: "var(--green)",
  qa: "var(--amber)",
  dev: "var(--blue)",
  todo: "var(--muted-2)",
};

const STATUS_FILL: Record<Status, string> = {
  done: "var(--green-soft)",
  qa: "var(--amber-soft)",
  dev: "var(--blue-soft)",
  todo: "var(--card)",
};

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default function HeroCanvas({ layout }: { layout: Layout }) {
  const l = layout;

  const shapes = useMemo(() => buildShapes(l), [l]);

  return <HeroSvg l={l} shapes={shapes} />;
}

function buildShapes(l: Layout) {
  let seed = 7;
  const next = () => (seed += 13);
  return {
    release: roughBox(
      l.release.x,
      l.release.y,
      l.release.w,
      l.release.h,
      next(),
      {
        fill: "var(--ink)",
        stroke: "var(--ink)",
      },
    ),
    features: l.features.map((f) => ({
      box: roughBox(f.x, f.y, f.w, f.h, next()),
      edge: roughLine(f.edge, next()),
      tickets: f.tickets.map((tk) => ({
        box: roughBox(tk.x, tk.y, tk.w, tk.h, next(), {
          fill: STATUS_FILL[tk.status],
          stroke: STATUS_COLOR[tk.status],
          strokeWidth: 1.4,
        }),
        edge: roughLine(tk.edge, next(), { stroke: "var(--muted-2)" }),
      })),
    })),
    list: LIST_ROWS.map((_, i) =>
      roughBox(
        l.list.x,
        l.list.y + i * l.list.step,
        l.list.w,
        l.list.h,
        next(),
        {
          stroke: "var(--line-strong)",
          strokeWidth: 1.2,
          roughness: 0.5,
        },
      ),
    ),
    doc: l.doc
      ? roughBox(l.doc.x, l.doc.y, l.doc.w, l.doc.h, next(), {
          strokeWidth: 1.3,
        })
      : null,
    docEdge: l.doc
      ? roughLine(l.doc.edge, next(), { stroke: "var(--coral)" })
      : null,
    ai: roughBox(l.ai.x, l.ai.y, l.ai.w, l.ai.h, next(), {
      fill: "var(--paper)",
      stroke: "var(--ink)",
      strokeWidth: 1.6,
    }),
    scribble: roughLine(
      l.compact
        ? [
            [380, 40],
            [350, 62],
            [322, 92],
          ]
        : [
            [774, 98],
            [806, 110],
            [828, 128],
          ],
      next(),
      { stroke: "var(--coral)", strokeWidth: 1.6, roughness: 1.4 },
    ),
  };
}

function HeroSvg({
  l,
  shapes,
}: {
  l: Layout;
  shapes: ReturnType<typeof buildShapes>;
}) {
  return (
    <svg
      className="tree"
      viewBox={`0 0 ${l.w} ${l.h}`}
      role="img"
      aria-label="A flat list of tickets turns into a connected release tree: Release v2.3, its features, and each feature's tickets with their status."
    >
      {/* Phase 1: the flat list everyone is tired of */}
      <g
        className="list-phase"
        style={{ "--o": `${T.listOut}s` } as CSSProperties}
      >
        {LIST_ROWS.map((row, i) => {
          const y = l.list.y + i * l.list.step;
          const x0 = l.list.x - l.list.w / 2;
          return (
            <g
              key={row.id}
              className="list-row"
              style={d(T.rowIn + i * T.rowStep)}
            >
              <RoughShape shape={shapes.list[i]} />
              <text x={x0 + 16} y={y + 5} className="t-mono">
                {row.id}
              </text>
              <text
                x={x0 + (l.compact ? 100 : 118)}
                y={y + 5}
                className="t-row"
              >
                {row.title}
              </text>
              {!l.compact && (
                <text
                  x={x0 + l.list.w - 16}
                  y={y + 5}
                  className="t-row-muted"
                  textAnchor="end"
                >
                  {row.status}
                </text>
              )}
            </g>
          );
        })}
        <g className="list-row" style={d(T.annotate)}>
          <RoughShape shape={shapes.scribble} />
          <text
            x={l.compact ? 300 : 600}
            y={l.compact ? 32 : 106}
            className="t-hand"
            textAnchor="middle"
          >
            which feature is this for??
          </text>
        </g>
      </g>

      {/* Phase 2: the map */}
      {shapes.features.map((f, i) => (
        <g key={`e${i}`} className="draw" style={d(l.features[i].edgeDelay)}>
          <RoughShape shape={f.edge} draw />
        </g>
      ))}

      <g className="pop" style={d(T.release)}>
        <RoughShape shape={shapes.release} />
        <text
          x={l.release.x}
          y={l.release.y - 3}
          className="t-release"
          textAnchor="middle"
        >
          Release v2.3
        </text>
        <text
          x={l.release.x}
          y={l.release.y + 18}
          className="t-release-sub"
          textAnchor="middle"
        >
          4 features · ships Dec 12
        </text>
      </g>

      {l.features.map((f, i) => {
        const pct = f.done / f.total;
        const barW = f.w - 32;
        const x0 = f.x - f.w / 2 + 16;
        return (
          <g key={f.name}>
            {f.tickets.map((tk, j) => (
              <g key={tk.title}>
                <g className="draw" style={d(tk.delay - 0.06)}>
                  <RoughShape shape={shapes.features[i].tickets[j].edge} draw />
                </g>
                <g className="pop pop-sm" style={d(tk.delay)}>
                  <RoughShape shape={shapes.features[i].tickets[j].box} />
                  <circle
                    cx={tk.x - tk.w / 2 + 16}
                    cy={tk.y}
                    r={4.5}
                    fill={STATUS_COLOR[tk.status]}
                  />
                  <text
                    x={tk.x - tk.w / 2 + 28}
                    y={tk.y + 5}
                    className="t-ticket"
                  >
                    {tk.title}
                  </text>
                  {!l.compact && (
                    <text
                      x={tk.x + tk.w / 2 - 12}
                      y={tk.y + 4}
                      className="t-status"
                      textAnchor="end"
                    >
                      {STATUS_LABEL[tk.status]}
                    </text>
                  )}
                </g>
              </g>
            ))}
            <g className="pop" style={d(f.delay)}>
              <RoughShape shape={shapes.features[i].box} />
              <text x={x0} y={f.y - 8} className="t-feature">
                {f.name}
              </text>
              <text
                x={x0 + barW}
                y={f.y - 8}
                className="t-module"
                textAnchor="end"
              >
                {f.module}
              </text>
              <rect
                x={x0}
                y={f.y + 10}
                width={barW}
                height={6}
                rx={3}
                fill="var(--line)"
              />
              <rect
                className="bar"
                x={x0}
                y={f.y + 10}
                width={barW}
                height={6}
                rx={3}
                fill={pct === 1 ? "var(--green)" : "var(--ink)"}
                style={
                  {
                    ...d(l.progressDelay + i * 0.06),
                    "--p": pct,
                  } as CSSProperties
                }
              />
              <text x={x0} y={f.y + 30} className="t-count">
                {f.done}/{f.total} done
              </text>
            </g>
          </g>
        );
      })}

      {l.doc && shapes.doc && shapes.docEdge && (
        <>
          <g className="draw" style={d(l.doc.delay - 0.08)}>
            <RoughShape shape={shapes.docEdge} draw />
          </g>
          <g className="pop" style={d(l.doc.delay)}>
            <RoughShape shape={shapes.doc} />
            <g
              transform={`translate(${l.doc.x - l.doc.w / 2 + 14} ${l.doc.y - 13})`}
            >
              <path
                d="M0 0h14l6 6v20H0z"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M4 12h12M4 17h12M4 22h8"
                stroke="var(--muted)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
            <text
              x={l.doc.x - l.doc.w / 2 + 44}
              y={l.doc.y - 2}
              className="t-ticket"
            >
              Dark mode spec
            </text>
            <text
              x={l.doc.x - l.doc.w / 2 + 44}
              y={l.doc.y + 16}
              className="t-status"
            >
              Spec · 3 comments
            </text>
          </g>
        </>
      )}

      <g className="pop" style={d(l.ai.delay)}>
        <RoughShape shape={shapes.ai} />
        <g transform={`translate(${l.ai.x - l.ai.w / 2 + 22} ${l.ai.y})`}>
          <path
            d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
            fill="var(--coral)"
          />
        </g>
        <text x={l.ai.x - l.ai.w / 2 + 42} y={l.ai.y + 5} className="t-ai">
          {l.ai.text}
        </text>
      </g>

      {l.cursors.map((c) => (
        <g
          key={c.name}
          className="cursor"
          style={
            {
              ...d(c.delay),
              "--sx": `${c.sx}px`,
              "--sy": `${c.sy}px`,
            } as CSSProperties
          }
        >
          <g transform={`translate(${c.x} ${c.y})`}>
            <path
              d="M0 0 L0 17 L4.6 12.6 L8 20 L11 18.6 L7.8 11.4 L14 11.4 Z"
              fill={c.color}
              stroke="var(--card)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <rect
              x={12}
              y={20}
              width={c.name.length * 8 + c.role.length * 7 + 26}
              height={22}
              rx={11}
              fill={c.color}
            />
            <text x={22} y={35} className="t-cursor">
              {c.name} · {c.role}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
