import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/api/context";
import { appRouter } from "@/server/api/root";

export const runtime = "nodejs";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: ({ req, resHeaders }) =>
      createTRPCContext({
        requestHeaders: req.headers,
        responseHeaders: resHeaders,
      }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ error, path }) => {
            console.error(`tRPC failed on ${path ?? "unknown"}`, error);
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
