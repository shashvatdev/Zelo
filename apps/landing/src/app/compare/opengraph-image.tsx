import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt =
  "Switching to Zelo from Jira or ClickUp, without starting over";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="Compare"
      line1="Switching to Zelo,"
      line2="without starting over."
      sub="How Zelo compares to Jira and ClickUp, and what comes with you."
    />,
    { ...size },
  );
}
