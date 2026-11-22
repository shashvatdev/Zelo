#!/usr/bin/env bash
# Starts the built app on :3300 against the test database (run `npm run build` first).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL=${TEST_DATABASE_URL:-postgres://localhost:5432/zelo_test}
export APP_URL=http://localhost:3300 DEV_MAILBOX=1 UPLOAD_DIR=.data/test-uploads TRUST_PROXY=1 IP_LIMIT_PER_HOUR=5
node scripts/migrate.mjs
exec npx next start -p 3300
