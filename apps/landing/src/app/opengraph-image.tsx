import { ImageResponse } from "next/og";

export const alt =
  "Zelo: work isn't a list, it's a map. A release tree with features and tickets.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#1b1a17";
const paper = "#f6f3ec";
const card = "#fffdf8";
const coral = "#e5582b";

function Node({
  label,
  done,
  tone,
}: {
  label: string;
  done?: string;
  tone?: "green" | "amber" | "blue";
}) {
  const fills = { green: "#e3f1e2", amber: "#fbefd6", blue: "#e5ecfa" };
  const strokes = { green: "#2f8f46", amber: "#d48a1c", blue: "#3866c9" };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
        borderRadius: 12,
        border: `2px solid ${tone ? strokes[tone] : ink}`,
        background: tone ? fills[tone] : card,
        width: 190,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: ink }}>{label}</div>
      {done && (
        <div style={{ fontSize: 16, color: "#6d695f", marginTop: 4 }}>
          {done}
        </div>
      )}
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: paper,
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 600,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 40,
            fontWeight: 700,
            color: ink,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: coral,
              marginRight: 14,
            }}
          />
          zelo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: ink,
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            Work isn&apos;t a list.
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: coral,
              lineHeight: 1.02,
              letterSpacing: -2,
            }}
          >
            It&apos;s a map.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#3a3832",
              marginTop: 26,
              lineHeight: 1.35,
            }}
          >
            Every ticket connected to its feature and release. A visual
            alternative to Jira and ClickUp.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#6d695f" }}>
          Visual project management for software teams
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          marginLeft: 24,
          borderRadius: 24,
          border: `3px solid ${ink}`,
          background: card,
          boxShadow: `10px 10px 0 ${ink}`,
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "14px 26px",
            borderRadius: 12,
            background: ink,
            color: paper,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          Release v2.3
        </div>
        <div style={{ width: 2, height: 34, background: ink }} />
        <div style={{ display: "flex", gap: 18 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Node label="Refunds" done="1/3 done" />
            <Node label="API endpoint" tone="green" />
            <Node label="Webhook" tone="blue" />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Node label="Export CSV" done="2/2 done" />
            <Node label="CSV builder" tone="green" />
            <Node label="Theme toggle" tone="amber" />
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
