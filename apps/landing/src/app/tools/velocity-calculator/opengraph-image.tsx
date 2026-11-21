import { ImageResponse } from "next/og";
import { getTool } from "@/content/tools";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Velocity calculator, a free tool by Zelo";

export default function Image() {
  const t = getTool("velocity-calculator")!;
  return new ImageResponse(
    <OgCard
      kicker="Free tool"
      line1={t.title}
      line2={t.accent}
      sub="Free, no sign-up, runs in your browser."
    />,
    { ...size },
  );
}
