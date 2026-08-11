# Deployment

Both apps ship as self-contained containers, so they run anywhere containers
run. Two Azure targets are supported out of the box.

## Azure Container Apps (recommended)

`azure-container-apps.bicep` provisions:

- Log Analytics workspace (structured JSON logs land here automatically)
- Container Apps environment
- PostgreSQL Flexible Server 16 + database
- `octower-api` (liveness `/healthz`, readiness `/readyz`, 1–3 replicas)
- `octower-web` (Next.js standalone)

```bash
# 1. Build + push images
az acr build -r <acr> -t control-tower-api:latest  -f apps/api/Dockerfile .
az acr build -r <acr> -t control-tower-web:latest  -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://<api-fqdn> \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true .

# 2. Deploy infrastructure
az deployment group create -g <rg> -f infrastructure/deployment/azure-container-apps.bicep \
  -p containerRegistry=<acr>.azurecr.io postgresPassword=<secret> entraTenantId=<tenant-guid>
```

Migrations run automatically when the API container starts
(`prisma migrate deploy` in the entrypoint).

## Azure App Service (containers)

Create two Web Apps for Containers pointing at the same images:

- API app: set `DATABASE_URL`, `AUTH_ENABLED=true`, `ENTRA_TENANT_ID`,
  `ENTRA_API_AUDIENCE`, `CORS_ORIGINS`, `WEBSITES_PORT=4000`.
- Web app: `WEBSITES_PORT=3000`. `NEXT_PUBLIC_*` values are baked at image
  build time — rebuild the web image per environment.

## Secrets

Never commit secrets. Locally use `.env` (gitignored, see `.env.example`);
in Azure use Container Apps secrets / Key Vault references. The connection
string is injected as a secret in the Bicep template.

## Entra ID setup

1. App registration **control-tower-api**: expose scope `access_as_user`
   under Application ID URI `api://order-control-tower`; define app roles
   `admin`, `operator`, `viewer`.
2. App registration **control-tower-web** (SPA): redirect URI = web origin,
   API permission to the scope above.
3. Assign users/groups to roles via Enterprise Application.
