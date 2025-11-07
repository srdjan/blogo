---
title: "Part-2: Memory Safety in Zig Without the Pain?"
date: 2025-11-07
tags: [Zig, Compilers, Fil-C]
excerpt: A practical allocator wrapper that adds Fil-style runtime safety checks where you need them, with zero language changes and minimal code churn. Opt-in, idiomatic, and surprisingly elegant.
---

Here's a question: what if you could get runtime memory safety in Zig—catching use-after-free and out-of-bounds writes—without changing the language, without fat pointers, and without sacrificing performance in your hot paths? I thought, Gipity, my friend may be able to help. So, here it goes: 

One possible way is wrapping Zig's `std.mem.Allocator` with a thin capability-tracking layer. Pass the wrapped allocator to your risky subsystems (parsers, decoders, FFI boundaries), keep the raw allocator everywhere else. You get targeted safety where it matters, zero cost where it doesn't.

Let see how this could work...

## The Core Idea

Zig's allocator interface is simple and explicit—you pass `std.mem.Allocator` to functions that need memory. This is actually perfect for adding optional safety: wrap the allocator, track capabilities on alloc, validate on bulk memory ops, invalidate on free.

The wrapper maintains a side table:

```zig
pub const Cap = struct {
    base: usize,        // region start (address as integer)
    len: usize,         // region length in bytes
    epoch: u32,         // incremented on invalidate
    writable: bool,     // permission bit for write ops
};
```

When you allocate memory, the wrapper registers `{base, len, epoch, writable}`. When you free it, epoch gets incremented—now any checked operation using the old pointer will panic with "epoch mismatch (UAF)". Bulk memory operations (`memcpy`, `memset`, `memmove`) go through checked helpers that validate bounds and epoch before touching memory.

The beauty: it's completely opt-in. Swap allocators for the subsystem you want to harden. Done.

## The Runtime (Intentionally Minimal)

The entire runtime surface is a side table plus a few helpers:

```zig
pub fn capRegister(base: usize, len: usize, writable: bool) void { /* ... */ }
pub fn capInvalidate(base: usize) void { /* epoch++ */ }
pub fn capLookup(addr: usize) ?Cap { /* null if untracked */ }

// Checked primitives for bulk ops (fast path + panic on misuse)
pub fn checkedMemcpy(dst: [*]u8, src: [*]const u8, n: usize) void { /* OOB/UAF guard */ }
pub fn checkedMemset(dst: [*]u8, byte: u8, n: usize) void { /* ... */ }
pub fn checkedMemmove(dst: [*]u8, src: [*]const u8, n: usize) void { /* ... */ }

// (Optional) pointer-add helper for safety-critical arithmetic sites
pub fn checkedPtrAdd(base_ptr: [*]u8, add: usize) [*]u8 { /* ... */ }
```

Implementation note: use a radix tree or flat hash map keyed by page-aligned base. For large allocations, consider guard pages (configurable). Make all functions `inline`/`noinline` strategically to keep hot paths tiny.

That's it. No compiler changes, no special syntax.

## The Allocator Wrapper (Drop-in Compatible)

Here's the interesting bit: we implement all relevant `std.mem.Allocator` vtable methods so the wrapper is completely transparent:

```zig
const std = @import("std");

pub const SafeAlloc = struct {
    inner: std.mem.Allocator,
    enable_checks: bool, // compile-time or runtime switch

    pub fn init(inner: std.mem.Allocator, enable_checks: bool) SafeAlloc {
        return .{ .inner = inner, .enable_checks = enable_checks };
    }

    pub fn allocator(self: *SafeAlloc) std.mem.Allocator {
        return .{
            .ptr = self,
            .vtable = &.{
                .alloc = alloc,
                .resize = resize,
                .free = free,
            },
        };
    }

    fn alloc(ctx: *anyopaque, n: usize, align: u8, ra: usize) ?[*]u8 {
        const self: *SafeAlloc = @ptrCast(@alignCast(ctx));
        const ptr = self.inner.vtable.alloc(self.inner.ptr, n, align, ra) orelse return null;

        if (self.enable_checks) {
            capRegister(@intFromPtr(ptr), n, true);
        }
        return ptr;
    }

    fn free(ctx: *anyopaque, buf: [*]u8, align: u8, ra: usize) void {
        const self: *SafeAlloc = @ptrCast(@alignCast(ctx));
        if (self.enable_checks) {
            capInvalidate(@intFromPtr(buf));
        }
        self.inner.vtable.free(self.inner.ptr, buf, align, ra);
    }

    fn resize(ctx: *anyopaque, buf: [*]u8, align: u8, new_n: usize, ra: usize) bool {
        const self: *SafeAlloc = @ptrCast(@alignCast(ctx));
        // Try in-place resize first
        if (self.inner.vtable.resize(self.inner.ptr, buf, align, new_n, ra)) {
            if (self.enable_checks) {
                // Update len (epoch unchanged if address is stable)
                capRegister(@intFromPtr(buf), new_n, true);
            }
            return true;
        }

        // Fallback: allocate new + copy + free
        const new_ptr = self.inner.vtable.alloc(self.inner.ptr, new_n, align, ra) orelse return false;

        if (self.enable_checks) {
            // Checked copy guards OOB on src and dst using current capability table
            const old_cap = capLookup(@intFromPtr(buf)).?;
            checkedMemcpy(new_ptr, buf, @min(old_cap.len, new_n));
        } else {
            std.mem.copy(u8, new_ptr[0..new_n], buf[0..@min(new_n, new_n)]);
        }

        if (self.enable_checks) capInvalidate(@intFromPtr(buf));
        self.inner.vtable.free(self.inner.ptr, buf, align, ra);

        if (self.enable_checks) capRegister(@intFromPtr(new_ptr), new_n, true);
        return false; // indicate caller should handle realloc pattern
    }
};
```

Look at this—it's just an `Allocator` with a vtable. No syntax changes, no fat pointers. You can slot it anywhere you already pass an allocator.

This feels completely native to Zig because it *is* native to Zig. The allocator pattern is how Zig handles memory—explicit, composable, and under your control.

## How You Actually Use This

The developer experience is surprisingly smooth. Here's opting in per subsystem:

```zig
const std = @import("std");
const safe = @import("safe_alloc.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    var safe_alloc = safe.SafeAlloc.init(gpa.allocator(), /* enable_checks */ true);
    const alloc = safe_alloc.allocator();

    // Pass into just the risky subsystem:
    try runUntrustedParser(alloc);

    // Keep the rest of the app on raw GPA:
    try runInternalFastPath(gpa.allocator());
}
```

Result: only the parser pays for checks. Your internal hot path stays raw and fast.

Typical alloc-and-free pattern:

```zig
const buf = try alloc.alloc(u8, 4096);
// … do work …
alloc.free(buf);
```

If a stale slice survives `free`, a subsequent checked operation will **panic with "epoch mismatch (UAF)"**. You get an immediate, precise failure—not a heisenbug an hour later.

For bulk operations, you can expose a tiny module `safe.mem` that aliases either checked or raw versions based on a build flag:

```zig
if (enable_checks) checkedMemcpy(dst.ptr, src.ptr, len)
else std.mem.copy(u8, dst[0..len], src[0..len]);
```

## What the Wrapper Actually Guarantees

Here's what we track and check:

| Operation           | What we record                             | What we check                                                     | Failure |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------- | ------- |
| `alloc`             | `{base,len,epoch=0,writable}`              | —                                                                 | —       |
| `free`              | epoch++ (invalidate)                       | —                                                                 | —       |
| `resize` in-place   | update `len`                               | —                                                                 | —       |
| `resize` reallocate | register new, invalidate old; checked copy | OOB on src/dst; UAF                                               | panic   |
| `memcpy/move/set`   | —                                          | (1) bounds inside `len` (2) epoch fresh (3) `writable` for writes | panic   |
| FFI import/export   | manual `capRegister`/`capInvalidate`       | same as above                                                     | panic   |

To me is interesting that we only guarantee safety for operations that route through the wrapper—allocator and checked memory ops. If you do raw pointer arithmetic and loads/stores directly, those remain unchecked. But that's exactly why this allocator is the pragmatic baseline: minimal friction, maximum coverage for the typical bug sources (bulk copies, resizes, frees).

## Performance Knobs

You control the overhead:

- **Enable per module**: pass different allocators to different subsystems
- **Enable per build**: toggle in `build.zig`:
  ```zig
  exe.addOption(bool, "enable_fil_safety", true);
  ```
- **Redzones** (big blocks only): add guard pages with OS-backed pages on sizes ≥ threshold
- **Fast path inlining**: common cases perform a single table lookup + branch
- **Table choice**: radix tree for predictable O(1) vs hash map for compactness

## What Happens When You Mess Up

Here's a typical bug:

```zig
const alloc = safe_alloc.allocator();
var a = try alloc.alloc(u8, 16);
defer alloc.free(a);

// BUG: write past end via bulk op
if (enable_checks) checkedMemset(a.ptr, 0xaa, 32)
else std.mem.set(u8, a[0..32], 0xaa);
```

Checked mode output:

```
panic: fil: write out-of-bounds
  addr=0x105004820 len=32 region=[0x105004820..0x105004830) epoch=0 writable=true
  at safe_mem.zig:123: checkedMemset
  at main.zig:45
```

Immediate, precise failure with full context. This is what makes it useful in practice—you catch bugs the moment they happen, not when they corrupt memory three layers up.

## Real Talk: Tradeoffs

This approach works beautifully for:

- FFI boundaries where you're dealing with C libraries
- Parsers and decoders processing untrusted input
- Network buffers and protocol implementations
- Test harnesses (turn `enable_checks=true` in CI, catch OOB/UAF early)

It falls short when:

- You need comprehensive memory safety everywhere (use Rust instead)
- Your hot path can't afford a single table lookup + branch (keep it on raw allocator)
- You're doing lots of raw pointer arithmetic outside bulk ops (checks won't catch those)

Common pitfalls:

| Pitfall                              | Symptom                       | Remedy                                                                            |
| ------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Mixed allocators for the same buffer | Free panics: "unknown region" | Standardize allocator for each ownership domain                                   |
| Incomplete `resize` semantics        | Misleading success return     | Prefer explicit realloc pattern if your Zig version's `resize` contract is strict |
| Bypassing bulk ops                   | Silent raw pointer writes     | Funnel sensitive code through helper `safe.mem` (compile-time aliasing)           |
| FFI returns untracked memory         | Panic on first checked op     | Wrap with `capRegister` on receipt; `capInvalidate` when ownership ends           |

## Why This Feels Right for Zig

The allocator-centric extension is a first-class Zig idiom. You already pass allocators everywhere—swapping them is natural and explicit. Zero changes to types or syntax, no fat pointers, no new keywords, no borrow system.

It's opt-in safety: you decide where to pay the cost. This keeps Zig's "you own the sharp tools" philosophy intact. The wrapper works with arenas, GPAs, fixed buffers—it can sit on top of any `std.mem.Allocator`.

Compare this to how C teams adopt sanitizers—except this one lives in your allocator, not your compiler flags. It's explicit, composable, and under your control.

## What You Gain

Targeted runtime safety: OOB and UAF catching in the places they actually happen (copies, resizes, frees). Frictionless adoption: pass a different allocator, no rewrites. Predictable performance: checks only where you enable them, compile out in production. Clear diagnostics: panic with region/epoch context.

Foundation for more: you can later add checked `memcpy` hoisting, redzones, even GC hooks, without changing call sites.

Wrapping Zig's allocator seems to be the most idiomatic and pragmatic way to introduce as-needed runtime safety. It respects Zig's explicit control model, keeps developer experience clean, and gives teams a lever to harden the exact subsystems that interact with untrusted memory—no more, no less.

