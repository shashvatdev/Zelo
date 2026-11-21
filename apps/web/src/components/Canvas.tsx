"use client";

import "@xyflow/react/style.css";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useOptionsStore,
  useReactFlow,
  type Node,
  type NodeChangeset,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layoutAll, layoutVersion, type NodeData } from "@/lib/layout";
import { useStore, type Selected } from "@/lib/store";
import CanvasControls, { FIT } from "./CanvasControls";
import SketchEdge from "./SketchEdge";
import { nodeTypes } from "./nodes";

const edgeTypes = { sketch: SketchEdge };

const KIND: Record<string, NonNullable<Selected>["kind"]> = {
  release: "release",
  person: "person",
  feature: "feature",
  ticket: "ticket",
  bug: "bug",
  module: "module",
  product: "product",
};

/** Dragged positions survive data edits; a new view (version or person) lays out fresh. */
function useLaidOut() {
  const { state } = useStore();
  const laid = useMemo(
    () =>
      state.scope === "all"
        ? layoutAll(state.graph, state.personId)
        : layoutVersion(state.graph, state.scope, state.personId),
    [state.graph, state.scope, state.personId],
  );
  const [moved, setMoved] = useState<{
    key: number;
    pos: Record<string, { x: number; y: number }>;
  }>({ key: state.viewKey, pos: {} });
  const sel = state.selected
    ? `${state.selected.kind}:${state.selected.id}`
    : null;
  const nodes = useMemo(() => {
    const pos = moved.key === state.viewKey ? moved.pos : {};
    return laid.nodes.map((n) => {
      const placed = pos[n.id] ? { ...n, position: pos[n.id] } : n;
      return n.id === sel
        ? { ...placed, selected: true }
        : placed.selected
          ? { ...placed, selected: false }
          : placed;
    });
  }, [laid.nodes, moved, state.viewKey, sel]);
  const onNodesChange = useCallback(
    (changes: NodeChangeset<Node<NodeData>>) => {
      const next = changes.applyTo(nodes);
      const p: Record<string, { x: number; y: number }> = {};
      next.forEach((n, i) => {
        if (n.position !== nodes[i]?.position) p[n.id] = n.position;
      });
      if (Object.keys(p).length)
        setMoved((m) => ({
          key: state.viewKey,
          pos: { ...(m.key === state.viewKey ? m.pos : {}), ...p },
        }));
    },
    [nodes, state.viewKey],
  );
  return { nodes, edges: laid.edges, onNodesChange };
}

const FOCUS_KINDS = new Set(["feature", "ticket", "bug", "release"]);

/**
 * The camera: fits each new view, and flies to whatever gets selected (a node click, a notification,
 * an Ask Zelo answer, a link in the panel), leaving room for the details panel so the tile stays visible.
 */
function Camera({
  k,
  all,
  side,
  focus,
}: {
  k: number;
  all: boolean;
  side: string;
  focus: string | null;
}) {
  const { fitView, setViewport, setCenter, getNode, getZoom } = useReactFlow();
  const ready = useOptionsStore((s) => Boolean(s.panZoom));
  const fitted = useRef(-1);
  const lastFocus = useRef<string | null>(null);

  const flyTo = useCallback(
    (id: string, duration: number) => {
      const n = getNode(id);
      if (!n) return;
      const w = n.width ?? n.measured?.width ?? 220;
      const h = n.height ?? n.measured?.height ?? 80;
      const phone = window.innerWidth < 820;
      const zoom = Math.min(
        1.6,
        Math.max(getZoom(), n.type === "ticket" || n.type === "bug" ? 1.15 : 1),
      );
      // The details panel covers the right side (or the bottom on phones): centre the tile in what's left.
      const dx = phone ? 0 : 197 / zoom;
      const dy = phone ? (window.innerHeight * 0.3) / zoom : 0;
      void setCenter(n.position.x + w / 2 + dx, n.position.y + h / 2 + dy, {
        zoom,
        duration,
      });
    },
    [getNode, getZoom, setCenter],
  );

  // New view: show the whole tree; if something is selected, then glide in to it.
  useEffect(() => {
    if (!ready || fitted.current === k) return;
    fitted.current = k;
    lastFocus.current = focus;
    const w = window.innerWidth;
    let t: ReturnType<typeof setTimeout> | undefined;
    requestAnimationFrame(() => {
      if (w < 820 && !focus)
        setViewport({ x: all ? 60 * 0.6 + 16 : w / 2, y: 20, zoom: 0.6 });
      else void fitView(FIT);
      if (focus) t = setTimeout(() => flyTo(focus, 850), 450);
    });
    return () => clearTimeout(t);
  }, [ready, k, all, focus, fitView, setViewport, flyTo]);

  // Same view, new selection: fly straight there.
  useEffect(() => {
    if (!ready || fitted.current !== k || focus === lastFocus.current) return;
    lastFocus.current = focus;
    if (focus) flyTo(focus, 650);
  }, [ready, k, focus, flyTo]);

  // Sidebar or copilot shown/hidden: reframe once the width has settled.
  const lastSide = useRef(side);
  useEffect(() => {
    if (lastSide.current === side) return;
    lastSide.current = side;
    if (window.innerWidth < 820) return;
    const t = setTimeout(
      () =>
        lastFocus.current
          ? flyTo(lastFocus.current, 350)
          : void fitView({ ...FIT, duration: 350 }),
      300,
    );
    return () => clearTimeout(t);
  }, [side, fitView, flyTo]);
  return null;
}

export default function Canvas() {
  const { state, dispatch } = useStore();
  const { nodes, edges, onNodesChange } = useLaidOut();

  const onNodeClick = useCallback(
    (_: unknown, node: Node<NodeData>) => {
      const [prefix, id] = node.id.split(/:(.+)/);
      if (prefix === "release" && state.scope === "all") {
        dispatch({ type: "scope", scope: id });
        return;
      }
      if (prefix === "lane" || prefix === "empty") return;
      const kind = KIND[prefix];
      if (kind)
        dispatch({
          type: "select",
          selected: {
            kind,
            id: prefix === "product" ? state.graph.product.id : id,
          },
        });
    },
    [dispatch, state.scope, state.graph.product.id],
  );

  return (
    <div className="canvas">
      <ReactFlowProvider key={state.viewKey}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onPaneClick={() => dispatch({ type: "select", selected: null })}
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.15}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.2}
            color="var(--line-strong)"
          />
          <CanvasControls />
          <Camera
            k={state.viewKey}
            all={state.scope === "all"}
            side={`${state.sideOpen}-${state.askOpen}`}
            focus={
              state.selected && FOCUS_KINDS.has(state.selected.kind)
                ? `${state.selected.kind}:${state.selected.id}`
                : null
            }
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
