/** Every booking status. "pending" means pending provider acceptance. */
export type BookingStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'in_progress'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired'
  | 'disputed';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  awaiting_confirmation: 'Awaiting confirmation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
  expired: 'Expired',
  disputed: 'Disputed',
};

/** Colour group for admin tables. */
export const STATUS_TONE = {
  pending: 'grey',
  awaiting_payment: 'blue',
  confirmed: 'blue',
  in_progress: 'blue',
  awaiting_confirmation: 'blue',
  completed: 'green',
  cancelled: 'red',
  declined: 'red',
  expired: 'grey',
  disputed: 'red',
} as const;
