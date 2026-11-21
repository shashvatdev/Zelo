"use client";

import { useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { Picker } from "./Picker";
import { Field, Modal } from "./ui";

/** Suggests the next version number from the latest one: v2.3 → v2.4, v1 → v2. */
function nextVersion(latest?: string) {
  if (!latest) return "v1.0";
  const m = /^(\D*)(\d+)(?:\.(\d+))?/.exec(latest);
  if (!m) return "";
  return m[3] !== undefined ? `${m[1]}${m[2]}.${Number(m[3]) + 1}` : `${m[1]}${Number(m[2]) + 1}`;
}

export default function NewVersion({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const latest = [...state.graph.releases].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [version, setVersion] = useState(nextVersion(latest?.version));
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => {
    const base = latest ? new Date(`${latest.date}T00:00:00`) : new Date();
    base.setDate(base.getDate() + 42);
    return base.toISOString().slice(0, 10);
  });
  const [st, setSt] = useState<"planned" | "current">("planned");
  const taken = state.graph.releases.some((r) => r.version.toLowerCase() === version.trim().toLowerCase());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!version.trim() || taken) return;
    dispatch({ type: "addRelease", version, name, date, state: st });
    onClose();
  };

  return (
    <Modal title="New version" sub="A release your team is planning or building now." onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Field label="Version" error={taken ? "That version already exists." : undefined}>
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.1" />
          </Field>
          <Field label="Target date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Name" hint="A short theme helps everyone remember it, like “Self-serve” or “Teams”.">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Faster checkout" />
        </Field>
        <Field label="Status">
          <Picker
            label="Status"
            value={st}
            onChange={(v) => setSt(v as "planned" | "current")}
            className="pk-field"
            options={[
              { value: "planned", label: "Planned", sub: "Coming up next" },
              { value: "current", label: "Current", sub: "Being built now (the current one becomes shipped)" },
            ]}
            trigger={<span className="pk-value">{st === "planned" ? "Planned" : "Current"}</span>}
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-ink" disabled={!version.trim() || taken}>
            Create version
          </button>
        </div>
      </form>
    </Modal>
  );
}
