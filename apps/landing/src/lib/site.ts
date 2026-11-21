/**
 * Site-wide facts used by metadata, structured data, the sitemap and the FAQ section.
 * Set NEXT_PUBLIC_SITE_URL to the real domain before deploying; canonical URLs,
 * Open Graph images and the sitemap are all built from it.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"
).replace(/\/$/, "");

export const SITE = {
  name: "Zelo",
  title: "Zelo: Visual Project Management, a Jira and ClickUp Alternative",
  shortTitle: "Zelo: work isn't a list, it's a map",
  description:
    "Zelo maps every ticket to its feature and release on one living canvas, with docs and AI built in. A visual alternative to Jira and ClickUp for software teams.",
  tagline: "Work isn't a list. It's a map.",
};

/** Shown on the page and sent as FAQPage structured data. Keep both in sync by editing only here. */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Zelo?",
    a: "Zelo is a visual project management tool for software teams. Every ticket is connected to its feature, every feature to its release, and every spec lives on the work it describes, all on one living canvas instead of a flat list. AI reads that map to answer questions and draft tickets.",
  },
  {
    q: "How is Zelo different from Jira and ClickUp?",
    a: "Jira and ClickUp organise work mainly as lists and boards. Zelo shows the same work as a connected map of modules, releases, features and tickets, with status rolling up the tree. You can see what belongs where, and how far a release has come, without a status meeting.",
  },
  {
    q: "Who is Zelo for?",
    a: "Software teams of roughly 20 to 200 people where product managers, developers, QA and the business team work on the same releases. Agencies that run several client products are a strong fit too, since each client gets its own map.",
  },
  {
    q: "Can we move from Jira or ClickUp?",
    a: "Yes. One-click import from Jira, ClickUp and Linear is planned for the beta, so your existing tickets arrive already arranged on the map by module and release.",
  },
  {
    q: "How does Zelo use AI?",
    a: "Zelo's AI reads the whole graph, so it knows which ticket belongs to which feature and release. It drafts tickets from a spec, answers questions from a feature's docs, flags what is blocking a release and writes release notes. People approve every change, and customer data is never used to train models.",
  },
  {
    q: "Is Zelo free?",
    a: "Zelo is free while in beta. After launch there will be a free plan for small teams and paid plans per user for growing companies. Join the waitlist for early access.",
  },
];
