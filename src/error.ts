import type { Result } from "./types.ts";

/**
 * Application-specific error types
 */
export type AppErrorKind =
  | "NotFound"
  | "ParseError"
  | "IOError"
  | "ValidationError"
  | "CacheError"
  | "NetworkError"
  | "RenderError";

export interface AppError {
  kind: AppErrorKind;
  message: string;
  cause?: unknown;
  timestamp?: number; // When the error occurred
  path?: string; // Path or context where error happened
  retryable?: boolean; // Whether this error can be retried
}

/**
 * Create a new application error with enhanced metadata
 */
export const createError = (
  kind: AppErrorKind,
  message: string,
  cause?: unknown,
  options?: {
    path?: string;
    retryable?: boolean;
  },
): AppError => ({
  kind,
  message,
  cause,
  timestamp: Date.now(),
  path: options?.path,
  retryable: options?.retryable,
});

/**
 * Format error details for logging
 */
export const formatError = (error: AppError): string => {
  const time = error.timestamp
    ? new Date(error.timestamp).toISOString()
    : new Date().toISOString();

  let message = `[${time}] ${error.kind}: ${error.message}`;

  if (error.path) {
    message += ` (path: ${error.path})`;
  }

  if (error.cause) {
    message += `\nCause: ${error.cause instanceof Error
      ? `${error.cause.name}: ${error.cause.message}`
      : String(error.cause)
      }`;
  }

  return message;
};

/**
 * Match on a Result type and handle both success and error cases
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    error: (error: E) => U;
  },
): U {
  if (result.ok) {
    return handlers.ok(result.value);
  } else {
    return handlers.error(result.error);
  }
}

/**
 * Chain multiple Result-returning functions
 */
export function chain<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  } else {
    return result;
  }
}

/**
 * Convert a potentially throwing function into a Result
 */
export async function tryCatch<T, E = AppError>(
  fn: () => Promise<T>,
  errorFn: (error: unknown) => E = (e) =>
    createError(
      "IOError",
      String(e),
      e,
    ) as E,
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: errorFn(error) };
  }
}

/**
 * Synchronous version of tryCatch for operations that don't need async
 */
export function tryCatchSync<T, E = AppError>(
  fn: () => T,
  errorFn: (error: unknown) => E = (e) =>
    createError(
      "IOError",
      String(e),
      e,
    ) as E,
): Result<T, E> {
  try {
    const value = fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: errorFn(error) };
  }
}


