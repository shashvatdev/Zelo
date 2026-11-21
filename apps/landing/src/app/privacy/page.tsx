import LegalPage from "@/components/page/LegalPage";
import { pageMetadata } from "@/lib/seo";

const title = "Privacy policy | Zelo";
const description =
  "How Zelo collects, uses and protects personal data on its website and in the Zelo product.";

export const metadata = pageMetadata({ path: "/privacy", title, description });

// Placeholders in [brackets] must be replaced, and the policy reviewed by a lawyer, before launch.
export default function PrivacyPage() {
  return (
    <LegalPage
      path="/privacy"
      name="Privacy policy"
      title={title}
      description={description}
      updated="2026-11-21"
      intro={`This policy explains what personal data Zelo collects, why, and the choices you have. Zelo is operated by [Company legal name] ("Zelo", "we"), registered at [Registered address].`}
      sections={[
        {
          heading: "What we collect",
          paragraphs: [
            "We keep data collection to what we need to run the website and, later, the product.",
          ],
          list: [
            "Waitlist: your email address when you join the waitlist.",
            "Product (when available): your name, email, workspace details and the content you create, such as tickets, docs and comments.",
            "Technical data: our hosting provider records standard server logs, such as IP address, browser type and pages requested, to keep the service secure and working.",
          ],
        },
        {
          heading: "Cookies and browser storage",
          paragraphs: [
            "The website does not use advertising or analytics cookies. It stores two small settings in your browser: whether you muted the sound (local storage) and whether you have already seen the intro film in this tab (session storage). These never leave your device.",
            "Fonts and audio are served from our own servers, so loading the site does not send your data to font or media providers.",
          ],
        },
        {
          heading: "How we use your data",
          list: [
            "To send you updates about early access if you joined the waitlist.",
            "To provide, secure and improve the product.",
            "To respond when you contact us.",
            "To meet legal obligations.",
          ],
        },
        {
          heading: "AI features",
          paragraphs: [
            "When you use AI features in the product, the relevant content is sent to our AI provider to generate a response. Customer content is never used to train AI models, by us or by our providers under our agreements with them.",
          ],
        },
        {
          heading: "Sharing",
          paragraphs: [
            "We do not sell personal data. We share it only with service providers who help us run Zelo, such as hosting, email and AI providers, under contracts that limit their use of it, or when the law requires.",
          ],
        },
        {
          heading: "Where data is stored and how long",
          paragraphs: [
            "Data is stored with our hosting provider in [Region]. Waitlist emails are kept until you unsubscribe or the waitlist closes. Product data is kept while your account is active and deleted within [30] days of account deletion, except where we must keep it longer by law.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "Depending on where you live, including under the GDPR and India's Digital Personal Data Protection Act, you can ask to access, correct, export or delete your personal data, and withdraw consent at any time. Email us and we will respond within the time the law requires.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "We protect data with encryption in transit and at rest, tenant isolation in the database and strict access controls. See our security page for details.",
          ],
        },
        {
          heading: "Children",
          paragraphs: [
            "Zelo is a business tool and is not intended for children under 16.",
          ],
        },
        {
          heading: "Changes and contact",
          paragraphs: [
            "We will update this page when our practices change and note the date at the top. For any privacy question or request, contact [privacy@your-domain] or write to [Registered address].",
          ],
        },
      ]}
    />
  );
}
