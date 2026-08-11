import Chip from '@mui/material/Chip';
import { Classification, CLASSIFICATION_LABELS } from '@control-tower/shared-types';
import { CLASSIFICATION_BG, CLASSIFICATION_COLORS } from './classification-colors';

export interface StatusChipProps {
  classification: Classification | null | undefined;
  size?: 'small' | 'medium';
}

/** Coloured pill showing an order's operational classification. */
export function StatusChip({ classification, size = 'small' }: StatusChipProps) {
  if (!classification) {
    return <Chip size={size} label="Unclassified" variant="outlined" />;
  }
  return (
    <Chip
      size={size}
      label={CLASSIFICATION_LABELS[classification]}
      sx={{
        fontWeight: 600,
        color: CLASSIFICATION_COLORS[classification],
        backgroundColor: CLASSIFICATION_BG[classification],
        border: 'none',
      }}
    />
  );
}
