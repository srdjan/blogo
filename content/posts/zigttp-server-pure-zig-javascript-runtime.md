---
title: "zigttp: Building a JavaScript Runtime from Scratch in Zig"
date: 2026-01-02
tags: [Zig, JavaScript, Serverless, Performance, TypeScript]
excerpt: A serverless JavaScript runtime with sub-millisecond cold starts, 500KB footprint, TypeScript support, and compile-time evaluation - all written from scratch in pure Zig.
---

Let's start 2026 with a bang! What if I told you about JavaScript runtime could cold start in under a millisecond?

> This is an experiment, and we'll have to wait and see how far it goes... It started by an attempt to port a new JavaScript engine mQuickJS to Zig. It quickly became a project of its own. Developed in last two (intense) weeks, while on vacation, with my dev team (Clodi and Gipiti). The code is available on [GitHub][def]

We live in magical times - this would not be possible to do in the same timeframe just few months ago: introducing **zigttp** - a serverless JavaScript runtime written entirely in Zig. Not a wrapper around V8 nor a transpiler. An almost complete JavaScript engine from scratch, optimized for one thing: spinning up fast and handling HTTP requests.

The numbers still surprise me: sub-millisecond cold starts, 256KB memory baseline, ~500KB total binary size. Zero dependencies. This is what happens when you build a runtime for a specific purpose instead of trying to be everything to everyone.

## The Cold Start Problem

Serverless promises instant scalability. What it actually delivers is a hidden tax called cold starts. When Node.js or Deno spins up a new instance, you're waiting for V8 to initialize (50-200ms), modules to load and parse (often another 100ms+), and the runtime to allocate its baseline memory (50MB minimum).

For most applications, this is fine. For latency-sensitive stuff - API gateways, edge computing, real-time processing - every cold start is a user waiting. This reminds me of F1 pit stops: when you're measuring in milliseconds, everything matters.

Here's the comparison that got me excited:

| Metric | Node.js/Deno | zigttp |
|--------|--------------|--------|
| Cold start | 50-200ms | < 1ms |
| Memory baseline | 50MB+ | 256KB |
| Binary size | 50MB+ | ~500KB |
| Dependencies | npm ecosystem | Zero |

## The zts Engine: JavaScript from First Principles

At the heart of zigttp is **zts** - about 30,000 lines of Zig implementing a complete JavaScript engine. Here's the cool part: it's not trying to be V8. It's trying to be fast at one specific pattern: receive request, execute handler, return response, reset.

### Compilation Pipeline

The compilation pipeline looks like this:

```
.ts/.tsx Source -> Type Stripper -> comptime() Eval ─┐
                                                     ├─> Tokenizer -> Parser -> Bytecode
.js/.jsx Source ─────────────────────────────────────┘
```

For TypeScript files, the stripper removes type annotations while preserving line numbers. The comptime evaluator then replaces `comptime(...)` expressions with literal values. After that, it's the same path as JavaScript: tokenize, parse with scope analysis, emit bytecode.

The scope analyzer identifies variable bindings and closure captures at parse time. This means no runtime scope chain lookups - we know exactly where every variable lives before execution starts.

### NaN-Boxing: Everything Fits in 64 Bits

Every JavaScript value fits in a single 64-bit word. Look at this:

```zig
// Tag encoding in low 3 bits
Tag.int = 0      // 31-bit signed integer (zero allocation)
Tag.ptr = 1      // Heap object pointer
Tag.special = 3  // null, undefined, true, false
Tag.float = 5    // Heap-boxed Float64
```

Integers, booleans, null, undefined require zero heap allocation. Values pass in CPU registers. Type checks are single-cycle bit operations. This is surprisingly elegant - you get dynamic typing without paying for it on every operation.

### Generational GC with SIMD Sweep

The garbage collector uses a generational approach:

```zig
GCConfig {
    nursery_size: 4MB,        // Young generation - bump allocation
    tenured_size: 16MB,       // Old generation - mark-sweep
    survival_threshold: 2,    // Promote after 2 collections
    simd_sweep: true,         // SIMD-accelerated sweep phase
}
```

The nursery uses bump allocation - each allocation is literally one pointer increment. Objects that survive two collections get promoted to tenured heap. The sweep phase uses SIMD to process 256 objects per vector operation.

### V8-Style Hidden Classes

Objects share "shapes" that describe their property layout:

```
Object {x: 1} -> HiddenClass A (properties: [x @ slot 0])
Object {x: 1, y: 2} -> HiddenClass B (properties: [x @ slot 0, y @ slot 1])
```

Property access sites cache the hidden class and slot offset. If an object has the cached shape, property lookup is one memory load. No hash table traversal. This technique is borrowed from V8, and it works beautifully.

## TypeScript Without the Build Step

Here's something I'm genuinely excited about: native TypeScript support. Not transpilation - type stripping at load time. You get the editor experience of TypeScript with the runtime simplicity of JavaScript.

```typescript
interface User {
    id: number;
    name: string;
}

function handler(request: Request): Response {
    const user: User = { id: 1, name: "Alice" };
    return Response.json(user);
}
```

The stripper runs in a single pass, replacing type syntax with spaces (to preserve line numbers for error messages). No AST construction, no type checking - just surgical removal of type annotations.

What's supported:
- Type and interface declarations
- Parameter and return type annotations
- Generic parameters on functions and types
- `as` and `satisfies` assertions
- `import type` / `export type`

What's not supported (and will error clearly):
- `enum` and `const enum`
- `namespace` and `module`
- Decorators
- Class access modifiers

This means you can write handlers in TypeScript for the developer experience, and the runtime strips types without needing a build step. Like a good espresso - simple on the surface, complex underneath.

## Compile-Time Evaluation: The comptime() Function

This is one of my favorite parts. Zig has `comptime` for compile-time evaluation, and I wanted something similar for JavaScript constants. It is just rudamentary now, but it is extensible.

```typescript
// Basic arithmetic - evaluated at load time
const x = comptime(1 + 2 * 3);              // -> const x = 7;

// String operations
const upper = comptime("hello".toUpperCase()); // -> const upper = "HELLO";
const parts = comptime("a,b,c".split(","));    // -> const parts = ["a","b","c"];

// Math functions
const pi = comptime(Math.PI);               // -> const pi = 3.141592653589793;
const max = comptime(Math.max(1, 5, 3));    // -> const max = 5;

// Hash function for ETags
const etag = comptime(hash("content-v1"));  // -> const etag = "a1b2c3d4";

// Even works in TSX
const el = <div>{comptime(1+2)}</div>;      // -> <div>{3}</div>
```

The evaluator implements a Pratt parser with full operator precedence, all Math functions, string methods, and even JSON.parse. Non-deterministic operations like `Date.now()` and `Math.random()` are explicitly disallowed - comptime must be reproducible.

For now, this feature enables patterns like:

```typescript
// Build-time constants
const BUILD_TIME = comptime(__BUILD_TIME__);
const VERSION = comptime(__VERSION__);

// Pre-computed lookup tables
const LOOKUP = comptime({
    "GET": 1,
    "POST": 2,
    "PUT": 3,
    "DELETE": 4
});

// Content hashing for cache keys
const STATIC_ETAG = comptime(hash("v1.2.3-" + "main.css"));
```

## Benchmarks: zts vs mQuickJS

I benchmarked zts against mQuickJS (the WebAssembly-compiled QuickJS). The results are mixed - honest assessment here:

| Operation | zts | mQuickJS | Ratio |
|-----------|-----|----------|-------|
| String operations | 7.8M ops/sec | 258K ops/sec | **30x faster** |
| Object creation | 4.7M ops/sec | 1.7M ops/sec | **2.8x faster** |
| HTTP handler | 912K ops/sec | 332K ops/sec | **2.7x faster** |
| Property access | 6.1M ops/sec | 3.4M ops/sec | **1.8x faster** |
| Function calls | 6.2M ops/sec | 5.1M ops/sec | 1.2x faster |
| GC pressure | 256K ops/sec | 229K ops/sec | 1.1x faster |
| JSON ops | 70K ops/sec | 71K ops/sec | At parity |
| Integer arithmetic | 6.3M ops/sec | 16.1M ops/sec | 0.4x (slower) |
| for...of loops | 11.9M ops/sec | 54.8M ops/sec | 0.2x (slower) |

**Where zts shines**: String operations (30x!), object creation, HTTP handlers - exactly what you need for request processing. The hidden class optimization pays off big time for property access patterns common in HTTP handlers.

**Where mQuickJS wins**: Integer arithmetic and loop iteration. QuickJS has had years of optimization work on its bytecode interpreter. These benchmarks use tight numeric loops that play to QuickJS's strengths.

**What this means for real handlers**: HTTP request/response patterns hit zts's sweet spots. The 2.7x advantage on HTTP handler throughput is what matters for serverless functions.

## Runtime Architecture: Warm Instances, Cold Isolation

Each request gets an isolated runtime - separate GC state, independent heap, fresh execution context. But here's the trick: runtimes are pooled and reset between requests.

```
                    +-----------------+
   Request 1 -----> | Runtime Pool    |
   Request 2 -----> | [R1][R2]...[Rn] | -----> Handler Execution
   Request 3 -----> +-----------------+
                           |
                    Acquire/Release
```

You get the isolation guarantees of a fresh runtime with the speed of a warm one. No cross-request garbage, no shared state leaking between handlers.

### The Handler API

Handlers follow the Deno/Cloudflare Workers pattern - if you've worked with either, this looks familiar:

```javascript
function handler(req: Request): Response {
    const data = { name: "World", count: 42 } as RequestData;
    const result: ResponseData = processData(data);
    return Response.json(result);
}

```


Built-in Response helpers handle the common cases: `Response.json()`, `Response.text()`, `Response.html()`, `Response.redirect()`.

### Native JSX Support

JSX transforms with no build step:

```jsx
function Page({ title }) {
    return (
        <html>
            <head><title>{title}</title></head>
            <body>
                <h1>Welcome to {title}</h1>
            </body>
        </html>
    );
}

function handler(request) {
    return Response.html(renderToString(<Page title="zigttp" />));
}
```

The JSX transformer is a single-pass tokenizer-to-hyperscript converter. No AST construction, no external tools.

## Real Talk: What's Not Here

The power comes from what we left out:

**No async/await.** FaaS handlers are synchronous by design. You receive a request, you return a response. If you need to call external services, you do it synchronously. This eliminates entire categories of complexity.

**No full Date API.** Just `Date.now()`. You get timestamps without the timezone complexity. For request handlers, this is usually all you need.

**No array holes.** Dense arrays only. Predictable memory layout, faster iteration.

**No Proxy/Reflect.** Not needed for request handlers, and they add significant interpreter complexity.

This is intentional scoping, not missing features. Every omission reduces code paths and attack surface.

## Why Zig?

Zig gives you what you need for a high-performance runtime without the ceremony:

- **No hidden allocations** - every allocation is explicit
- **Comptime metaprogramming** - atom tables and dispatch tables built at compile time
- **SIMD intrinsics** - first-class vector operations for string search and GC sweep
- **No runtime** - zero startup cost, no GC pause from the language itself

The result is a runtime where you control every byte of memory and every cycle of execution.

## Getting Started

```bash
# Build
zig build -Doptimize=ReleaseFast

# Run with inline handler
./zig-out/bin/zigttp -e "function handler(req) { return Response.json({ok: true}); }"

# Run with TypeScript file
./zig-out/bin/zigttp examples/handler.ts -p 3000

# Run with JSX/TSX
./zig-out/bin/zigttp examples/handler.tsx -p 3000

# Options
-p, --port      Port (default: 8080)
-m, --memory    JS heap size (default: 256k)
-n, --pool      Runtime pool size (default: 8)
--cors          Enable CORS headers
--static        Serve static files from directory
```

## Where It Shines, Where It Doesn't

**Works beautifully for:**
- Edge computing where cold starts matter
- Simple API handlers and webhooks
- Server-side rendering with JSX/TSX
- IoT gateways and CDN edge nodes

**Falls apart (for now) when:**
- You need async I/O (database queries, external API calls with await)
- You depend of npm packages (no module system yet)
- You need full ES6+ features (generators, async iterators)
- You need the complete Date or Intl APIs

For the right use case - fast, isolated, stateless handlers - this approach works beautifully, if it ever reaches the maturity, of course. For now, you better stick with Deno, Bun or Node for production workloads.

---

*zigttp is experimental and under active development. The code is available on [GitHub][def].*


[def]: https://github.com/srdjan/zigttp