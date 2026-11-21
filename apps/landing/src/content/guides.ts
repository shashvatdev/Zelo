export type GuideSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  minutes: number;
  intro: string;
  sections: GuideSection[];
  related: { href: string; label: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-plan-a-software-release",
    title: "How to plan a software release",
    metaTitle: "How to plan a software release: a step-by-step guide | Zelo",
    metaDescription:
      "A practical, step-by-step guide to planning a software release: set the goal, pick scope by feature, set dates, manage risks and decide when it's ready to ship.",
    minutes: 7,
    intro:
      "A good release plan answers four questions at any moment: what are we shipping, why, by when, and how close are we? This guide walks through planning a software release from a blank page to ship day, in a way that keeps the answers visible the whole time.",
    sections: [
      {
        id: "goal",
        heading: "1. Start with the goal, not the list",
        paragraphs: [
          "Most release plans start as a list of tickets. That makes it hard to say no to anything, because nothing explains why each item is there. Start instead with two or three outcomes the release should achieve, written as results for users or the business.",
          '"Customers can refund an order without contacting support" is a goal. "Build refund API" is a task. Goals let you cut scope intelligently when time runs short, because you can ask which work still serves the outcome.',
        ],
      },
      {
        id: "scope",
        heading: "2. Choose scope by feature",
        paragraphs: [
          "Group work into features before you think about tickets. A feature is a meaningful piece of value with an owner and a spec, such as Refunds or OTP login. Releases are much easier to reason about at this level: four features is a plan, forty tickets is noise.",
          "For each feature, record the module it belongs to, the owner and a link to its spec. Write an explicit out-of-scope list too; it prevents the quiet creep that sinks dates.",
        ],
        list: [
          "Feature name and module",
          "Owner",
          "Spec or PRD link",
          "Rough size (points or t-shirt size)",
        ],
      },
      {
        id: "tickets",
        heading: "3. Break features into tickets from the spec",
        paragraphs: [
          "Once a feature's spec is written, break it into tickets that each deliver a testable part of the acceptance criteria. Keeping tickets attached to their feature means progress rolls up naturally: when two of three tickets are done, the feature is two-thirds of the way there.",
          "This is also where dependencies appear. If the webhook ticket can't start until the API endpoint exists, write that down now rather than discovering it mid-sprint.",
        ],
      },
      {
        id: "dates",
        heading: "4. Set dates you can defend",
        paragraphs: [
          "A target date alone is not a plan. Work backwards from it to the milestones that matter: scope lock, code freeze, the QA window and the ship date. Use your team's recent velocity to check that the scope fits; if it doesn't, cut scope now, not the week before launch.",
          "If your team ships on a fixed cadence, a release train, the date is fixed and scope flexes. Anything that misses the code freeze simply moves to the next release.",
        ],
        list: ["Scope locked", "Code freeze", "QA window", "Ship date"],
      },
      {
        id: "risks",
        heading: "5. Name the risks and the fallbacks",
        paragraphs: [
          "List what could slip and what you will do if it does. External dependencies, new infrastructure and features that touch payments or authentication deserve a fallback, such as shipping behind a feature flag.",
          "Risks written down early are cheap. Risks discovered in the final week are expensive.",
        ],
      },
      {
        id: "track",
        heading: "6. Track progress without a status meeting",
        paragraphs: [
          "During the release, the plan should update itself. If ticket states roll up to features and features roll up to the release, anyone can see how close you are, which features are behind and what is blocked, without a meeting.",
          "Review the plan weekly anyway, but use the time to unblock work and make scope decisions rather than to collect status.",
        ],
      },
      {
        id: "ship",
        heading: "7. Decide when it's ready with a release gate",
        paragraphs: [
          "Define upfront what must be true to ship: every item done or cancelled, critical bugs fixed, release notes approved, a rollback plan written. When the gate passes, ship. When it doesn't, the gate tells you exactly what is missing.",
          "After shipping, move unfinished work to the next release in one step and hold a short retrospective on what to change next time.",
        ],
        list: [
          "All tickets done or cancelled",
          "Critical bugs fixed",
          "Release notes approved",
          "Rollback plan written",
        ],
      },
    ],
    related: [
      { href: "/templates/release-plan", label: "Release plan template" },
      {
        href: "/solutions/release-management",
        label: "Release management in Zelo",
      },
      { href: "/tools/velocity-calculator", label: "Velocity calculator" },
      { href: "/glossary/release-train", label: "What is a release train?" },
    ],
  },
  {
    slug: "how-to-track-bugs-across-releases",
    title: "How to track bugs across releases",
    metaTitle:
      "How to track bugs across releases (and stop regressions) | Zelo",
    metaDescription:
      "How to track bugs across software releases: attach bugs to modules, plan fixes into releases, record where they were introduced, and catch regressions.",
    minutes: 6,
    intro:
      "A flat bug list tells you how many bugs you have. It doesn't tell you where your product is fragile, which release will carry each fix, or whether you are shipping the same mistakes again. This guide shows how to track bugs so those answers are always one look away.",
    sections: [
      {
        id: "attach",
        heading: "1. Attach every bug to the part of the product it breaks",
        paragraphs: [
          "When a bug is filed against nothing in particular, patterns stay invisible. Attach each bug to the module or feature it breaks, such as Payments or Refunds, and tag any other modules it affects.",
          "After a few weeks, you can see which modules produce the most bugs. That is where refactoring, tests or a design rethink will pay off.",
        ],
      },
      {
        id: "triage",
        heading: "2. Triage with a shared severity scale",
        paragraphs: [
          "Agree once on what critical, high, medium and low mean, and use the scale for every bug. For each new report, confirm you can reproduce it, check for duplicates, set severity and assign an owner.",
          "Triage ends with a decision, not just a label: every bug leaves with a release or an explicit decision to keep it in the backlog.",
        ],
        list: [
          "Critical: data loss, security, payments; fix now",
          "High: core flow broken; next release",
          "Medium: non-core issue; when capacity allows",
          "Low: cosmetic; backlog",
        ],
      },
      {
        id: "plan",
        heading: "3. Plan fixes into releases",
        paragraphs: [
          "A bug with an owner but no release has no date. Plan fixes into a specific release, a hotfix for critical bugs and the next planned release for the rest, so the fix shows up in that release's progress and counts toward its gate.",
          "Grouping a release's bugs in their own lane, by module, makes it easy for QA to see what to verify before shipping.",
        ],
      },
      {
        id: "three",
        heading: "4. Record found, introduced and fixed",
        paragraphs: [
          "Three releases describe a bug's life: the release it was found in, the release that introduced it and the release that fixed it. Recording all three turns your bug tracker into a source of insight.",
          "With them, you can answer questions like how many regressions each release introduced, how long bugs survive before they are fixed, and whether quality is improving over time.",
        ],
      },
      {
        id: "regressions",
        heading: "5. Treat regressions as signals",
        paragraphs: [
          "A regression, something that used to work and now doesn't, is a sign that a change escaped your tests. When one appears, add a test that would have caught it and note which release introduced it.",
          "If one module keeps producing regressions, it needs attention beyond individual fixes.",
        ],
      },
      {
        id: "close",
        heading: "6. Close the loop in the release notes",
        paragraphs: [
          "When a release ships, its fixed bugs should appear in the release notes, described by their effect for users. It shows customers that reports lead to fixes, and it gives support a clear answer when someone asks if their issue is solved.",
        ],
      },
    ],
    related: [
      { href: "/templates/bug-triage", label: "Bug triage template" },
      { href: "/solutions/bug-tracking", label: "Bug tracking in Zelo" },
      { href: "/glossary/regression", label: "What is a regression?" },
      { href: "/glossary/hotfix", label: "What is a hotfix?" },
    ],
  },
  {
    slug: "how-to-write-a-prd-developers-read",
    title: "How to write a PRD developers actually read",
    metaTitle: "How to write a PRD developers actually read | Zelo",
    metaDescription:
      "How to write a product requirements document developers read and use: lead with the problem, set scope and acceptance criteria, keep it next to the work.",
    minutes: 6,
    intro:
      "Most PRDs are written for approval and then ignored. The ones developers actually read share a few traits: they explain the problem, draw a clear line around scope, define done in testable terms, and live right next to the tickets. Here is how to write one.",
    sections: [
      {
        id: "problem",
        heading: "1. Lead with the problem and the evidence",
        paragraphs: [
          "Developers make dozens of small decisions while building. If they understand the problem, those decisions go the right way without a meeting. Open with what is wrong today, for whom, and how you know: support tickets, data, customer quotes.",
          '"Customers email support to get refunds; that\'s about 120 tickets a week and a two-day wait" gives a developer more to work with than a page of requirements.',
        ],
      },
      {
        id: "goal",
        heading: "2. State one measurable goal",
        paragraphs: [
          "Write the outcome that means success, ideally with a number. It tells the team what to optimise for and gives everyone a way to judge whether the feature worked after it ships.",
        ],
      },
      {
        id: "scope",
        heading: "3. Draw the scope line, both sides",
        paragraphs: [
          "List what is in, and just as clearly, what is out. The out-of-scope list is the most underrated part of a PRD: it prevents scope creep and saves developers from building things nobody asked for.",
        ],
        list: [
          "In scope: what the feature must do",
          "Out of scope: tempting things it won't do this time",
          "Later: ideas parked for a future release",
        ],
      },
      {
        id: "criteria",
        heading: "4. Write acceptance criteria QA can test",
        paragraphs: [
          'Each criterion should describe observable behaviour that can pass or fail. "Refund button shows on orders younger than 30 days" is testable; "refunds should be intuitive" is not.',
          "Good criteria become checks on tickets, and QA uses them to sign off the feature.",
        ],
      },
      {
        id: "questions",
        heading: "5. List open questions with owners",
        paragraphs: [
          "No PRD is complete on day one. Instead of hiding uncertainty, list open questions with who will answer them and by when. Developers can then plan around the unknowns.",
        ],
      },
      {
        id: "short",
        heading: "6. Keep it short and next to the work",
        paragraphs: [
          "One to two pages is usually enough. Move deep technical detail into the tickets or a linked design doc. Most importantly, keep the PRD where the work is: if a developer can open the spec from the ticket in one click, they will read it; if they have to search another tool, they will ask you instead.",
        ],
      },
    ],
    related: [
      { href: "/templates/prd", label: "PRD template" },
      {
        href: "/glossary/acceptance-criteria",
        label: "What are acceptance criteria?",
      },
      { href: "/for/product-managers", label: "Zelo for product managers" },
      { href: "/glossary/prd", label: "What is a PRD?" },
    ],
  },
];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
