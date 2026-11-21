import type { SoundCue } from "@/lib/sound";

export type Status = "done" | "qa" | "dev" | "todo";

export const STATUS_LABEL: Record<Status, string> = {
  done: "Done",
  qa: "In QA",
  dev: "In dev",
  todo: "To do",
};

type TicketSpec = { title: string; status: Status };
type FeatureSpec = { name: string; module: string; tickets: TicketSpec[] };

const FEATURES: FeatureSpec[] = [
  {
    name: "Refunds",
    module: "Payments",
    tickets: [
      { title: "API endpoint", status: "done" },
      { title: "Refund UI", status: "qa" },
      { title: "Webhook", status: "dev" },
    ],
  },
  {
    name: "OTP login",
    module: "Auth",
    tickets: [
      { title: "SMS provider", status: "done" },
      { title: "OTP screen", status: "dev" },
    ],
  },
  {
    name: "Export CSV",
    module: "Dashboard",
    tickets: [
      { title: "CSV builder", status: "done" },
      { title: "Download button", status: "done" },
    ],
  },
  {
    name: "Dark mode",
    module: "App UI",
    tickets: [
      { title: "Color tokens", status: "done" },
      { title: "Theme toggle", status: "qa" },
      { title: "Audit screens", status: "todo" },
    ],
  },
];

export const LIST_ROWS = [
  {
    id: "TKT-4821",
    title: "Fix refund webhook retries",
    status: "In progress",
  },
  { id: "TKT-4822", title: "OTP screen copy changes", status: "Open" },
  { id: "TKT-4790", title: "Theme toggle (follow-up)", status: "Testing" },
  { id: "TKT-4835", title: "CSV download button", status: "Done" },
  { id: "TKT-4802", title: "Refund UI empty state", status: "Testing" },
  { id: "TKT-4841", title: "Audit all screens???", status: "Open" },
];

/** Seconds. Everything in the hero is timed off these so sound and motion stay in sync. */
export const T = {
  rowIn: 0.35,
  rowStep: 0.11,
  annotate: 2.5,
  listOut: 4.45,
  release: 4.8,
  edgeStart: 4.92,
  featureStart: 5.02,
  featureStep: 0.14,
  ticketStep: 0.08,
};

/**
 * The full-screen intro: each caption shows on screen while its voice line plays.
 * `clip` is the voiceover file index in /public/audio.
 */
export const INTRO_LINES = [
  { t: 0.2, clip: 0, text: "Every release starts as a list." },
  { t: 2.45, clip: 1, text: "But nobody knows what belongs where." },
  { t: 4.75, clip: 2, text: "So we turned the list into a map." },
  { t: 7.0, clip: 3, text: "Every ticket, connected." },
  { t: 10.4, clip: 4, text: "This is Zelo." },
];

/** When the intro window shrinks back into the page. */
export const INTRO_END = 11.6;

export type Layout = {
  w: number;
  h: number;
  compact: boolean;
  release: { x: number; y: number; w: number; h: number };
  features: {
    name: string;
    module: string;
    x: number;
    y: number;
    w: number;
    h: number;
    delay: number;
    edge: [number, number][];
    edgeDelay: number;
    done: number;
    total: number;
    tickets: {
      title: string;
      status: Status;
      x: number;
      y: number;
      w: number;
      h: number;
      delay: number;
      edge: [number, number][];
    }[];
  }[];
  list: { x: number; y: number; w: number; h: number; step: number };
  doc?: {
    x: number;
    y: number;
    w: number;
    h: number;
    edge: [number, number][];
    delay: number;
  };
  ai: {
    x: number;
    y: number;
    w: number;
    h: number;
    delay: number;
    text: string;
  };
  progressDelay: number;
  cursors: {
    name: string;
    role: string;
    x: number;
    y: number;
    sx: number;
    sy: number;
    delay: number;
    color: string;
  }[];
};

export function buildLayout(compact: boolean): Layout {
  const specs = compact ? FEATURES.slice(0, 2) : FEATURES;
  const w = compact ? 480 : 1200;
  const release = compact
    ? { x: 240, y: 62, w: 220, h: 62 }
    : { x: 600, y: 74, w: 250, h: 66 };
  const fy = compact ? 214 : 232;
  const fw = compact ? 210 : 232;
  const fh = 72;
  const xs = compact ? [125, 355] : [165, 455, 745, 1035];
  const busY = release.y + release.h / 2 + (compact ? 50 : 56);
  const tw = compact ? 180 : 200;
  const th = 46;
  const tGap = compact ? 58 : 62;

  let t = T.featureStart;
  const features: Layout["features"] = specs.map((f, i) => {
    const x = xs[i];
    const delay = T.featureStart + i * T.featureStep;
    return {
      ...f,
      x,
      y: fy,
      w: fw,
      h: fh,
      delay,
      edgeDelay: T.edgeStart + i * 0.05,
      edge: [
        [release.x, release.y + release.h / 2],
        [release.x, busY],
        [x, busY],
        [x, fy - fh / 2 - 2],
      ],
      done: f.tickets.filter((tk) => tk.status === "done").length,
      total: f.tickets.length,
      tickets: [],
    };
  });

  // Tickets snap in feature by feature, after every feature is on the canvas.
  t = T.featureStart + specs.length * T.featureStep + 0.12;
  features.forEach((f) => {
    const spineX = f.x - fw / 2 + 16;
    const left = spineX + 16;
    f.tickets = specs[features.indexOf(f)].tickets.map((tk, j) => {
      const y = fy + fh / 2 + 44 + j * tGap + th / 2 - 8;
      const ticket = {
        ...tk,
        x: left + tw / 2,
        y,
        w: tw,
        h: th,
        delay: t,
        edge: [
          [spineX, fy + fh / 2],
          [spineX, y],
          [left - 2, y],
        ] as [number, number][],
      };
      t += T.ticketStep;
      return ticket;
    });
  });

  const lastTicketY = Math.max(
    ...features.flatMap((f) => f.tickets.map((tk) => tk.y + tk.h / 2)),
  );
  const progressDelay = t + 0.05;
  const doneAll = features.reduce((s, f) => s + f.done, 0);
  const totalAll = features.reduce((s, f) => s + f.total, 0);
  const aiY = lastTicketY + (compact ? 58 : 64);
  const h = aiY + (compact ? 48 : 52);

  return {
    w,
    h,
    compact,
    release,
    features,
    list: compact
      ? { x: 240, y: 120, w: 430, h: 42, step: 52 }
      : { x: 600, y: 150, w: 560, h: 44, step: 56 },
    doc: compact
      ? undefined
      : {
          x: 1046,
          y: 82,
          w: 216,
          h: 62,
          edge: [
            [1104, 113],
            [1104, fy - fh / 2 - 2],
          ],
          delay: progressDelay + 0.5,
        },
    ai: {
      x: w / 2,
      y: aiY,
      w: compact ? 440 : 560,
      h: compact ? 50 : 54,
      delay: 8.9,
      text: compact
        ? `${doneAll} of ${totalAll} tickets done · Refunds waits on Webhook`
        : `${doneAll} of ${totalAll} tickets done · Refunds is blocked by the Webhook ticket`,
    },
    progressDelay,
    cursors: compact
      ? [
          {
            name: "Shashvat",
            role: "Dev",
            x: 300,
            y: lastTicketY - 70,
            sx: 120,
            sy: 140,
            delay: progressDelay,
            color: "var(--blue)",
          },
        ]
      : [
          {
            name: "Bhumika Saxena",
            role: "PM",
            x: 912,
            y: 100,
            sx: -200,
            sy: 140,
            delay: progressDelay + 0.6,
            color: "var(--coral)",
          },
          {
            name: "Shashvat Singh",
            role: "Dev",
            x: 300,
            y: lastTicketY - 12,
            sx: 260,
            sy: 120,
            delay: progressDelay + 0.35,
            color: "var(--blue)",
          },
        ],
  };
}

export function buildCues(l: Layout, intro = false): SoundCue[] {
  const cues: SoundCue[] = [];
  if (intro) {
    cues.push({ t: 0, kind: "music", duration: INTRO_END + 1.2 });
    INTRO_LINES.forEach((line) =>
      cues.push({ t: line.t, kind: "voice", clip: line.clip }),
    );
  }
  LIST_ROWS.forEach((_, i) =>
    cues.push({
      t: T.rowIn + i * T.rowStep,
      kind: "tick",
      pitch: 1 + i * 0.04,
    }),
  );
  cues.push({ t: T.listOut - 0.05, kind: "whoosh" });
  cues.push({ t: T.release, kind: "tock", pitch: 0.75, vol: 0.6 });
  l.features.forEach((f) => {
    cues.push({ t: f.delay, kind: "tock", pitch: 1, vol: 0.5 });
    f.tickets.forEach((tk) =>
      cues.push({ t: tk.delay, kind: "tock", pitch: 1.35, vol: 0.32 }),
    );
  });
  if (l.doc) cues.push({ t: l.doc.delay, kind: "tock", pitch: 0.9, vol: 0.35 });
  cues.push({ t: l.ai.delay, kind: "chime" });
  return cues;
}
