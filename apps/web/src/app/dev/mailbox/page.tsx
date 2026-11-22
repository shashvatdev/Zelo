import type { Metadata } from "next";
import { Suspense } from "react";
import Mailbox from "@/components/dev/Mailbox";

export const metadata: Metadata = { title: "Dev mailbox · Zelo", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Mailbox />
    </Suspense>
  );
}
