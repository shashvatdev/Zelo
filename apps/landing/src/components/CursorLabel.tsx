"use client";

import { useEffect, useRef } from "react";

/**
 * A small "You" tag that trails the visitor's orange cursor, like a multiplayer canvas.
 * Mouse and trackpad only; touch screens have no cursor to follow.
 */
export default function CursorLabel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let visible = false;

    const tick = () => {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      el.style.transform = `translate(${cx + 16}px, ${cy + 22}px)`;
      raf =
        Math.abs(x - cx) + Math.abs(y - cy) > 0.3
          ? requestAnimationFrame(tick)
          : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        cx = x;
        cy = y;
        el.style.opacity = "1";
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="cursor-label" aria-hidden="true">
      You
    </div>
  );
}
