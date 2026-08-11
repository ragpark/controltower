#!/bin/sh
set -e

echo "Applying database migrations…"
node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding default rules and sources (idempotent)…"
  node apps/api/dist-seed/seed.js
fi

echo "Starting API…"
exec node apps/api/dist/main.js
