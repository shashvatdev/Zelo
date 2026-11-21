import { ImageResponse } from "next/og";
import { TEMPLATES, getTemplate } from "@/content/templates";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return TEMPLATES.map((x) => ({ slug: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const x = getTemplate(slug) ?? TEMPLATES[0];
  return new ImageResponse(
    <OgCard
      kicker={"Free template"}
      line1={x.name.replace(/ template$/i, "")}
      line2={"template, free."}
      sub={"Copy as Markdown or download. Built for software teams."}
    />,
    { ...size },
  );
}
