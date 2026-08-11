# ── Build stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
# Every workspace the web app depends on must be present before npm install,
# or the workspace links cannot resolve and the Next build fails on the import.
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui-components/package.json packages/ui-components/
COPY services/reporting/package.json services/reporting/
COPY apps/web/package.json apps/web/
RUN npm install --workspaces --include-workspace-root --ignore-scripts

COPY packages/shared-types packages/shared-types
COPY packages/ui-components packages/ui-components
COPY services/reporting services/reporting
COPY apps/web apps/web

# shared-types and reporting are consumed from dist via their package.json main
RUN npm run build -w @control-tower/shared-types \
 && npm run build -w @control-tower/reporting

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_AUTH_ENABLED=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @control-tower/web

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
