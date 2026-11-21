import type { Activity, Bug, Feature, Graph, Status, Ticket } from "./model";

const B = "p-bhumika";
const S = "p-shashvat";

type F = {
  id: string;
  name: string;
  module: string;
  release: string;
  owner: string | null;
  extendsId?: string;
  spec: string;
  tickets: [
    title: string,
    assignee: string | null,
    status: Status,
    points: number,
  ][];
};

const MODULE_KEY: Record<string, string> = {
  pay: "PAY",
  auth: "AUTH",
  dash: "DASH",
  ui: "UI",
  note: "NOTE",
  misc: "MISC",
};

const FEATURES: F[] = [
  // v1.0 · Launch
  {
    id: "f-cards",
    name: "Cards",
    module: "pay",
    release: "r10",
    owner: B,
    spec: "Accept card payments at checkout with saved receipts.",
    tickets: [
      ["Card form", S, "done", 3],
      ["Payment API", S, "done", 5],
      ["Receipts email", B, "done", 2],
    ],
  },
  {
    id: "f-email-login",
    name: "Email login",
    module: "auth",
    release: "r10",
    owner: S,
    spec: "Sign up and log in with email and password.",
    tickets: [
      ["Sign-up flow", S, "done", 3],
      ["Password reset", S, "done", 2],
    ],
  },
  {
    id: "f-overview",
    name: "Overview",
    module: "dash",
    release: "r10",
    owner: B,
    spec: "A dashboard home with today's orders and revenue.",
    tickets: [
      ["Revenue cards", S, "done", 3],
      ["Orders table", B, "done", 3],
    ],
  },
  {
    id: "f-design-system",
    name: "Design system",
    module: "ui",
    release: "r10",
    owner: B,
    spec: "Shared colours, type and components for every screen.",
    tickets: [
      ["Colour tokens", B, "done", 2],
      ["Buttons and inputs", S, "done", 3],
      ["Layout grid", B, "done", 2],
    ],
  },
  // v1.4
  {
    id: "f-upi",
    name: "UPI payments",
    module: "pay",
    release: "r14",
    owner: B,
    extendsId: "f-cards",
    spec: "Pay with UPI apps alongside cards.",
    tickets: [
      ["UPI intent flow", S, "done", 5],
      ["Payment status polling", S, "done", 3],
    ],
  },
  {
    id: "f-filters",
    name: "Filters",
    module: "dash",
    release: "r14",
    owner: S,
    extendsId: "f-overview",
    spec: "Filter orders by date, status and amount.",
    tickets: [
      ["Date range picker", S, "done", 3],
      ["Saved filters", B, "done", 2],
    ],
  },
  {
    id: "f-onboarding",
    name: "Onboarding",
    module: "ui",
    release: "r14",
    owner: B,
    extendsId: "f-design-system",
    spec: "A three-step setup for new stores.",
    tickets: [
      ["Welcome steps", B, "done", 3],
      ["Sample data", S, "done", 2],
    ],
  },
  {
    id: "f-email-alerts",
    name: "Email alerts",
    module: "note",
    release: "r14",
    owner: S,
    spec: "Email the owner about new orders and failed payments.",
    tickets: [
      ["Alert templates", B, "done", 2],
      ["Send queue", S, "done", 3],
    ],
  },
  // v2.0
  {
    id: "f-invoices",
    name: "Invoices",
    module: "pay",
    release: "r20",
    owner: B,
    extendsId: "f-cards",
    spec: "Generate GST-ready invoices for every order.",
    tickets: [
      ["Invoice PDF", S, "done", 5],
      ["Tax rules", B, "done", 3],
      ["Invoice numbering", S, "done", 2],
    ],
  },
  {
    id: "f-google-sso",
    name: "Google SSO",
    module: "auth",
    release: "r20",
    owner: S,
    extendsId: "f-email-login",
    spec: "Log in with Google.",
    tickets: [
      ["OAuth flow", S, "done", 3],
      ["Account linking", S, "done", 3],
    ],
  },
  {
    id: "f-mobile-web",
    name: "Mobile web",
    module: "ui",
    release: "r20",
    owner: B,
    extendsId: "f-design-system",
    spec: "Every screen works well on phones.",
    tickets: [
      ["Responsive layouts", S, "done", 5],
      ["Touch targets", B, "done", 2],
    ],
  },
  {
    id: "f-push",
    name: "Push notifications",
    module: "note",
    release: "r20",
    owner: S,
    extendsId: "f-email-alerts",
    spec: "Push alerts to the mobile web app.",
    tickets: [
      ["Service worker", S, "done", 3],
      ["Opt-in prompt", B, "done", 2],
    ],
  },
  // v2.3 · current
  {
    id: "f-refunds",
    name: "Refunds",
    module: "pay",
    release: "r23",
    owner: B,
    extendsId: "f-invoices",
    spec: "Customers refund an order or one item from the order page, without contacting support. Webhook retries 3 times, then flags the order.",
    tickets: [
      ["API endpoint", S, "done", 3],
      ["Refund UI", B, "qa", 5],
      ["Webhook", S, "dev", 5],
    ],
  },
  {
    id: "f-otp",
    name: "OTP login",
    module: "auth",
    release: "r23",
    owner: S,
    extendsId: "f-email-login",
    spec: "Log in with a one-time code sent by SMS.",
    tickets: [
      ["SMS provider", S, "done", 2],
      ["OTP screen", S, "dev", 3],
    ],
  },
  {
    id: "f-export",
    name: "Export CSV",
    module: "dash",
    release: "r23",
    owner: B,
    extendsId: "f-filters",
    spec: "Export the filtered orders as CSV.",
    tickets: [
      ["CSV builder", S, "done", 3],
      ["Download button", B, "done", 1],
    ],
  },
  {
    id: "f-dark",
    name: "Dark mode",
    module: "ui",
    release: "r23",
    owner: B,
    extendsId: "f-design-system",
    spec: "A dark theme that follows the system setting.",
    tickets: [
      ["Color tokens", B, "done", 2],
      ["Theme toggle", S, "qa", 3],
      ["Audit screens", null, "todo", 5],
    ],
  },
  // v2.4 · planned
  {
    id: "f-saved-cards",
    name: "Saved cards",
    module: "pay",
    release: "r24",
    owner: B,
    extendsId: "f-cards",
    spec: "Customers save a card for one-tap checkout.",
    tickets: [
      ["Card vault", S, "todo", 5],
      ["Manage cards screen", B, "todo", 3],
    ],
  },
  {
    id: "f-team-sso",
    name: "SSO for teams",
    module: "auth",
    release: "r24",
    owner: S,
    extendsId: "f-google-sso",
    spec: "SAML single sign-on for business accounts.",
    tickets: [
      ["SAML config", S, "todo", 5],
      ["Domain verification", S, "todo", 3],
    ],
  },
  {
    id: "f-search",
    name: "Search",
    module: "dash",
    release: "r24",
    owner: B,
    extendsId: "f-filters",
    spec: "Search orders by customer, phone or order ID.",
    tickets: [
      ["Search index", S, "todo", 5],
      ["Search bar", B, "todo", 2],
    ],
  },
  {
    id: "f-digest",
    name: "Daily digest",
    module: "note",
    release: "r24",
    owner: S,
    extendsId: "f-email-alerts",
    spec: "One morning email with yesterday's numbers.",
    tickets: [
      ["Digest builder", S, "todo", 3],
      ["Schedule settings", B, "todo", 2],
    ],
  },
  // Miscellaneous: work with no feature of its own
  {
    id: "f-misc-20",
    name: "Ops & admin",
    module: "misc",
    release: "r20",
    owner: B,
    spec: "Work that doesn't belong to a feature: ops, admin and chores for this release.",
    tickets: [
      ["Renew SSL certificate", S, "done", 1],
      ["Update privacy policy", B, "done", 2],
    ],
  },
  {
    id: "f-misc-23",
    name: "Housekeeping",
    module: "misc",
    release: "r23",
    owner: B,
    extendsId: "f-misc-20",
    spec: "Work that doesn't belong to a feature: ops, admin and chores for this release.",
    tickets: [
      ["Rotate API keys", S, "done", 1],
      ["Investor demo script", B, "dev", 2],
      ["Clean up old feature flags", S, "todo", 2],
    ],
  },
  {
    id: "f-misc-24",
    name: "Housekeeping",
    module: "misc",
    release: "r24",
    owner: B,
    extendsId: "f-misc-23",
    spec: "Work that doesn't belong to a feature: ops, admin and chores for this release.",
    tickets: [["Hire a second developer", B, "todo", 3]],
  },
];

/** Working window per release: when its work was planned and built (all in the past for the demo). */
const WINDOW: Record<string, [string, string]> = {
  r10: ["2025-11-24", "2026-01-16"],
  r14: ["2026-02-09", "2026-04-10"],
  r20: ["2026-05-04", "2026-07-03"],
  r23: ["2026-09-21", "2026-11-21"],
  r24: ["2026-11-03", "2026-11-20"],
};
const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
/** Local-time ISO string (no zone) at a day offset, with a working-hours time picked from a seed. */
function stamp(base: number, seed: number) {
  const t = new Date(base);
  t.setUTCHours(9 + (seed % 9), (seed * 17) % 60, 0, 0);
  return t.toISOString().slice(0, 19);
}
const FLOW: Status[] = ["todo", "dev", "qa", "done"];

function build(): Graph {
  const counters: Record<string, number> = {};
  const nextKey = (moduleId: string) => {
    const k = MODULE_KEY[moduleId];
    counters[k] = (counters[k] ?? 100) + 1;
    return `${k}-${counters[k]}`;
  };
  const features: Feature[] = [];
  const tickets: Ticket[] = [];
  const activity: Activity[] = [];
  let n = 0;
  const log = (a: Omit<Activity, "id">) =>
    activity.push({ id: `a-${++n}`, ...a });

  /** Writes a believable history: created → assigned → each status move, spread over the window. */
  function history(
    kind: "ticket" | "bug",
    id: string,
    by: string | null,
    assignee: string | null,
    status: Status,
    start: number,
    end: number,
    seed: number,
  ) {
    const created = stamp(start, seed);
    log({ target: { kind, id }, actorId: by, at: created, kind: "created" });
    if (assignee && assignee !== by)
      log({
        target: { kind, id },
        actorId: by,
        at:
          created.slice(0, 14) +
          String((Number(created.slice(14, 16)) + 6) % 60).padStart(2, "0") +
          ":00",
        kind: "assignee",
        from: null,
        to: assignee,
      });
    const steps = FLOW.indexOf(status);
    for (let k = 1; k <= steps; k++) {
      const at = start + DAY + ((end - start - DAY) * k) / (steps + 1);
      log({
        target: { kind, id },
        actorId: assignee ?? by,
        at: stamp(at, seed + k * 3),
        kind: "status",
        from: FLOW[k - 1],
        to: FLOW[k],
      });
    }
    return created;
  }

  let fi = 0;
  for (const f of FEATURES) {
    const [ws, we] = WINDOW[f.release];
    const fStart = ms(ws) + (fi++ % 5) * DAY;
    features.push({
      id: f.id,
      key: nextKey(f.module),
      name: f.name,
      moduleId: `m-${f.module}`,
      releaseId: f.release,
      ownerId: f.owner,
      extendsId: f.extendsId,
      spec: f.spec,
      createdAt: stamp(fStart, fi),
      createdBy: f.owner,
    });
    f.tickets.forEach(([title, assignee, status, points], i) => {
      const id = `${f.id}-t${i + 1}`;
      const start = fStart + (i + 1) * DAY;
      const createdAt = history(
        "ticket",
        id,
        f.owner,
        assignee,
        status,
        start,
        ms(we),
        fi * 7 + i,
      );
      tickets.push({
        id,
        key: nextKey(f.module),
        title,
        featureId: f.id,
        assigneeId: assignee,
        status,
        points,
        createdAt,
        createdBy: f.owner,
      });
    });
  }
  const bugs: Bug[] = (
    [
      {
        id: "b-upi-timeout",
        key: "PAY-190",
        title: "UPI status times out",
        moduleId: "m-pay",
        releaseId: "r14",
        assigneeId: S,
        status: "done",
        severity: "high",
        introducedIn: "r14",
      },
      {
        id: "b-push-dupes",
        key: "NOTE-190",
        title: "Duplicate push alerts",
        moduleId: "m-note",
        releaseId: "r20",
        assigneeId: S,
        status: "done",
        severity: "medium",
        introducedIn: "r20",
      },
      {
        id: "b-double-charge",
        key: "PAY-191",
        title: "Double charge on retry",
        moduleId: "m-pay",
        releaseId: "r23",
        assigneeId: S,
        status: "dev",
        severity: "critical",
        introducedIn: "r20",
      },
      {
        id: "b-refund-round",
        key: "PAY-192",
        title: "Refund rounds down",
        moduleId: "m-pay",
        releaseId: "r23",
        assigneeId: B,
        status: "qa",
        severity: "high",
        introducedIn: "r23",
      },
      {
        id: "b-sso-loop",
        key: "AUTH-190",
        title: "SSO redirect loop",
        moduleId: "m-auth",
        releaseId: "r23",
        assigneeId: null,
        status: "todo",
        severity: "medium",
        introducedIn: "r20",
      },
      {
        id: "b-csv-encoding",
        key: "DASH-190",
        title: "CSV breaks on emoji",
        moduleId: "m-dash",
        releaseId: "r23",
        assigneeId: S,
        status: "done",
        severity: "low",
        introducedIn: "r23",
      },
    ] as Omit<Bug, "createdAt" | "createdBy">[]
  ).map((b, i) => {
    const [ws, we] = WINDOW[b.releaseId];
    const by = i % 2 ? S : B;
    const start = ms(ws) + (12 + i * 3) * DAY;
    const createdAt = history(
      "bug",
      b.id,
      by,
      b.assigneeId,
      b.status,
      start,
      ms(we),
      40 + i * 5,
    );
    return { ...b, createdAt, createdBy: by };
  });
  return {
    product: { id: "prod", name: "Acme Store" },
    people: [
      {
        id: B,
        name: "Bhumika Saxena",
        role: "Product manager",
        color: "var(--coral)",
      },
      {
        id: S,
        name: "Shashvat Singh",
        role: "Developer",
        color: "var(--blue)",
      },
    ],
    modules: [
      { id: "m-pay", name: "Payments", color: "#e5582b" },
      { id: "m-auth", name: "Auth", color: "#3866c9" },
      { id: "m-dash", name: "Dashboard", color: "#2f8f46" },
      { id: "m-ui", name: "App UI", color: "#d48a1c" },
      { id: "m-note", name: "Notifications", color: "#1f8a8a" },
      { id: "m-misc", name: "Miscellaneous", color: "#7a7365", misc: true },
    ],
    releases: [
      {
        id: "r10",
        version: "v1.0",
        name: "Launch",
        date: "2026-01-20",
        state: "shipped",
      },
      {
        id: "r14",
        version: "v1.4",
        name: "Pay your way",
        date: "2026-04-14",
        state: "shipped",
      },
      {
        id: "r20",
        version: "v2.0",
        name: "Grow up",
        date: "2026-07-08",
        state: "shipped",
      },
      {
        id: "r23",
        version: "v2.3",
        name: "Self-serve",
        date: "2026-12-12",
        state: "current",
      },
      {
        id: "r24",
        version: "v2.4",
        name: "Teams",
        date: "2027-02-20",
        state: "planned",
      },
    ],
    features,
    tickets,
    bugs,
    comments: [
      {
        id: "c-1",
        target: { kind: "ticket", id: "f-refunds-t2" },
        authorId: S,
        body: "@Bhumika Saxena refunding one item needs a partial amount field on the order page. OK to add it here?",
        createdAt: "2026-11-18T10:24:00",
        attachments: [],
      },
      {
        id: "c-2",
        target: { kind: "ticket", id: "f-refunds-t2" },
        authorId: B,
        body: "Yes, add it. Cap it at the item price. @Shashvat Singh the webhook must send the partial amount too.",
        createdAt: "2026-11-18T11:02:00",
        attachments: [],
      },
      {
        id: "c-3",
        target: { kind: "feature", id: "f-dark" },
        authorId: B,
        body: "Audit screens is still unassigned. Who can take it this week?",
        createdAt: "2026-11-20T16:40:00",
        attachments: [],
      },
      {
        id: "c-4",
        target: { kind: "ticket", id: "f-misc-23-t2" },
        authorId: S,
        body: "Added the latest numbers from the dashboard to the demo. Refund flow is ready to show once QA passes.",
        createdAt: "2026-11-21T18:05:00",
        attachments: [],
      },
      {
        id: "c-5",
        target: { kind: "ticket", id: "f-otp-t2" },
        authorId: B,
        body: "Resend code should wait 30 seconds. Copy for the error state is in the spec.",
        createdAt: "2026-11-21T12:30:00",
        attachments: [],
      },
    ],
    activity: [
      ...activity,
      // A recent hand-off, so the demo has a fresh "assigned to you"
      {
        id: "a-handoff",
        target: { kind: "ticket" as const, id: "f-saved-cards-t2" },
        actorId: S,
        at: "2026-11-20T15:12:00",
        kind: "assignee" as const,
        from: S,
        to: B,
      },
    ].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export const SEED: Graph = build();
