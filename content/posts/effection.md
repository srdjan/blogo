---
title: Rethinking Concurrency with Effection
date: 2025-07-02
tags: [TypeScript, Concurrency, Effection]
excerpt: Exploring structured concurrency in TypeScript through Effection, and how it addresses the coordination challenges that async/await leaves unresolved.
---

## Rethinking Concurrency: How Effection Brings Structure to TypeScript's Async Chaos

I've been thinking about promises lately. Not the kind you make to yourself about writing better documentation, but the JavaScript kind that have become so fundamental to modern TypeScript development that we rarely question their design choices.

Here's the thing: promises and async/await solved one problem brilliantly—they made asynchronous code readable. But they created another problem that we've learned to live with, like a persistent ache you ignore until someone points it out. Once you start an async operation, you can't really take it back. Sure, you can ignore the result when it eventually arrives, but that operation keeps running, consuming resources, potentially causing side effects.

This isn't a theoretical concern. Every TypeScript developer has written code where a component unmounts while an API call is still in flight, or where a user navigates away from a page but the previous route's data fetching continues in the background. We've built elaborate cleanup mechanisms, wielded AbortController with varying degrees of success, and written countless useEffect cleanup functions that feel more like incantations than engineering.

## The Shape of the Problem

The deeper issue isn't really about cleanup—it's about structure. When we write concurrent code with async/await, we're essentially creating a flat network of promises that can complete in any order, with limited ability to express relationships between them. We end up managing this complexity at the application level, building our own coordination logic every time we need operations to work together.

Consider this pattern that probably lives somewhere in your codebase:

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

This works, but notice how much coordination logic we're writing. We're manually tracking requests, handling cancellation, and dealing with the edge cases that arise when operations can be interrupted. Every time we need this kind of coordination, we rebuild these patterns from scratch.

## Enter Structured Concurrency

Structured concurrency offers a different approach. Instead of thinking about promises as independent entities that we coordinate from the outside, it organizes operations into a tree where parent operations have complete control over their children. A child operation cannot outlive its parent—period.

This isn't just a neat organizational principle; it's a fundamental shift in how we think about concurrent code. When you start an operation within a structured context, you're not just launching a promise into the void. You're creating a relationship that the runtime can understand and enforce.

[Effection](https://github.com/thefrontside/effection) brings this model to TypeScript through generator functions. Rather than fighting against JavaScript's single-threaded nature, it embraces it, using generators to create pauseable, resumable operations that can be composed and coordinated with surgical precision.

## The Generator Function Renaissance

If you haven't worked with generator functions recently, they might feel like a relic from pre-async/await JavaScript. But Effection recasts them as a powerful tool for expressing structured operations. Where async/await gives you linear sequences of asynchronous steps, generators give you the ability to pause, resume, and coordinate multiple concurrent operations.

Here's how that search example looks with Effection:

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

The cancellation logic disappeared. The coordination is expressed declaratively through the `race` operation, which automatically cancels the loser when the winner completes. No manual AbortController management, no try/catch blocks for handling cancellation—the structure of the code expresses the intended behavior.

## The TypeScript Experience

Effection 3.0 was designed with TypeScript in mind, and it shows. The core type is `Operation<T>`, which represents any operation that can be yielded from a generator function. The type system understands these relationships and provides the kind of inference you'd expect from modern TypeScript.

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

TypeScript knows that `fetchUserData` returns an `Operation<UserData>`, and if `fetchUser` returns the wrong type, you'll get a compile-time error. The type inference flows through the generator chain naturally, without the type gymnastics sometimes required with complex promise chains.

## The Context Revolution

One of Effection 3.0's most compelling features is its Context API, which provides a structured way to share data and resources across operations. This isn't dependency injection bolted onto the side—it's woven into the fabric of how operations relate to each other.

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

Context flows down the operation tree automatically. Child operations have access to any context provided by their ancestors, and when an operation completes or is cancelled, its context is cleaned up. This solves the resource management problem that plagues many TypeScript applications—databases connections, file handles, timers, and other resources are automatically cleaned up when their containing operation ends.

## Beyond Async/Await

What strikes me about Effection is how it reframes familiar concepts. The library's documentation talks about an "Async Rosetta Stone"—for every async pattern you know, there's a structured equivalent. But these aren't just drop-in replacements; they're rethought from the ground up to work within a structured system.

Take error handling. With promises, errors bubble up through the chain until someone catches them or they escape to become unhandled rejections. With structured concurrency, errors propagate through the operation tree in predictable ways, and you can establish error boundaries that contain failures within specific subtrees.

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

The try/catch works exactly as you'd expect, but with the added guarantee that any operations started within the try block will be properly cancelled if an error occurs.

## The Mental Model Shift

Learning Effection requires adjusting your mental model of concurrency. Instead of thinking about launching independent async operations and coordinating them externally, you think about composing operations into trees where the structure itself expresses the coordination logic.

This shift has broader implications. When concurrency is structured, testing becomes more predictable—operations complete in deterministic ways. Debugging becomes clearer—you can see the operation tree and understand exactly what's running and what's been cancelled. Performance becomes more manageable—resources are cleaned up automatically when operations complete.

## Real-World Implications

I've been thinking about how this applies to the kinds of applications we build every day. The autocomplete component that needs to cancel previous searches. The file upload that should be abortable. The background sync process that should pause when the app goes into the background. The real-time features that need to establish and tear down connections cleanly.

These aren't edge cases—they're the core challenges of building responsive, resource-efficient applications. Effection doesn't just provide tools for handling these challenges; it provides a framework for thinking about them systematically.

The library feels especially relevant as applications become more real-time and interactive. When every user action might trigger multiple concurrent operations, having a principled way to coordinate and cancel them becomes essential. The structure that Effection provides scales from simple operations to complex, multi-stage processes without requiring you to rebuild coordination logic each time.

## Looking Forward

Structured concurrency isn't just an interesting academic concept—it's being adopted by mainstream languages. Java has Project Loom, Swift has structured concurrency built into the language, and other ecosystems are exploring similar approaches. JavaScript, with its single-threaded nature and event-driven architecture, is actually well-suited to structured concurrency patterns.

Effection demonstrates that you don't need language-level changes to benefit from structured concurrency. By building on generators and embracing JavaScript's strengths, it creates a programming model that feels both familiar and revolutionary.

The 4.6kb gzipped bundle size suggests that structured concurrency doesn't require heavyweight frameworks or complex runtime machinery. It's a different way of organizing the async code you're already writing, with tooling that fades into the background once you internalize the patterns.

## The Path Forward

For TypeScript developers comfortable with async/await, Effection represents both an evolution and a return to fundamentals. It's an evolution because it solves coordination and resource management problems that async/await leaves unaddressed. It's a return to fundamentals because it makes the structure and lifecycle of concurrent operations explicit and manageable.

The question isn't whether structured concurrency will influence how we write asynchronous TypeScript—it's already happening. The question is whether we'll adopt it proactively or stumble into it as we try to solve the coordination problems that emerge in increasingly complex applications.

Effection offers a glimpse of what structured concurrency looks like in practice: not a replacement for everything you know about async programming, but a better foundation for building the kinds of applications that modern users expect. Applications that are responsive, resource-efficient, and robust in the face of the inherent complexity of concurrent operations.

The generator functions might feel unfamiliar at first, but the concepts they enable—structured operations, automatic resource cleanup, declarative coordination—address real problems that every TypeScript developer encounters. That's worth paying attention to.
