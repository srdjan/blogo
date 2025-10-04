---
title: Structured Concurrency in TypeScript with Effection
date: 2025-07-02
tags: [TypeScript, Concurrency, Effection]
excerpt: How structured concurrency addresses the coordination challenges that async/await leaves unresolved in TypeScript applications.
---

## The Coordination Problem in Async TypeScript

Promises and async/await solved asynchronous code readability. But they introduced a different challenge: once an async operation starts, it can't be truly canceled. The result can be ignored when it arrives, but the operation continues running, consuming resources and potentially causing side effects.

This pattern appears frequently in TypeScript applications. Components unmount while API calls remain in flight. Users navigate away from pages while data fetching continues in the background. Development teams build elaborate cleanup mechanisms, wield AbortController with varying success, and write useEffect cleanup functions that resemble incantations more than engineering.

The deeper issue centers on structure. Concurrent code written with async/await creates a flat network of promises that complete in any order, with limited ability to express relationships between them. Managing this complexity happens at the application level, requiring custom coordination logic each time operations need to work together.

## A Common Pattern

A typical debounced search implementation illustrates the coordination challenge:

```typescript
async function searchWithDebounce(query: string) {
  if (currentRequest) {
    currentRequest.abort();
  }
  
  currentRequest = new AbortController();
  
  try {
    const result = await fetch(`/search?q=${query}`, {
      signal: currentRequest.signal
    });
    return await result.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      // Handle cancellation
      return null;
    }
    throw error;
  }
}
```

This approach requires manual request tracking, explicit cancellation handling, and managing edge cases when operations can be interrupted. Each instance of coordination demands rebuilding these patterns.

## Structured Concurrency's Alternative

Structured concurrency organizes operations differently. Instead of treating promises as independent entities coordinated from outside, it arranges operations into a tree where parent operations maintain complete control over their children. Child operations cannot outlive their parents.

This represents more than organizational preference—it fundamentally changes how concurrent code operates. Starting an operation within a structured context creates a relationship the runtime understands and enforces, rather than launching a promise without guarantees.

[Effection](https://github.com/thefrontside/effection) implements this model in TypeScript through generator functions. It works with JavaScript's single-threaded nature, using generators to create pauseable, resumable operations that compose and coordinate with precision.

## Generator Functions Revisited

Generator functions, which may seem like pre-async/await relics, become powerful tools for expressing structured operations in Effection. While async/await provides linear sequences of asynchronous steps, generators enable pausing, resuming, and coordinating multiple concurrent operations.

The search example transforms with Effection:

```typescript
import { main, race, sleep } from 'effection';

function* searchWithDebounce(query: string): Operation<SearchResult> {
  return yield* race([
    search(query),
    function* () {
      yield* sleep(300); // Debounce delay
      return undefined; // Return nothing if debounce wins
    }
  ]);
}

function* search(query: string): Operation<SearchResult> {
  const response = yield* fetch(`/search?q=${query}`);
  return yield* response.json();
}
```

The cancellation logic disappears. Coordination expresses itself declaratively through the `race` operation, which automatically cancels the losing operation when the winner completes. Manual AbortController management and try/catch blocks for cancellation handling become unnecessary—the code structure itself expresses the intended behavior.

## TypeScript Integration

Effection 3.0's design centers on TypeScript compatibility. The core `Operation<T>` type represents any operation that can be yielded from a generator function. The type system understands these relationships and provides modern TypeScript inference.

```typescript
import type { Operation } from "effection";

function* fetchUserData(userId: string): Operation<UserData> {
  const user = yield* fetchUser(userId);
  const preferences = yield* fetchPreferences(user.id);

  return {
    ...user,
    preferences
  };
}
```

TypeScript recognizes that `fetchUserData` returns an `Operation<UserData>`. Type mismatches in `fetchUser` produce compile-time errors. Type inference flows through the generator chain naturally, without the gymnastics sometimes required with complex promise chains.

## Context API for Resource Management

Effection 3.0's Context API provides structured data and resource sharing across operations. Rather than dependency injection added as an afterthought, context integrates into how operations relate to each other.

```typescript
import { createContext, provide, useContext } from 'effection';

const DatabaseContext = createContext<Database>('database');

function* withDatabase<T>(db: Database, operation: Operation<T>): Operation<T> {
  return yield* provide(DatabaseContext, db, operation);
}

function* saveUser(userData: UserData): Operation<User> {
  const db = yield* useContext(DatabaseContext);
  return yield* db.save(userData);
}
```

Context flows down the operation tree automatically. Child operations access any context provided by ancestors. When an operation completes or cancels, its context cleans up automatically. This addresses a common resource management problem in TypeScript applications—database connections, file handles, timers, and other resources clean up automatically when their containing operation ends.

## Rethinking Async Patterns

Effection reframes familiar asynchronous concepts. The library's "Async Rosetta Stone" provides structured equivalents for known async patterns. These aren't simple drop-in replacements—they've been rethought to work within a structured system.

Error handling demonstrates this difference. With promises, errors bubble up through chains until caught or escaping as unhandled rejections. With structured concurrency, errors propagate through the operation tree predictably, with error boundaries containing failures within specific subtrees.

```typescript
function* robustOperation(): Operation<Result> {
  try {
    return yield* riskyOperation();
  } catch (error) {
    // Error handling with full context
    yield* logError(error);
    return yield* fallbackOperation();
  }
}
```

Try/catch behaves as expected, with the added guarantee that operations started within the try block cancel properly if an error occurs.

## A Different Mental Model

Effection requires adjusting how developers think about concurrency. Instead of launching independent async operations and coordinating them externally, operations compose into trees where structure itself expresses coordination logic.

This shift creates broader implications. Structured concurrency makes testing more predictable—operations complete deterministically. Debugging becomes clearer—the operation tree reveals exactly what's running and what's been cancelled. Performance becomes more manageable—resources clean up automatically when operations complete.

## Application Patterns

This approach applies to common application challenges: autocomplete components that need to cancel previous searches, abortable file uploads, background sync processes that pause when apps go background, and real-time features that establish and tear down connections cleanly.

These patterns represent core challenges in building responsive, resource-efficient applications rather than edge cases. Effection provides both tools for handling these challenges and a framework for thinking about them systematically.

The library's relevance grows as applications become more real-time and interactive. When every user action might trigger multiple concurrent operations, having principled coordination and cancellation mechanisms becomes essential. The structure Effection provides scales from simple operations to complex, multi-stage processes without rebuilding coordination logic each time.

## Industry Adoption Patterns

Structured concurrency extends beyond academic concepts into mainstream languages. Java implements Project Loom, Swift builds structured concurrency into the language, and other ecosystems explore similar approaches. JavaScript's single-threaded nature and event-driven architecture suit structured concurrency patterns well.

Effection demonstrates that language-level changes aren't required to benefit from structured concurrency. By building on generators and embracing JavaScript's strengths, it creates a programming model that feels both familiar and transformative.

The 4.6kb gzipped bundle size shows that structured concurrency doesn't require heavyweight frameworks or complex runtime machinery. It represents a different way of organizing async code, with tooling that fades into the background once patterns become internalized.

## What This Means for TypeScript Development

For TypeScript developers comfortable with async/await, Effection represents both evolution and return to fundamentals. It evolves by solving coordination and resource management problems that async/await leaves unaddressed. It returns to fundamentals by making the structure and lifecycle of concurrent operations explicit and manageable.

Structured concurrency is already influencing how asynchronous TypeScript gets written. The question becomes whether teams adopt it proactively or discover it while solving coordination problems in increasingly complex applications.

Effection shows what structured concurrency looks like in practice: not a replacement for async programming knowledge, but a better foundation for building responsive, resource-efficient applications that handle concurrent operation complexity robustly.

Generator functions may feel unfamiliar initially, but the concepts they enable—structured operations, automatic resource cleanup, declarative coordination—address real problems that TypeScript developers encounter regularly.
