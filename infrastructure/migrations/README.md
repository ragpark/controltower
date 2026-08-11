# Migrations

The canonical migration history is managed by Prisma and lives at
[`apps/api/prisma/migrations`](../../apps/api/prisma/migrations).

- Apply in any environment: `npm run prisma:migrate` (runs `prisma migrate deploy`)
- The API container applies migrations automatically on start-up
  (`apps/api/docker-entrypoint.sh`).
- Create a new migration during development:
  `cd apps/api && npx prisma migrate dev --name <change-name>`

`0001_init.sql` here is a convenience copy of the initial schema for DBA
review / manual provisioning; Prisma's copy is the source of truth.
