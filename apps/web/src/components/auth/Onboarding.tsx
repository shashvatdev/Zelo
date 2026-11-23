"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { nextPath, onboard, PERSON_COLORS, slugify, updateWorkspace, useMe, useWorkspace } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { MODULE_COLORS, MODULE_SUGGESTIONS } from "@/data/fresh";
import { InviteForm } from "../invite/Invite";
import { DemoNote, Field, Logo } from "../ui";
import AuthShell from "./AuthShell";

const SIZES = ["Just me", "2–5", "6–20", "21–50", "51–200", "200+"];
const ROLES_OF_YOU = ["Founder", "Product manager", "Engineer", "Designer", "Other"];
type Mode = "empty" | "sample";
const STEPS = ["workspace", "product", "modules", "version", "team", "done"] as const;
type StepId = (typeof STEPS)[number];

function inWeeks(n: number) {
  const d = new Date(Date.now() + n * 7 * 86400000);
  return d.toISOString().slice(0, 10);
}

/** The left panel: the product tree drawing itself as you answer. */
function Preview({ ws, product, modules, version, vname, people, mode }: { ws: string; product: string; modules: string[]; version: string; vname: string; people: string[]; mode: Mode }) {
  const mods = mode === "sample" ? ["Payments", "Auth", "Dashboard", "App UI", "Notifications"] : modules;
  const shown = mods.slice(0, 5);
  const W = 300;
  const step = shown.length ? W / shown.length : W;
  return (
    <div className="ob-preview">
      <p className="ob-ws">
        <Logo size={18} /> <span>/</span> <b>{ws || "your-workspace"}</b>
      </p>
      <svg viewBox="0 0 320 260" className="ob-tree" aria-label="Preview of your product tree">
        <g className="ob-pop" key={product}>
          <rect x="95" y="10" width="130" height="38" rx="10" fill="#1b1a17" />
          <text x="160" y="34" textAnchor="middle" fill="#f6f3ec" fontSize="13" fontWeight="700">
            {(product || "Your product").slice(0, 18)}
          </text>
        </g>
        {shown.map((m, i) => {
          const x = 10 + step * i + step / 2;
          const c = MODULE_COLORS[i % MODULE_COLORS.length];
          return (
            <g key={m + i} className="ob-pop">
              <path d={`M160 48 V70 H${x} V92`} fill="none" stroke="#3a3832" strokeWidth="1.4" />
              <rect x={x - step / 2 + 4} y="92" width={step - 8} height="30" rx="8" fill="#fffdf8" stroke={c} strokeWidth="1.8" />
              <text x={x} y="111" textAnchor="middle" fontSize={shown.length > 4 ? 9.5 : 11} fontWeight="650" fill="#1b1a17">
                {m.length > 11 ? m.slice(0, 10) + "…" : m}
              </text>
            </g>
          );
        })}
        {!shown.length && (
          <g className="ob-ghost">
            <path d="M160 48 V92" stroke="#a8a396" strokeDasharray="4 4" />
            <rect x="110" y="92" width="100" height="30" rx="8" fill="none" stroke="#a8a396" strokeDasharray="5 5" />
            <text x="160" y="111" textAnchor="middle" fontSize="11" fill="#6d695f">
              modules
            </text>
          </g>
        )}
        <g className="ob-pop" key={version + vname}>
          <path d="M160 122 V150" stroke="#a8a396" strokeDasharray="3 4" />
          <rect x="85" y="150" width="150" height="40" rx="10" fill="#fffdf8" stroke="#1b1a17" strokeWidth="1.8" />
          <text x="100" y="175" fontSize="14" fontWeight="800" fill="#1b1a17">
            {version || "v1.0"}
          </text>
          <text x="222" y="175" textAnchor="end" fontSize="11" fill="#6d695f">
            {(vname || "First release").slice(0, 16)}
          </text>
        </g>
        {people.slice(0, 6).map((p, i) => (
          <g key={p} className="ob-pop" transform={`translate(${160 - (Math.min(people.length, 6) * 26) / 2 + i * 26 + 13} 222)`}>
            <circle r="12" fill={PERSON_COLORS[i % PERSON_COLORS.length]} stroke="#1b1a17" strokeWidth="1.5" />
            <text y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fffdf8">
              {p[0]?.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <p className="ob-cap">This is your product map. It grows with every version you ship.</p>
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { me } = useMe();
  const user = me?.user;
  const pendingWs = me?.workspaces.find((w) => w.isOwner && !w.onboarded);
  const wsQ = useWorkspace(pendingWs?.id);
  const ws = wsQ.data;

  const [step, setStep] = useState<StepId>("workspace");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [size, setSize] = useState("2–5");
  const [you, setYou] = useState("Product manager");
  const [product, setProduct] = useState("");
  const [mode, setMode] = useState<Mode>("empty");
  const [modules, setModules] = useState<string[]>(["Payments", "Auth", "Dashboard"]);
  const [custom, setCustom] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [vname, setVname] = useState("First release");
  const [date, setDate] = useState(() => inWeeks(6));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Onboarding needs a workspace whose plan is chosen. Signed out → log in and come back;
  // no plan yet → choose one (never a silent Free plan); everything set up → the map.
  // While finishing, the workspace turns "onboarded" before we navigate: don't redirect then.
  const finishing = useRef(false);
  useEffect(() => {
    if (me === undefined || finishing.current) return;
    if (me === null) router.replace("/login?next=/onboarding");
    else if (!pendingWs) router.replace(nextPath(me));
  }, [me, pendingWs, router]);

  const invited = ws ? ws.invites.map((i) => i.email) : [];
  if (wsQ.error && !ws)
    return (
      <div className="boot center">
        <div className="load-error">
          <strong>We couldn&apos;t load your workspace</strong>
          <p>{wsQ.error.message}</p>
          <button type="button" className="btn-ink" onClick={() => void wsQ.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!user || !ws) return <div className="boot" aria-busy="true" />;

  const effSlug = slugTouched ? slug : slugify(name);
  const idx = STEPS.indexOf(step);
  const shellStep = step === "workspace" ? 2 : step === "team" ? 4 : step === "done" ? 5 : 3;
  const flow = mode === "sample" ? STEPS.filter((s) => s !== "modules" && s !== "version") : [...STEPS];
  const go = (dir: 1 | -1) => {
    setTried(false);
    const i = flow.indexOf(step);
    setStep(flow[Math.max(0, Math.min(flow.length - 1, i + dir))]);
  };

  const finish = async () => {
    setBusy(true);
    setServerError(null);
    finishing.current = true;
    try {
      await onboard(ws.id, {
        name: name.trim(),
        slug: effSlug,
        teamSize: size,
        title: you,
        productName: product.trim(),
        mode,
        modules,
        release: mode === "empty" ? { version, name: vname, date } : undefined,
      });
      try {
        sessionStorage.setItem("zelo-welcome", `Welcome to ${name || "your workspace"}, ${user.name.split(" ")[0]}`);
      } catch {
        // fine without the toast
      }
      router.push("/app");
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.field === "slug") {
        setSlugError(err.message);
        setStep("workspace");
      } else setServerError(err?.message ?? "Couldn't finish setup. Try again.");
      finishing.current = false;
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (step === "workspace" && (!name.trim() || effSlug.length < 2)) return;
    if (step === "product" && !product.trim()) return;
    if (step === "modules" && !modules.length) return;
    if (step === "version" && !version.trim()) return;
    if (step === "workspace") {
      // Reserve the name and URL now, so a taken URL is caught on this step.
      setBusy(true);
      try {
        await updateWorkspace(ws.id, { name: name.trim(), slug: effSlug, teamSize: size });
        setSlugError(null);
      } catch (err) {
        setBusy(false);
        if (err instanceof ApiError && (err.field === "slug" || err.status === 409)) return setSlugError(err.message);
        return setServerError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
      }
      setBusy(false);
    }
    go(1);
  };

  const toggle = (m: string) => setModules((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  const addCustom = () => {
    const m = custom.trim();
    if (m && !modules.some((x) => x.toLowerCase() === m.toLowerCase())) setModules((x) => [...x, m]);
    setCustom("");
  };

  return (
    <AuthShell
      step={shellStep}
      aside={<Preview ws={effSlug} product={product} modules={modules} version={version} vname={vname} people={[user.name, ...invited]} mode={mode} />}
    >
      <form className="form ob" onSubmit={submit} noValidate key={step}>
        {step === "workspace" && (
          <>
            <p className="eyebrow">Step 1 of {flow.length - 1}</p>
            <h1>Name your workspace</h1>
            <p className="lede">Usually your company or team. Everyone you invite joins it.</p>
            <Field label="Workspace name" error={tried && !name.trim() ? "Give it a name." : undefined}>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
            </Field>
            <Field label="Workspace URL" hint="Your team signs in here." error={slugError ?? (tried && effSlug.length < 2 ? "At least 2 letters or numbers." : undefined)}>
              <span className="url-input">
                <span>zelo.app/</span>
                <input
                  value={effSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlugError(null);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="acme"
                />
              </span>
            </Field>
            <div className="field">
              <span className="field-label">How big is your team?</span>
              <div className="choice-row">
                {SIZES.map((s) => (
                  <button key={s} type="button" className={`choice ${size === s ? "on" : ""}`} onClick={() => setSize(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">What do you do?</span>
              <div className="choice-row">
                {ROLES_OF_YOU.map((s) => (
                  <button key={s} type="button" className={`choice ${you === s ? "on" : ""}`} onClick={() => setYou(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === "product" && (
          <>
            <p className="eyebrow">Step 2 of {flow.length - 1}</p>
            <h1>What are you building?</h1>
            <p className="lede">Your first product. You can add more later on Business.</p>
            <Field label="Product name" error={tried && !product.trim() ? "Name your product." : undefined}>
              <input autoFocus value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Acme Store" />
            </Field>
            <div className="field">
              <span className="field-label">How do you want to start?</span>
              <div className="start-modes">
                <button type="button" className={`mode ${mode === "empty" ? "on" : ""}`} onClick={() => setMode("empty")}>
                  <strong>Start fresh</strong>
                  <small>Set up your modules and first version. Recommended.</small>
                </button>
                <button type="button" className={`mode ${mode === "sample" ? "on" : ""}`} onClick={() => setMode("sample")}>
                  <strong>Explore with sample data</strong>
                  <small>A store with 5 versions, tickets and bugs to click around.</small>
                </button>
                <button type="button" className="mode" disabled>
                  <strong>
                    Import from Jira <span className="soon">Soon</span>
                  </strong>
                  <small>Bring your history in and see it as a tree.</small>
                </button>
              </div>
            </div>
          </>
        )}

        {step === "modules" && (
          <>
            <p className="eyebrow">Step 3 of {flow.length - 1}</p>
            <h1>What are the big parts of it?</h1>
            <p className="lede">Modules are the lasting areas of your product. Every feature lives in one. A Miscellaneous module is added for odd jobs.</p>
            <div className="choice-row wrap">
              {[...new Set([...MODULE_SUGGESTIONS, ...modules])].map((m) => (
                <button key={m} type="button" className={`choice ${modules.includes(m) ? "on" : ""}`} onClick={() => toggle(m)} aria-pressed={modules.includes(m)}>
                  {modules.includes(m) ? "✓ " : "+ "}
                  {m}
                </button>
              ))}
            </div>
            <div className="add-row">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Add your own, e.g. Checkout"
                aria-label="Custom module"
              />
              <button type="button" className="btn-ghost" onClick={addCustom} disabled={!custom.trim()}>
                Add
              </button>
            </div>
            {tried && !modules.length && <p className="field-error">Pick at least one module.</p>}
          </>
        )}

        {step === "version" && (
          <>
            <p className="eyebrow">Step 4 of {flow.length - 1}</p>
            <h1>What are you shipping next?</h1>
            <p className="lede">Your first version on the tree. Features and tickets go under it.</p>
            <div className="form-row">
              <Field label="Version" error={tried && !version.trim() ? "Add a version number." : undefined}>
                <input autoFocus value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0" />
              </Field>
              <Field label="Target date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Name" hint="A short theme, like “Launch” or “Self-serve”.">
              <input value={vname} onChange={(e) => setVname(e.target.value)} placeholder="Launch" />
            </Field>
          </>
        )}

        {step === "team" && (
          <>
            <p className="eyebrow">Step {flow.length - 1} of {flow.length - 1}</p>
            <h1>Bring your team in</h1>
            <p className="lede">They get an email with a link to join {name || "your workspace"}. You can do this later from Members.</p>
            <InviteForm ws={ws} />
            <DemoNote>Emails go out when an email provider is set up. Until then, “View email” shows exactly what was sent, and “Copy link” works anywhere.</DemoNote>
          </>
        )}

        {step === "done" && (
          <div className="ob-done">
            <span className="paid-check" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" />
                <path d="M15 27l7 7 15-16" />
              </svg>
            </span>
            <h1>{name || "Your workspace"} is ready</h1>
            <ul className="ob-summary">
              <li>
                <b>{product}</b> {mode === "sample" ? "with sample data" : `with ${modules.length} module${modules.length === 1 ? "" : "s"}`}
              </li>
              {mode === "empty" && (
                <li>
                  First version <b>{version}</b> · {vname}
                </li>
              )}
              <li>{invited.length ? `${invited.length} invite${invited.length === 1 ? "" : "s"} sent` : "Just you for now"}</li>
            </ul>
            {serverError && <p className="form-error">{serverError}</p>}
            <button type="button" className="btn-ink wide big" onClick={() => void finish()} disabled={busy}>
              {busy && <span className="spin" aria-hidden="true" />}
              Open your product map →
            </button>
          </div>
        )}

        {step !== "done" && (
          <div className="ob-nav">
            {idx > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => go(-1)}>
                ← Back
              </button>
            ) : (
              <span />
            )}
            <span className="ob-right">
              {step === "team" && (
                <button type="button" className="link-btn" onClick={() => go(1)}>
                  Skip for now
                </button>
              )}
              <button type="submit" className="btn-ink" disabled={busy}>
                {step === "team" ? "Continue" : "Next"}
              </button>
            </span>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
