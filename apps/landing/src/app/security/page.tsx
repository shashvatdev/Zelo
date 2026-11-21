import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import Waitlist from "@/components/Waitlist";
import { JsonLd, PageHero, SectionHead } from "@/components/page/PageBits";
import { breadcrumbLd, ldGraph, pageMetadata, webPageLd } from "@/lib/seo";

const title = "Security at Zelo: how we protect your work";
const description =
  "How Zelo is built to keep your work safe: tenant isolation in the database, encryption, data residency, SSO, audit logs and AI that never trains on your data.";

export const metadata = pageMetadata({ path: "/security", title, description });

const PRACTICES = [
  {
    title: "Isolation in the database",
    body: "Every record carries its workspace, and row-level security in the database refuses rows from any other workspace. A bug in application code can't expose another company's data.",
  },
  {
    title: "Encryption",
    body: "Data is encrypted in transit with TLS and at rest. Files are stored in encrypted object storage.",
  },
  {
    title: "Your AI data stays yours",
    body: "Customer content is never used to train AI models. AI actions that change data are proposals a person approves, and each one is logged.",
  },
  {
    title: "Access control",
    body: "Roles for owners, admins, members and guests. SSO / SAML and SCIM provisioning are planned for Enterprise.",
  },
  {
    title: "Audit trail",
    body: "Every change is recorded in an append-only event log. Enterprise plans will be able to export it.",
  },
  {
    title: "Data residency",
    body: "Each workspace's data will be pinned to a region, starting with India and the US.",
  },
];

export default function SecurityPage() {
  const crumbs = [{ name: "Security", path: "/security" }];
  return (
    <>
      <JsonLd
        data={ldGraph(
          webPageLd("/security", title, description),
          breadcrumbLd(crumbs),
        )}
      />
      <Nav />
      <main>
        <PageHero
          crumbs={crumbs}
          eyebrow="security"
          title="Your work is"
          accent="your business."
          lede="Zelo is in beta. This page describes how we are building it to keep your work safe, and we mark what is still planned."
          actions={false}
        />
        <section className="section">
          <Reveal>
            <SectionHead
              kicker="How we protect your data"
              title={<>Built in, not bolted on</>}
            />
          </Reveal>
          <div className="feature-grid">
            {PRACTICES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05} className="feature-card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="section article-section">
          <Reveal>
            <SectionHead
              kicker="Report a vulnerability"
              title={<>Found something?</>}
            />
          </Reveal>
          <div className="prose">
            <p>
              If you believe you have found a security issue, please email{" "}
              <strong>security@[your-domain]</strong> with the details and steps
              to reproduce. We will acknowledge your report, keep you updated,
              and credit you once it is fixed if you would like. Please
              don&apos;t access other users&apos; data or disrupt the service
              while testing.
            </p>
          </div>
        </section>
      </main>
      <Waitlist />
    </>
  );
}
