import { ImageResponse } from "next/og";
import { ALTERNATIVES, getAlternatives } from "@/content/alternatives";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return ALTERNATIVES.map((x) => ({ tool: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const x = getAlternatives(tool) ?? ALTERNATIVES[0];
  return new ImageResponse(
    <OgCard
      kicker={"Compare"}
      line1={`${x.picks.length} ${x.tool} alternatives`}
      line2={"for software teams."}
      sub={"Fairly compared: what each tool is best for, and how to choose."}
    />,
    { ...size },
  );
}
