export type DomainErrorCode =
  | "CAMPAIGN_BUDGET_EXCEEDED"
  | "CAMPAIGN_NOT_ACTIVE"
  | "SUBMISSION_NOT_FOUND"
  | "SUBMISSION_NOT_PENDING";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
