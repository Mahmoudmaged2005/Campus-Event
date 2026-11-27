const LABELS = {
  PENDING: 'Waiting for review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export default function StatusBadge({ status }) {
  return <span className={'badge badge-' + status.toLowerCase()}>{LABELS[status] || status}</span>;
}
