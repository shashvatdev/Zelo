import type { Metadata } from "next";
import { Suspense } from "react";
import Settings from "@/components/settings/Settings";

export const metadata: Metadata = { title: "Settings · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Settings />
    </Suspense>
  );
}
