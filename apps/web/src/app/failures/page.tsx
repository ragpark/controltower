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
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid2';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import PersonIcon from '@mui/icons-material/PersonOutline';
import {
  FAILURE_CATEGORY_LABELS,
  FailureCategory,
  ProvisioningFailureDto,
} from '@control-tower/shared-types';
import { EmptyState, PageHeader, StatCard, StatusChip } from '@control-tower/ui-components';
import { useAppStore } from '@/store';
import { useFailureBreakdown, useFailureMutations, useFailures } from '@/lib/queries';

const CATEGORY_COLOR: Record<string, string> = {
  TEP_ACCOUNT_MISSING: '#B58A00',
  INVALID_CUSTOMER_DATA: '#C2410C',
  DUPLICATE_ORG_MEMBERSHIP: '#7C3AED',
  LICENCE_CONFIG_ERROR: '#0B6BCB',
  INTEGRATION_FAULT: '#B91C1C',
  UNCATEGORISED: '#6B7280',
};

function FailureCard({
  failure,
  onResolve,
  onReassign,
}: {
  failure: ProvisioningFailureDto;
  onResolve: (f: ProvisioningFailureDto) => void;
  onReassign: (f: ProvisioningFailureDto) => void;
}) {
  const openOrder = useAppStore((s) => s.openOrder);
  const resolved = Boolean(failure.resolvedAt);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        p: 2.5,
        opacity: resolved ? 0.6 : 1,
        borderLeft: `4px solid ${CATEGORY_COLOR[failure.category] ?? '#6B7280'}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Order {failure.orderNumber}
        </Typography>
        {failure.contractNumber && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            contract {failure.contractNumber}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small"
          icon={<PersonIcon />}
          label={failure.owner}
          sx={{ fontWeight: 600 }}
          color="primary"
          variant="outlined"
        />
        <Chip
          size="small"
          label={FAILURE_CATEGORY_LABELS[failure.category] ?? failure.category}
          sx={{
            fontWeight: 600,
            color: CATEGORY_COLOR[failure.category],
            borderColor: CATEGORY_COLOR[failure.category],
          }}
          variant="outlined"
        />
        {resolved && <Chip size="small" color="success" label="Resolved" />}
      </Stack>

      <Typography
        variant="body2"
        sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: 13, color: 'text.secondary' }}
      >
        {failure.rawMessage}
      </Typography>

      <Box
        sx={{
          mt: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(0,127,163,0.06)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          Next step — {failure.owner}
        </Typography>
        <Typography variant="body2">{failure.suggestedAction}</Typography>
      </Box>

      {(failure.matchedOrders ?? []).length > 0 ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
          {failure.matchedOrders!.map((o) => (
            <Chip
              key={o.id}
              size="small"
              variant="outlined"
              onClick={() => openOrder(o.id)}
              label={`${o.productCode}${o.customerName ? ` · ${o.customerName}` : ''}`}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" sx={{ mt: 1.5, display: 'block', color: 'warning.main' }}>
          No imported order matches this order number yet — it will link automatically when the
          order arrives.
        </Typography>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
          Seen {failure.occurrences}× · first {new Date(failure.firstSeenAt).toLocaleDateString()} ·
          last {new Date(failure.lastSeenAt).toLocaleDateString()}
          {resolved && failure.resolvedBy ? ` · resolved by ${failure.resolvedBy}` : ''}
        </Typography>
        {!resolved && (
          <>
            <Button size="small" startIcon={<PersonIcon />} onClick={() => onReassign(failure)}>
              Reassign
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={() => onResolve(failure)}
            >
              Resolve
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

export default function FailuresPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [category, setCategory] = useState('');
  const [owner, setOwner] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ProvisioningFailureDto | null>(null);
  const [reassignTarget, setReassignTarget] = useState<ProvisioningFailureDto | null>(null);
  const [note, setNote] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading } = useFailures({
    page: page + 1,
    pageSize,
    category: category || undefined,
    owner: owner || undefined,
    search: search || undefined,
    includeResolved: includeResolved || undefined,
  });
  const { data: breakdown } = useFailureBreakdown();
  const mutations = useFailureMutations();

  const owners = breakdown?.byOwner ?? [];
  const totalOpen = owners.reduce((sum, o) => sum + o.count, 0);

  return (
    <Box>
      <PageHeader
        title="Provisioning Failures"
        subtitle="Downstream failures from the daily fulfilment report, routed to the team that owns the next step"
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Open failures" value={totalOpen} accentColor="#B91C1C" />
        </Grid>
        {owners.slice(0, 5).map((o) => (
          <Grid key={o.key} size={{ xs: 6, sm: 4, md: 2 }}>
            <StatCard
              label={o.key}
              value={o.count}
              caption="awaiting action"
              onClick={() => {
                setOwner(o.key === owner ? '' : o.key);
                setPage(0);
              }}
            />
          </Grid>
        ))}
      </Grid>

      {(breakdown?.byCategory ?? []).length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 2, p: 2, mb: 3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Open failures by root cause
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
            {breakdown!.byCategory.map((c) => (
              <Chip
                key={c.key}
                label={`${FAILURE_CATEGORY_LABELS[c.key as FailureCategory] ?? c.key}: ${c.count}`}
                onClick={() => {
                  setCategory(c.key === category ? '' : c.key);
                  setPage(0);
                }}
                variant={category === c.key ? 'filled' : 'outlined'}
                sx={{ borderColor: CATEGORY_COLOR[c.key], fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Card>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ p: 2 }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search order, contract or message…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchDraft);
                setPage(0);
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
          />
          <TextField
            select
            size="small"
            label="Root cause"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All</MenuItem>
            {Object.values(FailureCategory).map((c) => (
              <MenuItem key={c} value={c}>
                {FAILURE_CATEGORY_LABELS[c]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Owner"
            value={owner}
            onChange={(e) => {
              setOwner(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All teams</MenuItem>
            {owners.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                {o.key}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={includeResolved}
                onChange={(e) => {
                  setIncludeResolved(e.target.checked);
                  setPage(0);
                }}
              />
            }
            label="Show resolved"
          />
        </Stack>
        <Divider />
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Card>

      <Stack spacing={2}>
        {(data?.items ?? []).map((failure) => (
          <FailureCard
            key={failure.id}
            failure={failure}
            onResolve={(f) => {
              setResolveTarget(f);
              setNote('');
            }}
            onReassign={(f) => {
              setReassignTarget(f);
              setNewOwner(f.owner);
            }}
          />
        ))}
        {!isLoading && (data?.items ?? []).length === 0 && (
          <EmptyState
            title="No provisioning failures"
            description="Upload the daily failure report from Import History to populate this queue."
          />
        )}
      </Stack>

      <Dialog open={Boolean(resolveTarget)} onClose={() => setResolveTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Resolve failure</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Order {resolveTarget?.orderNumber} — {resolveTarget?.owner}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Resolution note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (resolveTarget) {
                mutations.resolve.mutate(
                  { id: resolveTarget.id, note: note || undefined },
                  { onSuccess: () => setToast('Failure resolved') },
                );
              }
              setResolveTarget(null);
            }}
          >
            Resolve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reassignTarget)} onClose={() => setReassignTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reassign owner</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Owning team"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            helperText="Re-imports will not overwrite a manually assigned owner"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newOwner.trim()}
            onClick={() => {
              if (reassignTarget) {
                mutations.reassign.mutate(
                  { ids: [reassignTarget.id], owner: newOwner.trim() },
                  { onSuccess: () => setToast('Owner updated') },
                );
              }
              setReassignTarget(null);
            }}
          >
            Reassign
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
