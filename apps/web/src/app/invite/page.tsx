import type { Metadata } from "next";
import { Suspense } from "react";
import AcceptInvite from "@/components/auth/AcceptInvite";

export const metadata: Metadata = { title: "Join your team · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <AcceptInvite />
    </Suspense>
  );
}
