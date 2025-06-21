---
title: Building a Mermaid SSR Renderer with TypeScript
date: 2025-06-16
tags: [TypeScript, Functional, Parsing, SSR]
excerpt: A comprehensive guide to server-side Mermaid diagram rendering using @rendermaid/core v0.6.0, featuring enhanced performance, advanced analysis capabilities, improved rendering quality, and functional TypeScript patterns for maintainable parsing logic.
---

## The Evolution of Server-Side Mermaid Rendering

Server-side Mermaid diagram rendering has evolved significantly with the introduction of [@rendermaid/core v0.6.0](https://github.com/srdjan/rendermaid). While traditional approaches required browser environments or complex DOM simulation, modern functional TypeScript libraries now provide elegant solutions for SSR Mermaid rendering.

**@rendermaid/core v0.6.0** represents a major advancement in Mermaid processing, offering:

- **Native TypeScript Implementation**: No browser dependencies or DOM simulation required
- **Markdown File Processing**: Direct extraction and parsing of Mermaid diagrams from markdown files
- **Enhanced Performance**: Optimized tokenization-based parser with spatial grid rendering
- **Comprehensive Type Safety**: Full TypeScript support with exhaustive pattern matching
- **Multi-format Output**: SVG, HTML, JSON, and round-trip Mermaid rendering

## Key Enhancements in v0.6.0

### Advanced Analysis & Validation

v0.6.0 introduces comprehensive analysis capabilities:

- **AST Validation**: Comprehensive integrity checking with detailed error reporting
- **Complexity Analysis**: Automatic complexity scoring based on nodes, edges, and variety
- **Cycle Detection**: Identifies circular dependencies in diagram structure
- **Performance Monitoring**: Built-in timing and optimization metrics

### Improved Rendering Quality

- **Shape-Aware Connection Points**: Accurate edge routing based on node shapes
- **Dynamic Node Sizing**: Automatic sizing based on label content
- **Enhanced Collision Avoidance**: Intelligent edge routing with spatial grid optimization
- **Better Label Positioning**: Improved text placement and background handling
- **Bottom Overflow Prevention**: Dynamic height calculation with generous padding to prevent content clipping

### Syntax Requirements

v0.6.0 maintains the same syntax requirements as v0.5.0:

- **Flowchart Header**: Use `flowchart TD` instead of `graph TD`
- **Supported Diagrams**: Currently focuses on flowchart diagrams with plans for sequence diagrams
- **Enhanced Validation**: Stricter syntax checking with helpful error messages

## Functional Parsing Approach

Parsing Mermaid syntax demonstrates how functional patterns make complex logic manageable. Rather than building a traditional parser, TypeScript's type system and pattern matching create maintainable solutions.

### The Core Architecture in v0.5.0

@rendermaid/core v0.5.0 uses enhanced discriminated unions with comprehensive type safety:

```typescript
import {
  parseMermaid,
  renderSvg,
  type MermaidAST,
  type MermaidNode,
  type MermaidEdge,
  type SvgConfig
} from "@rendermaid/core";

// Enhanced node types with metadata support
type MermaidNode = {
  readonly id: string;
  readonly label: string;
  readonly shape: "rectangle" | "rounded" | "circle" | "rhombus" | "hexagon" | "stadium";
  readonly metadata?: ReadonlyMap<string, unknown>;
};

// Enhanced edge types with connection variety
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

This enhanced architecture provides compile-time guarantees about diagram structure while supporting metadata and advanced features.

### Enhanced Pattern Matching in v0.5.0

@rendermaid/core v0.5.0 uses optimized pattern matching with pre-compiled regex patterns for superior performance:

```typescript
import { match } from "ts-pattern";

// v0.5.0 uses pre-compiled shape patterns for faster matching
const SHAPE_PATTERNS = [
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(\[([^\]]+)\]\)/, shape: "stadium" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(\(([^)]+)\)\)/, shape: "circle" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\{\{([^}]+)\}\}/, shape: "hexagon" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\{([^}]+)\}/, shape: "rhombus" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)/, shape: "rounded" as const },
  { pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\[([^\]]+)\]/, shape: "rectangle" as const }
] as const;

// Enhanced connection pattern matching
const CONNECTION_PATTERNS = [
  { pattern: /-.->/, type: "dotted" as const },
  { pattern: /==>/, type: "thick" as const },
  { pattern: /---/, type: "dashed" as const },
  { pattern: /-->/, type: "arrow" as const }
] as const;
```

The enhanced pattern matching provides better performance through pre-compilation and more comprehensive syntax support.

## Dynamic Configuration & Overflow Prevention

### Intelligent Canvas Sizing

v0.6.0 introduces dynamic configuration that prevents bottom overflow issues:

```typescript
import { renderMermaidToSVG, renderMermaidWithConfig } from "./mermaid-renderer";

// Automatic dynamic sizing based on diagram complexity
const diagram = `
flowchart TD
    A[Start] --> B[Step 1]
    B --> C[Step 2]
    C --> D[Step 3]
    D --> E[Step 4]
    E --> F[Step 5]
    F --> G[End]
`;

// Dynamic configuration automatically calculated
const result = renderMermaidToSVG(diagram);
// Height automatically increased based on diagram depth

// Custom configuration override when needed
const customResult = renderMermaidWithConfig(diagram, {
  height: 1200,
  width: 1000,
  theme: "dark"
});
```

### Configuration Algorithm

The dynamic configuration system calculates optimal canvas size:

```typescript
const calculateDynamicConfig = (analysis: DiagramAnalysis): SvgConfig => {
  const depth = analysis.depth || 3;
  const nodeHeight = 60; // Estimated node height including labels
  const layerSpacing = 120 * 1.5; // Layer spacing
  const topPadding = 80; // Top margin
  const bottomPadding = 120; // Generous bottom padding
  const edgeLabelPadding = 40; // Additional space for edge labels

  const calculatedHeight = topPadding + (depth * layerSpacing) +
                          nodeHeight + bottomPadding + edgeLabelPadding;

  // Complex diagrams get minimum 1000x1000px canvas
  if (analysis.complexity > 20) {
    return {
      width: Math.max(1000, baseWidth),
      height: Math.max(1000, calculatedHeight),
      theme: "light",
      nodeSpacing: 120
    };
  }

  return {
    width: 800,
    height: Math.max(800, calculatedHeight), // Increased from 600px default
    theme: "light",
    nodeSpacing: 120
  };
};
```

### Benefits of Dynamic Sizing

- **No Content Clipping**: Bottom elements are never cut off
- **Optimal Space Usage**: Canvas size matches diagram complexity
- **Performance Optimization**: Complex diagrams get larger canvas automatically
- **Custom Override**: Manual configuration when specific dimensions needed

## Advanced Analysis Features in v0.6.0

### Comprehensive AST Validation

v0.6.0 introduces robust validation that catches structural issues:

```typescript
import { parseMermaid, validateAST, analyzeAST } from "@rendermaid/core";

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

### Performance Monitoring Integration

v0.6.0 includes built-in performance monitoring for optimization:

```typescript
import { withPerformanceMonitoring, renderSvg } from "@rendermaid/core";

// Wrap rendering with performance monitoring
const monitoredRender = withPerformanceMonitoring(renderSvg, "Complex Diagram");

const result = monitoredRender(ast, {
  width: 1200,
  height: 800,
  theme: "light",
  nodeSpacing: 150
});

// Console output: "⏱️ Complex Diagram: 12.34ms"
```

### Enhanced AST Transformation

v0.6.0 provides utilities for AST enhancement and transformation:

```typescript
import { enhanceAST, transformAST } from "@rendermaid/core";

// Enhance AST with analysis metadata
const enhancedAST = enhanceAST(ast);
console.log(enhancedAST.metadata.get("analysis")); // Full analysis results
console.log(enhancedAST.metadata.get("enhancedAt")); // Timestamp

// Transform AST with custom logic
const transformedAST = transformAST(ast, (currentAST) => {
  // Add custom metadata or modify structure
  const newMetadata = new Map(currentAST.metadata);
  newMetadata.set("customProcessed", true);
  return { ...currentAST, metadata: newMetadata };
});
```

## Advanced Features in v0.5.0

### Markdown File Processing

One of the most powerful features in v0.5.0 is direct markdown file processing:

```typescript
import {
  extractMermaidFromMarkdown,
  parseMermaidFromMarkdownFile,
  createSampleMarkdownFiles,
  runMarkdownDemo
} from "@rendermaid/core";

// Extract all Mermaid diagrams from markdown content
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
diagrams.forEach(diagram => {
  const parseResult = parseMermaid(diagram);
  if (parseResult.success) {
    const svgResult = renderSvg(parseResult.data);
    console.log(svgResult.data); // Rendered SVG
  }
});

// Process entire markdown files
const fileResults = await parseMermaidFromMarkdownFile("./my-document.md");
```

### Enhanced Layout Algorithm

v0.5.0 introduces spatial grid rendering with intelligent collision avoidance:

```typescript
// Optimized layout calculation with spatial hashing
const optimizedCalculateLayout = (ast: MermaidAST, config: SvgConfig) => {
  // Uses spatial grid for O(1) collision detection
  const spatialGrid = new SpatialGrid(100);

  // Layer-based layout using BFS for optimal positioning
  const layers = calculateLayers(ast);

  // Position nodes with optimized spacing
  return positionNodesWithCollisionAvoidance(layers, spatialGrid, config);
};
```

## Multi-Format Rendering in v0.5.0

v0.5.0 provides comprehensive output format support beyond just SVG:

### SVG Rendering with Enhanced Configuration

```typescript
import { renderSvg, type SvgConfig } from "@rendermaid/core";

const svgConfig: SvgConfig = {
  width: 800,
  height: 600,
  nodeSpacing: 120, // Optimized default spacing
  theme: "light" // "light" | "dark" | "neutral"
};

const result = parseMermaid(`
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
`);

if (result.success) {
  const svgResult = renderSvg(result.data, svgConfig);
  console.log(svgResult.data); // Clean, optimized SVG
}
```

### HTML Output for Web Integration

```typescript
import { renderHtml, type HtmlConfig } from "@rendermaid/core";

const htmlConfig: HtmlConfig = {
  className: "my-diagram",
  includeStyles: true,
  responsive: true
};

const htmlResult = renderHtml(ast, htmlConfig);
// Produces semantic HTML with proper accessibility
```

### JSON Export for Data Processing

```typescript
import { renderJson, type JsonConfig } from "@rendermaid/core";

const jsonConfig: JsonConfig = {
  pretty: true,
  includeMetadata: true
};

const jsonResult = renderJson(ast, jsonConfig);
// Structured data for further processing
```

### Round-trip Mermaid Generation

```typescript
import { renderMermaid } from "@rendermaid/core";

// Convert AST back to Mermaid syntax
const mermaidResult = renderMermaid(ast, {
  preserveFormatting: true,
  includeComments: false
});
```

## Performance and Analysis Features

### AST Analysis and Validation

v0.5.0 includes comprehensive analysis tools:

```typescript
import { analyzeAST, validateAST, transformAST } from "@rendermaid/core";

const result = parseMermaid(diagramText);
if (result.success) {
  const ast = result.data;

  // Analyze diagram complexity
  const analysis = analyzeAST(ast);
  console.log("Complexity:", analysis.complexity);
  console.log("Node count:", ast.nodes.size);
  console.log("Edge count:", ast.edges.length);

  // Validate diagram integrity
  const errors = validateAST(ast);
  if (errors.length > 0) {
    console.log("Validation errors:", errors);
  }

  // Transform AST with custom functions
  const enhancedAST = transformAST(ast, (node) => ({
    ...node,
    metadata: new Map([["processed", true]])
  }));
}
```

### Performance Monitoring

```typescript
import { withPerformanceMonitoring } from "@rendermaid/core";

const monitoredRender = withPerformanceMonitoring(renderSvg);
const result = monitoredRender(ast, config);
// Includes timing and performance metrics
```

### Practical Results

@rendermaid/core v0.5.0 delivers exceptional performance:

- **Complex Diagrams**: Handles 50+ nodes and 100+ connections efficiently
- **Instant Rendering**: Optimized algorithms provide sub-millisecond parsing
- **Memory Efficient**: Functional approach with minimal memory footprint
- **Type Safe**: Compile-time guarantees prevent runtime errors

## Migration Guide to v0.6.0

### From v0.5.0 to v0.6.0

v0.6.0 is fully backward compatible with v0.5.0 - no syntax changes required! Simply update your dependency and optionally leverage new features.

### From Earlier Versions

When migrating from v0.4.0 or earlier, update your diagram syntax:

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

### Enhanced API in v0.6.0

```typescript
// v0.6.0 comprehensive imports
import {
  parseMermaid,
  renderSvg,
  analyzeAST,
  validateAST,
  enhanceAST,
  transformAST,
  withPerformanceMonitoring,
  extractMermaidFromMarkdown,
  type SvgConfig
} from "@rendermaid/core";

// Enhanced configuration with type safety
const config: SvgConfig = {
  width: 800,
  height: 600,
  nodeSpacing: 120, // Optimized spacing
  theme: "light" // "light" | "dark" | "neutral"
};

// v0.6.0: Use enhanced rendering with validation and analysis
const parseResult = parseMermaid(diagram);
if (parseResult.success) {
  const ast = parseResult.data;

  // Validate before rendering
  const errors = validateAST(ast);
  if (errors.length === 0) {
    // Enhance with metadata
    const enhancedAST = enhanceAST(ast);

    // Render with performance monitoring
    const monitoredRender = withPerformanceMonitoring(renderSvg, "Diagram Render");
    const result = monitoredRender(enhancedAST, config);
  }
}
```

### Error Handling & Validation Improvements

v0.6.0 provides comprehensive error handling and validation:

```typescript
const result = parseMermaid(diagramText);
if (!result.success) {
  // Enhanced error messages guide users to correct syntax
  console.error(result.error);
  // Example: "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0"
} else {
  // Additional validation for structural integrity
  const validationErrors = validateAST(result.data);
  if (validationErrors.length > 0) {
    console.error("Structural issues:", validationErrors);
    // Example: ["Edge references non-existent source node: InvalidNode"]
  }

  // Analyze for potential optimization opportunities
  const analysis = analyzeAST(result.data);
  if (analysis.complexity > 50) {
    console.warn("High complexity diagram detected:", analysis.complexity);
  }
  if (analysis.cycleDetected) {
    console.warn("Circular dependencies detected in diagram");
  }
}
```

## Benefits of @rendermaid/core v0.6.0

The latest version provides comprehensive advantages:

### Core Benefits

- **Zero Dependencies**: No browser requirements or DOM simulation
- **Native TypeScript**: Full type safety with exhaustive pattern matching
- **Functional Architecture**: Pure functions enable reliable composition and testing
- **Multi-format Output**: SVG, HTML, JSON, and Mermaid round-trip support

### v0.6.0 Enhancements

- **Advanced Analysis**: Comprehensive complexity scoring, cycle detection, and structural analysis
- **Enhanced Validation**: Multi-level validation with detailed error reporting
- **Performance Monitoring**: Built-in timing and optimization metrics
- **Improved Rendering**: Shape-aware connection points and dynamic node sizing
- **AST Enhancement**: Metadata enrichment and transformation utilities
- **Spatial Grid Optimization**: Intelligent collision avoidance with improved edge routing
- **Markdown Integration**: Direct processing of markdown files with embedded diagrams

### Production Ready Features

- **Scalable Performance**: Handles complex diagrams with 50+ nodes efficiently
- **Memory Efficient**: Functional approach minimizes memory footprint
- **Comprehensive Testing**: Performance benchmarks and validation included
- **Professional Output**: Clean SVG with proper contrast and typography

The functional patterns scale excellently. Adding new diagram types requires extending discriminated unions and adding pattern match cases, with the type system ensuring all variations are handled properly.

## Getting Started with @rendermaid/core v0.5.0

### Installation

```bash
# Deno
deno add jsr:@rendermaid/core

# Node.js/Bun
npx jsr add @rendermaid/core
```

### Basic Usage Example

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
    nodeSpacing: 120
  });

  if (svgResult.success) {
    console.log(svgResult.data); // Clean SVG output
  }
}
```

### Markdown Processing Example

```typescript
import { extractMermaidFromMarkdown, parseMermaid, renderSvg } from "@rendermaid/core";

const markdownContent = `
# My Document

\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
`;

const diagrams = extractMermaidFromMarkdown(markdownContent);
diagrams.forEach(diagramText => {
  const parseResult = parseMermaid(diagramText);
  if (parseResult.success) {
    const svgResult = renderSvg(parseResult.data);
    // Process rendered SVG
  }
});
```

@rendermaid/core v0.6.0 represents the evolution of server-side Mermaid rendering, combining functional programming principles with modern TypeScript features to deliver a robust, performant, and type-safe solution for diagram processing. With advanced analysis capabilities, enhanced validation, and improved rendering quality, v0.6.0 sets the standard for professional diagram processing in TypeScript applications.
