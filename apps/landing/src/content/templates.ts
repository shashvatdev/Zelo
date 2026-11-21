export type TemplateSection = {
  heading: string;
  guidance: string;
  example: string;
};

export type Template = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  whenToUse: string[];
  sections: TemplateSection[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
};

export const TEMPLATES: Template[] = [
  {
    slug: "release-plan",
    name: "Release plan template",
    metaTitle: "Free release plan template for software teams | Zelo",
    metaDescription:
      "A free software release plan template: goals, scope by feature, owners, dates, risks and the ship checklist. Copy it as Markdown or download it.",
    summary:
      "Plan a software release on one page: what it is for, which features are in, who owns what, the dates, the risks, and how you will know it is ready to ship.",
    whenToUse: [
      "At the start of every release or milestone",
      "When several teams contribute to the same release",
      "Before committing a date to customers",
    ],
    sections: [
      {
        heading: "Release",
        guidance:
          "Name, version and target date. One line on why this release matters.",
        example: "v2.3 · target 12 Dec · Self-serve refunds and faster login.",
      },
      {
        heading: "Goals",
        guidance:
          "Two or three outcomes, written as results rather than tasks.",
        example:
          "- Customers can refund an order without contacting support\n- Login takes under 10 seconds on mobile",
      },
      {
        heading: "Scope by feature",
        guidance:
          "Each feature, its module, its owner and a link to its spec. Out-of-scope items go in their own list.",
        example:
          "| Feature | Module | Owner | Spec |\n| --- | --- | --- | --- |\n| Refunds | Payments | Bhumika Saxena | link |\n| OTP login | Auth | Shashvat Singh | link |\n\nOut of scope: saved cards, SSO",
      },
      {
        heading: "Milestones",
        guidance:
          "Dates the team commits to, including the code freeze and the QA window.",
        example:
          "- 28 Nov: scope locked\n- 5 Dec: code freeze\n- 5–11 Dec: QA\n- 12 Dec: ship",
      },
      {
        heading: "Risks and dependencies",
        guidance: "What could slip, what it depends on, and the fallback.",
        example:
          "- Webhook depends on the payments provider's sandbox; fallback: ship refunds behind a flag",
      },
      {
        heading: "Ship checklist",
        guidance: "The gate: what must be true before you ship.",
        example:
          "- [ ] All tickets done or cancelled\n- [ ] Critical bugs fixed\n- [ ] Release notes approved\n- [ ] Rollback plan written",
      },
    ],
    faqs: [
      {
        q: "What should a release plan include?",
        a: "The release goal, the features in scope with owners and specs, key dates such as code freeze and QA, the main risks and dependencies, and a checklist that decides when the release is ready to ship.",
      },
      {
        q: "How long should a release plan be?",
        a: "One page. If it grows longer, move detail into each feature's spec and link to it from the plan.",
      },
    ],
    related: [
      { href: "/solutions/release-management", label: "Release management" },
      {
        href: "/guides/how-to-plan-a-software-release",
        label: "How to plan a release",
      },
      { href: "/templates/release-notes", label: "Release notes template" },
    ],
  },
  {
    slug: "prd",
    name: "PRD template",
    metaTitle: "Free PRD template (product requirements document) | Zelo",
    metaDescription:
      "A free product requirements document template developers actually read: problem, goal, users, scope, acceptance criteria and open questions.",
    summary:
      "A short product requirements document that answers what developers need to build the right thing: the problem, who it is for, what is in and out, and how you will know it works.",
    whenToUse: [
      "Before any feature bigger than a single ticket",
      "When business and engineering need to agree on scope",
      "When a feature will be handed between teams",
    ],
    sections: [
      {
        heading: "Problem",
        guidance:
          "What is wrong today, for whom, and how you know. Evidence beats opinion.",
        example:
          "Customers must email support to get a refund. That's ~120 tickets a week and a 2-day wait.",
      },
      {
        heading: "Goal",
        guidance: "The outcome that means success, ideally with a number.",
        example:
          "Refund requests handled without support; support tickets about refunds down 80%.",
      },
      {
        heading: "Users and use cases",
        guidance: "Who uses this and the main situations, in a few bullets.",
        example:
          "- A customer refunding a whole order\n- A customer refunding one item from a multi-item order",
      },
      {
        heading: "Scope",
        guidance: "What is in, and just as important, what is out.",
        example:
          "In: refunds within 30 days, partial refunds.\nOut: refunds to a different payment method.",
      },
      {
        heading: "Acceptance criteria",
        guidance:
          "Testable statements QA can check. Each becomes a check on a ticket.",
        example:
          "- Refund button shows on orders younger than 30 days\n- Partial refunds update the order total\n- Webhook retries 3 times, then flags the order",
      },
      {
        heading: "Open questions",
        guidance: "What is not decided yet, and who decides.",
        example: "- Do we refund shipping? (Bhumika, by 25 Nov)",
      },
    ],
    faqs: [
      {
        q: "What is a PRD?",
        a: "A product requirements document describes the problem a feature solves, who it is for, what is in and out of scope, and the acceptance criteria that show it works. It aligns business, design and engineering before building.",
      },
      {
        q: "How detailed should a PRD be?",
        a: "Detailed enough that a developer can build the right thing without a meeting, and short enough that they will read it. One to two pages is usually right.",
      },
    ],
    related: [
      {
        href: "/guides/how-to-write-a-prd-developers-read",
        label: "How to write a PRD developers read",
      },
      { href: "/glossary/prd", label: "What is a PRD?" },
      { href: "/for/product-managers", label: "Zelo for product managers" },
    ],
  },
  {
    slug: "bug-triage",
    name: "Bug triage template",
    metaTitle: "Free bug triage template and severity guide | Zelo",
    metaDescription:
      "A free bug triage template with a severity guide, the questions to ask for each bug, and how to decide whether it goes in a hotfix, the next release or the backlog.",
    summary:
      "Run a fast, consistent bug triage: a severity scale everyone shares, the questions to answer for each bug, and a clear rule for when it gets fixed.",
    whenToUse: [
      "Weekly triage meetings",
      "When bug reports pile up faster than they are fixed",
      "To agree on what counts as critical",
    ],
    sections: [
      {
        heading: "Severity scale",
        guidance: "Agree on these definitions once and use them for every bug.",
        example:
          "- Critical: data loss, security, payments broken, no workaround\n- High: core flow broken, workaround exists\n- Medium: non-core flow broken or degraded\n- Low: cosmetic or minor",
      },
      {
        heading: "For each bug",
        guidance: "Answer these before deciding anything.",
        example:
          "- Can we reproduce it?\n- Which module or feature does it break?\n- Is it a duplicate?\n- Which release introduced it?\n- How many users are affected?",
      },
      {
        heading: "Decision",
        guidance: "Map severity to when it ships.",
        example:
          "- Critical → hotfix release now\n- High → next planned release\n- Medium → planned when capacity allows\n- Low → backlog, review monthly",
      },
      {
        heading: "Owner and next step",
        guidance:
          "Every triaged bug leaves with an owner and a release (or an explicit backlog decision).",
        example:
          "Owner: Shashvat Singh · Release: v2.3 · Next: reproduce on staging",
      },
    ],
    faqs: [
      {
        q: "What is bug triage?",
        a: "Bug triage is the process of reviewing new bug reports to confirm them, set their severity, find duplicates, assign an owner and decide when the fix will ship.",
      },
      {
        q: "How often should we triage bugs?",
        a: "Most teams triage weekly, with critical bugs handled as soon as they are reported.",
      },
    ],
    related: [
      { href: "/solutions/bug-tracking", label: "Bug tracking" },
      { href: "/glossary/bug-triage", label: "What is bug triage?" },
      { href: "/for/qa-teams", label: "Zelo for QA teams" },
    ],
  },
  {
    slug: "sprint-retro",
    name: "Sprint retrospective template",
    metaTitle: "Free sprint retrospective template | Zelo",
    metaDescription:
      "A free sprint retrospective template: what went well, what didn't, what we'll try next, and follow-ups from last time. Copy as Markdown or download.",
    summary:
      "A simple retrospective that ends with actions, not just a list of feelings: what went well, what didn't, what you will try, and whether last time's actions happened.",
    whenToUse: [
      "At the end of every sprint or release",
      "After an incident or a missed date",
      "When the same problems keep coming back",
    ],
    sections: [
      {
        heading: "Last time's actions",
        guidance:
          "Start by checking whether the previous retro's actions happened.",
        example:
          "- [x] Freeze scope 1 week before QA\n- [ ] Pair on the webhook work",
      },
      {
        heading: "What went well",
        guidance: "Specific things worth repeating.",
        example:
          "- Specs were on the feature before work started\n- QA found the refund rounding bug early",
      },
      {
        heading: "What didn't",
        guidance: "Specific problems, not people.",
        example:
          "- Webhook blocked Refunds for 4 days; the dependency wasn't visible",
      },
      {
        heading: "What we'll try",
        guidance: "At most three actions, each with an owner and a date.",
        example:
          "- Mark cross-team dependencies at planning (Shashvat, next sprint)",
      },
    ],
    faqs: [
      {
        q: "What is a sprint retrospective?",
        a: "A sprint retrospective is a short meeting at the end of a sprint where the team reviews what went well, what didn't, and agrees on a few actions to improve the next sprint.",
      },
      {
        q: "How long should a retro take?",
        a: "Around 45 to 60 minutes for a two-week sprint. Keep the actions to three or fewer so they actually happen.",
      },
    ],
    related: [
      { href: "/glossary/sprint", label: "What is a sprint?" },
      { href: "/glossary/velocity", label: "What is velocity?" },
      { href: "/tools/velocity-calculator", label: "Velocity calculator" },
    ],
  },
  {
    slug: "release-notes",
    name: "Release notes template",
    metaTitle: "Free release notes template for software releases | Zelo",
    metaDescription:
      "A free release notes template: highlights, new features, improvements, fixes and known issues, written for customers. Copy as Markdown or download.",
    summary:
      "Release notes customers actually read: lead with what's new for them, group the rest, and be honest about known issues.",
    whenToUse: [
      "Every customer-facing release",
      "Internal changelogs for support and sales",
      "App store and changelog pages",
    ],
    sections: [
      {
        heading: "Highlights",
        guidance:
          "One or two sentences on the biggest change, written for the customer.",
        example:
          "You can now refund orders yourself, right from the order page.",
      },
      {
        heading: "New",
        guidance: "New features, each in one line starting with a verb.",
        example:
          "- Refund a whole order or a single item\n- Log in with a one-time code",
      },
      {
        heading: "Improved",
        guidance: "Changes to things that already existed.",
        example: "- Faster login on mobile\n- Clearer CSV export file names",
      },
      {
        heading: "Fixed",
        guidance: "Bugs fixed, described by their effect.",
        example:
          "- Fixed refunds rounding to the wrong amount\n- Fixed special characters in CSV exports",
      },
      {
        heading: "Known issues",
        guidance:
          "What is still broken and any workaround. Customers trust honest notes.",
        example:
          "- SSO redirects can loop in Safari; use another browser for now",
      },
    ],
    faqs: [
      {
        q: "What should release notes include?",
        a: "A short highlight of the biggest change, then grouped lists of new features, improvements and fixes, plus any known issues with workarounds, all written in terms of what changes for the customer.",
      },
      {
        q: "Can release notes be generated automatically?",
        a: "Yes. Zelo drafts release notes from the tickets and specs in a release when it ships, and our free release notes generator turns a list of changes into grouped notes.",
      },
    ],
    related: [
      {
        href: "/tools/release-notes-generator",
        label: "Release notes generator",
      },
      { href: "/templates/release-plan", label: "Release plan template" },
      { href: "/solutions/release-management", label: "Release management" },
    ],
  },
];

export const getTemplate = (slug: string) =>
  TEMPLATES.find((t) => t.slug === slug);

/** The template as a Markdown document, with guidance as comments and the examples as starting content. */
export function templateMarkdown(t: Template) {
  const body = t.sections
    .map((s) => `## ${s.heading}\n\n<!-- ${s.guidance} -->\n\n${s.example}`)
    .join("\n\n");
  return `# ${t.name.replace(/ template$/i, "")}\n\n${body}\n`;
}
