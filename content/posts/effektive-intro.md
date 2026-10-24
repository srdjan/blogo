---
title: "Effektive: Effect-TS Contracts Without the Ceremony"
date: 2026-10-24
tags: [TypeScript, Functional, Compilers, Effect]
excerpt: Effektive is a small functional language that compiles to Effect-TS, so you write direct code and the compiler writes the Effect plumbing.
draft: true
---

I love Effect-TS. I wrote about
[why it makes TypeScript read like business logic](/posts/value-of-effect-ts),
and I still think the core idea is one of the best things that happened to
TypeScript. One type, `Effect<A, E, R>`, tells you what a function returns, how
it can fail, and what it needs to run. Brilliant.

But. Read any Effect function and watch what your eyes do. They skip
`Effect.flatMap`, skip `.pipe(`, skip `yield*`, skip `Effect.succeed`, and hunt
for the three words that actually matter. The contract is great. The ceremony
around it is heavy.

So I built **Effektive**. It is a small functional language that transpiles to
Effect-TS 4. You write direct code that looks like a strict TypeScript subset.
Each exported function states its contract in plain words: what it returns, what
it `fails` with, what it `uses`. Local helpers let the compiler infer it. The
compiler checks every contract and writes the Effect code for you.

Website and mini book:
[effektive.timok.deno.net](https://effektive.timok.deno.net/)

## One Function, Two Languages

Look at this. A lookup that turns a missing user into a typed domain error:

```typescript
export const getUser = (id: UserId): User
  fails UserMissing | StoreUnavailable
  uses Users.find =>
  match Users.find(id) {
    Some(user) => user,
    None => fail(UserMissing({ id }))
  }
```

That is Effektive. The signature reads like a sentence: `getUser` takes an id,
returns a `User`, fails with `UserMissing` or `StoreUnavailable`, and uses
`Users.find`. The body calls the service directly, like a normal function. No
`yield*`, no `Effect.flatMap`, no wrapper on the return type.

Here is the same thing in idiomatic hand-written Effect-TS:

```typescript
export const getUser = (id: UserId): Effect.Effect<
  User,
  UserMissing | StoreUnavailable,
  Users
> =>
  Users.use((users) => users.find(id)).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(new UserMissing({ id })),
      onSome: Effect.succeed,
    })),
  );
```

Both say the same thing. Both have the same types at the end, because the
Effektive version _becomes_ an
`Effect.Effect<User, UserMissing |
StoreUnavailable, Users>`. The difference is
who writes the plumbing.

## The Contract Is the Whole Idea

Every Effektive function has three facts:

- **The result type** describes normal completion.
- **The `fails` clause** names the expected domain errors.
- **The `uses` clause** names the service methods that the body calls.

The compiler maps them one to one: a function that returns `A`, fails with `E`,
and uses `R` becomes `Effect.Effect<A, E, R>`.

Here's the cool part: the contract is _closed_. If you leave out `fails`, the
function has no expected failures. If you leave out `uses`, it needs no
services. The body cannot exceed what the signature declares. So if you forget
to list `PaymentDeclined` on a function that charges a card, the compiler stops
you:

```text
pay.eff:45:3: error failure-contract/001: the body can fail with PaymentDeclined, which the `fails` clause does not list
```

And if you forget the capability:

```text
pay.eff:45:3: error requirement-contract/001: the body requires Payments.charge, which the `uses` clause does not list
```

Those are real messages from the compiler, not something I typed for the post.
In VS Code you also get a quick fix that adds the missing failure or capability
to the signature.

The contract must be written only where it matters: on exported functions, the
public surface of a module. A local helper can skip `fails` and `uses`, and the
compiler infers them from the body. This also works for recursive helpers. The
export that calls them still has to declare everything they can do, so nothing
escapes the module unannounced. In the editor, inlay hints show the inferred
`fails` and `uses` next to each helper, so you can still read the contract
without writing it.

To me is interesting that the `uses` clause is _finer_ than Effect itself. In
Effect-TS the requirement type is the whole `Users` service. In Effektive,
`Users.find`, `Users.save`, and `Users.all` are separate capabilities. A
read-only function says `uses Users.find`, and the checker holds it to that. The
generated TypeScript still needs the whole `Users` service, because that is what
Effect tracks. The finer check lives in the compiler's typed intermediate
representation. It is a static check for review, not a sandbox for adapters.

## Declarations: Where the Ceremony Lives

Let's take something with a few moving parts: find an order, charge it with a
retry, mark it as paid, save it. Before any logic, you need a record, two
errors, and two services. Here they are in Effektive:

```typescript
type Cents = int
type ChargeId = string

nominal OrderId = string
type Order = {
  id: OrderId,
  totalCents: int,
  status: "pending" | "paid"
}

error OrderNotFound = { id: OrderId }
error PaymentDeclined = { reason: string }

service Orders {
  find(id: OrderId): Option<Order>
  save(order: Order): void
}

service Payments {
  charge(amount: Cents): ChargeId fails PaymentDeclined
}
```

And here is the same in idiomatic Effect-TS:

```typescript
import { Context, Effect, Option, Schema } from "effect";

const Cents = Schema.Int;
type Cents = typeof Cents.Type;
type ChargeId = string;

const OrderId = Schema.String.pipe(Schema.brand("OrderId"));
type OrderId = typeof OrderId.Type;

const Order = Schema.Struct({
  id: OrderId,
  totalCents: Cents,
  status: Schema.Literals(["pending", "paid"]),
});
type Order = typeof Order.Type;

class OrderNotFound extends Schema.TaggedError<OrderNotFound>()(
  "OrderNotFound",
  { id: OrderId },
) {}

class PaymentDeclined extends Schema.TaggedError<PaymentDeclined>()(
  "PaymentDeclined",
  { reason: Schema.String },
) {}

class Orders extends Context.Service<Orders, {
  readonly find: (id: OrderId) => Effect.Effect<Option.Option<Order>>;
  readonly save: (order: Order) => Effect.Effect<void>;
}>()("Orders") {}

class Payments extends Context.Service<Payments, {
  readonly charge: (
    amount: Cents,
  ) => Effect.Effect<ChargeId, PaymentDeclined>;
}>()("Payments") {}
```

Look at the errors. In Effektive an error is one line: a name and its fields. In
Effect-TS it is a class that repeats its own name three times. Every type comes
twice, once as a schema value and once as `typeof X.Type`. Every service method
wraps its result in `Effect.Effect<...>`, even though the service is the place
where effects obviously live.

I counted non-whitespace characters, with the TypeScript formatted by
`deno fmt`. The Effektive declarations have 314. The Effect-TS declarations
have 840. That is about 2.7 times more text for the same information, and it is
exactly the text that nobody wants to read.

## A Payment Pipeline

Now the logic. In Effektive:

```typescript
const findOrder = (id: OrderId) =>
  match Orders.find(id) {
    Some(order) => order,
    None => fail(OrderNotFound({ id }))
  }

const chargeOrder = (order: Order) => {
  retry(() => Payments.charge(order.totalCents), { times: 2 })
  order
}

const markPaid = (order: Order) =>
  ({ ...order, status: "paid" })

const saveOrder = (order: Order) => {
  Orders.save(order)
  order
}

export const pay = (id: OrderId): Order
  fails OrderNotFound | PaymentDeclined
  uses Orders | Payments.charge =>
  id
    |> findOrder
    |> chargeOrder
    |> markPaid
    |> saveOrder
```

The helpers have no contracts, because they are local. The compiler knows that
`findOrder` fails with `OrderNotFound` and uses `Orders.find`, and it checks
that `pay` declares all of it.

Look at `pay`. It is a pipeline of four steps, and the pipeline does not care
which steps are effectful. `markPaid` is a pure function. `findOrder` talks to a
service and can fail. They compose with the same `|>`. In Effect you must pick
the right combinator for each step: `flatMap` for the effectful ones, `map` for
the pure one. Pick wrong and you read a long type error.

Here is my Effect-TS version. I kept it idiomatic and let TypeScript infer the
helper return types, so it is as short as I can make it honestly:

```typescript
const findOrder = (id: OrderId) =>
  Orders.use((orders) => orders.find(id)).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.fail(new OrderNotFound({ id })),
      onSome: Effect.succeed,
    })),
  );

const chargeOrder = (order: Order) =>
  Payments.use((payments) => payments.charge(order.totalCents)).pipe(
    Effect.retry({ times: 2 }),
    Effect.as(order),
  );

const markPaid = (order: Order): Order => ({ ...order, status: "paid" });

const saveOrder = (order: Order) =>
  Orders.use((orders) => orders.save(order)).pipe(Effect.as(order));

export const pay = (id: OrderId): Effect.Effect<
  Order,
  OrderNotFound | PaymentDeclined,
  Orders | Payments
> =>
  findOrder(id).pipe(
    Effect.flatMap(chargeOrder),
    Effect.map(markPaid),
    Effect.flatMap(saveOrder),
  );
```

Here the gap is smaller, but it is still real. The Effektive functions have 446
characters, the Effect-TS functions have 664. Both versions let the helpers
infer their types, and both write a full contract on the exported `pay`. So for
the same information, the logic is about a third shorter. More important than
the number: the Effektive version is direct code. A service call is a call. A
`void` step is a line. You never think about `Effect.as` to keep a value after a
write.

Whole module: 760 characters in Effektive against 1504 in Effect-TS.

## What the Compiler Writes

The generated code is plain Effect-TS 4 that a human can read. For `pay`, the
compiler writes this:

```typescript
export const pay = (id: OrderId): Effect.Effect<
  Order,
  OrderNotFound | PaymentDeclined,
  Orders | Payments
> =>
  Effect.gen(function* () {
    const $p1: OrderId = id;
    const $p2: Order = yield* findOrder($p1);
    const $p3: Order = yield* chargeOrder($p2);
    const $p4: Order = markPaid($p3);
    return yield* saveOrder($p4);
  });
```

The pipeline unrolls into a generator. Effectful steps get `yield*`, the pure
step does not. Records become `Schema.Struct`, `nominal OrderId = string`
becomes a branded `Schema.String`, errors become `Schema.TaggedError` classes
with module-qualified tags, and services become `Context.Service` classes. Each
file also gets a source map that points back to your `.eff` source.

This means you are not locked in. If you stop using Effektive tomorrow, you keep
a folder of ordinary Effect code.

## The Rest of the Language, Quickly

The language is small on purpose. Every binding is immutable. There is no
assignment, no class, no `this`, and no `return` statement: a block returns its
final expression. A few more features worth showing:

**Typed recovery.** `try`/`catch` matches on error names, and the handled error
leaves the contract:

```typescript
export const displayName = (id: UserId): Name
  fails StoreUnavailable
  uses Users.find =>
  try {
    getUser(id).name
  } catch {
    UserMissing(error) => "Guest"
  }
```

`UserMissing` is gone from `fails`, `StoreUnavailable` stays. A typed catch
handles only declared domain failures. It does not catch defects or
interruption. In Effect terms, this is `Effect.catchTag`, and the compiler
removes the tag from the error type for you.

**Named error sets.** When the same list of errors repeats, give it a name and
use the name in `fails`:

```typescript
type PayFailure = OrderNotFound | PaymentDeclined

export const pay = (id: OrderId): Order
  fails PayFailure
  uses Orders | Payments.charge => ...
```

The compiler expands the name, so the contract and the generated
`Effect.Effect<Order, OrderNotFound | PaymentDeclined, ...>` stay the same.

**Pipelines and collections.** `map`, `filter`, and `fold` come from the
prelude, and they work on the right side of `|>`:

```typescript
export const activeNames = (): Name[]
  fails StoreUnavailable
  uses Users.all =>
  Users.all()
    |> filter((user) => user.active)
    |> map((user) => user.name)
```

**Nominal types.** `nominal OrderId = string` gives an identity to a string. A
plain string cannot pass where an `OrderId` is expected:

```text
pay.eff:54:40: error type-mismatch/003: argument 1 has type Raw, but OrderId is expected
```

**Streams, resources, and schedules.** The language also has streams with
backpressure, concurrent mapping, sinks, scoped resources with cleanup, and
retry schedules. Here is a piece of a stream processor:

<!-- deno-fmt-ignore -->
```typescript
const incoming = bufferStream(unfold(0, (index) => Input.next(input, index)), { capacity: 2 })
const converted = mapEffect(incoming, (item) => convert(item), { concurrency: 2 })
const batches = transduceStream(converted, takeSink(2))
runStream(batches, sinkForEach((batch) =>
  if ((batch |> fold(0, (count, _item) => count + 1)) > 0) { Output.write(output, batch) } else {}))
```

**Host boundary.** Real drivers live in TypeScript. A small interface file
declares what the host gives:

```typescript
import { Users } from "../users.eff"
export provider UsersLive provides Users
```

The TypeScript module behind it exports an ordinary `Layer`, and Effektive code
calls `provide(UsersLive, () => displayName("u1"))` to run with it.

## Tooling

A language without tools is a toy, so Effektive ships with them. The CLI has
`check`, `build`, and `watch`. The language server gives diagnostics, hover,
go-to-definition, references, rename, completion, semantic tokens, inlay hints
for inferred contracts, and the contract quick fixes from above. The VS Code
extension shows the generated TypeScript next to your source and writes it on
save. There is also a browser playground that runs the compiler core in the
browser.

## Real Talk: Tradeoffs

Effektive is version 0. Let me be direct about what that means.

**It is deliberately small.** No user-defined generics, no effect-row
polymorphism, no macros, no early returns. You cannot import an arbitrary npm
package from `.eff` source. HTTP, SQL, and other drivers stay in TypeScript
behind a typed host interface. For an orchestration layer that is fine. For a
general-purpose language it is a wall.

**It covers a subset of Effect.** I did not chase API parity. I picked three
target applications (a service workflow, a scheduled worker, and a stream
processor) and stopped adding features when all three compiled with precise
contracts and passed failure, cancellation, and cleanup checks. If your app
needs a combinator outside that set, you write it in TypeScript.

**Numbers are strict.** `int` means a safe integer, and overflow is a defect,
not a silent wrap. Division always gives `number`. Good for money, a little
annoying for percent math.

**Inferred contracts live in the tools.** A local helper without `fails` and
`uses` is shorter, but in a plain text view you see its contract only at the
export that calls it. The editor shows it as an inlay hint. A named error set
also moves the list of errors away from the place where you use it.

**Another layer to debug.** Source maps help, but you now have a compiler
between you and the runtime. When something looks wrong, sometimes you read the
generated TypeScript.

**It is one person's project.** It has a real test suite and three gate
applications. It does not have a community or years of production use. Effect-TS
does.

Where does it fit? It depends of how much of your code is orchestration. If your
service is mostly "call this, handle that failure, retry, save", Effektive
removes most of the noise and keeps every guarantee. If your code is mostly
clever generic library work, write Effect-TS directly.

## Try It

The mini book on [effektive.timok.deno.net](https://effektive.timok.deno.net/)
walks through the language in eleven short chapters, with Effektive and
Effect-TS side by side. Start with the contracts chapter. If the `fails`/`uses`
signature clicks for you, the rest of the language follows from it.

For me, Effektive is the next step after [TypeLang](/posts/typelang). TypeLang
tried to get there by restricting TypeScript. Effektive keeps the good parts of
TypeScript syntax, adds three words to the signature, and gives the plumbing to
the compiler. Kind of like a good espresso: short, strong, and the machine does
the hard work.
