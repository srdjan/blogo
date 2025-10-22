---
title: Functional TypeScript Without Framework Overhead
date: 2025-10-03
tags: [TypeScript, Functional, Architecture, Research]
excerpt: Investigating functional patterns for TypeScript applications, exploring whether FP benefits can be achieved without full frameworks or complex abstractions.
---

I've been investigating TypeScript applications across different projects, and I keep observing how complexity accumulates through classes, exceptions, and mutable state. What strikes me is how these common patterns create challenges worth examining:

- **Testing complexity**: Mocking complex class hierarchies and managing state across tests
- **Unpredictable errors**: Exceptions thrown from deep in the call stack with no type-level warnings
- **Tight coupling**: Business logic mixed with database calls, HTTP requests, and side effects
- **Mutation tracking**: Objects changing unexpectedly, making debugging difficult

This led me to explore functional programming as a potential solution. While libraries like fp-ts demonstrate thoughtful approaches to FP in TypeScript, I've been curious whether the core benefits could be achieved without framework overhead—using simpler patterns that feel more familiar to TypeScript developers.

## Discovering Core Functional Principles

As I investigated this question, I discovered that functional programming in TypeScript centers on straightforward ideas rather than academic theory:

1. **Pure functions**: Same input always produces same output, no hidden side effects
2. **Explicit errors**: Return types that show exactly what can go wrong
3. **Immutable data**: Values that never change, making code predictable
4. **Composition**: Build complex behavior from simple, reusable pieces

What I found interesting is that these principles can work in TypeScript without requiring frameworks.

## Examining Pure Functions for Predictability

What I've come to appreciate is how pure functions provide a foundation—simple, testable, and explicit:

```typescript
// Pure: Always returns the same result
const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

// Impure: Depends on external state
let taxRate = 0.08;
const calculateTotalWithTax = (items: OrderItem[]): number =>
  calculateTotal(items) * (1 + taxRate); // taxRate could change!
```

What I discovered is that pure functions eliminate complex test setups. No mocking, no database fixtures, no shared state to manage—the function gets called and output gets verified.

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

## Exploring Explicit Error Handling with Result Types

As I dug deeper, I found that TypeScript's type system can tell you exactly what errors to expect. What if we replaced throwing exceptions with Result types?

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Constructor helpers
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

What I found compelling is how function signatures now reveal possible failures:

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

What I discovered is that the compiler now forces handling both success and failure cases—eliminating forgotten try/catch blocks.

## Investigating Logic Separation: The Ports Pattern

As I explored further, I kept wondering: what if business logic didn't need to care about databases, file systems, or HTTP clients? Could we keep the core pure by injecting capabilities?

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

What I found interesting is how testing becomes straightforward with fake implementations:

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

## Discovering Branded Types: Preventing ID Mix-ups

As I investigated TypeScript's type system further, I discovered an interesting challenge: structural typing allows any two values with the same shape to be used interchangeably. This creates a subtle problem with domain primitives like IDs:

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

What strikes me is that the compiler can't tell the difference between a `UserId` and an `AccountId` because they're both just numbers—leading to subtle bugs where IDs get mixed up.

I discovered that **branded types** solve this by creating distinct type identities:

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

### When Might Branded Types Be Useful?

Through my exploration, I've found branded types valuable when identity and semantic meaning matter more than structure:

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

### When Does Structural Typing Make Sense?

I've also found that TypeScript's default structural typing works well when only the shape matters:

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

What I've come to appreciate is how branded types add a powerful safety layer to domain logic while structural typing keeps data handling flexible—both have their place.

## Exploring Immutable Data: Safety Through Types

As I investigated further, I discovered how preventing accidental mutations through readonly data structures changes everything:

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

## Investigating Composition: Building Complex from Simple

What I found interesting is how to chain operations cleanly using utility functions:

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

## Exploring Real-World Application Structure

As I've worked with these patterns, I've found it helpful to organize code to separate pure logic from effects:

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

## Investigating Migration Approaches

### 1. Starting with New Features

What I found works well is applying functional patterns to new code without touching existing systems:

```typescript
// New feature: pure function with Result type
export const calculateDiscount = (
  order: Order,
  promoCode: string
): Result<number, DiscountError> => {
  // ... pure validation and calculation
};
```

### 2. Extracting Pure Logic from Classes

I discovered it's valuable to pull business logic into pure functions:

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

### 3. Replacing Exceptions with Results

What I've found is that converting throwing functions gradually works well:

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

### 4. Introducing Ports for Dependencies

As I explored this further, I found it helpful to identify external dependencies and create interfaces:

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

## What I've Discovered in Practice

As I've explored these patterns, I've observed several interesting benefits:

**Easier Testing**: Pure functions need no setup. Mock objects become simple plain objects implementing port interfaces.

**Fewer Runtime Errors**: Result types force error handling at compile time—eliminating forgotten try/catch blocks.

**Better Code Review**: Function signatures reveal exactly what can happen. No hidden side effects or surprise exceptions.

**Faster Debugging**: Immutable data and pure functions eliminate entire classes of bugs. When something breaks, the problem is isolated and obvious.

**Simpler Onboarding**: Pure functions and Result types are immediately understandable—no need to learn complex class hierarchies or framework-specific patterns.

## Questions Worth Exploring

As I continue investigating this approach, I'm curious about several possibilities:

- Could these lightweight patterns enable more teams to adopt functional benefits without the learning curve of full FP frameworks?
- Might combining pure functions with property-based testing reveal patterns that traditional testing misses?
- Would this approach scale to larger teams and more complex domains?
- How might TypeScript's evolving type system enable even simpler functional patterns in the future?

What I've come to appreciate is that functional TypeScript isn't about learning exotic abstractions—it's about writing code that's easier to test, safer to change, and simpler to understand.

The space for exploring lightweight functional patterns remains largely open, which I find exciting. There's significant potential for continued experimentation with different combinations of these techniques across various application domains.
