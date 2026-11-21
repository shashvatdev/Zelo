import type { Metadata } from "next";
import { Suspense } from "react";
import Signup from "@/components/auth/Signup";

export const metadata: Metadata = { title: "Create your account · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Signup />
    </Suspense>
  );
}
