'use client';
import Box from '@mui/material/Box';
import { PageHeader } from '@control-tower/ui-components';
import { OrdersGrid } from '@/components/OrdersGrid';

export default function OrdersPage() {
  return (
    <Box>
      <PageHeader
        title="All Orders"
        subtitle="Every order across all sources — filter, search, export and drill down"
      />
      <OrdersGrid queue="all-orders" />
    </Box>
  );
}
