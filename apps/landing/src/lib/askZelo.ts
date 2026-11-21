/**
 * The "Ask Zelo" demo: a sample release, a small intent matcher (English and Hinglish),
 * and answers computed from the data and returned as a flowchart tree.
 * It is a scripted demo on sample data, not a language model.
 */

export type Status = "todo" | "dev" | "qa" | "done";
export type Tone = "ink" | "done" | "qa" | "dev" | "todo" | "coral" | "plain";

type Ticket = {
  key: string;
  title: string;
  feature: string;
  owner: string | null;
  status: Status;
  points: number;
};

export const RELEASE = "Release v2.3";

export const PEOPLE = ["Shashvat Singh", "Bhumika Saxena"];

const TICKETS: Ticket[] = [
  {
    key: "PAY-140",
    title: "API endpoint",
    feature: "Refunds",
    owner: "Shashvat Singh",
    status: "done",
    points: 3,
  },
  {
    key: "PAY-141",
    title: "Refund UI",
    feature: "Refunds",
    owner: "Bhumika Saxena",
    status: "qa",
    points: 5,
  },
  {
    key: "PAY-142",
    title: "Webhook",
    feature: "Refunds",
    owner: "Shashvat Singh",
    status: "dev",
    points: 5,
  },
  {
    key: "AUTH-31",
    title: "SMS provider",
    feature: "OTP login",
    owner: "Shashvat Singh",
    status: "done",
    points: 2,
  },
  {
    key: "AUTH-32",
    title: "OTP screen",
    feature: "OTP login",
    owner: "Shashvat Singh",
    status: "dev",
    points: 3,
  },
  {
    key: "DASH-77",
    title: "CSV builder",
    feature: "Export CSV",
    owner: "Shashvat Singh",
    status: "done",
    points: 3,
  },
  {
    key: "DASH-78",
    title: "Download button",
    feature: "Export CSV",
    owner: "Bhumika Saxena",
    status: "done",
    points: 1,
  },
  {
    key: "UI-210",
    title: "Color tokens",
    feature: "Dark mode",
    owner: "Bhumika Saxena",
    status: "done",
    points: 2,
  },
  {
    key: "UI-211",
    title: "Theme toggle",
    feature: "Dark mode",
    owner: "Shashvat Singh",
    status: "qa",
    points: 3,
  },
  {
    key: "UI-212",
    title: "Audit screens",
    feature: "Dark mode",
    owner: null,
    status: "todo",
    points: 5,
  },
];

const FEATURES = ["Refunds", "OTP login", "Export CSV", "Dark mode"];

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  dev: "In dev",
  qa: "In QA",
  done: "Done",
};

export type FlowNode = {
  label: string;
  sub?: string;
  tone: Tone;
  children?: FlowNode[];
};
export type Answer = {
  kind: "scope" | "progress" | "person" | "blockers" | "help";
  summary: string;
  tree: FlowNode;
};

export const SUGGESTIONS = [
  "How much work is in v2.3?",
  "How much is done?",
  "What has Shashvat finished?",
  "How is Bhumika doing?",
  "What's blocking the release?",
];

const tk = (n: number) => `${n} ${n === 1 ? "ticket" : "tickets"}`;
const pt = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;
const sum = (ts: Ticket[]) => ts.reduce((s, t) => s + t.points, 0);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const first = (name: string) => name.split(" ")[0];

function scope(): Answer {
  const total = sum(TICKETS);
  const byFeature = FEATURES.map((f) => {
    const ts = TICKETS.filter((t) => t.feature === f);
    return { f, ts, pts: sum(ts) };
  });
  const biggest = [...byFeature].sort((a, b) => b.pts - a.pts)[0];
  return {
    kind: "scope",
    summary: `${RELEASE} has ${TICKETS.length} tickets worth ${total} points across ${FEATURES.length} features. ${biggest.f} is the biggest at ${biggest.pts} points.`,
    tree: {
      label: RELEASE,
      sub: `${tk(TICKETS.length)} · ${pt(total)}`,
      tone: "ink",
      children: byFeature.map(({ f, ts, pts }) => ({
        label: f,
        sub: `${tk(ts.length)} · ${pt(pts)}`,
        tone: f === biggest.f ? "coral" : "plain",
        children: ts.map((t) => ({
          label: t.title,
          sub: pt(t.points),
          tone: "plain" as Tone,
        })),
      })),
    },
  };
}

function progress(): Answer {
  const total = sum(TICKETS);
  const done = TICKETS.filter((t) => t.status === "done");
  const order: Status[] = ["done", "qa", "dev", "todo"];
  return {
    kind: "progress",
    summary: `${done.length} of ${TICKETS.length} tickets are done: ${sum(done)} of ${total} points (${pct(sum(done), total)}%). ${TICKETS.filter((t) => t.status === "qa").length} are in QA, and ${TICKETS.filter((t) => t.status !== "done").length} remain open.`,
    tree: {
      label: RELEASE,
      sub: `${pct(sum(done), total)}% done · ${sum(done)}/${total} pts`,
      tone: "ink",
      children: order.map((s) => {
        const ts = TICKETS.filter((t) => t.status === s);
        return {
          label: STATUS_LABEL[s],
          sub: `${tk(ts.length)} · ${pt(sum(ts))}`,
          tone: s,
          children: ts.map((t) => ({
            label: t.title,
            sub: t.feature,
            tone: s,
          })),
        };
      }),
    },
  };
}

function person(name: string): Answer {
  const mine = TICKETS.filter((t) => t.owner === name);
  const done = mine.filter((t) => t.status === "done");
  const open = mine.filter((t) => t.status !== "done");
  return {
    kind: "person",
    summary: `${name} owns ${mine.length} tickets (${sum(mine)} points) in ${RELEASE}. ${first(name)} has finished ${done.length} of them, ${sum(done)} points or ${pct(sum(done), sum(mine))}%, and has ${open.length} still open.`,
    tree: {
      label: name,
      sub: `${done.length}/${mine.length} done · ${sum(done)}/${sum(mine)} pts`,
      tone: "coral",
      children: [
        {
          label: "Finished",
          sub: `${tk(done.length)} · ${pt(sum(done))}`,
          tone: "done",
          children: done.map((t) => ({
            label: t.title,
            sub: t.feature,
            tone: "done" as Tone,
          })),
        },
        {
          label: "In progress",
          sub: `${tk(open.length)} · ${pt(sum(open))}`,
          tone: "dev",
          children: open.map((t) => ({
            label: t.title,
            sub: STATUS_LABEL[t.status],
            tone: t.status,
          })),
        },
      ],
    },
  };
}

function blockers(): Answer {
  return {
    kind: "blockers",
    summary:
      "Three things stand between v2.3 and shipping: Refunds waits on the Webhook ticket (in dev with Shashvat), Audit screens has no owner yet, and two tickets are waiting in QA.",
    tree: {
      label: RELEASE,
      sub: "3 risks",
      tone: "ink",
      children: [
        {
          label: "Refunds blocked",
          sub: "waits on 1 ticket",
          tone: "coral",
          children: [
            { label: "Webhook", sub: "In dev · Shashvat", tone: "dev" },
          ],
        },
        {
          label: "No owner",
          sub: "1 ticket · 5 pts",
          tone: "todo",
          children: [
            { label: "Audit screens", sub: "Dark mode", tone: "todo" },
          ],
        },
        {
          label: "Waiting in QA",
          sub: "2 tickets",
          tone: "qa",
          children: [
            { label: "Refund UI", sub: "Bhumika", tone: "qa" },
            { label: "Theme toggle", sub: "Shashvat", tone: "qa" },
          ],
        },
      ],
    },
  };
}

function help(): Answer {
  return {
    kind: "help",
    summary:
      "In this demo I can answer about the release's scope, its progress, what a person has done, and what is blocking it. Try one of the questions below.",
    tree: {
      label: "Ask Zelo",
      sub: "sample release",
      tone: "ink",
      children: [
        { label: "Scope", sub: "how much work", tone: "plain" },
        { label: "Progress", sub: "how much is done", tone: "plain" },
        { label: "People", sub: "who did what", tone: "plain" },
        { label: "Blockers", sub: "what is stuck", tone: "plain" },
      ],
    },
  };
}

/** Matches English and Hinglish phrasing to one of the demo's answers. */
export function ask(question: string): Answer {
  const q = question.toLowerCase();
  const who = PEOPLE.find((p) =>
    p
      .toLowerCase()
      .split(" ")
      .some((part) => q.includes(part)),
  );
  if (who) return person(who);
  if (/(block|stuck|atk|risk|rok|problem|delay|late|slip|issue)/.test(q))
    return blockers();
  if (
    /(done|finish|complete|progress|status|ho gay|hua|hue|hogaya|percent|%|baaki|baki|left|remaining|kitna bacha)/.test(
      q,
    )
  )
    return progress();
  if (
    /(scope|how much|how many|kitna|kitne|kaam|work|total|size|points|jae|jaye|jayega|jaega|tickets)/.test(
      q,
    )
  )
    return scope();
  return help();
}
