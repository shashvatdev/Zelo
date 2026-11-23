/** Server settings read from the environment, with safe development defaults. */
const prod = process.env.NODE_ENV === "production";

export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3200").replace(/\/$/, ""),
  /** Dev mailbox at /dev/mailbox: on outside production, or when explicitly enabled. */
  devMailbox: !prod || process.env.DEV_MAILBOX === "1",
  /** The shared "Acme Store" sample workspace. */
  demoEnabled: process.env.DEMO_ENABLED ? process.env.DEMO_ENABLED === "1" : true,
  google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET } : null,
  resendKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM ?? "Zelo <invites@zelo.app>",
  uploadDir: process.env.UPLOAD_DIR ?? ".data/uploads",
  maxUploadBytes: 10 * 1024 * 1024,
  inviteDays: 7,
  /**
   * "demo": no payment gateway yet. Paying without a card succeeds at once and is recorded as a
   * demo payment. Set PAYMENTS_MODE=live once a real gateway adapter is added (then a card is required).
   */
  paymentsMode: (process.env.PAYMENTS_MODE === "live" ? "live" : "demo") as "demo" | "live",
  ai: {
    key: process.env.GROQ_API_KEY || null,
    baseUrl: (process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/$/, ""),
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    /** Tried in order when the main model is rate-limited or down (comma-separated). */
    fallbackModels: (process.env.GROQ_FALLBACK_MODEL ?? "qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",").map((m) => m.trim()).filter(Boolean),
    /** Questions per person per minute. */
    perMinute: Number(process.env.AI_PER_MINUTE ?? 12),
    /** Tokens per workspace per day, by plan (0 = unlimited). */
    dailyTokens: {
      free: Number(process.env.AI_DAILY_TOKENS_FREE ?? 150_000),
      team: Number(process.env.AI_DAILY_TOKENS_TEAM ?? 1_500_000),
      business: Number(process.env.AI_DAILY_TOKENS_BUSINESS ?? 5_000_000),
    } as Record<string, number>,
  },
};
