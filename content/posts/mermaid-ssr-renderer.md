---
title: My Experience Building a Mermaid SSR Renderer
date: 2025-06-16
tags: [TypeScript, Functional, Parsing, SSR]
excerpt: How I built a functional Mermaid diagram parser that renders SVG server-side, using TypeScript patterns that keep complex parsing logic manageable.
---

## Why I Built a Custom Mermaid Renderer

I needed server-side Mermaid diagram rendering for a blog built with Deno. The existing Mermaid.js library requires a browser environment, making SSR challenging. After wrestling with headless browsers and DOM simulation, I decided to build a focused renderer that handles the Mermaid syntax I actually use.

## What I Learned About Parsing

Parsing Mermaid syntax taught me that functional patterns make complex logic manageable. Instead of building a traditional parser, I used TypeScript's type system and pattern matching to create something maintainable.

### The Core Architecture

I structured the parser around discriminated unions that represent diagram components:

```typescript
type MermaidNode = {
  readonly id: string;
  readonly label: string;
  readonly shape: "rect" | "circle" | "diamond" | "rounded";
  readonly position: readonly [number, number];
};

type MermaidEdge = {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style: "solid" | "dashed" | "dotted";
};
```

This approach gives me compile-time guarantees about diagram structure. The parser can't create invalid combinations because TypeScript prevents it.

### Pattern Matching for Syntax Recognition

I use `ts-pattern` to match Mermaid syntax patterns:

```typescript
const parseNodeShape = (syntax: string): MermaidNode["shape"] =>
  match(syntax)
    .when((s) => s.includes("(") && s.includes(")"), () => "rounded" as const)
    .when((s) => s.includes("{") && s.includes("}"), () => "diamond" as const)
    .when((s) => s.includes("((") && s.includes("))"), () => "circle" as const)
    .otherwise(() => "rect" as const);
```

Pattern matching makes the parser logic readable. Each syntax element has a clear handler, and TypeScript ensures I handle all cases.

## How I Handle Complex Diagrams

Mermaid diagrams can have dozens of nodes and connections. My parser processes them in phases:

1. **Extract nodes** from standalone definitions and edge references
2. **Extract edges** from connection syntax
3. **Calculate positions** using a grid layout algorithm
4. **Render SVG** with proper scaling and styling

The functional approach means each phase is a pure transformation. I can test them independently and compose them reliably.

### Node Extraction That Actually Works

The trickiest part was handling node IDs correctly. Mermaid syntax like `A1[User/Claimant]:::userClass` needs to extract just "A1" as the ID:

```typescript
const extractNodeId = (nodeText: string): string => {
  return nodeText.replace(/[\[\](){}].*$/, "").replace(/:::.*$/, "").split(/\s+/)[0];
};
```

This regex-based approach handles the syntax variations I encounter in practice.

## What I Discovered About SVG Generation

Generating clean SVG requires careful coordinate calculation and text sizing. I learned that dynamic sizing based on label length prevents text overflow:

```typescript
const dynamicWidth = Math.max(minWidth, Math.min(textLength * 8 + 20, 200));
```

The renderer scales node shapes based on content, making diagrams readable regardless of label length.

## Results in Practice

The custom renderer handles the complex zero-knowledge proof diagrams in my blog posts. It parses 18+ nodes with 30+ connections and generates clean SVG that loads instantly.

The functional architecture made debugging straightforward. When diagrams showed only one arrow instead of full connections, I could isolate the issue to the `extractNodeId` function and fix it without touching the rest of the system.

## What This Approach Enables

Building a focused parser instead of adapting a general-purpose library gave me:

- **Fast SSR**: No browser dependencies or DOM simulation
- **Predictable output**: Consistent SVG styling and sizing
- **Easy debugging**: Pure functions isolate problems
- **Type safety**: Impossible to generate invalid diagrams

The functional patterns scale well. Adding new diagram types requires extending the discriminated unions and adding pattern match cases. The type system ensures I handle all variations.
