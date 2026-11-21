"use client";

import type { ReactNode } from "react";
import { Logo } from "../ui";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export const FLOW = ["Account", "Plan & payment", "Workspace", "Product", "Team"] as const;

/** Progress across the start flow: account → payment → workspace → product → team. */
export function Steps({ at }: { at: number }) {
  return (
    <ol className="steps" aria-label="Setup progress">
      {FLOW.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="step-dot">{i < at ? "✓" : i + 1}</span>
          <span className="step-name">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** A small hand-drawn tree that grows as the left panel's art. */
function TreeArt() {
  return (
    <svg className="auth-art" viewBox="0 0 320 220" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path className="aa-line" d="M160 46 V78 M160 78 H64 V104 M160 78 H160 V104 M160 78 H256 V104" style={{ "--i": 1 } as React.CSSProperties} />
        <path className="aa-line" d="M64 136 V150 H82 M64 150 V176 H82 M160 136 V150 H178 M256 136 V150 H274" style={{ "--i": 2 } as React.CSSProperties} />
      </g>
      <g className="aa-node" style={{ "--i": 0 } as React.CSSProperties}>
        <rect x="112" y="14" width="96" height="32" rx="9" fill="#1b1a17" />
        <text x="160" y="35" textAnchor="middle" fill="#f6f3ec" fontSize="13" fontWeight="700">v1.0</text>
      </g>
      {[
        [64, "Payments", "#e5582b"],
        [160, "Auth", "#3866c9"],
        [256, "Dashboard", "#2f8f46"],
      ].map(([x, label, c], i) => (
        <g key={String(label)} className="aa-node" style={{ "--i": 1.4 + i * 0.2 } as React.CSSProperties}>
          <rect x={Number(x) - 44} y="104" width="88" height="32" rx="9" fill="#fffdf8" stroke={String(c)} strokeWidth="1.8" />
          <text x={Number(x)} y="125" textAnchor="middle" fill="#1b1a17" fontSize="11.5" fontWeight="650">{label}</text>
        </g>
      ))}
      {[
        [82, 142, "#e3f1e2"],
        [82, 168, "#fbefd6"],
        [178, 142, "#e5ecfa"],
        [274, 142, "#e3f1e2"],
      ].map(([x, y, f], i) => (
        <rect key={i} className="aa-node" style={{ "--i": 2.6 + i * 0.15 } as React.CSSProperties} x={Number(x)} y={Number(y)} width="50" height="16" rx="5" fill={String(f)} stroke="#a8a396" strokeWidth="1.2" />
      ))}
    </svg>
  );
}

export default function AuthShell({ children, step, aside }: { children: ReactNode; step?: number; aside?: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <a href={SITE_URL} className="auth-logo" aria-label="Zelo home">
          <Logo size={26} />
        </a>
        {aside ?? (
          <div className="auth-pitch">
            <TreeArt />
            <h2>Your whole product, as one connected tree.</h2>
            <p>Every version, feature and ticket linked from day zero. No more digging through boards to see what shipped and why.</p>
          </div>
        )}
        <p className="auth-foot">© 2026 Zelo</p>
      </aside>
      <main className="auth-main">
        {step !== undefined && <Steps at={step} />}
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
