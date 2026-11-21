/**
 * Turns a list of changes (commit messages, PR or ticket titles) into grouped release notes.
 * Rule-based and runs in the browser: conventional-commit prefixes first, then keywords.
 */

export type Group =
  "breaking" | "new" | "improved" | "fixed" | "other" | "internal";

export const GROUP_TITLE: Record<Group, string> = {
  breaking: "Breaking changes",
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  other: "Other changes",
  internal: "Internal",
};

const ORDER: Group[] = [
  "breaking",
  "new",
  "improved",
  "fixed",
  "other",
  "internal",
];

const PREFIX: Record<string, Group> = {
  feat: "new",
  feature: "new",
  fix: "fixed",
  bugfix: "fixed",
  hotfix: "fixed",
  perf: "improved",
  refactor: "improved",
  improve: "improved",
  style: "improved",
  docs: "internal",
  chore: "internal",
  test: "internal",
  tests: "internal",
  ci: "internal",
  build: "internal",
};

function classify(raw: string): { group: Group; text: string } {
  let line = raw.replace(/^\s*[-*•]\s*/, "").trim();
  // Drop a leading ticket key like "PAY-142:" or "[PAY-142]".
  line = line.replace(/^\[?[A-Z][A-Z0-9]+-\d+\]?:?\s*/, "");
  let group: Group | null = null;

  const conv = line.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/);
  if (conv && PREFIX[conv[1].toLowerCase()]) {
    group = conv[3] ? "breaking" : PREFIX[conv[1].toLowerCase()];
    line = conv[4];
  }
  if (/BREAKING CHANGE/i.test(raw)) {
    group = "breaking";
    line = line.replace(/BREAKING CHANGE:?\s*/i, "");
  }
  if (!group) {
    const l = line.toLowerCase();
    if (
      /\b(fix|fixes|fixed|bug|crash|resolve|resolved|correct|broken)\b/.test(l)
    )
      group = "fixed";
    else if (
      /\b(add|adds|added|new|introduce|support|launch|allow|enable)\b/.test(l)
    )
      group = "new";
    else if (
      /\b(improve|improved|faster|speed|update|updated|better|enhance|optimi[sz]e|refine|clean)\b/.test(
        l,
      )
    )
      group = "improved";
    else group = "other";
  }
  const text = line.replace(/\.$/, "").replace(/^\w/, (c) => c.toUpperCase());
  return { group, text };
}

export function buildNotes(
  input: string,
  opts: { version: string; date: string; internal: boolean },
) {
  const groups: Record<Group, string[]> = {
    breaking: [],
    new: [],
    improved: [],
    fixed: [],
    other: [],
    internal: [],
  };
  input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l) => {
      const { group, text } = classify(l);
      if (text && !groups[group].includes(text)) groups[group].push(text);
    });

  const shown = ORDER.filter(
    (g) => groups[g].length && (g !== "internal" || opts.internal),
  );
  const heading = [opts.version.trim() || "Release", opts.date.trim()]
    .filter(Boolean)
    .join(" · ");
  const markdown =
    `# ${heading}\n\n` +
    shown
      .map(
        (g) =>
          `## ${GROUP_TITLE[g]}\n\n${groups[g].map((t) => `- ${t}`).join("\n")}`,
      )
      .join("\n\n") +
    "\n";
  return {
    heading,
    groups,
    shown,
    markdown,
    count: shown.reduce((n, g) => n + groups[g].length, 0),
  };
}

export const SAMPLE = `feat(payments): add self-serve refunds from the order page
feat(auth): log in with a one-time code
PAY-151: fix refund amounts rounding down
fix: special characters breaking CSV exports
perf: faster login on mobile
Improve CSV export file names
chore: bump dependencies
docs: update API readme`;
