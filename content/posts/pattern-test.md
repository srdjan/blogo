---
title: "SVG Pattern Test"
date: 2024-01-15
tags: ["test", "design"]
---

# SVG Background Pattern Examples

This post demonstrates the three SVG background patterns used in the Blogo application.

## 1. Article Header Pattern

The article header (where the title appears) has a **dot grid pattern** that gives it a technical, graph-paper aesthetic. You're seeing it right now at the top of this page!

## 2. Code Block Pattern

Code blocks have a **circuit board pattern** that adds a developer-focused aesthetic:

```typescript
// This code block has a circuit board pattern in the background
export type Result<T, E> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => 
  ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => 
  ({ ok: false, error });
```

Look closely at the gray background behind the code - you'll see subtle circuit-like lines and circles.

## 3. Blockquote Pattern

Blockquotes have a **diagonal lines pattern** that adds subtle texture:

> This is a blockquote with diagonal lines in the background.
> 
> The pattern creates a subtle texture that adds visual interest without distracting from the content. Look closely at the background and you'll see diagonal lines creating depth.

> Here's another blockquote to demonstrate the pattern consistency.
> The diagonal lines should be visible but not overwhelming.

## Summary

All three patterns are designed to be:
- **Subtle**: They enhance without distracting
- **Technical**: They align with the developer-focused aesthetic
- **Tasteful**: They add visual polish to the design

The patterns use inline SVG data URIs, so they load instantly with zero additional HTTP requests!

