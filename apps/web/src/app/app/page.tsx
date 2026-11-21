import type { Metadata } from "next";
import Workspace from "@/components/Workspace";

export const metadata: Metadata = { title: "Product map · Zelo" };

export default function AppPage() {
  return <Workspace />;
}
