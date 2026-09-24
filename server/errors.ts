import type { AppErrorBody, AppErrorCode } from "../shared/types";

const STATUS: Record<AppErrorCode, number> = {
  NOT_CONFIGURED: 400,
  AUTH_FAILED: 502,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  NETWORK: 503,
  API_ERROR: 502,
  OVERLOADED: 503,
  INVALID_RESPONSE: 502,
  SCHEMA_TOO_LARGE: 502,
  MALFORMED_JSON: 502,
  REFUSED: 422,
  TRUNCATED: 502,
  CANCELLED: 499,
  EMPTY_RESUME: 422,
  UNSUPPORTED_FILE: 415,
  EXTRACTION_FAILED: 422,
  FILE_TOO_LARGE: 413,
  DATABASE: 500,
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  INTERNAL: 500,
};

/** An error whose message is written for HR users, not developers. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }

  toBody(): AppErrorBody {
    return { code: this.code, message: this.message, ...(this.detail ? { detail: this.detail } : {}) };
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} could not be found. It may have been deleted.`);
export const invalid = (message: string) => new AppError("VALIDATION", message);
