"use client";

import { useMemo, useState } from "react";
import { buildNotes, GROUP_TITLE, SAMPLE } from "@/lib/releaseNotes";

export default function ReleaseNotesTool() {
  const [input, setInput] = useState(SAMPLE);
  const [version, setVersion] = useState("v2.3");
  const [date, setDate] = useState("");
  const [internal, setInternal] = useState(false);
  const [copied, setCopied] = useState(false);

  const notes = useMemo(
    () => buildNotes(input, { version, date, internal }),
    [input, version, date, internal],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notes.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="tool">
      <div className="tool-in">
        <div className="tool-row">
          <label className="field">
            <span>Version</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v2.3"
            />
          </label>
          <label className="field">
            <span>Date (optional)</span>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="12 Dec 2026"
            />
          </label>
        </div>
        <label className="field">
          <span>
            Changes, one per line (commit messages, PR or ticket titles)
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={11}
            spellCheck={false}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
          />
          Include internal changes (docs, chores, tests)
        </label>
      </div>

      <div className="tool-out" aria-live="polite">
        <div className="tool-out-bar">
          <strong>{notes.heading}</strong>
          <span>{notes.count} changes</span>
          <button type="button" className="btn btn-ink btn-sm" onClick={copy}>
            {copied ? "Copied" : "Copy Markdown"}
          </button>
        </div>
        <div className="notes-preview">
          {notes.shown.length === 0 && (
            <p className="tool-empty">
              Paste some changes to see your release notes.
            </p>
          )}
          {notes.shown.map((g) => (
            <div key={g} className={`notes-group g-${g}`}>
              <p className="notes-h">{GROUP_TITLE[g]}</p>
              <ul>
                {notes.groups[g].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
