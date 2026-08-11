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
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ScienceIcon from '@mui/icons-material/ScienceOutlined';
import {
  Classification,
  ClassificationRuleDto,
  CLASSIFICATION_LABELS,
} from '@control-tower/shared-types';
import { ConfirmDialog, PageHeader, StatusChip } from '@control-tower/ui-components';
import { api } from '@/lib/api-client';
import { useRuleMutations, useRules } from '@/lib/queries';

interface RuleForm {
  id?: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  strategy: string;
  definitionText: string;
  outcome: Classification;
}

const EMPTY_FORM: RuleForm = {
  name: '',
  description: '',
  priority: 100,
  enabled: true,
  strategy: 'field-match',
  definitionText: JSON.stringify(
    { match: 'all', conditions: [{ field: 'orderStatus', operator: 'eq', value: '' }] },
    null,
    2,
  ),
  outcome: Classification.PENDING,
};

const SAMPLE_ORDER = JSON.stringify(
  {
    orderNumber: 'ORD-1001',
    productCode: 'PRD-A',
    orderStatus: 'Placed',
    customerName: 'Acme Ltd',
    quantity: 2,
    value: 150,
    orderDate: '2026-07-01T00:00:00Z',
  },
  null,
  2,
);

export default function RulesPage() {
  const { data: rules } = useRules();
  const mutations = useRuleMutations();
  const [form, setForm] = useState<RuleForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassificationRuleDto | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sampleText, setSampleText] = useState(SAMPLE_ORDER);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openEdit = (rule?: ClassificationRuleDto) => {
    setFormError(null);
    setForm(
      rule
        ? {
            id: rule.id,
            name: rule.name,
            description: rule.description ?? '',
            priority: rule.priority,
            enabled: rule.enabled,
            strategy: rule.strategy,
            definitionText: JSON.stringify(rule.ruleDefinition, null, 2),
            outcome: rule.outcome,
          }
        : { ...EMPTY_FORM },
    );
  };

  const parseDefinition = (): Record<string, unknown> | null => {
    try {
      return JSON.parse(form?.definitionText ?? '{}');
    } catch {
      setFormError('Rule definition must be valid JSON');
      return null;
    }
  };

  const submit = () => {
    if (!form) return;
    const ruleDefinition = parseDefinition();
    if (!ruleDefinition) return;
    const payload = {
      name: form.name,
      description: form.description || undefined,
      priority: Number(form.priority),
      enabled: form.enabled,
      strategy: form.strategy,
      ruleDefinition,
      outcome: form.outcome,
    };
    const handlers = {
      onSuccess: () => {
        setForm(null);
        setToast('Rule saved');
      },
      onError: (error: unknown) =>
        setFormError(error instanceof Error ? error.message : 'Save failed'),
    };
    if (form.id) mutations.update.mutate({ id: form.id, ...payload } as never, handlers);
    else mutations.create.mutate(payload as never, handlers);
  };

  const runPreview = async () => {
    if (!form) return;
    const ruleDefinition = parseDefinition();
    if (!ruleDefinition) return;
    try {
      const sampleOrder = JSON.parse(sampleText);
      const result = await api.post<{ matched: boolean; outcome: string | null; detail: unknown }>(
        '/api/v1/rules/preview',
        { strategy: form.strategy, ruleDefinition, outcome: form.outcome, sampleOrder },
      );
      setPreviewResult(
        `${result.matched ? `MATCHED → ${result.outcome}` : 'No match'}\n\n${JSON.stringify(result.detail, null, 2)}`,
      );
    } catch (error) {
      setPreviewResult(error instanceof Error ? error.message : 'Preview failed');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Classification Rules"
        subtitle="Rules run in priority order — the first match decides the order's classification. Changes apply without code deployments."
        actions={
          <>
            <Button
              startIcon={<ReplayIcon />}
              onClick={() =>
                mutations.reapply.mutate(undefined, {
                  onSuccess: (r) => setToast(`Re-classified ${r.reclassified} orders`),
                  onError: (e) => setToast(e instanceof Error ? e.message : 'Re-apply failed'),
                })
              }
            >
              Re-apply to all orders
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit()}>
              Add rule
            </Button>
          </>
        }
      />

      <Card variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
        <Table size="small" aria-label="Classification rules">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#FAFBFC' } }}>
              <TableCell width={90}>Priority</TableCell>
              <TableCell>Rule</TableCell>
              <TableCell width={130}>Strategy</TableCell>
              <TableCell width={180}>Outcome</TableCell>
              <TableCell width={90}>Enabled</TableCell>
              <TableCell width={110} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rules ?? []).map((rule) => (
              <TableRow key={rule.id} hover>
                <TableCell>
                  <Chip size="small" label={rule.priority} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {rule.name}
                  </Typography>
                  {rule.description && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {rule.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={rule.strategy} />
                </TableCell>
                <TableCell>
                  <StatusChip classification={rule.outcome} />
                </TableCell>
                <TableCell>
                  <Switch
                    size="small"
                    checked={rule.enabled}
                    inputProps={{ 'aria-label': `${rule.name} enabled` }}
                    onChange={(e) =>
                      mutations.update.mutate({ id: rule.id, enabled: e.target.checked } as never)
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit rule">
                    <IconButton size="small" aria-label={`Edit ${rule.name}`} onClick={() => openEdit(rule)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete rule">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Delete ${rule.name}`}
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} fullWidth maxWidth="md">
        <DialogTitle>{form?.id ? 'Edit rule' : 'Add rule'}</DialogTitle>
        {form && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  sx={{ width: { sm: 160 } }}
                  helperText="Lower runs first"
                />
              </Stack>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Strategy"
                  value={form.strategy}
                  onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="field-match">field-match — compare order fields</MenuItem>
                  <MenuItem value="order-age">order-age — older than N days</MenuItem>
                  <MenuItem value="always">always — catch-all</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Outcome"
                  value={form.outcome}
                  onChange={(e) => setForm({ ...form, outcome: e.target.value as Classification })}
                  fullWidth
                >
                  {Object.values(Classification).map((c) => (
                    <MenuItem key={c} value={c}>
                      {CLASSIFICATION_LABELS[c]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="Rule definition (JSON)"
                value={form.definitionText}
                onChange={(e) => setForm({ ...form, definitionText: e.target.value })}
                multiline
                minRows={8}
                fullWidth
                error={Boolean(formError)}
                helperText={
                  formError ??
                  'field-match: {"match":"all|any","conditions":[{"field","operator","value"}]} · operators: eq, neq, in, notIn, contains, startsWith, gt, gte, lt, lte, isEmpty, notEmpty, regex'
                }
                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
              />
              <Box>
                <Button startIcon={<ScienceIcon />} onClick={() => setPreviewOpen(true)}>
                  Test against a sample order
                </Button>
              </Box>
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

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Test rule</DialogTitle>
        <DialogContent>
          <TextField
            label="Sample order (JSON)"
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            multiline
            minRows={8}
            fullWidth
            sx={{ mt: 1 }}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
          />
          {previewResult && (
            <Typography
              component="pre"
              variant="caption"
              sx={{ mt: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
              {previewResult}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button variant="contained" onClick={runPreview}>
            Run test
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete rule"
        message={`Delete "${deleteTarget?.name}"? Existing execution traces keep the rule name for audit purposes.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            mutations.remove.mutate(deleteTarget.id, {
              onSuccess: () => setToast('Rule deleted'),
            });
          }
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
