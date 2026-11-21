import type { Metadata } from "next";
import { SITE, SITE_URL } from "./site";

/**
 * Metadata for a secondary page: title, description, canonical, Open Graph and Twitter.
 * `ownImage` = the route has its own opengraph-image file; otherwise the home image is used.
 */
export function pageMetadata({
  path,
  title,
  description,
  ownImage = false,
  type = "website",
}: {
  path: string;
  title: string;
  description: string;
  ownImage?: boolean;
  type?: "website" | "article";
}): Metadata {
  const images = ownImage
    ? undefined
    : [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: SITE.shortTitle,
        },
      ];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      siteName: SITE.name,
      title,
      description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images: ["/opengraph-image"] } : {}),
    },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: SITE.name, path: "" }, ...crumbs].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function webPageLd(path: string, name: string, description: string) {
  return {
    "@type": "WebPage",
    "@id": `${SITE_URL}${path}`,
    url: `${SITE_URL}${path}`,
    name,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
}

export const ldGraph = (...nodes: object[]) => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

export const FOUNDER = { name: "Shashvat Singh", role: "Founder" };
export const PUBLISHED = "2026-11-21";
