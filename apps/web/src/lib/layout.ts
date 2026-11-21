import type { Edge, Node } from "@xyflow/react";
import type { Graph } from "@/data/model";
import {
  bugsIn,
  featuresForPerson,
  featuresIn,
  openBugs,
  progressOf,
  releaseProgress,
  ticketsOf,
} from "./graph";

/**
 * Turns the graph into positioned canvas nodes and edges for three views:
 *  - version:        release → features → tickets, plus a bugs lane
 *  - version+person: person → their features → their tickets and bugs
 *  - all:            modules as lanes, releases as columns on a timeline, features where
 *                    they meet, and "extends" arcs linking each feature to its next version
 * `delay` on every node/edge drives the build animation (seconds).
 */

export const SIZE = {
  root: { w: 280, h: 84 },
  feature: { w: 244, h: 104 },
  ticket: { w: 214, h: 60 },
  product: { w: 200, h: 74 },
  module: { w: 196, h: 86 },
  releaseHead: { w: 244, h: 74 },
  cell: { w: 244, h: 112 },
};

export type NodeData = Record<string, unknown> & {
  delay: number;
  dim?: boolean;
};
export type Laid = { nodes: Node<NodeData>[]; edges: Edge[] };

const DIMS: Record<string, { w: number; h: number }> = {
  release: SIZE.root,
  person: SIZE.root,
  feature: SIZE.feature,
  lane: SIZE.feature,
  addFeature: SIZE.feature,
  ticket: SIZE.ticket,
  bug: SIZE.ticket,
  empty: { w: 320, h: 64 },
  product: SIZE.product,
  module: SIZE.module,
  releaseHead: SIZE.releaseHead,
  cell: SIZE.cell,
};

/** Give every node its known size up front, so the canvas can fit the view before measuring. */
function sized(l: Laid): Laid {
  return {
    edges: l.edges,
    nodes: l.nodes.map((n) => {
      const d = DIMS[n.type ?? ""];
      if (d) return { ...n, width: d.w, height: d.h };
      const st = n.style as { width?: number; height?: number } | undefined;
      return st?.width ? { ...n, width: st.width, height: st.height } : n;
    }),
  };
}

/** Comment count shown on a node. */
const talk = (g: Graph, kind: string, id: string) =>
  g.comments.filter((c) => c.target.kind === kind && c.target.id === id).length;

const at = (cx: number, top: number, w: number) => ({ x: cx - w / 2, y: top });

function edge(
  id: string,
  source: string,
  target: string,
  delay: number,
  variant: string,
  extra: Partial<Edge> = {},
): Edge {
  return {
    id,
    source,
    target,
    type: "sketch",
    data: { delay, variant },
    selectable: false,
    focusable: false,
    ...extra,
  };
}

function versionRaw(
  g: Graph,
  releaseId: string,
  personId: string | null,
): Laid {
  const release = g.releases.find((r) => r.id === releaseId)!;
  const person = personId ? g.people.find((p) => p.id === personId) : undefined;
  const features = person
    ? featuresForPerson(g, person.id, releaseId)
    : featuresIn(g, releaseId);
  const bugs = bugsIn(g, releaseId, person?.id);
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const COL = 288;
  const ghost = person ? 0 : 1; // the "+ Add feature" tile
  const cols = features.length + ghost + (bugs.length ? 1 : 0);
  const cx = (i: number) => (i - (cols - 1) / 2) * COL;
  const rootId = person ? `person:${person.id}` : `release:${release.id}`;
  const prog = releaseProgress(g, releaseId, person?.id);

  nodes.push({
    id: rootId,
    type: person ? "person" : "release",
    position: at(0, 0, SIZE.root.w),
    data: person
      ? {
          delay: 0.05,
          personId: person.id,
          name: person.name,
          role: person.role,
          color: person.color,
          release: release.version,
          progress: prog,
        }
      : {
          delay: 0.05,
          releaseId: release.id,
          version: release.version,
          name: release.name,
          date: release.date,
          state: release.state,
          progress: prog,
          bugs: openBugs(bugs).length,
        },
  });

  const FY = 160;
  const TY = FY + SIZE.feature.h + 44;
  let t = 0.28 + features.length * 0.08 + (bugs.length ? 0.08 : 0);

  features.forEach((f, i) => {
    const mod = g.modules.find((m) => m.id === f.moduleId)!;
    const all = ticketsOf(g, f.id);
    const mine = person ? ticketsOf(g, f.id, person.id) : all;
    const id = `feature:${f.id}`;
    const delay = 0.28 + i * 0.08;
    const pos = at(cx(i), FY, SIZE.feature.w);
    nodes.push({
      id,
      type: "feature",
      position: pos,
      data: {
        delay,
        featureId: f.id,
        name: f.name,
        key: f.key,
        module: mod.name,
        color: mod.color,
        progress: progressOf(all),
        mine: person ? mine.length : undefined,
        ownerId: f.ownerId,
        comments: talk(g, "feature", f.id),
      },
    });
    edges.push(edge(`e:${rootId}:${id}`, rootId, id, delay - 0.1, "tree"));
    mine.forEach((tk, j) => {
      const tid = `ticket:${tk.id}`;
      nodes.push({
        id: tid,
        type: "ticket",
        position: { x: pos.x + 30, y: TY + j * 78 },
        data: {
          delay: t,
          ticketId: tk.id,
          title: tk.title,
          key: tk.key,
          status: tk.status,
          points: tk.points,
          assigneeId: tk.assigneeId,
          comments: talk(g, "ticket", tk.id),
        },
      });
      edges.push(
        edge(`e:${id}:${tid}`, id, tid, t - 0.06, "spine", {
          sourceHandle: "spine",
        }),
      );
      t += 0.05;
    });
  });

  if (bugs.length) {
    const laneId = "lane:bugs";
    const i = features.length + ghost;
    const pos = at(cx(i), FY, SIZE.feature.w);
    const delay = 0.28 + i * 0.08;
    nodes.push({
      id: laneId,
      type: "lane",
      position: pos,
      data: { delay, total: bugs.length, open: openBugs(bugs).length },
    });
    edges.push(
      edge(`e:${rootId}:${laneId}`, rootId, laneId, delay - 0.1, "tree"),
    );
    bugs.forEach((b, j) => {
      const mod = g.modules.find((m) => m.id === b.moduleId)!;
      const bid = `bug:${b.id}`;
      nodes.push({
        id: bid,
        type: "bug",
        position: { x: pos.x + 30, y: TY + j * 78 },
        data: {
          delay: t,
          bugId: b.id,
          title: b.title,
          key: b.key,
          status: b.status,
          severity: b.severity,
          module: mod.name,
          color: mod.color,
          comments: talk(g, "bug", b.id),
        },
      });
      edges.push(
        edge(`e:${laneId}:${bid}`, laneId, bid, t - 0.06, "spine", {
          sourceHandle: "spine",
        }),
      );
      t += 0.05;
    });
  }

  if (ghost) {
    const i = features.length;
    const delay = 0.28 + i * 0.08;
    nodes.push({
      id: "add:feature",
      type: "addFeature",
      position: at(cx(i), FY, SIZE.feature.w),
      data: { delay, releaseId: release.id, first: features.length === 0 },
    });
    edges.push(edge("e:root:add", rootId, "add:feature", delay - 0.1, "ghost"));
  }

  if (person && !features.length && !bugs.length) {
    nodes.push({
      id: "empty",
      type: "empty",
      position: at(0, FY, 320),
      data: {
        delay: 0.3,
        text: `${person?.name ?? "Nobody"} has no work in ${release.version}.`,
      },
    });
  }
  return { nodes, edges };
}

function allRaw(g: Graph, personId: string | null): Laid {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const releases = [...g.releases].sort((a, b) => a.date.localeCompare(b.date));
  const COL = 300;
  const X0 = 470;
  const colX = (j: number) => X0 + j * COL;
  const person = personId ? g.people.find((p) => p.id === personId) : undefined;
  const mineIds = person
    ? new Set(featuresForPerson(g, person.id).map((f) => f.id))
    : null;

  const PADT = 56; // room above the cards for "extends" arcs, so they stay inside their lane
  // Rows: one lane per module, tall enough for its busiest release.
  let y = 130;
  const rows = g.modules.map((m) => {
    const perRelease = releases.map((r) =>
      g.features.filter((f) => f.moduleId === m.id && f.releaseId === r.id),
    );
    const k = Math.max(1, ...perRelease.map((c) => c.length));
    const h = PADT + k * (SIZE.cell.h + 18) + 4;
    const row = { m, perRelease, top: y, h };
    y += h + 18;
    return row;
  });
  const totalH = y - 130;
  const right = colX(releases.length - 1) + SIZE.cell.w + 26;

  // Release columns (behind everything) and headers on the timeline.
  releases.forEach((r, j) => {
    nodes.push({
      id: `col:${r.id}`,
      type: "column",
      position: { x: colX(j) - 14, y: -14 },
      data: { delay: 0, state: r.state },
      style: { width: SIZE.cell.w + 28, height: totalH + 160 },
      zIndex: -2,
      selectable: false,
      draggable: false,
    });
    const hid = `release:${r.id}`;
    nodes.push({
      id: hid,
      type: "releaseHead",
      position: { x: colX(j), y: 0 },
      data: {
        delay: 0.1 + j * 0.07,
        releaseId: r.id,
        version: r.version,
        name: r.name,
        date: r.date,
        state: r.state,
        progress: releaseProgress(g, r.id, person?.id),
        bugs: openBugs(bugsIn(g, r.id, person?.id)).length,
      },
    });
    if (j > 0)
      edges.push(
        edge(
          `e:time:${j}`,
          `release:${releases[j - 1].id}`,
          hid,
          0.1 + j * 0.07,
          "timeline",
          { sourceHandle: "next", targetHandle: "prev" },
        ),
      );
  });

  // Product → modules.
  const productY = 130 + totalH / 2 - SIZE.product.h / 2;
  nodes.push({
    id: "product",
    type: "product",
    position: { x: -60, y: productY },
    data: {
      delay: 0.05,
      name: g.product.name,
      modules: g.modules.length,
      releases: releases.length,
    },
  });

  let d = 0.5;
  rows.forEach((row, i) => {
    const mid = `module:${row.m.id}`;
    nodes.push({
      id: `band:${row.m.id}`,
      type: "band",
      position: { x: 200, y: row.top },
      data: { delay: 0.2 + i * 0.06, color: row.m.color },
      style: { width: right - 200, height: row.h },
      zIndex: -1,
      selectable: false,
      draggable: false,
    });
    nodes.push({
      id: mid,
      type: "module",
      position: {
        x: 214,
        y: row.top + PADT + (row.h - PADT - 4) / 2 - SIZE.module.h / 2,
      },
      data: {
        delay: 0.25 + i * 0.06,
        moduleId: row.m.id,
        name: row.m.name,
        color: row.m.color,
        features: row.perRelease.flat().length,
      },
    });
    edges.push(
      edge(`e:product:${mid}`, "product", mid, 0.2 + i * 0.06, "rail", {
        sourceHandle: "out",
        targetHandle: "in",
      }),
    );

    const chain: typeof g.features = [];
    row.perRelease.forEach((cell, j) => {
      cell.forEach((f, k) => {
        const fid = `feature:${f.id}`;
        const tickets = ticketsOf(g, f.id);
        const dim = mineIds ? !mineIds.has(f.id) : false;
        nodes.push({
          id: fid,
          type: "cell",
          position: { x: colX(j), y: row.top + PADT + k * (SIZE.cell.h + 18) },
          data: {
            delay: d,
            dim,
            featureId: f.id,
            comments: talk(g, "feature", f.id),
            name: f.name,
            key: f.key,
            color: row.m.color,
            progress: progressOf(tickets),
            mine: person ? ticketsOf(g, f.id, person.id).length : undefined,
            bugs: g.bugs.filter(
              (b) => b.moduleId === f.moduleId && b.releaseId === f.releaseId,
            ).length,
            ownerId: f.ownerId,
            state: releases[j].state,
          },
        });
        d += 0.04;
        // The module rail: module → each version of its work, left to right, in time order.
        const prev = chain[chain.length - 1];
        const prevId = prev ? `feature:${prev.id}` : mid;
        const isLink = Boolean(prev && f.extendsId === prev.id);
        const rdim = mineIds
          ? !(mineIds.has(f.id) && (!prev || mineIds.has(prev.id)))
          : false;
        edges.push(
          edge(
            `e:rail:${prevId}:${fid}`,
            prevId,
            fid,
            d,
            isLink ? "link" : "rail",
            {
              sourceHandle: "out",
              targetHandle: "in",
              data: {
                delay: d,
                variant: isLink ? "link" : "rail",
                dim: rdim,
                color: row.m.color,
              },
            },
          ),
        );
        // "Extends" that skips versions: an arc over the cards, inside the lane.
        const parent =
          f.extendsId && !isLink
            ? g.features.find((x) => x.id === f.extendsId)
            : undefined;
        if (parent) {
          const span =
            releases.findIndex((r) => r.id === f.releaseId) -
            releases.findIndex((r) => r.id === parent.releaseId);
          const pdim = mineIds
            ? !(mineIds.has(f.id) && mineIds.has(parent.id))
            : false;
          edges.push(
            edge(
              `e:ext:${parent.id}:${f.id}`,
              `feature:${parent.id}`,
              fid,
              d + 0.25,
              "arc",
              {
                sourceHandle: "arcOut",
                targetHandle: "arcIn",
                data: {
                  delay: d + 0.25,
                  variant: "arc",
                  span,
                  dim: pdim,
                  color: row.m.color,
                },
              },
            ),
          );
        }
        chain.push(f);
      });
    });
  });

  return { nodes, edges };
}

export const layoutVersion = (
  g: Graph,
  releaseId: string,
  personId: string | null,
) => sized(versionRaw(g, releaseId, personId));
export const layoutAll = (g: Graph, personId: string | null) =>
  sized(allRaw(g, personId));
