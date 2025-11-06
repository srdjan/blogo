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

export const formatError = (error: AppError): string => {
  const time = error.timestamp
    ? new Date(error.timestamp).toISOString()
    : new Date().toISOString();

  let message = `[${time}] ${error.kind}: ${error.message}`;

  if (error.path) {
    message += ` (path: ${error.path})`;
  }

  if (error.cause) {
    message += `\nCause: ${
      error.cause instanceof Error
        ? `${error.cause.name}: ${error.cause.message}`
        : String(error.cause)
    }`;
  }

  return message;
};
