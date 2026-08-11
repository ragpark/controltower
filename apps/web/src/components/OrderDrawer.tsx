'use client';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { StatusChip } from '@control-tower/ui-components';
import { Classification } from '@control-tower/shared-types';
import { useAppStore } from '@/store';
import {
  useOrder,
  useOrderAudit,
  useOrderHistory,
  useOrderRelated,
  useOrderTrace,
} from '@/lib/queries';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function fmtDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function matchColor(value: string | null | undefined): 'success' | 'error' | 'default' {
  if (!value) return 'default';
  return value.trim().toLowerCase() === 'match' ? 'success' : 'error';
}

/**
 * Order detail side panel: full order info, classification explanation,
 * rule execution trace, version history, related orders and audit trail.
 */
export function OrderDrawer() {
  const { selectedOrderId, closeOrder, openOrder } = useAppStore();
  const [tab, setTab] = useState(0);
  const { data: order, isLoading } = useOrder(selectedOrderId);
  const { data: trace } = useOrderTrace(selectedOrderId);
  const { data: history } = useOrderHistory(selectedOrderId);
  const { data: related } = useOrderRelated(selectedOrderId);
  const { data: audit } = useOrderAudit(selectedOrderId);

  return (
    <Drawer
      anchor="right"
      open={Boolean(selectedOrderId)}
      onClose={closeOrder}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            Order detail
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {order ? `${order.orderNumber} · ${order.productCode}` : '…'}
          </Typography>
        </Box>
        {order && <StatusChip classification={order.classification as Classification | null} />}
        <IconButton aria-label="Close order detail" onClick={closeOrder}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />

      {isLoading || !order ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ px: 1 }}
          >
            <Tab label="Details" />
            <Tab label={`Rule trace (${trace?.length ?? 0})`} />
            <Tab label={`History (${history?.length ?? 0})`} />
            <Tab label={`Related (${related?.length ?? 0})`} />
            <Tab label={`Audit (${audit?.length ?? 0})`} />
          </Tabs>
          <Divider />

          <Box sx={{ p: 2.5, overflowY: 'auto' }}>
            {tab === 0 && (
              <Stack spacing={2.5}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(0,127,163,0.06)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Classification explanation
                  </Typography>
                  <Typography variant="body2">
                    {order.classificationReason ?? 'Not yet classified'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Classified {fmtDate(order.classifiedAt)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Licence Manager reconciliation
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={matchColor(order.licenceOrderMatch)}
                      label={`Order: ${order.licenceOrderMatch ?? '—'}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={matchColor(order.licenceIsbnMatch)}
                      label={`ISBN: ${order.licenceIsbnMatch ?? '—'}`}
                    />
                  </Stack>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                  <Field label="Order number" value={order.orderNumber} />
                  <Field label="Sales channel" value={order.orderSource} />
                  <Field label="Source order id" value={order.sourceOrderId} />
                  <Field label="Customer" value={order.customerName} />
                  <Field label="Email" value={order.customerEmail} />
                  <Field label="Account number" value={order.customerId} />
                  <Field label="Product" value={order.productName} />
                  <Field label="ISBN / product code" value={order.productCode} />
                  <Field label="Order status" value={order.orderStatus} />
                  <Field label="Custom status" value={order.orderState} />
                  <Field label="Quantity" value={order.quantity} />
                  <Field label="Value" value={order.value} />
                  <Field label="Order created" value={fmtDate(order.orderDate)} />
                  <Field label="Imported" value={fmtDate(order.importedAt)} />
                  <Field label="Source file" value={order.sourceFile} />
                  <Field label="Source" value={(order as { source?: { name?: string } }).source?.name} />
                </Box>
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={1.5}>
                {(trace ?? []).map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: entry.matched ? 'success.main' : 'divider',
                      borderRadius: 2,
                      bgcolor: entry.matched ? 'rgba(31,122,63,0.05)' : 'transparent',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      {entry.matched ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : (
                        <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                        {entry.ruleName}
                      </Typography>
                      <Chip size="small" label={`priority ${entry.priority}`} variant="outlined" />
                      {entry.outcome && (
                        <StatusChip classification={entry.outcome as Classification} />
                      )}
                    </Stack>
                    <Typography
                      component="pre"
                      variant="caption"
                      sx={{
                        m: 0,
                        mt: 1,
                        whiteSpace: 'pre-wrap',
                        color: 'text.secondary',
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(entry.detail, null, 2)}
                    </Typography>
                  </Box>
                ))}
                {(trace ?? []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No rule evaluations recorded yet.
                  </Typography>
                )}
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={1.5}>
                {(history ?? []).map((entry) => (
                  <Box key={entry.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {fmtDate(entry.createdAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Changed: {entry.changedFields.join(', ') || '—'}
                    </Typography>
                  </Box>
                ))}
                {(history ?? []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No previous versions — this order has not been updated since import.
                  </Typography>
                )}
              </Stack>
            )}

            {tab === 3 && (
              <List dense disablePadding>
                {(related ?? []).map((r) => (
                  <ListItemButton key={r.id} onClick={() => openOrder(r.id)} sx={{ borderRadius: 1.5 }}>
                    <ListItemText
                      primary={`${r.orderNumber} · ${r.productCode}`}
                      secondary={r.customerName ?? undefined}
                    />
                    <StatusChip classification={r.classification as Classification | null} />
                  </ListItemButton>
                ))}
                {(related ?? []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No related orders found.
                  </Typography>
                )}
              </List>
            )}

            {tab === 4 && (
              <Stack spacing={1.5}>
                {(audit ?? []).map((entry) => (
                  <Box key={entry.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={entry.action} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {fmtDate(entry.timestamp)} · {entry.changedBy}
                      </Typography>
                    </Stack>
                    {entry.changes && (
                      <Typography
                        component="pre"
                        variant="caption"
                        sx={{ m: 0, mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {JSON.stringify(entry.changes, null, 2)}
                      </Typography>
                    )}
                  </Box>
                ))}
                {(audit ?? []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No audit entries.
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
}
