---
title: "Server-Side Mermaid Rendering Without the Browser"
date: 2025-06-16
tags: [TypeScript, Functional, Parsing, SSR]
excerpt: Building a pure TypeScript Mermaid renderer that works server-side - no browser, no DOM simulation, just functional patterns and smart type system usage.
---

Server-side Mermaid diagram rendering has always required browser environments
or complex DOM simulation. Puppeteer, JSDOM, heavyweight solutions that feel
wrong for what should be straightforward parsing and SVG generation.

So I built [@rendermaid/core](https://github.com/srdjan/rendermaid) - a pure
TypeScript Mermaid renderer that runs server-side without any browser
dependencies. Here's what makes it work.

## What This Actually Does

The core idea is simple: parse Mermaid diagram syntax into an AST, then render
that AST directly to SVG using functional TypeScript patterns. No DOM, no
browser APIs, just types and pure functions.

The latest version (v0.6.0) handles:

- **Native TypeScript parsing** - Zero browser dependencies
- **Markdown integration** - Extract and render diagrams directly from markdown
  files
- **Multiple output formats** - SVG, HTML, JSON, and round-trip Mermaid
  generation
- **Smart canvas sizing** - Dynamic configuration prevents content clipping
- **Validation and analysis** - AST validation, complexity scoring, cycle
  detection

Here's the basic usage:

```typescript
import { parseMermaid, renderSvg } from "@rendermaid/core";

const diagram = `
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
    C --> E[End]
    D --> E
`;

const parseResult = parseMermaid(diagram);
if (parseResult.success) {
  const svgResult = renderSvg(parseResult.data, {
    width: 800,
    height: 600,
    theme: "light",
    nodeSpacing: 120,
  });

  console.log(svgResult.data); // Clean SVG output
}
```

No Puppeteer launch. No JSDOM setup. Parse and render, done.

## Type-Safe AST Design

The AST uses discriminated unions with full type safety. To me is interesting
that TypeScript's type system makes invalid diagram states impossible to
represent:

```typescript
// Node types with comprehensive shape support
type MermaidNode = {
  readonly id: string;
  readonly label: string;
  readonly shape:
    | "rectangle"
    | "rounded"
    | "circle"
    | "rhombus"
    | "hexagon"
    | "stadium";
  readonly metadata?: ReadonlyMap<string, unknown>;
};

// Edge types with connection variety
type MermaidEdge = {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly type: "arrow" | "line" | "thick" | "dotted" | "dashed";
  readonly metadata?: ReadonlyMap<string, unknown>;
};

// Complete AST representation
type MermaidAST = {
  readonly diagramType: DiagramType;
  readonly nodes: ReadonlyMap<string, MermaidNode>;
  readonly edges: readonly MermaidEdge[];
  readonly metadata: ReadonlyMap<string, unknown>;
};
```

Everything is `readonly`. Mutations are compile errors. The type system
guarantees structural integrity.

## Pattern Matching for Parsing

The parser uses pre-compiled regex patterns with TypeScript's const assertions
for performance:

```typescript
// Shape patterns compiled once
const SHAPE_PATTERNS = [
  {
    pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(\[([^\]]+)\]\)/,
    shape: "stadium" as const,
  },
  {
    pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(\(([^)]+)\)\)/,
    shape: "circle" as const,
  },
  {
    pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\{\{([^}]+)\}\}/,
    shape: "hexagon" as const,
  },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\{([^}]+)\}/, shape: "rhombus" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)/, shape: "rounded" as const },
  {
    pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\[([^\]]+)\]/,
    shape: "rectangle" as const,
  },
] as const;

// Connection patterns for edge types
const CONNECTION_PATTERNS = [
  { pattern: /-.->/, type: "dotted" as const },
  { pattern: /==>/, type: "thick" as const },
  { pattern: /---/, type: "dashed" as const },
  { pattern: /-->/, type: "arrow" as const },
] as const;
```

Look at this - the patterns are tested once at compile time, then reused at
runtime. TypeScript infers the exact literal types automatically.

## Smart Canvas Sizing

Earlier versions had a frustrating problem - bottom elements would get clipped
because canvas height was fixed. Version 0.6.0 solves this with dynamic
configuration:

```typescript
const calculateDynamicConfig = (analysis: DiagramAnalysis): SvgConfig => {
  const depth = analysis.depth || 3;
  const nodeHeight = 60;
  const layerSpacing = 120 * 1.5;
  const topPadding = 80;
  const bottomPadding = 120; // Generous bottom padding
  const edgeLabelPadding = 40;

  const calculatedHeight = topPadding + (depth * layerSpacing) +
    nodeHeight + bottomPadding + edgeLabelPadding;

  // Complex diagrams get minimum 1000x1000px canvas
  if (analysis.complexity > 20) {
    return {
      width: Math.max(1000, baseWidth),
      height: Math.max(1000, calculatedHeight),
      theme: "light",
      nodeSpacing: 120,
    };
  }

  return {
    width: 800,
    height: Math.max(800, calculatedHeight),
    theme: "light",
    nodeSpacing: 120,
  };
};
```

The algorithm analyzes diagram depth and complexity, then calculates canvas
size. Simple diagrams get compact output. Complex diagrams get the space they
need. No more clipped content.

## Validation and Analysis

Version 0.6.0 adds comprehensive validation that catches structural issues:

```typescript
import { analyzeAST, parseMermaid, validateAST } from "@rendermaid/core";

const diagram = `
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
    C --> E[End]
    D --> E
`;

const parseResult = parseMermaid(diagram);
if (parseResult.success) {
  const ast = parseResult.data;

  // Validate diagram integrity
  const validationErrors = validateAST(ast);
  if (validationErrors.length > 0) {
    console.log("Validation issues:", validationErrors);
    // Example: ["Edge references non-existent source node: X"]
  }

  // Analyze diagram complexity and structure
  const analysis = analyzeAST(ast);
  console.log("Complexity score:", analysis.complexity);
  console.log("Node shapes used:", analysis.nodeShapes);
  console.log("Edge types used:", analysis.edgeTypes);
  console.log("Maximum depth:", analysis.depth);
  console.log("Contains cycles:", analysis.cycleDetected);
}
```

Here's the cool part - validation runs at multiple levels. Parser validates
syntax. AST validation checks structural integrity (edges reference valid
nodes). Analysis provides metrics for optimization.

## Markdown Integration

One feature that surprised me with how useful it turned out - direct markdown
file processing:

```typescript
import {
  extractMermaidFromMarkdown,
  parseMermaid,
  renderSvg,
} from "@rendermaid/core";

const markdownContent = `
# My Document

Here's a diagram:

\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

More content here...
`;

const diagrams = extractMermaidFromMarkdown(markdownContent);
diagrams.forEach((diagram) => {
  const parseResult = parseMermaid(diagram);
  if (parseResult.success) {
    const svgResult = renderSvg(parseResult.data);
    console.log(svgResult.data); // Rendered SVG
  }
});
```

This works beautifully for static site generators. Extract diagrams, render to
SVG, embed in HTML. All server-side, no client JavaScript needed.

## Performance Monitoring

Built-in performance monitoring makes optimization straightforward:

```typescript
import { renderSvg, withPerformanceMonitoring } from "@rendermaid/core";

// Wrap rendering with performance monitoring
const monitoredRender = withPerformanceMonitoring(renderSvg, "Complex Diagram");

const result = monitoredRender(ast, {
  width: 1200,
  height: 800,
  theme: "light",
  nodeSpacing: 150,
});

// Console output: "⏱️ Complex Diagram: 12.34ms"
```

The tricky bit was keeping monitoring overhead minimal. Simple wrapper function,
minimal allocations, precise timing.

## Spatial Grid Rendering

The layout algorithm uses spatial grid optimization for collision detection:

```typescript
// O(1) collision detection using spatial hashing
const optimizedCalculateLayout = (ast: MermaidAST, config: SvgConfig) => {
  // Spatial grid for fast collision queries
  const spatialGrid = new SpatialGrid(100);

  // Layer-based layout using BFS for optimal positioning
  const layers = calculateLayers(ast);

  // Position nodes with collision avoidance
  return positionNodesWithCollisionAvoidance(layers, spatialGrid, config);
};
```

This means the renderer handles complex diagrams (50+ nodes, 100+ edges) without
performance degradation. The spatial grid reduces collision checks from O(n²) to
O(1).

## Multi-Format Output

Beyond SVG, the renderer supports multiple output formats:

**HTML with accessibility:**

```typescript
import { renderHtml } from "@rendermaid/core";

const htmlResult = renderHtml(ast, {
  className: "my-diagram",
  includeStyles: true,
  responsive: true,
});
// Semantic HTML with proper ARIA labels
```

**JSON for data processing:**

```typescript
import { renderJson } from "@rendermaid/core";

const jsonResult = renderJson(ast, {
  pretty: true,
  includeMetadata: true,
});
// Structured data for further processing
```

**Round-trip Mermaid generation:**

```typescript
import { renderMermaid } from "@rendermaid/core";

// Convert AST back to Mermaid syntax
const mermaidResult = renderMermaid(ast, {
  preserveFormatting: true,
  includeComments: false,
});
```

The last one is particularly useful for diagram normalization and formatting.

## Migration from Earlier Versions

Version 0.6.0 is fully backward compatible with v0.5.0 - no syntax changes
required. Just update the dependency.

For migrations from v0.4.0 or earlier, the main change is diagram syntax:

```typescript
// ❌ Old syntax (v0.4.0 and earlier)
const oldDiagram = `
graph TD
    A[Start] --> B[Process]
    B --> C[End]
`;

// ✅ New syntax (v0.5.0+)
const newDiagram = `
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
`;
```

Use `flowchart TD` instead of `graph TD`. That's it.

## Real Talk: What Works and What Doesn't

I've been using this in production for several months now. Here's the honest
assessment.

### Where It Shines

**Server-side rendering is effortless.** No browser automation, no JSDOM
complexity. Parse and render in the same process.

**Static site generation is perfect.** Extract diagrams from markdown, render at
build time, serve static HTML. Fast and simple.

**Performance is excellent.** Complex diagrams render in under 50ms. The spatial
grid optimization actually works.

**Type safety catches bugs early.** Invalid diagram structures fail at compile
time, not runtime.

**Testing is straightforward.** Pure functions, deterministic output, easy
assertions.

### Where It Falls Short

**Limited diagram types.** Currently supports flowcharts only. Sequence diagrams
are planned but not implemented.

**Syntax is stricter than official Mermaid.** Some edge cases from the official
parser aren't supported yet.

**SVG output is functional but basic.** Professional polish requires
post-processing for some use cases.

**No client-side interactivity.** This generates static SVG. If you need zoom,
pan, or click handlers, you need additional JavaScript.

### When to Use This

This approach works best for:

- Static site generators and blogs
- Documentation systems with embedded diagrams
- Server-side PDF generation
- Build-time diagram processing
- Deno and Node.js backends

Skip it for:

- Real-time collaborative diagramming
- Complex interactive diagrams needing zoom/pan
- Full Mermaid syntax compatibility requirements
- Client-side rendering applications

## Getting Started

Installation depends of your runtime:

```bash
# Deno
deno add jsr:@rendermaid/core

# Node.js/Bun
npx jsr add @rendermaid/core
```

Basic example to verify everything works:

```typescript
import { parseMermaid, renderSvg } from "@rendermaid/core";

const diagram = `
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
    C --> E[End]
    D --> E
`;

const parseResult = parseMermaid(diagram);
if (parseResult.success) {
  const svgResult = renderSvg(parseResult.data, {
    width: 800,
    height: 600,
    theme: "light",
    nodeSpacing: 120,
  });

  if (svgResult.success) {
    console.log(svgResult.data); // Clean SVG output
  }
}
```

If you see SVG markup, it's working.

## What I Learned Building This

The interesting part was how functional patterns simplified complex problems.
Pure functions for parsing, immutable AST, explicit Result types for error
handling - these patterns made testing and debugging straightforward.

The dynamic canvas sizing took several iterations to get right. Early versions
either clipped content or wasted space. The current algorithm balances both
concerns reasonably well.

Performance monitoring revealed surprising bottlenecks. String concatenation for
SVG generation was slow. Pre-allocated arrays with join improved render time by
40%.

Type safety caught numerous bugs during development. Invalid edge references,
shape mismatches, missing node IDs - all caught at compile time instead of
runtime.

I built this while working on documentation for my band's website. Needed
server-side diagram rendering without Puppeteer overhead. The initial version
handled basic flowcharts. Each iteration added features based on actual usage
patterns.

This won't replace the official Mermaid library for all use cases. But for
server-side rendering in TypeScript? It works surprisingly well. Worth trying if
you're building static sites or documentation systems.
