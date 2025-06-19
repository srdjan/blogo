---
title: Building a Mermaid SSR Renderer with TypeScript
date: 2025-06-16
tags: [TypeScript, Functional, Parsing, SSR]
excerpt: A functional Mermaid diagram parser that renders SVG server-side, using TypeScript patterns to keep complex parsing logic manageable. Now powered by @rendermaid/core for enhanced performance and features.
---

## The Need for Custom Mermaid Rendering

Server-side Mermaid diagram rendering presents challenges when building applications with Deno or similar runtimes. The existing Mermaid.js library requires a browser environment, making SSR difficult. Headless browsers and DOM simulation add complexity, making a focused renderer that handles specific Mermaid syntax more practical.

**Update (2025-06-19):** This blog has been migrated to use [@rendermaid/core](https://github.com/srdjan/rendermaid), a high-performance, functional TypeScript library that provides the same benefits described below but with enhanced features, better performance, and comprehensive type safety.

## Functional Parsing Approach

Parsing Mermaid syntax demonstrates how functional patterns make complex logic manageable. Rather than building a traditional parser, TypeScript's type system and pattern matching create maintainable solutions.

### The Core Architecture

The parser structure uses discriminated unions that represent diagram components:

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

This approach provides compile-time guarantees about diagram structure. The parser cannot create invalid combinations because TypeScript prevents them.

### Pattern Matching for Syntax Recognition

Using `ts-pattern` to match Mermaid syntax patterns:

```typescript
const parseNodeShape = (syntax: string): MermaidNode["shape"] =>
  match(syntax)
    .when((s) => s.includes("(") && s.includes(")"), () => "rounded" as const)
    .when((s) => s.includes("{") && s.includes("}"), () => "diamond" as const)
    .when((s) => s.includes("((") && s.includes("))"), () => "circle" as const)
    .otherwise(() => "rect" as const);
```

Pattern matching makes the parser logic readable. Each syntax element has a clear handler, and TypeScript ensures I handle all cases.

## Handling Complex Diagrams

Mermaid diagrams can have dozens of nodes and connections. Processing them in phases proves effective:

1. **Extract nodes** from standalone definitions and edge references
2. **Extract edges** from connection syntax
3. **Calculate positions** using a grid layout algorithm
4. **Render SVG** with proper scaling and styling

The functional approach makes each phase a pure transformation. This enables independent testing and reliable composition.

### Effective Node Extraction

Handling node IDs correctly presents the greatest challenge. Mermaid syntax like `A1[User/Claimant]:::userClass` requires extracting just "A1" as the ID:

```typescript
const extractNodeId = (nodeText: string): string => {
  return nodeText.replace(/[\[\](){}].*$/, "").replace(/:::.*$/, "").split(/\s+/)[0];
};
```

This regex-based approach handles common syntax variations effectively.

## SVG Generation Insights

Generating clean SVG requires careful coordinate calculation and text sizing. Dynamic sizing based on label length prevents text overflow:

```typescript
const dynamicWidth = Math.max(minWidth, Math.min(textLength * 8 + 20, 200));
```

The renderer scales node shapes based on content, ensuring diagrams remain readable regardless of label length.

## Practical Results

The custom renderer handles complex diagrams with 18+ nodes and 30+ connections, generating clean SVG that loads instantly.

The functional architecture makes debugging straightforward. When diagrams show only one arrow instead of full connections, issues can be isolated to specific functions like `extractNodeId` and fixed without affecting the rest of the system.

## Benefits of This Approach

Building a focused parser instead of adapting a general-purpose library provides:

- **Fast SSR**: No browser dependencies or DOM simulation
- **Predictable output**: Consistent SVG styling and sizing
- **Easy debugging**: Pure functions isolate problems
- **Type safety**: Impossible to generate invalid diagrams

The functional patterns scale well. Adding new diagram types requires extending the discriminated unions and adding pattern match cases. The type system ensures all variations are handled properly.

## Migration to @rendermaid/core

This blog now uses [@rendermaid/core](https://github.com/srdjan/rendermaid) which provides all the benefits described above plus:

- **Enhanced Performance**: Optimized tokenization-based parser with spatial grid rendering
- **Multi-format Output**: SVG, HTML, JSON, and round-trip Mermaid rendering
- **Smart Edge Routing**: Intelligent collision avoidance for clean diagrams
- **Professional Styling**: White backgrounds with proper contrast and typography
- **Comprehensive Testing**: Performance benchmarks and validation included

The migration maintains the same functional programming principles while providing a more robust and feature-complete solution.
