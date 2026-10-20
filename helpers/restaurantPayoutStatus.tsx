const payoutStatusLabels: Record<string, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  on_hold: "On hold",
};

export const getRestaurantPayoutStatusLabel = (status: string): string => {
  const label = payoutStatusLabels[status];
  if (!label) {
    throw new Error(`Unknown restaurant payout status: ${status}`);
  }
  return label;
};