import { ImageResponse } from "next/og";
import { TERMS, getTerm, QUESTIONS } from "@/content/glossary";
import { OG_SIZE, OgCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zelo: visual project management for software teams";

export function generateStaticParams() {
  return TERMS.map((x) => ({ term: x.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const x = getTerm(term) ?? TERMS[0];
  return new ImageResponse(
    <OgCard
      kicker={"Glossary"}
      line1={QUESTIONS[x.slug] ?? x.term}
      line2={"Defined simply."}
      sub={x.short.length > 110 ? x.short.slice(0, 107) + "..." : x.short}
    />,
    { ...size },
  );
}
