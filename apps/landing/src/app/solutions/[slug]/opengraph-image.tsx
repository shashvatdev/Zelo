import { ImageResponse } from "next/og";
import { SOLUTIONS, getSolution } from "@/content/landings";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return SOLUTIONS.map((x) => ({ slug: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const x = getSolution(slug) ?? SOLUTIONS[0];
  return new ImageResponse(
    <OgCard
      kicker={"Solution"}
      line1={x.title}
      line2={x.accent}
      sub={x.metaDescription.split(". ")[0] + "."}
    />,
    { ...size },
  );
}
