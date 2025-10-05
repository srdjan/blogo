---
title: Why I Stopped Writing Classes and Started Sleeping Better
date: 2025-01-15
tags: [TypeScript, Functional, Architecture, Patterns]
excerpt: After three years of debugging TypeScript codebases that mixed classes, exceptions, and global state, I found a simpler way. Here's what worked.
---

I've spent the last five years reviewing TypeScript code for teams migrating from JavaScript. The same problems show up everywhere: a `UserService` class that imports a `DatabaseConnection` singleton, methods that sometimes throw exceptions and sometimes return null, and test files full of complex mocking setup that breaks every time someone adds a dependency.

The last team I worked with had a bug that took two days to track down. A function deep in their authentication flow was mutating a user object that got cached upstream. The cache never expired. Users were seeing each other's permissions. The fix was one word: `readonly`.

Here's the thing about functional programming - most developers hear "FP" and think they need to learn monads, category theory, and a bunch of operators that look like line noise. They're not wrong to be skeptical. I've seen teams try to adopt full FP and give up after two weeks because nobody could read the code anymore.

But there's a middle path. I call it Light FP, and it's just three ideas applied consistently:

1. **Make invalid states impossible to represent**
2. **Keep your business logic pure, push side effects to the edges**
3. **Return errors as values, not surprises**

That's it. No fancy libraries. No PhD required. Just TypeScript used well.

## The Interface Trap (And How to Escape It)

Let me show you the mistake I see most often:

```typescript
// This looks professional. It's also wrong.
interface User {
  id: string;
  name: string;
  email: string;
}

class UserService {
  constructor(private db: DatabaseConnection) {}

  async createUser(user: User): Promise<User> {
    // Surprise! This function can throw
    if (!user.email.includes("@")) {
      throw new Error("Invalid email");
    }
    return await this.db.save(user);
  }
}
```

What's wrong with this? Let me count the ways:

**The data type lies about mutability.** That `User` interface? Nothing stops someone from doing `user.name = "hacked"` deep in a function somewhere. You'll spend hours debugging why user data is corrupted when the problem is that you never said it *shouldn't* change.

**The class hides dependencies.** To test `createUser`, you need to mock `DatabaseConnection`. But what if `DatabaseConnection` depends on something else? Now you're mocking mocks. I've seen test files longer than the code they test.

**The error handling is invisible.** That `throw new Error()` is a trap waiting to happen. Your type signature says "this returns a Promise of User." It doesn't mention that it might explode. The compiler can't help you remember to catch it.

Here's what I do instead:

```typescript
// Data is just data - immutable, clear, simple
export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
};

// Capabilities are interfaces - but ONLY capabilities
export interface Database {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (id: string) => Promise<Result<User | null, DatabaseError>>;
}

export interface Clock {
  readonly now: () => Date;
}

// Business logic is a pure function with dependencies injected
export const createUser =
  (db: Database, clock: Clock) =>
  async (data: CreateUserData): Promise<Result<User, CreateUserError>> => {
    // Validation is explicit
    if (!data.email.includes("@")) {
      return err({ type: "invalid_email", field: "email" });
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: clock.now(),
    };

    return await db.save(user);
  };
```

Look at what changed:

The `User` type is now genuinely immutable. TypeScript will yell at you if you try to mutate it. The dependencies are right there in the function signature - no hidden surprises. And the function *cannot* throw an exception. The type system forces you to handle both success and failure.

This isn't theoretical. I refactored a payment processing system using this approach. Before: 47 test files with complex mocking, random production crashes from unhandled exceptions. After: tests that are just "call function with input, assert output matches," zero unhandled exceptions in six months.

## Wait, What's a Result Type?

If you're coming from exception-based code, Result types feel weird at first. You're probably thinking "why not just use try/catch?"

Because try/catch is invisible.

Look at this:

```typescript
function parseConfig(input: string): Config {
  return JSON.parse(input);
}

// Somewhere else in your code...
const config = parseConfig(userInput);
// Did this succeed? Did it throw? Who knows!
```

Now look at this:

```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function parseConfig(input: string): Result<Config, ConfigError> {
  try {
    return ok(JSON.parse(input));
  } catch {
    return err({ type: "invalid_json", field: "config" });
  }
}

// Somewhere else in your code...
const result = parseConfig(userInput);
if (result.ok) {
  // TypeScript knows result.value is Config
  console.log(result.value);
} else {
  // TypeScript knows result.error is ConfigError
  console.error(result.error.type);
}
```

The second version forces you to think about failure. The type system won't let you forget. Your coworker reviewing your PR will see immediately that you need to handle the error case.

I used to think this was verbose. Then I spent a Friday night debugging a production issue where a JSON.parse() five layers deep in a service was throwing, getting caught by an Express error handler, and returning a generic 500 to users. The error? Someone sent a request with a trailing comma. We had no idea where it was failing.

Result types make errors boring and predictable. Boring is good at 11 PM when your pager goes off.

## The Ports Pattern: Dependency Injection Without the Framework

Here's the dirty secret about dependency injection frameworks: you don't need them.

I worked on a NestJS codebase once. Beautiful dependency injection, decorators everywhere, very enterprise. It was also impossible to understand where anything came from. Want to test a service? Better understand the entire DI container setup. Want to trace a bug? Better understand which module provides which dependency and in what scope.

The ports pattern is simpler. It's just: pass the things you need as arguments.

```typescript
// src/ports/database.ts
export interface Database {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (id: string) => Promise<Result<User | null, DatabaseError>>;
}

// src/adapters/sqlite-database.ts
export const createSqliteDatabase = (path: string): Database => {
  const db = new SQLite(path);

  return {
    save: async (user) => {
      try {
        await db.execute("INSERT INTO users ...", user);
        return ok(user);
      } catch (e) {
        return err({ type: "database_error", cause: e });
      }
    },

    findById: async (id) => {
      // ... implementation
    },
  };
};

// src/adapters/postgres-database.ts
export const createPostgresDatabase = (connString: string): Database => {
  // Different implementation, same interface
};
```

Now your domain logic just works with the `Database` interface. It doesn't know if it's SQLite, Postgres, or a Map in memory. Testing becomes trivial:

```typescript
Deno.test("createUser - saves to database", async () => {
  // No mocking framework needed
  const fakeDb: Database = {
    save: async (user) => ok(user),
    findById: async (id) => ok(null),
  };

  const result = await createUser(fakeDb, fixedClock)({
    name: "Test",
    email: "test@example.com"
  });

  assertEquals(result.ok, true);
});
```

The first time I showed this to a team, one developer said "wait, that's it? We don't need to install anything?" Exactly. It's just functions and interfaces.

## Pure Functions and Where to Put the Mess

Every application has messy parts: reading environment variables, making HTTP calls, writing to databases, getting the current time. The trick is knowing where the mess lives.

I think of applications as having a pure core and a messy shell:

**Pure core** (domain logic):
- No I/O
- No randomness
- No global state
- Just data in, data out

**Messy shell** (application boundary):
- HTTP handlers
- Database calls
- Logging
- Current time
- Random IDs

When you structure code this way, testing becomes dramatically simpler. The pure core needs no mocks, no setup, no teardown. Just call the function and assert the output.

Here's a real example from a project I worked on:

```typescript
// ✅ Pure core - easy to test, easy to understand
export const calculateOrderTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

export const canUserAccessOrder = (user: User, order: Order): boolean =>
  user.role === "admin" || order.userId === user.id;

export const validateOrderData = (data: unknown): Result<OrderData, ValidationError> => {
  // Validation logic - pure, no side effects
};

// Messy shell - side effects isolated at the edge
export const createOrderHandler =
  (logger: Logger, db: Database, emailService: EmailService) =>
  async (request: Request): Promise<Response> => {
    try {
      // Parse (I/O)
      const orderData = await request.json();

      // Validate (pure)
      const validation = validateOrderData(orderData);
      if (!validation.ok) {
        return Response.json({ error: validation.error }, { status: 400 });
      }

      // Calculate (pure)
      const total = calculateOrderTotal(validation.value.items);

      // Save (I/O)
      const saveResult = await db.saveOrder({ ...validation.value, total });
      if (!saveResult.ok) {
        logger.error("Failed to save", saveResult.error);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }

      // Notify (I/O)
      await emailService.send(saveResult.value);

      return Response.json(saveResult.value, { status: 201 });
    } catch (error) {
      logger.error("Unhandled error", error);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
```

The pure functions? Tested in milliseconds with no setup. The handler? Tested with fake implementations of the interfaces, or with integration tests if you want to verify the whole flow.

## When I Actually Use Interfaces

I spent my first year doing Light FP thinking "interfaces are bad, types are good." That's not quite right.

Use `type` for data. Use `interface` for capabilities.

```typescript
// ❌ Wrong: Interface for data
interface User {
  id: string;
  name: string;
}

// ✅ Right: Type for data
type User = {
  readonly id: string;
  readonly name: string;
};

// ✅ Right: Interface for capabilities
interface UserRepository {
  readonly save: (user: User) => Promise<Result<User, DatabaseError>>;
  readonly findById: (id: string) => Promise<Result<User | null, DatabaseError>>;
}
```

Why? Because TypeScript treats interfaces and types differently. Interfaces can be extended and implemented by classes. Types are closed. For data, you want closed - no surprises. For capabilities, you want the flexibility to swap implementations.

Also, when TypeScript gives you an error about an interface mismatch, it shows you the interface name. When it gives you an error about a type mismatch, it shows you the whole structure. For a three-property object that's fine. For a capability with ten methods, the interface name is way more readable.

## Testing Without the Pain

The best part about Light FP is how boring testing becomes.

Before, tests looked like this:

```typescript
describe("UserService", () => {
  let service: UserService;
  let mockDb: jest.Mocked<Database>;
  let mockLogger: jest.Mocked<Logger>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockDb = {
      save: jest.fn(),
      findById: jest.fn(),
      // ... 10 more mocked methods
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      // ...
    };
    // More setup...
    service = new UserService(mockDb, mockLogger, mockEmailService);
  });

  // Finally, the actual test
  it("creates a user", async () => {
    mockDb.save.mockResolvedValue({ id: "123" });
    // ...
  });
});
```

Now they look like this:

```typescript
Deno.test("createUser - returns user with generated ID", async () => {
  const fakeDb = {
    save: async (user: User) => ok(user),
    findById: async (id: string) => ok(null),
  };
  const fakeClock = { now: () => new Date("2024-01-01") };

  const result = await createUser(fakeDb, fakeClock)({
    name: "Alice",
    email: "alice@example.com"
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.name, "Alice");
  }
});
```

No mocking framework. No setup function. No beforeEach. Just: call function, assert output.

For pure functions it's even simpler:

```typescript
Deno.test("calculateTotal - sums item prices", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];

  assertEquals(calculateOrderTotal(items), 35);
});
```

I showed this to a team that had a 200-line test setup file for their services. They were skeptical. One week later, their new feature had 50 lines of business logic and 30 lines of tests. The tests run in 12 milliseconds. They're believers now.

## How to Actually Adopt This (Without Rewriting Everything)

When I join a team, I don't say "we're rewriting everything in Light FP." That's how you get fired.

Here's what actually works:

**Week 1: Start with new code**
- New feature? Write it Light FP style
- Get code reviews from the team
- Point out: "Hey, this test was easy to write"

**Week 2-4: Extract capabilities**
- Find a class with a bunch of dependencies
- Create interface for each dependency
- Change from `constructor(private db: Database)` to function parameter
- Tests get easier to write

**Month 2-3: Convert data models**
- Find an interface used only for data
- Change to `type` with `readonly` properties
- Fix the compiler errors
- Notice the bugs you just caught

**Month 4+: Replace exceptions with Results**
- One function at a time
- Start with the ones that throw the most
- Gradually work inward

I led this migration for a team last year. Six months in, they had a mix: new code was Light FP, old code was still classes and exceptions. That's fine. The new code was easier to test, easier to review, and had fewer bugs. The old code gradually got refactored as people touched it.

No big bang rewrite. No six-week project. Just better patterns applied consistently to new code.

## The Checklist I Use for Code Reviews

When reviewing TypeScript PRs, I look for:

- [ ] **Data uses `type` with `readonly` properties**
      If I see `interface User`, I ask why it's not a type

- [ ] **Capabilities use `interface`**
      If I see `type Database = { save: ... }`, I suggest an interface

- [ ] **Functions that can fail return `Result<T, E>`**
      If I see a function that throws, I ask if it should return Result instead

- [ ] **Dependencies are injected as parameters**
      If I see `new Database()` inside a function, I suggest injection

- [ ] **Business logic is pure functions**
      If I see I/O mixed with business logic, I suggest separating them

- [ ] **Side effects are at the edges**
      Database calls, logging, HTTP - should be in handlers, not domain logic

It's not about being dogmatic. It's about asking "could this be simpler?"

## What This Actually Buys You

After three years of writing TypeScript this way, here's what changed:

**Testing is boring.** I mean that in the best way. No complex setup. No fighting with mocks. Just call function, assert output. Fast tests, clear assertions.

**Debugging is faster.** Pure functions are deterministic. Same input, same output. No hidden state, no mysterious side effects. When something breaks, you know exactly where to look.

**Onboarding is easier.** New developers ask "where does this value come from?" The answer is always "it's passed as a parameter." There's no global state to understand, no dependency injection container to decipher.

**Refactoring is safe.** Immutable data means you can change code without fear. The compiler catches breaking changes. If it compiles, it usually works.

**Production is quieter.** Explicit error handling means fewer surprises. No uncaught exceptions. No mysterious crashes. Errors are values you handle explicitly.

I'm not saying this solves every problem. Complex UIs still need state management. Performance-critical code might need different tradeoffs. Third-party libraries might not follow these patterns.

But for most backend TypeScript, most data processing, most business logic? This approach makes code simpler, safer, and more maintainable.

## Start Small

You don't need to do all of this at once. Pick one thing:

1. **Next time you create a data type, make it `readonly`**
   See what the compiler catches

2. **Next time you write a function that throws, return `Result` instead**
   See how it forces you to handle errors

3. **Next time you test a service, try injecting dependencies**
   See how much simpler the test becomes

4. **Next time you write business logic, keep it pure**
   See how easy it is to test

Start with one. Get comfortable. Add another. Six months from now, look back at your code and notice how much simpler it got.

That's what worked for me, anyway. Your mileage may vary, but I bet you'll sleep better when your type system catches bugs before production does.
