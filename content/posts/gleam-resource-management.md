---
title: About Gleam's Elegant Approach to Resource Management
date: 2025-06-06
tags: [Functional, TypeScript, Gleam, Research]
excerpt: Investigating how Gleam's `use` syntax offers an elegant solution to callback hell and what it might teach us about functional programming ergonomics.
---

I've been exploring resource management patterns across different languages, and callback hell keeps surfacing as a persistent challenge. Whether I'm handling errors in TypeScript, managing database connections, or processing lists, the same pattern emerges: deeply nested code that obscures business logic.

What caught my attention is how much time gets spent managing control flow versus solving actual problems. This made me wonder: is functional programming complexity necessary, or do more elegant approaches exist?

## Discovering Gleam's `use` Syntax

What I found particularly interesting about Gleam is its `use` syntax—a surprisingly simple solution to callback hell. The pattern follows a straightforward structure:

```gleam
use <variables> <- <function taking a callback>
```

This single construct eliminates nested complexity while maintaining functional programming principles and type safety.

## Examining the Difference

The transformation becomes clear when I compare traditional nested approaches with Gleam's `use` syntax:

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

With Gleam's `use` expression, same logic becomes:

```gleam
pub fn login(credentials) {
  use user <- result.try(authenticate(credentials))
  use profile <- result.try(fetch_profile(user))
  render_welcome(user, profile)
}
```

This means deeply nested error handling transforms into linear, top-to-bottom code flow while preserving functional programming principles.

## Why the `use` Construct Interests Me

Unlike language-specific constructs like async/await for concurrency or try/catch for errors, `use` works with any function accepting a callback as final argument. What I find compelling is this generality—it makes the approach applicable across multiple domains.

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

Callback hell appears across many domains, and what Gleam demonstrates is one elegant solution that works universally instead of creating specialized syntax for each use case.

## Applying These Concepts to TypeScript

I explored how Gleam's approach might translate to TypeScript, and found several patterns that capture similar elegance.

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

### Effect-TS: Comprehensive Solution

Effect-TS offers what I think is the most sophisticated option, with Gleam-like capabilities plus advanced features:

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

The Effect-TS community has built dependency injection, structured concurrency, and observability while maintaining the linear code flow that makes Gleam's `use` so appealing.

### Lightweight Custom Solutions

For projects requiring minimal dependencies, I found custom Result types provide elegant error handling:

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

This delivers type-safe error propagation with minimal overhead.

### Generator-Based Do-Notation

Generator functions create what I think is most Gleam-like syntax for sequential operations:

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

As I examined other languages, Gleam seems to occupy a unique position. Rust's `?` operator provides similar error propagation but only works with Result/Option types—a thoughtful design choice that fits Rust's philosophy. Haskell's do-notation offers powerful abstractions, though it requires deeper understanding of monadic concepts. F#'s computation expressions provide more flexibility, trading some simplicity for power.

What I find interesting about Gleam is the balance it strikes. The `use` syntax works with any callback-taking function, making it more general than Rust's approach while being more accessible than Haskell's mathematical foundations. All three represent valid and thoughtful responses to the same fundamental problem.

## Questions Worth Exploring

Based on what I've investigated, here are some patterns that might make sense for different contexts:

**For simple resource management**: Could TypeScript 5.2's native `using` syntax provide automatic cleanup with zero learning curve?

**For comprehensive functional programming**: Might Effect-TS offer the most complete solution, providing Gleam-like ergonomics plus advanced features?

**For lightweight error handling**: Would custom Result types with chaining functions provide excellent type safety while requiring minimal dependencies?

**For teams new to functional programming**: Could generator-based do-notation offer familiar syntax while introducing functional concepts gradually?

## What Gleam's Approach Suggests

To me is interesting that Gleam's `use` syntax represents something of a paradigm shift in functional programming ergonomics. By focusing on the "happy path" and providing a general solution to callback hell, it demonstrates how sophisticated resource management can be accessible without sacrificing functional programming benefits.

The insight I found particularly compelling: simplicity and power aren't mutually exclusive. By providing a single, general-purpose syntax that works across multiple domains, Gleam shows how thoughtful language design can make complex programming patterns both elegant and accessible.

This approach emphasizes unified solutions rather than domain-specific fixes. What I'm curious about is whether the best abstractions might solve multiple problems with a single, simple concept—and how other language communities might explore similar patterns.
