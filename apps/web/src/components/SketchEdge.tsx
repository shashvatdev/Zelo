"use client";

import { getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";

type Data = {
  delay?: number;
  variant?: string;
  span?: number;
  dim?: boolean;
  color?: string;
};

/**
 * One edge type for the whole canvas, drawn on as the tree builds.
 *  tree / spine / rail: elbow lines of the hierarchy
 *  timeline: release to release
 *  arc: "extends", a curve over the lane from one version of a feature to the next
 */
function SketchEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as Data;
  const variant = d.variant ?? "tree";
  const style = { "--d": `${d.delay ?? 0}s` } as CSSProperties;

  if (variant === "arc") {
    const lift = Math.min(48, 16 + 11 * (d.span ?? 2));
    const path = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY - lift}, ${targetX} ${targetY - lift}, ${targetX} ${targetY}`;
    return (
      <g className={`edge-arc ${d.dim ? "dim" : ""}`} style={style}>
        <path d={path} className="arc-glow" style={{ stroke: d.color }} />
        <path d={path} className="arc-line" style={{ stroke: d.color }} />
        <circle
          r="3.5"
          className="arc-end"
          cx={targetX}
          cy={targetY}
          style={{ fill: d.color }}
        />
      </g>
    );
  }

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: variant === "spine" ? 8 : 14,
    offset: variant === "spine" ? 12 : 24,
  });
  if (variant === "link") {
    return (
      <g className={`edge-link ${d.dim ? "dim" : ""}`} style={style}>
        <path d={path} className="arc-glow" style={{ stroke: d.color }} />
        <path d={path} className="arc-line" style={{ stroke: d.color }} />
      </g>
    );
  }

  return (
    <path
      d={path}
      pathLength={1}
      className={`edge-draw e-${variant} ${d.dim ? "dim" : ""}`}
      style={style}
      fill="none"
    />
  );
}

export default memo(SketchEdge);
