// Order Control Tower — Azure Container Apps deployment
// Deploy: az deployment group create -g <rg> -f azure-container-apps.bicep \
//           -p containerRegistry=<acr>.azurecr.io postgresPassword=<secret> ...
//
// Images are built from apps/api/Dockerfile and apps/web/Dockerfile and pushed
// to ACR by CI (see .github/workflows/ci.yml).

@description('Deployment location')
param location string = resourceGroup().location

@description('Container registry login server, e.g. myacr.azurecr.io')
param containerRegistry string

@description('API image tag')
param apiImage string = 'control-tower-api:latest'

@description('Web image tag')
param webImage string = 'control-tower-web:latest'

@secure()
@description('PostgreSQL admin password')
param postgresPassword string

@description('Entra ID tenant id used for API token validation')
param entraTenantId string

@description('Entra ID application audience (api://…)')
param entraApiAudience string = 'api://order-control-tower'

var postgresServerName = 'octower-pg-${uniqueString(resourceGroup().id)}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'octower-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'octower-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: postgresServerName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: 'octower'
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'octower'
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'octower-api'
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: { external: true, targetPort: 4000, transport: 'http' }
      secrets: [
        {
          name: 'database-url'
          value: 'postgresql://octower:${postgresPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/octower?sslmode=require'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${containerRegistry}/${apiImage}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_ENABLED', value: 'true' }
            { name: 'ENTRA_TENANT_ID', value: entraTenantId }
            { name: 'ENTRA_API_AUDIENCE', value: entraApiAudience }
            { name: 'CORS_ORIGINS', value: 'https://${web.properties.configuration.ingress.fqdn}' }
            { name: 'LOG_FORMAT', value: 'json' }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 4000 } }
            { type: 'Readiness', httpGet: { path: '/readyz', port: 4000 } }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'octower-web'
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'http' }
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${containerRegistry}/${webImage}'
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
