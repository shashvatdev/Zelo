"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { nextPath, useMe } from "@/lib/account";

/** "/" sends signed-in people to wherever they left off (plan, setup or their map), everyone else to log in. */
export default function RootRedirect() {
  const { me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me !== undefined) router.replace(me ? nextPath(me) : "/login");
  }, [me, router]);
  return <div className="boot" aria-busy="true" />;
}
