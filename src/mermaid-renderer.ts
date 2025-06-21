import {
  parseMermaid,
  renderSvg,
  analyzeAST,
  validateAST,
  enhanceAST,
  withPerformanceMonitoring,
  type SvgConfig
} from "@rendermaid/core";
import { match } from "ts-pattern";

// === Types ===

// Analysis results interface (matching v0.6.0 ASTAnalysis)
interface DiagramAnalysis {
  complexity: number;
  nodeShapes: Record<string, number>;
  edgeTypes: Record<string, number>;
  depth: number;
  cycleDetected: boolean;
}

type RenderResult =
  | { success: true; content: string; analysis?: DiagramAnalysis }
  | { success: false; error: string };

// === Enhanced Configuration ===

const DEFAULT_SVG_CONFIG: SvgConfig = {
  width: 800,
  height: 800, // Increased from 600 to prevent bottom overflow
  theme: "light",
  nodeSpacing: 120, // Optimized spacing from v0.6.0
};

/**
 * Calculate dynamic SVG configuration based on diagram complexity
 */
const calculateDynamicConfig = (analysis: DiagramAnalysis): SvgConfig => {
  const baseConfig = { ...DEFAULT_SVG_CONFIG };

  // Calculate minimum height based on diagram structure
  const depth = analysis.depth || 3;

  // Dynamic height calculation with generous bottom padding
  const nodeHeight = 60; // Estimated node height including labels
  const layerSpacing = baseConfig.nodeSpacing * 1.5; // Layer spacing from @rendermaid/core
  const topPadding = 80; // Top margin
  const bottomPadding = 120; // Generous bottom padding to prevent overflow
  const edgeLabelPadding = 40; // Additional space for edge labels

  const calculatedHeight = topPadding + (depth * layerSpacing) + nodeHeight + bottomPadding + edgeLabelPadding;

  // Use the larger of default height or calculated height
  const dynamicHeight = Math.max(baseConfig.height, calculatedHeight);

  // For complex diagrams, add extra height and width
  if (analysis.complexity > 20) {
    return {
      ...baseConfig,
      height: Math.max(dynamicHeight, 1000), // Minimum 1000px for complex diagrams
      width: Math.max(baseConfig.width, 1000), // Also increase width for complex diagrams
    };
  }

  return {
    ...baseConfig,
    height: dynamicHeight,
  };
};

/**
 * Enhanced rendering function with custom configuration override
 */
export const renderMermaidWithConfig = (mermaidText: string, customConfig?: Partial<SvgConfig>): string => {
  const renderResult = renderMermaidDiagramWithConfig(mermaidText, customConfig);

  return match(renderResult)
    .with({ success: true }, ({ content }) => content)
    .with(
      { success: false },
      ({ error }) =>
        `<div class="mermaid-error" style="padding: 1rem; border: 1px solid #ff6b6b; background: #ffe0e0; color: #d63031; border-radius: 4px;">
        <strong>Mermaid Parse Error:</strong> ${error}
      </div>`,
    )
    .exhaustive();
};

/**
 * Core rendering function with custom configuration support
 */
const renderMermaidDiagramWithConfig = (mermaidText: string, customConfig?: Partial<SvgConfig>): RenderResult => {
  try {
    const trimmedText = mermaidText.trim();

    // Provide helpful error messages for common syntax issues
    if (trimmedText.startsWith("graph ")) {
      return {
        success: false,
        error: "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      };
    }

    if (trimmedText.startsWith("sequenceDiagram")) {
      return {
        success: false,
        error: "Sequence diagrams are not yet supported in @rendermaid/core v0.6.0. Please use flowchart format.",
      };
    }

    // Parse the Mermaid diagram using @rendermaid/core
    const parseResult = parseMermaid(trimmedText);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error || "Failed to parse Mermaid diagram",
      };
    }

    const ast = parseResult.data;

    // v0.6.0: Validate AST integrity before rendering
    const validationErrors = validateAST(ast);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Validation errors: ${validationErrors.join(", ")}`,
      };
    }

    // v0.6.0: Enhance AST with analysis metadata
    const enhancedAST = enhanceAST(ast);

    // v0.6.0: Analyze diagram complexity for optimization
    const analysis = analyzeAST(enhancedAST);

    // Calculate dynamic configuration or use custom config
    const finalConfig = customConfig
      ? { ...calculateDynamicConfig(analysis), ...customConfig }
      : calculateDynamicConfig(analysis);

    // v0.6.0: Use performance monitoring for complex diagrams
    const renderFunction = analysis.complexity > 20
      ? withPerformanceMonitoring(renderSvg, "Complex Mermaid Rendering")
      : renderSvg;

    // Render to SVG using @rendermaid/core with final configuration
    const svgResult = renderFunction(enhancedAST, finalConfig);

    if (!svgResult.success) {
      return {
        success: false,
        error: svgResult.error || "Failed to render SVG",
      };
    }

    // Wrap the SVG with the expected CSS class for styling consistency
    const wrappedSvg = wrapSvgWithClass(svgResult.data);

    return {
      success: true,
      content: wrappedSvg,
      analysis, // Include analysis data for debugging/optimization
    };
  } catch (error) {
    return {
      success: false,
      error: `Rendering error: ${String(error)}`,
    };
  }
};

// === Main Renderer Function ===

/**
 * Renders a Mermaid diagram to SVG using @rendermaid/core
 * Maintains the same interface as the previous custom implementation
 */
export const renderMermaidToSVG = (mermaidText: string): string => {
  const renderResult = renderMermaidDiagram(mermaidText);

  return match(renderResult)
    .with({ success: true }, ({ content }) => content)
    .with(
      { success: false },
      ({ error }) =>
        `<div class="mermaid-error" style="padding: 1rem; border: 1px solid #ff6b6b; background: #ffe0e0; color: #d63031; border-radius: 4px;">
        <strong>Mermaid Parse Error:</strong> ${error}
      </div>`,
    )
    .exhaustive();
};

/**
 * Enhanced core rendering function with v0.6.0 features
 */
const renderMermaidDiagram = (mermaidText: string): RenderResult => {
  try {
    const trimmedText = mermaidText.trim();

    // Provide helpful error messages for common syntax issues
    if (trimmedText.startsWith("graph ")) {
      return {
        success: false,
        error: "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      };
    }

    if (trimmedText.startsWith("sequenceDiagram")) {
      return {
        success: false,
        error: "Sequence diagrams are not yet supported in @rendermaid/core v0.6.0. Please use flowchart format.",
      };
    }

    // Parse the Mermaid diagram using @rendermaid/core
    const parseResult = parseMermaid(trimmedText);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error || "Failed to parse Mermaid diagram",
      };
    }

    const ast = parseResult.data;

    // v0.6.0: Validate AST integrity before rendering
    const validationErrors = validateAST(ast);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Validation errors: ${validationErrors.join(", ")}`,
      };
    }

    // v0.6.0: Enhance AST with analysis metadata
    const enhancedAST = enhanceAST(ast);

    // v0.6.0: Analyze diagram complexity for optimization
    const analysis = analyzeAST(enhancedAST);

    // Calculate dynamic configuration to prevent bottom overflow
    const dynamicConfig = calculateDynamicConfig(analysis);

    // v0.6.0: Use performance monitoring for complex diagrams
    const renderFunction = analysis.complexity > 20
      ? withPerformanceMonitoring(renderSvg, "Complex Mermaid Rendering")
      : renderSvg;

    // Render to SVG using @rendermaid/core with dynamic configuration
    const svgResult = renderFunction(enhancedAST, dynamicConfig);

    if (!svgResult.success) {
      return {
        success: false,
        error: svgResult.error || "Failed to render SVG",
      };
    }

    // Wrap the SVG with the expected CSS class for styling consistency
    const wrappedSvg = wrapSvgWithClass(svgResult.data);

    return {
      success: true,
      content: wrappedSvg,
      analysis, // Include analysis data for debugging/optimization
    };
  } catch (error) {
    return {
      success: false,
      error: `Rendering error: ${String(error)}`,
    };
  }
};

/**
 * Wraps the SVG output with the expected CSS class for styling consistency
 */
const wrapSvgWithClass = (svgContent: string): string => {
  // Check if the SVG already has the mermaid-diagram class
  if (svgContent.includes('class="mermaid-diagram"')) {
    return svgContent;
  }

  // Add the class to the SVG element for consistent styling
  return svgContent.replace(
    /<svg([^>]*)>/,
    '<svg$1 class="mermaid-diagram">',
  );
};

// === Export Types for Compatibility ===

export type { RenderResult };

// === Additional Utility Functions ===

/**
 * Enhanced validation with v0.6.0 comprehensive checking
 */
export const isValidMermaidSyntax = (mermaidText: string): boolean => {
  try {
    const parseResult = parseMermaid(mermaidText.trim());
    if (!parseResult.success) return false;

    // v0.6.0: Additional validation using validateAST
    const validationErrors = validateAST(parseResult.data);
    return validationErrors.length === 0;
  } catch {
    return false;
  }
};

/**
 * Enhanced diagram analysis with v0.6.0 comprehensive metrics
 */
export const getMermaidInfo = (mermaidText: string): {
  isValid: boolean;
  nodeCount?: number;
  edgeCount?: number;
  diagramType?: unknown;
  complexity?: number;
  analysis?: DiagramAnalysis;
  validationErrors?: string[];
  error?: string;
} => {
  try {
    const parseResult = parseMermaid(mermaidText.trim());

    if (!parseResult.success) {
      return {
        isValid: false,
        error: parseResult.error || "Parse error",
      };
    }

    const ast = parseResult.data;

    // v0.6.0: Comprehensive validation
    const validationErrors = validateAST(ast);

    // v0.6.0: Detailed analysis
    const analysis = analyzeAST(ast);

    return {
      isValid: validationErrors.length === 0,
      nodeCount: ast.nodes.size,
      edgeCount: ast.edges.length,
      diagramType: ast.diagramType,
      complexity: analysis.complexity,
      analysis,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  } catch (error) {
    return {
      isValid: false,
      error: String(error),
    };
  }
};

/**
 * v0.6.0: New function to get detailed performance metrics
 */
export const renderWithMetrics = (mermaidText: string): {
  result: string;
  renderTime?: number;
  analysis?: DiagramAnalysis;
  validationErrors?: string[];
  error?: string;
} => {
  const startTime = performance.now();

  try {
    const parseResult = parseMermaid(mermaidText.trim());

    if (!parseResult.success) {
      return {
        result: "",
        error: parseResult.error || "Parse error",
      };
    }

    const ast = parseResult.data;
    const validationErrors = validateAST(ast);
    const analysis = analyzeAST(ast);

    // Calculate dynamic configuration to prevent bottom overflow
    const dynamicConfig = calculateDynamicConfig(analysis);

    // Use performance monitoring for rendering
    const monitoredRender = withPerformanceMonitoring(renderSvg, "Mermaid Rendering");
    const svgResult = monitoredRender(ast, dynamicConfig);

    const endTime = performance.now();

    if (!svgResult.success) {
      return {
        result: "",
        renderTime: endTime - startTime,
        analysis,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        error: svgResult.error || "Render error",
      };
    }

    return {
      result: wrapSvgWithClass(svgResult.data),
      renderTime: endTime - startTime,
      analysis,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      result: "",
      renderTime: endTime - startTime,
      error: String(error),
    };
  }
};
