'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import {
  Classification,
  TrendGranularity,
} from '@control-tower/shared-types';
import {
  CLASSIFICATION_COLORS,
  PageHeader,
  StatCard,
} from '@control-tower/ui-components';
import {
  useBreakdown,
  useDashboardSummary,
  useOperationalHealth,
  useTrend,
} from '@/lib/queries';
import { BreakdownBar, ChartCard, SourcePie, TrendChart } from '@/components/charts';
import { buildRangeMetrics, RangeMetricPills } from '@/components/RangeMetricPills';
import { summariseTrend } from '@control-tower/reporting';

const QUEUE_LINKS: Partial<Record<Classification, string>> = {
  [Classification.PENDING]: '/queues/pending',
  [Classification.CUSTOMER_IMPACTED]: '/queues/customer-impacted',
  [Classification.COMPLETED]: '/queues/completed',
  [Classification.CANCELLED]: '/queues/cancelled',
  [Classification.EXCEPTION]: '/queues/exceptions',
};

/** Window covered by each granularity, kept in one place so the chart query
 *  and the range caption can never disagree. */
const RANGE_DAYS: Record<TrendGranularity, number> = {
  daily: 30,
  weekly: 90,
  monthly: 365,
};

const RANGE_LABEL: Record<TrendGranularity, string> = {
  daily: 'Last 30 days',
  weekly: 'Last 90 days',
  monthly: 'Last 12 months',
};

export default function DashboardPage() {
  const router = useRouter();
  const [granularity, setGranularity] = useState<TrendGranularity>('daily');
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: byStatus } = useBreakdown('by-status');
  const { data: byProduct } = useBreakdown('by-product');
  const { data: bySource } = useBreakdown('by-source');
  const { data: trend } = useTrend(granularity, RANGE_DAYS[granularity]);
  const { data: health } = useOperationalHealth();

  // Derived from the buckets the chart is rendering, so the pills and the bars
  // can never tell different stories.
  const rangeSummary = summariseTrend(trend ?? []);
  const rangeMetrics = buildRangeMetrics(rangeSummary.total, rangeSummary.byClassification);
  const rangeCaption = `${RANGE_LABEL[granularity]}${
    rangeSummary.from && rangeSummary.to ? ` · ${rangeSummary.from} to ${rangeSummary.to}` : ''
  }`;

  const cards: Array<{ label: string; value: number; classification?: Classification }> = [
    { label: 'Total orders', value: summary?.total ?? 0 },
    { label: 'Completed', value: summary?.byClassification.COMPLETED ?? 0, classification: Classification.COMPLETED },
    { label: 'Pending', value: summary?.byClassification.PENDING ?? 0, classification: Classification.PENDING },
    { label: 'Customer impacted', value: summary?.byClassification.CUSTOMER_IMPACTED ?? 0, classification: Classification.CUSTOMER_IMPACTED },
    { label: 'Exceptions', value: summary?.byClassification.EXCEPTION ?? 0, classification: Classification.EXCEPTION },
    { label: 'Cancelled', value: summary?.byClassification.CANCELLED ?? 0, classification: Classification.CANCELLED },
  ];

  return (
    <Box>
      <PageHeader
        title="Control Tower"
        subtitle="Executive summary of order operations across all connected sources"
      />
      {summaryLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid key={card.label} size={{ xs: 6, sm: 4, md: 2 }}>
            <StatCard
              label={card.label}
              value={card.value.toLocaleString()}
              accentColor={card.classification ? CLASSIFICATION_COLORS[card.classification] : '#007FA3'}
              onClick={
                card.classification && QUEUE_LINKS[card.classification]
                  ? () => router.push(QUEUE_LINKS[card.classification!]!)
                  : undefined
              }
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title="Order trend" height={392}>
            <Tabs
              value={granularity}
              onChange={(_e, v) => setGranularity(v)}
              sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0 } }}
            >
              <Tab value="daily" label="Daily" />
              <Tab value="weekly" label="Weekly" />
              <Tab value="monthly" label="Monthly" />
            </Tabs>
            <Box sx={{ my: 1.5 }}>
              <RangeMetricPills
                metrics={rangeMetrics}
                caption={rangeCaption}
                onSelect={(metric) =>
                  metric.classification && QUEUE_LINKS[metric.classification]
                    ? router.push(QUEUE_LINKS[metric.classification]!)
                    : undefined
                }
              />
            </Box>
            <Box sx={{ height: 240 }}>
              <TrendChart data={trend ?? []} granularity={granularity} />
            </Box>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <ChartCard title="Orders by status" height={300}>
            <BreakdownBar data={byStatus ?? []} colorByClassification />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 6 }}>
          <ChartCard title="Top products" height={280}>
            <BreakdownBar data={byProduct ?? []} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 6 }}>
          <ChartCard title="Orders by source" height={280}>
            <SourcePie data={bySource ?? []} />
          </ChartCard>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Operational health
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Processing success rate"
            value={health ? `${Math.round(health.processingSuccessRate * 100)}%` : '—'}
            accentColor={health && health.processingSuccessRate < 0.9 ? '#B91C1C' : '#1F7A3F'}
            caption={`${health?.totalRuns ?? 0} runs in the last 30 days`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Import failures"
            value={health?.failedRuns ?? 0}
            accentColor={health && health.failedRuns > 0 ? '#B91C1C' : '#1F7A3F'}
            caption={`${health?.failedRowsLast7d ?? 0} failed rows (7d)`}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5, height: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Stale imports
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {(health?.staleSources ?? []).length === 0 ? (
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                  All scheduled sources fresh
                </Typography>
              ) : (
                health!.staleSources.map((s) => (
                  <Chip
                    key={s.sourceId}
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={`${s.sourceName} — ${s.hoursSinceLastRun === null ? 'never ran' : `${Math.round(s.hoursSinceLastRun)}h ago`}`}
                  />
                ))
              )}
            </Stack>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5, height: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Data quality issues
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {(health?.dataQualityIssues ?? []).length === 0 ? (
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                  No issues detected
                </Typography>
              ) : (
                health!.dataQualityIssues.map((issue) => (
                  <Typography key={issue.issue} variant="body2">
                    {issue.issue}: <strong>{issue.count}</strong>
                  </Typography>
                ))
              )}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
