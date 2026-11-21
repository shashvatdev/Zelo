import { STATUS_LABEL, type Graph, type Release } from "@/data/model";
import {
  bugsIn,
  featuresIn,
  lineage,
  openBugs,
  pct,
  personTickets,
  progressOf,
  releaseProgress,
  ticketsOf,
} from "./graph";
import type { Scope, Selected } from "./store";

/**
 * Ask Zelo, demo engine: answers come from the board data in the browser, by matching the question
 * to an intent. The real product sends the same graph context to Claude on the server; the answer
 * shape (text + linked cards) stays the same so the UI does not change.
 */

export type AnswerItem = {
  label: string;
  sub: string;
  tone?: "ok" | "warn" | "bad" | "muted";
  go: { scope: Scope; selected: Selected };
};
export type Answer = { text: string; items: AnswerItem[] };

export const SUGGESTIONS = [
  "What is blocking v2.3?",
  "What is Shashvat working on?",
  "Show open bugs",
  "What is unassigned?",
  "History of Payments",
  "What changed from v2.0 to v2.3?",
  "Recent activity",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.\s]/g, " ");

function findRelease(g: Graph, q: string, scope: Scope): Release | undefined {
  const all = [...g.releases].sort(
    (a, b) => b.version.length - a.version.length,
  );
  return (
    all.find(
      (r) =>
        q.includes(r.version.toLowerCase()) || q.includes(r.name.toLowerCase()),
    ) ??
    g.releases.find((r) => r.id === scope) ??
    g.releases.find((r) => r.state === "current")
  );
}

const ticketItem = (g: Graph, id: string): AnswerItem => {
  const t = g.tickets.find((x) => x.id === id)!;
  const f = g.features.find((x) => x.id === t.featureId)!;
  const who =
    g.people.find((p) => p.id === t.assigneeId)?.name.split(" ")[0] ??
    "Unassigned";
  return {
    label: t.title,
    sub: `${t.key} · ${f.name} · ${STATUS_LABEL[t.status]} · ${who}`,
    tone:
      t.status === "done"
        ? "ok"
        : t.assigneeId
          ? t.status === "todo"
            ? "muted"
            : "warn"
          : "bad",
    go: { scope: f.releaseId, selected: { kind: "ticket", id: t.id } },
  };
};

const bugItem = (g: Graph, id: string): AnswerItem => {
  const b = g.bugs.find((x) => x.id === id)!;
  const m = g.modules.find((x) => x.id === b.moduleId)!;
  return {
    label: b.title,
    sub: `${b.key} · ${m.name} · ${b.severity} · ${STATUS_LABEL[b.status]}`,
    tone: b.severity === "critical" || b.severity === "high" ? "bad" : "warn",
    go: { scope: b.releaseId, selected: { kind: "bug", id: b.id } },
  };
};

export function ask(g: Graph, question: string, scope: Scope): Answer {
  const q = norm(question);
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  const person = g.people.find((p) =>
    p.name
      .toLowerCase()
      .split(" ")
      .some((n) => q.includes(n)),
  );
  const mod = g.modules.find(
    (m) =>
      q.includes(m.name.toLowerCase()) ||
      (m.misc && has("misc", "chore", "housekeeping")),
  );
  const feature = [...g.features]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (f) =>
        q.includes(f.name.toLowerCase()) &&
        !g.modules.find((m) => m.id === f.moduleId)?.misc,
    );

  // Compare two versions
  const versions = g.releases.filter((r) =>
    q.includes(r.version.toLowerCase()),
  );
  if (
    versions.length >= 2 ||
    (has("changed", "compare", "difference", "diff") && versions.length)
  ) {
    const [a, b] =
      versions.length >= 2
        ? [...versions].sort((x, y) => x.date.localeCompare(y.date))
        : [g.releases.find((r) => r.state === "shipped")!, versions[0]];
    const between = g.releases
      .filter((r) => r.date > a.date && r.date <= b.date)
      .sort((x, y) => x.date.localeCompare(y.date));
    const feats = between.flatMap((r) => featuresIn(g, r.id));
    return {
      text: `From **${a.version}** to **${b.version}** the product shipped ${between.length} release${between.length === 1 ? "" : "s"} with **${feats.length} features**. Each one below links to its spot in the tree.`,
      items: feats.map((f) => {
        const r = g.releases.find((x) => x.id === f.releaseId)!;
        const parent = g.features.find((x) => x.id === f.extendsId);
        return {
          label: f.name,
          sub: `${r.version} · ${g.modules.find((m) => m.id === f.moduleId)!.name}${parent ? ` · builds on ${parent.name}` : " · new"}`,
          tone: "muted",
          go: { scope: r.id, selected: { kind: "feature", id: f.id } },
        };
      }),
    };
  }

  // Recent activity, optionally for one person
  if (
    has(
      "recent",
      "activity",
      "today",
      "this week",
      "yesterday",
      "updates",
      "log",
      "history of work",
      "did ",
    )
  ) {
    const weekAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const list = [...g.activity]
      .filter(
        (a) =>
          (!person || a.actorId === person.id) &&
          (has("today", "week", "yesterday")
            ? a.at.slice(0, 10) >= weekAgo
            : true),
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10);
    const name = (id: string | null | undefined) =>
      g.people.find((p) => p.id === id)?.name.split(" ")[0] ?? "Someone";
    return {
      text: list.length
        ? `Latest ${list.length} update${list.length === 1 ? "" : "s"}${person ? ` by **${person.name}**` : ""}, newest first. Every change is logged with its date.`
        : `No updates${person ? ` by ${person.name}` : ""} in that period.`,
      items: list.map((a) => {
        const t =
          a.target.kind === "ticket"
            ? g.tickets.find((x) => x.id === a.target.id)
            : undefined;
        const b =
          a.target.kind === "bug"
            ? g.bugs.find((x) => x.id === a.target.id)
            : undefined;
        const f = t ? g.features.find((x) => x.id === t.featureId) : undefined;
        const title = t?.title ?? b?.title ?? "Item";
        const when = new Date(a.at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const verb =
          a.kind === "created"
            ? "created it"
            : a.kind === "status"
              ? `moved it to ${STATUS_LABEL[a.to as keyof typeof STATUS_LABEL]}`
              : a.to
                ? `assigned it to ${name(a.to)}`
                : "unassigned it";
        return {
          label: title,
          sub: `${name(a.actorId)} ${verb} · ${when}`,
          tone: a.kind === "status" && a.to === "done" ? "ok" : "muted",
          go: {
            scope: f?.releaseId ?? b?.releaseId ?? scope,
            selected: { kind: a.target.kind, id: a.target.id },
          },
        } as AnswerItem;
      }),
    };
  }

  // A person's work
  if (person && !has("history")) {
    const r = has("all", "ever", "overall")
      ? undefined
      : findRelease(g, q, scope);
    const mine = personTickets(g, person.id, r?.id);
    const open = mine.filter((t) => t.status !== "done");
    const bugs = openBugs(
      g.bugs.filter(
        (b) => b.assigneeId === person.id && (!r || b.releaseId === r.id),
      ),
    );
    const p = progressOf(mine);
    return {
      text: `**${person.name}** has ${open.length} open ticket${open.length === 1 ? "" : "s"}${r ? ` in **${r.version}**` : ""} and ${bugs.length} open bug${bugs.length === 1 ? "" : "s"}. ${p.done} of ${p.total} assigned tickets are done (${pct(p)}%).`,
      items: [
        ...open.map((t) => ticketItem(g, t.id)),
        ...bugs.map((b) => bugItem(g, b.id)),
      ],
    };
  }

  if (has("bug")) {
    const r = versions[0];
    const list = openBugs(r ? bugsIn(g, r.id) : g.bugs).sort(
      (a, b) =>
        ["critical", "high", "medium", "low"].indexOf(a.severity) -
        ["critical", "high", "medium", "low"].indexOf(b.severity),
    );
    const crit = list.filter((b) => b.severity === "critical").length;
    return {
      text: list.length
        ? `There ${list.length === 1 ? "is" : "are"} **${list.length} open bug${list.length === 1 ? "" : "s"}**${r ? ` in ${r.version}` : ""}${crit ? `, ${crit} critical` : ""}. Most severe first.`
        : "No open bugs. Nice.",
      items: list.map((b) => bugItem(g, b.id)),
    };
  }

  if (has("unassigned", "nobody", "no owner", "no one")) {
    const list = g.tickets.filter((t) => !t.assigneeId && t.status !== "done");
    const bugs = openBugs(g.bugs.filter((b) => !b.assigneeId));
    return {
      text:
        list.length + bugs.length
          ? `**${list.length + bugs.length} item${list.length + bugs.length === 1 ? "" : "s"}** have no owner. Assign them before they slip.`
          : "Everything open has an owner.",
      items: [
        ...list.map((t) => ticketItem(g, t.id)),
        ...bugs.map((b) => bugItem(g, b.id)),
      ],
    };
  }

  // A feature
  if (feature) {
    const t = ticketsOf(g, feature.id);
    const p = progressOf(t);
    const chain = lineage(g, feature);
    const r = g.releases.find((x) => x.id === feature.releaseId)!;
    return {
      text: `**${feature.name}** (${r.version}) is ${pct(p)}% done: ${p.done} of ${p.total} tickets. ${chain.length > 1 ? `It is part of a chain of ${chain.length} versions: ${chain.map((c) => c.name).join(" → ")}.` : "It is the first version of this feature."}`,
      items: [
        {
          label: feature.name,
          sub: `${feature.key} · open the feature`,
          tone: "muted",
          go: { scope: r.id, selected: { kind: "feature", id: feature.id } },
        },
        ...t.filter((x) => x.status !== "done").map((x) => ticketItem(g, x.id)),
      ],
    };
  }

  // A module's history
  if (mod) {
    const list = [...g.features]
      .filter((f) => f.moduleId === mod.id)
      .sort((a, b) =>
        g.releases
          .find((r) => r.id === a.releaseId)!
          .date.localeCompare(
            g.releases.find((r) => r.id === b.releaseId)!.date,
          ),
      );
    return {
      text: `**${mod.name}** has had ${list.length} feature${list.length === 1 ? "" : "s"} across ${new Set(list.map((f) => f.releaseId)).size} versions, and ${g.bugs.filter((b) => b.moduleId === mod.id).length} bugs reported. Oldest first.`,
      items: list.map((f) => {
        const r = g.releases.find((x) => x.id === f.releaseId)!;
        const p = progressOf(ticketsOf(g, f.id));
        return {
          label: `${r.version} · ${f.name}`,
          sub: `${p.done}/${p.total} tickets · ${r.state}`,
          tone: pct(p) === 100 ? "ok" : "muted",
          go: { scope: r.id, selected: { kind: "feature", id: f.id } },
        };
      }),
    };
  }

  // Release status / blockers (default for "status", "blocking", "risk", "left", a version, or anything else)
  const r = findRelease(g, q, scope);
  if (
    r &&
    (has(
      "block",
      "risk",
      "left",
      "status",
      "ship",
      "late",
      "on track",
      "progress",
      "stuck",
    ) ||
      versions.length)
  ) {
    const p = releaseProgress(g, r.id);
    const ids = new Set(featuresIn(g, r.id).map((f) => f.id));
    const open = g.tickets
      .filter((t) => ids.has(t.featureId) && t.status !== "done")
      .sort(
        (a, b) =>
          ["todo", "dev", "qa"].indexOf(a.status) -
          ["todo", "dev", "qa"].indexOf(b.status),
      );
    const unassigned = open.filter((t) => !t.assigneeId).length;
    const bugs = openBugs(bugsIn(g, r.id)).filter(
      (b) => b.severity === "critical" || b.severity === "high",
    );
    const parts = [
      `**${r.version} · ${r.name}** is ${pct(p)}% done (${p.done}/${p.total} tickets).`,
    ];
    if (bugs.length)
      parts.push(
        `${bugs.length} serious bug${bugs.length === 1 ? "" : "s"} still open.`,
      );
    if (unassigned)
      parts.push(
        `${unassigned} ticket${unassigned === 1 ? " has" : "s have"} no owner.`,
      );
    if (!open.length && !bugs.length) parts.push("Nothing is blocking it.");
    else parts.push("Here is what stands between it and shipping:");
    return {
      text: parts.join(" "),
      items: [
        ...bugs.map((b) => bugItem(g, b.id)),
        ...open.map((t) => ticketItem(g, t.id)),
      ],
    };
  }

  return {
    text: "I can answer questions about this board: what is blocking a version, what someone is working on, open bugs, unassigned work, a module's history, or what changed between two versions. Try one of these:",
    items: [],
  };
}
