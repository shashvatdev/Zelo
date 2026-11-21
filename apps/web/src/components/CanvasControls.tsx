"use client";

import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import { useEffect, useState } from "react";

export const FIT = {
  padding: { x: "64px", top: "56px", bottom: "64px" },
  maxZoom: 1.05,
} as const;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Bottom-left canvas bar: zoom out, zoom %, zoom in | fit the tree | full screen.
 * Keys: + / − zoom, Shift+1 fit, F full screen.
 */
export default function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const [full, setFull] = useState(false);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => {
      setFull(Boolean(document.fullscreenElement));
      clearTimeout(t);
      t = setTimeout(() => fitView({ ...FIT, duration: 350 }), 250);
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomIn({ duration: 200 });
      else if (e.key === "-" || e.key === "_") zoomOut({ duration: 200 });
      else if (e.key === "!" || (e.shiftKey && e.code === "Digit1"))
        fitView({ ...FIT, duration: 350 });
      else if (e.key === "f" || e.key === "F") toggleFull();
      else return;
      e.preventDefault();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [fitView, zoomIn, zoomOut]);

  return (
    <Panel position="bottom-left" className="zbar" aria-label="Canvas controls">
      <button
        type="button"
        className="zb"
        onClick={() => zoomOut({ duration: 200 })}
        aria-label="Zoom out"
        data-tip="Zoom out  −"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.5 8h9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="zb zb-pct"
        onClick={() => fitView({ ...FIT, duration: 350 })}
        aria-label={`Zoom ${Math.round(zoom * 100)} percent. Fit to screen`}
        data-tip="Fit to screen  ⇧1"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className="zb"
        onClick={() => zoomIn({ duration: 200 })}
        aria-label="Zoom in"
        data-tip="Zoom in  +"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.5 8h9M8 3.5v9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="zb-sep" aria-hidden="true" />
      <button
        type="button"
        className="zb"
        onClick={() => fitView({ ...FIT, duration: 350 })}
        aria-label="Fit the tree to the screen"
        data-tip="Fit to screen  ⇧1"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="5.5"
            y="5.5"
            width="5"
            height="5"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`zb ${full ? "on" : ""}`}
        onClick={toggleFull}
        aria-label={full ? "Exit full screen" : "Full screen"}
        aria-pressed={full}
        data-tip={full ? "Exit full screen  F" : "Full screen  F"}
      >
        {full ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 2.5V6H2.5M10 2.5V6h3.5M10 13.5V10h3.5M6 13.5V10H2.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2.8 2.8 6.3 6.3M13.2 2.8 9.7 6.3M13.2 13.2 9.7 9.7M2.8 13.2l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </Panel>
  );
}
