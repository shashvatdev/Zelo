import { APP_URL } from "@/lib/site";
import Faq from "@/components/Faq";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import { JsonLd, PageHero } from "@/components/page/PageBits";
import {
  breadcrumbLd,
  faqLd,
  ldGraph,
  pageMetadata,
  webPageLd,
} from "@/lib/seo";

const title = "Zelo pricing: free while in beta, simple per-user plans after";
const description =
  "Zelo is free while in beta. After launch: a free plan for small teams, Team and Business plans per user, and Enterprise with SSO and data residency.";

export const metadata = pageMetadata({ path: "/pricing", title, description });

const PLANS = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    for: "Small teams trying Zelo",
    features: [
      "Up to 5 users",
      "1 product, 3 active releases",
      "Canvas, docs and workflows",
      "Limited AI",
    ],
  },
  {
    name: "Team",
    price: "~$10",
    per: "per user / month",
    for: "Startups and small product teams",
    features: [
      "Unlimited releases",
      "Docs on every node",
      "Custom workflows and automations",
      "Integrations",
      "AI credits included",
    ],
    featured: true,
  },
  {
    name: "Business",
    price: "~$20",
    per: "per user / month",
    for: "Growing companies and agencies",
    features: [
      "Everything in Team",
      "Multiple products and a portfolio view",
      "Advanced AI and reports",
      "Guest access for clients",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "annual contract",
    for: "Organisations with 500+ people",
    features: [
      "SSO / SAML and SCIM",
      "Audit logs and data residency",
      "Private cloud option",
      "SLA and dedicated support",
    ],
  },
];

const FAQS = [
  {
    q: "Is Zelo free right now?",
    a: "Yes. Zelo is free for everyone in the beta. Beta teams will get notice and a discount before any paid plan starts.",
  },
  {
    q: "Are these final prices?",
    a: "Not yet. The prices shown are planned, billed yearly, and may change before launch based on feedback from beta teams.",
  },
  {
    q: "How is AI usage charged?",
    a: "Paid plans include AI credits for everyday use, such as drafting tickets and answering questions. Teams with heavy AI usage, such as agents or bulk ticket generation, will be able to add credit packs.",
  },
  {
    q: "Who counts as a user?",
    a: "Anyone who can edit work in your workspace. Guests with view-only access, such as clients, are planned to be free on Business and Enterprise.",
  },
];

export default function PricingPage() {
  const crumbs = [{ name: "Pricing", path: "/pricing" }];
  return (
    <>
      <JsonLd
        data={ldGraph(
          webPageLd("/pricing", title, description),
          breadcrumbLd(crumbs),
          faqLd(FAQS),
        )}
      />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow="simple, per user"
          title="Free while in beta."
          accent="Fair when we launch."
          lede="Everyone uses Zelo free during the beta. Here is what we plan to charge after launch, so you can decide with no surprises."
          actions={false}
        >
          <p className="beta-pill">Beta: every plan is free today</p>
        </PageHero>

        <section className="section">
          <div className="plans">
            {PLANS.map((p, i) => (
              <Reveal
                key={p.name}
                delay={i * 0.06}
                className={p.featured ? "plan plan-featured" : "plan"}
              >
                {p.featured && <span className="plan-tag">Most teams</span>}
                <h2 className="display">{p.name}</h2>
                <p className="plan-for">{p.for}</p>
                <p className="plan-price">
                  <strong>{p.price}</strong> <span>{p.per}</span>
                </p>
                <ul className="ticks">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  href={
                    p.name === "Enterprise"
                      ? "#waitlist"
                      : `${APP_URL}/signup?plan=${p.name.toLowerCase()}`
                  }
                  className={p.featured ? "btn btn-ink" : "btn btn-ghost"}
                >
                  {p.name === "Enterprise"
                    ? "Talk to us"
                    : p.name === "Free"
                      ? "Start free"
                      : `Start ${p.name}`}
                </a>
              </Reveal>
            ))}
          </div>
          <p className="fine">
            Planned prices in USD, billed yearly. Final pricing will be
            announced before the beta ends.
          </p>
        </section>

        <Faq
          items={FAQS}
          title={
            <>
              Pricing, <em>answered</em>.
            </>
          }
        />
      </main>
      <Waitlist />
    </>
  );
}
