import { TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";

import { DomainError, type DomainErrorCode } from "@/server/domain/errors";

const trpcCodeByDomainCode: Record<DomainErrorCode, TRPC_ERROR_CODE_KEY> = {
  CAMPAIGN_BUDGET_EXCEEDED: "PRECONDITION_FAILED",
  CAMPAIGN_NOT_ACTIVE: "CONFLICT",
  SUBMISSION_NOT_FOUND: "NOT_FOUND",
  SUBMISSION_NOT_PENDING: "CONFLICT",
};

export function toTRPCError(error: unknown) {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  return new TRPCError({
    code: trpcCodeByDomainCode[error.code],
    message: error.message,
    cause: error,
  });
}
