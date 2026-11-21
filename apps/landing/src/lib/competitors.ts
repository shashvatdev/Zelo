/**
 * Content for the /vs/[competitor] pages.
 * Keep comparisons fair and factual: describe how each tool works, never claim a competitor
 * lacks something it has.
 */

export type Competitor = {
  slug: string;
  name: string;
  /** Official product page, used as sameAs in structured data. */
  site: string;
  metaTitle: string;
  metaDescription: string;
  headline: [string, string];
  lede: string;
  rows: { topic: string; them: string; zelo: string }[];
  switchSteps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

export const COMPETITORS: Competitor[] = [
  {
    slug: "jira",
    name: "Jira",
    site: "https://www.atlassian.com/software/jira",
    metaTitle: "Zelo vs Jira: a visual Jira alternative for software teams",
    metaDescription:
      "Compare Zelo and Jira. Zelo connects every ticket to its feature and release on one living canvas, with specs on the work and AI that reads the whole map.",
    headline: ["Jira tracks issues.", "Zelo shows the whole release."],
    lede: "Zelo is a visual Jira alternative for product teams. Instead of assembling a release from filters and boards, you see it as one connected map: modules, features, tickets and the specs behind them.",
    rows: [
      {
        topic: "Main view",
        them: "Lists, boards and backlogs of issues, with epics grouping related work.",
        zelo: "A canvas where modules, releases, features and tickets are connected nodes.",
      },
      {
        topic: "Seeing a release",
        them: "Fix versions, filters and reports that you combine to get the picture.",
        zelo: "The release is a tree; progress rolls up from tickets to features to the release.",
      },
      {
        topic: "Specs and docs",
        them: "Commonly kept in Confluence and linked from issues.",
        zelo: "Written on the feature node itself, right next to the tickets they create.",
      },
      {
        topic: "Product history",
        them: "Found through searches and released versions.",
        zelo: "A product map of every release, grouped by module, from day zero to today.",
      },
      {
        topic: "AI",
        them: "Atlassian offers AI features across issues and pages.",
        zelo: "AI reads the graph, so it knows which ticket belongs to which feature and release.",
      },
      {
        topic: "Setup",
        them: "Highly configurable: workflows, schemes, custom fields and permissions.",
        zelo: "Start from your modules with sensible defaults; customise workflows when you need to.",
      },
      {
        topic: "Best for",
        them: "Large engineering organisations that need deep process control.",
        zelo: "Product teams who want to see the whole release at a glance.",
      },
    ],
    switchSteps: [
      {
        title: "Connect Jira",
        body: "Sign in with your Atlassian account and pick the projects to bring over.",
      },
      {
        title: "Map it",
        body: "Epics become features, fix versions become releases, issues land under the right feature.",
      },
      {
        title: "Run both for a sprint",
        body: "Keep Jira open while your team tries the map; switch when it feels obvious.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo a Jira replacement?",
        a: "For product and engineering teams that ship releases, yes: Zelo covers planning, tickets, workflows and release tracking, with specs on the work. Teams that rely on Jira's deep process configuration or its marketplace apps may want to run both during a trial.",
      },
      {
        q: "Can I import my Jira projects?",
        a: "One-click import from Jira is planned for the beta. Epics are mapped to features, fix versions to releases, and issues to tickets under the right feature, so your work arrives already arranged on the map.",
      },
      {
        q: "Does Zelo work with GitHub?",
        a: "A GitHub integration is planned: branches and pull requests that mention a ticket key link to that ticket automatically, and a merge can move the ticket to QA.",
      },
    ],
  },
  {
    slug: "clickup",
    name: "ClickUp",
    site: "https://clickup.com",
    metaTitle: "Zelo vs ClickUp: the visual ClickUp alternative",
    metaDescription:
      "Compare Zelo and ClickUp. Zelo is built for shipping software: every ticket tied to its feature and release on one canvas, with AI that reads the map.",
    headline: ["ClickUp organises tasks.", "Zelo connects them."],
    lede: "Zelo is a visual ClickUp alternative built for software releases. Every ticket sits under its feature, every feature points at its release, and the whole thing is one map instead of many lists.",
    rows: [
      {
        topic: "Main view",
        them: "Tasks in spaces, folders and lists, shown in many views such as list, board and Gantt.",
        zelo: "One canvas where modules, releases, features and tickets are connected nodes.",
      },
      {
        topic: "Seeing a release",
        them: "Built from lists, custom fields and dashboards that you configure.",
        zelo: "The release is a tree out of the box; progress rolls up node by node.",
      },
      {
        topic: "Docs",
        them: "ClickUp Docs live alongside tasks in the workspace.",
        zelo: "Docs sit on the exact feature node they describe, beside its tickets.",
      },
      {
        topic: "Scope",
        them: "A broad workspace: tasks, docs, chat, goals and whiteboards for every department.",
        zelo: "Focused on one job: planning and shipping software releases.",
      },
      {
        topic: "AI",
        them: "ClickUp Brain works across tasks and docs.",
        zelo: "AI reads the graph, so answers know which ticket belongs to which feature and release.",
      },
      {
        topic: "Product history",
        them: "Archived lists and completed tasks.",
        zelo: "A product map of every release, grouped by module, from day zero to today.",
      },
      {
        topic: "Best for",
        them: "Teams that want one flexible tool for every department.",
        zelo: "Software teams that want to see release structure at a glance.",
      },
    ],
    switchSteps: [
      {
        title: "Connect ClickUp",
        body: "Authorise your workspace and choose the spaces your product team uses.",
      },
      {
        title: "Map it",
        body: "Lists become features or releases, tasks become tickets, docs attach to their features.",
      },
      {
        title: "Run both for a sprint",
        body: "Keep ClickUp for the rest of the company while your product team tries the map.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo a ClickUp alternative?",
        a: "For software teams, yes. ClickUp is a broad workspace for every department; Zelo focuses on shipping releases, with tickets, features, releases and specs connected on one canvas and status that rolls up automatically.",
      },
      {
        q: "Can I import from ClickUp?",
        a: "One-click import from ClickUp is planned for the beta. Lists can be mapped to features or releases, tasks to tickets, and docs to the features they describe.",
      },
      {
        q: "Does Zelo have docs like ClickUp?",
        a: "Yes. Every node in Zelo can hold a rich doc, such as a PRD, spec or design notes. The difference is placement: the doc lives on the feature it describes, so developers open the ticket and the spec is right there.",
      },
    ],
  },
];

export const getCompetitor = (slug: string) =>
  COMPETITORS.find((c) => c.slug === slug);
