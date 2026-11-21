/**
 * Shared Open Graph card for secondary pages (compare, vs). Same paper and ink theme as the
 * home page image: a headline on the left, a small "list → map" sketch on the right.
 */

const ink = "#1b1a17";
const paper = "#f6f3ec";
const card = "#fffdf8";
const coral = "#e5582b";
const muted = "#6d695f";
const colors = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c"];

export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({
  kicker,
  line1,
  line2,
  sub,
}: {
  kicker: string;
  line1: string;
  line2: string;
  sub: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: paper,
        padding: 60,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 640,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 38,
            fontWeight: 700,
            color: ink,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: coral,
              marginRight: 12,
            }}
          />
          zelo
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: coral,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: ink,
              lineHeight: 1.04,
              letterSpacing: -1.5,
            }}
          >
            {line1}
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: coral,
              lineHeight: 1.04,
              letterSpacing: -1.5,
            }}
          >
            {line2}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#3a3832",
              marginTop: 22,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        </div>
        <div style={{ fontSize: 21, color: muted }}>
          Visual project management for software teams
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          marginLeft: 30,
          borderRadius: 24,
          border: `3px solid ${ink}`,
          background: card,
          boxShadow: `10px 10px 0 ${ink}`,
          padding: 26,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {colors.concat(colors.slice(0, 2)).map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                width: 150,
                height: 34,
                borderRadius: 8,
                border: "2px solid #cfc8b8",
                background: card,
                paddingLeft: 8,
              }}
            >
              <div
                style={{ width: 6, height: 20, borderRadius: 3, background: c }}
              />
              <div
                style={{
                  width: 80 - i * 6,
                  height: 8,
                  borderRadius: 4,
                  background: "#e2ddd0",
                  marginLeft: 10,
                }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "10px 18px",
              borderRadius: 10,
              background: ink,
              color: paper,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            v2.3
          </div>
          {colors.map((c, i) => (
            <div
              key={c}
              style={{
                display: "flex",
                width: 120,
                height: 40,
                borderRadius: 10,
                border: `3px solid ${c}`,
                background: card,
                alignItems: "center",
                paddingLeft: 12,
                fontSize: 17,
                fontWeight: 700,
                color: ink,
              }}
            >
              {["Refunds", "OTP login", "Export", "Dark mode"][i]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
