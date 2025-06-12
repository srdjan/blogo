---
title: EffectTS - The Value of Functional Abstractions
date: 2025-06-09
tags: [Functional, Typescript]
excerpt: How Effect-TS helps maximize signal (business requirements) while minimizing noise (technical implementation) through functional abstractions
---

## Demonstrating values of functional programming with Effect-TS

### Scenario: Loading a User Profile

#### Standard Approach (Manual Implementation)

This example shows how a standard approach to loading a user profile can result
in a lot of code noise, making it difficult to focus on the business
requirements.

```typescript
// -------------------- HIGH NOISE (Mixed Technical Concerns) --------------------

type User = { id: number; name: string };

// Manual error handling
const validateResponse = (response: Response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

// Explicit async handling
const fetchUser = async (id: number): Promise<User> => {
  try {
    const response = await fetch(`/users/${id}`);
    const data = await validateResponse(response);
    return data as User;
  } catch (error) {
    console.error("Fetch failed", error);
    throw error;
  }
};

// State management noise
let currentUser: User | null = null;

// Business logic obscured by tech concerns
const loadUserProfile = async (userId: number) => {
  try {
    const user = await fetchUser(userId);
    currentUser = user;
    return user;
  } catch (e) {
    return null;
  }
};
```

#### Effect-TS Approach

```typescript
// -------------------- HIGH SIGNAL (Pure Business Requirements) --------------------

import { Effect, pipe } from "effect";

// 1. Declare business requirements as types
interface User {
  id: number;
  name: string;
}

// 2. Define business operations (pure signal)
const fetchUser = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`/users/${id}`).then((res) => res.json()),
    catch: (e) => new Error(`User ${id} not found`),
  });

const trackUserProfile = (user: User) =>
  Effect.sync(() => console.log(`Loaded: ${user.name}`));

// 3. Compose business logic (minimal noise)
const loadUserProfile = (userId: number) =>
  pipe(
    fetchUser(userId),
    Effect.flatMap(trackUserProfile),
    Effect.catchAll(() => Effect.succeed(null)),
  );
```

### Key Improvements

| **Concern**          | **Low SNR Approach**                | **High SNR (Effect)**        |
| -------------------- | ----------------------------------- | ---------------------------- |
| **Error Handling**   | Manual try/catch blocks             | Built-in error channel       |
| **Async Logic**      | Explicit async/await                | Abstracted via Effect type   |
| **State Management** | Mutable variables (**currentUser**) | Managed safely in pipeline   |
| **Side Effects**     | Direct console.log calls            | Controlled via Effect.sync   |
| **Business Logic**   | Buried in tech concerns             | Primary focus of composition |

### Effect-TS Features That Boost productivity and code clarity

1. **Effect Type as Abstraction**

```typescript
// Technical details hidden inside Effect
const fetchUser = (id: number): Effect.Effect<User, Error> => ...
```

2. **Declarative Error Handling**

```typescript
pipe(
  fetchUser(1),
  Effect.catchTag("NetworkError", () => cachedUser), // Business-level recovery
);
```

3. **Layer Abstraction (Dependency Management)**

```typescript
// Define business capability
interface UserRepository {
  get: (id: number) => Effect.Effect<User, Error>;
}

// Implement without polluting business logic
const UserRepositoryLive = Layer.succeed(
  UserRepository,
  UserRepository.of({ get: fetchUser }),
);

// Usage in pure business logic
const loadUser = (id: number) =>
  Effect.flatMap(UserRepository, (repo) => repo.get(id));
```

4. **Generator-Free Composition**

```typescript
// No generator noise - pure pipeline
const registrationFlow = (user: User) =>
  pipe(
    validateEmail(user),
    Effect.flatMap(sendWelcomeEmail),
    Effect.flatMap(createDashboard),
    Effect.tap(logNewUser),
  );
```

5. **Built-in Observability**

```typescript
// Clean telemetry without cluttering logic
pipe(
  fetchUser(1),
  Effect.withSpan("GetUserProfile"), // Auto-tracing
  Effect.tapResponse({
    onSuccess: (user) => logMetric("user_fetched"),
    onFailure: (error) => logError(error),
  }),
);
```

### Why This Improves Signal/Noise Ratio

1. **Business Logic Isolation**\
   Core requirements exist at the top level of composition

2. **Technical Concerns Encapsulated**\
   Implementation details hidden inside Effects

3. **No Intermediate Variables**\
   Pipeline flow eliminates temporary state

4. **Type-Driven Development**\
   Errors and effects become part of type signatures

5. **Declarative Control Flow**\
   No manual promise chains or try/catch blocks

```typescript
// Final high-SNR business workflow
const onboardingWorkflow = (userId: number) =>
  pipe(
    loadUserProfile(userId),
    Effect.flatMap(createSubscription),
    Effect.flatMap(generateWelcomeKit),
    Effect.tap(sendConfirmationEmail),
    Effect.provideService(EmailService, EmailServiceLive),
  );
```

#### Dreamland

Almost there.

So, the question is, if we would to dream a bit, would we be able to hide even
the last two 'technical' concerns still appearing in the code? Yes, absolutely!
For example, a 'use' instead a 'flatMap' and 'do' instead 'tap' are much
better - they're natural, intuitive, and express intent clearly. We will also
remove 'Effect.' from the beginning of each line, just because...

With 'use' and 'do', we would have:

```typescript
const onboardingWorkflow = (userId: number) =>
  pipe(
    loadUserProfile(userId),
    use(createSubscription),        // use the profile to create subscription
    use(generateWelcomeKit),        // use the subscription to generate kit
    do(sendConfirmationEmail),      // do this action (side effect)
    provideService(EmailService, EmailServiceLive),
  );
```

Here is why this works so well:

**use() = Transform/Chain**

- Natural language: "use the profile to create subscription"
- Clear intent: The result flows forward and gets transformed
- Intuitive: Everyone understands "use X to do Y"

**do() = Side Effect**

- Natural language: "do send confirmation email"
- Clear intent: Perform action without changing the main flow
- Imperative feel: Matches how we think about actions

**Comparison:**

```typescript
// Technical (current)
Effect.flatMap(createSubscription); // What's flatMap? 🤔
Effect.tap(sendConfirmationEmail); // What's tap? 🤔
```

```typescript
// Business-friendly
use(createSubscription)               // Clear! ✅
do(sendConfirmationEmail)             // Obvious! ✅
```

**Even Better:**

```typescript
// Combined with Verbs
const onboardingWorkflow = (userId: number) =>
  pipe(
    loadUserProfile(userId),
    use(CreateSubscription),        // use profile to create subscription  
    use(GenerateWelcomeKit),        // use subscription to generate kit
    do(sendConfirmationEmail),      // do send email
    with(EmailServiceLive),         // with email service
  );
```

So, 'use' and 'do' perfectly capture the two fundamental operations in any
workflow:

- **Transform data** (use)
- **Perform actions** (do)

This would make functional programming much more accessible to business
stakeholders and new developers!

### Conclusion

Effect-TS is a powerful tool for maximizing signal-to-noise ratio in software
development with TypeScript. This post demonstrates how Effect-TS transforms
TypeScript into a "business requirements DSL" where technical concerns become
implementation details rather than cognitive obstacles.
