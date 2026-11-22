"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@/lib/api";
import { Logo } from "../ui";

type Mail = { id: string; to: string; subject: string; kind: string; provider: string; error: string | null; createdAt: string; text: string };

/** Development mailbox: every email the server sent (or would send without a provider). */
export default function Mailbox() {
  const params = useSearchParams();
  const q = useQuery<Mail[]>("/api/dev/mailbox");
  const [picked, setPicked] = useState<string | null>(params.get("id"));
  const to = params.get("to");
  const list = (q.data ?? []).filter((m) => !to || m.to === to);
  const open = list.find((m) => m.id === picked) ?? list[0];

  return (
    <div className="mailbox">
      <header className="set-top">
        <Logo size={22} />
        <span className="set-ws">Dev mailbox</span>
        <button type="button" className="mini-btn" onClick={() => void q.reload()}>
          Refresh
        </button>
        {to && (
          <a className="mini-btn" href="/dev/mailbox">
            Show all
          </a>
        )}
      </header>
      {q.error ? (
        <p className="form-error mb-pad">{q.error.status === 404 ? "The dev mailbox is turned off on this server." : q.error.message}</p>
      ) : (
        <div className="mb-wrap">
          <ul className="mb-list">
            {!list.length && <li className="muted mb-pad">{q.loading ? "Loading…" : "No emails yet."}</li>}
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className={open?.id === m.id ? "on" : ""} onClick={() => setPicked(m.id)}>
                  <strong>{m.subject}</strong>
                  <small>
                    to {m.to} · {new Date(m.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </small>
                  <span className={`pill ${m.error ? "bad" : "ok"}`}>{m.error ? "failed" : m.provider === "outbox" ? "recorded" : "sent"}</span>
                </button>
              </li>
            ))}
          </ul>
          {open && <iframe className="mb-frame" title={open.subject} src={`/api/dev/mailbox/${open.id}`} sandbox="allow-popups allow-popups-to-escape-sandbox" />}
        </div>
      )}
    </div>
  );
}
