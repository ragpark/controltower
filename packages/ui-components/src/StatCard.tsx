import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  accentColor?: string;
  caption?: string;
  onClick?: () => void;
}

/** Executive-summary metric card with optional drill-down click. */
export function StatCard({ label, value, accentColor, caption, onClick }: StatCardProps) {
  const body = (
    <Box sx={{ p: 2.5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: accentColor ?? 'text.primary' }}>
        {value}
      </Typography>
      {caption ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
        height: '100%',
      }}
    >
      {onClick ? <CardActionArea onClick={onClick} aria-label={`Open ${label}`}>{body}</CardActionArea> : body}
    </Card>
  );
}
