# ── Build stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY services/classification/package.json services/classification/
COPY services/ingestion/package.json services/ingestion/
COPY services/reporting/package.json services/reporting/
COPY apps/api/package.json apps/api/
RUN npm install --workspaces --include-workspace-root --ignore-scripts

COPY packages/shared-types packages/shared-types
COPY services/classification services/classification
COPY services/ingestion services/ingestion
COPY services/reporting services/reporting
COPY apps/api apps/api

RUN npm run prisma:generate -w @control-tower/api \
 && npm run build:libs \
 && npm run build:api \
 && npm prune --omit=dev

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services ./services
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh \
 && mkdir -p /data/inbox && chown -R node:node /data /app

USER node
ENV INGESTION_DATA_DIR=/data/inbox
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/healthz || exit 1

ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
