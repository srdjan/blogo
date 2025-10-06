---
title: Light Functional Programming in TypeScript
date: 2025-01-15
tags: [TypeScript, Functional, Architecture, Patterns]
excerpt: A principled approach to TypeScript development that emphasizes immutability, explicit error handling, and clean dependency management without the complexity of full functional programming frameworks.
---

TypeScript codebases commonly exhibit certain architectural patterns: class-based services with hidden dependencies, exception-driven error handling, and mutable data structures. These patterns create testing complexity, runtime unpredictability, and maintenance challenges as systems evolve.

Light Functional Programming offers an alternative approach grounded in three core principles:

1. **Make invalid states impossible to represent**
2. **Keep business logic pure, push side effects to the edges**
3. **Return errors as values, not surprises**

This approach builds on TypeScript's type system without requiring additional frameworks or libraries.

## The Foundation: Types, Interfaces, and Data Modeling

TypeScript provides two primary mechanisms for defining structure: `type` aliases and `interface` declarations. The distinction between them serves an important architectural purpose.

### Types for Data

Data structures represent information with no behavior attached. They benefit from immutability and explicit structure:

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

The `readonly` modifier prevents unintended mutations. Discriminated unions like `PaymentStatus` make states explicit and exhaustive.

### Interfaces for Capabilities

Capabilities represent behavior that systems need from their dependencies:

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

Interfaces define contracts without specifying implementation. This separation enables testing and evolution.

### Common Patterns to Avoid

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

## Explicit Error Handling with Result Types

Exception-based error handling creates invisible failure paths. Functions that throw don't declare it in their type signatures:

```typescript
// Throws exceptions without type-level indication
function parseConfig(input: string): Config {
  if (!input) throw new Error("Config required");
  return JSON.parse(input);
}

// Caller has no compiler-enforced reminder to handle failures
const config = parseConfig(userInput);
```

Result types make error handling explicit:

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

Result types shift errors from runtime surprises to compile-time requirements.

## The Ports Pattern: Dependency Management

The ports pattern separates business logic from infrastructure through explicit dependency injection. This architectural approach enables testing and evolution without framework complexity.

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

Domain logic operates on interfaces without knowledge of concrete implementations:

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

## Pure Functions and Side Effect Boundaries

Applications require side effects: database operations, HTTP calls, logging, time access. The architectural question is where these effects live.

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

This separation simplifies testing: pure functions require no setup, while effectful boundaries need only simple interface implementations.

## Testing Approach

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

## Smart Constructors for Validated Types

Brand types combine TypeScript's type system with runtime validation:

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

## Migration Strategy

Incremental adoption reduces risk and enables learning:

### Phase 1: New Code (Weeks 1-2)

Apply Light FP patterns to new features. This establishes patterns without disrupting existing functionality.

### Phase 2: Data Models (Weeks 3-6)

```typescript
// Before
interface User { id: string; name: string; }

// After
type User = { readonly id: string; readonly name: string; };
```

TypeScript compiler immediately catches mutation attempts.

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

## Context and Constraints

Light FP works best when:

- **Team size**: 3-15 developers (small enough for consistency)
- **Domain**: Backend services, APIs, data processing
- **Type system**: TypeScript with strict mode enabled
- **Timeline**: 3+ month runway for learning curve amortization

Less suitable for:

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

## Getting Started

1. **Enable strict TypeScript**:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true
     }
   }
   ```

2. **Create first port interface** for existing capability
3. **Convert one data model** from interface to readonly type
4. **Replace one throwing function** with Result-returning function
5. **Measure test complexity** before and after

Light FP reduces complexity through constraint, not abstraction. The patterns are simple. The discipline is what matters. Starting with one new feature, measuring outcomes, and expanding based on evidence produces better results than attempting wholesale rewrites.
