"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { currentUser, useDb } from "@/lib/account";

/** "/" sends signed-in people to their map and everyone else to log in. */
export default function RootRedirect() {
  const db = useDb();
  const router = useRouter();
  useEffect(() => {
    if (db) router.replace(currentUser(db) ? "/app" : "/login");
  }, [db, router]);
  return <div className="boot" aria-busy="true" />;
}
