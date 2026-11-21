import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

/**
 * Hand-drawn shapes, the same rough.js style Excalidraw uses.
 * A fixed seed per shape keeps the wobble identical on the server and the client.
 */
const gen = rough.generator();

const base: Options = {
  roughness: 0.9,
  bowing: 0.8,
  stroke: "var(--ink)",
  strokeWidth: 1.5,
  preserveVertices: true,
};

export type RoughPath = {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
};

function paths(drawable: ReturnType<typeof gen.path>): RoughPath[] {
  return gen.toPaths(drawable).map((p) => ({
    d: p.d,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    fill: p.fill,
  }));
}

export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r = 10,
) {
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

export function roughBox(
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  opts: Options = {},
): RoughPath[] {
  return paths(
    gen.path(roundedRect(cx - w / 2, cy - h / 2, w, h, 10), {
      ...base,
      fill: "var(--card)",
      fillStyle: "solid",
      seed,
      ...opts,
    }),
  );
}

export function roughLine(
  points: [number, number][],
  seed: number,
  opts: Options = {},
): RoughPath[] {
  return paths(
    gen.linearPath(points, {
      ...base,
      seed,
      strokeWidth: 1.3,
      roughness: 0.7,
      ...opts,
    }),
  );
}

export function roughCurve(
  d: string,
  seed: number,
  opts: Options = {},
): RoughPath[] {
  return paths(gen.path(d, { ...base, seed, ...opts }));
}

/** Renders rough paths. `draw` adds pathLength=1 so CSS can animate the stroke being drawn. */
export function RoughShape({
  shape,
  draw = false,
  dashed = false,
  stroke,
}: {
  shape: RoughPath[];
  draw?: boolean;
  dashed?: boolean;
  stroke?: string;
}) {
  return (
    <>
      {shape.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.fill && p.stroke === "none" ? "none" : (stroke ?? p.stroke)}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "5 6" : undefined}
          pathLength={draw ? 1 : undefined}
        />
      ))}
    </>
  );
}
