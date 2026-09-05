import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

export const SESSION_COOKIE_NAME = "clip_session";

const userIdSchema = z.uuid();

function signatureFor(userId: string, secret: string) {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

export function createSignedSessionValue(userId: string, secret: string) {
  const validUserId = userIdSchema.parse(userId);
  return `${validUserId}.${signatureFor(validUserId, secret)}`;
}

export function verifySignedSessionValue(value: string, secret: string) {
  const separatorIndex = value.indexOf(".");

  if (separatorIndex < 1) {
    return null;
  }

  const userId = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);

  if (!userIdSchema.safeParse(userId).success || !signature) {
    return null;
  }

  const expected = Buffer.from(signatureFor(userId, secret));
  const received = Buffer.from(signature);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  return userId;
}

export function readSignedSession(
  cookieHeader: string | null,
  secret: string,
) {
  if (!cookieHeader) {
    return null;
  }

  for (const rawCookie of cookieHeader.split(";")) {
    const separatorIndex = rawCookie.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const name = rawCookie.slice(0, separatorIndex).trim();

    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }

    try {
      const value = decodeURIComponent(rawCookie.slice(separatorIndex + 1));
      return verifySignedSessionValue(value, secret);
    } catch {
      return null;
    }
  }

  return null;
}

export function createSessionCookie(
  userId: string,
  secret: string,
  secure: boolean,
) {
  const value = createSignedSessionValue(userId, secret);
  const secureAttribute = secure ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureAttribute}`;
}

export function clearSessionCookie(secure: boolean) {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttribute}`;
}
