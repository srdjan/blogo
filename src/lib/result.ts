export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function assertNever(x: never): never {
  throw new Error(`Unreachable code reached: ${x}`);
}

export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => U;
    readonly error: (error: E) => U;
  },
): U {
  if (result.ok) {
    return handlers.ok(result.value);
  } else {
    return handlers.error(result.error);
  }
}

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

export function map<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  } else {
    return result;
  }
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (result.ok) {
    return result;
  } else {
    return err(fn(result.error));
  }
}

export async function tryCatch<T, E = Error>(
  fn: () => Promise<T>,
  errorFn: (error: unknown) => E = (e) => e as E,
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(errorFn(error));
  }
}

export function tryCatchSync<T, E = Error>(
  fn: () => T,
  errorFn: (error: unknown) => E = (e) => e as E,
): Result<T, E> {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    return err(errorFn(error));
  }
}

export function combine<T, E>(
  results: readonly Result<T, E>[],
): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      return result;
    }
  }
  return ok(values);
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}
