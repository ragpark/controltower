'use client';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid2';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import { useRouter } from 'next/navigation';
import {
  SourceDto,
  SourceType,
  SOURCE_TYPE_LABELS,
} from '@control-tower/shared-types';
import { ConfirmDialog, EmptyState, PageHeader } from '@control-tower/ui-components';
import { useSourceMutations, useSourceTypes, useSources } from '@/lib/queries';

interface SourceForm {
  id?: string;
  name: string;
  type: SourceType;
  schedule: string;
  enabled: boolean;
  configText: string;
}

const EMPTY_FORM: SourceForm = {
  name: '',
  type: SourceType.CSV_UPLOAD,
  schedule: '',
  enabled: true,
  configText: JSON.stringify(
    {
      connector: {},
      mapping: { orderNumber: 'Order Number', productCode: 'Product Code' },
      delimiter: ',',
    },
    null,
    2,
  ),
};

export default function SourcesPage() {
  const router = useRouter();
  const { data: sources, isLoading } = useSources();
  const { data: types } = useSourceTypes();
  const mutations = useSourceMutations();
  const [form, setForm] = useState<SourceForm | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SourceDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openEdit = (source?: SourceDto) => {
    setConfigError(null);
    setForm(
      source
        ? {
            id: source.id,
            name: source.name,
            type: source.type,
            schedule: source.schedule ?? '',
            enabled: source.enabled,
            configText: JSON.stringify(source.configJson ?? {}, null, 2),
          }
        : { ...EMPTY_FORM },
    );
  };

  const submit = () => {
    if (!form) return;
    let configJson: Record<string, unknown>;
    try {
      configJson = JSON.parse(form.configText || '{}');
    } catch {
      setConfigError('Configuration must be valid JSON');
      return;
    }
    const payload = {
      name: form.name,
      type: form.type,
      enabled: form.enabled,
      schedule: form.schedule.trim() || undefined,
      configJson,
    };
    const onDone = {
      onSuccess: () => {
        setForm(null);
        setToast('Source saved');
      },
      onError: (error: unknown) =>
        setConfigError(error instanceof Error ? error.message : 'Save failed'),
    };
    if (form.id) mutations.update.mutate({ id: form.id, ...payload } as never, onDone);
    else mutations.create.mutate(payload as never, onDone);
  };

  const typeInfo = (type: SourceType) => types?.find((t) => t.type === type);

  return (
    <Box>
      <PageHeader
        title="Data Sources"
        subtitle="Register, schedule and monitor the feeds that supply order data"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit()}>
            Add source
          </Button>
        }
      />

      {!isLoading && (sources ?? []).length === 0 && (
        <EmptyState
          title="No sources yet"
          description="Add a source to start importing order data."
          action={<Button variant="contained" onClick={() => openEdit()}>Add source</Button>}
        />
      )}

      <Grid container spacing={2}>
        {(sources ?? []).map((source) => (
          <Grid key={source.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5, height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  {source.name}
                </Typography>
                <Tooltip title={source.enabled ? 'Disable source' : 'Enable source'}>
                  <Switch
                    size="small"
                    checked={source.enabled}
                    inputProps={{ 'aria-label': `${source.name} enabled` }}
                    onChange={(e) =>
                      mutations.update.mutate({ id: source.id, enabled: e.target.checked } as never)
                    }
                  />
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
                <Chip size="small" label={SOURCE_TYPE_LABELS[source.type]} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    source.status === 'ERROR'
                      ? 'error'
                      : source.enabled
                        ? 'success'
                        : 'default'
                  }
                  label={source.enabled ? source.status : 'DISABLED'}
                />
                {source.schedule && (
                  <Chip size="small" variant="outlined" label={`cron: ${source.schedule}`} />
                )}
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
                Last run:{' '}
                {source.lastRun
                  ? `${new Date(source.lastRun.startTime).toLocaleString()} — ${source.lastRun.status} (${source.lastRun.successfulRows} ok / ${source.lastRun.failedRows} failed)`
                  : 'never'}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
                <Tooltip title="Edit configuration">
                  <IconButton size="small" aria-label={`Edit ${source.name}`} onClick={() => openEdit(source)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Test connection">
                  <IconButton
                    size="small"
                    aria-label={`Test ${source.name}`}
                    onClick={() =>
                      mutations.test.mutate(source.id, {
                        onSuccess: (r) => setToast(`${r.ok ? '✓' : '✗'} ${r.message}`),
                        onError: (e) => setToast(e instanceof Error ? e.message : 'Test failed'),
                      })
                    }
                  >
                    <BoltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {typeInfo(source.type)?.supportsSchedule && (
                  <Tooltip title="Run import now">
                    <IconButton
                      size="small"
                      aria-label={`Run ${source.name}`}
                      onClick={() =>
                        mutations.run.mutate(source.id, {
                          onSuccess: (runs) =>
                            setToast(
                              runs.length === 0
                                ? 'Nothing to import'
                                : `Imported ${runs.reduce((n, r) => n + r.successfulRows, 0)} rows in ${runs.length} run(s)`,
                            ),
                          onError: (e) => setToast(e instanceof Error ? e.message : 'Run failed'),
                        })
                      }
                    >
                      <PlayIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="View import history">
                  <IconButton
                    size="small"
                    aria-label={`History for ${source.name}`}
                    onClick={() => router.push('/imports')}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="Delete source">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${source.name}`}
                    onClick={() => setDeleteTarget(source)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>{form?.id ? 'Edit source' : 'Add source'}</DialogTitle>
        {form && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                select
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SourceType })}
                fullWidth
              >
                {(types ?? []).map((t) => (
                  <MenuItem key={t.type} value={t.type}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Schedule (cron, optional)"
                placeholder="*/15 * * * *"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                helperText="5-field cron — leave empty for manual/upload-only sources"
                fullWidth
              />
              <TextField
                label="Configuration (JSON)"
                value={form.configText}
                onChange={(e) => setForm({ ...form, configText: e.target.value })}
                multiline
                minRows={8}
                fullWidth
                error={Boolean(configError)}
                helperText={
                  configError ??
                  Object.entries(typeInfo(form.type)?.configHints ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')
                }
                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!form?.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete source"
        message={`Delete "${deleteTarget?.name}"? Sources with imported orders cannot be deleted — disable them instead.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            mutations.remove.mutate(deleteTarget.id, {
              onSuccess: () => setToast('Source deleted'),
              onError: (e) => setToast(e instanceof Error ? e.message : 'Delete failed'),
            });
          }
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
