import type { MetadataRoute } from "next";
import { ALTERNATIVES } from "@/content/alternatives";
import { TERMS } from "@/content/glossary";
import { GUIDES } from "@/content/guides";
import { SOLUTIONS, TEAMS } from "@/content/landings";
import { TEMPLATES } from "@/content/templates";
import { TOOLS } from "@/content/tools";
import { COMPETITORS } from "@/lib/competitors";
import { SITE_URL } from "@/lib/site";

type Freq = "weekly" | "monthly" | "yearly";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: Freq = "monthly",
  ) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page("", 1, "weekly"),
    page("/pricing", 0.9),
    page("/solutions", 0.8),
    ...SOLUTIONS.map((s) => page(`/solutions/${s.slug}`, 0.8)),
    page("/for", 0.7),
    ...TEAMS.map((t) => page(`/for/${t.slug}`, 0.7)),
    page("/compare", 0.7),
    ...COMPETITORS.map((c) => page(`/vs/${c.slug}`, 0.8)),
    ...ALTERNATIVES.map((a) => page(`/alternatives/${a.slug}`, 0.8)),
    page("/templates", 0.7),
    ...TEMPLATES.map((t) => page(`/templates/${t.slug}`, 0.7)),
    page("/tools", 0.6),
    ...TOOLS.map((t) => page(`/tools/${t.slug}`, 0.7)),
    page("/guides", 0.6),
    ...GUIDES.map((g) => page(`/guides/${g.slug}`, 0.7)),
    page("/glossary", 0.6),
    ...TERMS.map((t) => page(`/glossary/${t.slug}`, 0.5)),
    page("/about", 0.5, "yearly"),
    page("/changelog", 0.5, "weekly"),
    page("/security", 0.4, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/terms", 0.2, "yearly"),
  ];
}
