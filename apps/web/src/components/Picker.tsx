"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { STATUS_LABEL, STATUS_ORDER, type Status } from "@/data/model";
import { useStore } from "@/lib/store";
import { Avatar } from "./nodes";

export type Option = {
  value: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
};

type Pos = { x: number; y: number; w: number; up: boolean };

/**
 * A small custom select: trigger button + floating menu (portal, so the panel never clips it).
 * Keyboard: Enter/Space/↓ opens, ↑↓ moves, Enter picks, Esc closes.
 */
export function Picker({
  value,
  options,
  onChange,
  label,
  trigger,
  className = "",
  menuWidth = 220,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  label: string;
  trigger: ReactNode;
  className?: string;
  menuWidth?: number;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = pos !== null;

  const show = () => {
    const r = btn.current!.getBoundingClientRect();
    const h = options.reduce((s, o) => s + (o.sub ? 50 : 38), 12);
    const w = Math.max(r.width, menuWidth);
    const up = r.bottom + h + 8 > window.innerHeight;
    setPos({
      x: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
      y: up ? r.top - h - 6 : r.bottom + 6,
      w,
      up,
    });
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
  };
  const hide = (focus = false) => {
    setPos(null);
    if (focus) btn.current?.focus();
  };
  const pick = (v: string) => {
    if (v !== value) onChange(v);
    hide(true);
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setPos(null);
    };
    const close = () => setPos(null);
    document.addEventListener("pointerdown", down);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const onBtnKey = (e: KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      show();
    }
  };
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      hide(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(options[active].value);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`pk-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onBtnKey}
      >
        {trigger}
        <svg
          className="pk-caret"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            className={`pk-menu ${pos.up ? "up" : ""}`}
            style={{ left: pos.x, top: pos.y, width: pos.w }}
            onKeyDown={onMenuKey}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                tabIndex={-1}
                className={`pk-opt ${i === active ? "active" : ""}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                {o.icon}
                <span className="pk-text">
                  <span>{o.label}</span>
                  {o.sub && <small>{o.sub}</small>}
                </span>
                <svg
                  className="pk-check"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7.2 5.8 10 11 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <span className="st-ico done">✓</span>;
  return <span className={`st-ico ${status}`} />;
}

const STATUS_SUB: Record<Status, string> = {
  todo: "Not started",
  dev: "Being built",
  qa: "Being tested",
  done: "Shipped to the release",
};

export function StatusPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Status;
  onChange: (s: Status) => void;
  compact?: boolean;
}) {
  return (
    <Picker
      label="Status"
      value={value}
      onChange={(v) => onChange(v as Status)}
      className={`tone-${value} ${compact ? "pk-compact" : "pk-field"}`}
      menuWidth={210}
      options={STATUS_ORDER.map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
        sub: compact ? undefined : STATUS_SUB[s],
        icon: <StatusIcon status={s} />,
      }))}
      trigger={
        <span className="pk-value">
          <StatusIcon status={value} />
          {STATUS_LABEL[value]}
        </span>
      }
    />
  );
}

export function PersonPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  compact?: boolean;
}) {
  const { state } = useStore();
  const people = state.graph.people;
  const current = people.find((p) => p.id === value);
  return (
    <Picker
      label={`Assignee: ${current?.name ?? "Unassigned"}`}
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      className={compact ? "pk-compact pk-avatar" : "pk-field"}
      menuWidth={236}
      options={[
        ...people.map((p) => ({
          value: p.id,
          label: p.name,
          sub: p.role,
          icon: <Avatar personId={p.id} size={26} />,
        })),
        {
          value: "",
          label: "Unassigned",
          sub: "Nobody owns it yet",
          icon: <Avatar personId={null} size={26} />,
        },
      ]}
      trigger={
        <span className="pk-value">
          <Avatar personId={value} size={compact ? 22 : 22} />
          {!compact && (
            <span className="pk-name">{current?.name ?? "Unassigned"}</span>
          )}
        </span>
      }
    />
  );
}
