#!/bin/sh
set -e

echo "Applying database migrations…"
node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding default rules and sources…"
  node apps/api/dist/prisma-seed.js 2>/dev/null || echo "(seed skipped — compiled seed not present; run npm run prisma:seed)"
fi

echo "Starting API…"
exec node apps/api/dist/main.js
