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
};
