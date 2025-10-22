---
title: Structured Concurrency in TypeScript with Effection
date: 2025-07-02
tags: [TypeScript, Concurrency, Effection]
excerpt: Async/await solved callback hell but introduced coordination nightmares. Structured concurrency fixes this—hierarchical operations with automatic cancellation and cleanup. Here's how Effection brings it to TypeScript.
---

Promises and async/await changed JavaScript. Callback hell? Gone. Asynchronous code became readable, maintainable. Huge win. But async/await introduced new problems: operations you can't truly cancel, resources that leak when components unmount, concurrent operations needing manual coordination.

These aren't edge cases. They're structural limitations. Async/await creates independent promises completing in any order, with limited ability to express relationships between operations. So we built elaborate workarounds: AbortController everywhere, complex useEffect cleanup, custom coordination patterns repeated across apps.

Structured concurrency offers a different foundation. Organize concurrent operations into hierarchical relationships where parent operations control child lifecycles automatically. Coordination shifts from application-level patterns to runtime-enforced structure.

## The Problem: Coordination Complexity

Debounced search shows the issue clearly. Common pattern, annoying to implement:

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

Manual request tracking. Explicit cancellation handling. Edge case management. Every coordination need in your app demands rebuilding similar patterns—autocomplete, file uploads, background sync. Gets old fast.

## Structured Concurrency: The Core Idea

Instead of independent asynchronous operations coordinated externally, arrange operations into hierarchical trees. Parent operations control child lifecycles completely. Children can't outlive parents—runtime enforces this automatically.

This structural change transforms behavior. Starting an operation within structured context creates relationships the runtime understands. Cancellation, resource cleanup, error propagation follow the tree structure. No explicit management needed.

[Effection](https://github.com/thefrontside/effection) brings this to TypeScript through generator functions. Works with JavaScript's single-threaded nature, leveraging generators for pauseable, resumable operations. Builds on familiar features instead of requiring new syntax.

## How It Works: Generators

Generator functions provide the foundation. While async/await expresses linear sequences, generators enable operations that pause, resume, and coordinate while maintaining explicit control flow.

Debounced search transforms completely:

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

Look at this. Manual cancellation logic? Gone. The `race` operation expresses coordination declaratively—when one completes, runtime cancels the other automatically. No AbortController, no try/catch for cancellation. Code structure itself expresses behavior.

## Type Safety

Effection integrates with TypeScript through `Operation<T>` type. Type system understands operation relationships, provides inference across generator chains:

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

TypeScript verifies `fetchUserData` returns `Operation<UserData>`. Type inference flows through generator chains naturally. Type safety across complex compositions without manual annotations.

## Resource Management: Context API

Context API enables resource sharing across operations. Integrates directly into hierarchical structure:

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

Context flows down operation tree automatically. Child operations access context from any ancestor. Operations complete or cancel? Context cleanup happens automatically. Database connections, file handles, timers—automatic cleanup when containing operations end.

This solves resource management elegantly. No manual tracking, no cleanup code scattered everywhere.

## Error Handling

Structured concurrency transforms error handling from unpredictable promise bubbling to tree-based propagation. Errors follow predictable paths through operation tree:

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

Try/catch works as expected with guarantee: operations started within try block cancel automatically when errors occur. Eliminates resource leaks from partially completed chains.

## Mental Model Shift

Adopting structured concurrency requires reconceptualizing concurrent operations. Instead of launching independent async operations coordinated externally, compose into trees where structure expresses coordination automatically.

This affects everything. Testing becomes more predictable—operations complete deterministically within structural constraints. Debugging gains clarity through operation trees revealing running and cancelled operations explicitly. Performance improves through automatic resource cleanup.

## Real-World Patterns

Structured concurrency addresses coordination challenges throughout interactive apps:

- **Autocomplete**: Cancel previous searches automatically
- **File uploads**: Abort cleanly when needed
- **Background sync**: Pause appropriately
- **Real-time features**: Establish and tear down connections cleanly

These aren't edge cases. They're fundamental challenges in building responsive, resource-efficient apps. Structured approach provides both specific tools and coherent framework for thinking about coordination systematically.

## The Interesting Part: Bundle Size

4.6kb gzipped. That's it. Structured concurrency represents organizational patterns, not heavyweight framework machinery. Changes how async code organizes instead of adding runtime complexity.

To me is interesting that such powerful coordination capabilities come from relatively simple primitives. Generator functions already exist in JavaScript. Effection just organizes them into structured relationships.

## Broader Context

Structured concurrency moves from academic concepts to mainstream. Java's Project Loom, Swift's structured concurrency—growing recognition of coordination challenges in concurrent programming. JavaScript's single-threaded nature suits structured patterns particularly well.

Effection demonstrates language-level features aren't prerequisites. Building on existing generators, working with JavaScript's strengths creates programming model that enables new coordination patterns.

## Real Talk: Tradeoffs

Structured concurrency isn't free. Learning curve with generators. Different mental model from async/await. Team needs to understand hierarchical operation relationships. Not all libraries work seamlessly with structured operations.

But. Automatic cancellation is huge. Resource cleanup without manual tracking saves debugging hours. Declarative coordination makes code intentions clear. For apps with significant concurrent operations, these benefits compound.

I played with Effection for a side project handling real-time data. The mental model shift took a week. After that? Coordination code became noticeably simpler. No more AbortController everywhere, no cleanup logic scattered across components.

## Bottom Line

Async/await solved callback hell but introduced coordination challenges. Structured concurrency addresses these at fundamental level—operations organized hierarchically, lifecycle management automatic, coordination declarative.

Effection brings this to TypeScript through generators. Works with language features instead of against them. Small bundle size, powerful coordination primitives, type-safe compositions.

Not saying everyone should switch. Async/await works fine for many use cases. But for applications with complex concurrent operations, real-time features, or significant coordination needs? Structured concurrency is worth exploring. The automatic cleanup and declarative coordination alone justify the learning investment.

As applications grow more interactive and real-time, principled concurrency management shifts from nice-to-have to essential. Structured concurrency offers one compelling approach—time will tell how widely it gets adopted, but the ideas solve real problems.
