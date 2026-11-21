"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { STATUS_LABEL, type Severity, type Status } from "@/data/model";
import { pct, type Progress, fmtDate } from "@/lib/graph";
import { SIZE, type NodeData } from "@/lib/layout";
import { RoughShape, roughBox } from "@/lib/rough";
import { useStore } from "@/lib/store";

type N = NodeProps<Node<NodeData>>;

const STATUS_STROKE: Record<Status, string> = {
  done: "var(--green)",
  qa: "var(--amber)",
  dev: "var(--blue)",
  todo: "var(--muted-2)",
};
const STATUS_FILL: Record<Status, string> = {
  done: "var(--green-soft)",
  qa: "var(--amber-soft)",
  dev: "var(--blue-soft)",
  todo: "var(--card)",
};
const SEV: Record<Severity, string> = {
  critical: "var(--red)",
  high: "var(--coral)",
  medium: "var(--amber)",
  low: "var(--muted-2)",
};

const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

/** Hand-drawn outline behind a node, sized to it. */
function Sketch({
  id,
  w,
  h,
  fill = "var(--card)",
  stroke = "var(--ink)",
  width = 1.6,
  dashed = false,
}: {
  id: string;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  width?: number;
  dashed?: boolean;
}) {
  const shape = useMemo(
    () =>
      roughBox(w / 2, h / 2, w - 4, h - 4, hash(id), {
        fill,
        stroke,
        strokeWidth: width,
      }),
    [id, w, h, fill, stroke, width],
  );
  return (
    <svg
      className="sketch"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <RoughShape shape={shape} dashed={dashed} />
    </svg>
  );
}

function Shell({
  id,
  w,
  h,
  d,
  dim,
  children,
  className = "",
  sketch,
}: {
  id: string;
  w: number;
  h: number;
  d: number;
  dim?: boolean;
  children: ReactNode;
  className?: string;
  sketch: ReactNode;
}) {
  return (
    <div
      className={`zn ${dim ? "dim" : ""} ${className}`}
      style={{ width: w, height: h, "--d": `${d}s` } as CSSProperties}
      data-id={id}
    >
      {sketch}
      <div className="zn-body">{children}</div>
    </div>
  );
}

function Bar({ p, dark = false }: { p: Progress; dark?: boolean }) {
  const v = pct(p);
  return (
    <span className={dark ? "bar dark" : "bar"}>
      <span
        style={{
          width: `${v}%`,
          background:
            v === 100 ? "var(--green)" : dark ? "var(--paper)" : "var(--ink)",
        }}
      />
    </span>
  );
}

function Talk({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="talk" title={`${n} comment${n === 1 ? "" : "s"}`}>
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 3a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 10 3v3.5A1.5 1.5 0 0 1 8.5 8H5.5L3 10V8h0A1.5 1.5 0 0 1 2 6.5V3Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {n}
    </span>
  );
}

export function Avatar({
  personId,
  size = 22,
}: {
  personId: string | null | undefined;
  size?: number;
}) {
  const { state } = useStore();
  const p = state.graph.people.find((x) => x.id === personId);
  if (!p)
    return (
      <span
        className="avatar none"
        style={{ width: size, height: size }}
        title="Unassigned"
      >
        ?
      </span>
    );
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: p.color,
        fontSize: size * 0.48,
      }}
      title={p.name}
    >
      {p.name[0]}
    </span>
  );
}

const hidden: CSSProperties = {
  opacity: 0,
  width: 6,
  height: 6,
  minWidth: 0,
  minHeight: 0,
  border: 0,
};

export const ReleaseNode = memo(function ReleaseNode({ id, data }: N) {
  const { w, h } = SIZE.root;
  const p = data.progress as Progress;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      className="on-ink"
      sketch={<Sketch id={id} w={w} h={h} fill="var(--ink)" />}
    >
      <div className="row">
        <strong className="big">{String(data.version)}</strong>
        <span className="muted-on-ink">{String(data.name)}</span>
      </div>
      <Bar p={p} dark />
      <div className="row small muted-on-ink">
        <span>
          {p.done}/{p.total} tickets · {pct(p)}%
        </span>
        <span>{fmtDate(String(data.date))}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const PersonNode = memo(function PersonNode({ id, data }: N) {
  const { w, h } = SIZE.root;
  const p = data.progress as Progress;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill="color-mix(in srgb, var(--coral) 12%, var(--card))"
          stroke="var(--coral)"
          width={2}
        />
      }
    >
      <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
        <Avatar personId={String(data.personId)} size={34} />
        <div>
          <strong className="mid">{String(data.name)}</strong>
          <div className="small muted">
            {String(data.role)} · in {String(data.release)}
          </div>
        </div>
      </div>
      <Bar p={p} />
      <div className="small muted">
        {p.done}/{p.total} tickets done · {p.donePoints}/{p.points} pts
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const FeatureNode = memo(function FeatureNode({ id, data }: N) {
  const { w, h } = SIZE.feature;
  const p = data.progress as Progress;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      sketch={<Sketch id={id} w={w} h={h} />}
    >
      <div className="row">
        <span
          className="chip"
          style={{ borderColor: String(data.color), color: String(data.color) }}
        >
          {String(data.module)}
        </span>
        <span className="key-wrap">
          <span className="key">{String(data.key)}</span>
          <Talk n={Number(data.comments ?? 0)} />
        </span>
      </div>
      <strong className="mid">{String(data.name)}</strong>
      <Bar p={p} />
      <div className="row small muted">
        <span>
          {p.done}/{p.total} done
          {data.mine !== undefined ? ` · ${data.mine} mine` : ""}
        </span>
        <Avatar personId={data.ownerId as string | null} size={18} />
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="spine"
        type="source"
        position={Position.Bottom}
        style={{ ...hidden, left: 30 }}
        isConnectable={false}
      />
    </Shell>
  );
});

export const TicketNode = memo(function TicketNode({ id, data }: N) {
  const { w, h } = SIZE.ticket;
  const s = data.status as Status;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      className="pop-sm"
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill={STATUS_FILL[s]}
          stroke={STATUS_STROKE[s]}
        />
      }
    >
      <div className="row">
        <span className="row" style={{ gap: 7, minWidth: 0 }}>
          {s === "done" ? (
            <span className="tick">✓</span>
          ) : (
            <span className="dot" style={{ background: STATUS_STROKE[s] }} />
          )}
          <span className="title">{String(data.title)}</span>
        </span>
        <Avatar personId={data.assigneeId as string | null} size={18} />
      </div>
      <div className="row small muted">
        <span className="key-wrap">
          <span className="key">{String(data.key)}</span>
          <Talk n={Number(data.comments ?? 0)} />
        </span>
        <span>
          {STATUS_LABEL[s]} · {Number(data.points)} pts
        </span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const BugNode = memo(function BugNode({ id, data }: N) {
  const { w, h } = SIZE.ticket;
  const s = data.status as Status;
  const sev = data.severity as Severity;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      className="pop-sm"
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill={s === "done" ? "var(--green-soft)" : "var(--card)"}
          stroke={s === "done" ? "var(--green)" : SEV[sev]}
          width={1.8}
        />
      }
    >
      <div className="row">
        <span className="row" style={{ gap: 7, minWidth: 0 }}>
          <span
            className="bug-ico"
            style={{ color: SEV[sev] }}
            aria-hidden="true"
          >
            ✱
          </span>
          <span className="title">{String(data.title)}</span>
        </span>
        <span
          className="chip tiny"
          style={{ borderColor: String(data.color), color: String(data.color) }}
        >
          {String(data.module)}
        </span>
      </div>
      <div className="row small muted">
        <span className="key-wrap">
          <span className="key">{String(data.key)}</span>
          <Talk n={Number(data.comments ?? 0)} />
        </span>
        <span>
          {sev} · {STATUS_LABEL[s]}
        </span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const LaneNode = memo(function LaneNode({ id, data }: N) {
  const { w, h } = SIZE.feature;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill="color-mix(in srgb, var(--red) 6%, var(--card))"
          stroke="var(--red)"
          dashed
        />
      }
    >
      <span
        className="chip"
        style={{
          borderColor: "var(--red)",
          color: "var(--red)",
          alignSelf: "flex-start",
        }}
      >
        Bugs lane
      </span>
      <strong className="mid">Bugs in this release</strong>
      <div className="small muted">
        {Number(data.open)} open · {Number(data.total) - Number(data.open)}{" "}
        fixed
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="spine"
        type="source"
        position={Position.Bottom}
        style={{ ...hidden, left: 30 }}
        isConnectable={false}
      />
    </Shell>
  );
});

export const EmptyNode = memo(function EmptyNode({ id, data }: N) {
  return (
    <Shell
      id={id}
      w={320}
      h={64}
      d={data.delay}
      sketch={<Sketch id={id} w={320} h={64} dashed stroke="var(--muted-2)" />}
    >
      <span className="muted" style={{ textAlign: "center", width: "100%" }}>
        {String(data.text)}
      </span>
    </Shell>
  );
});

export const ProductNode = memo(function ProductNode({ id, data }: N) {
  const { w, h } = SIZE.product;
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      className="on-ink"
      sketch={<Sketch id={id} w={w} h={h} fill="var(--ink)" />}
    >
      <span className="muted-on-ink small">Product</span>
      <strong className="mid">{String(data.name)}</strong>
      <span className="muted-on-ink small">
        {Number(data.modules)} modules · {Number(data.releases)} versions
      </span>
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const ModuleNode = memo(function ModuleNode({ id, data }: N) {
  const { w, h } = SIZE.module;
  const c = String(data.color);
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill={`color-mix(in srgb, ${c} 12%, var(--card))`}
          stroke={c}
          width={2}
        />
      }
    >
      <span className="small" style={{ color: c, fontWeight: 600 }}>
        Module
      </span>
      <strong className="mid">{String(data.name)}</strong>
      <span className="small muted">
        {Number(data.features)} features, all versions
      </span>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const ReleaseHeadNode = memo(function ReleaseHeadNode({ id, data }: N) {
  const { w, h } = SIZE.releaseHead;
  const p = data.progress as Progress;
  const st = String(data.state);
  const current = st === "current";
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      className={`clickable ${current ? "on-ink" : ""}`}
      sketch={
        <Sketch
          id={id}
          w={w}
          h={h}
          fill={current ? "var(--ink)" : "var(--card)"}
          stroke={current ? "var(--ink)" : "var(--ink)"}
          dashed={st === "planned"}
        />
      }
    >
      <div className="row">
        <strong className="mid">{String(data.version)}</strong>
        <span className={`state s-${st}`}>{st}</span>
      </div>
      <Bar p={p} dark={current} />
      <div className={`row small ${current ? "muted-on-ink" : "muted"}`}>
        <span>
          {String(data.name)} · {pct(p)}%
        </span>
        <span>{fmtDate(String(data.date))}</span>
      </div>
      <Handle
        id="prev"
        type="target"
        position={Position.Left}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="next"
        type="source"
        position={Position.Right}
        style={hidden}
        isConnectable={false}
      />
    </Shell>
  );
});

export const CellNode = memo(function CellNode({ id, data }: N) {
  const { w, h } = SIZE.cell;
  const p = data.progress as Progress;
  const c = String(data.color);
  const planned = data.state === "planned";
  return (
    <Shell
      id={id}
      w={w}
      h={h}
      d={data.delay}
      dim={Boolean(data.dim)}
      sketch={
        <Sketch id={id} w={w} h={h} stroke={c} width={1.8} dashed={planned} />
      }
    >
      <div className="row">
        <span className="key-wrap">
          <span className="key">{String(data.key)}</span>
          <Talk n={Number(data.comments ?? 0)} />
        </span>
        <Avatar personId={data.ownerId as string | null} size={18} />
      </div>
      <strong className="mid">{String(data.name)}</strong>
      <Bar p={p} />
      <div className="row small muted">
        <span>
          {p.done}/{p.total} tickets
          {data.mine !== undefined ? ` · ${data.mine} mine` : ""}
        </span>
        {Number(data.bugs) > 0 && (
          <span className="bugs-chip">✱ {Number(data.bugs)}</span>
        )}
      </div>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={hidden}
        isConnectable={false}
      />
      <Handle
        id="arcIn"
        type="target"
        position={Position.Top}
        style={{ ...hidden, left: "28%" }}
        isConnectable={false}
      />
      <Handle
        id="arcOut"
        type="source"
        position={Position.Top}
        style={{ ...hidden, left: "72%" }}
        isConnectable={false}
      />
    </Shell>
  );
});

export const BandNode = memo(function BandNode({ data }: N) {
  const c = String(data.color);
  return (
    <div
      className="band"
      style={
        {
          "--d": `${data.delay}s`,
          background: `color-mix(in srgb, ${c} 6%, transparent)`,
          borderColor: `color-mix(in srgb, ${c} 35%, transparent)`,
        } as CSSProperties
      }
    />
  );
});

export const ColumnNode = memo(function ColumnNode({ data }: N) {
  return <div className={`column c-${String(data.state)}`} />;
});

export const nodeTypes = {
  release: ReleaseNode,
  person: PersonNode,
  feature: FeatureNode,
  ticket: TicketNode,
  bug: BugNode,
  lane: LaneNode,
  empty: EmptyNode,
  product: ProductNode,
  module: ModuleNode,
  releaseHead: ReleaseHeadNode,
  cell: CellNode,
  band: BandNode,
  column: ColumnNode,
};
