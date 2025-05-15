---
title: Introduction to Mixon
date: 2025-04-05
tags: [WebDev, Deno, HTMX]
excerpt: Exploring Mixon, a lightweight library for building full stack applications with Deno.
---

## Introducing Mixon: A Type-Safe API & Workflow Microframework for Deno

In the ever-evolving landscape of web development, finding the right balance between simplicity and power can be challenging. Today, I'm excited to introduce **Mixon** - a lightweight, type-safe microframework for building modern web applications and APIs in Deno.

### What is Mixon?

Mixon is a minimalist yet powerful framework designed specifically for Deno, combining the simplicity of minimal frameworks with advanced features like runtime type validation, elegant pattern matching, content negotiation, and HATEOAS support. At less than 5KB for its core functionality and with zero dependencies, Mixon provides a robust foundation for building everything from simple REST APIs to complex stateful applications.

### Why Choose Mixon?

In a world of heavyweight frameworks, Mixon stands out by offering:

#### 1. Type-Safety Throughout Your Application

Mixon leverages TypeScript's powerful type system to provide end-to-end type safety. From route parameters to workflow states, everything is type-checked at compile time, helping you catch errors before they reach production.

```typescript
import { App, type } from "jsr:@srdjan/mixon";

const app = App();
const { utils } = app;

// Define a type-safe schema
const userSchema = type({
  name: "string",
  email: "string",
  age: "number"
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

#### 2. Elegant Pattern Matching

Mixon includes a built-in pattern matching system inspired by functional programming languages, making complex conditional logic more readable and maintainable:

```typescript
import { App, match } from "jsr:@srdjan/mixon";

const result = match(response.status)
  .with(200, () => "Success")
  .with(404, () => "Not Found")
  .with(500, () => "Server Error")
  .otherwise(() => "Unknown Status");
```

#### 3. Content Negotiation & HATEOAS Support

Build truly RESTful APIs with automatic content negotiation and hypermedia support:

```typescript
app.get("/users/:id", (ctx) => {
  // Response format determined by Accept header (JSON, HAL, or HTML)
  ctx.response = utils.createResponse(ctx,
    user,
    { links: utils.createLinks('users', userId) }
  );
});
```

#### 4. Workflow Engine for Stateful Applications

Mixon includes a powerful state machine implementation for modeling complex business processes. The workflow engine is one of Mixon's standout features, providing a type-safe way to manage state transitions in your application.

##### Core Workflow Concepts

The workflow engine is built on finite state machine principles:

- **States**: Discrete conditions your business entity can be in
- **Events**: Triggers that cause transitions between states
- **Transitions**: Rules defining how states change in response to events
- **Tasks**: Actions to perform when transitions occur

```typescript
// Define workflow types
type OrderState = "Draft" | "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
type OrderEvent = "Submit" | "Confirm" | "Ship" | "Deliver" | "Cancel";

// Create workflow engine with type parameters
const orderWorkflow = app.workflow<OrderState, OrderEvent>();

// Define the workflow
orderWorkflow.load({
  // Available states
  states: ["Draft", "Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],

  // Available events
  events: ["Submit", "Confirm", "Ship", "Deliver", "Cancel"],

  // Valid transitions
  transitions: [
    {
      from: "Draft",
      to: "Pending",
      on: "Submit",
      task: {
        assign: "sales@example.com",
        message: "New order received: {orderNumber}"
      }
    },
    {
      from: "Pending",
      to: "Confirmed",
      on: "Confirm",
      task: {
        assign: "warehouse@example.com",
        message: "Order {orderNumber} ready for processing"
      }
    },
    {
      from: "Confirmed",
      to: "Shipped",
      on: "Ship",
      task: {
        assign: "logistics@example.com",
        message: "Order {orderNumber} ready for shipping"
      }
    },
    // Additional transitions...
  ],

  // Initial state
  initial: "Draft"
});
```

##### Creating Workflow Handlers

The workflow engine makes it easy to create API endpoints that handle state transitions:

```typescript
// Create a workflow handler for order transitions
orderWorkflow.createHandler("/orders/:id/transitions", (ctx) => {
  if (!ctx.validated.params.ok || !ctx.validated.body.ok) {
    utils.handleError(ctx, 400, "Invalid request");
    return;
  }

  const orderId = ctx.validated.params.value.id;
  const event = ctx.validated.body.value.event;
  const { instance } = ctx.workflow;

  // Apply the transition
  const success = utils.applyTransition(instance, event);

  if (!success) {
    utils.handleError(ctx, 400, "Invalid transition", {
      currentState: instance.currentState,
      requestedEvent: event
    });
    return;
  }

  // Return the updated state with HATEOAS links
  ctx.response = utils.createResponse(ctx, {
    state: instance.currentState,
    history: instance.history,
    tasks: utils.getPendingTasks(instance)
  }, {
    links: utils.createLinks('orders', orderId)
  });
});
```

##### Workflow History and Audit Trails

The workflow engine automatically maintains a history of state transitions, providing a complete audit trail:

```typescript
// Example of workflow history
{
  "history": [
    {
      "from": "Draft",
      "to": "Pending",
      "at": "2023-06-15T14:30:22.123Z",
      "by": "user@example.com",
      "comments": "Initial submission"
    },
    {
      "from": "Pending",
      "to": "Confirmed",
      "at": "2023-06-16T09:15:43.456Z",
      "by": "manager@example.com",
      "comments": "Approved by management"
    }
  ]
}
```

##### Multiple Workflows

You can define multiple workflows for different domains in your application:

```typescript
// Order workflow
const orderWorkflow = app.workflow<OrderState, OrderEvent>();
orderWorkflow.load(orderWorkflowDefinition);

// User onboarding workflow
type UserState = "New" | "Verified" | "Active" | "Suspended";
type UserEvent = "Verify" | "Activate" | "Suspend" | "Reinstate";

const userWorkflow = app.workflow<UserState, UserEvent>();
userWorkflow.load(userWorkflowDefinition);
```

#### 5. HTMX Integration for Interactive UIs

Mixon provides first-class support for [HTMX](https://htmx.org), allowing you to build interactive web applications with minimal JavaScript. This integration enables a modern development approach where most of your UI logic stays on the server, resulting in simpler, more maintainable applications.

##### What is HTMX?

HTMX is a library that allows you to access modern browser features directly from HTML, rather than using JavaScript. It lets you make AJAX requests, trigger WebSocket connections, and perform DOM updates using simple HTML attributes.

##### Server-Side Rendering with HTMX

Mixon combines server-side rendering with HTMX to create dynamic, interactive UIs:

```typescript
/** @jsx h */
import { h, renderSSR } from "nano";
import { App } from "jsr:@srdjan/mixon";

const app = App();

// Product list route
app.get("/products", (ctx) => {
  const html = renderSSR(
    <div class="product-grid">
      {products.map((product) => (
        <div class="product-card">
          <h3 class="product-name">{product.name}</h3>
          <div class="product-price">${product.price}</div>
          <p class="product-description">{product.description}</p>
          <button
            type="button"
            class="btn"
            hx-get={`/api/fragments/product-detail/${product.id}`}
            hx-target="#content"
          >
            View Details
          </button>
        </div>
      ))}
    </div>
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
});
```

##### HTMX API Endpoints

Mixon makes it easy to create API endpoints that return HTML fragments for HTMX to swap into the DOM:

```typescript
// Increment counter endpoint
app.get("/api/increment", (ctx) => {
  let currentValue = 1;
  if (ctx.validated.query.ok && ctx.validated.query.value.value) {
    currentValue = parseInt(ctx.validated.query.value.value, 10);
  }
  const newValue = Math.min(currentValue + 1, 10);

  ctx.response = new Response(
    `<input type="number" id="quantity" name="quantity" value="${newValue}" min="1" max="10">`,
    { headers: { "Content-Type": "text/html" } }
  );
});

// Click counter demo endpoint
app.post("/api/demo/click-counter", (ctx) => {
  // Generate a random number between 1 and 100
  const count = Math.floor(Math.random() * 100) + 1;

  ctx.response = new Response(`Click count: ${count}`, {
    headers: { "Content-Type": "text/html" }
  });
});

// Product detail fragment
app.get("/api/fragments/product-detail/:id", (ctx) => {
  if (!ctx.validated.params.ok) {
    utils.handleError(ctx, 400, "Invalid product ID");
    return;
  }

  const productId = ctx.validated.params.value.id;
  const product = products.find(p => p.id === productId);

  if (!product) {
    utils.handleError(ctx, 404, "Product not found");
    return;
  }

  const html = renderSSR(
    <div class="product-detail">
      <h2>{product.name}</h2>
      <div class="price">${product.price}</div>
      <p class="description">{product.description}</p>
      <div class="actions">
        <button
          class="btn add-to-cart"
          hx-post={`/api/cart/add/${product.id}`}
          hx-target="#cart-count"
        >
          Add to Cart
        </button>
        <button
          class="btn back"
          hx-get="/products"
          hx-target="#content"
        >
          Back to Products
        </button>
      </div>
    </div>
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
});
```

##### Benefits of HTMX with Mixon

1. **Simplified Architecture**: Keep most of your logic on the server
2. **Reduced JavaScript**: Minimal client-side code
3. **Progressive Enhancement**: Works even without JavaScript
4. **Improved Security**: Sensitive logic stays on the server
5. **Better Performance**: Smaller payloads and faster initial load times
6. **Seamless Integration**: Works perfectly with Mixon's content negotiation

##### Real-World HTMX Patterns

Mixon supports common HTMX patterns out of the box:

- **Form Validation**: Server-side validation with inline error messages
- **Infinite Scroll**: Load more content as the user scrolls
- **Active Search**: Real-time search results as the user types
- **Tabs and Pagination**: Switch between content without page reloads
- **Modal Dialogs**: Open and close modals with server-rendered content
- **Progress Indicators**: Show loading states during requests

### Getting Started with Mixon

Getting started with Mixon is straightforward, especially if you're already using Deno:

#### Installation

Mixon is designed for Deno, making installation simple with no package manager required:

```typescript
// Import directly from JSR (recommended)
import { App } from "jsr:@srdjan/mixon";

// Or import specific utilities
import { App, type, match } from "jsr:@srdjan/mixon";
```

#### Create Your First Mixon App

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

#### Project Configuration

Create a `deno.json` file in your project root:

```json
{
  "tasks": {
    "start": "deno run --allow-net --allow-read main.ts",
    "dev": "deno run --watch --allow-net --allow-read main.ts"
  },
  "permissions": {
    "net": true,
    "read": true,
    "write": true
  }
}
```

### Key Features That Set Mixon Apart

#### Performance Optimization

Mixon balances functional programming principles with strategic mutation for optimal performance:

1. **Middleware Optimization**: Fast-path dispatch with O(1) middleware lookup
2. **Router Optimization**: Static route matching with Map-based lookup
3. **Context Mutation**: In-place updates to minimize allocations
4. **Set-Based Deduplication**: Efficient collection operations
5. **Controlled GC Pressure**: Minimized object creation during request processing

#### Comprehensive Error Handling

Mixon provides a Result type inspired by Rust for explicit error handling:

```typescript
// Type-safe error handling
if (!ctx.validated.body.ok) {
  utils.handleError(ctx, 400, "Invalid user data", ctx.validated.body.error);
  return;
}

// Safe access to validated data
const user = ctx.validated.body.value;
```

#### Server-Side Rendering with Nano JSX

Mixon integrates with Nano JSX for efficient server-side rendering:

```typescript
/** @jsx h */
import { h, renderSSR } from "nano";
import { App } from "jsr:@srdjan/mixon";

const app = App();

app.get("/", (ctx) => {
  const html = renderSSR(
    <Layout title="Mixon Framework Demo">
      <Home />
    </Layout>
  );

  ctx.response = new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
});
```

### Conclusion

Mixon represents a fresh approach to web development in the Deno ecosystem, offering a lightweight yet powerful alternative to traditional frameworks. With its focus on type safety, elegant APIs, and modern features like workflow management and HTMX integration, Mixon is well-suited for developers who want to build robust applications without the overhead of larger frameworks.

Whether you're building a simple API or a complex stateful application, Mixon provides the tools you need while staying true to Deno's philosophy of simplicity and security.

Ready to get started? Check out the [full documentation](https://Mixframework.org/docs) or explore the [examples on GitHub](https://github.com/srdjan/mixon).

---

*Crafted with ❤️ by [⊣˚∆˚⊢](https://srdjan.github.io) & DeepSeek*
