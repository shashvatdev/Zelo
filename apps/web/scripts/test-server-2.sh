#!/usr/bin/env bash
# A second app instance on :3301 sharing the test database (for cross-instance realtime tests).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL=${TEST_DATABASE_URL:-postgres://localhost:5432/zelo_test}
export APP_URL=http://localhost:3301 DEV_MAILBOX=1 UPLOAD_DIR=.data/test-uploads TRUST_PROXY=1 IP_LIMIT_PER_HOUR=5
exec npx next start -p 3301
