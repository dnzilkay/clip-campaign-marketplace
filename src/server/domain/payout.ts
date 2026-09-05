function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}

export function calculatePayoutCents(
  views: number,
  payoutPer1kViews: number,
) {
  assertNonNegativeInteger(views, "views");
  assertNonNegativeInteger(payoutPer1kViews, "payoutPer1kViews");

  const payout =
    (BigInt(views) / BigInt(1_000)) * BigInt(payoutPer1kViews);

  if (payout > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("calculated payout exceeds the safe integer range");
  }

  return Number(payout);
}
