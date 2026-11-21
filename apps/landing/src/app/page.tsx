import AiSection from "@/components/AiSection";
import Compare from "@/components/Compare";
import CursorLabel from "@/components/CursorLabel";
import DocsOnNode from "@/components/DocsOnNode";
import Hero from "@/components/hero/Hero";
import HowItWorks from "@/components/HowItWorks";
import Nav from "@/components/Nav";
import Problem from "@/components/Problem";
import ProductMap from "@/components/ProductMap";
import Waitlist from "@/components/Waitlist";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <DocsOnNode />
        <ProductMap />
        <AiSection />
        <Compare />
      </main>
      <Waitlist />
      <CursorLabel />
    </>
  );
}
