---
title: "Building an API Gateway with zigttp Virtual Modules"
date: 2026-03-08
tags: [Zig, JavaScript, Performance, zigttp]
excerpt: Virtual modules expose native Zig implementations through standard ES module syntax - zero interpretation overhead for routing, auth, validation, and caching. Here's how to wire them into a real API gateway.
---

> This post covers virtual modules - an incoming feature specific to [zigttp](https://github.com/srdjan/zigttp), the experimental JavaScript runtime we've been building from scratch in Zig. If you haven't seen the introductory post, [start there](/blog/zigttp-server-pure-zig-javascript-runtime) for context on the runtime itself, its architecture, and why we built it.

Every JavaScript runtime pays an interpretation tax. For business logic and orchestration, that's a reasonable trade - you get flexibility, fast iteration, and a massive ecosystem. But for cryptographic operations, routing, validation, and caching? You're burning cycles interpreting code whose behavior is entirely deterministic.

I worked with this idea for a while now, and to me is interesting where the line falls. It's not "JS bad, native good." It's more precise than that: deterministic operations with stable contracts have no reason to be interpreted. Everything else - the messy, evolving, business-specific stuff - is exactly where dynamic languages earn their keep.

zigttp's virtual modules flip the performance story around. They expose native Zig implementations through standard ES module syntax:

```js
import { env } from "zigttp:env";
import { sha256 } from "zigttp:crypto";
import { routerMatch } from "zigttp:router";
```

No N-API bindings. No npm dependencies. No marshaling overhead. The `zigttp:` prefix signals that you've crossed into native territory - but the developer experience stays familiar. You import, you call, you get results. The function just happens to execute as compiled Zig instead of interpreted JavaScript.

In this post, we'll build a small but realistic API gateway that uses five virtual modules together. Then we'll look at where else this pattern goes - authorization, payments, observability - because once you see the dividing line, you start noticing deterministic operations everywhere.

## The Architecture

Our gateway does four things:

1. Routes incoming requests to handlers
2. Authenticates via JWT bearer tokens
3. Validates request bodies against JSON Schema
4. Rate-limits by client IP using an in-memory cache

Every one of these operations is deterministic - well-defined inputs, well-defined outputs, no reason for an interpreter to be in the loop. Here's the flow:

```
Request
  -> routerMatch (zigttp:router)
  -> parseBearer + jwtVerify (zigttp:auth)
  -> validateJson (zigttp:validate)
  -> cacheGet/cacheSet (zigttp:cache) for rate limiting
  -> Handler (your JS business logic)
```

## Setup

```bash
zigttp init api-gateway
cd api-gateway
```

Your entry point is `index.js`. Virtual modules are available out of the box - no install step, no config. The `zigttp:` namespace is baked into the runtime.

## Step 1: Configuration via zigttp:env

Start with the basics. Pull configuration from environment variables rather than hardcoding secrets.

```js
import { env } from "zigttp:env";

const config = {
  jwtSecret: env("JWT_SECRET"),
  port: parseInt(env("PORT") || "3000", 10),
  rateLimitMax: parseInt(env("RATE_LIMIT_MAX") || "100", 10),
  rateLimitWindowSec: parseInt(env("RATE_LIMIT_WINDOW") || "60", 10),
};
```

`env()` reads the process environment in native Zig - no `process.env` proxy, no getter traps. A small thing, but it sets the pattern: cross into native for the lookup, return to JS with the value.

## Step 2: Routing with zigttp:router

Define your route table and let the native pattern matcher handle dispatch.

```js
import { routerMatch } from "zigttp:router";

const routes = [
  { method: "GET",  path: "/api/users",      handler: "listUsers" },
  { method: "GET",  path: "/api/users/:id",   handler: "getUser" },
  { method: "POST", path: "/api/users",       handler: "createUser" },
  { method: "POST", path: "/api/webhooks",    handler: "handleWebhook" },
  { method: "GET",  path: "/api/products",    handler: "listProducts" },
  { method: "GET",  path: "/api/products/:id", handler: "getProduct" },
];

function dispatch(req) {
  const match = routerMatch(routes, req.method, req.url);

  if (!match) {
    return { status: 404, body: { error: "Not found" } };
  }

  // match.handler is the string key, match.params has extracted path params
  return handlers[match.handler](req, match.params);
}
```

Here's the cool part: `routerMatch` does radix-tree matching in Zig. Path parameter extraction (`:id` to `params.id`) happens at the native layer. Your JS code receives the result - it never does the parsing.

Most JS routers compile route patterns into regex at startup and match against them on every request. That works, but regex matching is interpretive work. A radix tree compiled into native code is just pointer chasing - orders of magnitude faster when you have dozens of routes.

## Step 3: JWT Authentication with zigttp:auth

This is where the performance story gets interesting. JWT verification involves HMAC-SHA256, base64 decoding, and JSON parsing - all deterministic, all faster in native code.

```js
import { parseBearer, jwtVerify } from "zigttp:auth";

function authenticate(req) {
  const token = parseBearer(req.headers.authorization);

  if (!token) {
    return { ok: false, error: "Missing bearer token" };
  }

  const result = jwtVerify(token, config.jwtSecret);

  if (!result.valid) {
    return { ok: false, error: result.error };
  }

  return { ok: true, claims: result.payload };
}
```

`parseBearer` extracts the token from the `Authorization` header. `jwtVerify` validates the signature, checks expiration, and returns the decoded payload - all in Zig. The JS layer receives a plain object it can immediately work with.

For routes that don't need auth (like webhooks with their own signature verification), you skip this entirely. The `zigttp:auth` module also exports `verifyWebhookSignature` for HMAC-based webhook validation and `timingSafeEqual` for constant-time comparison - useful building blocks that all share the same property: deterministic, crypto-heavy, no reason to interpret.

## Step 4: Request Validation with zigttp:validate

Validate incoming payloads against JSON Schema - compiled once, applied per request.

```js
import { schemaCompile, validateJson } from "zigttp:validate";

const schemas = {
  createUser: schemaCompile({
    type: "object",
    required: ["email", "name"],
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 1, maxLength: 200 },
      role: { type: "string", enum: ["admin", "member", "viewer"] },
    },
    additionalProperties: false,
  }),
};

function validateBody(schemaKey, body) {
  const result = validateJson(schemas[schemaKey], body);

  if (!result.valid) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, data: result.data };
}
```

`schemaCompile` returns an opaque handle - the compiled schema lives in Zig memory. `validateJson` takes that handle and a JSON string, returning validation results without round-tripping through a JS validator. The compilation happens once at startup. Every subsequent validation is pure native execution against the pre-compiled schema.

## Step 5: Rate Limiting with zigttp:cache

The cache module gives you an in-memory key-value store with TTL and LRU eviction - exactly the right primitives for a rate limiter.

```js
import { cacheGet, cacheSet, cacheIncr } from "zigttp:cache";

function rateLimit(clientIp) {
  const key = `rl:${clientIp}`;
  const current = cacheIncr(key, 1);

  if (current === 1) {
    // First request in window - set TTL
    cacheSet(key, "1", { ttl: config.rateLimitWindowSec });
  }

  if (current > config.rateLimitMax) {
    const existing = cacheGet(key);
    return {
      ok: false,
      retryAfter: existing?.ttl || config.rateLimitWindowSec,
    };
  }

  return { ok: true, remaining: config.rateLimitMax - current };
}
```

`cacheIncr` is atomic. `cacheSet` with TTL handles expiration. The entire rate-limiting check runs in Zig - your JS code just reads the result and decides what to do.

The Zig cache is a purpose-built hash map with no garbage collector involvement. There's almost nothing between you and the data. This is the kind of operation where interpreted overhead dominates: each cache lookup in Node.js involves property access, prototype chain traversal, and GC tracking for every intermediate object. The native version is just a hash computation and a pointer dereference.

## Wiring It Together

Here's the full gateway pipeline:

```js
import { env } from "zigttp:env";
import { routerMatch } from "zigttp:router";
import { parseBearer, jwtVerify } from "zigttp:auth";
import { schemaCompile, validateJson } from "zigttp:validate";
import { cacheGet, cacheSet, cacheIncr } from "zigttp:cache";

// ... config, schemas, rateLimit, authenticate, validateBody as above ...

const publicRoutes = new Set(["handleWebhook"]);
const validatedRoutes = { createUser: "createUser" };

export default {
  fetch(req) {
    // 1. Route
    const match = routerMatch(routes, req.method, req.url);
    if (!match) return json(404, { error: "Not found" });

    // 2. Rate limit
    const rl = rateLimit(req.headers["x-forwarded-for"] || req.ip);
    if (!rl.ok) {
      return json(429, { error: "Too many requests", retryAfter: rl.retryAfter });
    }

    // 3. Authenticate (if not public)
    if (!publicRoutes.has(match.handler)) {
      const auth = authenticate(req);
      if (!auth.ok) return json(401, { error: auth.error });
      req.claims = auth.claims;
    }

    // 4. Validate body (if schema exists)
    if (validatedRoutes[match.handler]) {
      const validation = validateBody(validatedRoutes[match.handler], req.body);
      if (!validation.ok) {
        return json(400, { error: "Validation failed", details: validation.errors });
      }
      req.validated = validation.data;
    }

    // 5. Dispatch to handler (this is where JS earns its keep)
    return handlers[match.handler](req, match.params);
  },
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

Notice what JavaScript does here: orchestration. It sequences the middleware steps, makes branching decisions, and calls your business logic. That's exactly what a dynamic language is good at. The if/else flow, the early returns, the set lookups for public routes - this is glue code that changes as your API evolves. It belongs in JS.

Everything else - pattern matching, cryptographic verification, schema validation, atomic cache operations - runs as native Zig.

## Beyond the Gateway: More Virtual Modules

The five modules we used above cover the common API gateway concerns. But the pattern extends naturally to any operation that's deterministic and performance-sensitive. Here are some modules that follow the same philosophy.

### Authorization with zigttp:authz

Authentication tells you who someone is. Authorization tells you what they can do. Policy evaluation is a perfect virtual module candidate: it's rule-based, deterministic, and runs on every request.

```js
import { policyCompile, authorize } from "zigttp:authz";

const policy = policyCompile({
  roles: {
    admin: { permissions: ["users:*", "products:*", "billing:*"] },
    member: { permissions: ["users:read", "products:read", "products:write"] },
    viewer: { permissions: ["users:read", "products:read"] },
  },
  resources: {
    "users:write": { condition: "self_or_admin" },
    "billing:*": { condition: "admin_only" },
  },
});

function checkAccess(claims, resource, action) {
  const result = authorize(policy, {
    role: claims.role,
    userId: claims.sub,
    resource,
    action,
    context: { targetUserId: claims.targetId },
  });

  if (!result.allowed) {
    return { ok: false, error: result.reason };
  }

  return { ok: true };
}
```

`policyCompile` builds an optimized decision tree from your role definitions. `authorize` traverses it with the request context. Wildcard matching, condition evaluation, role hierarchy resolution - all native. Your JS code just asks "can this user do this thing?" and gets a yes/no answer.

This matters because authorization checks happen on every single request, often multiple times per request when you're checking field-level access. At 50K requests/second, even microseconds of policy evaluation overhead add up.

### Payment Signature Verification with zigttp:payments

Payment webhooks from Stripe, PayPal, or any provider need signature verification before you trust the payload. This is cryptographic work - HMAC computation, timestamp validation, replay protection - all deterministic.

```js
import { verifyStripeSignature, verifyPayPalSignature } from "zigttp:payments";

function handlePaymentWebhook(req) {
  const provider = req.headers["x-payment-provider"];

  let verified;
  if (provider === "stripe") {
    verified = verifyStripeSignature({
      payload: req.body,
      signature: req.headers["stripe-signature"],
      secret: config.stripeWebhookSecret,
      tolerance: 300, // 5-minute replay window
    });
  } else if (provider === "paypal") {
    verified = verifyPayPalSignature({
      payload: req.body,
      headers: req.headers,
      webhookId: config.paypalWebhookId,
      certUrl: req.headers["paypal-cert-url"],
    });
  }

  if (!verified?.valid) {
    return json(401, { error: "Invalid webhook signature" });
  }

  // Safe to process - signature verified at native speed
  return processPaymentEvent(verified.event);
}
```

Each provider has its own signature scheme - Stripe uses HMAC-SHA256 with a timestamp prefix, PayPal uses certificate-based verification. The `zigttp:payments` module handles the provider-specific logic in Zig while your JS code handles the business logic: what to do when a payment succeeds, fails, or disputes.

The timestamp tolerance check is particularly important. Stripe signs webhooks with a timestamp, and you need to reject events outside your replay window. Doing this comparison in native code with constant-time operations prevents timing attacks that a JS implementation might be vulnerable to.

### Request Fingerprinting with zigttp:crypto

Beyond the basic `sha256` we mentioned earlier, the crypto module provides primitives for request fingerprinting - useful for deduplication, idempotency keys, and abuse detection.

```js
import { sha256, hmac, fingerprint } from "zigttp:crypto";

// Simple content hashing for cache keys
const cacheKey = sha256(req.url + req.body);

// HMAC for signing outbound requests to downstream services
const signature = hmac("sha256", config.internalSecret, payload);

// Request fingerprinting combines multiple signals
const fp = fingerprint({
  ip: req.ip,
  userAgent: req.headers["user-agent"],
  acceptLanguage: req.headers["accept-language"],
  method: req.method,
  path: req.url,
});
```

`fingerprint` hashes a set of request attributes into a stable identifier. This is useful for bot detection and rate limiting that's smarter than just IP-based. The hashing happens in Zig - you just pass the attributes and get back a hex digest.

### Observability with zigttp:metrics

Metrics collection is another case where interpretation overhead is pure waste. You're incrementing counters, recording histograms, tracking latencies - all numeric operations that happen on every request.

```js
import { counter, histogram, gauge } from "zigttp:metrics";

const requestCount = counter("http_requests_total", ["method", "path", "status"]);
const requestDuration = histogram("http_request_duration_ms", [10, 50, 100, 250, 500, 1000]);
const activeConnections = gauge("http_active_connections");

export default {
  fetch(req) {
    activeConnections.inc();
    const start = performance.now();

    try {
      const response = handleRequest(req);
      requestCount.inc({ method: req.method, path: req.url, status: response.status });
      requestDuration.observe(performance.now() - start);
      return response;
    } finally {
      activeConnections.dec();
    }
  },
};
```

Counter increments, histogram bucket assignments, gauge updates - these are lock-free atomic operations in Zig. The metrics module also handles Prometheus-format serialization natively, so when your `/metrics` endpoint gets scraped, the export is just a memory dump rather than string concatenation in JS.

### Content Negotiation with zigttp:negotiate

Parsing `Accept`, `Accept-Language`, and `Accept-Encoding` headers is surprisingly complex. Quality values, wildcards, parameter matching - all specified in RFC 7231, all deterministic.

```js
import { negotiateContent, negotiateLanguage, negotiateEncoding } from "zigttp:negotiate";

function selectResponse(req) {
  const contentType = negotiateContent(
    req.headers.accept,
    ["application/json", "application/xml", "text/html"]
  );

  const language = negotiateLanguage(
    req.headers["accept-language"],
    ["en", "sr", "de", "fr"]
  );

  const encoding = negotiateEncoding(
    req.headers["accept-encoding"],
    ["gzip", "br", "identity"]
  );

  return { contentType, language, encoding };
}
```

The RFC defines a specific algorithm for quality-value sorting and media-type matching. Implementing it correctly in JS means parsing semicolons, handling wildcards, comparing floating-point quality values. The native module does all of this in a single pass over the header string.

## Benchmarks: What the Native Layer Buys You

Here's a comparison of the hot-path operations in our gateway, measured against equivalent Node.js (v22) and Bun implementations:

| Operation | Node.js | Bun | zigttp (native) | Speedup vs Node |
|---|---|---|---|---|
| JWT verify (HS256) | ~45 us | ~28 us | ~3.8 us | ~12x |
| SHA-256 hash (1KB) | ~12 us | ~7 us | ~0.9 us | ~13x |
| JSON Schema validate | ~85 us | ~62 us | ~8 us | ~10x |
| Route match (50 routes) | ~18 us | ~11 us | ~0.4 us | ~45x |
| Cache get (hit) | ~2.1 us | ~1.4 us | ~0.08 us | ~26x |

*Benchmarked on Apple M2, single-core, 10K iterations, warm cache. Your numbers will vary - the ratios are what matter.*

Routing is the biggest relative win. Radix tree matching in Zig eliminates the overhead that JS regex-based routers carry. At 50 routes, we're talking nanoseconds vs microseconds.

JWT verification adds up fast. At 10K requests/second, the difference between 45us and 3.8us per verification is 412ms of CPU time saved per second. That's not marginal - that's almost half a core freed up just from moving token verification to native code.

The aggregate effect matters more than any single number. In our gateway, a request that needs routing + auth + validation + rate limiting touches four virtual modules. The native path completes the full middleware chain in ~13us. The Node.js equivalent takes ~160us. That's a 12x improvement on the infrastructure overhead before your business logic even runs.

This reminds me of F1 pit stops: the engineering effort goes into the parts that happen thousands of times, because small improvements compound into race-winning advantages.

## The Dividing Line

This isn't about replacing JavaScript. It's about being precise about what deserves interpretation.

Business logic - the handlers that talk to databases, transform domain objects, compose responses - stays in JS. That code changes often, benefits from dynamic typing, and doesn't have a performance-critical inner loop. Nobody is bottlenecked by how fast their "map user to response DTO" function runs.

The virtual module boundary is the dividing line: deterministic operations with stable contracts go native. Everything else stays in the language that's best at evolving fast.

```
+----------------------------------------+
|  JavaScript: Orchestration & Logic     |
|                                        |
|  - Handler composition                 |
|  - Business rules                      |
|  - Database queries                    |
|  - Response shaping                    |
|  - Error handling flow                 |
|  - Feature flags, A/B tests            |
|  - Third-party API integration         |
+----------------------------------------+
|  zigttp:* Native Modules               |
|                                        |
|  - Routing          - Crypto           |
|  - Auth/JWT         - Validation       |
|  - Authorization    - Caching          |
|  - Payment sigs     - Metrics          |
|  - Content neg.     - Env access       |
+----------------------------------------+
```

The question to ask for any operation is: does this behavior ever change at runtime? If the answer is no - if the inputs fully determine the outputs and the contract is stable - it's a candidate for a virtual module. If the answer is yes, or if the logic is evolving weekly, keep it in JS where you can iterate without recompilation.

## Real Talk: Tradeoffs

The virtual module approach works beautifully for the operations we've covered. But it comes with real constraints.

**Debugging is harder.** When a JWT verification fails inside `zigttp:auth`, you get an error message back, but you can't step through the native code with a JS debugger. The boundary between interpreted and native is opaque by design. You need to trust the module's error reporting.

**Custom behavior requires Zig.** If Stripe changes their webhook signature scheme tomorrow, you're waiting for a module update or writing Zig yourself. The native modules encode specific behaviors - they're not pluggable in the way a JS middleware stack is.

**Not all "deterministic" operations benefit equally.** Simple string comparisons or small object transforms are fast enough in JS that the overhead of crossing the native boundary might negate the speedup. The wins are biggest for operations that involve real computation: cryptography, tree traversal, schema evaluation.

**The ecosystem is young.** Node.js has 15 years of battle-tested middleware. zigttp's virtual modules are new. Edge cases that the `jsonwebtoken` npm package handles correctly might not be covered yet.

These are real tradeoffs. For high-throughput API gateways where microseconds matter, the performance gains justify the constraints. For a CRUD app handling 100 requests per minute, you're better off with the ecosystem maturity of Node.js or Deno.

## Next Steps

If you want to dig deeper:

`zigttp:auth` also exports `jwtSign` for token creation - useful if you're building an auth service rather than just consuming tokens.

`zigttp:validate` supports `coerceJson` for type coercion (query params as numbers, for instance) and `schemaDrop` to free compiled schemas if you're doing dynamic schema loading.

`zigttp:cache` exposes `cacheStats` for monitoring hit rates and eviction counts - essential for tuning your LRU size in production.

`zigttp:authz` supports policy hot-reloading via `policyUpdate` - you can push new role definitions without restarting the server.

The pattern extends to anything that fits the profile: deterministic, performance-sensitive, stable interface. The `zigttp:` namespace is the boundary between "interpret this" and "just execute it." Every operation on one side of that line is cycles you're not wasting on interpretation.

---

*The [zigttp source code][def] is on GitHub. The virtual modules are part of the runtime - clone, build, and the `zigttp:` imports work immediately.*

[def]: https://github.com/srdjan/zigttp
