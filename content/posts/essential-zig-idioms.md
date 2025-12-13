---
title: Essential Zig Idioms - Writing Code That Feels Like Zig
date: 2024-12-13
tags: [Zig, Systems Programming, Idioms]
excerpt: Zig has its own way of doing things. Here's a collection of patterns that make code feel natural to experienced Zig developers - from anonymous struct literals to arena allocators.
---

Every language has its idioms. Python has list comprehensions. Go has channels and goroutines. Rust has pattern matching and trait bounds everywhere.

Zig? Zig has its own vocabulary. I explored Zig idioms for a while now, and to me is interesting how consistent they are. Each pattern reinforces the same principles: be explicit, let the compiler help you, don't hide what's happening. Here are the patterns that show up everywhere in idiomatic Zig code.

## The `&.{` Pattern - Anonymous Struct Literals

This one appears so often in Zig code that it almost looks like its own syntax. Look at this:

```zig
// You could do this...
const config = .{
    .timeout = 5000,
    .retries = 3,
    .debug = true,
};
someFunction(&config);

// But idiomatic Zig does this instead
someFunction(&.{
    .timeout = 5000,
    .retries = 3,
    .debug = true,
});
```

The `&.{` creates an anonymous struct literal and immediately takes its address. One line instead of two. No intermediate variable cluttering scope. The struct exists just long enough to pass to the function.

Here's the cool part: the compiler infers the struct type from what the function expects. You don't declare types anywhere - it just works.

## Compiler-Inferred Arrays: `[_]T{...}`

When you need an array but don't want to count elements manually:

```zig
// Counting is error-prone
const colors: [3][]const u8 = .{ "red", "green", "blue" };

// Let the compiler count for you
const colors = [_][]const u8{ "red", "green", "blue" };
```

The underscore tells the compiler "figure out the size from the initializer." Add or remove elements, the type adjusts. Simple.

## Error Handling with `try`

Zig's error handling is explicit but doesn't require ceremony. The `try` keyword unwraps error unions and returns early if something fails:

```zig
fn readFile() ![]u8 {
    const file = try std.fs.cwd().openFile("data.txt", .{});
    defer file.close();

    return try file.readToEndAlloc(std.heap.page_allocator, 64 * 1024);
}
```

No separate `if err != nil` checks. No exception handling blocks. The `try` does the unwrapping and early return in one keyword. Function signature declares `![]u8` - success returns bytes, failure returns an error.

This works beautifully when operations chain together. Each `try` is a potential exit point, visible right in the code.

## The `orelse` Pattern

For optional values, `orelse` provides defaults or short-circuit evaluation:

```zig
// Default value
const port = std.process.getEnvVarOwned(allocator, "PORT") orelse "8080";

// Early return on missing value
const result = maybeValue() orelse return error.NoValue;
```

Similar to Rust's `unwrap_or` or Swift's nil-coalescing, but reads naturally. "Get the value, or else do this."

## While Loops with Capture

Iterating over optional chains - like linked lists - uses a pattern that feels strange at first but becomes second nature:

```zig
var node = head;
while (node) |current| {
    doSomething(current.data);
    node = current.next;
}
```

The `|current|` captures the unwrapped optional. Loop continues while `node` is non-null, and `current` gives you the unwrapped value inside. No sentinel values, no null checks scattered through the body.

## Exhaustive Switch

Zig requires switch statements to cover all cases:

```zig
const result = switch (status) {
    .success => "OK",
    .error => "Failed",
    .pending => "Waiting",
};
```

Add a new enum variant? Compiler tells you everywhere you forgot to handle it. This catches bugs at compile time that would be runtime errors in other languages.

## Resource Management: `defer` and `errdefer`

The `defer` statement runs when the scope exits. The `errdefer` variant only runs when exiting with an error:

```zig
fn processFile() !void {
    const file = try openFile("data.txt");
    defer file.close();  // Always runs

    const lock = acquireLock();
    errdefer releaseLock(lock);  // Only on error path

    try doWork(file);
    releaseLock(lock);  // Explicit on success
}
```

This means resources get cleaned up in both paths. No finally blocks, no RAII wrappers. Just declare cleanup at allocation site and forget about it.

## Arena Allocation

When you need temporary memory that all gets freed together, arena allocators are the idiomatic choice:

```zig
var arena = std.heap.ArenaAllocator.init(allocator);
defer arena.deinit();
const alloc = arena.allocator();

// All these allocations freed at once
const data = try alloc.alloc(MyStruct, 100);
const more = try alloc.alloc(u8, 1024);
const strings = try alloc.alloc([]const u8, 50);
```

One `defer arena.deinit()` cleans everything. Perfect for request handlers, parsers, or any scope with lots of temporary allocations.

## Comptime - The Power Move

Zig's compile-time execution lets you generate code and data structures at compile time:

```zig
fn createLookupTable(comptime size: usize) [size]bool {
    var table: [size]bool = undefined;
    comptime var i = 0;
    inline while (i < size) : (i += 1) {
        table[i] = isSpecialIndex(i);
    }
    return table;
}
```

The `comptime` keyword means this runs during compilation. Zero runtime cost for generating lookup tables, string processing, or type manipulation.

## Struct Namespaces

Zig uses structs to group related functions, like namespaces in other languages:

```zig
const MathUtils = struct {
    pub fn add(a: i32, b: i32) i32 {
        return a + b;
    }

    pub fn multiply(a: i32, b: i32) i32 {
        return a * b;
    }
};

const result = MathUtils.add(5, 3);
```

Not classes - no inheritance, no `this`. Just functions grouped under a name. Clean organization without object-oriented baggage.

## Real Talk: The Learning Curve

These idioms are consistent and powerful once you know them. But the learning curve exists.

The `&.{` pattern confused me for weeks. Reading Zig code requires learning this vocabulary - it's not immediately obvious what `try`, `orelse`, and `|capture|` do if you're coming from C or Python.

Error handling being explicit means more characters typed. No exceptions means you handle errors at every call site or explicitly propagate them. This is by design - Zig values explicitness over convenience.

Comptime is incredibly powerful but can produce inscrutable compile errors when something goes wrong. Debugging compile-time code requires different mental models than runtime debugging.

## The Payoff

Here's what you get in return: code that says exactly what it does. No hidden control flow. No implicit allocations. No exceptions bubbling up from somewhere. Every error path is visible. Every allocation has a corresponding free.

These idioms make Zig code readable once you learn them. You can look at a function and understand its complete behavior - what it allocates, when it frees, what errors it returns, how control flows.

This means Zig code is maintainable in ways that feel different from higher-level languages. Less magic means fewer surprises six months later when you forgot how something worked.

I've been using these patterns in a few side projects, and they grow on you. The explicitness that feels verbose at first becomes clarity. The compiler catches mistakes that would be runtime bugs elsewhere.

Worth learning if you're doing systems work or want to understand what your code actually does.
