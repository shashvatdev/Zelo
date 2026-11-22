# Zelo app (canvas)

The product map: every version of a product as one connected tree.

- **Versions** in the sidebar: click one to see its tree (release → features → tickets, plus a bugs lane).
- **People**: click someone to see their tree inside the selected version.
- **All versions**: modules as lanes, releases on a timeline, features linked to the versions they build on.
- **Details panel**: status, assignee, spec, comments with @mentions and file uploads, and an automatic dated activity log.
- **Ask Zelo**: a copilot docked on the right (⌘K). Demo answers come from the board data in the browser.
- **Notifications**: assigned to you, mentioned, or comments on your tasks.

## Backend

Next.js route handlers (`src/app/api`) on **PostgreSQL** with **Drizzle**. Everything the app shows comes from the database.

- **Auth**: email + password (scrypt), sessions in the DB behind an httpOnly cookie, rate limits, password reset, optional Google.
- **Workspaces**: checkout (test-mode payments: `4242 4242 4242 4242` works, `4000 0000 0000 0002` is declined), onboarding, roles (owner/admin/member/viewer), seats, invites by email (hashed tokens, 7-day expiry, resend/revoke/copy link).
- **Board**: versions, modules, features, tickets, bugs, comments with @mentions and file uploads, an activity log for every change, notification read state. Keys like `PAY-101` come from an atomic counter.
- **Live updates**: Postgres triggers `NOTIFY` on every committed board/team change; each server keeps one `LISTEN` connection and pushes Server-Sent Events (`/api/workspaces/:id/events`) to open boards, which fetch the change at once. Works across many server instances. Streams close cleanly on shutdown (deploys don't hang), browsers reconnect within ~1s and catch up on anything missed; a slow poll with ETags is the safety net.
- **Email**: Resend when `RESEND_API_KEY` is set; otherwise recorded and readable at `/dev/mailbox`.

```bash
cp .env.example .env.local       # point DATABASE_URL at your Postgres
npm install
npm run db:migrate               # create/upgrade tables
npm run dev -- -p 3200
```

### Tests

```bash
createdb zelo_test
npm run build && npm run test:server   # app on :3300 against zelo_test (keep it running)
scripts/test-server-2.sh                # optional: a 2nd instance on :3301 for the cross-instance realtime test
npm run test:api                        # 53 API tests: auth, billing, invites, roles, board, files, concurrency, realtime
node tests/load.mjs 60                  # 60 people signing up and working at once
```

Schema changes: edit `src/server/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.
