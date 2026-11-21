import { ImageResponse } from "next/og";
import { TEAMS, getTeam } from "@/content/landings";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return TEAMS.map((x) => ({ slug: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const x = getTeam(slug) ?? TEAMS[0];
  return new ImageResponse(
    <OgCard
      kicker={`Zelo for ${x.label.toLowerCase()}`}
      line1={x.title}
      line2={x.accent}
      sub={x.metaDescription.split(". ")[0] + "."}
    />,
    { ...size },
  );
}
