---
title: Functional TypeScript Without the Framework Baggage
date: 2025-01-15
tags: [TypeScript, Functional, Architecture, Patterns]
excerpt: Real functional programming benefits in TypeScript without fp-ts or complex abstractions - just pure functions, explicit errors, and smart use of the type system.
---

I've been working with TypeScript codebases for years, and I keep seeing the
same pain points. Class hierarchies that are hell to test. Exceptions thrown
from three layers deep with no warning. Objects mutating when you least expect
it. Testing requires elaborate mock setups just to verify simple logic.

So I started exploring functional programming as a solution. Libraries like
fp-ts show thoughtful approaches to FP in TypeScript, but here's what got me
thinking: can you get the core benefits without framework overhead? Just using
TypeScript's type system and simple patterns?

Turns out you can. Here's what I've learned.

## The Core Patterns

Functional programming in TypeScript boils down to straightforward ideas:

1. **Pure functions** - Same input always produces same output, no hidden
   surprises
2. **Explicit errors** - Function signatures tell you exactly what can fail
3. **Immutable data** - Values never change, making code predictable
4. **Clear dependencies** - No hidden coupling to databases or services

What I find interesting is that these work beautifully in TypeScript without any
libraries. Let's dig in.

## Pure Functions: The Foundation

Pure functions are simple - they don't depend on external state and don't cause
side effects. This makes them trivial to test:

```typescript
// Pure: Always returns same result for same input
const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

// Impure: Depends on external state that could change
let taxRate = 0.08;
const calculateTotalWithTax = (items: OrderItem[]): number =>
  calculateTotal(items) * (1 + taxRate); // taxRate could change!
```

Here's the cool part - testing pure functions requires zero setup:

```typescript
Deno.test("calculateTotal - sums item prices", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];
  assertEquals(calculateTotal(items), 35);
});
```

No mocking. No database fixtures. No shared state management. Call function,
verify output, done.

## Types vs Interfaces: Modeling Data Right

TypeScript gives you two ways to define structure: `type` aliases and
`interface` declarations. To me is interesting that the choice actually matters
for architectural clarity.

### Types for Data

Use `type` with `readonly` for pure data structures:

```typescript
// Data as immutable type
export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
};

export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
```

The `readonly` modifier prevents accidental mutations. Discriminated unions like
`PaymentStatus` make invalid states impossible to represent - you can't have a
payment that's both pending and completed.

### Interfaces for Capabilities

Use `interface` to define what your code needs from its dependencies:

```typescript
export interface Database {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (
    id: string,
  ) => Promise<Result<User | null, DatabaseError>>;
}

export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
}
```

This separation - types for data, interfaces for behavior - creates clear
boundaries in your architecture.

## Result Types: Errors as Values

TypeScript's type system can tell you exactly what errors to expect. But
exceptions? They're invisible until they blow up at runtime:

```typescript
// Throws exception without type-level warning
function parseConfig(input: string): Config {
  if (!input) throw new Error("Config required");
  return JSON.parse(input);
}

// Caller has no idea this can throw
const config = parseConfig(userInput);
```

Result types make error handling explicit:

```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Define domain-specific errors
export type ValidationError =
  | { readonly type: "required"; readonly field: string }
  | { readonly type: "invalid_email"; readonly field: string };

function parseConfig(input: string): Result<Config, ConfigError> {
  if (!input) return err({ type: "required", field: "config" });
  try {
    return ok(JSON.parse(input));
  } catch {
    return err({ type: "invalid_json", field: "config" });
  }
}

// Compiler enforces error handling
const result = parseConfig(userInput);
if (result.ok) {
  // TypeScript narrows type to success case
  console.log(result.value);
} else {
  // TypeScript narrows type to error case
  console.error(result.error.type);
}
```

Look at this - the function signature tells you exactly what can go wrong. No
hidden exceptions. No forgotten try/catch blocks. The compiler forces you to
handle both cases.

## The Ports Pattern: Keeping Logic Pure

What if your business logic didn't need to know about databases, file systems,
or HTTP clients? What if you could keep the core pure and inject capabilities?

```typescript
// Port: What your code needs, not how it works
interface Clock {
  readonly now: () => Date;
}

interface Crypto {
  readonly randomUUID: () => string;
}

interface Database {
  readonly save: <T>(
    key: string,
    value: T,
  ) => Promise<Result<T, DatabaseError>>;
}

// Pure business logic with injected dependencies
const createUser =
  (clock: Clock, crypto: Crypto, db: Database) =>
  async (userData: CreateUserData): Promise<Result<User, CreateUserError>> => {
    // Validate (pure)
    const validation = validateUserData(userData);
    if (!validation.ok) return validation;

    // Create user object (pure)
    const user: User = {
      id: crypto.randomUUID(),
      name: userData.name,
      email: userData.email,
      createdAt: clock.now(),
    };

    // Save (effectful, but isolated)
    return await db.save(`user:${user.id}`, user);
  };
```

Here's why this works beautifully - testing becomes straightforward:

```typescript
Deno.test("createUser - assigns correct timestamp", async () => {
  const fixedDate = new Date("2024-01-01");
  const mockClock = { now: () => fixedDate };
  const mockCrypto = { randomUUID: () => "test-id-123" };
  const mockDb = { save: async (k: string, v: any) => ok(v) };

  const result = await createUser(mockClock, mockCrypto, mockDb)({
    name: "Alice",
    email: "alice@example.com",
  });

  assertEquals(result.ok && result.value.createdAt, fixedDate);
});
```

Simple object implementations. No mocking libraries. No complicated setup.

### Directory Structure for Ports

```
src/
  domain/           # Pure business logic
    user.ts
    order.ts
  ports/            # Interface definitions
    clock.ts
    database.ts
    crypto.ts
  adapters/         # Port implementations
    real-clock.ts
    deno-crypto.ts
    sqlite-db.ts
  http/            # HTTP transport layer
    handlers.ts
    middleware.ts
```

This organization separates pure logic from effects. Domain code imports only
port interfaces, never concrete implementations.

## Branded Types: Preventing ID Mix-ups

TypeScript's structural typing has a subtle problem - any two values with the
same shape are interchangeable:

```typescript
// Dangerous: Both are just numbers
type UserId = number;
type AccountId = number;

const getUserBalance = (accountId: AccountId): number => {
  return 100;
};

const userId: UserId = 123;
const balance = getUserBalance(userId); // TypeScript allows this bug!
```

Branded types solve this by creating distinct type identities:

```typescript
// Safe: Each ID type has unique identity
type UserId = number & { readonly _brand: unique symbol };
type AccountId = number & { readonly _brand: unique symbol };

// Smart constructors enforce the brand
const createUserId = (id: number): UserId => id as UserId;
const createAccountId = (id: number): AccountId => id as AccountId;

const getUserBalance = (accountId: AccountId): number => {
  return 100;
};

const userId = createUserId(123);
const balance = getUserBalance(userId); // Compile error!
// Type 'UserId' is not assignable to type 'AccountId'

const accountId = createAccountId(456);
const correctBalance = getUserBalance(accountId); // Safe!
```

Use branded types for domain IDs (`UserId`, `ProductId`, `OrderId`), units
(`Meters`, `Usd`), and validated values (`PositiveInteger`, `ValidEmail`). They
prevent entire classes of bugs at compile time.

## Immutability: Safety Through Types

Preventing accidental mutations changes everything:

```typescript
// Before: Anyone can modify
type User = {
  id: string;
  name: string;
  roles: string[];
};

const user: User = { id: "1", name: "Alice", roles: ["user"] };
user.roles.push("admin"); // Oops!

// After: Compiler prevents mutations
type User = {
  readonly id: string;
  readonly name: string;
  readonly roles: ReadonlyArray<string>;
};

const user: User = { id: "1", name: "Alice", roles: ["user"] };
user.roles.push("admin"); // Compile error!

// Updates create new objects
const adminUser = { ...user, roles: [...user.roles, "admin"] };
```

The pattern is simple - `readonly` everywhere in your type definitions. Updates
use spread operators to create new objects. This depends of TypeScript's type
system to enforce immutability at compile time.

## Composition: Chaining Operations

Utility functions make it clean to chain operations:

```typescript
// Transform successful results
const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => result.ok ? ok(fn(result.value)) : result;

// Chain operations that can fail
const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => result.ok ? fn(result.value) : result;

// Compose validation pipeline
const processUserInput = (input: unknown): Result<User, ValidationError> =>
  flatMap(
    parseUserData(input),
    (data) =>
      flatMap(
        validateEmail(data.email),
        (email) =>
          flatMap(
            validateName(data.name),
            (name) => ok({ ...data, email, name }),
          ),
      ),
  );
```

This gets verbose with deep nesting, but for simple cases it works well. The
benefit is that errors short-circuit automatically - if any step fails, the rest
skip.

## Migration Strategy

Don't rewrite everything. Apply these patterns gradually:

### Phase 1: New Code First

Start with new features. This establishes patterns without disrupting existing
functionality:

```typescript
// New feature: pure function with Result type
export const calculateDiscount = (
  order: Order,
  promoCode: string,
): Result<number, DiscountError> => {
  // Pure validation and calculation
};
```

### Phase 2: Extract Pure Logic

Pull business logic out of classes into pure functions:

```typescript
// Before: Logic trapped in class
class OrderService {
  calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

// After: Pure function anyone can use
export const calculateOrderTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);
```

### Phase 3: Convert Exceptions to Results

Replace throwing functions gradually:

```typescript
// Before
function parseConfig(json: string): Config {
  if (!json) throw new Error("Config required");
  return JSON.parse(json);
}

// After
function parseConfig(json: string): Result<Config, ConfigError> {
  if (!json) return err({ type: "required" });
  try {
    return ok(JSON.parse(json));
  } catch {
    return err({ type: "invalid_json" });
  }
}
```

### Phase 4: Introduce Ports

Identify external dependencies and create interfaces:

```typescript
// Before: Direct coupling
async function sendEmail(user: User) {
  await nodemailer.send({ to: user.email, ... });
}

// After: Port interface
interface EmailService {
  readonly send: (to: string, subject: string, body: string) =>
    Promise<Result<void, EmailError>>;
}

const sendWelcomeEmail = (emailService: EmailService) =>
  async (user: User): Promise<Result<void, EmailError>> => {
    return await emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );
  };
```

## Real Talk: What Works and What Doesn't

I've used these patterns in production for months now. Here's the honest
assessment.

### Where It Shines

**Testing is dramatically easier.** Pure functions need no setup. Port
interfaces become simple object implementations in tests. No mocking libraries,
no elaborate fixtures.

**Fewer runtime surprises.** Result types force error handling at compile time.
No forgotten try/catch blocks. No exceptions from deep in the call stack.

**Code review gets better.** Function signatures reveal exactly what can
happen - inputs, outputs, possible errors. No hidden side effects.

**Debugging is faster.** Immutable data and pure functions eliminate entire
classes of bugs. When something breaks, the problem is isolated and obvious.

### Where It Falls Short

**Learning curve for teams.** If your team is deep in OOP patterns, this shift
takes time. The concepts are simple but feel different.

**Integration with class-based libraries.** Some TypeScript ecosystems are built
around classes. Adapting them to this style adds boilerplate.

**Verbosity in some cases.** Result type handling can get verbose with deep
nesting. Helper functions help, but it's still more code than try/catch.

**Not ideal for stateful UIs.** Complex client-side state machines and real-time
updates work better with frameworks designed for that.

### When to Use This

This approach works best for:

- Backend services and APIs
- Data processing pipelines
- Teams of 3-15 developers
- Projects with 3+ month timelines (learning curve amortizes)
- TypeScript with strict mode enabled

Skip it for:

- Highly stateful UIs with complex client state
- Teams with tight deadlines and strong OOP conventions
- Heavy integration with class-based Java/C# systems

## Implementation Checklist

- [ ] Data defined with `type` and `readonly` properties
- [ ] Capabilities defined with `interface`
- [ ] Fallible operations return `Result<T, E>`
- [ ] Dependencies injected through function parameters
- [ ] Pure functions for business logic
- [ ] Side effects pushed to application boundaries
- [ ] TypeScript strict mode enabled
- [ ] Test coverage ≥80% for pure functions

## What I've Learned

Functional TypeScript isn't about exotic abstractions or academic theory. It's
about writing code that's easier to test, safer to change, and simpler to
understand.

The patterns are straightforward - pure functions, explicit errors, immutable
data, clear dependencies. What makes them effective is applying them
consistently. I started with one new feature, measured the outcomes, and
expanded based on what actually worked.

The best part? You don't need frameworks or libraries. Just TypeScript's type
system and discipline.

I've been building my band's website and a small blog engine using these
patterns. Testing feels effortless compared to class-based code. Error handling
is explicit everywhere. Changes that used to scare me now feel safe.

This won't replace every pattern everywhere. But for backend services and data
processing? Surprisingly capable. Worth exploring.
