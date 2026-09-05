import { afterAll, describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { db, postgresClient } from "@/server/db";

import {
  createTRPCContext,
  type SessionUser,
  type TRPCContext,
} from "./context";
import { appRouter } from "./root";
import { adminProcedure, createTRPCRouter } from "./trpc";

const CREATOR_ONE: SessionUser = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "creator.one@example.com",
  role: "creator",
};

const CREATOR_TWO: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  email: "creator.two@example.com",
  role: "creator",
};

const ADMIN: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  role: "admin",
};

const CREATOR_ONE_SUBMISSION = "20000000-0000-4000-8000-000000000001";

function contextFor(user: SessionUser | null): TRPCContext {
  return {
    db,
    user,
    responseHeaders: new Headers(),
  };
}

const roleTestRouter = createTRPCRouter({
  adminOnly: adminProcedure.query(({ ctx }) => ctx.user),
});

afterAll(async () => {
  await postgresClient.end();
});

describe("submission access control", () => {
  it("rejects anonymous access", async () => {
    const caller = appRouter.createCaller(contextFor(null));

    await expect(
      caller.submission.getMineById({
        submissionId: CREATOR_ONE_SUBMISSION,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an admin from creator-only procedures", async () => {
    const caller = appRouter.createCaller(contextFor(ADMIN));

    await expect(
      caller.submission.getMineById({
        submissionId: CREATOR_ONE_SUBMISSION,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a creator's own submission", async () => {
    const caller = appRouter.createCaller(contextFor(CREATOR_ONE));
    const submission = await caller.submission.getMineById({
      submissionId: CREATOR_ONE_SUBMISSION,
    });

    expect(submission.creatorId).toBe(CREATOR_ONE.id);
  });

  it("does not reveal another creator's submission", async () => {
    const caller = appRouter.createCaller(contextFor(CREATOR_TWO));

    await expect(
      caller.submission.getMineById({
        submissionId: CREATOR_ONE_SUBMISSION,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin access control", () => {
  it("allows an admin procedure for admins", async () => {
    const caller = roleTestRouter.createCaller(contextFor(ADMIN));

    await expect(caller.adminOnly()).resolves.toEqual(ADMIN);
  });

  it("rejects creators from admin procedures", async () => {
    const caller = roleTestRouter.createCaller(contextFor(CREATOR_ONE));

    await expect(caller.adminOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("development session", () => {
  it("sets a signed cookie and resolves the selected user", async () => {
    const responseHeaders = new Headers();
    const caller = appRouter.createCaller({
      ...contextFor(null),
      responseHeaders,
    });

    const selectedUser = await caller.auth.switchUser({
      userId: CREATOR_ONE.id,
    });
    const setCookie = responseHeaders.get("set-cookie");

    expect(selectedUser).toEqual(CREATOR_ONE);
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");

    const requestHeaders = new Headers({
      cookie: setCookie?.split(";")[0] ?? "",
    });
    const sessionContext = await createTRPCContext({
      requestHeaders,
      database: db,
    });

    expect(sessionContext.user).toEqual(CREATOR_ONE);
  });

  it("ignores a hand-crafted unsigned user cookie", async () => {
    const requestHeaders = new Headers({
      cookie: `${SESSION_COOKIE_NAME}=${CREATOR_ONE.id}.not-a-valid-signature`,
    });
    const sessionContext = await createTRPCContext({
      requestHeaders,
      database: db,
    });

    expect(sessionContext.user).toBeNull();
  });
});
