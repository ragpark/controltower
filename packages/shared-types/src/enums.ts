export enum Classification {
  PENDING = 'PENDING',
  PLACED = 'PLACED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CUSTOMER_IMPACTED = 'CUSTOMER_IMPACTED',
  INVESTIGATE_REQUIRED = 'INVESTIGATE_REQUIRED',
  EXCEPTION = 'EXCEPTION',
}

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  [Classification.PENDING]: 'Pending',
  [Classification.PLACED]: 'Placed',
  [Classification.COMPLETED]: 'Completed',
  [Classification.CANCELLED]: 'Cancelled',
  [Classification.CUSTOMER_IMPACTED]: 'Customer Impacted',
  [Classification.INVESTIGATE_REQUIRED]: 'Investigate Required',
  [Classification.EXCEPTION]: 'Exception',
};

export enum SourceType {
  CSV_UPLOAD = 'CSV_UPLOAD',
  CSV_FILE = 'CSV_FILE',
  REST_API = 'REST_API',
  SHAREPOINT = 'SHAREPOINT',
  SFTP = 'SFTP',
  AZURE_BLOB = 'AZURE_BLOB',
  TABLEAU = 'TABLEAU',
  EMAIL_FAILURE_REPORT = 'EMAIL_FAILURE_REPORT',
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  [SourceType.CSV_UPLOAD]: 'Manual CSV upload',
  [SourceType.CSV_FILE]: 'CSV file drop',
  [SourceType.REST_API]: 'REST API',
  [SourceType.SHAREPOINT]: 'SharePoint',
  [SourceType.SFTP]: 'SFTP',
  [SourceType.AZURE_BLOB]: 'Azure Blob Storage',
  [SourceType.TABLEAU]: 'Tableau export',
  [SourceType.EMAIL_FAILURE_REPORT]: 'Provisioning failure report (email)',
};

export enum SourceStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR',
}

export enum ImportRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
}

export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  IMPORT = 'IMPORT',
  CLASSIFY = 'CLASSIFY',
  RECLASSIFY = 'RECLASSIFY',
  BULK_UPDATE = 'BULK_UPDATE',
  EXPORT = 'EXPORT',
}
