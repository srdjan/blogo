---
title: Gleam's Elegant Solution to Callback Hell
date: 2025-06-06
tags: [Functional, TypeScript, Gleam]
excerpt: Callback hell plagues functional programming—deeply nested code that obscures logic. Gleam's `use` syntax solves this elegantly with one simple construct. Here's what makes it interesting and how to apply similar patterns in TypeScript.
---

Callback hell. Whether handling errors in TypeScript, managing database connections, or processing lists, the same problem emerges: deeply nested code that hides business logic under layers of control flow boilerplate.

This isn't just annoying. It's a structural issue with how we express sequential operations that can fail or need cleanup. Spend more time managing control flow than solving actual problems. Nested callbacks make code hard to read, harder to maintain, nearly impossible to refactor.

[Gleam](https://gleam.run/) solves this beautifully with one construct: `use` syntax. Simple, general, elegant. Let me show you what makes it interesting.

## The `use` Syntax

Here's the pattern:

```gleam
use <variables> <- <function taking a callback>
```

That's it. One construct eliminates nested complexity while maintaining functional programming principles and type safety.

## Before and After

Traditional nested error handling:

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

With `use`:

```gleam
pub fn login(credentials) {
  use user <- result.try(authenticate(credentials))
  use profile <- result.try(fetch_profile(user))
  render_welcome(user, profile)
}
```

Look at this. Deeply nested error handling becomes linear, top-to-bottom code flow. Business logic crystal clear. Error handling stays functional and type-safe, but stops obscuring intent.

## Why This Works

Unlike language-specific constructs (async/await for concurrency, try/catch for errors), `use` works with *any* function accepting a callback as final argument. This generality makes it applicable across domains.

### Resource Management

```gleam
pub fn process_file() {
  use file <- with_file("data.txt")
  use connection <- with_database()
  process_data_with_resources(file, connection)
}
```

Resources get cleaned up automatically when scope exits. No explicit cleanup code, no try/finally blocks, just declare what you need and use it.

### List Processing

```gleam
pub fn cartesian_product() {
  use letter <- list.flat_map(["a", "b", "c"])
  use number <- list.map([1, 2, 3])
  #(letter, number)
}
```

Callback hell appears in many contexts. Gleam demonstrates one elegant solution that works universally instead of creating specialized syntax for each use case.

## Applying to TypeScript

Can we get similar benefits in TypeScript? Several approaches capture the essence:

### Native Resource Management

TypeScript 5.2's explicit resource management provides closest equivalent:

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

Zero overhead, perfect TypeScript integration, automatic cleanup. For simple resource management, this is it.

### Effect-TS: Comprehensive Solution

[Effect-TS](https://effect.website/) offers the most sophisticated option—Gleam-like capabilities plus dependency injection, structured concurrency, observability:

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

Linear code flow, comprehensive error handling, advanced features. The Effect-TS community built a complete ecosystem around this pattern.

### Lightweight Custom Solutions

For minimal dependencies, custom Result types provide elegant error handling:

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

Type-safe error propagation, minimal overhead. Gets the job done without framework dependency.

### Generator-Based Do-Notation

Generator functions create most Gleam-like syntax:

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

Eliminates callback nesting, maintains sequential flow. Familiar syntax for JavaScript developers.

## Comparison with Other Languages

Rust's `?` operator provides similar error propagation but only works with Result/Option types—thoughtful design choice fitting Rust's philosophy. Haskell's do-notation offers powerful abstractions requiring deeper understanding of monadic concepts. F#'s computation expressions provide more flexibility, trading simplicity for power.

Gleam strikes an interesting balance. The `use` syntax works with any callback-taking function, making it more general than Rust while more accessible than Haskell. All three represent valid approaches to the same fundamental problem.

## Which Approach for TypeScript?

Depends on your context:

**Simple resource management**: TypeScript 5.2's native `using` syntax. Zero learning curve, automatic cleanup, no dependencies.

**Comprehensive functional programming**: Effect-TS. Complete solution with Gleam-like ergonomics plus advanced features.

**Lightweight error handling**: Custom Result types with chaining. Type safety, minimal dependencies.

**Teams new to FP**: Generator-based do-notation. Familiar syntax introducing functional concepts gradually.

## The Interesting Part

To me is interesting that Gleam's `use` syntax represents a paradigm shift in functional programming ergonomics. By focusing on the "happy path" and providing general solution to callback hell, it shows how sophisticated resource management can be accessible without sacrificing functional benefits.

The insight: simplicity and power aren't mutually exclusive. One general-purpose syntax working across multiple domains demonstrates how thoughtful language design makes complex patterns both elegant and accessible.

This emphasizes unified solutions over domain-specific fixes. Best abstractions solve multiple problems with single, simple concept.

## Real Talk: Tradeoffs

None of these approaches are free. Effect-TS has learning curve and adds bundle size. Custom Result types require discipline across team. Generator-based patterns feel unfamiliar. Native `using` only handles resources, not general control flow.

But. The payoff in code clarity is significant. Once you see nested callbacks transformed into linear flow, going back feels wrong. Error handling becomes declarative. Resource cleanup automatic. Business logic clear.

I played with Gleam for weekend project. The mental model shift took an afternoon. After that? Code patterns I struggled with in TypeScript became obvious. Not saying everyone should learn Gleam, but the ideas transfer beautifully.

## Bottom Line

Callback hell is structural problem with how we express sequential operations. Gleam's `use` syntax solves this elegantly—one construct handling errors, resources, list operations, everything.

TypeScript can capture similar benefits through different approaches: native `using`, Effect-TS, custom types, generators. Each has tradeoffs. Pick based on your needs.

The broader lesson? Language design choices matter. Gleam demonstrates how single, well-designed construct can eliminate entire categories of complexity. As functional programming moves mainstream, ergonomics like this become essential—power without pain.

Worth exploring if your codebase suffers from nested callback complexity. The patterns work, regardless of whether you use Gleam itself.
