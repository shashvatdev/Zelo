/** Glossary terms (/glossary/[term]). `short` is the one-sentence answer shown first. */
export type Term = {
  slug: string;
  term: string;
  short: string;
  body: string[];
  example: string;
  inZelo: string;
  related: string[];
};

export const TERMS: Term[] = [
  {
    slug: "release-management",
    term: "Release management",
    short:
      "Release management is the process of planning, tracking and shipping a set of software changes as one release, from deciding its scope to deploying it.",
    body: [
      "It covers choosing which features and fixes go into a release, coordinating the teams building them, testing, deciding when the release is ready, and communicating what changed.",
      "Good release management makes the state of a release visible at any moment, so slips are caught early rather than discovered the week of launch.",
    ],
    example:
      "A team plans v2.3 with four features, freezes code a week before the target date, runs QA, checks a release gate, ships, and publishes release notes.",
    inZelo:
      "A release is a node with features attached; progress rolls up from tickets, and a release gate decides when it can ship.",
    related: ["release-train", "hotfix", "definition-of-done"],
  },
  {
    slug: "release-train",
    term: "Release train",
    short:
      "A release train is a fixed, recurring schedule for shipping software: releases leave on set dates, and whatever is ready goes on the train.",
    body: [
      "Instead of delaying a release until every feature is done, the date is fixed and scope flexes. Unfinished work waits for the next train.",
      "Release trains make shipping predictable for customers and reduce the pressure to cram work in before a single big launch.",
    ],
    example:
      "A team ships every second Thursday. A feature that misses the code freeze simply moves to the next train two weeks later.",
    inZelo:
      "Create releases on a fixed cadence and move unfinished features to the next release in one step; their tickets move with them.",
    related: ["release-management", "sprint", "roadmap"],
  },
  {
    slug: "epic",
    term: "Epic",
    short:
      "An epic is a large body of work that is broken down into smaller pieces, such as user stories or tickets, and usually spans several sprints.",
    body: [
      "Epics group related work under one goal so teams can track progress on something bigger than a single ticket.",
      "Different tools use the word differently; in many teams an epic is roughly the same as a feature or a project.",
    ],
    example:
      '"Self-serve refunds" is an epic containing tickets for the API, the refund screen and the payment webhook.',
    inZelo:
      "Epics map to feature nodes: each feature sits under its module, holds its spec and has tickets underneath.",
    related: ["user-story", "backlog", "roadmap"],
  },
  {
    slug: "user-story",
    term: "User story",
    short:
      'A user story is a short description of a feature from the user\'s point of view, often written as "As a [user], I want [goal] so that [reason]."',
    body: [
      "User stories keep the focus on the person and the outcome rather than the implementation, and they are small enough to finish within a sprint.",
      "Each story usually comes with acceptance criteria that define when it is done.",
    ],
    example:
      "As a customer, I want to refund one item from my order so that I don't have to return everything.",
    inZelo:
      "Stories are tickets under a feature, with acceptance criteria linked to the feature's spec.",
    related: ["acceptance-criteria", "epic", "story-points"],
  },
  {
    slug: "story-points",
    term: "Story points",
    short:
      "Story points are a relative measure of the effort, complexity and uncertainty of a piece of work, used to estimate how much a team can take on.",
    body: [
      "Teams compare tickets to each other rather than estimating hours; a common scale is the Fibonacci-like 1, 2, 3, 5, 8, 13.",
      "Points are only meaningful within one team, and they are most useful when combined with velocity to forecast how much work fits in a sprint or release.",
    ],
    example:
      "The webhook ticket is estimated at 5 points because it is twice as complex as the 2-point SMS provider change.",
    inZelo:
      "Add points to tickets and they roll up to features and releases, so you can see how much work is left.",
    related: ["velocity", "sprint", "user-story"],
  },
  {
    slug: "velocity",
    term: "Velocity",
    short:
      "Velocity is the amount of work a team completes in a sprint, usually measured in story points, and is used to forecast future sprints.",
    body: [
      "Teams average their velocity over the last few sprints to plan how much to take on next, and to estimate when a release will be done.",
      "Velocity is a planning tool for one team, not a performance score; comparing velocity between teams is meaningless.",
    ],
    example:
      "A team completed 21, 18 and 24 points in its last three sprints, so it plans around 21 points per sprint.",
    inZelo:
      "Completed points per release and per person are visible on the map; try our free velocity calculator to forecast a release.",
    related: ["story-points", "sprint", "backlog"],
  },
  {
    slug: "sprint",
    term: "Sprint",
    short:
      "A sprint is a short, fixed period, usually one to four weeks, in which a team commits to completing a set of work.",
    body: [
      "Sprints come from Scrum. Each one starts with planning, ends with a review and a retrospective, and aims to produce working software.",
      "Sprints and releases are different things: several sprints may make up one release, or a team may release every sprint.",
    ],
    example:
      "A two-week sprint from 1 to 14 December covering the refunds tickets and two bug fixes.",
    inZelo:
      "Plan work by release on the map; sprints and cycles can be layered on top for teams that use them.",
    related: ["velocity", "backlog", "release-train"],
  },
  {
    slug: "backlog",
    term: "Backlog",
    short:
      "A backlog is the ordered list of work that a team might do but hasn't scheduled yet, from features to bugs to improvements.",
    body: [
      "The product backlog holds everything that could be done; items move out of it when they are planned into a sprint or release.",
      "A healthy backlog is ordered by value and regularly pruned, so the top items are ready to start.",
    ],
    example:
      "Saved cards and SSO sit in the Payments and Auth backlogs until they are planned into v2.4 and v2.5.",
    inZelo:
      "Each module has its own backlog of features; pulling one into a release is a single step.",
    related: ["epic", "roadmap", "sprint"],
  },
  {
    slug: "acceptance-criteria",
    term: "Acceptance criteria",
    short:
      "Acceptance criteria are the specific, testable conditions a feature or story must meet to be considered done.",
    body: [
      "They remove ambiguity between the people asking for a feature and the people building and testing it.",
      "Good criteria describe observable behaviour, not implementation, and each one can be checked as pass or fail.",
    ],
    example:
      '"Refund button appears only on orders younger than 30 days" is a testable criterion; "refunds should be easy" is not.',
    inZelo:
      "Write criteria in the feature's spec; AI turns them into checks on the tickets that implement them.",
    related: ["definition-of-done", "user-story", "prd"],
  },
  {
    slug: "definition-of-done",
    term: "Definition of done",
    short:
      "The definition of done is a shared checklist that every piece of work must satisfy before the team calls it done.",
    body: [
      "Unlike acceptance criteria, which are specific to one feature, the definition of done applies to all work, such as code reviewed, tests passing and documentation updated.",
      "It keeps quality consistent and stops half-finished work from being counted as complete.",
    ],
    example:
      "Done means: code reviewed, tests passing, QA signed off, feature flag documented, release notes drafted.",
    inZelo:
      "Encode the definition of done in your workflow and release gate, so a release can't ship until its items meet it.",
    related: ["acceptance-criteria", "release-management", "regression"],
  },
  {
    slug: "prd",
    term: "PRD (product requirements document)",
    short:
      "A PRD, or product requirements document, describes the problem a feature solves, who it is for, what is in and out of scope, and how success will be measured.",
    body: [
      "It aligns product, design, engineering and the business before building starts, and it is the reference developers return to while they work.",
      "The best PRDs are short, specific and kept next to the work they describe.",
    ],
    example:
      "The Refunds PRD states the problem (120 support tickets a week), the goal, the scope, acceptance criteria and open questions.",
    inZelo:
      "The PRD is the feature node's doc; tickets are created from it and link back to the exact passage they implement.",
    related: ["acceptance-criteria", "user-story", "roadmap"],
  },
  {
    slug: "roadmap",
    term: "Product roadmap",
    short:
      "A product roadmap is a plan that shows what a team intends to build over time and why, usually grouped by goals, themes or releases.",
    body: [
      "Roadmaps communicate direction to the team, leadership and customers. They range from detailed timelines to now / next / later views.",
      "Roadmaps fail when they drift from the actual work, which is why linking roadmap items to real tickets matters.",
    ],
    example:
      "Q1: refunds and OTP login; Q2: saved cards and search; Q3: SSO and audit log.",
    inZelo:
      "The roadmap is a timeline view of modules, releases and features on the same map the team works on.",
    related: ["backlog", "release-train", "epic"],
  },
  {
    slug: "bug-triage",
    term: "Bug triage",
    short:
      "Bug triage is the process of reviewing new bug reports to confirm them, set severity, find duplicates, assign an owner and decide when they will be fixed.",
    body: [
      "Triage keeps the bug list honest: every bug either has an owner and a release, or an explicit decision to leave it in the backlog.",
      "A shared severity scale makes triage fast and consistent.",
    ],
    example:
      "A critical double-charge bug goes to a hotfix today; a cosmetic layout bug goes to the backlog.",
    inZelo:
      'Bugs arrive in triage attached to a module; AI flags likely duplicates, and "add to release" plans the fix.',
    related: ["regression", "hotfix", "backlog"],
  },
  {
    slug: "regression",
    term: "Regression",
    short:
      "A regression is a bug where something that used to work stops working, usually because of a later change.",
    body: [
      "Regressions are especially costly because users notice them immediately and trust drops.",
      "Tracking which release introduced each regression reveals fragile areas of the product and gaps in testing.",
    ],
    example:
      "CSV exports worked in v2.2 but broke special characters in v2.3: a regression introduced in v2.3.",
    inZelo:
      'Each bug can record the release that introduced it, so "regressions per release" is a single view.',
    related: ["bug-triage", "hotfix", "definition-of-done"],
  },
  {
    slug: "hotfix",
    term: "Hotfix",
    short:
      "A hotfix is an urgent fix released outside the normal release schedule to address a critical problem in production.",
    body: [
      "Hotfixes skip the usual wait for the next planned release because the problem, such as a security hole or broken payments, can't wait.",
      "They should still go through review and testing, just faster, and the fix must also land in the main line of work.",
    ],
    example:
      "A double-charge bug found on Friday ships as v2.3.1 the same day instead of waiting for v2.4.",
    inZelo:
      "A hotfix is a small release node; critical bugs can be planned straight into it and shipped through the same gate.",
    related: ["regression", "bug-triage", "release-management"],
  },
];

export const getTerm = (slug: string) => TERMS.find((t) => t.slug === slug);

/** The natural question for each term, used as the page title and H1. */
export const QUESTIONS: Record<string, string> = {
  "release-management": "What is release management?",
  "release-train": "What is a release train?",
  epic: "What is an epic?",
  "user-story": "What is a user story?",
  "story-points": "What are story points?",
  velocity: "What is velocity?",
  sprint: "What is a sprint?",
  backlog: "What is a backlog?",
  "acceptance-criteria": "What are acceptance criteria?",
  "definition-of-done": "What is a definition of done?",
  prd: "What is a PRD?",
  roadmap: "What is a product roadmap?",
  "bug-triage": "What is bug triage?",
  regression: "What is a regression?",
  hotfix: "What is a hotfix?",
};
