---
title: My Journey Building Mixon - A Type-Safe Microframework for Deno
date: 2025-04-05
tags: [WebDev, Deno, HTMX]
excerpt: How I built Mixon to solve the complexity and type safety challenges I faced while developing web applications in Deno.
---

## Why I Built Another Web Framework

I've been building web applications with various frameworks for years, and while each solved specific problems, I consistently encountered the same frustrations: lack of end-to-end type safety, complex configuration, and frameworks that felt too heavy for simple projects yet too limited for complex ones.

The breaking point came when I was working on a Deno project that needed workflow management, HTMX integration, and strong typing. Existing solutions required multiple libraries with inconsistent APIs, leading to maintenance overhead and type safety gaps.

## What I Wanted to Achieve

I set out to build something that would give me:
- End-to-end type safety without configuration overhead
- Built-in workflow management for stateful applications
- First-class HTMX support for server-driven UIs
- Zero dependencies and minimal footprint
- Pattern matching for cleaner conditional logic

## Type Safety That Actually Works

The foundation of Mixon became comprehensive type safety throughout the entire request lifecycle. I wanted compile-time guarantees that would catch errors before they reached production:

```typescript
import { App, type } from "jsr:@srdjan/mixon";

const app = App();
const { utils } = app;

// Define a type-safe schema
const userSchema = type({
  name: "string",
  email: "string",
  age: "number",
});

// Type-safe route with validated parameters
app.post("/users", (ctx) => {
  if (!ctx.validated.body.ok) {
    utils.handleError(ctx, 400, "Invalid user data", ctx.validated.body.error);
    return;
  }

  // ctx.validated.body.value is fully typed!
  const user = ctx.validated.body.value;
  // ...
});
```

This approach eliminated the runtime errors I'd grown tired of debugging in production.

## Pattern Matching for Cleaner Logic

I included pattern matching inspired by functional programming languages to make complex conditional logic more readable:

```typescript
import { App, match } from "jsr:@srdjan/mixon";

const result = match(response.status)
  .with(200, () => "Success")
  .with(404, () => "Not Found")
  .with(500, () => "Server Error")
  .otherwise(() => "Unknown Status");
```

This replaced nested if-else chains with declarative, exhaustive pattern matching.

## Workflow Engine for Complex Business Logic

One of Mixon's standout features became the built-in workflow engine. I needed a type-safe way to manage state transitions in business applications:

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

// Create workflow engine with type parameters
const orderWorkflow = app.workflow<OrderState, OrderEvent>();

// Define the workflow
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
    // Additional transitions...
  ],
  initial: "Draft",
});
```

The workflow engine automatically maintains audit trails and prevents invalid state transitions, solving problems I'd repeatedly encountered in e-commerce and business applications.

## HTMX Integration That Made Sense

I wanted first-class HTMX support that felt natural rather than bolted-on. Server-side rendering with HTMX became a core feature:

```typescript
/** @jsx h */
import { h, renderSSR } from "nano";
import { App } from "jsr:@srdjan/mixon";

const app = App();

// Product list route
app.get("/products", (ctx) => {
  const html = renderSSR(
    <section>
      {products.map((product) => (
        <article>
          <h3>{product.name}</h3>
          <div>${product.price}</div>
          <p>{product.description}</p>
          <button
            type="button"
            hx-get={`/api/fragments/product-detail/${product.id}`}
            hx-target="#content"
          >
            View Details
          </button>
        </article>
      ))}
    </section>,
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
});
```

This approach kept most logic on the server while providing rich interactivity with minimal client-side JavaScript.

## Performance Through Thoughtful Design

I balanced functional programming principles with strategic optimization for real-world performance:

- Fast-path dispatch with O(1) middleware lookup
- Static route matching with Map-based lookup
- In-place context updates to minimize allocations
- Controlled garbage collection pressure during request processing

The result is a framework that feels lightweight but performs well under load.

## Error Handling That Prevents Surprises

I implemented a Result type inspired by Rust for explicit error handling throughout the framework:

```typescript
// Type-safe error handling
if (!ctx.validated.body.ok) {
  utils.handleError(ctx, 400, "Invalid user data", ctx.validated.body.error);
  return;
}

// Safe access to validated data
const user = ctx.validated.body.value;
```

This approach eliminates the possibility of accessing invalid data and makes error states explicit in the type system.

## Getting Started Is Simple

I designed Mixon to work seamlessly with Deno's import system:

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

No package managers, no complex configuration—just import and start building.

## What I've Learned Building Mixon

Creating a web framework taught me that the best abstractions solve multiple problems with unified APIs. By combining type safety, workflow management, and HTMX support in a single, lightweight package, Mixon addresses the complexity I encountered across different projects.

The focus on Deno's strengths—security, TypeScript-first development, and modern JavaScript—allowed me to build something that feels native to the ecosystem rather than ported from Node.js patterns.

Mixon represents my approach to web development: powerful enough for complex applications, simple enough for quick prototypes, and type-safe enough to prevent the runtime errors that waste development time.

Whether building APIs, workflow-driven applications, or HTMX-powered UIs, Mixon provides the tools needed while staying true to Deno's philosophy of simplicity and security.