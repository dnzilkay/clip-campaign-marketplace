import { describe, expect, it } from "vitest";

import {
  createSessionCookie,
  createSignedSessionValue,
  readSignedSession,
  verifySignedSessionValue,
} from "./session";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000003";
const SECRET = "a-test-secret-that-is-at-least-32-characters";

describe("signed session", () => {
  it("round-trips a valid signed user ID", () => {
    const value = createSignedSessionValue(USER_ID, SECRET);

    expect(verifySignedSessionValue(value, SECRET)).toBe(USER_ID);
  });

  it("rejects a user ID changed without a matching signature", () => {
    const value = createSignedSessionValue(USER_ID, SECRET);
    const [, signature] = value.split(".");

    expect(
      verifySignedSessionValue(`${OTHER_USER_ID}.${signature}`, SECRET),
    ).toBeNull();
  });

  it("rejects a malformed cookie value", () => {
    expect(verifySignedSessionValue("not-a-session", SECRET)).toBeNull();
  });

  it("reads the signed session from a cookie header", () => {
    const cookie = createSessionCookie(USER_ID, SECRET, false);

    expect(readSignedSession(`theme=light; ${cookie}`, SECRET)).toBe(USER_ID);
  });

  it("creates an HTTP-only same-site cookie", () => {
    const cookie = createSessionCookie(USER_ID, SECRET, true);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });
});
