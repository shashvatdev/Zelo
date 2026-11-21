import type { Metadata } from "next";
import { Suspense } from "react";
import Onboarding from "@/components/auth/Onboarding";

export const metadata: Metadata = { title: "Set up your workspace · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Onboarding />
    </Suspense>
  );
}
