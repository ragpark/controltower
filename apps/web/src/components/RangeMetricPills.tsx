'use client';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Classification, CLASSIFICATION_LABELS } from '@control-tower/shared-types';
import { CLASSIFICATION_COLORS } from '@control-tower/ui-components';

export interface RangeMetric {
  key: string;
  label: string;
  value: number;
  color: string;
  classification?: Classification;
}

/**
 * The same six headline metrics as the executive summary, scoped to the window
 * the trend chart is showing. Rendered as compact pills rather than cards so
 * they read as a qualifier on the chart above, not a competing summary.
 */
export function buildRangeMetrics(
  total: number,
  byClassification: Record<Classification, number>,
): RangeMetric[] {
  return [
    { key: 'total', label: 'Total', value: total, color: '#007FA3' },
    ...(
      [
        Classification.COMPLETED,
        Classification.PENDING,
        Classification.CUSTOMER_IMPACTED,
        Classification.EXCEPTION,
        Classification.CANCELLED,
      ] as const
    ).map((classification) => ({
      key: classification,
      label: CLASSIFICATION_LABELS[classification],
      value: byClassification[classification] ?? 0,
      color: CLASSIFICATION_COLORS[classification],
      classification,
    })),
  ];
}

export function RangeMetricPills({
  metrics,
  caption,
  onSelect,
  state = 'ready',
}: {
  metrics: RangeMetric[];
  caption?: string;
  onSelect?: (metric: RangeMetric) => void;
  /** A zero is a claim about the data; never show one before it has arrived. */
  state?: 'loading' | 'error' | 'ready';
}) {
  const pending = state !== 'ready';
  return (
    <Box aria-busy={state === 'loading'}>
      {caption ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
          {state === 'loading' ? 'Loading…' : state === 'error' ? 'Trend unavailable' : caption}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {metrics.map((metric) => {
          const interactive = Boolean(onSelect && metric.classification) && !pending;
          return (
            <Box
              key={metric.key}
              {...(interactive
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onSelect?.(metric),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect?.(metric);
                      }
                    },
                    'aria-label': `${metric.label}: ${metric.value} in the selected range`,
                  }
                : {})}
              {...(pending ? { 'aria-label': `${metric.label}: not yet available` } : {})}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.5,
                px: 1.15,
                py: 0.6,
                borderRadius: 999,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                cursor: interactive ? 'pointer' : 'default',
                transition: 'border-color 120ms, background-color 120ms',
                '&:hover': interactive
                  ? { borderColor: metric.color, bgcolor: 'rgba(0,127,163,0.04)' }
                  : undefined,
                '&:focus-visible': {
                  outline: `2px solid ${metric.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: pending ? 'text.disabled' : metric.color,
                  alignSelf: 'center',
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {metric.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: pending ? 'text.disabled' : metric.color,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pending ? '—' : metric.value.toLocaleString()}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
