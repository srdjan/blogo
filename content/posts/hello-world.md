---
title: Hello World
date: 2025-04-06
tags: [deno, htmx, markdown]
excerpt: A first post on our minimal blog platform built with Deno, HTMX, and Markdown.
---

# Hello World

Welcome to this minimal blog platform built with [Deno](https://deno.land/), [HTMX](https://htmx.org/), and Markdown.

## Features

- **Minimal Dependencies**: Using Deno's standard library and minimal external dependencies
- **Fast Rendering**: Static HTML generation with light client-side enhancements via HTMX
- **Content as Code**: All blog posts are stored as markdown files with frontmatter
- **Semantic HTML**: Clean, accessible markup that follows best practices
- **Responsive Design**: Works great on all devices with pure CSS

## Code Example

Here's a simple Deno function:

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("World"));
// Output: Hello, World!
