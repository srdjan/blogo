---
title: Light Functional Programming Guide for TypeScript Teams
date: 2025-01-15
tags: [TypeScript, Functional, Architecture, Patterns]
excerpt: A practical guide to implementing Light FP patterns in TypeScript - clean, testable code without the complexity of full functional programming frameworks.
---

## The Problem with Complex Codebases

Modern TypeScript applications often suffer from a mixture of object-oriented and functional paradigms that create confusion about data modeling, error handling, and dependency management. Teams struggle with:

- **Mixed metaphors**: Some code uses classes, others use functions
- **Unclear error handling**: Mix of exceptions and return values
- **Tight coupling**: Direct dependencies on external services
- **Mutable state**: Hard to reason about data transformations

The result is code that's difficult to test, maintain, and reason about.

## What is Light Functional Programming?

Light FP provides the benefits of functional programming without the learning curve of complex FP frameworks. It focuses on three core principles:

1. **Model with types first; make illegal states unrepresentable**
2. **Keep the core pure (no I/O); push effects to edges**  
3. **Treat errors as values** (`Result<T,E>`)

This approach gives you 80% of FP benefits with 20% of the complexity.

## The Type System: Types vs Interfaces

The foundation of Light FP is a clear distinction between data and behavior:

### Use `type` for Data Definitions

All data structures should be immutable types with `readonly` properties:

```typescript
// ✅ CORRECT: Data as immutable types
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

export type ApiResponse<T> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };
```

### Use `interface` ONLY for Ports

Interfaces are reserved exclusively for defining behavioral contracts - capabilities your system needs:

```typescript
// ✅ CORRECT: Interfaces for capabilities
export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
}

export interface UserRepository {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (id: string) => Promise<Result<User | null, DatabaseError>>;
}

export interface Logger {
  readonly info: (message: string, data?: unknown) => void;
  readonly error: (message: string, data?: unknown) => void;
}
```

### Anti-Patterns to Avoid

```typescript
// ❌ WRONG: Interface for data
interface UserData {
  id: string;
  name: string;
}

// ❌ WRONG: Mutable properties
export type User = {
  id: string;        // Missing readonly
  name: string;      // Missing readonly
};

// ❌ WRONG: Classes for data
class User {
  constructor(public id: string, public name: string) {}
}
```

## Error Handling with Result Types

Replace exceptions with explicit error handling using Result types:

```typescript
// Core Result type
export type Result<T, E> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Constructor functions
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Domain-specific errors
export type ValidationError = 
  | { readonly type: "required"; readonly field: string }
  | { readonly type: "invalid_email"; readonly field: string }
  | { readonly type: "too_short"; readonly field: string; readonly minLength: number };
```

### Result in Practice

```typescript
// Before: Exception-based
function parseEmail(input: string): string {
  if (!input.includes("@")) {
    throw new Error("Invalid email");
  }
  return input;
}

// After: Result-based
function parseEmail(input: string): Result<string, ValidationError> {
  if (!input.includes("@")) {
    return err({ type: "invalid_email", field: "email" });
  }
  return ok(input);
}
```

## The Ports Pattern: Dependency Injection Done Right

The ports pattern separates business logic from infrastructure concerns through dependency injection:

### Directory Structure

```
src/
  domain/           # Pure business logic
  ports/            # Interface definitions
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

// Use in HTTP handlers
const handleCreateUser = async (request: Request): Promise<Response> => {
  const userData = await request.json();
  const result = await userService.createUser(userData);
  
  return result.ok
    ? Response.json(result.value, { status: 201 })
    : Response.json({ error: result.error }, { status: 400 });
};
```

## Pure Functions and Side Effects

Keep business logic pure and push side effects to application boundaries:

### Pure Core

```typescript
// ✅ CORRECT: Pure business logic
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

### Effectful Edges

```typescript
// ✅ CORRECT: Side effects at boundaries
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

## Testing Made Simple

Light FP makes testing straightforward through pure functions and dependency injection:

### Testing Pure Functions

```typescript
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

Deno.test("calculateOrderTotal - calculates correct total", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];
  
  const total = calculateOrderTotal(items);
  assertEquals(total, 35);
});

Deno.test("validateEmail - rejects invalid email", () => {
  const result = validateEmail("invalid-email");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.type, "invalid_email");
  }
});
```

### Testing with Mock Ports

```typescript
Deno.test("createUser - creates user with correct timestamp", async () => {
  // Arrange: Mock dependencies
  const fixedDate = new Date("2024-01-01T00:00:00Z");
  const mockClock = { 
    now: () => fixedDate, 
    timestamp: () => fixedDate.getTime() 
  };
  const mockCrypto = { randomUUID: () => "test-uuid-123" };
  const mockDb = { save: async (user: User) => ok(user) };

  // Act
  const result = await createUser(mockClock, mockCrypto, mockDb)({
    name: "Test User",
    email: "test@example.com"
  });

  // Assert
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.id, "test-uuid-123");
    assertEquals(result.value.createdAt, fixedDate);
  }
});
```

## Practical Patterns and Utilities

### Smart Constructors for Validated Types

```typescript
export type Email = string & { readonly __brand: "Email" };
export type UserId = string & { readonly __brand: "UserId" };

export const createEmail = (input: string): Result<Email, ValidationError> => {
  if (!input.includes("@")) {
    return err({ type: "invalid_email", field: "email" });
  }
  return ok(input as Email);
};
```

### Result Utility Functions

```typescript
export const map = <T, U, E>(
  result: Result<T, E>, 
  fn: (value: T) => U
): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>, 
  fn: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? fn(result.value) : result;
```

### Pipeline Composition

```typescript
const processUserData = (rawData: unknown) =>
  pipe(rawData)
    .flatMap(parseUserData)
    .flatMap(validateUserData)
    .flatMap(enrichUserData)
    .unwrap();
```

## Migration Strategy

### 1. Start with New Code

Apply Light FP patterns to all new features and modules. This establishes the patterns without disrupting existing functionality.

### 2. Convert Data Models

Replace interface-based data models with readonly types:

```typescript
// Before
interface User { id: string; name: string; }

// After  
type User = { readonly id: string; readonly name: string; };
```

### 3. Extract Capabilities

Identify external dependencies and create port interfaces:

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

### 4. Replace Exceptions with Results

Gradually convert throwing functions to return Result types:

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

## Benefits in Practice

Teams adopting Light FP report:

- **Easier testing**: Pure functions and dependency injection simplify unit tests
- **Better error handling**: Explicit Result types prevent uncaught exceptions
- **Clearer architecture**: Separation between pure domain and effectful edges
- **Improved maintainability**: Immutable data reduces debugging complexity
- **Team onboarding**: Clear patterns make codebase easier to understand

## Code Review Checklist

- [ ] Data defined with `type` and `readonly` properties
- [ ] Capabilities defined with `interface`
- [ ] Fallible operations return `Result<T, E>`
- [ ] Dependencies injected through function parameters
- [ ] Pure functions for business logic
- [ ] Side effects pushed to application boundaries

## Getting Started

1. **Set up your tsconfig.json** with strict settings:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true
     }
   }
   ```

2. **Create your first port interface** for a capability you use
3. **Convert one data model** from interface to readonly type
4. **Replace one throwing function** with a Result-returning function
5. **Write tests** for your pure functions

Light FP isn't about adopting exotic functional programming concepts - it's about applying practical patterns that make TypeScript code more reliable, testable, and maintainable.

Start small, be consistent, and watch your codebase become more robust over time.