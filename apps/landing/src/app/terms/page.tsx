import LegalPage from "@/components/page/LegalPage";
import { pageMetadata } from "@/lib/seo";

const title = "Terms of service | Zelo";
const description =
  "The terms that apply when you use the Zelo website and the Zelo product, including during the beta.";

export const metadata = pageMetadata({ path: "/terms", title, description });

// Placeholders in [brackets] must be replaced, and the terms reviewed by a lawyer, before launch.
export default function TermsPage() {
  return (
    <LegalPage
      path="/terms"
      name="Terms of service"
      title={title}
      description={description}
      updated="2026-11-21"
      intro={`These terms are an agreement between you and [Company legal name] ("Zelo", "we") for using the Zelo website and product. By using Zelo you agree to them; if you use Zelo for an organisation, you agree on its behalf.`}
      sections={[
        {
          heading: "The beta",
          paragraphs: [
            "Zelo is in beta. Features may change, be removed or not work as expected, and the service may be interrupted. We will do our best to protect your data and give notice of major changes.",
          ],
        },
        {
          heading: "Accounts",
          paragraphs: [
            "Keep your login details secure and tell us about any unauthorised use. You are responsible for activity in your account and for making sure the people you invite follow these terms.",
          ],
        },
        {
          heading: "Your content",
          paragraphs: [
            "You own the content you put into Zelo. You give us permission to host, process and display it only as needed to provide the service to you. We do not use your content to train AI models.",
          ],
        },
        {
          heading: "Acceptable use",
          list: [
            "Don't break the law or infringe others' rights.",
            "Don't try to access other customers' data or probe the service without permission.",
            "Don't disrupt or overload the service, or reverse engineer it except where the law allows.",
            "Don't upload malware or content you don't have the right to share.",
          ],
        },
        {
          heading: "AI features",
          paragraphs: [
            "AI features generate suggestions that can be wrong. Review them before relying on them; actions that change your data are proposals that you approve.",
          ],
        },
        {
          heading: "Fees",
          paragraphs: [
            "Zelo is free during the beta. Before any paid plan applies to you, we will tell you the price and you can choose whether to continue.",
          ],
        },
        {
          heading: "Ending use",
          paragraphs: [
            "You can stop using Zelo at any time and ask us to delete your data. We may suspend or end access if these terms are seriously or repeatedly broken, with notice where reasonable.",
          ],
        },
        {
          heading: "Disclaimers and liability",
          paragraphs: [
            'The service is provided "as is" during the beta, without warranties to the extent the law allows. To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim (or [an amount] if you paid nothing).',
          ],
        },
        {
          heading: "Changes and governing law",
          paragraphs: [
            "We may update these terms and will note the date at the top; material changes will be notified in advance. These terms are governed by the laws of [Country / State], and disputes are subject to the courts of [City].",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            "Questions about these terms: [legal@your-domain], [Registered address].",
          ],
        },
      ]}
    />
  );
}
