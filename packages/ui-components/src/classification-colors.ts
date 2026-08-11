import { Classification } from '@control-tower/shared-types';

/** Single source of truth for classification colours across chips + charts. */
export const CLASSIFICATION_COLORS: Record<Classification, string> = {
  [Classification.PENDING]: '#B58A00',
  [Classification.PLACED]: '#0B6BCB',
  [Classification.COMPLETED]: '#1F7A3F',
  [Classification.CANCELLED]: '#6B7280',
  [Classification.CUSTOMER_IMPACTED]: '#C2410C',
  [Classification.INVESTIGATE_REQUIRED]: '#7C3AED',
  [Classification.EXCEPTION]: '#B91C1C',
};

export const CLASSIFICATION_BG: Record<Classification, string> = {
  [Classification.PENDING]: '#FEF6E0',
  [Classification.PLACED]: '#E8F1FB',
  [Classification.COMPLETED]: '#E7F4EC',
  [Classification.CANCELLED]: '#F1F2F4',
  [Classification.CUSTOMER_IMPACTED]: '#FDEEE4',
  [Classification.INVESTIGATE_REQUIRED]: '#F1EAFD',
  [Classification.EXCEPTION]: '#FBE9E9',
};
