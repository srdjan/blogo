---
title: "TypeLang: A subset of TypeScript with algebraic effects"
date: 2025-10-19
tags: [TypeScript, Functional, Algebraic Effects, Language Design]
excerpt: TypeLang is deigned to enforce functional programming principles, as a strict TypeScript subset, and with explicit effect tracking to simplify how teams reason about code.
---

### Continuing exploration into the world of possibilities when building a language that is a TypeScript subset, supports Light FP programming style and has built-in Algebraic Effects.

Software systems grow complex not just from the problems they solve, but from the flexibility
languages afford us. When teams can express the same ideas in countless ways, mixing paradigms, hiding
effects, and mutating state freely,codebases become difficult to understand and maintain.

So, what happens when we constrain how code can be written, making effects explicit and enforcing
functional purity? **TypeLang** seeks to explore ways of cutting down this complexity by **constraining how code can be
written**.

Enforced by tooling, **TypeLang** is a strict subset of TypeScript that combines three core ideas: a Ligh FP, an algebraic effects system that makes side effects visible in type signatures, and zero new syntax. Teams write 100% valid TypeScript that runs on Deno. These constraints emerged from a fundamental belief: **the code we cannot write is as
important as the code we can**.

**See it Live! ↓**

[![See it Live!](/images/typelang.jpg){width=600}](https://typelang.timok.deno.net/)

GitHub repo: [https://github.com/srdjan/TypeLang](https://github.com/srdjan/TypeLang)

🔹 I like learning by thinkering around, and that is the purpose of this project... For production,
though, use [Effect-TS](https://github.com/Effect-TS/effect) or
[Effection](https://github.com/thefrontside/effection)

## Foundation: Constraints as Design Philosophy

The central principle driving **TypeLang** is that **constraints enable clarity**. When we remove
language features that obscure intent—classes with hidden state, control flow that jumps
unpredictably, mutations that ripple through systems—what remains is code where data flows and
effects are explicit.

This philosophy manifests in three areas:

**Subset enforcement** - We prohibit classes, mutations, loops, and conditional statements
(`if`/`else`). Application code uses only `const` declarations, pure functions, and
expression-oriented control flow through pattern matching.

**Effect visibility** - Side effects—I/O, state changes, exceptions—are tracked in type signatures.
A function that reads a file has a different type than one that performs pure computation. We see at
the type level what capabilities a function requires.

**TypeScript compatibility** - Rather than inventing new syntax, we work within TypeScript's type
system. The effect tracking uses phantom types, and the runtime interprets effect instructions
through handlers. Any TypeScript tooling works unchanged.

These constraints emerged from observing how teams struggle with codebases where anything is
possible. When there are no guardrails, consistency depends entirely on discipline and review
processes. By encoding constraints in tooling, we shift enforcement from humans to machines. ( ❤️
ReScript)

## The Functional Subset: What We Removed and Why

The subset rules in **TypeLang** forbid several mainstream TypeScript features. Each prohibition
addresses a specific source of complexity:

### No Classes or Object-Oriented Constructs

Classes in TypeScript encourage encapsulating mutable state and hiding effects behind method calls.
A method might trigger network requests, mutate internal state, or throw exceptions—none of which
appears in its type signature. We removed classes, `this`, and `new` (except for `new Proxy`, which
the runtime needs internally) to eliminate hidden state and behavior.

Instead, application code models domains with **algebraic data types**—discriminated unions and type
aliases. Data structures are readonly records. Functions that operate on these types are pure
transformations. State, when needed, is handled explicitly through the effect system.

### No Control Flow That Obscures Intent

Traditional `if`/`else` statements and ternary operators encourage imperative thinking—"do this,
then do that." This style hides the structure of decisions within statement sequences. We replaced
conditional statements with **pattern matching** via the `match()` function, making decisions
explicit and exhaustive:

```typescript
match(result, {
  Ok: (value) => value.data,
  Err: (error) => defaultValue,
});
```

Pattern matching forces teams to handle all cases. The type system ensures exhaustiveness. Control
flow becomes data transformation.

### No Mutation or Mutable Bindings

Mutation is the primary source of complexity in concurrent systems. When state can change anywhere,
reasoning about program behavior requires tracking all possible execution paths. We prohibit `let`,
`var`, `++`, `--`, and assignment expressions. Application code uses only `const` declarations.

This doesn't mean programs can't have state—it means state changes are **explicit effects** handled
by the runtime. Functions don't mutate variables; they return new values or declare state effects
that are executed by runtime handlers.

### Enforcement Through Tooling

These rules aren't suggestions—they're enforced. The project includes a custom lexical linter
(`scripts/lint_subset.ts`) that scans source files and rejects forbidden syntax. Running
`deno task lint` checks both standard Deno rules and the functional subset. Continuous integration
fails on violations.

This approach makes the subset **tool-enforced, not documentation-enforced**. Teams don't debate
whether to use classes or mutation—the tooling prevents it. Code review focuses on logic and design,
not style compliance.

## Algebraic Effects: Making Side Effects Visible

The second pillar of **TypeLang** is its effect system. In traditional TypeScript, a function like
`getUserById(id: string): User` tells you nothing about what happens when you call it. Does it read
from a database? Make an HTTP request? Throw exceptions? The type signature is silent about effects.

**TypeLang** makes effects explicit through the `Eff<A, Caps>` type. A function that returns
`Eff<User, { http: Http }>` declares that it produces a `User` value and requires HTTP capabilities.
Effects are tracked at the type level, visible in every signature.

### Effect Declaration and Usage

Teams define effects using `defineEffect()`, which creates typed operation specifications:

```typescript
const Http = defineEffect<"Http", {
  get: (url: string) => Response;
  post: (url: string, body: unknown) => Response;
}>("Http");

// Usage returns Eff<Response, { http: Http }>
const fetchUser = (id: string) => Http.op.get(`/users/${id}`);
```

The type system tracks that `fetchUser` requires HTTP capabilities. Functions that call `fetchUser`
inherit this requirement. Effect dependencies flow through the call graph, visible at every level.

### Ergonomic Improvements: Record-Based Capabilities

The record-based capability syntax `{ http: Http; db: Db }` offers significant ergonomic and type-safety advantages over alternative approaches. This design makes multi-capability functions crystal clear:

**Single capability** - wraps cleanly:
```typescript
const getTime: Eff<Date, { clock: Clock }> = ({ clock }) => clock.now();
```

**Multiple capabilities** - explicit and composable:
```typescript
const registerUser: Eff<Result<User, string>, {
  http: Http;
  db: Db;
  logger: Logger
}> = async ({ http, db, logger }) => {
  logger.log("Starting registration");
  const userData = await http.get("/api/user");
  await db.set(["user", userData.id], userData);
  return ok(userData);
};
```

The record syntax provides several benefits:

**Order-independent destructuring** - Named properties prevent parameter order mistakes:
```typescript
// Both work identically - order doesn't matter
async ({ http, db, logger }) => { ... }
async ({ logger, db, http }) => { ... }
```

**Self-documenting signatures** - The type signature reads like documentation:
```typescript
// Immediately obvious: needs HTTP, database, and logging
Eff<Order, { http: Http; db: Db; logger: Logger }>
```

**No combinatorial type explosion** - No need to define composite capability types for every combination:
```typescript
// Old approach required defining unions for each combination:
// type HttpAndDb = HttpCapability | DbCapability;
// type HttpDbAndLogger = HttpCapability | DbCapability | LoggerCapability;

// New approach: just declare what you need inline
Eff<User, { http: Http; db: Db }>
Eff<Order, { http: Http; db: Db; logger: Logger }>
```

**Type-safe capability threading** - The type system ensures all required capabilities are provided:
```typescript
// Function requiring subset of capabilities
const logMessage = ({ logger }: { logger: Logger }) =>
  logger.log("Processing...");

// Function with full capabilities can call it
const processOrder: Eff<void, { http: Http; db: Db; logger: Logger }> =
  async (caps) => {
    logMessage(caps);  // Type-safe: logger is present
    // Use all capabilities
  };
```

This approach aligns perfectly with the ports pattern - each capability is an injected dependency with a clear interface, making testing straightforward by swapping implementations.

### Effect Handlers: Interpreting Operations

Effects are instructions—data describing what should happen. Handlers interpret these instructions
at runtime. The runtime maintains a **handler stack**, and when a program performs an effect, the
runtime dispatches to the appropriate handler:

```typescript
const httpHandler: Handler = {
  name: "Http",
  handles: {
    get: async (instr, next) => {
      const [url] = instr.args;
      return await fetch(url);
    },
    post: async (instr, next) => {
      const [url, body] = instr.args;
      return await fetch(url, { method: "POST", body: JSON.stringify(body) });
    },
  },
};

// Compose effects in a program
// Type signature shows required capabilities: { http: Http; console: Console }
const buildUserProfile = (userId: string) =>
  seq()
    .let(() => fetchUser(userId))
    .let((user) => Http.op.get(`/users/${user.id}/posts`))
    .do((posts, ctx) => Console.op.log(`${ctx!.user.name} has ${posts.length} posts`))
    .return((posts, ctx) => ({ user: ctx!.user, posts }));

// Run program with handler stack - provides all required capabilities
const result = await stack(httpHandler, handlers.Console.live()).run(
  () => buildUserProfile("123"),
);
```

This design **decouples effect declaration from implementation**. Application code describes what it
needs. Handlers provide implementations. In tests, we swap HTTP handlers for mocks. In production,
we use real network calls. The application code never changes.

### Built-in Effect Handlers

The runtime includes standard handlers for common needs (available in the `handlers` object):

- **Console.live()** - Logging with immediate output to console
- **Console.capture()** - Logging with messages captured in an array
- **Exception.tryCatch()** - Converting failures to `{ tag: "Ok" | "Err" }` results
- **State.with(initial)** - Stateful computations with explicit get/modify operations
- **Async.default()** - Async operations (sleep, promise handling)

These handlers compose in the stack. A program can use Console, State, and Exception together, and
the runtime coordinates their interactions. For example:

```typescript
const result = await stack(
  handlers.State.with({ count: 0 }),
  handlers.Console.live(),
  handlers.Exception.tryCatch(),
).run(() =>
  seq()
    .tap(() => State.modify<{ count: number }>((s) => ({ count: s.count + 1 })))
    .let(() => State.get<{ count: number }>())
    .do((state) => Console.op.log(`Count: ${state.count}`))
    .value()
);
```

### Practical Example: Multi-Capability Workflow

The record-based approach shines when building realistic workflows that need multiple capabilities. Here's a complete user registration flow that demonstrates capability composition and testing:

```typescript
// Define capabilities as port interfaces
type HttpPort = {
  get: (url: string) => Promise<Response>;
  post: (url: string, body: unknown) => Promise<Response>;
};

type DbPort = {
  get: <T>(key: readonly string[]) => Promise<T | null>;
  set: <T>(key: readonly string[], value: T) => Promise<void>;
};

type LoggerPort = {
  log: (msg: string) => void;
  error: (msg: string) => void;
};

// Core domain function with explicit capability requirements
type RegisterUserEffect = Eff<Result<User, string>, {
  http: HttpPort;
  db: DbPort;
  logger: LoggerPort;
}>;

const registerUser = (email: string): RegisterUserEffect =>
  async ({ http, db, logger }) => {
    logger.log(`Starting registration for ${email}`);

    // Check if user already exists
    const existing = await db.get<User>(["userByEmail", email]);
    if (existing) {
      logger.error(`User ${email} already exists`);
      return err("USER_EXISTS");
    }

    // Validate email with external service
    logger.log(`Validating email ${email}`);
    const validation = await http.post("/api/validate", { email });
    if (!validation.ok) {
      return err("VALIDATION_FAILED");
    }

    // Create user
    const user = { id: crypto.randomUUID(), email, createdAt: new Date() };
    await db.set(["user", user.id], user);
    await db.set(["userByEmail", email], user);

    logger.log(`User ${email} registered successfully`);
    return ok(user);
  };

// Production capabilities
const prodCapabilities = {
  http: {
    get: (url: string) => fetch(url),
    post: (url: string, body: unknown) =>
      fetch(url, { method: "POST", body: JSON.stringify(body) })
  },
  db: {
    get: async (key) => (await Deno.openKv()).get(key).then(r => r.value),
    set: async (key, value) => (await Deno.openKv()).set(key, value)
  },
  logger: {
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg)
  }
};

// Test capabilities (no I/O, fully controlled)
const testCapabilities = {
  http: {
    get: async (_url) => new Response(JSON.stringify({ valid: true })),
    post: async (_url, _body) => new Response(JSON.stringify({ valid: true }))
  },
  db: {
    get: async (_key) => null, // No existing users
    set: async (_key, _value) => {}
  },
  logger: {
    log: (_msg) => {}, // Silent in tests
    error: (_msg) => {}
  }
};

// Same code, different capabilities
await registerUser("test@example.com")(prodCapabilities); // Production
await registerUser("test@example.com")(testCapabilities);  // Test
```

The type signature `Eff<Result<User, string>, { http: HttpPort; db: DbPort; logger: LoggerPort }>` makes the function's dependencies explicit. Testing becomes trivial - swap production implementations for test doubles. The domain logic never changes, yet it works in any context.

## Sequential and Parallel Composition

Pure functional code needs ways to sequence operations and express concurrency without mutation or
loops. **TypeLang** provides two abstractions: `seq()` for sequential composition and `par` for
parallel execution.

### Sequential Composition with Auto-Named Bindings

The `seq()` builder creates pipelines where each step can reference previous results through a typed
context:

```typescript
// Auto-named bindings create a predictable context: v1, v2, ...
seq()
  .let(() => fetchUser(id)) // ctx.v1
  .let((user) => fetchPosts(user.id)) // ctx.v2
  .do((_, ctx) => Console.op.log(`Found ${(ctx!["v2"] as any).length} posts`))
  .return((_, ctx) => ({ user: ctx!["v1"], posts: ctx!["v2"] }));

// Chain transformations with .then() (like Promise.then)
seq()
  .let(() => fetchUser(id))
  .then((user) => user.email)
  .tap((email) => Console.op.log(`Email: ${email}`))
  .value();

// Anonymous .let() also stores into context with auto keys
seq()
  .let(() => Http.op.get("/config")) // ctx.v1
  .let((config) => Http.op.get(config.endpoint)) // ctx.v2
  .then((response) => response.json())
  .value();
```

Each `.let(fn)` adds a binding to the context under an auto-generated key (`v1`, `v2`, ...). The
function receives both the last value and the accumulated context, allowing access to all previous
bindings. This keeps pipelines concise without manual names while still enabling contextual access.
TypeScript widens the context type to `Record<string, A>` for auto-named steps.

Key seq() methods:

- `.let(f)` - auto-named binding (stored in context as `vN` and becomes last value)
- `.then(f)` - chain transformation on last value (like Promise.then)
- `.tap(f)` - side effect with last value only
- `.do(f)` - side effect with last value and context
- `.when(pred, f)` - conditional execution based on predicate
- `.value()` - return last value directly
- `.return(f)` - close pipeline with transformation

The `.when()` method enables conditional logic within the subset's constraints:

```typescript
seq()
  .let(() => fetchUser(id))
  .when(
    (_, ctx) => (ctx!["v1"] as any).premium,
    (_, ctx) => Console.op.log(`Premium user: ${(ctx!["v1"] as any).name}`),
  )
  .return((_, ctx) => ctx!["v1"] as any);
```

This style is monadic—operations chain while maintaining immutability. The context is frozen after
each step, and the type system tracks accumulated effects across the entire pipeline.

### Parallel Execution

The `par` object provides parallel combinators:

```typescript
// Run multiple operations concurrently
par.all({
  user: () => fetchUser(id),
  posts: () => fetchPosts(id),
  comments: () => fetchComments(id),
}); // Returns { user, posts, comments }

// Map over collections in parallel
par.map([1, 2, 3], (n) => compute(n)); // Returns array of results

// Race multiple operations
par.race([() => fastPath(), () => slowPath()]); // First to complete wins
```

These combinators express concurrency declaratively. There are no threads, no locks, no shared
mutable state. The runtime coordinates parallel execution while maintaining the effect system's
guarantees.

## Practical Application: HTTP Server Architecture

To demonstrate these principles in practice, **TypeLang** includes a lightweight HTTP server that
separates pure application logic from HTTP concerns. The architecture has three layers:

**Server layer** - Handles HTTP protocol details, middleware composition, and routing. This layer
uses full TypeScript—it's not subject to subset restrictions because it's infrastructure, not
application logic.

**Middleware layer** - Cross-cutting concerns like logging, CORS, rate limiting, and authentication.
Middleware are functions `(next: Handler) => Handler` that compose through standard function
composition.

**Application layer** - Route handlers that live in the `app/` directory and strictly enforce subset
rules. These handlers receive `RequestCtx` and return `Response`, but internally they use only
functional subset constructs.

This layering demonstrates a core principle: **functional core, imperative shell**. Infrastructure
code at the edges uses whatever techniques are most practical. Application logic in the center
maintains purity and explicit effects.

### Data-Driven Routing

Routes are defined as data structures rather than imperative registration:

```typescript
export const routes: Routes = [
  { method: "GET", path: "/users/:id", handler: ({ params }) => ... },
  { method: "POST", path: "/echo", handler: async ({ req }) => ... }
];
```

The server compiles these routes to regex patterns at startup, matches incoming requests, and
dispatches to handlers. Path parameters are extracted and provided in the context. Adding routes
requires only data—no imperative setup code.

## Lessons from Constraint-Based Development

Building and using **TypeLang** has surfaced insights about how constraints shape development:

**Constraints shift mental models** - When teams can't reach for classes or mutations, they model
problems differently. Domain logic becomes transformations on immutable data. State changes become
explicit events. This shift in thinking often reveals simpler architectures.

**Explicit effects change conversations** - When a function's type signature shows it needs `{ http: Http; db: Db; logger: Logger }`, discussions about dependencies are concrete. The record-based approach makes capability requirements immediately visible—no need to look up what a composite type contains. Teams see coupling directly in function signatures and can reason about it deliberately.

**Tooling enables consistency** - Enforcing subset rules through linting means consistency doesn't
depend on vigilance. Code review focuses on whether the logic is correct and clear, not whether it
follows conventions. New team members can't accidentally introduce forbidden patterns.

**Type-driven development becomes natural** - When effects are tracked by types, teams write type
signatures before implementations. The signature declares capabilities needed, and the
implementation proves it can satisfy them with those capabilities. Design happens at the type level.

**Testing becomes more focused** - Pure functions are trivial to test—call them with inputs, check
outputs. Effectful functions with record-based capabilities make testing equally straightforward: pass test implementations of the required ports. The type signature `Eff<T, { http: Http; db: Db }>` explicitly declares dependencies, so tests provide controlled fakes without mocking frameworks. Integration tests simply compose different capability implementations than production—same code, different context. The separation is clean and type-safe.

## Current State and Evolution

**TypeLang** exists as a working system: a complete runtime, subset linter, HTTP server
implementation, and example applications. It runs on Deno with zero external dependencies beyond the
standard library.

We continue to refine the balance between constraints and expressiveness. Some questions remain
open:

- How do teams best structure large applications with these constraints?
- What patterns emerge for common tasks like validation, error handling, and business logic?
- How do we communicate effect requirements in documentation and APIs?

This is exploration, not dogma. The principles—explicit effects, enforced purity, minimal
syntax—guide decisions, but specifics evolve as we learn what works in practice.

## Principles for Constraint-Based Design

The lessons from **TypeLang** generalize beyond this specific system:

**Make guarantees enforceable** - Conventions that depend on discipline will eventually break down.
Constraints that tooling enforces become reliable foundations.

**Optimize for reading, not writing** - Code is read far more than written. Constraints that make
code easier to understand—explicit effects, no hidden state—are worth the writing effort.

**Explicit beats implicit** - When effects, dependencies, and state changes are visible in types and
signatures, systems become easier to reason about. The cognitive load shifts from remembering what
might happen to reading what will happen.

**Separate core from shell** - Not all code needs the same constraints. Application logic benefits
from purity. Infrastructure code can be pragmatic. Clear boundaries make both easier to maintain.

**TypeLang** demonstrates that meaningful constraints, enforced consistently, create clarity. When
we limit how code can be written—making effects visible, removing mutation, enforcing functional
purity—what emerges are systems easier to understand, test, and maintain.

The code we cannot write protects us from complexity we cannot manage.

<sub>Made with the help of my two favorite devs: Clody & Gipity. Enjoy!</sub>
