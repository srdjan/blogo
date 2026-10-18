import type { AppError, AppErrorKind } from "./types.ts";

export const createError = (
  kind: AppErrorKind,
  message: string,
  cause?: unknown,
  options?: {
    readonly path?: string;
    readonly retryable?: boolean;
  },
): AppError => ({
  kind,
  message,
  timestamp: Date.now(),
  ...(cause !== undefined && { cause }),
  ...(options?.path !== undefined && { path: options.path }),
  ...(options?.retryable !== undefined && { retryable: options.retryable }),
});
