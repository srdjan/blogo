// src/error.ts - Advanced error handling with pattern matching
import type { Result } from "./types.ts";

/**
 * Application-specific error types
 */
export type AppErrorKind =
  | "NotFound"
  | "ParseError"
  | "IOError"
  | "ValidationError";

export interface AppError {
  kind: AppErrorKind;
  message: string;
  cause?: unknown;
}

/**
 * Create a new application error
 */
export const createError = (
  kind: AppErrorKind,
  message: string,
  cause?: unknown
): AppError => ({
  kind,
  message,
  cause,
});

/**
 * Match on a Result type and handle both success and error cases
 * This is a simplified version of the match pattern from ts-pattern
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    error: (error: E) => U;
  }
): U {
  if (result.ok) {
    return handlers.ok(result.value);
  } else {
    return handlers.error(result.error);
  }
}

/**
 * Map a Result's success value
 */
export function map<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return { ok: true, value: fn(result.value) };
  } else {
    return result;
  }
}

/**
 * Chain multiple Result-returning functions
 */
export function chain<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
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
  errorFn: (error: unknown) => E = (e) => createError("IOError", String(e), e) as E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: errorFn(error) };
  }
}

/**
 * Convert a Result to a Response
 */
export function resultToResponse<T, E>(
  result: Result<T, E>,
  {
    onSuccess,
    onError,
  }: {
    onSuccess: (value: T) => Response;
    onError: (error: E) => Response;
  }
): Response {
  return match(result, {
    ok: onSuccess,
    error: onError,
  });
}