---
title: Gleam's Elegant Resource Management with `use` Syntax
date: 2025-06-06
tags: [Functional, TypeScript, Gleam]
excerpt: Gleam's `use` syntax provides an elegant solution to callback hell that improves functional programming ergonomics across multiple domains.
---

Callback hell and resource management create persistent challenges across programming languages. Whether handling errors in TypeScript, managing database connections, or processing lists, the same pattern emerges: deeply nested code that obscures business logic and makes debugging difficult.

Traditional approaches often require more time managing control flow than solving actual problems, raising questions about whether functional programming complexity is necessary or if more elegant approaches exist.

## Gleam's `use` Syntax Solution

Gleam's `use` syntax provides a surprisingly simple solution to callback hell. The pattern follows a straightforward structure:

```gleam
use <variables> <- <function taking a callback>
```

This single construct eliminates nested complexity while maintaining functional programming principles and type safety.

## Comparing Traditional vs `use` Syntax

The difference becomes clear when comparing traditional nested approaches with Gleam's `use` syntax:

```gleam
pub fn login(credentials) {
  case authenticate(credentials) {
    Error(e) -> Error(e)
    Ok(user) -> case fetch_profile(user) {
      Error(e) -> Error(e)
      Ok(profile) -> render_welcome(user, profile)
    }
  }
}
```

With Gleam's `use` expression, the same logic becomes:

```gleam
pub fn login(credentials) {
  use user <- result.try(authenticate(credentials))
  use profile <- result.try(fetch_profile(user))
  render_welcome(user, profile)
}
```

This transformation converts deeply nested error handling into linear, top-to-bottom code flow while preserving functional programming principles.

## Generality of the `use` Construct

Unlike language-specific constructs like async/await for concurrency or try/catch for errors, `use` works with any function accepting a callback as the final argument. This generality makes it applicable across multiple domains.

### Resource Management That Just Works

```gleam
pub fn process_file() {
  use file <- with_file("data.txt")
  use connection <- with_database()
  process_data_with_resources(file, connection)
}
```

### List Processing Without Nesting

```gleam
pub fn cartesian_product() {
  use letter <- list.flat_map(["a", "b", "c"])
  use number <- list.map([1, 2, 3])
  #(letter, number)
}
```

Callback hell appears across many domains, and Gleam provides one elegant solution that works universally instead of creating specialized syntax for each use case.

## Applying These Concepts to TypeScript

Gleam's approach translates to TypeScript through several sophisticated patterns that capture similar elegance.

### Native Resource Management

TypeScript 5.2's explicit resource management provides the closest direct equivalent:

```typescript
class DatabaseConnection implements Disposable {
  [Symbol.dispose]() {
    this.close();
  }
}

async function processData() {
  using connection = new DatabaseConnection();
  using file = new FileHandle("data.txt");

  // Resources automatically disposed when scope exits
  return await processDataWithResources(connection, file);
}
```

This approach provides zero overhead and perfect TypeScript integration while maintaining automatic cleanup benefits.

### Effect-TS: The Comprehensive Solution

Effect-TS provides the most sophisticated option, offering Gleam-like capabilities with advanced features:

```typescript
import { Effect } from "effect";

const processUser = (id: string) =>
  Effect.gen(function* (_) {
    const user = yield* _(Effect.tryPromise(() => fetchUser(id)));
    yield* _(Effect.log(`Processing user: ${user.name}`));
    const validUser = yield* _(Effect.tryPromise(() => validateUser(user)));
    const result = yield* _(Effect.tryPromise(() => saveUser(validUser)));
    return result;
  });
```

Effect-TS provides dependency injection, structured concurrency, and observability while maintaining the linear code flow that makes Gleam's `use` so appealing.

### Lightweight Custom Solutions

For projects requiring minimal dependencies, custom Result types provide elegant error handling:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const chain = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => result.ok ? fn(result.value) : result;

const processFile = (filename: string): Result<string, string> =>
  chain(
    readFile(filename),
    (content) =>
      chain(processContent(content), (processed) =>
        chain(validateOutput(processed), (validated) =>
          ok(validated))),
  );
```

This approach delivers type-safe error propagation with minimal overhead.

### Generator-Based Do-Notation

Generator functions created the most Gleam-like syntax for sequential operations:

```typescript
function* doM<T>(gen: Generator<any, T, any>): Generator<any, T, any> {
  return yield* gen;
}

const processData = () =>
  run(doM(function* () {
    const user = yield* fetchUser();
    const profile = yield* fetchProfile(user.id);
    const settings = yield* fetchSettings(profile.id);

    return processUserData(user, profile, settings);
  }));
```

This pattern eliminates callback nesting while maintaining sequential, linear flow.

## Comparison with Other Language Solutions

Gleam occupies a unique position among functional programming languages. Rust's `?` operator provides similar error propagation but only works with Result/Option types. Haskell's do-notation requires deep understanding of monadic abstractions. F#'s computation expressions offer more flexibility but at the cost of complexity.

Gleam strikes an optimal balance between power and simplicity. The `use` syntax works with any callback-taking function, making it more general than Rust's approach while being more accessible than Haskell's mathematical foundations.

## TypeScript Implementation Recommendations

**For simple resource management**: Use TypeScript 5.2's native `using` syntax, which provides automatic cleanup with zero learning curve and perfect tooling integration.

**For comprehensive functional programming**: Effect-TS offers the most complete solution, providing Gleam-like ergonomics plus advanced features.

**For lightweight error handling**: Custom Result types with chaining functions provide excellent type safety and performance while requiring minimal dependencies.

**For teams new to functional programming**: Generator-based do-notation offers familiar syntax while introducing functional concepts gradually.

## Key Insights from Gleam's Approach

Gleam's `use` syntax represents a paradigm shift in functional programming ergonomics. By focusing on the "happy path" and providing a general solution to callback hell, it makes sophisticated resource management accessible without sacrificing functional programming benefits.

The key insight is that simplicity and power aren't mutually exclusive. By providing a single, general-purpose syntax that works across multiple domains, Gleam demonstrates how thoughtful language design can make complex programming patterns both elegant and accessible.

This approach emphasizes unified solutions rather than domain-specific fixes. The best abstractions solve multiple problems with a single, simple concept.