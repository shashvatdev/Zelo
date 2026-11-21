"use client";

import { useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { Picker } from "./Picker";
import { Avatar } from "./nodes";
import { Field, Modal } from "./ui";

/** Add a feature to a version: it lands on the tree under its module, ready for tickets. */
export default function AddFeature({ releaseId, onClose }: { releaseId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const g = state.graph;
  const release = g.releases.find((r) => r.id === releaseId);
  const modules = g.modules.filter((m) => !m.misc);
  const [name, setName] = useState("");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? g.modules[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState<string>(state.meId);
  const [spec, setSpec] = useState("");
  const mod = g.modules.find((m) => m.id === moduleId);
  const owner = g.people.find((p) => p.id === ownerId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !moduleId) return;
    dispatch({ type: "addFeature", releaseId, name, moduleId, ownerId, spec });
    onClose();
  };

  return (
    <Modal title="Add a feature" sub={release ? `To ${release.version} · ${release.name}` : undefined} onClose={onClose} width={500}>
      <form className="form" onSubmit={submit}>
        <Field label="Feature name" hint="What the user gets, like “Refunds” or “Dark mode”.">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saved cards" />
        </Field>
        <div className="form-row">
          <Field label="Module">
            <Picker
              label="Module"
              value={moduleId}
              onChange={setModuleId}
              className="pk-field"
              options={g.modules.map((m) => ({ value: m.id, label: m.name, icon: <span className="legend-dot" style={{ background: m.color }} /> }))}
              trigger={
                <span className="pk-value">
                  <span className="legend-dot" style={{ background: mod?.color }} />
                  {mod?.name ?? "Choose"}
                </span>
              }
            />
          </Field>
          <Field label="Owner">
            <Picker
              label="Owner"
              value={ownerId}
              onChange={setOwnerId}
              className="pk-field"
              options={g.people.map((p) => ({ value: p.id, label: p.name, icon: <Avatar personId={p.id} size={22} /> }))}
              trigger={
                <span className="pk-value">
                  <Avatar personId={ownerId} size={20} />
                  <span className="pk-name">{owner?.name ?? "Choose"}</span>
                </span>
              }
            />
          </Field>
        </div>
        <Field label="Spec" hint="Optional. A few lines on what done looks like; you can edit it later.">
          <textarea rows={3} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Customers can… so that…" />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-ink" disabled={!name.trim()}>
            Add feature
          </button>
        </div>
      </form>
    </Modal>
  );
}
