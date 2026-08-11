export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SavedViewDto {
  id: string;
  name: string;
  queue: string;
  config: {
    search?: string;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiUser {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
}
