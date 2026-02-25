import {
  analyzeAST,
  enhanceAST,
  parseMermaid,
  renderSvg,
  type SvgConfig,
  validateAST,
  withPerformanceMonitoring,
} from "@srdjan/rendermaid";
import { createInMemoryCache } from "./ports/cache.ts";
import { err, match, ok } from "./lib/result.ts";
import type { AppResult } from "./lib/types.ts";
import { createError } from "./lib/error.ts";
import { escapeHtml, escapeXml } from "./utils.ts";

// === SVG Cache ===

const svgCache = createInMemoryCache<string>();

const normalizeMermaidText = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .trim();

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${
    entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(
      ",",
    )
  }}`;
};

const buildCacheKey = (
  text: string,
  config?: Partial<SvgConfig>,
): string => {
  const normalizedText = normalizeMermaidText(text);
  if (!config) return normalizedText;
  return `${normalizedText}\0${stableStringify(config)}`;
};

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
  `<div class="mermaid-error"><strong>Mermaid Error:</strong> ${
    escapeHtml(message)
  }</div>`;

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

export const renderMermaidToSVG = (mermaidText: string): string =>
  renderMermaidWithConfig(mermaidText);

// === Core rendering ===

const renderMermaidDiagramCore = (
  mermaidText: string,
  customConfig?: Partial<SvgConfig>,
): AppResult<string> => {
  try {
    const trimmedText = normalizeMermaidText(mermaidText);

    if (trimmedText.toLowerCase().startsWith("graph ")) {
      return err(createError(
        "RenderError",
        "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      ));
    }

    if (trimmedText.toLowerCase().startsWith("sequencediagram")) {
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
    const sanitizedAST = sanitizeAstLabels(enhancedAST);
    const analysis = analyzeAST(sanitizedAST);

    const finalConfig = customConfig
      ? { ...calculateDynamicConfig(analysis), ...customConfig }
      : calculateDynamicConfig(analysis);

    const renderFunction = analysis.complexity > 20
      ? withPerformanceMonitoring(renderSvg, "Complex Mermaid Rendering")
      : renderSvg;

    const svgResult = renderFunction(sanitizedAST, finalConfig);

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
  const svgTagMatch = svgContent.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) {
    return svgContent;
  }

  const svgTag = svgTagMatch[0];
  if (
    /class\s*=\s*["'][^"']*\bmermaid-diagram\b[^"']*["']/i.test(svgTag)
  ) {
    return svgContent;
  }

  let updatedTag = svgTag;
  if (/class\s*=/.test(svgTag)) {
    updatedTag = svgTag.replace(
      /class\s*=\s*(["'])([^"']*)\1/i,
      (_match, quote: string, classNames: string) => {
        const merged = `${classNames} mermaid-diagram`.trim();
        return `class=${quote}${merged}${quote}`;
      },
    );
  } else {
    const classAttr = ' class="mermaid-diagram"';
    updatedTag = /\/>$/.test(svgTag)
      ? svgTag.replace(/\s*\/>$/, `${classAttr} />`)
      : svgTag.replace(/>$/, `${classAttr}>`);
  }

  return svgContent.replace(svgTag, updatedTag);
};

// === Utility Functions ===

export const isValidMermaidSyntax = (mermaidText: string): boolean => {
  try {
    const normalized = normalizeMermaidText(mermaidText);
    if (
      normalized.toLowerCase().startsWith("graph ") ||
      normalized.toLowerCase().startsWith("sequencediagram")
    ) {
      return false;
    }

    const parseResult = parseMermaid(normalized);
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
    const normalized = normalizeMermaidText(mermaidText);
    if (normalized.toLowerCase().startsWith("graph ")) {
      return {
        isValid: false,
        error:
          "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      };
    }
    if (normalized.toLowerCase().startsWith("sequencediagram")) {
      return {
        isValid: false,
        error:
          "Sequence diagrams are not yet supported in @rendermaid/core v0.6.0. Please use flowchart format.",
      };
    }

    const parseResult = parseMermaid(normalized);

    if (!parseResult.success) {
      return {
        isValid: false,
        error: parseResult.error || "Parse error",
      };
    }

    const ast = parseResult.data;
    const validationErrors = validateAST(ast);
    const enhanced = enhanceAST(ast);
    const analysis = analyzeAST(enhanced);

    return {
      isValid: validationErrors.length === 0,
      nodeCount: enhanced.nodes.size,
      edgeCount: enhanced.edges.length,
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
    const normalized = normalizeMermaidText(mermaidText);
    if (normalized.toLowerCase().startsWith("graph ")) {
      return {
        result: "",
        error:
          "Use 'flowchart TD' instead of 'graph TD' for @rendermaid/core v0.6.0",
      };
    }
    if (normalized.toLowerCase().startsWith("sequencediagram")) {
      return {
        result: "",
        error:
          "Sequence diagrams are not yet supported in @rendermaid/core v0.6.0. Please use flowchart format.",
      };
    }

    const parseResult = parseMermaid(normalized);

    if (!parseResult.success) {
      return {
        result: "",
        error: parseResult.error || "Parse error",
      };
    }

    const ast = parseResult.data;
    const validationErrors = validateAST(ast);

    if (validationErrors.length > 0) {
      const endTime = performance.now();
      return {
        result: "",
        renderTime: endTime - startTime,
        validationErrors,
        error: `Validation errors: ${validationErrors.join(", ")}`,
      };
    }

    const enhancedAST = enhanceAST(ast);
    const sanitizedAST = sanitizeAstLabels(enhancedAST);
    const analysis = analyzeAST(sanitizedAST);
    const dynamicConfig = calculateDynamicConfig(analysis);

    const monitoredRender = withPerformanceMonitoring(
      renderSvg,
      "Mermaid Rendering",
    );
    const svgResult = monitoredRender(sanitizedAST, dynamicConfig);
    const endTime = performance.now();

    if (!svgResult.success) {
      return {
        result: "",
        renderTime: endTime - startTime,
        error: svgResult.error || "Render error",
      };
    }

    return {
      result: wrapSvgWithClass(svgResult.data),
      renderTime: endTime - startTime,
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

const decodeBasicXmlEntities = (text: string): string =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const sanitizeSvgLabel = (label: string): string =>
  escapeXml(decodeBasicXmlEntities(label));

const sanitizeAstLabels = <
  T extends {
    nodes: ReadonlyMap<string, unknown>;
    edges: readonly unknown[];
  },
>(ast: T): T => {
  const nodes = new Map<string, unknown>();
  for (const [id, node] of ast.nodes.entries()) {
    if (
      node &&
      typeof node === "object" &&
      "label" in (node as Record<string, unknown>) &&
      typeof (node as { label?: unknown }).label === "string"
    ) {
      const nodeObject = node as Record<string, unknown>;
      nodes.set(id, {
        ...nodeObject,
        label: sanitizeSvgLabel(nodeObject.label as string),
      });
      continue;
    }
    nodes.set(id, node);
  }

  const edges = ast.edges.map((edge) => {
    if (
      edge &&
      typeof edge === "object" &&
      "label" in (edge as Record<string, unknown>) &&
      typeof (edge as { label?: unknown }).label === "string"
    ) {
      const edgeObject = edge as Record<string, unknown>;
      return {
        ...edgeObject,
        label: sanitizeSvgLabel(edgeObject.label as string),
      };
    }
    return edge;
  });

  return { ...ast, nodes, edges } as T;
};
