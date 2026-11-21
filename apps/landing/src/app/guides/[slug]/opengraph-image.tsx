import { ImageResponse } from "next/og";
import { GUIDES, getGuide } from "@/content/guides";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return GUIDES.map((x) => ({ slug: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const x = getGuide(slug) ?? GUIDES[0];
  return new ImageResponse(
    <OgCard
      kicker={`Guide · ${x.minutes} min read`}
      line1={x.title}
      line2={"A practical guide."}
      sub={"By Shashvat Singh, founder of Zelo."}
    />,
    { ...size },
  );
}
