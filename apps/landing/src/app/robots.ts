import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Everything is public, including AI search crawlers, so Zelo can be cited in AI answers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
