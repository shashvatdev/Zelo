"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { FlowNode } from "@/lib/askZelo";
import FlowChart from "../vs/FlowChart";

/** A page-specific flowchart in a product window; it draws itself when scrolled into view. */
export default function FlowShowcase({
  tree,
  caption,
  label,
}: {
  tree: FlowNode;
  caption: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [run, setRun] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="window vs-window showcase" ref={ref}>
      <div className="window-bar">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="crumbs">
          Acme <b>/</b> <strong>{label}</strong>
        </span>
        <button
          type="button"
          className="replay"
          onClick={() => setRun((r) => r + 1)}
          aria-label="Replay the diagram"
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
      <div className="showcase-canvas">
        {inView && <FlowChart key={run} tree={tree} narrow={narrow} />}
      </div>
      <p className="showcase-cap">{caption}</p>
    </div>
  );
}
