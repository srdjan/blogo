import { match } from "npm:ts-pattern@5.0.5";

// === Core Type Definitions ===

type Point = readonly [number, number];

type MermaidNode = {
  readonly id: string;
  readonly label: string;
  readonly shape: "rect" | "circle" | "diamond" | "rounded";
  readonly position: Point;
};

type MermaidEdge = {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style: "solid" | "dashed" | "dotted";
};

type MermaidDiagram = {
  readonly type: "flowchart" | "graph" | "sequenceDiagram";
  readonly direction: "TD" | "LR" | "RL" | "BT";
  readonly nodes: readonly MermaidNode[];
  readonly edges: readonly MermaidEdge[];
};

type ParsedMermaid =
  | { success: true; diagram: MermaidDiagram }
  | { success: false; error: string };

// === Functional Parser Implementation ===

const parseNodeShape = (syntax: string): MermaidNode["shape"] =>
  match(syntax)
    .when((s) => s.includes("(") && s.includes(")"), () => "rounded" as const)
    .when((s) => s.includes("{") && s.includes("}"), () => "diamond" as const)
    .when((s) => s.includes("((") && s.includes("))"), () => "circle" as const)
    .otherwise(() => "rect" as const);

const extractNodeId = (nodeText: string): string =>
  nodeText.replace(/[\[\](){}]/g, "").replace(/:::.*$/, "").split(/\s+/)[0];

const extractNodeLabel = (nodeText: string): string => {
  const bracketMatch = nodeText.match(/\[(.*?)\]/) ||
    nodeText.match(/\((.*?)\)/) ||
    nodeText.match(/\{(.*?)\}/);
  return bracketMatch?.[1] || extractNodeId(nodeText);
};

const parseEdgeStyle = (connector: string): MermaidEdge["style"] =>
  match(connector)
    .when((c) => c.includes("-."), () => "dashed" as const)
    .when((c) => c.includes(".."), () => "dotted" as const)
    .otherwise(() => "solid" as const);

const parseDirection = (line: string): MermaidDiagram["direction"] => {
  const dirMatch = line.match(/flowchart\s+(TD|LR|RL|BT)/i) ||
    line.match(/graph\s+(TD|LR|RL|BT)/i);
  return (dirMatch?.[1] as MermaidDiagram["direction"]) || "TD";
};

const parseDiagramType = (firstLine: string): MermaidDiagram["type"] =>
  match(firstLine.toLowerCase().trim())
    .when(
      (l) => l.startsWith("sequencediagram"),
      () => "sequenceDiagram" as const,
    )
    .when((l) => l.startsWith("flowchart"), () => "flowchart" as const)
    .otherwise(() => "graph" as const);

// === Node and Edge Extraction ===

const calculateNodePosition = (
  index: number,
  total: number,
  direction: MermaidDiagram["direction"],
): Point => {
  if (direction === "LR" || direction === "RL") {
    // Horizontal layout
    const rows = Math.ceil(Math.sqrt(total));
    const row = index % rows;
    const col = Math.floor(index / rows);
    const x = direction === "LR"
      ? col * 200 + 100
      : (Math.ceil(total / rows) - col - 1) * 200 + 100;
    return [x, row * 120 + 100];
  } else {
    // Vertical layout (TD, BT)
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const y = direction === "BT"
      ? (Math.ceil(total / cols) - row - 1) * 120 + 100
      : row * 120 + 100;
    return [col * 200 + 100, y];
  }
};

const extractNodes = (
  lines: readonly string[],
  direction: MermaidDiagram["direction"],
): readonly MermaidNode[] => {
  const nodeMap = new Map<
    string,
    { label: string; shape: MermaidNode["shape"] }
  >();

  lines.forEach((line) => {
    // Skip comments and styling directives, but not node connections that reference styled nodes
    if (line.startsWith("%%") || line.startsWith("classDef")) {
      return;
    }

    const connectionMatch = line.match(
      /(\w+)(?:\[.*?\])?\s*(?:-->|---|\-\.-|\.\.\.|->)\s*(?:\|[^|]*\|)?\s*(\w+)(?:\[.*?\])?/,
    );

    if (connectionMatch) {
      const [, sourceNode, targetNode] = connectionMatch;

      // For connections, we only get the node IDs, not labels
      // Node labels come from standalone definitions or the full connection line
      if (!nodeMap.has(sourceNode)) {
        nodeMap.set(sourceNode, { label: sourceNode, shape: "rect" });
      }
      if (!nodeMap.has(targetNode)) {
        nodeMap.set(targetNode, { label: targetNode, shape: "rect" });
      }
    }

    // Also look for standalone node definitions (nodes without connections)
    const nodeMatch = line.match(/^\s*(\w+)\[(.*?)\](?::::\w+)?$/) ||
      line.match(/^\s*(\w+)\((.*?)\)(?::::\w+)?$/) ||
      line.match(/^\s*(\w+)\{(.*?)\}(?::::\w+)?$/);

    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      const shape = parseNodeShape(line);

      // Update existing node with proper label and shape, or create new one
      nodeMap.set(id, { label, shape });
    }

    // Also check for inline node definitions in connections
    const inlineMatch = line.match(
      /(\w+)\[(.*?)\]\s*(?:-->|---|\-\.-|\.\.\.|->)/,
    );
    if (inlineMatch) {
      const [, id, label] = inlineMatch;
      const shape = parseNodeShape(inlineMatch[0]);
      nodeMap.set(id, { label, shape });
    }

    const inlineMatchTarget = line.match(
      /(?:-->|---|\-\.-|\.\.\.|->)\s*(?:\|[^|]*\|)?\s*(\w+)\[(.*?)\]/,
    );
    if (inlineMatchTarget) {
      const [, id, label] = inlineMatchTarget;
      const shape = parseNodeShape(inlineMatchTarget[0]);
      nodeMap.set(id, { label, shape });
    }
  });

  return Array.from(nodeMap.entries()).map(([id, { label, shape }], index) => ({
    id,
    label,
    shape,
    position: calculateNodePosition(index, nodeMap.size, direction),
  }));
};

const extractEdges = (lines: readonly string[]): readonly MermaidEdge[] => {
  const edges: MermaidEdge[] = [];

  lines.forEach((line) => {
    // Skip comments and styling directives, but not node connections that reference styled nodes
    if (line.startsWith("%%") || line.startsWith("classDef")) {
      return;
    }

    const connectionMatch = line.match(
      /(\w+)(?:\[.*?\])?\s*(-->|---|->|\-\.-|\.\.\.)\s*(?:\|\s*([^|]+)\s*\|\s*)?(\w+)(?:\[.*?\])?/,
    );

    if (connectionMatch) {
      const [, fromNode, connector, edgeLabel, toNode] = connectionMatch;

      edges.push({
        from: extractNodeId(fromNode),
        to: extractNodeId(toNode),
        label: edgeLabel?.trim(),
        style: parseEdgeStyle(connector),
      });
    }
  });

  return edges;
};

// === Main Parser Function ===

const parseMermaidSyntax = (mermaidText: string): ParsedMermaid => {
  try {
    const lines = mermaidText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("%%"));

    if (lines.length === 0) {
      return { success: false, error: "Empty Mermaid diagram" };
    }

    const firstLine = lines[0];
    const contentLines = lines.slice(1);
    const direction = parseDirection(firstLine);

    const diagram: MermaidDiagram = {
      type: parseDiagramType(firstLine),
      direction,
      nodes: extractNodes(contentLines, direction),
      edges: extractEdges(contentLines),
    };

    return { success: true, diagram };
  } catch (error) {
    return { success: false, error: `Parse error: ${String(error)}` };
  }
};

// === SVG Rendering Engine ===

const createSVGElement = (
  tag: string,
  attrs: Record<string, string | number>,
): string => {
  const attributeString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return `<${tag} ${attributeString}>`;
};

const renderNodeShape = (node: MermaidNode): string => {
  const { position: [x, y], label, shape } = node;

  return match(shape)
    .with("rect", () => `
      ${
      createSVGElement("rect", {
        x: x - 60,
        y: y - 25,
        width: 120,
        height: 50,
        fill: "#e1f5fe",
        stroke: "#01579b",
        "stroke-width": 2,
        rx: 5,
      })
    }
      ${
      createSVGElement("text", {
        x,
        y: y + 5,
        "text-anchor": "middle",
        "font-family":
          "ui-monospace, 'SF Mono', Monaco, 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
        "font-size": 12,
      })
    }${label}</text>`)
    .with("circle", () => `
      ${
      createSVGElement("circle", {
        cx: x,
        cy: y,
        r: 35,
        fill: "#f3e5f5",
        stroke: "#4a148c",
        "stroke-width": 2,
      })
    }
      ${
      createSVGElement("text", {
        x,
        y: y + 5,
        "text-anchor": "middle",
        "font-family":
          "ui-monospace, 'SF Mono', Monaco, 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
        "font-size": 12,
      })
    }${label}</text>`)
    .with("diamond", () => `
      ${
      createSVGElement("polygon", {
        points: `${x},${y - 30} ${x + 50},${y} ${x},${y + 30} ${x - 50},${y}`,
        fill: "#fff3e0",
        stroke: "#e65100",
        "stroke-width": 2,
      })
    }
      ${
      createSVGElement("text", {
        x,
        y: y + 5,
        "text-anchor": "middle",
        "font-family":
          "ui-monospace, 'SF Mono', Monaco, 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
        "font-size": 11,
      })
    }${label}</text>`)
    .with("rounded", () => `
      ${
      createSVGElement("rect", {
        x: x - 60,
        y: y - 25,
        width: 120,
        height: 50,
        fill: "#e8f5e8",
        stroke: "#2e7d32",
        "stroke-width": 2,
        rx: 25,
      })
    }
      ${
      createSVGElement("text", {
        x,
        y: y + 5,
        "text-anchor": "middle",
        "font-family":
          "ui-monospace, 'SF Mono', Monaco, 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
        "font-size": 12,
      })
    }${label}</text>`)
    .exhaustive();
};

const renderEdge = (
  edge: MermaidEdge,
  nodes: readonly MermaidNode[],
): string => {
  const fromNode = nodes.find((n) => n.id === edge.from);
  const toNode = nodes.find((n) => n.id === edge.to);

  if (!fromNode || !toNode) return "";

  const [x1, y1] = fromNode.position;
  const [x2, y2] = toNode.position;

  const strokeDasharray = match(edge.style)
    .with("dashed", () => "10,5")
    .with("dotted", () => "3,3")
    .otherwise(() => "none");

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return `
    ${
    createSVGElement("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: "#666",
      "stroke-width": 2,
      "stroke-dasharray": strokeDasharray,
      "marker-end": "url(#arrowhead)",
    })
  }
    ${
    edge.label
      ? `
      ${
        createSVGElement("text", {
          x: midX,
          y: midY - 5,
          "text-anchor": "middle",
          "font-family":
            "ui-monospace, 'SF Mono', Monaco, 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
          "font-size": 10,
          fill: "#444",
        })
      }${edge.label}</text>`
      : ""
  }
  `;
};

const renderMermaidDiagram = (diagram: MermaidDiagram): string => {
  const width = Math.max(600, ...diagram.nodes.map((n) => n.position[0] + 100));
  const height = Math.max(
    400,
    ...diagram.nodes.map((n) => n.position[1] + 100),
  );

  const arrowMarker = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
      </marker>
    </defs>
  `;

  const nodeElements = diagram.nodes.map(renderNodeShape).join("\n");
  const edgeElements = diagram.edges.map((edge) =>
    renderEdge(edge, diagram.nodes)
  ).join("\n");

  return `<svg class="mermaid-diagram" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${arrowMarker}
    ${edgeElements}
    ${nodeElements}
  </svg>`;
};

// === Main Renderer Function ===

export const renderMermaidToSVG = (mermaidText: string): string => {
  const parseResult = parseMermaidSyntax(mermaidText);

  return match(parseResult)
    .with({ success: true }, ({ diagram }) => renderMermaidDiagram(diagram))
    .with(
      { success: false },
      ({ error }) =>
        `<div class="mermaid-error" style="padding: 1rem; border: 1px solid #ff6b6b; background: #ffe0e0; color: #d63031; border-radius: 4px;">
        <strong>Mermaid Parse Error:</strong> ${error}
      </div>`,
    )
    .exhaustive();
};

// === Export Types ===

export type { MermaidDiagram, MermaidEdge, MermaidNode, ParsedMermaid };

export { parseMermaidSyntax, renderMermaidDiagram };
