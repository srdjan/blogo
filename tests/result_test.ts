import { assertEquals, assertThrows } from "@std/assert";
import {
  chain,
  combine,
  err,
  getOrElse,
  isErr,
  isOk,
  map,
  match,
  ok,
  tap,
  tapError,
} from "../src/lib/result.ts";

Deno.test("Result - ok creates success result", () => {
  const result = ok(42);
  assertEquals(result.ok, true);
  assertEquals(result.value, 42);
});

Deno.test("Result - err creates error result", () => {
  const result = err("error message");
  assertEquals(result.ok, false);
  assertEquals(result.error, "error message");
});

Deno.test("Result - map transforms success value", () => {
  const result = ok(10);
  const mapped = map(result, (x) => x * 2);
  assertEquals(mapped.ok, true);
  if (mapped.ok) {
    assertEquals(mapped.value, 20);
  }
});

Deno.test("Result - map preserves error", () => {
  const result = err("error");
  const mapped = map(result, (x: number) => x * 2);
  assertEquals(mapped.ok, false);
  if (!mapped.ok) {
    assertEquals(mapped.error, "error");
  }
});

Deno.test("Result - chain composes success results", () => {
  const result = ok(10);
  const chained = chain(result, (x) => ok(x.toString()));
  assertEquals(chained.ok, true);
  if (chained.ok) {
    assertEquals(chained.value, "10");
  }
});

Deno.test("Result - chain preserves error", () => {
  const result = err("error");
  const chained = chain(result, (x: number) => ok(x.toString()));
  assertEquals(chained.ok, false);
  if (!chained.ok) {
    assertEquals(chained.error, "error");
  }
});

Deno.test("Result - combine success results", () => {
  const results = [ok(1), ok(2), ok(3)];
  const combined = combine(results);
  assertEquals(combined.ok, true);
  if (combined.ok) {
    assertEquals(combined.value, [1, 2, 3]);
  }
});

Deno.test("Result - combine with error stops at first error", () => {
  const results = [ok(1), err("error"), ok(3)];
  const combined = combine(results);
  assertEquals(combined.ok, false);
  if (!combined.ok) {
    assertEquals(combined.error, "error");
  }
});

Deno.test("Result - match handles both cases", () => {
  const success = ok(42);
  const failure = err("error");

  const successResult = match(success, {
    ok: (value) => `Success: ${value}`,
    error: (error) => `Error: ${error}`,
  });

  const failureResult = match(failure, {
    ok: (value) => `Success: ${value}`,
    error: (error) => `Error: ${error}`,
  });

  assertEquals(successResult, "Success: 42");
  assertEquals(failureResult, "Error: error");
});

Deno.test("Result - type guards work correctly", () => {
  const success = ok(42);
  const failure = err("error");

  assertEquals(isOk(success), true);
  assertEquals(isErr(success), false);
  assertEquals(isOk(failure), false);
  assertEquals(isErr(failure), true);
});

Deno.test("Result - getOrElse returns value on success", () => {
  const result = ok(42);
  assertEquals(getOrElse(result, 0), 42);
});

Deno.test("Result - getOrElse returns default on error", () => {
  const result = err("error");
  assertEquals(getOrElse(result, 0), 0);
});

Deno.test("Result - tap executes side effect on success", () => {
  let sideEffect = 0;
  const result = ok(42);
  const tapped = tap(result, (x) => {
    sideEffect = x;
  });

  assertEquals(sideEffect, 42);
  assertEquals(tapped.ok, true);
  if (tapped.ok) {
    assertEquals(tapped.value, 42);
  }
});

Deno.test("Result - tap does not execute on error", () => {
  let sideEffect = 0;
  const result = err("error");
  const tapped = tap(result, (_x: number) => {
    sideEffect = 1;
  });

  assertEquals(sideEffect, 0);
  assertEquals(tapped.ok, false);
});

Deno.test("Result - tapError executes side effect on error", () => {
  let sideEffect = "";
  const result = err("error message");
  const tapped = tapError(result, (e) => {
    sideEffect = e;
  });

  assertEquals(sideEffect, "error message");
  assertEquals(tapped.ok, false);
  if (!tapped.ok) {
    assertEquals(tapped.error, "error message");
  }
});

Deno.test("Result - tapError does not execute on success", () => {
  let sideEffect = "";
  const result = ok(42);
  const tapped = tapError(result, (e: string) => {
    sideEffect = e;
  });

  assertEquals(sideEffect, "");
  assertEquals(tapped.ok, true);
});
