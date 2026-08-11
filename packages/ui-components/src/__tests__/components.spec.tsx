import { fireEvent, render, screen } from '@testing-library/react';
import { Classification } from '@control-tower/shared-types';
import { StatusChip } from '../StatusChip';
import { StatCard } from '../StatCard';
import { PageHeader } from '../PageHeader';
import { EmptyState } from '../EmptyState';
import { ConfirmDialog } from '../ConfirmDialog';

describe('StatusChip', () => {
  it('renders the human label for a classification', () => {
    render(<StatusChip classification={Classification.CUSTOMER_IMPACTED} />);
    expect(screen.getByText('Customer Impacted')).toBeInTheDocument();
  });

  it('renders "Unclassified" for null', () => {
    render(<StatusChip classification={null} />);
    expect(screen.getByText('Unclassified')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows label, value and caption', () => {
    render(<StatCard label="Total orders" value={1234} caption="last 30 days" />);
    expect(screen.getByText('Total orders')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('last 30 days')).toBeInTheDocument();
  });

  it('is clickable for drill-down when onClick is given', () => {
    const onClick = jest.fn();
    render(<StatCard label="Exceptions" value={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /open exceptions/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('PageHeader', () => {
  it('renders title, subtitle and actions', () => {
    render(
      <PageHeader title="Pending Orders" subtitle="Queue" actions={<button>Export</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'Pending Orders' })).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No orders" description="Import a CSV to get started" />);
    expect(screen.getByText('No orders')).toBeInTheDocument();
    expect(screen.getByText('Import a CSV to get started')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('fires onConfirm and onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete rule"
        message="Are you sure?"
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="hidden"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
