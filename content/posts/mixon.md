---
title: "Mixon - Type-Safe Web Framework for Deno with Built-In Workflows"
date: 2025-04-05
tags: [Web, Development, Deno, HTMX, TypeScript]
excerpt: Building web apps means juggling type safety, state management, and server-side rendering across multiple libraries. Mixon combines end-to-end TypeScript safety, workflow engine, and HTMX support in one lightweight package for Deno.
---

Building web applications with Deno means choosing between frameworks. Express-style routers lack type safety. Heavy frameworks bring Node.js baggage. Type-safe options don't integrate with HTMX naturally. Workflow management? Separate library with different API patterns.

I kept building the same infrastructure across projects: request validation with types, state machine logic for business workflows, server-side rendering with HTMX. Repetitive. Error-prone. Maintenance overhead.

So I built Mixon. Type-safe microframework for Deno that handles the repetitive parts—validation, workflows, HTMX patterns—with zero dependencies and consistent APIs. Not trying to replace Express or Oak. Solving specific problems I hit repeatedly.

## End-to-End Type Safety

Type safety shouldn't stop at function boundaries. Request validation, response handling, state transitions—all of it should be typed. Mixon provides compile-time guarantees throughout the request lifecycle:

```typescript
import { App, type } from "jsr:@srdjan/mixon";

const app = App();
const { utils } = app;

// Define schema with runtime validation
const userSchema = type({
  name: "string",
  email: "string",
  age: "number",
});

// Type-safe route handler
app.post("/users", (ctx) => {
  if (!ctx.validated.body.ok) {
    utils.handleError(ctx, 400, "Invalid user data", ctx.validated.body.error);
    return;
  }

  // ctx.validated.body.value is fully typed as { name: string; email: string; age: number }
  const user = ctx.validated.body.value;
  console.log(`Creating user: ${user.name}, ${user.email}, ${user.age}`);

  ctx.response = utils.createResponse(ctx, { id: crypto.randomUUID(), ...user });
});
```

The `type()` function creates schemas that validate at runtime and provide TypeScript types. No separate type definitions. No keeping schemas and types in sync manually. One source of truth.

Invalid data? You get a Result type with explicit error information. No exceptions. No `try/catch` blocks for validation. Handle errors explicitly or TypeScript complains.

## Pattern Matching for Conditional Logic

Nested `if/else` chains are hard to read. Switch statements with fallthrough are error-prone. Pattern matching makes conditional logic declarative:

```typescript
import { App, match } from "jsr:@srdjan/mixon";

app.get("/status/:code", (ctx) => {
  const code = parseInt(ctx.params.code);

  const message = match(code)
    .with(200, () => "Success")
    .with(404, () => "Not Found")
    .with(500, () => "Server Error")
    .otherwise(() => "Unknown Status");

  ctx.response = utils.createResponse(ctx, { code, message });
});
```

Exhaustive matching catches missing cases at compile time. Add a new status code? The type system tells you where to update patterns. No silent fallthrough bugs.

## Built-In Workflow Engine

E-commerce orders. Support tickets. Content approval processes. Business applications need state machines. Usually means reaching for separate workflow library with different API patterns and no type integration.

Mixon includes workflow engine with full type safety:

```typescript
// Define workflow types
type OrderState =
  | "Draft"
  | "Pending"
  | "Confirmed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

type OrderEvent = "Submit" | "Confirm" | "Ship" | "Deliver" | "Cancel";

// Create typed workflow
const orderWorkflow = app.workflow<OrderState, OrderEvent>();

orderWorkflow.load({
  states: ["Draft", "Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],
  events: ["Submit", "Confirm", "Ship", "Deliver", "Cancel"],
  transitions: [
    {
      from: "Draft",
      to: "Pending",
      on: "Submit",
      task: {
        assign: "sales@example.com",
        message: "New order received: {orderNumber}",
      },
    },
    {
      from: "Pending",
      to: "Confirmed",
      on: "Confirm",
      task: {
        assign: "warehouse@example.com",
        message: "Order confirmed, prepare shipment: {orderNumber}",
      },
    },
    {
      from: "Confirmed",
      to: "Shipped",
      on: "Ship",
      task: {
        assign: "customer@example.com",
        message: "Order shipped with tracking: {trackingNumber}",
      },
    },
    {
      from: "Shipped",
      to: "Delivered",
      on: "Deliver",
    },
    {
      from: ["Draft", "Pending", "Confirmed"],
      to: "Cancelled",
      on: "Cancel",
    },
  ],
  initial: "Draft",
});

// Use in routes
app.post("/orders/:id/transition", (ctx) => {
  const orderId = ctx.params.id;
  const { event } = ctx.validated.body.value;

  const result = orderWorkflow.transition(orderId, event);

  if (!result.ok) {
    utils.handleError(ctx, 400, "Invalid transition", result.error);
    return;
  }

  ctx.response = utils.createResponse(ctx, result.value);
});
```

Look at the benefits:

**Type safety**: Try to transition from "Shipped" to "Pending"? Compile error. Invalid states don't exist in your type system.

**Automatic audit trail**: Every state transition gets logged with timestamp, event, previous state, new state. Built in.

**Task management**: Define tasks that trigger on transitions. Send emails, update databases, call APIs. Declarative configuration.

**Validation**: Workflow engine validates transitions before executing them. Invalid state changes fail cleanly with error messages.

To me is interesting that business logic becomes data. Define allowed transitions as configuration. Enforce rules through type system and workflow engine. Less imperative code, fewer bugs.

## First-Class HTMX Support

HTMX enables rich interactivity through HTML attributes. Server sends HTML fragments. Browser swaps them in. Simple architecture that scales.

Mixon treats HTMX as first-class citizen, not afterthought:

```typescript
/** @jsx h */
import { h, renderSSR } from "nano";
import { App } from "jsr:@srdjan/mixon";

const app = App();

const products = [
  { id: 1, name: "Product A", price: 29.99, description: "First product" },
  { id: 2, name: "Product B", price: 49.99, description: "Second product" },
];

// Full page route
app.get("/products", (ctx) => {
  const html = renderSSR(
    <html>
      <head>
        <title>Products</title>
        <script src="https://unpkg.com/htmx.org@2.0.7"></script>
      </head>
      <body>
        <h1>Our Products</h1>
        <section id="content">
          {products.map((product) => (
            <article>
              <h3>{product.name}</h3>
              <div>${product.price}</div>
              <p>{product.description}</p>
              <button
                type="button"
                hx-get={`/api/products/${product.id}/detail`}
                hx-target="#content"
                hx-swap="innerHTML"
              >
                View Details
              </button>
            </article>
          ))}
        </section>
      </body>
    </html>
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
});

// Fragment route for HTMX
app.get("/api/products/:id/detail", (ctx) => {
  const id = parseInt(ctx.params.id);
  const product = products.find(p => p.id === id);

  if (!product) {
    ctx.response = new Response("Product not found", { status: 404 });
    return;
  }

  const html = renderSSR(
    <div>
      <h2>{product.name}</h2>
      <p>Price: ${product.price}</p>
      <p>{product.description}</p>
      <button
        type="button"
        hx-get="/products"
        hx-target="body"
        hx-swap="innerHTML"
      >
        Back to List
      </button>
    </div>
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
});
```

Server-side rendering with JSX (using nano library). Type-safe templating. HTMX attributes integrated naturally. No build step needed—Deno handles JSX transform natively.

Pattern works beautifully for admin interfaces, e-commerce features, content-driven sites. Most logic stays server-side where you have database access, session management, business rules. Client gets clean HTML and simple HTMX attributes.

## Performance Through Simplicity

Zero dependencies means small footprint. Entire framework is ~15KB. No transitive dependency tree. Fast cold starts on Deno Deploy.

Fast-path optimizations for common cases:

**O(1) middleware lookup**: Map-based dispatch instead of array iteration.

**Static route matching**: Pre-compiled route patterns. No regex evaluation for simple routes.

**Minimal allocations**: Context objects reused where possible. In-place updates reduce garbage collection pressure.

Not claiming this is fastest framework in benchmarks. But fast enough for real applications while keeping codebase maintainable.

## Result-Based Error Handling

Exceptions hide control flow. You don't know which functions throw what errors. `try/catch` blocks scatter throughout code.

Mixon uses Result types inspired by Rust. Errors are values:

```typescript
// Validation returns Result
if (!ctx.validated.body.ok) {
  // ctx.validated.body.error contains detailed information
  utils.handleError(ctx, 400, "Invalid data", ctx.validated.body.error);
  return;
}

// Safe to access validated data
const data = ctx.validated.body.value;
```

Workflow transitions return Results:

```typescript
const result = orderWorkflow.transition(orderId, event);

if (!result.ok) {
  // Handle error explicitly
  utils.handleError(ctx, 400, "Invalid transition", result.error);
  return;
}

// Safe to access transition result
const newState = result.value;
```

Errors become explicit in function signatures. TypeScript enforces checking. No silent failures. No uncaught exceptions.

## Getting Started

Works with Deno's import system. No package manager needed:

```typescript
import { App } from "jsr:@srdjan/mixon";

const app = App();
const { utils } = app;

app.get("/", (ctx) => {
  ctx.response = utils.createResponse(ctx, { message: "Hello from Mixon!" });
});

console.log("Server running at http://localhost:3000");
app.listen(3000);
```

Run it: `deno run --allow-net server.ts`

That's it. No `npm install`. No config files. Import and build.

## Who This Is For

Mixon works well when you need:

**Type safety throughout**: Request validation, workflow states, response handling—all typed.

**Business workflows**: E-commerce orders, approval processes, support tickets—anything with state transitions.

**Server-side rendering**: HTMX-driven UIs where most logic stays on server.

**Deno-native development**: Using Deno's security model, TypeScript support, modern JavaScript.

**Lightweight deployments**: Small footprint for Deno Deploy or edge computing.

Not trying to replace Express, Hono, Oak. Different goals. Mixon optimizes for type safety, workflow integration, and HTMX patterns in Deno environment.

## Real Talk: Tradeoffs

Mixon is young. API will evolve. Breaking changes likely as I learn what works.

**Limited ecosystem**: No vast plugin library. No middleware marketplace. Build custom solutions or use vanilla Deno libraries.

**Opinionated architecture**: Built-in workflow engine and pattern matching might not fit your mental model. If you prefer traditional state management? Probably not for you.

**Deno-specific**: Uses Deno APIs. Won't run on Node.js without significant changes. Choosing Mixon means choosing Deno.

**Documentation is minimal**: Code examples exist. Comprehensive docs? Still working on it.

**Small community**: You're not getting Stack Overflow answers or tutorial videos. Early adopter territory.

But. If you're building Deno applications with workflow needs, HTMX patterns, and strong type safety requirements? Mixon addresses those specifically. I built this solving my own problems. Maybe it solves yours too.

I've been using Mixon for side projects—band website with content workflows, small e-commerce experiments. The workflow engine eliminated state management bugs. Type safety caught issues at compile time. HTMX integration felt natural.

## Bottom Line

Web frameworks make tradeoffs. Express prioritizes flexibility. Rails emphasizes convention. React focuses on client-side state. Each solves different problems.

Mixon prioritizes: type safety, workflow management, HTMX patterns, Deno ecosystem. Specific problems. Specific solutions.

Not saying this is better than other frameworks. Saying if these priorities match your needs, Mixon might fit. Type-safe request handling, built-in state machines, first-class server-side rendering—combined in lightweight package.

This means choosing framework depends of your constraints. Building complex SPAs? React or Vue. Large enterprise systems? Spring or Rails. But Deno applications with business workflows and server-driven UIs? Mixon addresses that combination specifically.

The framework landscape has room for specialized tools. Mixon targets narrow use case deliberately: type-safe Deno web applications with workflow requirements and HTMX rendering. If that describes your project, give it a try.

Available at `jsr:@srdjan/mixon`. MIT licensed. Issues and contributions welcome. Still evolving, still learning, still improving.
