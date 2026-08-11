'use client';
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import BookmarkIcon from '@mui/icons-material/BookmarkBorderOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import EditIcon from '@mui/icons-material/EditOutlined';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridRowSelectionModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { Classification, CLASSIFICATION_LABELS, OrderDto } from '@control-tower/shared-types';
import { StatusChip } from '@control-tower/ui-components';
import { useAppStore } from '@/store';
import {
  exportOrdersCsv,
  useBulkOrders,
  useOrders,
  useSavedViews,
  useSources,
  useViewMutations,
  type OrdersFilter,
} from '@/lib/queries';

export interface OrdersGridProps {
  /** Queue key for saved views; also fixes the classification filter. */
  queue: string;
  classification?: Classification;
}

/** Licence Manager reconciliation flag — "Not Match" is the actionable state. */
function MatchChip({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  const isMatch = value.trim().toLowerCase() === 'match';
  return (
    <Chip
      size="small"
      label={value}
      variant="outlined"
      color={isMatch ? 'success' : 'error'}
      sx={{ fontWeight: 600 }}
    />
  );
}

interface ViewConfig {
  search?: string;
  sourceId?: string;
  classification?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Server-driven data grid used by every operational queue:
 * search, filter, sort, export, saved views, bulk actions, drill-down.
 */
export function OrdersGrid({ queue, classification }: OrdersGridProps) {
  const openOrder = useAppStore((s) => s.openOrder);
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'importedAt', sort: 'desc' },
  ]);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
  const [viewsMenuAnchor, setViewsMenuAnchor] = useState<null | HTMLElement>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const filter: OrdersFilter = {
    page: pagination.page + 1,
    pageSize: pagination.pageSize,
    search: search || undefined,
    classification: classification ?? (classificationFilter || undefined),
    sourceId: sourceId || undefined,
    sortBy: sortModel[0]?.field,
    sortDir: sortModel[0]?.sort ?? undefined,
  };

  const { data, isLoading } = useOrders(filter);
  const { data: sources } = useSources();
  const { data: views } = useSavedViews(queue);
  const viewMutations = useViewMutations(queue);
  const bulk = useBulkOrders();

  const columns = useMemo<GridColDef<OrderDto>[]>(
    () => [
      { field: 'orderNumber', headerName: 'Order #', width: 100 },
      { field: 'orderSource', headerName: 'Channel', width: 120 },
      { field: 'productCode', headerName: 'ISBN', width: 140 },
      { field: 'productName', headerName: 'Product', flex: 1, minWidth: 200 },
      { field: 'customerName', headerName: 'Customer', width: 150 },
      { field: 'customerEmail', headerName: 'Email', flex: 1, minWidth: 180 },
      { field: 'orderStatus', headerName: 'Order status', width: 130 },
      { field: 'orderState', headerName: 'Custom status', width: 140 },
      {
        field: 'licenceOrderMatch',
        headerName: 'LM order',
        width: 110,
        renderCell: (params) => <MatchChip value={params.value as string | null} />,
      },
      {
        field: 'licenceIsbnMatch',
        headerName: 'LM ISBN',
        width: 110,
        renderCell: (params) => <MatchChip value={params.value as string | null} />,
      },
      {
        field: 'classification',
        headerName: 'Classification',
        width: 170,
        renderCell: (params) => (
          <StatusChip classification={params.value as Classification | null} />
        ),
      },
      { field: 'quantity', headerName: 'Qty', width: 70, type: 'number' },
      {
        field: 'value',
        headerName: 'Value',
        width: 100,
        type: 'number',
        valueFormatter: (value: string | null) => (value == null ? '' : Number(value).toFixed(2)),
      },
      {
        field: 'orderDate',
        headerName: 'Order date',
        width: 150,
        valueFormatter: (value: string | null) =>
          value ? new Date(value).toLocaleString() : '',
      },
      { field: 'sourceName', headerName: 'Source', width: 150, sortable: false },
      {
        field: 'importedAt',
        headerName: 'Imported',
        width: 160,
        valueFormatter: (value: string) => (value ? new Date(value).toLocaleString() : ''),
      },
    ],
    [],
  );

  const applyView = (config: ViewConfig) => {
    setSearch(config.search ?? '');
    setSearchDraft(config.search ?? '');
    setSourceId(config.sourceId ?? '');
    if (!classification) setClassificationFilter(config.classification ?? '');
    if (config.sortBy) setSortModel([{ field: config.sortBy, sort: config.sortDir ?? 'desc' }]);
    setViewsMenuAnchor(null);
  };

  const currentConfig: ViewConfig = {
    search: search || undefined,
    sourceId: sourceId || undefined,
    classification: classification ?? (classificationFilter || undefined),
    sortBy: sortModel[0]?.field,
    sortDir: sortModel[0]?.sort ?? undefined,
  };

  const selectedIds = selection as string[];

  const runBulk = (action: 'rerun-rules' | 'reclassify', target?: Classification) => {
    setBulkMenuAnchor(null);
    bulk.mutate(
      {
        ids: selectedIds,
        action,
        ...(target ? { classification: target } : {}),
      },
      {
        onSuccess: (result) =>
          setToast(`${(result as { affected?: number }).affected ?? selectedIds.length} order(s) updated`),
        onError: (error) => setToast(error instanceof Error ? error.message : 'Bulk action failed'),
      },
    );
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ p: 2 }}
      >
        <TextField
          size="small"
          placeholder="Search orders, customers, products…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(searchDraft);
              setPagination((p) => ({ ...p, page: 0 }));
            }
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 280 }}
          aria-label="Search orders"
        />
        {!classification && (
          <TextField
            select
            size="small"
            label="Classification"
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(Classification).map((c) => (
              <MenuItem key={c} value={c}>
                {CLASSIFICATION_LABELS[c]}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          select
          size="small"
          label="Source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All</MenuItem>
          {(sources ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {selectedIds.length > 0 && (
          <>
            <Chip label={`${selectedIds.length} selected`} color="primary" variant="outlined" />
            <Button
              size="small"
              variant="contained"
              startIcon={<EditIcon />}
              onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
            >
              Bulk actions
            </Button>
            <Menu
              anchorEl={bulkMenuAnchor}
              open={Boolean(bulkMenuAnchor)}
              onClose={() => setBulkMenuAnchor(null)}
            >
              <MenuItem onClick={() => runBulk('rerun-rules')}>
                <ReplayIcon fontSize="small" style={{ marginRight: 8 }} /> Re-run rules
              </MenuItem>
              {Object.values(Classification).map((c) => (
                <MenuItem key={c} onClick={() => runBulk('reclassify', c)}>
                  Reclassify as {CLASSIFICATION_LABELS[c]}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
        <Tooltip title="Saved views">
          <Button
            size="small"
            startIcon={<BookmarkIcon />}
            onClick={(e) => setViewsMenuAnchor(e.currentTarget)}
          >
            Views
          </Button>
        </Tooltip>
        <Menu
          anchorEl={viewsMenuAnchor}
          open={Boolean(viewsMenuAnchor)}
          onClose={() => setViewsMenuAnchor(null)}
        >
          {(views ?? []).map((view) => (
            <MenuItem key={view.id} onClick={() => applyView(view.config as ViewConfig)}>
              <Box sx={{ flexGrow: 1 }}>{view.name}</Box>
              <IconButton
                size="small"
                aria-label={`Delete view ${view.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  viewMutations.remove.mutate(view.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => {
              setViewsMenuAnchor(null);
              setSaveViewOpen(true);
            }}
          >
            + Save current view…
          </MenuItem>
        </Menu>
        <Tooltip title="Export current view to CSV">
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() =>
              exportOrdersCsv({ ...currentConfig }).catch(() => setToast('Export failed'))
            }
          >
            Export
          </Button>
        </Tooltip>
      </Stack>

      <DataGrid
        rows={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        rowCount={data?.total ?? 0}
        paginationMode="server"
        sortingMode="server"
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        pageSizeOptions={[10, 25, 50, 100]}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        onRowClick={(params) => openOrder(String(params.id))}
        autoHeight
        density="compact"
        sx={{
          border: 'none',
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAFBFC' },
        }}
      />

      <Dialog open={saveViewOpen} onClose={() => setSaveViewOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save current view</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="View name"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!viewName.trim()}
            onClick={() => {
              viewMutations.save.mutate(
                { name: viewName.trim(), config: currentConfig as Record<string, unknown> },
                { onSuccess: () => setToast('View saved') },
              );
              setSaveViewOpen(false);
              setViewName('');
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Card>
  );
}
