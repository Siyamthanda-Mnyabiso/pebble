export const REASON_LABEL: Record<string, string> = {
  not_done: 'The job was not done',
  poor_quality: 'The work was poor',
  no_show: 'Nobody came',
  other: 'Something else',
};

export const DECISION_LABEL: Record<string, string> = {
  release_payout: 'The provider is paid',
  refund_customer: 'Refund to the customer',
  split: 'Part refund',
};
