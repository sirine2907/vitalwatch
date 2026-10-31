export type AppErrorCode =
  | "invalid_url"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "site_unreachable"
  | "psi_quota"
  | "psi_busy"
  | "psi_unavailable"
  | "psi_bad_response"
  | "not_configured"
  | "internal";

/** An error whose message is safe to show to users. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { status: number; retryable?: boolean; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
