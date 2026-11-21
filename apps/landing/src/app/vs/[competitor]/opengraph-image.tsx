import { ImageResponse } from "next/og";
import { COMPETITORS, getCompetitor } from "@/lib/competitors";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo compared with another project management tool";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const c = getCompetitor(competitor) ?? COMPETITORS[0];
  return new ImageResponse(
    <OgCard
      kicker={`Zelo vs ${c.name}`}
      line1={c.headline[0]}
      line2={c.headline[1]}
      sub={`A visual ${c.name} alternative: every ticket connected to its feature and release.`}
    />,
    { ...size },
  );
}
