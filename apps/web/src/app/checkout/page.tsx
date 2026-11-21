import type { Metadata } from "next";
import { Suspense } from "react";
import Checkout from "@/components/auth/Checkout";

export const metadata: Metadata = { title: "Choose your plan · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Checkout />
    </Suspense>
  );
}
