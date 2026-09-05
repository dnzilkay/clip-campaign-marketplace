import { eq } from "drizzle-orm";

import { env } from "@/env";
import { readSignedSession } from "@/server/auth/session";
import { db, type Database } from "@/server/db";
import { users } from "@/server/db/schema";

export type SessionUser = Pick<
  typeof users.$inferSelect,
  "id" | "email" | "role"
>;

type CreateContextOptions = {
  requestHeaders: Headers;
  responseHeaders?: Headers;
  database?: Database;
};

export async function createTRPCContext({
  requestHeaders,
  responseHeaders = new Headers(),
  database = db,
}: CreateContextOptions) {
  const userId = readSignedSession(
    requestHeaders.get("cookie"),
    env.AUTH_COOKIE_SECRET,
  );

  const user = userId
    ? await database.query.users.findFirst({
        columns: { id: true, email: true, role: true },
        where: eq(users.id, userId),
      })
    : null;

  return {
    db: database,
    user: user ?? null,
    responseHeaders,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
