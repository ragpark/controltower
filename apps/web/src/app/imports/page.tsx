'use client';
import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import { ImportLogEntry, ImportRunDto } from '@control-tower/shared-types';
import { EmptyState, PageHeader } from '@control-tower/ui-components';
import {
  useImportRun,
  useImportRuns,
  useSources,
  useSourceTypes,
  useUploadCsv,
} from '@/lib/queries';

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
  COMPLETED: 'success',
  COMPLETED_WITH_ERRORS: 'warning',
  FAILED: 'error',
  RUNNING: 'info',
};

export default function ImportsPage() {
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [uploadSourceId, setUploadSourceId] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useImportRuns({
    page: pagination.page + 1,
    pageSize: pagination.pageSize,
    sourceId: sourceFilter || undefined,
  });
  const { data: sources } = useSources();
  const { data: sourceTypes } = useSourceTypes();
  const { data: selectedRun } = useImportRun(selectedRunId);
  const upload = useUploadCsv();

  // Driven by the connector's declared capability, so new upload-based source
  // types appear here automatically rather than needing this list updated.
  const uploadableTypes = new Set(
    (sourceTypes ?? []).filter((t) => t.supportsUpload).map((t) => t.type),
  );
  const uploadSources = (sources ?? []).filter((s) => uploadableTypes.has(s.type));

  const columns: GridColDef<ImportRunDto>[] = [
    {
      field: 'startTime',
      headerName: 'Started',
      width: 170,
      valueFormatter: (value: string) => new Date(value).toLocaleString(),
    },
    { field: 'sourceName', headerName: 'Source', width: 180 },
    { field: 'filename', headerName: 'File', flex: 1, minWidth: 180 },
    {
      field: 'status',
      headerName: 'Status',
      width: 200,
      renderCell: (params) => (
        <Chip
          size="small"
          label={String(params.value).replace(/_/g, ' ')}
          color={STATUS_COLOR[params.value as string] ?? 'default'}
          variant="outlined"
        />
      ),
    },
    { field: 'totalRows', headerName: 'Rows', width: 90, type: 'number' },
    { field: 'successfulRows', headerName: 'Succeeded', width: 110, type: 'number' },
    { field: 'failedRows', headerName: 'Failed', width: 90, type: 'number' },
    { field: 'triggeredBy', headerName: 'Triggered by', width: 140 },
  ];

  const handleFile = (file: File | null) => {
    if (!file || !uploadSourceId) return;
    upload.mutate(
      { sourceId: uploadSourceId, file },
      {
        onSuccess: (run) =>
          setToast(`Imported ${run.successfulRows} rows (${run.failedRows} failed)`),
        onError: (error) =>
          setToast(error instanceof Error ? error.message : 'Upload failed'),
      },
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <PageHeader
        title="Import History"
        subtitle="Every import run across all sources, with row-level logs"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              select
              size="small"
              label="Upload to source"
              value={uploadSourceId}
              onChange={(e) => setUploadSourceId(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {uploadSources.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              disabled={!uploadSourceId || upload.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {upload.isPending ? 'Uploading…' : 'Upload CSV'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              aria-label="CSV file"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </Stack>
        }
      />

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ p: 2 }}>
          <TextField
            select
            size="small"
            label="Source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All sources</MenuItem>
            {(sources ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total ?? 0}
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[10, 25, 50]}
          onRowClick={(params) => setSelectedRunId(String(params.id))}
          autoHeight
          density="compact"
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Card>

      <Dialog
        open={Boolean(selectedRunId)}
        onClose={() => setSelectedRunId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Import run log
          {selectedRun ? ` — ${selectedRun.filename ?? selectedRun.id}` : ''}
        </DialogTitle>
        <DialogContent>
          {selectedRun && (selectedRun.log ?? []).length > 0 ? (
            <Stack spacing={0.5}>
              {(selectedRun.log as ImportLogEntry[]).map((entry, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    color:
                      entry.level === 'error'
                        ? 'error.main'
                        : entry.level === 'warn'
                          ? 'warning.main'
                          : 'text.secondary',
                  }}
                >
                  [{entry.level.toUpperCase()}]{entry.row !== undefined ? ` row ${entry.row}` : ''}{' '}
                  {entry.message}
                </Typography>
              ))}
            </Stack>
          ) : (
            <EmptyState title="No log entries" />
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
