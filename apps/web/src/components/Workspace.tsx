"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import AskZelo from "./AskZelo";
import Canvas from "./Canvas";
import Panel from "./Panel";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function Shell() {
  const { state, dispatch } = useStore();

  // ⌘\ or Ctrl+\ shows or hides the sidebar.
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
    // Trackpad pinch must zoom the canvas, never the whole page (the page zoom hid the UI).
    const noPageZoom = (e: WheelEvent) => {
      if (
        e.ctrlKey &&
        !(e.target instanceof Element && e.target.closest(".react-flow"))
      )
        e.preventDefault();
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
    <div
      className={`app ${state.sideOpen ? "" : "side-closed"} ${state.askOpen ? "ask-open" : ""}`}
    >
      <Sidebar />
      <main className="main">
        <TopBar />
        <div className="stage">
          <Canvas />
          <Panel />
        </div>
      </main>
      <AskZelo />
    </div>
  );
}

export default function Workspace() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
