"use client";

import { useMemo, type CSSProperties } from "react";
import type { FlowNode, Tone } from "@/lib/askZelo";
import { RoughShape, roughBox, roughLine, type RoughPath } from "@/lib/rough";

const TONE: Record<
  Tone,
  { fill: string; stroke: string; text: string; sub: string }
> = {
  ink: {
    fill: "var(--ink)",
    stroke: "var(--ink)",
    text: "var(--paper)",
    sub: "var(--muted-2)",
  },
  coral: {
    fill: "color-mix(in srgb, var(--coral) 14%, var(--card))",
    stroke: "var(--coral)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
  done: {
    fill: "var(--green-soft)",
    stroke: "var(--green)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
  qa: {
    fill: "var(--amber-soft)",
    stroke: "var(--amber)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
  dev: {
    fill: "var(--blue-soft)",
    stroke: "var(--blue)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
  todo: {
    fill: "var(--card)",
    stroke: "var(--muted-2)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
  plain: {
    fill: "var(--card)",
    stroke: "var(--ink)",
    text: "var(--ink)",
    sub: "var(--muted)",
  },
};

type Placed = {
  node: FlowNode;
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  box: RoughPath[];
  big?: boolean;
};
type Edge = { shape: RoughPath[]; delay: number };

/** Wide layout: root on top, branches side by side, leaves stacked under each branch. */
function layoutWide(root: FlowNode) {
  const W = 920;
  const kids = root.children ?? [];
  const cw = W / Math.max(1, kids.length);
  const cy = 176;
  const ch = 60;
  const placed: Placed[] = [];
  const edges: Edge[] = [];
  let seed = 41;
  const next = () => (seed += 7);
  placed.push({
    node: root,
    x: W / 2,
    y: 52,
    w: 280,
    h: 64,
    delay: 0.05,
    box: [],
    big: true,
  });
  let maxY = 120;
  let t = 0.75;
  kids.forEach((k, i) => {
    const x = cw * (i + 0.5);
    const w = Math.min(206, cw - 22);
    placed.push({
      node: k,
      x,
      y: cy,
      w,
      h: ch,
      delay: 0.32 + i * 0.1,
      box: [],
    });
    edges.push({
      shape: roughLine(
        [
          [W / 2, 84],
          [W / 2, 116],
          [x, 116],
          [x, cy - ch / 2 - 2],
        ],
        next(),
      ),
      delay: 0.2,
    });
    const spine = x - w / 2 + 14;
    (k.children ?? []).forEach((g, j) => {
      const gy = cy + ch / 2 + 34 + j * 56;
      const gw = w - 20;
      placed.push({
        node: g,
        x: spine + 12 + gw / 2,
        y: gy,
        w: gw,
        h: 44,
        delay: t,
        box: [],
      });
      edges.push({
        shape: roughLine(
          [
            [spine, cy + ch / 2],
            [spine, gy],
            [spine + 10, gy],
          ],
          next(),
          { stroke: "var(--muted-2)" },
        ),
        delay: t - 0.05,
      });
      t += 0.06;
      maxY = Math.max(maxY, gy + 22);
    });
    maxY = Math.max(maxY, cy + ch / 2);
  });
  return { W, H: maxY + 24, placed, edges, next };
}

/** Narrow layout for phones: everything in one column, branches down a spine. */
function layoutNarrow(root: FlowNode) {
  const W = 420;
  const placed: Placed[] = [];
  const edges: Edge[] = [];
  let seed = 41;
  const next = () => (seed += 7);
  placed.push({
    node: root,
    x: W / 2,
    y: 40,
    w: 380,
    h: 60,
    delay: 0.05,
    box: [],
    big: true,
  });
  let y = 110;
  let t = 0.3;
  const spine = 34;
  (root.children ?? []).forEach((k) => {
    const ky = y + 28;
    placed.push({
      node: k,
      x: spine + 16 + 180,
      y: ky,
      w: 360,
      h: 56,
      delay: t,
      box: [],
    });
    edges.push({
      shape: roughLine(
        [
          [spine, 70],
          [spine, ky],
          [spine + 14, ky],
        ],
        next(),
      ),
      delay: t - 0.05,
    });
    t += 0.1;
    y = ky + 28 + 10;
    (k.children ?? []).forEach((g) => {
      const gy = y + 21;
      placed.push({
        node: g,
        x: spine + 50 + 160,
        y: gy,
        w: 320,
        h: 42,
        delay: t,
        box: [],
      });
      edges.push({
        shape: roughLine(
          [
            [spine + 30, ky + 28],
            [spine + 30, gy],
            [spine + 48, gy],
          ],
          next(),
          { stroke: "var(--muted-2)" },
        ),
        delay: t - 0.05,
      });
      t += 0.05;
      y = gy + 21 + 8;
    });
    y += 10;
  });
  return { W, H: y + 10, placed, edges, next };
}

export function flowDelays(root: FlowNode, narrow: boolean) {
  const l = narrow ? layoutNarrow(root) : layoutWide(root);
  return l.placed.map((p) => ({
    t: p.delay,
    big: !!p.big,
    depth: p.node === root ? 0 : (root.children ?? []).includes(p.node) ? 1 : 2,
  }));
}

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default function FlowChart({
  tree,
  narrow,
}: {
  tree: FlowNode;
  narrow: boolean;
}) {
  const l = useMemo(() => {
    const out = narrow ? layoutNarrow(tree) : layoutWide(tree);
    out.placed.forEach((p) => {
      const tone = TONE[p.node.tone];
      p.box = roughBox(p.x, p.y, p.w, p.h, out.next(), {
        fill: tone.fill,
        stroke: tone.stroke,
        strokeWidth: p.big ? 2 : 1.6,
      });
    });
    return out;
  }, [tree, narrow]);

  return (
    <svg
      className={narrow ? "flow flow-narrow" : "flow"}
      viewBox={`0 0 ${l.W} ${l.H}`}
      role="img"
      aria-label={`Flowchart: ${tree.label}`}
    >
      {l.edges.map((e, i) => (
        <g key={`e${i}`} className="draw" style={d(e.delay)}>
          <RoughShape shape={e.shape} draw />
        </g>
      ))}
      {l.placed.map((p, i) => {
        const tone = TONE[p.node.tone];
        const leaf = !p.big && !(p.node.children && p.node.children.length);
        const left = narrow || !p.big;
        const tx = left ? p.x - p.w / 2 + 14 : p.x;
        return (
          <g
            key={i}
            className={p.big ? "pop" : "pop pop-sm"}
            style={d(p.delay)}
          >
            <RoughShape shape={p.box} />
            <text
              x={tx}
              y={p.node.sub ? p.y - (leaf ? 2 : 4) : p.y + 5}
              textAnchor={left ? "start" : "middle"}
              className={p.big ? "fl-title" : leaf ? "fl-leaf" : "fl-branch"}
              fill={tone.text}
            >
              {p.node.label}
            </text>
            {p.node.sub && (
              <text
                x={tx}
                y={p.y + (leaf ? 13 : 16)}
                textAnchor={left ? "start" : "middle"}
                className="fl-sub"
                fill={tone.sub}
              >
                {p.node.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
