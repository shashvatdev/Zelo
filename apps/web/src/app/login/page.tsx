import type { Metadata } from "next";
import { Suspense } from "react";
import Login from "@/components/auth/Login";

export const metadata: Metadata = { title: "Log in · Zelo" };

export default function Page() {
  return (
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <Login />
    </Suspense>
  );
}
