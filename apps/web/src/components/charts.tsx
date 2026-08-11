'use client';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BreakdownItem,
  Classification,
  CLASSIFICATION_LABELS,
  TrendBucket,
} from '@control-tower/shared-types';
import { CLASSIFICATION_COLORS } from '@control-tower/ui-components';

const NEUTRAL_PALETTE = ['#007FA3', '#512EAB', '#B58A00', '#1F7A3F', '#C2410C', '#0B6BCB', '#6B7280'];

export function ChartCard({
  title,
  children,
  height = 280,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5, height: '100%' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      <Box sx={{ width: '100%', height }}>{children}</Box>
    </Card>
  );
}

export function TrendChart({ data }: { data: TrendBucket[] }) {
  const series = Object.values(Classification);
  const rows = data.map((bucket) => ({
    bucket: bucket.bucket.slice(5), // MM-DD
    total: bucket.total,
    ...bucket.byClassification,
  }));
  return (
    <ResponsiveContainer>
      <AreaChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend formatter={(value) => CLASSIFICATION_LABELS[value as Classification] ?? value} />
        {series.map((classification) => (
          <Area
            key={classification}
            type="monotone"
            stackId="1"
            dataKey={classification}
            name={classification}
            stroke={CLASSIFICATION_COLORS[classification]}
            fill={CLASSIFICATION_COLORS[classification]}
            fillOpacity={0.35}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BreakdownBar({
  data,
  colorByClassification = false,
}: {
  data: BreakdownItem[];
  colorByClassification?: boolean;
}) {
  const rows = data.map((d) => ({
    ...d,
    label:
      colorByClassification && d.key in CLASSIFICATION_LABELS
        ? CLASSIFICATION_LABELS[d.key as Classification]
        : d.label,
  }));
  return (
    <ResponsiveContainer>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {rows.map((row, index) => (
            <Cell
              key={row.key}
              fill={
                colorByClassification
                  ? (CLASSIFICATION_COLORS[row.key as Classification] ?? '#6B7280')
                  : NEUTRAL_PALETTE[index % NEUTRAL_PALETTE.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourcePie({ data }: { data: BreakdownItem[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.key} fill={NEUTRAL_PALETTE[index % NEUTRAL_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
