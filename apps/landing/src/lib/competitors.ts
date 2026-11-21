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
  {
    slug: "linear",
    name: "Linear",
    site: "https://linear.app",
    metaTitle: "Zelo vs Linear: a visual Linear alternative",
    metaDescription:
      "Compare Zelo and Linear. Linear is a fast issue tracker; Zelo maps every ticket to its feature, module and release on one canvas, with specs on the work.",
    headline: ["Linear makes issues fast.", "Zelo makes releases visible."],
    lede: "Zelo is a visual Linear alternative for teams who want to see how the work fits together: modules, releases, features and tickets on one connected map, with the business team's specs right on the work.",
    rows: [
      {
        topic: "Main view",
        them: "Fast, keyboard-first lists and boards of issues, grouped by team, cycle and project.",
        zelo: "A canvas of connected nodes: modules, releases, features and tickets.",
      },
      {
        topic: "Planning",
        them: "Cycles for sprints, projects and initiatives for bigger goals.",
        zelo: "Releases as trees, with features from any module and progress rolling up.",
      },
      {
        topic: "Docs",
        them: "Project documents and descriptions alongside issues.",
        zelo: "A rich doc on every node, so the spec sits on the exact feature it describes.",
      },
      {
        topic: "Who uses it",
        them: "Mostly engineering and product teams.",
        zelo: "The whole release team: PMs, developers, QA and the business side.",
      },
      {
        topic: "Product history",
        them: "Completed cycles, projects and issue history.",
        zelo: "A product map of every release by module, from day zero to today.",
      },
      {
        topic: "Best for",
        them: "Engineering teams who want the fastest issue tracker.",
        zelo: "Teams who want to see the whole product and release at a glance.",
      },
    ],
    switchSteps: [
      {
        title: "Connect Linear",
        body: "Authorise your workspace and pick the teams and projects to bring over.",
      },
      {
        title: "Map it",
        body: "Projects become features, issues become tickets under them, and you choose the release each belongs to.",
      },
      {
        title: "Try it on one release",
        body: "Plan your next release in Zelo and keep Linear open until the team prefers the map.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo a Linear alternative?",
        a: "For teams that want a visual map of their product and releases, yes. Linear is a fast, list-first issue tracker loved by engineers; Zelo connects tickets to features, modules and releases on one canvas, with specs and AI built in.",
      },
      {
        q: "Is Zelo as fast as Linear?",
        a: "Speed is a core goal: keyboard shortcuts, a command palette and list views for quick edits, with the canvas when you want the bigger picture.",
      },
      {
        q: "Can I import from Linear?",
        a: "One-click import from Linear is planned for the beta, mapping projects to features and issues to tickets.",
      },
    ],
  },
  {
    slug: "asana",
    name: "Asana",
    site: "https://asana.com",
    metaTitle: "Zelo vs Asana: an Asana alternative for software teams",
    metaDescription:
      "Compare Zelo and Asana. Asana manages work across a company; Zelo is built for software releases, with every ticket tied to its feature and release.",
    headline: ["Asana manages work.", "Zelo ships software."],
    lede: "Zelo is an Asana alternative built for software teams. Instead of projects and task lists, your work is a map of modules, releases, features and tickets, with progress that rolls up to the release.",
    rows: [
      {
        topic: "Main view",
        them: "Projects with lists, boards, timelines and calendars of tasks.",
        zelo: "A canvas where modules, releases, features and tickets are connected nodes.",
      },
      {
        topic: "Built for",
        them: "Work management across departments, from marketing to operations.",
        zelo: "Planning and shipping software releases.",
      },
      {
        topic: "Releases",
        them: "Modelled with projects, sections, milestones or custom fields.",
        zelo: "A first-class release node with a gate, progress and release notes.",
      },
      {
        topic: "Bugs",
        them: "Tracked as tasks, often in a dedicated project or form.",
        zelo: "Attached to the module they break and planned into a release, with regression history.",
      },
      {
        topic: "AI",
        them: "Asana offers AI features for its work graph.",
        zelo: "AI reads the release graph to draft tickets, answer questions and flag blockers.",
      },
      {
        topic: "Best for",
        them: "Company-wide teams coordinating many kinds of projects.",
        zelo: "Software teams who want release structure at a glance.",
      },
    ],
    switchSteps: [
      {
        title: "Connect Asana",
        body: "Choose the projects your product team uses.",
      },
      {
        title: "Map it",
        body: "Projects or sections become features and releases; tasks become tickets.",
      },
      {
        title: "Keep Asana for the rest",
        body: "Other departments can stay in Asana while the product team moves to the map.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo an Asana alternative?",
        a: "For software teams, yes. Asana is a broad work management tool; Zelo focuses on shipping software, with releases, features, tickets and bugs connected on one canvas.",
      },
      {
        q: "Can marketing or ops use Zelo?",
        a: "Zelo is built for the software release team, including the business people who write specs. Company-wide project management for other departments is better served by general tools.",
      },
      {
        q: "Can I import from Asana?",
        a: "An Asana importer is planned, mapping projects and sections to features or releases and tasks to tickets.",
      },
    ],
  },
  {
    slug: "monday",
    name: "monday.com",
    site: "https://monday.com",
    metaTitle: "Zelo vs monday.com: a visual alternative for software releases",
    metaDescription:
      "Compare Zelo and monday.com. monday.com builds custom boards for any workflow; Zelo is a ready-made map of modules, releases, features and tickets.",
    headline: ["monday.com builds boards.", "Zelo maps releases."],
    lede: "Zelo is a monday.com alternative for software teams that would rather not design their own system. The structure is built in: modules, releases, features and tickets, connected on one canvas.",
    rows: [
      {
        topic: "Main view",
        them: "Customisable boards with columns, groups and items, plus dashboards.",
        zelo: "A canvas of connected nodes with the release structure built in.",
      },
      {
        topic: "Setup",
        them: "Very flexible: you design boards, columns and automations for your workflow.",
        zelo: "Opinionated for software: start from modules and releases, customise workflows later.",
      },
      {
        topic: "For software teams",
        them: "monday dev offers sprints, roadmaps and bug tracking on the monday platform.",
        zelo: "Releases, features, tickets and bugs connected as a graph, with specs on the nodes.",
      },
      {
        topic: "Docs",
        them: "monday workdocs live alongside boards.",
        zelo: "Docs live on the exact feature or ticket they describe.",
      },
      {
        topic: "Best for",
        them: "Teams who want to build a custom system for any process.",
        zelo: "Software teams who want release structure out of the box.",
      },
    ],
    switchSteps: [
      {
        title: "Export your boards",
        body: "Pick the boards your product team runs releases on.",
      },
      {
        title: "Map it",
        body: "Groups become features or releases; items become tickets.",
      },
      {
        title: "Run one release",
        body: "Plan the next release in Zelo and compare.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo a monday.com alternative?",
        a: "For software teams, yes. monday.com is a flexible platform you shape into your own system; Zelo comes with the software release structure built in, as a visual map.",
      },
      {
        q: "How does Zelo compare to monday dev?",
        a: "monday dev adds sprints, roadmaps and bugs to the monday platform. Zelo is built around a graph of modules, releases, features and tickets, with specs on each node and AI that reads the whole graph.",
      },
      {
        q: "Can I import from monday.com?",
        a: "A monday.com importer is on the roadmap. Until then, CSV import is the planned path for boards.",
      },
    ],
  },
  {
    slug: "notion",
    name: "Notion",
    site: "https://www.notion.com",
    metaTitle: "Zelo vs Notion: from docs to shipped releases",
    metaDescription:
      "Compare Zelo and Notion. Notion is a flexible docs and database workspace; Zelo connects specs to the features, tickets and releases they create.",
    headline: ["Notion holds the docs.", "Zelo connects them to the work."],
    lede: "Zelo is a Notion alternative for product teams who want their specs and their releases in one place. Docs live on the feature node, tickets hang off it, and the release shows how far the work has come.",
    rows: [
      {
        topic: "Main view",
        them: "Pages, wikis and databases you can shape into any system.",
        zelo: "A canvas of modules, releases, features and tickets, with a doc on every node.",
      },
      {
        topic: "Project tracking",
        them: "Built with databases, properties, relations and views.",
        zelo: "Built in: status rolls up from tickets to features to releases.",
      },
      {
        topic: "Docs",
        them: "Best-in-class flexible documents and wikis.",
        zelo: "Rich docs focused on the work: specs, decisions and designs on the node they describe.",
      },
      {
        topic: "AI",
        them: "Notion AI works across pages and databases.",
        zelo: "AI reads the release graph: tickets from specs, answers about progress, blockers flagged.",
      },
      {
        topic: "Best for",
        them: "Teams who want one flexible workspace for notes, wikis and lightweight tracking.",
        zelo: "Software teams who want specs, tickets and releases connected.",
      },
    ],
    switchSteps: [
      {
        title: "Keep your wiki",
        body: "Company handbooks and notes can stay in Notion.",
      },
      {
        title: "Move product specs",
        body: "Bring PRDs onto their feature nodes in Zelo, where tickets are created from them.",
      },
      {
        title: "Plan a release",
        body: "Watch specs, tickets and progress meet on one map.",
      },
    ],
    faqs: [
      {
        q: "Is Zelo a Notion alternative?",
        a: "For product and engineering work, yes. Notion is a flexible workspace for docs and databases; Zelo is built for shipping software, with specs attached to the features and releases they create.",
      },
      {
        q: "Can I keep using Notion for our wiki?",
        a: "Yes. Many teams keep company wikis in Notion and move product specs and release work to Zelo.",
      },
      {
        q: "Can I import Notion pages?",
        a: "Importing Notion pages as feature docs is planned, so existing PRDs can land on the right nodes.",
      },
    ],
  },
];

export const getCompetitor = (slug: string) =>
  COMPETITORS.find((c) => c.slug === slug);
