import AiSection from "@/components/AiSection";
import Compare from "@/components/Compare";
import DocsOnNode from "@/components/DocsOnNode";
import Faq from "@/components/Faq";
import Hero from "@/components/hero/Hero";
import HowItWorks from "@/components/HowItWorks";
import Nav from "@/components/Nav";
import Problem from "@/components/Problem";
import ProductMap from "@/components/ProductMap";
import Waitlist from "@/components/Waitlist";
import { FAQS, SITE, SITE_URL } from "@/lib/site";

/** Structured data: who we are, what the product is, and the FAQ, for search engines and AI. */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE.name,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE.name,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE_URL,
      description: SITE.description,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Project management",
      operatingSystem: "Web",
      publisher: { "@id": `${SITE_URL}/#org` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free while in beta",
      },
      featureList: [
        "Visual canvas linking tickets, features, releases and modules",
        "Docs and specs attached to the work they describe",
        "Status that rolls up from tickets to releases",
        "Product history by module and release",
        "AI that drafts tickets and answers questions from the project graph",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <DocsOnNode />
        <ProductMap />
        <AiSection />
        <Compare />
        <Faq />
      </main>
      <Waitlist />
    </>
  );
}
