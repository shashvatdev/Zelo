"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Graph } from "@/data/model";
import { useMe, useWorkspace, wsKey, type Workspace as Ws } from "@/lib/account";
import { revalidate, useQuery } from "@/lib/api";
import { StoreProvider, useStore } from "@/lib/store";
import AskZelo from "./AskZelo";
import Canvas from "./Canvas";
import GettingStarted from "./GettingStarted";
import Panel from "./Panel";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function Shell({ ws }: { ws: Ws }) {
  const { state, dispatch, error, clearError } = useStore();

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

  // The board version also moves when people join, leave or change role: refresh the team then.
  const firstVersion = useRef(state.version);
  useEffect(() => {
    if (state.version !== firstVersion.current) void revalidate(wsKey(ws.id));
  }, [state.version, ws.id]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 7000);
    return () => clearTimeout(t);
  }, [error, clearError]);

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
          {error && (
            <div className="toast bad" role="alert">
              <span className="toast-mark">!</span>
              <div>
                <strong>{error}</strong>
                <small>Your board was reloaded from the server.</small>
              </div>
              <button type="button" onClick={clearError} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
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

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="boot center">
      <div className="load-error">
        <strong>We couldn&apos;t load your workspace</strong>
        <p>{message}</p>
        <button type="button" className="btn-ink" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

/** Gate: signed out → login, no finished workspace → onboarding, otherwise the product map. */
export default function Workspace() {
  const { me, error: meError, reload } = useMe();
  const router = useRouter();
  const wsId = me?.activeWorkspaceId ?? null;
  const active = me?.workspaces.find((w) => w.id === wsId);
  const goto = me === null ? "/login" : me && (!active || !active.onboarded) ? "/onboarding" : null;
  const ws = useWorkspace(goto || !me ? null : wsId);
  const board = useQuery<{ graph: Graph; version: number }>(goto || !me || !wsId ? null : `/api/workspaces/${wsId}/graph`);

  useEffect(() => {
    if (goto) router.replace(goto);
  }, [goto, router]);

  const err = meError ?? ws.error ?? board.error;
  if (err) return <LoadError message={err.message} onRetry={() => void Promise.all([reload(), ws.reload(), board.reload()])} />;
  if (!me || goto || !ws.data || !board.data) return <div className="boot" aria-busy="true" />;
  return (
    <StoreProvider key={`${ws.data.id}:${me.user.id}`} workspaceId={ws.data.id} initial={board.data.graph} version={board.data.version} meId={me.user.id}>
      <Shell ws={ws.data} />
    </StoreProvider>
  );
}
