---
title: "TypeLang - Strict TypeScript Subset with Algebraic Effects"
date: 2025-10-19
tags: [TypeScript, Functional, Algebraic Effects, Language Design]
excerpt: Software complexity grows not just from problems we solve, but from flexibility languages give us. TypeLang explores enforcing functional principles and explicit effects through constraints—making illegal states unrepresentable and side effects visible in type signatures.
---

Codebases grow complex. Not just from business logic complexity, but from
language flexibility. When code can express ideas countless ways—mixing
paradigms, hiding effects, mutating state freely—systems become hard to
understand and maintain.

TypeScript gives you classes, functions, mutations, exceptions, async/await.
Freedom to solve problems however you want. Great flexibility. But. This freedom
creates consistency problems. Different developers write similar code
differently. Side effects hide in function bodies. State mutations ripple
unpredictably.

I built **TypeLang** to explore constraint-based development. Strict TypeScript
subset that enforces particular programming style. And, it adds zero new syntax:
you write 100% valid TypeScript that runs on Deno. The constraints are baseed on
two ideas: light functional programming principles, and tracking effects in type
signatures.

Core principle: **the code you cannot write is as important as the code you
can**.

**See it Live! ↓**

[![See it Live!](/images/typelang.jpg){width=600}](https://typelang.timok.deno.net/)

GitHub repo:
[https://github.com/srdjan/TypeLang](https://github.com/srdjan/TypeLang)

🔹 This is tinkering and learning project. For production work, check out
[Effect-TS](https://github.com/Effect-TS/effect) or
[Effection](https://github.com/thefrontside/effection)—they've pioneered many of
these ideas with mature implementations.

## Constraints Enable Clarity

TypeLang's foundation: **constraints create clarity**. Remove language features
that obscure intent—classes with hidden state, control flow that jumps
unpredictably, mutations that ripple through systems. What remains? Code where
data flows and effects are explicit.

Three core constraints:

**Subset enforcement** - No classes, mutations, loops, or conditional statements
(`if`/`else`). Application code uses only `const` declarations, pure functions,
expression-oriented control flow through pattern matching.

**Effect visibility** - Side effects (I/O, state changes, exceptions) tracked in
type signatures. Function that reads a file has different type than one
performing pure computation. Capabilities visible at type level.

**TypeScript compatibility** - No new syntax. Effect tracking uses phantom
types. Runtime interprets effect instructions through handlers. All TypeScript
tooling works unchanged.

These constraints emerged from watching teams struggle with codebases where
anything is possible. No guardrails means consistency depends entirely on
discipline and review. Encode constraints in tooling? Enforcement shifts from
humans to machines. (Inspired by ReScript ❤️, which demonstrated this approach
beautifully)

## The Functional Subset: What Got Removed

TypeLang forbids several mainstream TypeScript features. Each prohibition
addresses specific complexity source:

### No Classes or OOP

Classes in TypeScript encourage encapsulating mutable state and hiding effects
behind method calls. Method might trigger network requests, mutate internal
state, throw exceptions. None visible in type signature. Hidden complexity
everywhere.

Removed: classes, `this`, `new` (except `new Proxy` for runtime internals).

Instead: model domains with **algebraic data types**—discriminated unions and
type aliases. Data structures are readonly records. Functions operating on these
types are pure transformations. State handled explicitly through effect system.

### No Control Flow That Obscures Intent

Traditional `if`/`else` statements encourage imperative thinking. "Do this, then
do that." Decision structure hidden in statement sequences.

Replaced with **pattern matching** via `match()` function. Decisions become
explicit and exhaustive:

```typescript
match(result, {
  Ok: (value) => value.data,
  Err: (error) => defaultValue,
});
```

Pattern matching forces handling all cases. Type system ensures exhaustiveness.
Control flow becomes data transformation.

### No Mutation

Mutation is primary complexity source in concurrent systems. State can change
anywhere? Reasoning about behavior requires tracking all possible execution
paths.

Prohibited: `let`, `var`, `++`, `--`, assignment expressions. Application code
uses only `const`.

Programs can have state—state changes are **explicit effects** handled by
runtime. Functions don't mutate variables. They return new values or declare
state effects executed by runtime handlers.

### Tool-Enforced Rules

These aren't suggestions. They're enforced. Custom lexical linter
(`scripts/lint_subset.ts`) scans source files, rejects forbidden syntax. Running
`deno task lint` checks standard Deno rules and functional subset. CI fails on
violations.

Tool-enforced, not documentation-enforced. No debates about whether to use
classes or mutation. Tooling prevents it. Code review focuses on logic and
design, not style compliance.

## Algebraic Effects: Visible Side Effects

TypeLang's effect system makes side effects explicit. Traditional TypeScript
function `getUserById(id: string): User` tells you nothing about effects.
Database read? HTTP request? Exceptions? Type signature is silent.

TypeLang makes effects explicit through `Eff<A, Caps>` type. Function returning
`Eff<User, { http: Http }>` declares it produces `User` value and requires HTTP
capabilities. Effects tracked at type level, visible in every signature.

### Effect Declaration and Usage

Define effects using `defineEffect()`:

```typescript
const Http = defineEffect<"Http", {
  get: (url: string) => Response;
  post: (url: string, body: unknown) => Response;
}>("Http");

// Returns Eff<Response, { http: Http }>
const fetchUser = (id: string) => Http.op.get(`/users/${id}`);
```

Type system tracks that `fetchUser` requires HTTP capabilities. Functions
calling `fetchUser` inherit this requirement. Effect dependencies flow through
call graph, visible at every level.

### Record-Based Capabilities

Record-based capability syntax `{ http: Http; db: Db }` provides ergonomic
advantages over alternatives. Multi-capability functions become crystal clear:

**Single capability** wraps cleanly:

```typescript
const getTime: Eff<Date, { clock: Clock }> = ({ clock }) => clock.now();
```

**Multiple capabilities** explicit and composable:

```typescript
const registerUser: Eff<Result<User, string>, {
  http: Http;
  db: Db;
  logger: Logger;
}> = async ({ http, db, logger }) => {
  logger.log("Starting registration");
  const userData = await http.get("/api/user");
  await db.set(["user", userData.id], userData);
  return ok(userData);
};
```

Benefits:

**Order-independent destructuring** - Named properties prevent parameter order
mistakes:

```typescript
// Both work identically
async ({ http, db, logger }) => { ... }
async ({ logger, db, http }) => { ... }
```

**Self-documenting signatures** - Type signature reads like documentation:

```typescript
// Immediately obvious: needs HTTP, database, logging
Eff<Order, { http: Http; db: Db; logger: Logger }>;
```

**No type explosion** - No need defining composite capability types for every
combination:

```typescript
// Just declare what you need inline
Eff<User, { http: Http; db: Db }>;
Eff<Order, { http: Http; db: Db; logger: Logger }>;
```

**Type-safe capability threading**:

```typescript
// Function requiring subset of capabilities
const logMessage = ({ logger }: { logger: Logger }) =>
  logger.log("Processing...");

// Function with full capabilities can call it
const processOrder: Eff<void, { http: Http; db: Db; logger: Logger }> = async (
  caps,
) => {
  logMessage(caps); // Type-safe: logger present
};
```

Aligns perfectly with ports pattern—each capability is injected dependency with
clear interface. Testing straightforward by swapping implementations.

### Effect Handlers: Interpreting Operations

Effects are instructions—data describing what should happen. Handlers interpret
instructions at runtime. Runtime maintains **handler stack**. When program
performs effect, runtime dispatches to appropriate handler:

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

// Compose effects in program
const buildUserProfile = (userId: string) =>
  seq()
    .let(() => fetchUser(userId))
    .let((user) => Http.op.get(`/users/${user.id}/posts`))
    .do((posts, ctx) =>
      Console.op.log(`${ctx!.user.name} has ${posts.length} posts`)
    )
    .return((posts, ctx) => ({ user: ctx!.user, posts }));

// Run with handler stack
const result = await stack(httpHandler, handlers.Console.live()).run(
  () => buildUserProfile("123"),
);
```

This **decouples effect declaration from implementation**. Application code
describes needs. Handlers provide implementations. Tests swap HTTP handlers for
mocks. Production uses real network calls. Application code never changes.

### Built-in Effect Handlers

Runtime includes standard handlers (in `handlers` object):

- **Console.live()** - Logging with immediate console output
- **Console.capture()** - Logging with captured messages
- **Exception.tryCatch()** - Converting failures to `{ tag: "Ok" | "Err" }`
  results
- **State.with(initial)** - Stateful computations with explicit get/modify
  operations
- **Async.default()** - Async operations (sleep, promise handling)

Handlers compose in stack. Program can use Console, State, Exception together.
Runtime coordinates interactions:

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

### Multi-Capability Workflow Example

Record-based approach shines for realistic workflows. Complete user registration
flow showing capability composition and testing:

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

const registerUser =
  (email: string): RegisterUserEffect => async ({ http, db, logger }) => {
    logger.log(`Starting registration for ${email}`);

    // Check if user exists
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
      fetch(url, { method: "POST", body: JSON.stringify(body) }),
  },
  db: {
    get: async (key) => (await Deno.openKv()).get(key).then((r) => r.value),
    set: async (key, value) => (await Deno.openKv()).set(key, value),
  },
  logger: {
    log: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
  },
};

// Test capabilities (no I/O, fully controlled)
const testCapabilities = {
  http: {
    get: async (_url) => new Response(JSON.stringify({ valid: true })),
    post: async (_url, _body) => new Response(JSON.stringify({ valid: true })),
  },
  db: {
    get: async (_key) => null,
    set: async (_key, _value) => {},
  },
  logger: {
    log: (_msg) => {},
    error: (_msg) => {},
  },
};

// Same code, different capabilities
await registerUser("test@example.com")(prodCapabilities); // Production
await registerUser("test@example.com")(testCapabilities); // Test
```

Type signature
`Eff<Result<User, string>, { http: HttpPort; db: DbPort; logger: LoggerPort }>`
makes dependencies explicit. Testing becomes trivial—swap production
implementations for test doubles. Domain logic never changes, works in any
context.

## Sequential and Parallel Composition

Pure functional code needs ways to sequence operations and express concurrency
without mutation or loops. TypeLang provides: `seq()` for sequential
composition, `par` for parallel execution.

### Sequential Composition with Auto-Named Bindings

`seq()` builder creates pipelines where each step references previous results
through typed context:

```typescript
// Auto-named bindings: v1, v2, ...
seq()
  .let(() => fetchUser(id)) // ctx.v1
  .let((user) => fetchPosts(user.id)) // ctx.v2
  .do((_, ctx) => Console.op.log(`Found ${(ctx!["v2"] as any).length} posts`))
  .return((_, ctx) => ({ user: ctx!["v1"], posts: ctx!["v2"] }));

// Chain transformations with .then()
seq()
  .let(() => fetchUser(id))
  .then((user) => user.email)
  .tap((email) => Console.op.log(`Email: ${email}`))
  .value();
```

Each `.let(fn)` adds binding to context under auto-generated key (`v1`, `v2`,
...). Function receives both last value and accumulated context, allowing access
to all previous bindings. Keeps pipelines concise without manual names while
enabling contextual access.

Key seq() methods:

- `.let(f)` - auto-named binding (stored as `vN`, becomes last value)
- `.then(f)` - chain transformation on last value (like Promise.then)
- `.tap(f)` - side effect with last value only
- `.do(f)` - side effect with last value and context
- `.when(pred, f)` - conditional execution based on predicate
- `.value()` - return last value directly
- `.return(f)` - close pipeline with transformation

`.when()` method enables conditional logic within subset constraints:

```typescript
seq()
  .let(() => fetchUser(id))
  .when(
    (_, ctx) => (ctx!["v1"] as any).premium,
    (_, ctx) => Console.op.log(`Premium user: ${(ctx!["v1"] as any).name}`),
  )
  .return((_, ctx) => ctx!["v1"] as any);
```

Monadic style—operations chain while maintaining immutability. Context frozen
after each step. Type system tracks accumulated effects across entire pipeline.

### Parallel Execution

`par` object provides parallel combinators:

```typescript
// Run multiple operations concurrently
par.all({
  user: () => fetchUser(id),
  posts: () => fetchPosts(id),
  comments: () => fetchComments(id),
}); // Returns { user, posts, comments }

// Map over collections in parallel
par.map([1, 2, 3], (n) => compute(n));

// Race multiple operations
par.race([() => fastPath(), () => slowPath()]); // First to complete wins
```

Express concurrency declaratively. No threads, no locks, no shared mutable
state. Runtime coordinates parallel execution while maintaining effect system
guarantees.

## HTTP Server Architecture

TypeLang includes lightweight HTTP server demonstrating principles in practice.
Architecture has three layers:

**Server layer** - Handles HTTP protocol details, middleware composition,
routing. Uses full TypeScript—not subject to subset restrictions because it's
infrastructure, not application logic.

**Middleware layer** - Cross-cutting concerns: logging, CORS, rate limiting,
authentication. Middleware are functions `(next: Handler) => Handler` that
compose through standard function composition.

**Application layer** - Route handlers in `app/` directory strictly enforce
subset rules. Handlers receive `RequestCtx`, return `Response`. Internally use
only functional subset constructs.

Demonstrates core principle: **functional core, imperative shell**.
Infrastructure code at edges uses practical techniques. Application logic in
center maintains purity and explicit effects.

### Data-Driven Routing

Routes defined as data structures:

```typescript
export const routes: Routes = [
  { method: "GET", path: "/users/:id", handler: ({ params }) => ... },
  { method: "POST", path: "/echo", handler: async ({ req }) => ... }
];
```

Server compiles routes to regex patterns at startup, matches incoming requests,
dispatches to handlers. Path parameters extracted and provided in context.
Adding routes requires only data—no imperative setup.

## What Constraints Changed

Building and using TypeLang surfaced insights about how constraints shape
development:

**Mental models shift** - Can't reach for classes or mutations? Model problems
differently. Domain logic becomes transformations on immutable data. State
changes become explicit events. Often reveals simpler architectures.

**Explicit effects change conversations** - Function's type signature shows
`{ http: Http; db: Db; logger: Logger }`. Discussions about dependencies become
concrete. Record-based approach makes capability requirements immediately
visible. Teams see coupling in function signatures, reason about it
deliberately.

**Tooling enables consistency** - Enforcing subset rules through linting means
consistency doesn't depend on vigilance. Code review focuses on logic
correctness and clarity, not convention compliance. New team members can't
accidentally introduce forbidden patterns.

**Type-driven development becomes natural** - Effects tracked by types? Write
type signatures before implementations. Signature declares needed capabilities.
Implementation proves it can satisfy them. Design happens at type level.

**Testing becomes focused** - Pure functions trivial to test: call with inputs,
check outputs. Effectful functions with record-based capabilities make testing
equally straightforward: pass test implementations of required ports. Type
signature `Eff<T, { http: Http; db: Db }>` explicitly declares dependencies.
Tests provide controlled fakes without mocking frameworks. Integration tests
compose different capability implementations than production—same code,
different context. Separation is clean and type-safe.

To me is interesting that these benefits emerge from constraints, not features.
Removing capabilities forces different thinking. Different thinking produces
clearer systems.

## Current State

TypeLang exists as working system: complete runtime, subset linter, HTTP server
implementation, example applications. Runs on Deno with zero external
dependencies beyond standard library.

Still refining balance between constraints and expressiveness. Open questions:

- How do teams structure large applications with these constraints?
- What patterns emerge for validation, error handling, business logic?
- How communicate effect requirements in documentation and APIs?

Exploration, not dogma. Principles—explicit effects, enforced purity, minimal
syntax—guide decisions. Specifics evolve as we learn what works in practice.

## Design Principles That Generalize

Lessons from TypeLang apply beyond this specific system:

**Make guarantees enforceable** - Conventions depending on discipline eventually
break down. Constraints that tooling enforces become reliable foundations.

**Optimize for reading, not writing** - Code is read far more than written.
Constraints making code easier to understand (explicit effects, no hidden state)
are worth writing effort.

**Explicit beats implicit** - Effects, dependencies, state changes visible in
types and signatures make systems easier to reason about. Cognitive load shifts
from remembering what might happen to reading what will happen.

**Separate core from shell** - Not all code needs same constraints. Application
logic benefits from purity. Infrastructure code can be pragmatic. Clear
boundaries make both easier to maintain.

## Real Talk: Tradeoffs

TypeLang is experimental. Not production-ready framework. Learning project
exploring constraint-based development.

**Steep learning curve** - Functional programming with explicit effects is
different from typical TypeScript. Team needs time adjusting to no classes, no
mutations, effect tracking everywhere.

**Verbose at times** - Type signatures get long with multiple capabilities.
`Eff<Result<User, string>, { http: Http; db: Db; logger: Logger }>` is mouthful.
Verbosity brings precision, but it's still verbose.

**Limited ecosystem** - No plugin library. No middleware marketplace. Build
custom solutions or use vanilla Deno libraries. Early adopter territory.

**Tooling is custom** - Subset linter is custom script. Not integrated into
TypeScript compiler. No IDE support for effect system beyond standard TypeScript
checking.

**Performance overhead** - Effect system has runtime cost. Handler dispatch,
context management, instruction interpretation. Not optimized for performance.
Good enough for learning, maybe not for production.

But. These constraints force different thinking. If exploring functional
programming, effect systems, or constraint-based development? TypeLang
demonstrates one approach. Learn from it. Take ideas. Build better systems.

I've been using TypeLang for weekend experiments. The constraints feel
restrictive initially. Can't just mutate variables or throw exceptions. But
after writing few hundred lines? Code becomes noticeably clearer. Function
signatures tell you everything about dependencies. Testing simplifies.
Refactoring feels safer.

## Bottom Line

Software complexity grows from flexibility languages provide. TypeScript's
freedom enables any programming style. Great flexibility. But. Consistency
becomes problem at scale.

TypeLang explores opposite approach: constrain how code can be written. No
classes. No mutations. Effects visible in type signatures. Tool-enforced rules.
These constraints create clarity—illegal states become unrepresentable, side
effects become visible, testing becomes straightforward.

This means constraint-based development isn't for every project. Complex
applications with diverse requirements need flexibility. But. For domains where
consistency matters, where effects need tracking, where team coordination costs
are high? Constraints might help.

The space for language design with meaningful constraints remains largely
unexplored. Effect-TS and Effection pioneered effect systems for TypeScript.
ReScript demonstrated enforced functional programming. TypeLang combines these
ideas in Deno environment with zero syntax additions.

Not saying everyone should adopt these constraints. Saying constraint-based
development is worth exploring. When we limit how code can be written—making
effects visible, removing mutation, enforcing functional purity—systems might
become easier to understand, test, and maintain.

The code we cannot write protects us from complexity we cannot manage.

<sub>Made with the help of my two favorite devs: Clody & Gipity. Enjoy!</sub>
