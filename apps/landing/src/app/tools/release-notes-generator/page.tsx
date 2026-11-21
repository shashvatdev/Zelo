import ToolPage from "@/components/page/ToolPage";
import ReleaseNotesTool from "@/components/tools/ReleaseNotesTool";
import { getTool } from "@/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = getTool("release-notes-generator")!;

export const metadata = pageMetadata({
  path: "/tools/release-notes-generator",
  title: tool.metaTitle,
  description: tool.metaDescription,
  ownImage: true,
});

export default function Page() {
  return (
    <ToolPage tool={tool}>
      <ReleaseNotesTool />
    </ToolPage>
  );
}
