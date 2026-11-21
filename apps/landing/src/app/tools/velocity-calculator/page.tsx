import ToolPage from "@/components/page/ToolPage";
import VelocityTool from "@/components/tools/VelocityTool";
import { getTool } from "@/content/tools";
import { pageMetadata } from "@/lib/seo";

const tool = getTool("velocity-calculator")!;

export const metadata = pageMetadata({
  path: "/tools/velocity-calculator",
  title: tool.metaTitle,
  description: tool.metaDescription,
  ownImage: true,
});

export default function Page() {
  return (
    <ToolPage tool={tool}>
      <VelocityTool />
    </ToolPage>
  );
}
