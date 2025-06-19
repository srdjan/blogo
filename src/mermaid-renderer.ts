import { parseMermaid, renderSvg } from "@rendermaid/core";
import { match } from "ts-pattern";

// === Result Type for Error Handling ===

type RenderResult =
  | { success: true; content: string }
  | { success: false; error: string };

// === Configuration ===

const DEFAULT_SVG_CONFIG = {
  width: 800,
  height: 600,
  theme: "light" as const,
  nodeSpacing: 150,
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
 * Core rendering function that returns a Result type
 */
const renderMermaidDiagram = (mermaidText: string): RenderResult => {
  try {
    // Parse the Mermaid diagram using @rendermaid/core
    const parseResult = parseMermaid(mermaidText.trim());

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error || "Failed to parse Mermaid diagram",
      };
    }

    // Render to SVG using @rendermaid/core
    const svgResult = renderSvg(parseResult.data, DEFAULT_SVG_CONFIG);

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
 * Validates if a string contains valid Mermaid syntax
 */
export const isValidMermaidSyntax = (mermaidText: string): boolean => {
  try {
    const parseResult = parseMermaid(mermaidText.trim());
    return parseResult.success;
  } catch {
    return false;
  }
};

/**
 * Gets information about a Mermaid diagram without rendering it
 */
export const getMermaidInfo = (mermaidText: string): {
  isValid: boolean;
  nodeCount?: number;
  edgeCount?: number;
  diagramType?: unknown;
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

    return {
      isValid: true,
      nodeCount: ast.nodes.size,
      edgeCount: ast.edges.length,
      diagramType: ast.diagramType,
    };
  } catch (error) {
    return {
      isValid: false,
      error: String(error),
    };
  }
};
