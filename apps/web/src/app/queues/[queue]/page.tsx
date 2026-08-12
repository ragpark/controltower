'use client';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import { Classification } from '@control-tower/shared-types';
import { PageHeader } from '@control-tower/ui-components';
import { OrdersGrid } from '@/components/OrdersGrid';

const QUEUES: Record<string, { title: string; subtitle: string; classification: Classification }> = {
  pending: {
    title: 'Pending Orders',
    subtitle: 'Orders awaiting confirmation or payment',
    classification: Classification.PENDING,
  },
  'customer-impacted': {
    title: 'Customer Impacted',
    subtitle: 'Orders where the customer experience is at risk — work these first',
    classification: Classification.CUSTOMER_IMPACTED,
  },
  completed: {
    title: 'Completed Orders',
    subtitle: 'Successfully fulfilled orders',
    classification: Classification.COMPLETED,
  },
  cancelled: {
    title: 'Cancelled Orders',
    subtitle: 'Orders cancelled by the customer or operations',
    classification: Classification.CANCELLED,
  },
  exceptions: {
    title: 'Exceptions',
    subtitle: 'Orders with data-quality or processing problems',
    classification: Classification.EXCEPTION,
  },
};

export default function QueuePage() {
  const params = useParams<{ queue: string }>();
  // Seeded when arriving from a range-scoped dashboard pill, so the queue shows
  // the same orders the figure that was clicked counted.
  const searchParams = useSearchParams();
  const queue = QUEUES[params.queue];
  if (!queue) notFound();

  return (
    <Box>
      <PageHeader title={queue.title} subtitle={queue.subtitle} />
      <OrdersGrid
        queue={params.queue}
        classification={queue.classification}
        initialDateFrom={searchParams.get('dateFrom') ?? undefined}
        initialDateTo={searchParams.get('dateTo') ?? undefined}
      />
    </Box>
  );
}
