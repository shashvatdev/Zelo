"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/account";

/** "/" sends signed-in people to their map and everyone else to log in. */
export default function RootRedirect() {
  const { me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me !== undefined) router.replace(me ? "/app" : "/login");
  }, [me, router]);
  return <div className="boot" aria-busy="true" />;
}
