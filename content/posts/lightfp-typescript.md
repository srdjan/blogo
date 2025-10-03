---
title: Functional TypeScript Without the Framework Overhead
date: 2025-10-03
tags: [TypeScript, Functional, Architecture]
excerpt: Build more reliable TypeScript applications using functional patterns - without the complexity of full FP frameworks or exotic abstractions.
---

TypeScript applications often become tangled messes of classes, exceptions, and mutable state. Teams struggle with code that's hard to test, difficult to reason about, and painful to maintain. The typical approach leads to:

- **Testing nightmares**: Mocking complex class hierarchies and managing state across tests
- **Unpredictable errors**: Exceptions thrown from deep in the call stack with no type-level warnings
- **Tight coupling**: Business logic mixed with database calls, HTTP requests, and side effects
- **Mutation chaos**: Objects changing unexpectedly, making debugging a detective investigation

The functional programming world offers solutions, but libraries like fp-ts come with steep learning curves and concepts that feel alien to most TypeScript developers.

What if you could get the reliability benefits of functional programming without the framework overhead?

## The Functional Approach: Simpler Than You Think

Functional programming doesn't require monads, functors, or category theory. The core ideas are straightforward:

1. **Pure functions**: Same input always produces same output, no hidden side effects
2. **Explicit errors**: Return types that show exactly what can go wrong
3. **Immutable data**: Values that never change, making code predictable
4. **Composition**: Build complex behavior from simple, reusable pieces

These principles work perfectly in TypeScript without any frameworks.

## Pure Functions: Predictability by Design

Pure functions are the foundation. They're simple, testable, and easy to understand:

```typescript
// Pure: Always returns the same result
const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

// Impure: Depends on external state
let taxRate = 0.08;
const calculateTotalWithTax = (items: OrderItem[]): number =>
  calculateTotal(items) * (1 + taxRate); // taxRate could change!
```

Why does this matter? Pure functions don't need complex test setups. No mocking, no database fixtures, no shared state to manage. Just call the function and verify the output.

```typescript
// Testing pure functions is trivial
Deno.test("calculateTotal - sums item prices", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ];
  assertEquals(calculateTotal(items), 35);
});
```

## Explicit Error Handling with Result Types

TypeScript's type system can tell you exactly what errors to expect. Replace throwing exceptions with Result types:

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Constructor helpers
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Now function signatures reveal possible failures:

```typescript
type ValidationError =
  | { type: "invalid_email"; field: string }
  | { type: "required"; field: string };

// Before: Silent failure waiting to happen
function parseEmail(input: string): string {
  if (!input.includes("@")) {
    throw new Error("Invalid email"); // Caller has no idea this can throw
  }
  return input;
}

// After: Errors in the type signature
function parseEmail(input: string): Result<string, ValidationError> {
  if (!input.includes("@")) {
    return err({ type: "invalid_email", field: "email" });
  }
  return ok(input);
}
```

The compiler now forces you to handle both success and failure cases. No more forgotten try/catch blocks.

## Separating Logic from Effects: The Ports Pattern

Business logic shouldn't care about databases, file systems, or HTTP clients. Keep the core pure by injecting capabilities:

```typescript
// Port: What your code needs, not how it works
interface Clock {
  readonly now: () => Date;
}

interface Crypto {
  readonly randomUUID: () => string;
}

interface Database {
  readonly save: <T>(key: string, value: T) => Promise<Result<T, DatabaseError>>;
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

Testing becomes straightforward with fake implementations:

```typescript
Deno.test("createUser - assigns correct timestamp", async () => {
  const fixedDate = new Date("2024-01-01");
  const mockClock = { now: () => fixedDate };
  const mockCrypto = { randomUUID: () => "test-id-123" };
  const mockDb = { save: async (k: string, v: any) => ok(v) };

  const result = await createUser(mockClock, mockCrypto, mockDb)({
    name: "Alice",
    email: "alice@example.com"
  });

  assertEquals(result.ok && result.value.createdAt, fixedDate);
});
```

## Branded Types: Preventing ID Mix-ups

TypeScript's structural typing allows any two values with the same shape to be used interchangeably. This creates a dangerous problem with domain primitives like IDs:

```typescript
// Dangerous: Both are just numbers
type UserId = number;
type AccountId = number;

const getUserBalance = (accountId: AccountId): number => {
  // Fetch balance for account...
  return 100;
};

const userId: UserId = 123;
const balance = getUserBalance(userId); // TypeScript allows this bug!
```

The compiler can't tell the difference between a `UserId` and an `AccountId` because they're both just numbers. This leads to subtle bugs where IDs get mixed up.

**Branded types** solve this by creating distinct type identities:

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

### When to Use Branded Types

Use branded types when identity and semantic meaning matter more than structure:

**Essential for domain IDs**: `UserId`, `ProductId`, `OrderId`, `SessionId` - prevent accidental ID swaps

**Critical for units**: `Meters`, `Feet`, `Usd`, `Eur` - prevent unit confusion

**Enforcing invariants**: `PositiveInteger`, `ValidEmail`, `NonEmptyString` - guarantee validation

```typescript
type PositiveInteger = number & { readonly _brand: unique symbol };

const createPositiveInteger = (n: number): Result<PositiveInteger, ValidationError> => {
  if (n <= 0) {
    return err({ type: "not_positive", field: "value" });
  }
  return ok(n as PositiveInteger);
};

// Now any function accepting PositiveInteger knows it's validated
const processQuantity = (qty: PositiveInteger): number => {
  // No need to check if qty > 0, it's guaranteed!
  return qty * 2;
};
```

### When to Use Structural Typing (Default)

Use TypeScript's default structural typing when only the shape matters:

**Data from external sources**: API responses, database records, JSON files

**Flexible APIs**: Functions that work with any object having certain properties

**Configuration objects**: When properties define the concept, not identity

```typescript
// Structural typing is perfect here
interface Point {
  x: number;
  y: number;
}

const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Any object with x and y works
distance({ x: 0, y: 0 }, { x: 3, y: 4 }); // Returns 5
```

### Decision Guide

| Question | Recommendation |
|----------|---------------|
| Could mixing two values cause a logic bug? | Use branded types |
| Are you modeling distinct business concepts? | Use branded types |
| Is the data from an external API/database? | Use structural typing |
| Do you want flexible functions working with any matching shape? | Use structural typing |
| Is the concept defined by its properties, not identity? | Use structural typing |

Branded types add a powerful safety layer to domain logic while structural typing keeps data handling flexible. Use both strategically.

## Immutable Data: Safety Through Types

Prevent accidental mutations by making data structures readonly:

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

## Composition: Building Complex from Simple

Chain operations cleanly using utility functions:

```typescript
// Utility to transform successful results
const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

// Utility to chain operations that can fail
const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? fn(result.value) : result;

// Compose a validation pipeline
const processUserInput = (input: unknown): Result<User, ValidationError> =>
  flatMap(
    parseUserData(input),
    data => flatMap(
      validateEmail(data.email),
      email => flatMap(
        validateName(data.name),
        name => ok({ ...data, email, name })
      )
    )
  );
```

## Real-World Application Structure

Organize code to separate pure logic from effects:

```
src/
  domain/           # Pure business logic, no I/O
    user.ts
    order.ts
  ports/           # Interface definitions
    clock.ts
    database.ts
    email.ts
  adapters/        # Implementations
    deno-clock.ts
    sqlite-db.ts
    smtp-email.ts
  http/           # HTTP layer
    handlers.ts
    middleware.ts
  app/            # Composition
    main.ts
```

## Practical Migration Path

### 1. Start with New Features

Apply functional patterns to new code without touching existing systems:

```typescript
// New feature: pure function with Result type
export const calculateDiscount = (
  order: Order,
  promoCode: string
): Result<number, DiscountError> => {
  // ... pure validation and calculation
};
```

### 2. Extract Pure Logic from Classes

Pull business logic into pure functions:

```typescript
// Before: Logic trapped in a class
class OrderService {
  calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

// After: Pure function anyone can use
export const calculateOrderTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);
```

### 3. Replace Exceptions with Results

Convert throwing functions gradually:

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

### 4. Introduce Ports for Dependencies

Identify external dependencies and create interfaces:

```typescript
// Before: Direct coupling
async function sendEmail(user: User) {
  await nodemailer.send({ to: user.email, ... });
}

// After: Port interface
interface EmailService {
  readonly send: (to: string, subject: string, body: string) => Promise<Result<void, EmailError>>;
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

## The Benefits in Practice

Teams adopting functional patterns report:

**Easier Testing**: Pure functions need no setup. Mock objects become simple plain objects implementing port interfaces.

**Fewer Runtime Errors**: Result types force error handling at compile time. No more forgotten try/catch blocks causing production crashes.

**Better Code Review**: Function signatures reveal exactly what can happen. No hidden side effects or surprise exceptions.

**Faster Debugging**: Immutable data and pure functions eliminate entire classes of bugs. When something breaks, the problem is isolated and obvious.

**Simpler Onboarding**: New developers understand pure functions and Result types immediately. No need to learn complex class hierarchies or framework-specific patterns.

## Getting Started Today

1. **Write your next function as pure**: No side effects, just input → output
2. **Use Result types for fallible operations**: Make errors explicit in signatures
3. **Make one data type readonly**: Experience the safety of immutability
4. **Extract one dependency into a port**: See how easy testing becomes

Functional TypeScript isn't about learning exotic abstractions. It's about writing code that's easier to test, safer to change, and simpler to understand.

Start with one function, one Result type, one readonly interface. Build from there. Your future self will thank you.
