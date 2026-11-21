"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Centered dialog with the paper/ink look. Esc or the backdrop closes it. */
export function Modal({ title, sub, onClose, children, width = 460 }: { title: string; sub?: string; onClose: () => void; children: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("input, textarea, button.pk-trigger, select")?.focus());
    const key = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector(".pk-menu") && onClose();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={box} style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="cp-icon" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? "has-error" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z" fill="#4285F4" />
      <path d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3Z" fill="#FBBC05" />
      <path d="M9 3.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z" fill="#EA4335" />
    </svg>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
        <path d="M13 6.5 L6 19 M13 6.5 L20 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="13" cy="5.5" r="3.6" fill="currentColor" />
        <circle cx="6" cy="20" r="3.2" fill="var(--paper)" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="20" cy="20" r="3.2" fill="var(--coral)" />
      </svg>
      zelo
    </span>
  );
}

/** Small "this is a demo" note, used wherever the real thing needs a backend (email, payments). */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="demo-note">
      <span>Demo</span>
      {children}
    </p>
  );
}
