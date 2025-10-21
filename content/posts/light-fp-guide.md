---
title: Exploring Light Functional Programming in TypeScript
date: 2025-01-15
tags: [TypeScript, Functional, Architecture, Patterns, Research]
excerpt: Investigating a principled approach to TypeScript that emphasizes immutability and explicit error handling, exploring whether simpler patterns might offer benefits without framework complexity.
---

I've been exploring TypeScript architectures across different codebases, and I keep noticing recurring patterns: class-based services with hidden dependencies, exception-driven error handling, mutable data structures. What I find interesting is how these patterns, while familiar, often create testing complexity and runtime unpredictability as systems evolve.

This led me to investigate what I call "Light Functional Programming"—an approach grounded in three principles that emerged from examining what makes some TypeScript codebases easier to test and maintain:

1. **Make invalid states impossible to represent**
2. **Keep business logic pure, push side effects to the edges**
3. **Return errors as values, not surprises**

What I found compelling is that this approach builds on TypeScript's existing type system without requiring additional frameworks or libraries.

## Discovering the Foundation: Types, Interfaces, and Data Modeling

As I investigated different approaches to structuring TypeScript code, I discovered that the distinction between `type` aliases and `interface` declarations serves an architectural purpose worth exploring.

### Types for Data

What I found is that data structures—representing information with no behavior attached—benefit significantly from immutability and explicit structure:

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

To me is interesting how the `readonly` modifier prevents unintended mutations. Discriminated unions like `PaymentStatus` make states explicit and exhaustive—a pattern I've found eliminates entire classes of bugs.

### Interfaces for Capabilities

What clicked for me was understanding that capabilities represent behavior systems need from their dependencies:

```typescript
export interface Database {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (id: string) => Promise<Result<User | null, DatabaseError>>;
}

export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
}
```

What I discovered is that interfaces define contracts without specifying implementation—a separation that makes testing and evolution surprisingly straightforward.

### Patterns I've Learned to Avoid

```typescript
// ❌ Interface for data (loses immutability guarantees)
interface UserData {
  id: string;
  name: string;
}

// ❌ Mutable properties
export type User = {
  id: string;      // Can be reassigned
  name: string;
};

// ❌ Classes for pure data
class User {
  constructor(public id: string, public name: string) {}
}
```

## Exploring Explicit Error Handling with Result Types

As I dug deeper into this, I discovered how exception-based error handling creates invisible failure paths. What struck me is that functions that throw don't declare it in their type signatures:

```typescript
// Throws exceptions without type-level indication
function parseConfig(input: string): Config {
  if (!input) throw new Error("Config required");
  return JSON.parse(input);
}

// Caller has no compiler-enforced reminder to handle failures
const config = parseConfig(userInput);
```

What I found compelling is that Result types make error handling explicit:

```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Domain-specific error types
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

What I discovered is that Result types shift errors from runtime surprises to compile-time requirements—a transformation that fundamentally changes how I think about error handling.

## Investigating the Ports Pattern: Dependency Management

I've been exploring how the ports pattern separates business logic from infrastructure through explicit dependency injection. This architectural approach enables testing and evolution without framework complexity—something I found particularly valuable.

### Directory Organization

```
src/
  domain/           # Pure business logic
  ports/            # Interface definitions (capabilities)
    clock.ts
    logger.ts
    database.ts
  adapters/         # Port implementations
    real-clock.ts
    console-logger.ts
    sqlite-db.ts
  http/            # HTTP transport layer
```

### Pure Domain Functions

What I find interesting is how domain logic can operate on interfaces without knowledge of concrete implementations:

```typescript
// src/domain/user-service.ts
import type { Clock } from "../ports/clock.ts";
import type { Crypto } from "../ports/crypto.ts";
import type { Database } from "../ports/database.ts";

export const createUser =
  (clock: Clock, crypto: Crypto, db: Database) =>
  async (userData: CreateUserData): Promise<Result<User, CreateUserError>> => {
    // Pure validation
    const validation = validateUserData(userData);
    if (!validation.ok) return validation;

    // Create user with injected capabilities
    const user: User = {
      id: crypto.randomUUID(),
      name: userData.name,
      email: userData.email,
      createdAt: clock.now(),
    };

    // Save using injected database
    return await db.save(user);
  };
```

### Composition at Boundaries

Application boundaries wire together concrete implementations:

```typescript
// src/app/main.ts
import { createClock } from "../adapters/real-clock.ts";
import { createCrypto } from "../adapters/deno-crypto.ts";
import { createDatabase } from "../adapters/sqlite-db.ts";

// Compose dependencies
const clock = createClock();
const crypto = createCrypto();
const database = createDatabase("./app.db");

// Create composed service
const userService = {
  createUser: createUser(clock, crypto, database),
};
```

## Examining Pure Functions and Side Effect Boundaries

As I explored this pattern further, I discovered that while applications require side effects—database operations, HTTP calls, logging, time access—the interesting architectural question becomes where these effects should live.

### Pure Core (Domain Logic)

```typescript
// No I/O, no randomness, no global state
export const calculateOrderTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

export const canUserAccessResource = (user: User, resource: Resource): boolean =>
  user.role === "admin" || resource.ownerId === user.id;

export const validateEmail = (email: string): Result<string, ValidationError> => {
  if (!email.includes("@")) {
    return err({ type: "invalid_email", field: "email" });
  }
  return ok(email);
};
```

### Effectful Edges (Application Boundary)

```typescript
// Side effects concentrated at system boundaries
export const createOrderHandler =
  (logger: Logger, db: Database, emailService: EmailService) =>
  async (request: Request): Promise<Response> => {
    try {
      // Parse input (side effect)
      const orderData = await request.json();

      // Pure validation and business logic
      const validation = validateOrderData(orderData);
      if (!validation.ok) {
        return Response.json({ error: validation.error }, { status: 400 });
      }

      const order = createOrderFromData(validation.value);
      const total = calculateOrderTotal(order.items);

      // Side effects (database, email)
      const saveResult = await db.saveOrder({ ...order, total });
      if (!saveResult.ok) {
        logger.error("Failed to save order", saveResult.error);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }

      await emailService.sendOrderConfirmation(order);
      return Response.json(saveResult.value, { status: 201 });
    } catch (error) {
      logger.error("Unhandled error", error);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
```

What I've come to appreciate is how this separation simplifies testing: pure functions require no setup, while effectful boundaries need only simple interface implementations.

## Exploring Testing Approaches

### Pure Functions (No Setup Required)

```typescript
Deno.test("calculateOrderTotal - calculates correct total", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];

  const total = calculateOrderTotal(items);
  assertEquals(total, 35);
});
```

### Functions with Dependencies (Simple Mocks)

```typescript
Deno.test("createUser - creates user with correct timestamp", async () => {
  // Simple object implementations
  const fixedDate = new Date("2024-01-01T00:00:00Z");
  const mockClock = {
    now: () => fixedDate,
    timestamp: () => fixedDate.getTime()
  };
  const mockCrypto = { randomUUID: () => "test-uuid-123" };
  const mockDb = { save: async (user: User) => ok(user) };

  const result = await createUser(mockClock, mockCrypto, mockDb)({
    name: "Test User",
    email: "test@example.com"
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.id, "test-uuid-123");
    assertEquals(result.value.createdAt, fixedDate);
  }
});
```

## Discovering Smart Constructors for Validated Types

As I investigated further, I discovered how brand types combine TypeScript's type system with runtime validation in interesting ways:

```typescript
export type Email = string & { readonly __brand: "Email" };
export type UserId = string & { readonly __brand: "UserId" };

export const createEmail = (input: string): Result<Email, ValidationError> => {
  if (!input.includes("@")) {
    return err({ type: "invalid_email", field: "email" });
  }
  return ok(input as Email);
};

// Usage ensures validation
const emailResult = createEmail(userInput);
if (emailResult.ok) {
  // emailResult.value has type Email, guaranteed to be validated
  const user = createUser({ email: emailResult.value, ...data });
}
```

## Exploring Migration Strategies

As I've worked with these patterns, I've found that incremental adoption reduces risk and enables learning:

### Phase 1: New Code (Weeks 1-2)

What I found works well is applying Light FP patterns to new features first. This establishes patterns without disrupting existing functionality.

### Phase 2: Data Models (Weeks 3-6)

```typescript
// Before
interface User { id: string; name: string; }

// After
type User = { readonly id: string; readonly name: string; };
```

What I discovered is that the TypeScript compiler immediately catches mutation attempts—providing instant feedback.

### Phase 3: Extract Capabilities (Weeks 7-12)

```typescript
// Before: Direct dependency
async function createUser(userData: any) {
  const user = { id: crypto.randomUUID(), ...userData };
  await database.save(user);
  return user;
}

// After: Injected dependencies
const createUser = (crypto: Crypto, db: Database) =>
  async (userData: CreateUserData) => {
    const user = { id: crypto.randomUUID(), ...userData };
    return await db.save(user);
  };
```

### Phase 4: Result Types (Weeks 13-24)

```typescript
// Before
function parseConfig(input: string): Config {
  if (!input) throw new Error("Config required");
  return JSON.parse(input);
}

// After
function parseConfig(input: string): Result<Config, ConfigError> {
  if (!input) return err({ type: "required", field: "config" });
  try {
    return ok(JSON.parse(input));
  } catch {
    return err({ type: "invalid_json", field: "config" });
  }
}
```

## Understanding Context and Constraints

As I've explored this approach, I've found that Light FP works best when:

- **Team size**: 3-15 developers (small enough for consistency)
- **Domain**: Backend services, APIs, data processing
- **Type system**: TypeScript with strict mode enabled
- **Timeline**: 3+ month runway for learning curve amortization

I've also discovered it's less suitable for:

- Highly stateful UIs requiring complex client-side state machines
- Teams with strong OOP conventions and tight deadlines
- Codebases with heavy dependency on class-based libraries
- Projects requiring extensive integration with Java/C# class hierarchies

## Implementation Checklist

- [ ] Data defined with `type` and `readonly` properties
- [ ] Capabilities defined with `interface`
- [ ] Fallible operations return `Result<T, E>`
- [ ] Dependencies injected through function parameters
- [ ] Pure functions for business logic
- [ ] Side effects pushed to application boundaries
- [ ] TypeScript strict mode enabled
- [ ] Test coverage ≥80% for pure functions

## Questions Worth Exploring

As I continue investigating this approach, I'm curious about several possibilities:

- Could these patterns enable more reliable refactoring in large TypeScript codebases?
- Might the explicit dependency injection make distributed system testing more tractable?
- Would combining this with property-based testing reveal even more edge cases?
- How might these patterns evolve as TypeScript's type system continues advancing?

What I've come to appreciate is that Light FP reduces complexity through constraint, not abstraction. The patterns themselves are simple—what makes them effective is the discipline of applying them consistently. I found that starting with one new feature, measuring outcomes, and expanding based on evidence produces better results than attempting wholesale rewrites.

The space for exploring lightweight functional patterns in TypeScript remains largely open, which I find exciting as there's significant potential for continued experimentation and learning.
