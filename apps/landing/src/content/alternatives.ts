/**
 * "Best X alternatives" pages. Written by the Zelo team, which is disclosed on the page.
 * Descriptions stay factual and fair; no prices (they change), no claims we can't support.
 */

export type Alt = {
  name: string;
  site: string;
  bestFor: string;
  summary: string;
  strengths: string[];
  considerations: string[];
  compare?: string;
};

export type AlternativesPage = {
  slug: string;
  tool: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  why: string[];
  picks: Alt[];
  choose: { if: string; then: string }[];
  faqs: { q: string; a: string }[];
};

const ZELO = (tool: string): Alt => ({
  name: "Zelo",
  site: "/",
  bestFor: "Teams who want to see the whole release on one map",
  summary: `Zelo shows your work as a connected map: modules, releases, features and tickets, with specs on the work and AI that reads the whole graph. It is the most visual option here and the most focused on shipping releases. (We make Zelo, so weigh this pick accordingly.)`,
  strengths: [
    "Every ticket connected to its feature and release",
    "Docs and specs live on the work they describe",
    "Status rolls up to the release; release gates and notes",
    `Planned one-click import from ${tool}`,
  ],
  considerations: [
    "In beta: some integrations are still planned",
    "Focused on software teams, not every department",
  ],
});

export const ALTERNATIVES: AlternativesPage[] = [
  {
    slug: "jira",
    tool: "Jira",
    metaTitle: "Best Jira alternatives for software teams (2026)",
    metaDescription:
      "Six Jira alternatives for software teams, compared fairly: what each is best for, its strengths and what to consider before switching.",
    intro:
      "Jira is powerful and everywhere, but many teams find it heavy to configure and hard to see a release in. Here are six alternatives, what each does best, and how to choose.",
    why: [
      "You spend more time configuring workflows and fields than shipping",
      "Seeing a whole release means building filters, boards and reports",
      "Specs live in another tool, so developers keep asking for context",
    ],
    picks: [
      { ...ZELO("Jira"), compare: "/vs/jira" },
      {
        name: "Linear",
        site: "https://linear.app",
        bestFor: "Engineering teams who want speed",
        summary:
          "A fast, keyboard-first issue tracker with cycles, projects and initiatives, popular with startups and product engineering teams.",
        strengths: [
          "Very fast, polished interface",
          "Cycles and projects with clear defaults",
          "Strong developer workflow integrations",
        ],
        considerations: [
          "List-first rather than visual",
          "Mostly used by engineering and product",
        ],
        compare: "/vs/linear",
      },
      {
        name: "ClickUp",
        site: "https://clickup.com",
        bestFor: "One tool for every department",
        summary:
          "A broad workspace with tasks, docs, whiteboards, chat and goals, and many views over the same tasks.",
        strengths: [
          "Very flexible hierarchy and views",
          "Docs and whiteboards built in",
          "Works for non-engineering teams too",
        ],
        considerations: [
          "Breadth can feel overwhelming",
          "Release structure is something you configure",
        ],
        compare: "/vs/clickup",
      },
      {
        name: "monday dev",
        site: "https://monday.com",
        bestFor: "Teams already on monday.com",
        summary:
          "monday.com's product for software teams, adding sprints, roadmaps and bug tracking to customisable boards.",
        strengths: [
          "Highly customisable boards",
          "Automations and dashboards",
          "Shares a platform with other monday teams",
        ],
        considerations: [
          "You design much of the structure yourself",
          "Board-based rather than a connected graph",
        ],
        compare: "/vs/monday",
      },
      {
        name: "Asana",
        site: "https://asana.com",
        bestFor: "Company-wide work management",
        summary:
          "A work management tool for projects across departments, with lists, boards, timelines, goals and portfolios.",
        strengths: [
          "Clear, approachable interface",
          "Strong cross-team planning",
          "Goals and portfolios for leadership",
        ],
        considerations: [
          "Not built specifically for software releases",
          "Bugs and releases are modelled with tasks and projects",
        ],
        compare: "/vs/asana",
      },
      {
        name: "GitHub Projects",
        site: "https://github.com/features/issues",
        bestFor: "Small teams that live in GitHub",
        summary:
          "Planning tables and boards built on GitHub issues and pull requests, right next to the code.",
        strengths: [
          "Lives where the code is",
          "Issues and PRs linked natively",
          "Simple for small teams",
        ],
        considerations: [
          "Limited for non-developers writing specs",
          "Release and roadmap views are basic",
        ],
      },
    ],
    choose: [
      {
        if: "You want to see whole releases and keep specs on the work",
        then: "Zelo",
      },
      {
        if: "Your priority is the fastest issue tracker for engineers",
        then: "Linear",
      },
      {
        if: "You need one tool for every department",
        then: "ClickUp or Asana",
      },
      { if: "You already run the company on monday.com", then: "monday dev" },
      {
        if: "You are a small team that lives in GitHub",
        then: "GitHub Projects",
      },
    ],
    faqs: [
      {
        q: "What is the best alternative to Jira?",
        a: "It depends on what you dislike about Jira. For a visual view of releases with specs on the work, Zelo. For the fastest engineering issue tracker, Linear. For one tool across departments, ClickUp or Asana.",
      },
      {
        q: "Is it hard to switch from Jira?",
        a: "Most tools offer a Jira importer. The harder part is habits: run the new tool on one release first, keep Jira read-only for history, then move the rest.",
      },
      {
        q: "Who wrote this list?",
        a: "The Zelo team. We included Zelo, but tried to describe every tool fairly; check each product's own site for current features and pricing.",
      },
    ],
  },
  {
    slug: "clickup",
    tool: "ClickUp",
    metaTitle: "Best ClickUp alternatives for software teams (2026)",
    metaDescription:
      "Six ClickUp alternatives for software teams, compared fairly: what each is best for, its strengths and what to consider before switching.",
    intro:
      "ClickUp can do almost anything, which is exactly why some software teams find it noisy. Here are six alternatives, what each does best, and how to choose.",
    why: [
      "There are so many features and views that the important ones get lost",
      "Release structure is something you have to build and maintain yourself",
      "Engineering wants something more focused on shipping",
    ],
    picks: [
      { ...ZELO("ClickUp"), compare: "/vs/clickup" },
      {
        name: "Linear",
        site: "https://linear.app",
        bestFor: "Focused engineering work",
        summary:
          "A fast issue tracker with cycles, projects and initiatives, designed for software teams.",
        strengths: [
          "Fast and focused",
          "Opinionated defaults",
          "Developer-friendly integrations",
        ],
        considerations: [
          "List-first rather than visual",
          "Less suited to non-engineering teams",
        ],
        compare: "/vs/linear",
      },
      {
        name: "Notion",
        site: "https://www.notion.com",
        bestFor: "Docs-first teams",
        summary:
          "A flexible workspace of pages, wikis and databases that teams shape into their own systems.",
        strengths: [
          "Excellent docs and wikis",
          "Flexible databases",
          "Widely used for knowledge",
        ],
        considerations: [
          "Project tracking is something you build",
          "No built-in release structure",
        ],
        compare: "/vs/notion",
      },
      {
        name: "Asana",
        site: "https://asana.com",
        bestFor: "Clear cross-team planning",
        summary:
          "Work management with lists, boards, timelines, goals and portfolios for teams across a company.",
        strengths: [
          "Approachable and clear",
          "Good for cross-team projects",
          "Goals and portfolios",
        ],
        considerations: ["Not built specifically for software releases"],
        compare: "/vs/asana",
      },
      {
        name: "monday.com",
        site: "https://monday.com",
        bestFor: "Custom workflows on boards",
        summary:
          "A flexible platform of boards, columns and automations, with monday dev for software teams.",
        strengths: [
          "Very customisable",
          "Automations and dashboards",
          "Broad template library",
        ],
        considerations: ["You design much of the system yourself"],
        compare: "/vs/monday",
      },
      {
        name: "Jira",
        site: "https://www.atlassian.com/software/jira",
        bestFor: "Large engineering organisations",
        summary:
          "Atlassian's issue and project tracker with deep workflow configuration and a large marketplace.",
        strengths: [
          "Deep process control",
          "Huge ecosystem of apps",
          "Common in enterprises",
        ],
        considerations: [
          "Configuration-heavy",
          "Docs usually live in Confluence",
        ],
        compare: "/vs/jira",
      },
    ],
    choose: [
      {
        if: "You want release structure built in, as a visual map",
        then: "Zelo",
      },
      {
        if: "Engineering wants the fastest, most focused tracker",
        then: "Linear",
      },
      { if: "Your team thinks in docs first", then: "Notion" },
      { if: "You need clear planning across departments", then: "Asana" },
      {
        if: "You want to design your own system on boards",
        then: "monday.com",
      },
      { if: "You need deep enterprise process control", then: "Jira" },
    ],
    faqs: [
      {
        q: "What is the best alternative to ClickUp?",
        a: "For software teams that want release structure built in, Zelo. For a focused engineering tracker, Linear. For docs-first teams, Notion. For cross-department planning, Asana.",
      },
      {
        q: "Should my whole company leave ClickUp?",
        a: "Not necessarily. Many companies keep a general tool for other departments and give the product team something built for shipping software.",
      },
      {
        q: "Who wrote this list?",
        a: "The Zelo team. We included Zelo, but tried to describe every tool fairly; check each product's own site for current features and pricing.",
      },
    ],
  },
];

export const getAlternatives = (slug: string) =>
  ALTERNATIVES.find((a) => a.slug === slug);
