---
title: flatMap vs map - When Flattening Actually Matters
date: 2025-12-26
tags: [TypeScript, Functional Programming, JavaScript]
excerpt: Everyone knows map. But flatMap confuses people for years until it suddenly clicks. Here's the mental model that makes it obvious.
---

Everyone knows `map`. Take an array, transform each element, get a new array.
Simple.

Then you encounter `flatMap` and things get murky. The name suggests it maps and
flattens, but why would you need that? When does it matter? I worked with this
pattern for years before it truly clicked, and the insight is simpler than most
explanations make it seem.

## The Cookie Example

Before we go deep, here's the entire concept in 15 lines:

```typescript
const kids = ["alice", "bob", "carol"];

const getCookies = (kid: string): string[] => {
  if (kid === "alice") return ["oreo", "oreo"];
  if (kid === "bob") return ["chip", "chip", "chip"];
  return ["sugar", "sugar"];
};

// MAP: gives you bags inside bags (nested!)
const bagsOfCookies = kids.map(getCookies);
// [["oreo", "oreo"], ["chip", "chip", "chip"], ["sugar", "sugar"]]
// Type: string[][]

// FLATMAP: dumps all cookies into one pile
const allCookies = kids.flatMap(getCookies);
// ["oreo", "oreo", "chip", "chip", "chip", "sugar", "sugar"]
// Type: string[]
```

That's it. `map` gave us 3 bags (array of arrays). `flatMap` gave us 7 cookies
(one flat array). Same function, different result structure.

**Use flatMap when your transformation returns an array and you want everything
combined.**

Now let's understand why this matters in real code.

## The Nesting Problem

Here's where it gets interesting. Imagine fetching orders for multiple users:

```typescript
type User = {
  readonly id: string;
  readonly name: string;
  readonly orderIds: readonly string[];
};

const users: User[] = await fetchAllUsers();

// Get each user's order IDs
const orderIdArrays = users.map((user) => user.orderIds);
// Type: string[][]
```

See that type? `string[][]`. You mapped users to their order IDs, and since each
user has an array of order IDs, you got nested arrays.

If you want a flat list of all order IDs across all users:

```typescript
// Option 1: map then flatten
const allOrderIds = users.map((user) => user.orderIds).flat();

// Option 2: flatMap does both
const allOrderIds = users.flatMap((user) => user.orderIds);
// Type: string[]
```

The key insight: **use flatMap when your transformation function returns the
same type of container you're operating on**.

With `map`, your function has shape `A → B`:

```typescript
users.map((user) => user.name); // User → string
// Result: string[]
```

With `flatMap`, your function has shape `A → Container<B>`:

```typescript
users.flatMap((user) => user.orderIds); // User → string[]
// Result: string[] (not string[][])
```

## The Filter-While-Mapping Trick

Here's a pattern that surprised me when I first saw it. `flatMap` can filter and
transform simultaneously:

```typescript
// Only return premium users' emails
const premiumEmails = users.flatMap((user) =>
  user.isPremium ? [user.email] : []
);
// Type: string[]
```

Return an empty array to exclude items. Return a single-element array to
include. To me is interesting how this eliminates the separate filter step
entirely.

## Promises: .then() Is Already flatMap

Here's where it clicks for async code. Look at this:

```typescript
fetchUser(id).then((user) => fetchOrders(user));
// Type: Promise<Order[]>
```

If `.then()` worked like `map`, you'd get `Promise<Promise<Order[]>>`. But you
don't - JavaScript's Promise implementation automatically flattens.

The `.then()` method is `flatMap` in disguise. When your callback returns a
Promise, it unwraps automatically.

This means `async/await` is essentially syntactic sugar for flatMap chains:

```typescript
// These are equivalent:
const orders = await fetchUser(id).then((user) => fetchOrders(user));

const user = await fetchUser(id);
const orders = await fetchOrders(user);
```

Each `await` is implicitly flat-mapping - unwrapping one layer of Promise.

## The Result Type Pattern

Where this gets really powerful is with Result types for error handling:

```typescript
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

const Result = {
  map: <T, U, E>(result: Result<T, E>, fn: (v: T) => U): Result<U, E> =>
    result.ok ? { ok: true, value: fn(result.value) } : result,

  flatMap: <T, U, E>(
    result: Result<T, E>,
    fn: (v: T) => Result<U, E>,
  ): Result<U, E> => result.ok ? fn(result.value) : result,
};
```

With `map`, you transform the success value:

```typescript
const nameResult = Result.map(userResult, (user) => user.name);
// Result<string, Error>
```

With `flatMap`, you chain operations that might fail:

```typescript
const ordersResult = Result.flatMap(
  userResult,
  (user) => fetchOrdersSafe(user.id),
);
// Result<Order[], Error> — not Result<Result<Order[], Error>, Error>
```

The flatMap keeps the Result flat instead of nesting Results inside Results.

## The Railway Mental Model

Think of two parallel tracks: success and error.

`map` transforms cargo while staying on your track:

```
Success: ──[User]──map(getName)──[string]──
Error:   ──[Error]───────────────[Error]──
```

`flatMap` can switch tracks. Success stays on success track if the operation
succeeds. Failure switches to error track:

```
                    ┌──succeeds──[Orders]──
Success: ──[User]──flatMap(fetchOrders)──
                    └──fails─────────────┐
Error:   ────────────────────────[Error]─
```

This pattern shines for sequential operations that might fail:

```typescript
const processCheckout = async (userId: string): Promise<Result<Receipt>> => {
  const userResult = await fetchUserSafe(userId);
  if (!userResult.ok) return userResult;

  const cartResult = await fetchCartSafe(userResult.value);
  if (!cartResult.ok) return cartResult;

  const paymentResult = await processPaymentSafe(cartResult.value);
  if (!paymentResult.ok) return paymentResult;

  return generateReceiptSafe(paymentResult.value);
};
```

Each step short-circuits on error. This is flatMap threading error handling
through automatically.

## Common Mistakes

**Using map when you need flatMap:**

```typescript
// Wrong: nested arrays
const allTags = posts.map((post) => post.tags);
// Type: string[][]

// Right: flat array
const allTags = posts.flatMap((post) => post.tags);
// Type: string[]
```

**Using flatMap when you need map:**

```typescript
// Wasteful: wrapping in array unnecessarily
const names = users.flatMap((user) => [user.name]);

// Better: direct transformation
const names = users.map((user) => user.name);
```

**Forgetting .then() already flattens:**

```typescript
// This already works:
fetchUser(id).then((user) => fetchOrders(user));
// Type: Promise<Order[]> — not Promise<Promise<Order[]>>
```

## The Mental Model

Here's how I think about it now:

- **map**: Transform values, keep structure unchanged. `A → B` inside a
  container.
- **flatMap**: Transform values, merge the new container with the existing one.
  `A → Container<B>` flattened into the same container type.

Watch for nested types in your signatures. If you see `Promise<Promise<T>>` or
`T[][]` and didn't want nesting, you need flatMap (or `.flat()`).

The pattern works everywhere: Arrays, Promises, Results, Options. Any container
type benefits from understanding when to map versus flatMap.

Once this distinction clicks, you start seeing it everywhere. These are the
building blocks of composition in functional programming, and they make async
TypeScript dramatically cleaner.
