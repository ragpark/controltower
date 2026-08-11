'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AuditLogDto,
  BreakdownItem,
  BulkOrderRequest,
  ClassificationRuleDto,
  ConnectionTestResult,
  DashboardSummary,
  ImportRunDto,
  OperationalHealth,
  OrderDto,
  OrderHistoryDto,
  Paginated,
  RuleExecutionDto,
  SavedViewDto,
  SourceDto,
  SourceTypeInfo,
  TrendBucket,
  TrendGranularity,
} from '@control-tower/shared-types';
import { api, buildQuery } from './api-client';

// ── Dashboard ───────────────────────────────────────────────────────────
export const useDashboardSummary = () =>
  useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/api/v1/dashboard/summary'),
    refetchInterval: 60_000,
  });

export const useBreakdown = (kind: 'by-status' | 'by-product' | 'by-source') =>
  useQuery<BreakdownItem[]>({
    queryKey: ['dashboard', kind],
    queryFn: () => api.get(`/api/v1/dashboard/${kind}`),
    refetchInterval: 60_000,
  });

export const useTrend = (granularity: TrendGranularity, days: number) =>
  useQuery<TrendBucket[]>({
    queryKey: ['dashboard', 'trend', granularity, days],
    queryFn: () => api.get(`/api/v1/dashboard/trend${buildQuery({ granularity, days })}`),
  });

export const useOperationalHealth = () =>
  useQuery<OperationalHealth>({
    queryKey: ['dashboard', 'health'],
    queryFn: () => api.get('/api/v1/dashboard/health'),
    refetchInterval: 60_000,
  });

// ── Orders ──────────────────────────────────────────────────────────────
export interface OrdersFilter {
  page: number;
  pageSize: number;
  search?: string;
  classification?: string;
  sourceId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export const useOrders = (filter: OrdersFilter) =>
  useQuery<Paginated<OrderDto>>({
    queryKey: ['orders', filter],
    queryFn: () => api.get(`/api/v1/orders${buildQuery({ ...filter })}`),
    placeholderData: (prev) => prev,
  });

export const useOrder = (id: string | null) =>
  useQuery<OrderDto & { source?: { name: string } | null }>({
    queryKey: ['order', id],
    queryFn: () => api.get(`/api/v1/orders/${id}`),
    enabled: Boolean(id),
  });

export const useOrderTrace = (id: string | null) =>
  useQuery<RuleExecutionDto[]>({
    queryKey: ['order', id, 'trace'],
    queryFn: () => api.get(`/api/v1/orders/${id}/trace`),
    enabled: Boolean(id),
  });

export const useOrderHistory = (id: string | null) =>
  useQuery<OrderHistoryDto[]>({
    queryKey: ['order', id, 'history'],
    queryFn: () => api.get(`/api/v1/orders/${id}/history`),
    enabled: Boolean(id),
  });

export const useOrderRelated = (id: string | null) =>
  useQuery<OrderDto[]>({
    queryKey: ['order', id, 'related'],
    queryFn: () => api.get(`/api/v1/orders/${id}/related`),
    enabled: Boolean(id),
  });

export const useOrderAudit = (id: string | null) =>
  useQuery<AuditLogDto[]>({
    queryKey: ['order', id, 'audit'],
    queryFn: () => api.get(`/api/v1/orders/${id}/audit`),
    enabled: Boolean(id),
  });

export const useBulkOrders = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkOrderRequest) => api.post('/api/v1/orders/bulk', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export async function exportOrdersCsv(filter: Partial<OrdersFilter>): Promise<void> {
  const csv = await api.get<string>(
    `/api/v1/orders/export${buildQuery({ ...filter })}`,
  );
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Sources ─────────────────────────────────────────────────────────────
export const useSources = () =>
  useQuery<SourceDto[]>({ queryKey: ['sources'], queryFn: () => api.get('/api/v1/sources') });

export const useSourceTypes = () =>
  useQuery<SourceTypeInfo[]>({
    queryKey: ['source-types'],
    queryFn: () => api.get('/api/v1/sources/types'),
    staleTime: Infinity,
  });

export const useSourceMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sources'] });
  return {
    create: useMutation({
      mutationFn: (body: Partial<SourceDto>) => api.post<SourceDto>('/api/v1/sources', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<SourceDto> & { id: string }) =>
        api.patch<SourceDto>(`/api/v1/sources/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/v1/sources/${id}`),
      onSuccess: invalidate,
    }),
    test: useMutation({
      mutationFn: (id: string) => api.post<ConnectionTestResult>(`/api/v1/sources/${id}/test`),
    }),
    run: useMutation({
      mutationFn: (id: string) => api.post<ImportRunDto[]>(`/api/v1/sources/${id}/run`),
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['import-runs'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }),
  };
};

// ── Imports ─────────────────────────────────────────────────────────────
export const useImportRuns = (params: { page: number; pageSize: number; sourceId?: string }) =>
  useQuery<Paginated<ImportRunDto>>({
    queryKey: ['import-runs', params],
    queryFn: () => api.get(`/api/v1/imports/runs${buildQuery({ ...params })}`),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });

export const useImportRun = (id: string | null) =>
  useQuery<ImportRunDto>({
    queryKey: ['import-runs', id],
    queryFn: () => api.get(`/api/v1/imports/runs/${id}`),
    enabled: Boolean(id),
  });

export const useUploadCsv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, file }: { sourceId: string; file: File }) => {
      const form = new FormData();
      form.append('sourceId', sourceId);
      form.append('file', file);
      return api.post<ImportRunDto>('/api/v1/imports/upload', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// ── Rules ───────────────────────────────────────────────────────────────
export const useRules = () =>
  useQuery<ClassificationRuleDto[]>({
    queryKey: ['rules'],
    queryFn: () => api.get('/api/v1/rules'),
  });

export const useRuleMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rules'] });
  return {
    create: useMutation({
      mutationFn: (body: Partial<ClassificationRuleDto>) => api.post('/api/v1/rules', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<ClassificationRuleDto> & { id: string }) =>
        api.patch(`/api/v1/rules/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/v1/rules/${id}`),
      onSuccess: invalidate,
    }),
    reapply: useMutation({
      mutationFn: () => api.post<{ reclassified: number }>('/api/v1/rules/reapply', {}),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      },
    }),
  };
};

// ── Saved views ─────────────────────────────────────────────────────────
export const useSavedViews = (queue: string) =>
  useQuery<SavedViewDto[]>({
    queryKey: ['views', queue],
    queryFn: () => api.get(`/api/v1/views${buildQuery({ queue })}`),
  });

export const useViewMutations = (queue: string) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['views', queue] });
  return {
    save: useMutation({
      mutationFn: (body: { name: string; config: Record<string, unknown> }) =>
        api.post<SavedViewDto>('/api/v1/views', { ...body, queue }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/v1/views/${id}`),
      onSuccess: invalidate,
    }),
  };
};
