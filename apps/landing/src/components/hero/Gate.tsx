"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Logo } from "../Nav";

/**
 * The entry screen. Browsers only allow audio after a click, tap, swipe or key press, so the
 * film starts from here: one gesture turns on sound and plays the intro from its first second.
 */
export default function Gate({
  leaving,
  onEnter,
}: {
  leaving: boolean;
  onEnter: (withSound: boolean) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; moved: boolean } | null>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);

  const maxX = () => {
    const track = trackRef.current;
    return track ? track.clientWidth - 60 : 240;
  };

  // Runs inside the pointer/key handler, so the browser counts it as the visitor's gesture.
  const complete = () => {
    if (done) return;
    setDone(true);
    setX(maxX());
    onEnter(true);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX - x, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || done) return;
    const next = Math.min(maxX(), Math.max(0, e.clientX - drag.current.startX));
    if (Math.abs(next - x) > 3) drag.current.moved = true;
    setX(next);
  };

  const onPointerUp = () => {
    if (!drag.current || done) return;
    const { moved } = drag.current;
    drag.current = null;
    setDragging(false);
    // A plain click or tap starts it too; a swipe has to go most of the way.
    if (!moved || x > maxX() * 0.6) complete();
    else setX(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      complete();
    }
  };

  const progress = Math.min(1, x / Math.max(1, maxX()));

  return (
    <div
      className={leaving ? "gate out" : "gate"}
      role="dialog"
      aria-label="Start the Zelo film"
    >
      <div className="gate-top">
        <Logo />
      </div>

      <div className="gate-center">
        <p className="gate-eyebrow hand">a 12-second film</p>
        <h1 className="display gate-title">
          What if you could{" "}
          <span className="gate-see">
            <em>see</em>
            <svg
              viewBox="0 0 100 16"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M3 10 C 25 4, 55 14, 97 6" pathLength={1} />
            </svg>
          </span>{" "}
          your release?
        </h1>
        <p className="gate-sub">
          Tickets, features and releases on one living map. Turn your sound on.
        </p>

        <div
          ref={trackRef}
          className={done ? "slider done" : "slider"}
          role="button"
          tabIndex={0}
          aria-label="Start with sound"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <span className="slider-fill" style={{ width: `${x + 56}px` }} />
          <span className="slider-text" style={{ opacity: 1 - progress * 1.4 }}>
            {done ? (
              "Starting"
            ) : (
              <>
                <span className="on-fine">Click or swipe to start</span>
                <span className="on-touch">Tap or swipe to start</span>
              </>
            )}
          </span>
          <span
            className="slider-knob"
            style={{
              transform: `translateX(${x}px)`,
              transition: dragging
                ? "none"
                : "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12h13M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <button
          type="button"
          className="gate-mute"
          onClick={() => onEnter(false)}
        >
          Continue without sound
        </button>
      </div>

      <p className="gate-foot">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Best with sound
      </p>
    </div>
  );
}
