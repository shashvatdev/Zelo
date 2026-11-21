import type { FlowNode } from "@/lib/askZelo";

/** Solution pages (/solutions/[slug]) and team pages (/for/[slug]) share this shape. */
export type Landing = {
  slug: string;
  label: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  visual: { label: string; caption: string; tree: FlowNode };
  problems: { title: string; body: string }[];
  features: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
};

export const SOLUTIONS: Landing[] = [
  {
    slug: "release-management",
    label: "Release management",
    metaTitle: "Release management software for product teams | Zelo",
    metaDescription:
      "Plan, track and ship software releases on one visual map. Tickets roll up to features and releases, with a release gate and AI that flags blockers.",
    eyebrow: "release management, without the spreadsheet",
    title: "Ship releases you can actually see.",
    accent: "From plan to shipped, on one map.",
    lede: "Zelo is release management software built around the release itself. Features hang off the release, tickets hang off features, and progress rolls up the tree, so you always know how close you are to shipping.",
    visual: {
      label: "Release v2.3",
      caption:
        "Every feature and ticket in the release, with progress rolled up from the bottom.",
      tree: {
        label: "Release v2.3",
        sub: "ships Dec 12 · 62% done",
        tone: "ink",
        children: [
          {
            label: "Refunds",
            sub: "1/3 done",
            tone: "dev",
            children: [
              { label: "API endpoint", sub: "Done", tone: "done" },
              { label: "Webhook", sub: "In dev", tone: "dev" },
            ],
          },
          {
            label: "OTP login",
            sub: "1/2 done",
            tone: "qa",
            children: [
              { label: "SMS provider", sub: "Done", tone: "done" },
              { label: "OTP screen", sub: "In QA", tone: "qa" },
            ],
          },
          {
            label: "Export CSV",
            sub: "2/2 done",
            tone: "done",
            children: [
              { label: "CSV builder", sub: "Done", tone: "done" },
              { label: "Download button", sub: "Done", tone: "done" },
            ],
          },
        ],
      },
    },
    problems: [
      {
        title: "The release is a filter, not a thing",
        body: "In most tools a release is a version field on scattered tickets. Seeing it whole means building a query, a board and a report.",
      },
      {
        title: "Status arrives by meeting",
        body: "Whether the release is on track lives in people's heads until the next standup, so slips are found late.",
      },
      {
        title: "Shipping is a leap of faith",
        body: "There is no clear moment when the release is ready, just a sense that most things are probably done.",
      },
    ],
    features: [
      {
        title: "The release is a node",
        body: "Create a release with a version and a target date. Features attach to it and tickets attach to features, so the release has a real shape.",
      },
      {
        title: "Progress rolls up",
        body: "Each ticket's state flows up to its feature and then to the release. You see 62% done, and exactly which branches are behind.",
      },
      {
        title: "Release gates",
        body: "Ship only when the gate passes, for example every item done or cancelled. Overrides are allowed, and logged.",
      },
      {
        title: "Release notes write themselves",
        body: "When the release turns green, Zelo drafts the changelog and customer notes from the tickets and specs inside it.",
      },
    ],
    steps: [
      {
        title: "Create the release",
        body: "Name it, set a target date, and pick the modules it touches.",
      },
      {
        title: "Pull in features",
        body: "Add new features or pull existing ones from module backlogs; tickets follow their feature.",
      },
      {
        title: "Watch it turn green",
        body: "Progress, blockers and owners update live as the team works.",
      },
      {
        title: "Ship and move on",
        body: "Pass the gate, publish the notes, and roll anything unfinished into the next release in one step.",
      },
    ],
    faqs: [
      {
        q: "What is release management software?",
        a: "Release management software helps teams plan which work goes into a software release, track its progress and decide when it is ready to ship. Zelo does this on a visual map where every ticket rolls up to its feature and release.",
      },
      {
        q: "Can a feature move to the next release?",
        a: "Yes. A feature belongs to one release at a time; moving it to the next release carries its tickets with it and records the move in the history.",
      },
      {
        q: "Does Zelo handle hotfix releases?",
        a: "Yes. A hotfix is just another release node. Bugs can be planned straight into it and it ships through the same gate.",
      },
    ],
    related: [
      { href: "/solutions/bug-tracking", label: "Bug tracking" },
      { href: "/templates/release-plan", label: "Release plan template" },
      {
        href: "/guides/how-to-plan-a-software-release",
        label: "How to plan a software release",
      },
      {
        href: "/tools/release-notes-generator",
        label: "Release notes generator",
      },
    ],
  },
  {
    slug: "bug-tracking",
    label: "Bug tracking",
    metaTitle: "Bug tracking connected to modules and releases | Zelo",
    metaDescription:
      "Track bugs where they live: on the module they break and the release that fixes them. Zelo records where each bug was found, introduced and fixed.",
    eyebrow: "bug tracking with context",
    title: "Bugs belong somewhere.",
    accent: "Zelo knows where.",
    lede: "Zelo is a bug tracker that attaches every bug to the module or feature it breaks, plans it into a release, and remembers which release found it, which introduced it and which fixed it.",
    visual: {
      label: "Bugs in v2.3",
      caption:
        "Bugs grouped by module, each planned into the release that will fix it.",
      tree: {
        label: "Release v2.3",
        sub: "5 bugs planned",
        tone: "ink",
        children: [
          {
            label: "Payments",
            sub: "2 bugs",
            tone: "coral",
            children: [
              { label: "Double charge", sub: "Critical", tone: "dev" },
              { label: "Refund rounding", sub: "In QA", tone: "qa" },
            ],
          },
          {
            label: "Auth",
            sub: "2 bugs",
            tone: "plain",
            children: [
              { label: "OTP expires early", sub: "Fixed", tone: "done" },
              { label: "SSO redirect", sub: "To do", tone: "todo" },
            ],
          },
          {
            label: "Dashboard",
            sub: "1 bug",
            tone: "plain",
            children: [{ label: "CSV encoding", sub: "Fixed", tone: "done" }],
          },
        ],
      },
    },
    problems: [
      {
        title: "Bugs float free",
        body: "A bug list without context says nothing about which part of the product is fragile or which release will carry the fix.",
      },
      {
        title: "Duplicates pile up",
        body: "Support, QA and developers report the same issue in different words, and nobody notices until three people fix it.",
      },
      {
        title: "Regressions repeat",
        body: "Without knowing which release introduced a bug, the same mistakes ship again.",
      },
    ],
    features: [
      {
        title: "Bugs live on the module",
        body: "File a bug by tapping the module or feature it breaks. Tag extra modules it affects, so impact is visible at a glance.",
      },
      {
        title: "Planned into a release",
        body: '"Add to release" puts the bug in that release\'s tree, in its own Bugs lane, counted by the release gate.',
      },
      {
        title: "Found, introduced, fixed",
        body: "Each bug records the release it was found in, the one that introduced it and the one that fixed it, so regression reports are one click.",
      },
      {
        title: "AI duplicate check",
        body: "New reports are compared with open bugs, and likely duplicates are flagged before anyone starts work.",
      },
    ],
    steps: [
      {
        title: "Report",
        body: "From the canvas, Slack, a support tool or by asking the AI.",
      },
      {
        title: "Triage",
        body: "Set severity, owner and affected modules; merge duplicates.",
      },
      {
        title: "Plan",
        body: "Send urgent bugs to a hotfix release and the rest to a planned release.",
      },
      {
        title: "Close",
        body: "When the release ships, its fixed bugs are recorded and appear in the release notes.",
      },
    ],
    faqs: [
      {
        q: "How is Zelo different from a regular bug tracker?",
        a: "A regular bug tracker keeps a list of issues. Zelo attaches each bug to the module or feature it breaks and to the release that fixes it, so you can see where your product is fragile and when fixes will ship.",
      },
      {
        q: "Can customers or support report bugs?",
        a: "Bug intake from Slack and support tools is planned. Reports arrive in triage with the reporter, and the AI suggests the affected module and possible duplicates.",
      },
      {
        q: "Can I see which release introduced a bug?",
        a: 'Yes. Each bug can record the release that introduced it, so reports like "bugs introduced per release" are available without spreadsheets.',
      },
    ],
    related: [
      { href: "/solutions/release-management", label: "Release management" },
      { href: "/templates/bug-triage", label: "Bug triage template" },
      {
        href: "/guides/how-to-track-bugs-across-releases",
        label: "How to track bugs across releases",
      },
      { href: "/for/qa-teams", label: "Zelo for QA teams" },
    ],
  },
  {
    slug: "product-roadmap",
    label: "Product roadmap",
    metaTitle: "Product roadmap tool connected to real work | Zelo",
    metaDescription:
      "A product roadmap that stays true: modules, releases and features on one map, linked to the tickets doing the work, with history from day zero.",
    eyebrow: "a roadmap that can't drift",
    title: "Your roadmap,",
    accent: "wired to the work.",
    lede: "Zelo's product roadmap isn't a separate slide. It is the same map your team works on, so every planned feature is linked to the tickets building it and the release shipping it.",
    visual: {
      label: "Product map",
      caption:
        "Modules across the product, with the releases and features planned for each.",
      tree: {
        label: "Acme app",
        sub: "4 modules · 3 releases",
        tone: "ink",
        children: [
          {
            label: "Payments",
            sub: "module",
            tone: "plain",
            children: [
              { label: "Refunds", sub: "v2.3", tone: "dev" },
              { label: "Saved cards", sub: "v2.4", tone: "todo" },
            ],
          },
          {
            label: "Auth",
            sub: "module",
            tone: "plain",
            children: [
              { label: "OTP login", sub: "v2.3", tone: "qa" },
              { label: "SSO", sub: "v2.5", tone: "todo" },
            ],
          },
          {
            label: "Dashboard",
            sub: "module",
            tone: "plain",
            children: [
              { label: "Export CSV", sub: "v2.3", tone: "done" },
              { label: "Search", sub: "v2.4", tone: "todo" },
            ],
          },
        ],
      },
    },
    problems: [
      {
        title: "Roadmaps go stale",
        body: "A roadmap in slides or a separate tool drifts from reality the week after it is presented.",
      },
      {
        title: "Plans and tickets don't meet",
        body: "Nobody can trace a roadmap item to the tickets that will deliver it, or see that half of them haven't started.",
      },
      {
        title: "History disappears",
        body: "Once a quarter ends, what was shipped and why is buried in old boards.",
      },
    ],
    features: [
      {
        title: "Modules are the backbone",
        body: "Lay out your product once as modules. Every feature, past and future, lives under the module it belongs to.",
      },
      {
        title: "Releases on a timeline",
        body: "Releases carry target dates, so the roadmap is simply the map viewed over time.",
      },
      {
        title: "Linked all the way down",
        body: "Every roadmap feature is a node with real tickets under it, so progress on the roadmap is measured, not guessed.",
      },
      {
        title: "Day zero to today",
        body: "Zoom out to see every release you have shipped, by module, with the specs and decisions behind each one.",
      },
    ],
    steps: [
      {
        title: "Map your modules",
        body: "Payments, Auth, Dashboard: the parts of your product.",
      },
      {
        title: "Place features",
        body: "Add planned features to modules and schedule them into releases.",
      },
      {
        title: "Share one link",
        body: "Leadership and customers' success teams see the live roadmap, not a copy.",
      },
    ],
    faqs: [
      {
        q: "Is the roadmap separate from the work?",
        a: "No. In Zelo the roadmap is a view of the same map the team works on, so roadmap features are linked to the tickets and releases delivering them.",
      },
      {
        q: "Can I share the roadmap with stakeholders?",
        a: "Guest and view-only access is planned, so stakeholders can open a live roadmap view without editing the work.",
      },
      {
        q: "Does Zelo keep past releases?",
        a: "Yes. The product map keeps every shipped release, grouped by module, from the first release to today.",
      },
    ],
    related: [
      {
        href: "/solutions/visual-project-management",
        label: "Visual project management",
      },
      { href: "/glossary/roadmap", label: "What is a product roadmap?" },
      { href: "/for/product-managers", label: "Zelo for product managers" },
      { href: "/templates/prd", label: "PRD template" },
    ],
  },
  {
    slug: "visual-project-management",
    label: "Visual project management",
    metaTitle: "Visual project management software for software teams | Zelo",
    metaDescription:
      "Visual project management on a living canvas: product, modules, releases, features and tickets as connected nodes, with docs on the work and AI built in.",
    eyebrow: "project management you can see",
    title: "Stop reading your project.",
    accent: "Start seeing it.",
    lede: "Zelo is visual project management software for software teams. Instead of rows of text, your work is a connected map you can zoom, tap and share, from the whole product down to a single ticket.",
    visual: {
      label: "Canvas",
      caption: "The whole hierarchy on one canvas, from product to ticket.",
      tree: {
        label: "Acme app",
        sub: "product",
        tone: "ink",
        children: [
          {
            label: "Payments",
            sub: "module",
            tone: "plain",
            children: [{ label: "Refunds", sub: "feature", tone: "coral" }],
          },
          {
            label: "Release v2.3",
            sub: "release",
            tone: "coral",
            children: [
              { label: "Refunds", sub: "3 tickets", tone: "dev" },
              { label: "OTP login", sub: "2 tickets", tone: "qa" },
            ],
          },
          {
            label: "Auth",
            sub: "module",
            tone: "plain",
            children: [{ label: "OTP login", sub: "feature", tone: "coral" }],
          },
        ],
      },
    },
    problems: [
      {
        title: "Text hides structure",
        body: "Lists and boards turn a tree of work into rows, so the shape of the project has to be rebuilt in your head.",
      },
      {
        title: "Context is elsewhere",
        body: "Specs, decisions and designs sit in other tools, a click and a search away from the ticket.",
      },
      {
        title: "Everyone sees a different slice",
        body: "PMs, developers, QA and leadership each build their own view, and none of them agree.",
      },
    ],
    features: [
      {
        title: "A living canvas",
        body: "Product, modules, releases, features and tickets are connected nodes. Zoom out for the whole product, zoom in for a single ticket.",
      },
      {
        title: "Docs on the node",
        body: "Every node holds its doc: PRD, spec, designs and decisions sit beside the work they describe.",
      },
      {
        title: "Status you can see",
        body: "Colour shows state, and parents show how much of their work is done.",
      },
      {
        title: "AI that reads the map",
        body: "Ask what is blocked, what a person finished or how much work is left, and get an answer drawn as a map.",
      },
    ],
    steps: [
      {
        title: "Lay out the product",
        body: "Modules first, so everything has a home.",
      },
      {
        title: "Branch the work",
        body: "Releases, features and tickets, each connected to its parent.",
      },
      {
        title: "Work on the map",
        body: "Tap any node to open it, write, comment and move it forward.",
      },
    ],
    faqs: [
      {
        q: "What is visual project management?",
        a: "Visual project management shows work as pictures, such as maps, boards or timelines, instead of plain lists. Zelo uses a connected canvas, so the relationships between product, modules, releases, features and tickets are visible at a glance.",
      },
      {
        q: "Is there still a list view?",
        a: "Yes. The canvas is the default, but list and board views are available for bulk editing and quick scanning.",
      },
      {
        q: "Does the canvas work for large products?",
        a: "Zelo loads the level you are viewing, such as modules and features when zoomed out and tickets when zoomed in, so large products stay fast.",
      },
    ],
    related: [
      { href: "/solutions/product-roadmap", label: "Product roadmap" },
      { href: "/compare", label: "Switching to Zelo" },
      { href: "/for/engineering-teams", label: "Zelo for engineering teams" },
      {
        href: "/guides/how-to-plan-a-software-release",
        label: "Planning a release",
      },
    ],
  },
];

export const TEAMS: Landing[] = [
  {
    slug: "product-managers",
    label: "Product managers",
    metaTitle: "Zelo for product managers: specs, releases and status",
    metaDescription:
      'Write the spec on the feature, see release progress without a meeting, and answer "where are we?" in seconds. Zelo for product managers.',
    eyebrow: "for product managers",
    title: "Spend less time chasing status.",
    accent: "More time on the product.",
    lede: "Zelo gives product managers one place for the spec, the plan and the progress. The PRD lives on the feature, tickets hang off it, and the release shows how close you are without asking anyone.",
    visual: {
      label: "Refunds",
      caption:
        "One feature: its spec, its tickets and their progress, together.",
      tree: {
        label: "Refunds",
        sub: "feature · Bhumika Saxena",
        tone: "coral",
        children: [
          {
            label: "Spec",
            sub: "PRD · 3 comments",
            tone: "plain",
            children: [
              { label: "Goal", sub: "self-serve refunds", tone: "plain" },
              { label: "Acceptance", sub: "3 criteria", tone: "plain" },
            ],
          },
          {
            label: "Tickets",
            sub: "1/3 done",
            tone: "dev",
            children: [
              { label: "API endpoint", sub: "Done", tone: "done" },
              { label: "Refund UI", sub: "In QA", tone: "qa" },
              { label: "Webhook", sub: "In dev", tone: "dev" },
            ],
          },
        ],
      },
    },
    problems: [
      {
        title: "Status meetings eat the week",
        body: "Every update needs a standup, a ping or a spreadsheet, because the tool can't show the release as a whole.",
      },
      {
        title: "Specs get lost",
        body: "The PRD sits in a doc tool; developers ask the same questions because they can't see it from the ticket.",
      },
      {
        title: "Roadmaps drift",
        body: "The plan you presented and the work in progress stop matching within weeks.",
      },
    ],
    features: [
      {
        title: "Write the spec where the work is",
        body: "The PRD is the feature's doc. Developers open a ticket and the spec is one tap away.",
      },
      {
        title: "Tickets from the spec",
        body: "AI drafts tickets and acceptance criteria from your PRD; you edit and approve.",
      },
      {
        title: "Status without asking",
        body: 'Release and feature progress roll up live, so "where are we?" is answered by looking.',
      },
      {
        title: "A roadmap that stays true",
        body: "Roadmap features are the same nodes the team works on, so the plan can't drift from reality.",
      },
    ],
    steps: [
      {
        title: "Write the PRD on the feature",
        body: "Goal, scope and acceptance criteria.",
      },
      {
        title: "Approve the drafted tickets",
        body: "Edit what AI suggests, then hand off.",
      },
      {
        title: "Follow progress on the map",
        body: "Unblock what's stuck; skip the status meeting.",
      },
    ],
    faqs: [
      {
        q: "Can I write PRDs in Zelo?",
        a: "Yes. Every feature node has a rich doc for the PRD, designs and decisions, and comments can be attached to exact passages.",
      },
      {
        q: "Does Zelo replace my roadmap tool?",
        a: "For software products, yes: the roadmap is a timeline view of the same modules, releases and features your team works on.",
      },
      {
        q: "How does AI help product managers?",
        a: "It drafts tickets and acceptance criteria from a spec, answers developers' questions from the feature's docs, and flags what is blocking a release.",
      },
    ],
    related: [
      { href: "/templates/prd", label: "PRD template" },
      {
        href: "/guides/how-to-write-a-prd-developers-read",
        label: "Writing a PRD developers read",
      },
      { href: "/solutions/product-roadmap", label: "Product roadmap" },
      { href: "/for/engineering-teams", label: "Zelo for engineering teams" },
    ],
  },
  {
    slug: "engineering-teams",
    label: "Engineering teams",
    metaTitle: "Zelo for engineering teams: context on every ticket",
    metaDescription:
      "Every ticket shows its feature, spec and release. Fewer questions, clear dependencies, and GitHub links planned. Zelo for engineering teams.",
    eyebrow: "for engineering teams",
    title: "Every ticket,",
    accent: "with its whole context.",
    lede: "Zelo shows developers why a ticket exists: the feature it belongs to, the spec behind it, what it depends on and the release it ships in, so less time goes to asking and more to building.",
    visual: {
      label: "PAY-142 Webhook",
      caption:
        "A ticket with its parent feature, its dependency and its release.",
      tree: {
        label: "Webhook",
        sub: "PAY-142 · Shashvat Singh",
        tone: "dev",
        children: [
          {
            label: "Feature",
            sub: "Refunds",
            tone: "plain",
            children: [
              { label: "Spec", sub: "retry 3 times, then flag", tone: "plain" },
            ],
          },
          {
            label: "Depends on",
            sub: "1 ticket",
            tone: "plain",
            children: [{ label: "API endpoint", sub: "Done", tone: "done" }],
          },
          {
            label: "Ships in",
            sub: "Release v2.3",
            tone: "coral",
            children: [{ label: "Target", sub: "Dec 12", tone: "plain" }],
          },
        ],
      },
    },
    problems: [
      {
        title: "Tickets without a why",
        body: "A title and a description rarely explain what the feature is for, so developers interrupt the PM.",
      },
      {
        title: "Hidden dependencies",
        body: "Work stalls on another team's ticket that nobody linked.",
      },
      {
        title: "Status busywork",
        body: "Moving cards and writing updates takes time that should go to code.",
      },
    ],
    features: [
      {
        title: "The spec is one tap away",
        body: "Open any ticket and its feature's spec, designs and decisions are right there.",
      },
      {
        title: "Dependencies you can see",
        body: "Draw a dependency once; Zelo flags the dependant when the work it needs is late.",
      },
      {
        title: "Fast to use",
        body: "Keyboard shortcuts and a command palette for the things you do fifty times a day.",
      },
      {
        title: "GitHub, linked (planned)",
        body: "Branches and PRs that mention a ticket key link themselves, and a merge can move the ticket to QA.",
      },
    ],
    steps: [
      {
        title: "Open My work",
        body: "Your tickets, each with its feature and release.",
      },
      {
        title: "Read the spec in place",
        body: "Ask questions as comments on the exact line.",
      },
      {
        title: "Ship",
        body: "Merge, and the ticket moves on its own (with the GitHub integration).",
      },
    ],
    faqs: [
      {
        q: "Will Zelo slow developers down?",
        a: "It is designed not to: keyboard shortcuts, a command palette and list views for fast edits, with the canvas there when you need context.",
      },
      {
        q: "Does Zelo integrate with GitHub?",
        a: "A GitHub integration is planned: PRs and branches that mention a ticket key link automatically, and merges can trigger status changes.",
      },
      {
        q: "Can I see what my ticket depends on?",
        a: "Yes. Dependencies are links between tickets or features, shown on the canvas and on the ticket itself.",
      },
    ],
    related: [
      { href: "/for/product-managers", label: "Zelo for product managers" },
      { href: "/tools/velocity-calculator", label: "Velocity calculator" },
      { href: "/glossary/story-points", label: "What are story points?" },
      { href: "/vs/linear", label: "Zelo vs Linear" },
    ],
  },
  {
    slug: "agencies",
    label: "Agencies",
    metaTitle: "Zelo for agencies: one map per client product",
    metaDescription:
      "Run every client product on its own map. Show clients live progress, keep specs with the work, and plan releases across teams. Zelo for agencies.",
    eyebrow: "for agencies and studios",
    title: "Every client,",
    accent: "on their own map.",
    lede: "Zelo lets agencies run each client product as its own map: modules, releases and tickets, with the client's specs on the work and a progress view you can share instead of a weekly status email.",
    visual: {
      label: "Agency workspace",
      caption:
        "Each client product is its own map, with its current release and progress.",
      tree: {
        label: "Studio workspace",
        sub: "3 client products",
        tone: "ink",
        children: [
          {
            label: "Client A app",
            sub: "v1.4 · 80%",
            tone: "done",
            children: [{ label: "Checkout", sub: "Done", tone: "done" }],
          },
          {
            label: "Client B portal",
            sub: "v0.9 · 45%",
            tone: "dev",
            children: [{ label: "Reports", sub: "In dev", tone: "dev" }],
          },
          {
            label: "Client C site",
            sub: "v2.0 · 20%",
            tone: "qa",
            children: [{ label: "Search", sub: "In QA", tone: "qa" }],
          },
        ],
      },
    },
    problems: [
      {
        title: "Every client, a different tool",
        body: "Clients bring their own spreadsheets and boards, and your team jumps between them all day.",
      },
      {
        title: "Status emails every Friday",
        body: "Hours go into writing updates that are out of date by Monday.",
      },
      {
        title: "Scope creep you can't show",
        body: "When new requests arrive, there is no clear picture of what was agreed and what was added.",
      },
    ],
    features: [
      {
        title: "A map per client",
        body: "Each client product is its own map with modules, releases and features, kept separate and permission-scoped.",
      },
      {
        title: "Share live progress (planned)",
        body: "Give clients a view-only link to their release instead of a status email.",
      },
      {
        title: "Scope that's visible",
        body: "Agreed features sit in the release; new requests appear as new nodes, so scope changes are obvious.",
      },
      {
        title: "Specs with the work",
        body: "Client briefs and decisions live on the feature they describe, so nothing gets lost between handovers.",
      },
    ],
    steps: [
      {
        title: "Create a product per client",
        body: "Modules from the brief, releases from the contract.",
      },
      {
        title: "Plan the release",
        body: "Features, tickets and owners on one map.",
      },
      {
        title: "Share progress",
        body: "A live link replaces the weekly update.",
      },
    ],
    faqs: [
      {
        q: "Can clients see their project?",
        a: "Guest access is planned, so clients can open a view-only map of their own product without seeing other clients.",
      },
      {
        q: "Can we run several clients in one workspace?",
        a: "Yes. Each client product is a separate map inside your workspace, with its own modules, releases and permissions.",
      },
      {
        q: "Does Zelo track time or invoices?",
        a: "Not at the moment. Zelo focuses on planning and shipping releases; time tracking and invoicing are better handled by dedicated tools.",
      },
    ],
    related: [
      { href: "/solutions/release-management", label: "Release management" },
      { href: "/templates/release-plan", label: "Release plan template" },
      { href: "/vs/asana", label: "Zelo vs Asana" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    slug: "qa-teams",
    label: "QA teams",
    metaTitle:
      "Zelo for QA teams: test what's in the release, track what broke",
    metaDescription:
      "See exactly what's in the release, which tickets are waiting for QA, and which bugs each module has. Zelo for QA and test teams.",
    eyebrow: "for QA and test teams",
    title: "Know what to test.",
    accent: "Know what broke.",
    lede: "Zelo gives QA a clear view of the release: what is in it, what is waiting for testing, and which modules are producing bugs, with every bug tied to the release that will fix it.",
    visual: {
      label: "QA queue · v2.3",
      caption:
        "What is waiting for QA in the release, and the bugs found so far.",
      tree: {
        label: "Release v2.3",
        sub: "QA view",
        tone: "ink",
        children: [
          {
            label: "Waiting for QA",
            sub: "2 tickets",
            tone: "qa",
            children: [
              { label: "Refund UI", sub: "Refunds", tone: "qa" },
              { label: "Theme toggle", sub: "Dark mode", tone: "qa" },
            ],
          },
          {
            label: "Bugs found",
            sub: "3 open",
            tone: "coral",
            children: [
              { label: "Double charge", sub: "Payments", tone: "dev" },
              { label: "SSO redirect", sub: "Auth", tone: "todo" },
            ],
          },
        ],
      },
    },
    problems: [
      {
        title: "What's actually in this build?",
        body: "QA learns the release contents from chat messages and a last-minute list.",
      },
      {
        title: "Bugs without a home",
        body: "Bugs are filed against nothing in particular, so patterns in fragile modules go unnoticed.",
      },
      {
        title: "Back-and-forth on failures",
        body: "A failed test turns into a thread instead of a clear handoff back to the developer.",
      },
    ],
    features: [
      {
        title: "The release, itemised",
        body: "Every feature and ticket in the release, with what is waiting for QA highlighted.",
      },
      {
        title: "Fail with one tap",
        body: "A failed check sends the ticket back to its developer with your notes, automatically.",
      },
      {
        title: "Bugs per module",
        body: "File bugs on the module they break, and see which parts of the product produce the most.",
      },
      {
        title: "Regressions tracked",
        body: "Record which release introduced a bug, so recurring problems are caught early.",
      },
    ],
    steps: [
      {
        title: "Open the QA queue",
        body: "Everything waiting for testing in this release.",
      },
      {
        title: "Pass or fail",
        body: "Failures return to the developer with notes.",
      },
      {
        title: "Sign off the gate",
        body: "The release ships when QA's items are green.",
      },
    ],
    faqs: [
      {
        q: "Can QA block a release?",
        a: "Yes. The release gate can require every item to pass QA before shipping, and any override is logged.",
      },
      {
        q: "Can I attach test cases?",
        a: "Test steps and acceptance criteria live in the feature's doc and on the ticket; dedicated test-case management is not part of Zelo today.",
      },
      {
        q: "How are failed tests handled?",
        a: "An automation rule sends a failed ticket back to its developer with your notes, so the handoff is immediate.",
      },
    ],
    related: [
      { href: "/solutions/bug-tracking", label: "Bug tracking" },
      { href: "/templates/bug-triage", label: "Bug triage template" },
      { href: "/glossary/regression", label: "What is a regression?" },
      { href: "/glossary/definition-of-done", label: "Definition of done" },
    ],
  },
];

export const getSolution = (slug: string) =>
  SOLUTIONS.find((s) => s.slug === slug);
export const getTeam = (slug: string) => TEAMS.find((s) => s.slug === slug);
