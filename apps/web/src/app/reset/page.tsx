import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPassword from "@/components/auth/ResetPassword";

export const metadata: Metadata = { title: "Reset password · Zelo", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <ResetPassword />
    </Suspense>
  );
}
