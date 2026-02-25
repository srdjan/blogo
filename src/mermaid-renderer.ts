import {
  analyzeAST,
  enhanceAST,
  parseMermaid,
  renderSvg,
  type SvgConfig,
  validateAST,
  withPerformanceMonitoring,
} from "@rendermaid/core";
import { createInMemoryCache } from "./ports/cache.ts";
import { err, match, ok } from "./lib/result.ts";
import type { AppResult } from "./lib/types.ts";
import { createError } from "./lib/error.ts";

// === SVG Cache ===

const svgCache = createInMemoryCache<string>();

const buildCacheKey = (
  text: string,
  config?: Partial<SvgConfig>,
): string => config ? `${text}\0${JSON.stringify(config)}` : text;

// === Configuration ===

const DEFAULT_SVG_CONFIG: SvgConfig = {
  width: 800,
  height: 800,
  theme: "light",
  nodeSpacing: 120,
};

const calculateDynamicConfig = (analysis: {
  readonly complexity: number;
  readonly depth: number;
}): SvgConfig => {
  const baseConfig = { ...DEFAULT_SVG_CONFIG };
  const depth = analysis.depth || 3;

  const layerSpacing = baseConfig.nodeSpacing * 1.5;
  const calculatedHeight = 80 + (depth * layerSpacing) + 60 + 120 + 40;
  const dynamicHeight = Math.max(baseConfig.height, calculatedHeight);

  if (analysis.complexity > 20) {
    return {
      ...baseConfig,
      height: Math.max(dynamicHeight, 1000),
      width: Math.max(baseConfig.width, 1000),
    };
  }

  return {
    ...baseConfig,
    height: dynamicHeight,
  };
};

// === Error HTML rendering ===

const renderErrorHtml = (message: string): string =>
  `<div class="mermaid-error"><strong>Mermaid Error:</strong> ${message}</div>`;

// === Public API ===

export const renderMermaidWithConfig = (
  mermaidText: string,
  customConfig?: Partial<SvgConfig>,
): string => {
  const cacheKey = buildCacheKey(mermaidText, customConfig);
  const cacheResult = svgCache.get(cacheKey);
  if (cacheResult.ok && cacheResult.value.status === "hit") {
    return cacheResult.value.value;
  }

  const result = renderMermaidDiagramCore(mermaidText, customConfig);

  return match(result, {
    ok: (svg) => {
      svgCache.set(cacheKey, svg);
      return svg;
    },
    error: (e) => renderErrorHtml(e.message),
  });
};

export const renderMermaidToSVG = (mermaidText: string): string => {
  const cacheKey = buildCacheKey(mermaidText);
  const cacheResult = svgCache.get(cacheKey);
  if (cacheResult.ok && cacheResult.value.status === "hit") {
    return cacheResult.value.value;
  }

  const result = renderMermaidDiagramCore(mermaidText);

  return match(result, {
    ok: (svg) => {
      svgCache.set(cacheKey, svg);
      return svg;
    },
    error: (e) => renderErrorHtml(e.message),
  });
};

// === Core rendering ===

const renderMermaidDiagramCore = (
  mermaidText: string,
  customConfig?: Partial<SvgConfig>,
): AppResult<string> => {
  try {
    const trimmedText = mermaidText.trim();

    if (trimmedText.startsWith("graph ")) {
      return err(createError(
        "RenderError",
        "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      ));
    }

    if (trimmedText.startsWith("sequenceDiagram")) {
      return err(createError(
        "RenderError",
        "Sequence diagrams are not yet supported in @rendermaid/core v0.6.0. Please use flowchart format.",
      ));
    }

    const parseResult = parseMermaid(trimmedText);

    if (!parseResult.success) {
      return err(createError(
        "RenderError",
        parseResult.error || "Failed to parse Mermaid diagram",
      ));
    }

    const ast = parseResult.data;

    const validationErrors = validateAST(ast);
    if (validationErrors.length > 0) {
      return err(createError(
        "RenderError",
        `Validation errors: ${validationErrors.join(", ")}`,
      ));
    }

    const enhancedAST = enhanceAST(ast);
    const analysis = analyzeAST(enhancedAST);

    const finalConfig = customConfig
      ? { ...calculateDynamicConfig(analysis), ...customConfig }
      : calculateDynamicConfig(analysis);

    const renderFunction = analysis.complexity > 20
      ? withPerformanceMonitoring(renderSvg, "Complex Mermaid Rendering")
      : renderSvg;

    const svgResult = renderFunction(enhancedAST, finalConfig);

    if (!svgResult.success) {
      return err(createError(
        "RenderError",
        svgResult.error || "Failed to render SVG",
      ));
    }

    return ok(wrapSvgWithClass(svgResult.data));
  } catch (error) {
    return err(
      createError("RenderError", `Rendering error: ${String(error)}`, error),
    );
  }
};

const wrapSvgWithClass = (svgContent: string): string => {
  if (svgContent.includes('class="mermaid-diagram"')) {
    return svgContent;
  }
  return svgContent.replace(
    /<svg([^>]*)>/,
    '<svg$1 class="mermaid-diagram">',
  );
};

// === Utility Functions ===

export const isValidMermaidSyntax = (mermaidText: string): boolean => {
  try {
    const parseResult = parseMermaid(mermaidText.trim());
    if (!parseResult.success) return false;
    const validationErrors = validateAST(parseResult.data);
    return validationErrors.length === 0;
  } catch {
    return false;
  }
};

export const getMermaidInfo = (mermaidText: string): {
  isValid: boolean;
  nodeCount?: number;
  edgeCount?: number;
  diagramType?: unknown;
  complexity?: number;
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
    const validationErrors = validateAST(ast);
    const analysis = analyzeAST(ast);

    return {
      isValid: validationErrors.length === 0,
      nodeCount: ast.nodes.size,
      edgeCount: ast.edges.length,
      diagramType: ast.diagramType,
      complexity: analysis.complexity,
      ...(validationErrors.length > 0 && { validationErrors }),
    };
  } catch (error) {
    return {
      isValid: false,
      error: String(error),
    };
  }
};

export const renderWithMetrics = (mermaidText: string): {
  result: string;
  renderTime?: number;
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
    const dynamicConfig = calculateDynamicConfig(analysis);

    const monitoredRender = withPerformanceMonitoring(
      renderSvg,
      "Mermaid Rendering",
    );
    const svgResult = monitoredRender(ast, dynamicConfig);
    const endTime = performance.now();

    if (!svgResult.success) {
      return {
        result: "",
        renderTime: endTime - startTime,
        error: svgResult.error || "Render error",
        ...(validationErrors.length > 0 && { validationErrors }),
      };
    }

    return {
      result: wrapSvgWithClass(svgResult.data),
      renderTime: endTime - startTime,
      ...(validationErrors.length > 0 && { validationErrors }),
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
