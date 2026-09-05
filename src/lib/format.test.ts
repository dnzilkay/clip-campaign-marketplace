import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("money formatting", () => {
  it("converts stored cents into an explicit USD amount", () => {
    expect(formatMoney(50_000)).toBe("$500.00 USD");
  });
});
