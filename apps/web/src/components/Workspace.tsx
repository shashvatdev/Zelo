"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { currentUser, currentWorkspace, peopleOf, useDb, type User, type Workspace as Ws } from "@/lib/account";
import { graphKey } from "@/data/fresh";
import type { Graph } from "@/data/model";
import { SEED } from "@/data/seed";
import { StoreProvider, useStore } from "@/lib/store";
import AskZelo from "./AskZelo";
import Canvas from "./Canvas";
import GettingStarted from "./GettingStarted";
import Panel from "./Panel";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function Shell({ ws, users }: { ws: Ws; users: User[] }) {
  const { state, dispatch } = useStore();

  // Members who accepted their invite join the board as people.
  const people = useMemo(() => peopleOf(ws, users), [ws, users]);
  useEffect(() => {
    dispatch({ type: "syncPeople", people });
  }, [people, dispatch]);

  // ⌘K copilot, ⌘\ sidebar, and no page zoom on trackpad pinch (the canvas zooms instead).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch({ type: "ask" });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        dispatch({ type: "side" });
      }
    };
    const noPageZoom = (e: WheelEvent) => {
      if (e.ctrlKey && !(e.target instanceof Element && e.target.closest(".react-flow"))) e.preventDefault();
    };
    const noGesture = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", noPageZoom, { passive: false });
    document.addEventListener("gesturestart", noGesture);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", noPageZoom);
      document.removeEventListener("gesturestart", noGesture);
    };
  }, [dispatch]);

  return (
    <div className={`app ${state.sideOpen ? "" : "side-closed"} ${state.askOpen ? "ask-open" : ""}`}>
      <Sidebar ws={ws} />
      <main className="main">
        <TopBar />
        <div className="stage">
          <Canvas />
          <Panel />
          {!ws.demo && <GettingStarted ws={ws} />}
          <Welcome ws={ws} />
        </div>
      </main>
      <AskZelo />
    </div>
  );
}

/** One-time toast after someone accepts an invite or finishes onboarding. */
function Welcome({ ws }: { ws: Ws }) {
  const [msg, setMsg] = useState<string | null>(() => {
    try {
      const m = sessionStorage.getItem("zelo-welcome");
      if (m) sessionStorage.removeItem("zelo-welcome");
      return m;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      <span className="toast-mark">✦</span>
      <div>
        <strong>{msg}</strong>
        <small>{ws.name} on Zelo</small>
      </div>
      <button type="button" onClick={() => setMsg(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

function loadInitial(ws: Ws): Graph {
  if (ws.demo) return SEED;
  try {
    const raw = localStorage.getItem(`${graphKey(ws.id)}-initial`) ?? localStorage.getItem(graphKey(ws.id));
    if (raw) return JSON.parse(raw) as Graph;
  } catch {
    // fall through
  }
  return SEED;
}

/** Gate: signed out → login, no finished workspace → onboarding, otherwise the product map. */
export default function Workspace() {
  const db = useDb();
  const router = useRouter();
  const user = db ? currentUser(db) : undefined;
  const ws = db ? currentWorkspace(db) : undefined;
  const goto = !db ? null : !user ? "/login" : !ws || !ws.onboarded ? "/onboarding" : null;

  useEffect(() => {
    if (goto) router.replace(goto);
  }, [goto, router]);

  const wsId = ws?.id;
  const initial = useMemo(() => (ws ? loadInitial(ws) : null), [wsId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!db || goto || !user || !ws || !initial) return <div className="boot" aria-busy="true" />;
  return (
    <StoreProvider key={`${ws.id}:${user.id}`} storageKey={graphKey(ws.id)} initial={initial} meId={user.id}>
      <Shell ws={ws} users={db.users} />
    </StoreProvider>
  );
}
