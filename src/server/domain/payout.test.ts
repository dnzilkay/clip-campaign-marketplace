import { describe, expect, it } from "vitest";

import { calculatePayoutCents } from "./payout";

describe("calculatePayoutCents", () => {
  it.each([
    { views: 0, expected: 0 },
    { views: 999, expected: 0 },
    { views: 1_000, expected: 350 },
    { views: 1_999, expected: 350 },
    { views: 2_000, expected: 700 },
    { views: 2_999, expected: 700 },
  ])("returns $expected cents for $views views", ({ views, expected }) => {
    expect(calculatePayoutCents(views, 350)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid views value: %s",
    (views) => {
      expect(() => calculatePayoutCents(views, 350)).toThrow(RangeError);
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid payout rate: %s",
    (rate) => {
      expect(() => calculatePayoutCents(1_000, rate)).toThrow(RangeError);
    },
  );
});
