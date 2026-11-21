export type ToolInfo = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  accent: string;
  lede: string;
  steps: { name: string; text: string }[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
};

export const TOOLS: ToolInfo[] = [
  {
    slug: "release-notes-generator",
    name: "Release notes generator",
    metaTitle:
      "Free release notes generator: from commits to clean notes | Zelo",
    metaDescription:
      "Paste commit messages, PR or ticket titles and get grouped release notes (new, improved, fixed, breaking) in Markdown. Free, runs in your browser.",
    title: "Release notes,",
    accent: "from a list of changes.",
    lede: "Paste your commit messages, pull request titles or ticket names. The generator groups them into New, Improved, Fixed and Breaking changes and gives you clean Markdown to publish.",
    steps: [
      {
        name: "Paste your changes",
        text: "Add one change per line: commit messages, PR titles or ticket titles all work.",
      },
      {
        name: "Set the version",
        text: "Enter the version and, optionally, the release date.",
      },
      {
        name: "Review the groups",
        text: "Changes are grouped by conventional-commit prefixes (feat, fix, perf) and keywords like add, fix and improve.",
      },
      {
        name: "Copy the Markdown",
        text: "Copy the notes and paste them into your changelog, GitHub release or app store listing.",
      },
    ],
    faqs: [
      {
        q: "Is the release notes generator free?",
        a: "Yes. It is free, needs no sign-up, and runs entirely in your browser; nothing you paste is sent to a server.",
      },
      {
        q: "Which formats does it understand?",
        a: "Conventional commits such as feat:, fix: and perf: (with optional scopes and ! for breaking changes), ticket keys like PAY-142, and plain sentences, which are grouped by keywords.",
      },
      {
        q: "Does Zelo write release notes automatically?",
        a: "Yes. In Zelo, release notes are drafted from the tickets and specs inside a release when it ships, so there is nothing to paste.",
      },
    ],
    related: [
      { href: "/templates/release-notes", label: "Release notes template" },
      { href: "/solutions/release-management", label: "Release management" },
      { href: "/tools/velocity-calculator", label: "Velocity calculator" },
    ],
  },
  {
    slug: "velocity-calculator",
    name: "Velocity calculator",
    metaTitle: "Free sprint velocity calculator and release forecast | Zelo",
    metaDescription:
      "Enter recent sprint points and the work left in a release to forecast how many sprints it needs, with best and worst case dates. Free, runs in your browser.",
    title: "When will it ship?",
    accent: "Ask your velocity.",
    lede: "Enter the story points your team completed in recent sprints and the points left in the release. The calculator averages your velocity and forecasts how many sprints remain, with a best and worst case.",
    steps: [
      {
        name: "Enter recent sprints",
        text: "List the points completed in your last three to six sprints.",
      },
      {
        name: "Enter the work left",
        text: "Add the total points still open in the release.",
      },
      {
        name: "Set sprint length",
        text: "Choose your sprint length in weeks, and optionally the next sprint's start date.",
      },
      {
        name: "Read the forecast",
        text: "See the likely number of sprints and a best-to-worst range based on your fastest and slowest sprints.",
      },
    ],
    faqs: [
      {
        q: "How is velocity calculated?",
        a: "Velocity is the average number of story points a team completes per sprint. This calculator averages the sprints you enter, then divides the remaining points by that average to forecast the sprints left.",
      },
      {
        q: "How many sprints should I include?",
        a: "Three to six recent sprints usually give a stable average. Leave out sprints that were unusual, such as holidays or major incidents.",
      },
      {
        q: "Is the forecast a commitment?",
        a: "No. It is an estimate based on past pace. Use the best-to-worst range to set expectations, and update it as each sprint finishes.",
      },
    ],
    related: [
      { href: "/glossary/velocity", label: "What is velocity?" },
      { href: "/glossary/story-points", label: "What are story points?" },
      {
        href: "/guides/how-to-plan-a-software-release",
        label: "How to plan a release",
      },
    ],
  },
];

export const getTool = (slug: string) => TOOLS.find((t) => t.slug === slug);
