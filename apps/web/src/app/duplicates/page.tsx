'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ConfirmDialog, EmptyState, PageHeader, StatusChip } from '@control-tower/ui-components';
import { Classification } from '@control-tower/shared-types';
import { api } from '../../lib/api-client';
import { useDuplicateReport, useResolveDuplicates } from '../../lib/queries';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function DuplicatesPage() {
  const { data, isLoading, isError, error } = useDuplicateReport();
  const resolve = useResolveDuplicates();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Identifiers and provenance only — the endpoint never selects customer name
  // or email, so the file cannot carry them.
  const exportReport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await api.get<string>('/api/v1/duplicates/export');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'duplicate-orders.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const groups = data?.groups ?? [];
  const selectedGroups = useMemo(
    () => groups.filter((g) => selected.includes(g.key)),
    [groups, selected],
  );
  const removable = selectedGroups.reduce((n, g) => n + g.removableCount, 0);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Duplicate Orders" subtitle="Order lines stored more than once" />
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress aria-label="Loading duplicate report" />
        </Stack>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box>
        <PageHeader title="Duplicate Orders" subtitle="Order lines stored more than once" />
        <Alert severity="error">
          <AlertTitle>Could not load the duplicate report</AlertTitle>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Duplicate Orders"
        subtitle="Order lines whose order number and ISBN match but differ by letter case"
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>What counts as a duplicate here</AlertTitle>
        The natural key is order number plus product code (the ISBN), and it is a unique
        constraint — so identical rows cannot exist. These groups differ only by letter case,
        which the database treats as different values. The most recently imported row is kept;
        the rest are removed, with their history and rule trace moved onto the row that stays.
      </Alert>

      {groups.length === 0 ? (
        <EmptyState
          title="No duplicates found"
          description="Every order line is stored once. Nothing to resolve."
        />
      ) : (
        <>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {data?.groupCount} duplicate {data?.groupCount === 1 ? 'group' : 'groups'} ·{' '}
              {data?.removableCount} {data?.removableCount === 1 ? 'row' : 'rows'} removable
            </Typography>
            <Box flexGrow={1} />
            <Button variant="outlined" onClick={exportReport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={selected.length === 0 || resolve.isPending}
              onClick={() => setConfirming(true)}
            >
              Remove {removable > 0 ? removable : ''} superseded{' '}
              {removable === 1 ? 'row' : 'rows'}
            </Button>
          </Stack>

          {exportError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
              {exportError}
            </Alert>
          )}
          {resolve.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {resolve.error instanceof Error ? resolve.error.message : 'Resolution failed'}
            </Alert>
          )}
          {resolve.isSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Removed {resolve.data.ordersRemoved}{' '}
              {resolve.data.ordersRemoved === 1 ? 'row' : 'rows'} across{' '}
              {resolve.data.groupsResolved}{' '}
              {resolve.data.groupsResolved === 1 ? 'group' : 'groups'}. Moved{' '}
              {resolve.data.historyRowsReattached} history and{' '}
              {resolve.data.ruleExecutionsReattached} rule-trace rows onto the surviving orders.
            </Alert>
          )}

          <Stack spacing={2}>
            {groups.map((group) => (
              <Card key={group.key} variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Checkbox
                      checked={selected.includes(group.key)}
                      onChange={() => toggle(group.key)}
                      inputProps={{
                        'aria-label': `Select duplicate group ${group.orderNumber} ${group.productCode}`,
                      }}
                    />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {group.orderNumber} · {group.productCode}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${group.variantCount} rows · ${group.removableCount} removable`}
                    />
                  </Stack>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Keep</TableCell>
                        <TableCell>Order number</TableCell>
                        <TableCell>Product code</TableCell>
                        <TableCell>Classification</TableCell>
                        <TableCell>Imported</TableCell>
                        <TableCell>Source file</TableCell>
                        <TableCell>Import run</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.variants.map((v) => (
                        <TableRow key={v.id} selected={v.survivor}>
                          <TableCell>
                            {v.survivor ? (
                              <Chip size="small" color="success" label="Keep" />
                            ) : (
                              <Chip size="small" color="default" label="Remove" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>
                            <code>{v.orderNumber}</code>
                          </TableCell>
                          <TableCell>
                            <code>{v.productCode}</code>
                          </TableCell>
                          <TableCell>
                            <StatusChip classification={v.classification as Classification | null} />
                          </TableCell>
                          <TableCell>{formatDate(v.importedAt)}</TableCell>
                          <TableCell>{v.sourceFile ?? '—'}</TableCell>
                          <TableCell>
                            {v.importRunId ? (
                              <code title={v.importRunId}>{v.importRunId.slice(0, 8)}</code>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Remove ${removable} superseded ${removable === 1 ? 'row' : 'rows'}?`}
        message={
          `This keeps the most recently imported row in each of the ${selectedGroups.length} ` +
          `selected ${selectedGroups.length === 1 ? 'group' : 'groups'} and deletes the rest. ` +
          'History and rule trace move to the row that stays, and each removed row is snapshotted ' +
          'into its history, so the order line keeps its past. The deletion itself cannot be undone ' +
          'from the interface.'
        }
        confirmLabel="Remove rows"
        destructive
        onConfirm={() => {
          resolve.mutate(selected);
          setSelected([]);
          setConfirming(false);
        }}
        onClose={() => setConfirming(false)}
      />
    </Box>
  );
}
